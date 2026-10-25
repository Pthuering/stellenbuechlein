import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { discoveryStmt, finishSourceCheck, upsertJobStmt, type JobWrite } from '@stellen/db';
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

describe('Probelauf, Funde und Horizont', () => {
  let llm: Server;
  let llmUrl = '';
  beforeAll(async () => {
    // Nachgebaute KI (OpenAI-kompatibel) für die Brücken-Vorschläge im Worker
    llm = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const answer = {
          bruecken: [
            { name: 'Mensch & KI', feld: ['ki', 'machine learning'], anker: [], suche: ['KI Akzeptanz'], warum: 'gibt es schon' },
            { name: 'Kinder & Medien', feld: ['medienkompetenz', 'kinderfernsehen', 'jugendmedienschutz'], anker: [], suche: ['Medienpädagogik'], warum: 'Entwicklungspsychologie trifft Medien.' },
          ],
        };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
      });
    });
    await new Promise<void>((r) => llm.listen(0, '127.0.0.1', r));
    llmUrl = `http://127.0.0.1:${(llm.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => llm.close(() => r()));
  });

  it('legt einen Probelauf an und übernimmt das Ergebnis als Quelle', async () => {
    const r = await app.request('/api/sources/checks', { method: 'POST', headers: auth, body: JSON.stringify({ url: 'https://www.beispiel-institut.de/karriere' }) });
    const { check, started } = (await r.json()) as { check: { id: number; status: string }; started: boolean };
    expect(check.status).toBe('wartet');
    expect(started).toBe(false); // ohne GitHub-Token: der nächste Lauf arbeitet ihn ab
    // gleiche Adresse nochmal: kein zweiter Probelauf
    const again = (await (await app.request('/api/sources/checks', { method: 'POST', headers: auth, body: JSON.stringify({ url: 'https://www.beispiel-institut.de/karriere' }) })).json()) as { check: { id: number } };
    expect(again.check.id).toBe(check.id);

    // Übernehmen erst, wenn fertig
    const early = await app.request(`/api/sources/checks/${check.id}/accept`, { method: 'POST', headers: auth, body: JSON.stringify({ kind: 'zentral', gate: 'psych', institution: { name: 'Beispiel-Institut', cityId: 'leipzig', kind: 'sonstige' } }) });
    expect(early.status).toBe(409);

    await finishSourceCheck(db, check.id, { listUrl: 'https://www.beispiel-institut.de/karriere/stellen', config: { render: true }, verdict: 'gut', ai: { verdict: 'gut' } }, null);
    await db.batch([discoveryStmt('beispiel-institut.de', 'Beispiel-Institut', 'https://www.beispiel-institut.de/karriere/stellen/1')]);
    const ok = await app.request(`/api/sources/checks/${check.id}/accept`, { method: 'POST', headers: auth, body: JSON.stringify({ kind: 'zentral', gate: 'psych', institution: { name: 'Beispiel-Institut', cityId: 'leipzig', kind: 'sonstige' } }) });
    expect(ok.status).toBe(200);
    const data = (await (await app.request('/api/sources', { headers: auth })).json()) as {
      sources: { url: string; config: { render?: boolean; note?: string }; verified: boolean; institutionId: string }[];
      checks: { id: number; status: string }[];
      discoveries: unknown[];
    };
    const src = data.sources.find((x) => x.url === 'https://www.beispiel-institut.de/karriere/stellen')!;
    expect(src.config.render).toBe(true);
    expect(src.config.note).toMatch(/Per Probelauf geprüft/);
    expect(src.verified).toBe(true);
    expect(data.checks.find((c) => c.id === check.id)?.status).toBe('uebernommen');
    // Der passende Fund der Erkundung ist damit erledigt
    expect(data.discoveries).toHaveLength(0);
  });

  it('Funde ignorieren', async () => {
    await db.batch([discoveryStmt('arbeitgeber:stiftung x', 'Stiftung X', null)]);
    let d = (await (await app.request('/api/discoveries', { headers: auth })).json()) as { discoveries: { siteKey: string }[] };
    expect(d.discoveries.map((x) => x.siteKey)).toContain('arbeitgeber:stiftung x');
    const r = await app.request('/api/discoveries/status', { method: 'POST', headers: auth, body: JSON.stringify({ siteKey: 'arbeitgeber:stiftung x', status: 'ignoriert' }) });
    expect(r.status).toBe(200);
    d = (await (await app.request('/api/discoveries', { headers: auth })).json()) as { discoveries: { siteKey: string }[] };
    expect(d.discoveries.map((x) => x.siteKey)).not.toContain('arbeitgeber:stiftung x');
  });

  it('erlaubt Anfragen von der eigenen Website (ALLOWED_ORIGIN), andere nicht', async () => {
    const site = createApp({ db: () => db, env: () => ({ ...env, ALLOWED_ORIGIN: 'https://meine-seite.de, https://www.meine-seite.de/' }) });
    const pre = await site.request('/api/bootstrap', { method: 'OPTIONS', headers: { origin: 'https://www.meine-seite.de' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://www.meine-seite.de');
    const r = await site.request('/api/bootstrap', { headers: { ...auth, origin: 'https://meine-seite.de' } });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe('https://meine-seite.de');
    const fremd = await site.request('/api/bootstrap', { method: 'OPTIONS', headers: { origin: 'https://fremd.example' } });
    expect(fremd.status).toBe(403);
    expect(fremd.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('speichert die Haken der Platzhalter-Checkliste', async () => {
    const value = { done: ['zuhause', 'name'], hideBanner: true };
    const r = await app.request('/api/settings/checklist', { method: 'PUT', headers: auth, body: JSON.stringify({ value }) });
    expect(r.status).toBe(200);
    const b = (await (await app.request('/api/bootstrap', { headers: auth })).json()) as { settings: Record<string, unknown> };
    expect(b.settings.checklist).toEqual(value);
  });

  it('Brücken-Vorschläge der KI (ohne schon vorhandene)', async () => {
    const off = await app.request('/api/horizont/vorschlaege', { method: 'POST', headers: auth, body: '{}' });
    expect(off.status).toBe(501);
    const withAi = createApp({ db: () => db, env: () => ({ ...env, LLM_API_KEY: 'test', LLM_BASE_URL: llmUrl }) });
    const r = await withAi.request('/api/horizont/vorschlaege', { method: 'POST', headers: auth, body: '{}' });
    expect(r.status).toBe(200);
    const { bruecken } = (await r.json()) as { bruecken: { name: string; herkunft: string; aktiv: boolean }[] };
    expect(bruecken.map((b) => b.name)).toEqual(['Kinder & Medien']);
    expect(bruecken[0].herkunft).toBe('ki');
  });
});
