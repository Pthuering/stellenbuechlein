import { describe, expect, it } from 'vitest';
import type { Source } from '@stellen/core';
import { SqliteDb, migrateSqlite } from '../src/sqlite';
import { patchSource, upsertSourceStmt } from '../src/repo';

const seed = (config: Source['config'], url = 'https://uni.example/stellen'): Source => ({
  id: 'uni-z1',
  institutionId: null,
  kind: 'zentral',
  label: null,
  url,
  adapter: 'auto',
  config,
  gate: 'psych',
  enabled: true,
  verified: false,
  status: 'neu',
  consecutiveFailures: 0,
});

async function row(db: SqliteDb) {
  const r = (await db.first<{ url: string; config: string }>('SELECT url, config FROM sources WHERE id = ?', ['uni-z1']))!;
  return { url: r.url, config: JSON.parse(r.config) as Record<string, unknown> };
}

describe('Startdaten erneut einspielen', () => {
  it('überschreibt Einstellungen unbestätigter Quellen, behält die bestätigter und ergänzt nur neue Felder', async () => {
    const db = new SqliteDb(':memory:');
    migrateSqlite(db);
    await db.batch([upsertSourceStmt(seed({ note: 'alt' }))]);
    await db.batch([upsertSourceStmt(seed({ note: 'neu' }))]);
    expect((await row(db)).config).toEqual({ note: 'neu' });

    // Reparatur (Probelauf übernommen): neue Adresse und Einstellungen, bestätigt
    await patchSource(db, 'uni-z1', { url: 'https://uni.example/api/stellen', config: { jsonListe: { api: 'x' }, note: 'repariert' }, verified: true });
    await db.batch([upsertSourceStmt(seed({ note: 'aus den Startdaten', render: true }))]);
    const r = await row(db);
    expect(r.url).toBe('https://uni.example/api/stellen');
    expect(r.config).toEqual({ jsonListe: { api: 'x' }, note: 'repariert', render: true });
  });
});
