import { describe, expect, it } from 'vitest';
import { SqliteDb, migrateSqlite } from '../src/sqlite';
import { listRecentOpenJobs } from '../src/repo';

function insert(db: SqliteDb, id: string, seen: string, over: { status?: string; deadline?: string | null } = {}) {
  return db.run(
    `INSERT INTO jobs (id, url, canonical_url, title, description_md, deadline, status, first_seen_at, last_seen_at, updated_at, content_hash)
     VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?)`,
    [id, `https://example.org/${id}`, `https://example.org/${id}`, id, over.deadline ?? null, over.status ?? 'aktiv', seen, seen, seen, id],
  );
}

describe('listRecentOpenJobs', () => {
  it('lädt seitenweise vollständig, ohne Doppelte, auch bei gleichem Fundzeitpunkt', async () => {
    const db = new SqliteDb(':memory:');
    migrateSqlite(db);
    // Fünf Anzeigen aus demselben Lauf (gleicher Zeitpunkt), zwei spätere, eine zu alte, eine abgelaufene, eine mit vorbeier Frist
    for (const id of ['a', 'b', 'c', 'd', 'e']) await insert(db, id, '2026-11-20T10:00:00.000Z');
    await insert(db, 'f', '2026-11-21T10:00:00.000Z');
    await insert(db, 'g', '2026-11-22T10:00:00.000Z', { deadline: '2026-11-23' });
    await insert(db, 'alt', '2026-11-01T10:00:00.000Z');
    await insert(db, 'weg', '2026-11-21T10:00:00.000Z', { status: 'abgelaufen' });
    await insert(db, 'frist', '2026-11-21T10:00:00.000Z', { deadline: '2026-11-22' });

    const jobs = await listRecentOpenJobs(db, '2026-11-10T00:00:00.000Z', '2026-11-23', 2);
    expect(jobs.map((j) => j.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect((await listRecentOpenJobs(db, '2026-11-10T00:00:00.000Z', '2026-11-23')).map((j) => j.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});
