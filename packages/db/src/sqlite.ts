// Lokale SQLite-Datenbank über node:sqlite (ab Node 22.13 ohne Zusatzpaket).
// Für Entwicklung, Tests und Selbstbetrieb (Raspberry Pi, VPS).

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toParams, type Db, type Row, type Stmt } from './db';

export class SqliteDb implements Db {
  readonly raw: DatabaseSync;

  constructor(path = ':memory:') {
    this.raw = new DatabaseSync(path);
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  }

  async all<T = Row>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.raw.prepare(sql).all(...toParams(params)) as T[];
  }

  async first<T = Row>(sql: string, params?: unknown[]): Promise<T | null> {
    return (this.raw.prepare(sql).get(...toParams(params)) as T | undefined) ?? null;
  }

  async run(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    const r = this.raw.prepare(sql).run(...toParams(params));
    return { changes: Number(r.changes) };
  }

  async batch(stmts: Stmt[]): Promise<void> {
    if (stmts.length === 0) return;
    this.raw.exec('BEGIN');
    try {
      for (const s of stmts) this.raw.prepare(s.sql).run(...toParams(s.params));
      this.raw.exec('COMMIT');
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }

  close(): void {
    this.raw.close();
  }
}

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Wendet alle noch fehlenden Migrationen an (gleiche Dateien wie für D1/wrangler). */
export function migrateSqlite(db: SqliteDb, dir = MIGRATIONS_DIR): string[] {
  db.raw.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set((db.raw.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    db.raw.exec(readFileSync(join(dir, f), 'utf8'));
    db.raw.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(f, new Date().toISOString());
    applied.push(f);
  }
  return applied;
}

export function openSqlite(path: string): SqliteDb {
  const db = new SqliteDb(path);
  migrateSqlite(db);
  return db;
}
