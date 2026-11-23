// Fernzugriff auf die D1-Datenbank über den eigenen Worker (POST /api/ingest/sql).
// So braucht die Einsammel-Pipeline (z. B. in GitHub Actions) nur API-Adresse und INGEST_KEY,
// keinen Cloudflare-API-Token. Leerer Schlüssel: ohne Kopfzeile, weil ein Proxy sie anhängt
// (Netzwerk-Secret einer Claude-Cloud-Umgebung; die Sitzung sieht den Schlüssel dann nie).

import type { Db, Row, Stmt } from './db';

export interface RemoteDbOptions {
  /** Zeitgrenze je Anfrage; danach gilt sie als Netzwerkfehler und wird wiederholt */
  timeoutMs?: number;
  /** Wartezeiten vor den Wiederholungen nach einem Netzwerkfehler */
  netRetryDelaysMs?: number[];
}

// Ein kurzer Aussetzer („fetch failed“) hat früher den ganzen Einsammel-Lauf abgebrochen.
// Darum nach Netzwerkfehlern geduldig wiederholen (zusammen gut eine Minute).
const NET_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000];

export class RemoteDb implements Db {
  private readonly timeoutMs: number;
  private readonly netRetryDelaysMs: number[];

  constructor(
    private readonly baseUrl: string,
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = fetch,
    opts: RemoteDbOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.netRetryDelaysMs = opts.netRetryDelaysMs ?? NET_RETRY_DELAYS_MS;
  }

  private async call<T>(body: unknown, attempt = 0, netAttempt = 0): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/api/ingest/sql`, {
        method: 'POST',
        headers: { ...(this.key ? { authorization: `Bearer ${this.key}` } : {}), 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      // Netzwerkfehler oder Zeitüberschreitung: Der Worker hat (wahrscheinlich) nichts geantwortet
      const delay = this.netRetryDelaysMs[netAttempt];
      if (delay === undefined) {
        const why = e instanceof Error ? e.message : String(e);
        throw new Error(`Datenbank-Zugriff über den Worker nicht erreichbar (${netAttempt + 1} Versuche): ${why}`);
      }
      await new Promise((r) => setTimeout(r, delay));
      return this.call<T>(body, attempt, netAttempt + 1);
    }
    // 500 kommt auch bei SQL-Fehlern; darum hier nur wenige, kurze Wiederholungen
    if (res.status >= 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      return this.call<T>(body, attempt + 1, netAttempt);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Datenbank-Zugriff über den Worker fehlgeschlagen (${res.status}): ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async all<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
    const r = await this.call<{ rows: T[] }>({ op: 'all', sql, params: params ?? [] });
    return r.rows;
  }

  async first<T = Row>(sql: string, params?: unknown[]): Promise<T | null> {
    const r = await this.call<{ row: T | null }>({ op: 'first', sql, params: params ?? [] });
    return r.row;
  }

  async run(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    return this.call<{ changes: number }>({ op: 'run', sql, params: params ?? [] });
  }

  async batch(stmts: Stmt[]): Promise<void> {
    for (let i = 0; i < stmts.length; i += 40) {
      await this.call({ op: 'batch', stmts: stmts.slice(i, i + 40) });
    }
  }
}
