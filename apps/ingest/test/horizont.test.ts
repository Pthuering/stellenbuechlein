// Horizont, Fristen-Prüfung und Erkundung ohne KI (nur Regeln) gegen den nachgebauten Testserver.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { listDiscoveries, listGateSkips, syncJobs, upsertCityStmt, upsertInstitutionStmt, upsertSourceStmt, countOpenAiTasks, listOpenAiTasks } from '@stellen/db';
import type { Source } from '@stellen/core';
import { configFromEnv, type IngestConfig } from '../src/config';
import { RunLog } from '../src/log';
import { Pipeline } from '../src/pipeline';
import { exploreQueries } from '../src/explore';
import { startFixtureServer, type FixtureServer } from './fixtures/server';
import { starterHorizont } from '@stellen/core';

let srv: FixtureServer;
let cfg: IngestConfig;
const NOW = new Date('2026-10-12T10:00:00Z');

function source(over: Partial<Source> = {}): Source {
  return {
    id: 'test-zentral',
    institutionId: 'test-uni',
    kind: 'zentral',
    label: null,
    url: `${srv.url}/zentral/`,
    adapter: 'auto',
    config: {},
    gate: 'psych',
    enabled: true,
    verified: true,
    status: 'neu',
    consecutiveFailures: 0,
    ...over,
  };
}

async function freshDb(sources: Source[]): Promise<SqliteDb> {
  const db = new SqliteDb(':memory:');
  migrateSqlite(db);
  await db.batch([
    upsertCityStmt({ id: 'halle-saale', name: 'Halle (Saale)', state: 'ST', lat: 51.48, lon: 11.97 }),
    upsertInstitutionStmt({ id: 'test-uni', name: 'Testuniversität', shortName: 'Test-Uni', kind: 'universitaet', cityId: 'halle-saale', website: srv.url, active: true, origin: 'seed' }),
    ...sources.map((s) => upsertSourceStmt(s)),
  ]);
  return db;
}

beforeAll(async () => {
  srv = await startFixtureServer();
  cfg = configFromEnv({ ...process.env, LLM_API_KEY: '', DEEPSEEK_API_KEY: '', BRAVE_API_KEY: '' });
  cfg.minHostIntervalMs = 5;
  cfg.llm.apiKey = null;
  cfg.browser.enabled = false;
  cfg.baApiBase = `${srv.url}/ba`;
});

afterAll(async () => {
  await srv.close();
});

// Weite-Kandidaten (Fähigkeit und Bezug zu Menschen im Text), über die ohne KI im Lauf Claude urteilt
const KI_WEITE_TITEL = ['Koordinator:in (m/w/d) Studienberatung', 'Sachbearbeitung (m/w/d) Steuern und Abgaben'];

describe('Horizont und Fristen (ohne KI)', () => {
  it('nimmt Brücken-Anzeigen auf, sortiert Fremdes aus und sichert Fristen ab', async () => {
    const db = await freshDb([source()]);
    const stats = await new Pipeline(db, cfg, { browser: false, images: false, discovery: false, reminders: false, explore: false, now: NOW }, new RunLog(false)).run();
    const { jobs } = await syncJobs(db, '', 100);
    const byTitle = (re: RegExp) => jobs.find((j) => re.test(j.title));

    const usable = byTitle(/Usable Security/);
    expect(usable?.lane).toBe('horizont');
    expect(usable?.horizon?.bridges).toContain('h-sec');
    expect(usable?.deadline).toBe('2026-11-20');
    // Sozialwissenschaftlicher Abschluss + Befragung: Brücke „Gesellschaft & Politik“
    expect(byTitle(/Mobilität/)?.horizon?.bridges).toContain('h-gesell');
    expect(stats.neuHorizont).toBe(2);

    // Ohne KI im Lauf: Weite-Kandidaten warten auf Claudes Urteil und sind noch nicht gespeichert,
    // was nicht einmal Weite-Kandidat ist, bleibt draußen (steht unter „Aussortiert“)
    expect(byTitle(/Steuern|Hausmeister|Studienberatung/)).toBeUndefined();
    const skips = await listGateSkips(db);
    expect(skips.map((s) => s.reason)).toEqual(['grobfilter']);
    const weite = await listOpenAiTasks(db, 10, ['weite']);
    expect(weite.map((t) => (t.payload as { job: { title: string } }).job.title).sort()).toEqual(KI_WEITE_TITEL);
    const offen = await countOpenAiTasks(db);
    expect(offen.auswerten).toBe(jobs.length);
    expect(offen.horizont).toBe(2);
    expect(offen.frist).toBe(stats.fristUnsicher);

    const ohneJahr = byTitle(/Klinische Psychologie/);
    expect(ohneJahr?.lane).toBe('kern');
    expect(ohneJahr?.deadline).toBe('2026-11-30');
    expect(ohneJahr?.deadlineCheck).toBe('jahr');

    const weit = byTitle(/Kognitive Psychologie/);
    expect(weit?.deadline).toBe('2027-07-15');
    expect(weit?.deadlineCheck).toBe('unsicher');
    expect(weit?.deadlineNote).toMatch(/weit in der Zukunft/);
    expect(stats.fristUnsicher).toBe(1);

    // Quelle der eigenen Einrichtung: nichts davon ist „neue Website“
    expect(jobs.every((j) => !j.newSite && j.foundVia === 'quelle')).toBe(true);
  });

  it('pausierte Brücke: Anzeige wird nicht mehr aufgenommen', async () => {
    const db = await freshDb([source()]);
    const h = starterHorizont();
    const profile = { version: 1, name: 'x', origin: 'manuell', categories: [
      { id: 'thema', weight: 45, items: [] }, { id: 'stelle', weight: 30, items: [] }, { id: 'methoden', weight: 10, items: [] }, { id: 'rahmen', weight: 15, items: [] },
    ], avoid: [], horizont: { ...h, bruecken: h.bruecken.map((b) => ({ ...b, aktiv: false })) }, updatedAt: NOW.toISOString() };
    await db.run('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['profile', JSON.stringify(profile), NOW.toISOString()]);
    await new Pipeline(db, cfg, { browser: false, images: false, discovery: false, reminders: false, explore: false, now: NOW }, new RunLog(false)).run();
    const { jobs } = await syncJobs(db, '', 100);
    expect(jobs.some((j) => /Usable Security/.test(j.title))).toBe(false);
  });
});

describe('Erkundung (blinde Flecken)', () => {
  it('bringt mindestens drei Anzeigen von Websites außerhalb des Registers', async () => {
    const db = await freshDb([source({ id: 'test-z1', url: `${srv.url}/stellen/` })]);
    const run = () => new Pipeline(db, cfg, { browser: false, images: false, discovery: false, reminders: false, explore: true, only: ['keine-quelle'], now: NOW }, new RunLog(false)).run();
    const stats = await run();
    expect(stats.erkundet).toBe(3);
    expect(stats.erkundungFehlt).toBeUndefined();
    const { jobs } = await syncJobs(db, '', 100);
    const explored = jobs.filter((j) => j.foundVia === 'erkundung');
    expect(explored).toHaveLength(3);
    expect(explored.every((j) => j.newSite && j.institutionId === null)).toBe(true);
    // Die Anzeige der bekannten Testuniversität wurde gar nicht erst gelesen
    expect(srv.hits.get('/fremd/job-5.html') ?? 0).toBe(0);
    // Die neue Website steht als Vorschlag bereit
    const disc = await listDiscoveries(db);
    expect(disc).toHaveLength(1);
    expect(disc[0]).toMatchObject({ siteKey: 'localhost', jobs: 3 });

    // Zweiter Lauf: Nur noch eine unbekannte Anzeige übrig → Warnung statt stillem Unterschreiten
    const second = await run();
    expect(second.erkundet).toBe(1);
    expect(second.erkundungFehlt).toBe(2);
  });

  it('Suchwörter rotieren täglich zwischen Kern und Brücken', () => {
    const h = starterHorizont();
    const a = exploreQueries(h, '2026-10-12', 6);
    const b = exploreQueries(h, '2026-10-13', 6);
    expect(a).toHaveLength(6);
    expect(a).not.toEqual(b);
    expect(a.some((q) => h.bruecken.some((br) => br.suche?.includes(q)))).toBe(true);
  });
});
