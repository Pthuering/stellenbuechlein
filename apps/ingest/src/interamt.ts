// Interamt, die Stellenbörse des öffentlichen Dienstes. Die Suche geht nur über das Formular einer
// Wicket-Anwendung, und auch die Anzeigen antworten nur mit Sitzungs-Cookie. Deshalb hält dieser
// Adapter eine eigene kleine Sitzung (Cookies, Weiterleitungen, Abstand zwischen Anfragen) und liest
// die Anzeigen gleich mit. Zurück kommen nur vollständig gelesene Anzeigen: Ohne mitgelieferten Text
// würde die Pipeline sie mit dem normalen Client öffnen und ohne Cookie in einer Weiterleitungsschleife
// landen. Bei „Psycholog“ sind das rund 250 Abrufe am Tag, mit Abstand etwa sechs Minuten.

import type { IngestConfig } from './config';
import { fromHtml, type Candidate } from './extract';
import { load } from './html';
import type { RunLog } from './log';

export const INTERAMT_BASE = 'https://interamt.de/koop/app/';
export const interamtUrl = (id: string) => `${INTERAMT_BASE}stelle?id=${id}`;

export interface InteramtRow {
  id: string;
  title: string;
  org: string | null;
  place: string | null;
  /** Eingestellt am (JJJJ-MM-TT) */
  posted: string | null;
}

const isoDate = (de: string): string | null => {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(de);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** Zeilen der Trefferliste, auch aus der Ajax-Antwort beim Nachladen (Tabelle in CDATA-Blöcken). */
export function interamtRows(html: string): InteramtRow[] {
  const body = html.includes('<ajax-response') ? [...html.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1]).join('\n') : html;
  const $ = load(`<table>${body}</table>`);
  const rows: InteramtRow[] = [];
  $('tr').each((_, tr) => {
    const cell = (field: string) => $(tr).find(`td[data-field="${field}"]`).first().text().replace(/\s+/g, ' ').trim();
    const id = /\d{5,}/.exec(cell('StellenangebotId'))?.[0];
    const title = cell('Stellenbezeichnung');
    if (!id || !title) return;
    rows.push({ id, title, org: cell('Behoerde') || null, place: cell('PLZOrte').replace(/^\d{5}\s*/, '') || null, posted: isoDate(cell('Von')) });
  });
  return rows;
}

export function interamtTotal(html: string): number | null {
  const m = /([\d.]+)\s*Angebote gefunden/.exec(html);
  return m ? Number(m[1].replace(/\./g, '')) : null;
}

/** Adresse des Suchformulars und Name des Absende-Knopfs auf der Seite „Stellensuche“. */
export function interamtSearchForm(html: string): { action: string; button: string } | null {
  const $ = load(html);
  const form = $('form[aria-label="Stellendetailsuche"]').first();
  const action = form.attr('action');
  const button = form.find('button[name*="submitRow"], input[type="submit"][name*="submitRow"]').first().attr('name');
  return action && button ? { action: new URL(action, INTERAMT_BASE).toString(), button } : null;
}

/** Ajax-Adresse von „mehr laden“ und Basisadresse der Seite (Wicket braucht beide). */
export function interamtLoadMore(html: string): { url: string; base: string } | null {
  const u = /"u":"(\.\/trefferliste\?[^"]*loadMoreLink)"/.exec(html)?.[1];
  const base = /baseUrl="([^"]+)"/.exec(html)?.[1];
  return u && base ? { url: new URL(u, INTERAMT_BASE).toString(), base } : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kleine Sitzung: Cookies merken, Weiterleitungen selbst folgen, Abstand zwischen Anfragen. */
export class InteramtSession {
  private cookies = new Map<string, string>();
  private last = 0;
  requests = 0;

  constructor(
    private readonly cfg: Pick<IngestConfig, 'userAgent' | 'minHostIntervalMs' | 'requestTimeoutMs'>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async request(url: string, init: { method?: 'GET' | 'POST'; body?: string; headers?: Record<string, string> } = {}): Promise<{ status: number; url: string; text: string }> {
    let current = url;
    let method = init.method ?? 'GET';
    let body = init.body;
    for (let hop = 0; hop < 6; hop++) {
      const wait = this.last + this.cfg.minHostIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.cfg.requestTimeoutMs);
      try {
        this.requests++;
        const res = await this.fetchImpl(current, {
          method,
          body,
          redirect: 'manual',
          signal: ctrl.signal,
          headers: {
            'user-agent': this.cfg.userAgent,
            accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
            'accept-language': 'de-DE,de;q=0.9',
            ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
            ...(this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
            ...(init.headers ?? {}),
          },
        });
        for (const c of res.headers.getSetCookie?.() ?? []) {
          const pair = c.split(';')[0];
          const i = pair.indexOf('=');
          if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
        }
        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
          await res.arrayBuffer().catch(() => null);
          current = new URL(location, current).toString();
          method = 'GET';
          body = undefined;
          continue;
        }
        return { status: res.status, url: current, text: await res.text() };
      } finally {
        clearTimeout(timer);
        this.last = Date.now();
      }
    }
    throw new Error('Interamt: zu viele Weiterleitungen');
  }
}

export interface InteramtOptions {
  queries: string[];
  /** Höchstens so oft „mehr laden“ (je 10 Treffer) */
  maxPages: number;
  /** Höchstens so viele Anzeigen lesen (die neuesten zuerst) */
  maxDetails: number;
}

export async function viaInteramt(session: InteramtSession, opts: InteramtOptions, log: RunLog): Promise<Candidate[]> {
  const rows = new Map<string, InteramtRow>();
  for (const q of opts.queries) {
    const page = await session.request(`${INTERAMT_BASE}stellensuche`);
    const form = interamtSearchForm(page.text);
    if (!form) throw new Error('Suchformular nicht gefunden');
    const body = new URLSearchParams({ 'stellensucheFilterAttributes.suchtextContainer:stellensucheFilterAttributes.suchText': q, [form.button]: '1' }).toString();
    const result = await session.request(form.action, { method: 'POST', body });
    const total = interamtTotal(result.text);
    let found = interamtRows(result.text);
    const more = interamtLoadMore(result.text);
    for (let i = 1; more && i < opts.maxPages && total != null && found.length < total; i++) {
      const r = await session.request(more.url, { method: 'POST', headers: { 'Wicket-Ajax': 'true', 'Wicket-Ajax-BaseURL': more.base, 'X-Requested-With': 'XMLHttpRequest', accept: 'text/xml' } });
      const next = interamtRows(r.text);
      if (next.length <= found.length) break;
      found = next;
    }
    for (const row of found) rows.set(row.id, row);
    log.info(`Interamt „${q}“: ${found.length} von ${total ?? '?'} Treffern`);
  }

  const newest = [...rows.values()].sort((a, b) => (b.posted ?? '').localeCompare(a.posted ?? ''));
  if (newest.length > opts.maxDetails) log.warn(`Interamt: ${newest.length} Treffer, gelesen werden die neuesten ${opts.maxDetails}`);
  const out: Candidate[] = [];
  for (const row of newest.slice(0, opts.maxDetails)) {
    const url = interamtUrl(row.id);
    try {
      const r = await session.request(url);
      if (r.status !== 200) continue;
      const { data } = fromHtml(r.text, url);
      out.push({
        url,
        title: row.title,
        via: 'portal:interamt',
        hints: { org: row.org, locality: row.place, postedAt: row.posted },
        // Immer „vollständig“, damit die Pipeline die Seite nicht selbst (ohne Cookie) öffnet
        prefilled: { ...data, url, title: row.title, hiringOrg: data.hiringOrg ?? row.org, locationText: data.locationText ?? row.place, postedAt: data.postedAt ?? row.posted, method: 'portal:interamt', complete: true },
      });
    } catch (e) {
      log.warn(`Interamt ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}
