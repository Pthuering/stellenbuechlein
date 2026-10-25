// Fernzugriff auf die D1-Datenbank über den eigenen Worker (POST /api/ingest/sql).
// So braucht die Einsammel-Pipeline (z. B. in GitHub Actions) nur API-Adresse und INGEST_KEY,
// keinen Cloudflare-API-Token. Leerer Schlüssel: ohne Kopfzeile, weil ein Proxy sie anhängt
// (Netzwerk-Secret einer Claude-Cloud-Umgebung; die Sitzung sieht den Schlüssel dann nie).

import type { Db, Row, Stmt } from './db';

export class RemoteDb implements Db {
  constructor(
    private readonly baseUrl: string,
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(body: unknown, attempt = 0): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/api/ingest/sql`, {
      method: 'POST',
      headers: { ...(this.key ? { authorization: `Bearer ${this.key}` } : {}), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status >= 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      return this.call<T>(body, attempt + 1);
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
