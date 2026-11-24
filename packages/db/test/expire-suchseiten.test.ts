import { describe, expect, it } from 'vitest';
import { SqliteDb, migrateSqlite } from '../src/sqlite';
import { expireJobs } from '../src/repo';

const NOW = '2026-11-24T12:00:00.000Z';
const iso = (daysAgo: number) => new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();

async function source(db: SqliteDb, id: string, config: object) {
  await db.run(`INSERT INTO sources (id, kind, url, config, last_ok_at, updated_at) VALUES (?, 'portal', ?, ?, ?, ?)`, [id, `https://example.org/${id}`, JSON.stringify(config), NOW, NOW]);
}

async function job(db: SqliteDb, id: string, seenDaysAgo: number, sources: string[]) {
  const seen = iso(seenDaysAgo);
  await db.run(
    `INSERT INTO jobs (id, url, canonical_url, title, description_md, status, first_seen_at, last_seen_at, updated_at, content_hash)
     VALUES (?, ?, ?, ?, '', 'aktiv', ?, ?, ?, ?)`,
    [id, `https://example.org/job/${id}`, `https://example.org/job/${id}`, id, seen, seen, seen, id],
  );
  for (const s of sources) await db.run('INSERT INTO job_sources (job_id, source_id, url, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)', [id, s, `https://example.org/job/${id}`, seen, seen]);
}

async function status(db: SqliteDb, id: string) {
  return (await db.first<{ status: string }>('SELECT status FROM jobs WHERE id = ?', [id]))!.status;
}

describe('expireJobs mit Suchseiten (Wochenplan)', () => {
  it('lässt Anzeigen nur von Suchseiten nicht nach drei Tagen ablaufen, sondern erst nach drei Wochen', async () => {
    const db = new SqliteDb(':memory:');
    migrateSqlite(db);
    await source(db, 'liste', {});
    await source(db, 'linkedin', { suche: { adresse: 'https://example.org/suche?q={q}' } });
    await job(db, 'nur-liste', 5, ['liste']);
    await job(db, 'nur-suche-5', 5, ['linkedin']);
    await job(db, 'nur-suche-25', 25, ['linkedin']);
    await job(db, 'beides', 5, ['liste', 'linkedin']);

    await expireJobs(db, '2026-11-24', iso(3), NOW, iso(45), iso(21));

    expect(await status(db, 'nur-liste')).toBe('abgelaufen');
    expect(await status(db, 'nur-suche-5')).toBe('aktiv');
    expect(await status(db, 'nur-suche-25')).toBe('abgelaufen');
    // Die feste Liste entscheidet, sobald es sie gibt
    expect(await status(db, 'beides')).toBe('abgelaufen');
  });
});
