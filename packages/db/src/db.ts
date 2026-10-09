// Gemeinsame Datenbank-Schnittstelle für Cloudflare D1 (Worker), node:sqlite (lokal) und
// den Fernzugriff der Einsammel-Pipeline über den Worker.

export type SqlParam = string | number | null;

export interface Stmt {
  sql: string;
  params?: unknown[];
}

export type Row = Record<string, unknown>;

export interface Db {
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T = Row>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  /** Mehrere Anweisungen in einem Rutsch (atomar, wo möglich). */
  batch(stmts: Stmt[]): Promise<void>;
}

export function toParam(v: unknown): SqlParam {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}

export function toParams(params: unknown[] | undefined): SqlParam[] {
  return (params ?? []).map(toParam);
}

/** Minimale Form der D1-Bindung, damit dieses Paket keine Worker-Typen braucht. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = unknown>(): Promise<{ results: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<{ meta?: { changes?: number } }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown[]>;
}

export class D1Db implements Db {
  constructor(private readonly d1: D1Like) {}

  async all<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
    const r = await this.d1.prepare(sql).bind(...toParams(params)).all<T>();
    return r.results ?? [];
  }

  async first<T = Row>(sql: string, params?: unknown[]): Promise<T | null> {
    return (await this.d1.prepare(sql).bind(...toParams(params)).first<T>()) ?? null;
  }

  async run(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    const r = await this.d1.prepare(sql).bind(...toParams(params)).run();
    return { changes: r.meta?.changes ?? 0 };
  }

  async batch(stmts: Stmt[]): Promise<void> {
    if (stmts.length === 0) return;
    for (let i = 0; i < stmts.length; i += 50) {
      const chunk = stmts.slice(i, i + 50).map((s) => this.d1.prepare(s.sql).bind(...toParams(s.params)));
      await this.d1.batch(chunk);
    }
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string' || v === '') return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
