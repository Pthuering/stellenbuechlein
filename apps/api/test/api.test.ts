import { beforeAll, describe, expect, it } from 'vitest';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { upsertJobStmt, type JobWrite } from '@stellen/db';
import { canonicalUrl, contentHash, jobIdForUrl } from '@stellen/core';
import { applySeed } from '../../ingest/src/seed';
import { createApp } from '../src/app';

const env = { APP_KEY: 'test-app-key', INGEST_KEY: 'test-ingest-key-123' };
let db: SqliteDb;
let app: ReturnType<typeof createApp>;

function job(i: number, updatedAt: string): JobWrite {
  const url = `https://uni.example/jobs/${i}`;
  return {
    id: jobIdForUrl(url),
    institutionId: 'uni-leipzig',
    url,
    canonicalUrl: canonicalUrl(url),
    title: `Wiss. Mitarbeiter*in Psychologie ${i}`,
    descriptionMd: 'Ihre Aufgaben: Forschung',
    kind: 'promotion',
    firstSeenAt: updatedAt,
    lastSeenAt: updatedAt,
    updatedAt,
    status: 'aktiv',
    completeness: 'ok',
    contentHash: contentHash('t', 'd'),
    fuzzyKey: null,
  };
}

const auth = { authorization: `Bearer ${env.APP_KEY}`, 'content-type': 'application/json' };

beforeAll(async () => {
  db = new SqliteDb(':memory:');
  migrateSqlite(db);
  await applySeed(db);
  const stmts = [];
  for (let i = 0; i < 25; i++) stmts.push(upsertJobStmt(job(i, i < 20 ? '2026-10-10T06:00:00.000Z' : '2026-10-10T07:00:00.000Z')));
  await db.batch(stmts);
  app = createApp({ db: () => db, env: () => env });
});

describe('API', () => {
  it('verlangt den App-Schlüssel', async () => {
    expect((await app.request('/api/bootstrap')).status).toBe(401);
    expect((await app.request('/api/bootstrap', { headers: { authorization: 'Bearer falsch' } })).status).toBe(401);
    expect((await app.request('/api/health')).status).toBe(200);
  });

  it('liefert Startdaten', async () => {
    const r = await app.request('/api/bootstrap', { headers: auth });
    expect(r.status).toBe(200);
    const b = (await r.json()) as { institutions: unknown[]; cities: unknown[]; sourceSummary: { total: number } };
    expect(b.institutions.length).toBeGreaterThan(100);
    expect(b.cities.length).toBeGreaterThan(50);
    expect(b.sourceSummary.total).toBeGreaterThan(100);
  });

  it('blättert beim Sync auch bei gleichen Zeitstempeln sauber', async () => {
    const seen = new Set<string>();
    let cursor = '';
    for (let n = 0; n < 10; n++) {
      const r = await app.request(`/api/sync?limit=10&cursor=${encodeURIComponent(cursor)}`, { headers: auth });
      const b = (await r.json()) as { jobs: { id: string }[]; next: string | null };
      b.jobs.forEach((j) => seen.add(j.id));
      if (!b.next) break;
      cursor = b.next;
    }
    expect(seen.size).toBe(25);
  });

  it('speichert Markierungen; ältere Stände überschreiben neuere nicht', async () => {
    const id = jobIdForUrl('https://uni.example/jobs/1');
    let r = await app.request(`/api/marks/${id}`, { method: 'PUT', headers: auth, body: JSON.stringify({ decision: 'gemerkt', star: true, updatedAt: '2026-10-10T10:00:00.000Z' }) });
    expect(r.status).toBe(200);
    r = await app.request(`/api/marks/${id}`, { method: 'PUT', headers: auth, body: JSON.stringify({ decision: 'abgelehnt', updatedAt: '2026-10-10T09:00:00.000Z' }) });
    const b = (await (await app.request('/api/bootstrap', { headers: auth })).json()) as { marks: { jobId: string; decision: string; star: boolean }[] };
    const m = b.marks.find((x) => x.jobId === id)!;
    expect(m.decision).toBe('gemerkt');
    expect(m.star).toBe(true);
  });

  it('Lieblingsorte und Einstellungen', async () => {
    await app.request('/api/favorites', { method: 'PUT', headers: auth, body: JSON.stringify({ kind: 'state', ref: 'SN', on: true }) });
    await app.request('/api/settings/home', { method: 'PUT', headers: auth, body: JSON.stringify({ value: { label: 'Test', lat: 1, lon: 2 } }) });
    const b = (await (await app.request('/api/bootstrap', { headers: auth })).json()) as { favorites: unknown[]; settings: Record<string, unknown> };
    expect(b.favorites).toEqual([{ kind: 'state', ref: 'SN' }]);
    expect(b.settings.home).toEqual({ label: 'Test', lat: 1, lon: 2 });
    expect((await app.request('/api/settings/unbekannt', { method: 'PUT', headers: auth, body: JSON.stringify({ value: 1 }) })).status).toBe(400);
  });

  it('Quelle bearbeiten', async () => {
    const r = await app.request('/api/sources/uni-potsdam-z1', { method: 'PATCH', headers: auth, body: JSON.stringify({ url: 'https://www.uni-potsdam.de/de/stellenausschreibungen', verified: true }) });
    expect(r.status).toBe(200);
    const s = (await (await app.request('/api/sources', { headers: auth })).json()) as { sources: { id: string; url: string; status: string }[] };
    const src = s.sources.find((x) => x.id === 'uni-potsdam-z1')!;
    expect(src.url).toBe('https://www.uni-potsdam.de/de/stellenausschreibungen');
    expect(src.status).toBe('neu');
  });

  it('SQL-Fernzugriff nur mit INGEST_KEY', async () => {
    const body = JSON.stringify({ op: 'first', sql: 'SELECT COUNT(*) AS n FROM jobs' });
    expect((await app.request('/api/ingest/sql', { method: 'POST', headers: auth, body })).status).toBe(401);
    const r = await app.request('/api/ingest/sql', { method: 'POST', headers: { authorization: `Bearer ${env.INGEST_KEY}`, 'content-type': 'application/json' }, body });
    expect(((await r.json()) as { row: { n: number } }).row.n).toBe(25);
  });
});
