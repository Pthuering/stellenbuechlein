// Höflicher HTTP-Client: eigener User-Agent, Abstand pro Host und Crawl-delay aus der robots.txt,
// Wiederholungen, Zeichensatz-Erkennung, Zwischenspeicher pro Lauf. Sperren aus der robots.txt gelten
// nur mit ROBOTS=1 (siehe config.ts).

import { isAllowed, parseRobots, crawlDelaySeconds, type RobotsInfo } from './robots';
import type { IngestConfig } from './config';
import type { RunLog } from './log';

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  contentType: string;
  body: Buffer;
  /** Text mit erkanntem Zeichensatz. */
  text: string;
  isPdf: boolean;
  blockedByRobots?: boolean;
  error?: string;
}

export interface GetOptions {
  accept?: string;
  headers?: Record<string, string>;
  ignoreRobots?: boolean;
  maxBytes?: number;
  method?: 'GET' | 'POST';
  body?: string;
  noCache?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decode(body: Buffer, contentType: string): string {
  let charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();
  if (!charset) {
    const head = body.subarray(0, 2048).toString('latin1');
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase() ?? /encoding=["']([\w-]+)["']/i.exec(head)?.[1]?.toLowerCase();
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

export class Http {
  private robots = new Map<string, Promise<RobotsInfo | null>>();
  private hostChain = new Map<string, Promise<unknown>>();
  private hostDelay = new Map<string, number>();
  private cache = new Map<string, Promise<FetchResult>>();
  requests = 0;

  constructor(
    private readonly cfg: IngestConfig,
    private readonly log: RunLog,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** robots.txt eines Hosts (zwischengespeichert). */
  robotsFor(origin: string): Promise<RobotsInfo | null> {
    let p = this.robots.get(origin);
    if (!p) {
      p = this.rawFetch(`${origin}/robots.txt`, { accept: 'text/plain' })
        .then((r) => {
          if (!r.ok) return null;
          const info = parseRobots(r.text);
          const delay = crawlDelaySeconds(info, this.cfg.uaToken);
          if (delay != null) this.hostDelay.set(new URL(origin).host, Math.min(this.cfg.maxCrawlDelayMs, delay * 1000));
          return info;
        })
        .catch(() => null);
      this.robots.set(origin, p);
    }
    return p;
  }

  async allowed(url: string): Promise<boolean> {
    const u = new URL(url);
    const info = await this.robotsFor(u.origin);
    return info ? isAllowed(info, this.cfg.uaToken, u.pathname + u.search) : true;
  }

  async sitemapsFor(origin: string): Promise<string[]> {
    const info = await this.robotsFor(origin);
    return info?.sitemaps ?? [];
  }

  /** Reiht Anfragen pro Host hintereinander, mit Mindestabstand (oder Crawl-delay). */
  private schedule<T>(host: string, task: () => Promise<T>): Promise<T> {
    const prev = this.hostChain.get(host) ?? Promise.resolve();
    const run = prev.then(async () => {
      try {
        return await task();
      } finally {
        await sleep(this.hostDelay.get(host) ?? this.cfg.minHostIntervalMs);
      }
    });
    this.hostChain.set(host, run.catch(() => undefined));
    return run;
  }

  /**
   * Abruf mit Zwischenspeicher für die zuletzt benutzten Seiten (gleiche Liste oder Anzeige aus mehreren
   * Quellen). Begrenzt, weil ein Lauf Tausende Seiten liest; ohne Grenze lief der Speicher voll.
   */
  async get(url: string, opts: GetOptions = {}): Promise<FetchResult> {
    const key = `${opts.method ?? 'GET'} ${url} ${opts.body ?? ''}`;
    const cacheable = !opts.noCache && (opts.method ?? 'GET') === 'GET' && this.cfg.httpCacheMax > 0;
    if (cacheable) {
      const hit = this.cache.get(key);
      if (hit) {
        this.cache.delete(key);
        this.cache.set(key, hit);
        return hit;
      }
    }
    const p = this.getUncached(url, opts);
    if (cacheable) {
      this.cache.set(key, p);
      while (this.cache.size > this.cfg.httpCacheMax) this.cache.delete(this.cache.keys().next().value!);
      // Sehr große Antworten (meist PDFs) nicht aufheben
      void p.then((r) => {
        if (r.body.length > 4_000_000 && this.cache.get(key) === p) this.cache.delete(key);
      }).catch(() => this.cache.delete(key));
    }
    return p;
  }

  private async getUncached(url: string, opts: GetOptions): Promise<FetchResult> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return this.fail(url, 0, 'Ungültige Adresse');
    }
    if (!/^https?:$/.test(u.protocol)) return this.fail(url, 0, 'Nur http(s) wird unterstützt');
    if (this.cfg.respectRobots && !opts.ignoreRobots) {
      const ok = await this.allowed(url).catch(() => true);
      if (!ok) return { ...this.fail(url, 0, 'Durch robots.txt gesperrt'), blockedByRobots: true };
    } else {
      // Sperren gelten nicht (ROBOTS=0, Standard); die robots.txt wird nur für den Crawl-delay gelesen
      await this.robotsFor(u.origin).catch(() => null);
    }
    return this.schedule(u.host, () => this.rawFetchWithRetry(url, opts));
  }

  private async rawFetchWithRetry(url: string, opts: GetOptions, attempt = 0): Promise<FetchResult> {
    const r = await this.rawFetch(url, opts);
    const retryable = r.status === 0 || r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504;
    if (retryable && attempt < 2) {
      await sleep(r.status === 429 ? 20_000 : 2000 * (attempt + 1));
      return this.rawFetchWithRetry(url, opts, attempt + 1);
    }
    return r;
  }

  private async rawFetch(url: string, opts: GetOptions): Promise<FetchResult> {
    this.requests++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.requestTimeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method: opts.method ?? 'GET',
        body: opts.body,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'user-agent': this.cfg.userAgent,
          accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7',
          'accept-language': 'de-DE,de;q=0.9,en;q=0.7',
          ...(opts.headers ?? {}),
        },
      });
      const max = opts.maxBytes ?? 25 * 1024 * 1024;
      const buf = Buffer.from(await res.arrayBuffer());
      const body = buf.length > max ? buf.subarray(0, max) : buf;
      const contentType = res.headers.get('content-type') ?? '';
      const isPdf = /application\/pdf/i.test(contentType) || body.subarray(0, 5).toString('latin1') === '%PDF-';
      return {
        ok: res.ok,
        status: res.status,
        url: res.url || url,
        contentType,
        body,
        text: isPdf ? '' : decode(body, contentType),
        isPdf,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? (e.name === 'AbortError' ? 'Zeitüberschreitung' : e.message) : String(e);
      return this.fail(url, 0, msg);
    } finally {
      clearTimeout(timer);
    }
  }

  private fail(url: string, status: number, error: string): FetchResult {
    return { ok: false, status, url, contentType: '', body: Buffer.alloc(0), text: '', isPdf: false, error };
  }
}
