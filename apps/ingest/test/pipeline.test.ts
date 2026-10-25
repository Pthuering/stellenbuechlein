import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { listSources, syncJobs, upsertCityStmt, upsertInstitutionStmt, upsertSourceStmt, listGateSkips } from '@stellen/db';
import type { Source } from '@stellen/core';
import { configFromEnv, type IngestConfig } from '../src/config';
import { RunLog } from '../src/log';
import { Http } from '../src/http';
import { Llm } from '../src/llm';
import { discover } from '../src/discover';
import { extractPosting } from '../src/extract';
import { Pipeline } from '../src/pipeline';
import { BrowserPool } from '../src/browser';
import { agentReadPosting } from '../src/agent';
import { parseRobots, isAllowed } from '../src/robots';
import { startFixtureServer, type FixtureServer } from './fixtures/server';

let srv: FixtureServer;
let cfg: IngestConfig;

function testConfig(): IngestConfig {
  const c = configFromEnv({ ...process.env, LLM_API_KEY: '', DEEPSEEK_API_KEY: '' });
  c.minHostIntervalMs = 5;
  c.requestTimeoutMs = 10_000;
  c.llm.apiKey = null;
  c.browser.enabled = false;
  // Erkundung hat eigene Tests (horizont.test.ts); hier würde sie die echte Arbeitsagentur fragen
  c.explore.enabled = false;
  c.browser.executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  return c;
}

function source(over: Partial<Source> = {}): Source {
  return {
    id: 'test-z1',
    institutionId: 'test-uni',
    kind: 'zentral',
    label: null,
    url: `${srv.url}/stellen/`,
    adapter: 'auto',
    config: {},
    gate: 'psych',
    enabled: true,
    verified: false,
    status: 'neu',
    consecutiveFailures: 0,
    ...over,
  };
}

beforeAll(async () => {
  srv = await startFixtureServer();
  cfg = testConfig();
});

afterAll(async () => {
  await srv.close();
});

describe('robots.txt', () => {
  it('wertet Disallow, Allow und Platzhalter aus', () => {
    const r = parseRobots('User-agent: *\nDisallow: /privat/\nAllow: /privat/oeffentlich\nDisallow: /*.pdf$\n\nUser-agent: BoeserBot\nDisallow: /');
    expect(isAllowed(r, 'Stellenbuechlein', '/stellen/')).toBe(true);
    expect(isAllowed(r, 'Stellenbuechlein', '/privat/x')).toBe(false);
    expect(isAllowed(r, 'Stellenbuechlein', '/privat/oeffentlich/1')).toBe(true);
    expect(isAllowed(r, 'Stellenbuechlein', '/a/b.pdf')).toBe(false);
    expect(isAllowed(r, 'BoeserBot', '/stellen/')).toBe(false);
  });
});

describe('Anzeigen finden', () => {
  it('liest Liste, Folgeseite und Feed; ignoriert Navigation', async () => {
    const log = new RunLog(false);
    const http = new Http(cfg, log);
    const res = await discover(source(), { http, llm: new Llm(cfg.llm, log), browser: null, cfg, log });
    const paths = res.candidates.map((c) => new URL(c.url).pathname).sort();
    expect(res.status).toBe('ok');
    expect(paths).toEqual([
      '/privat/geheim.html',
      '/stellen/ausschreibung-3.pdf',
      '/stellen/chemie.html',
      '/stellen/job-1.html',
      '/stellen/job-2.html',
      '/stellen/job-5.html',
      '/stellen/js-job.html',
    ]);
    expect(res.methods.join(',')).toMatch(/liste/);
    expect(res.methods.join(',')).toMatch(/feed/);
  });
});

describe('Anzeige einlesen', () => {
  it('JSON-LD mit vollständigem Text', async () => {
    const http = new Http(cfg, new RunLog(false));
    const r = await extractPosting(http, `${srv.url}/stellen/job-1.html`);
    expect(r.data?.method).toBe('jsonld');
    expect(r.data?.complete).toBe(true);
    expect(r.data?.descriptionMd).toContain('EEG-Studien');
    expect(r.data?.imageUrl).toBe(`${srv.url}/bilder/labor.jpg`);
    expect(r.data?.validThrough).toBe('2026-11-15T23:59:00+01:00');
  });
  it('PDF direkt', async () => {
    const http = new Http(cfg, new RunLog(false));
    const r = await extractPosting(http, `${srv.url}/stellen/ausschreibung-3.pdf`);
    expect(r.data?.method).toBe('pdf');
    expect(r.data?.title).toMatch(/Wissenschaftliche Mitarbeiterin/);
    expect(r.data?.descriptionMd).toMatch(/Bewerbungsfrist: 10\.12\.2026/);
  });
  it('kurze Seite mit verlinktem PDF → PDF-Text wird angehängt', async () => {
    const http = new Http(cfg, new RunLog(false));
    const r = await extractPosting(http, `${srv.url}/stellen/job-5.html`);
    expect(r.data?.method).toBe('html+pdf');
    expect(r.data?.descriptionMd).toMatch(/Lernmotivation/);
    expect(r.data?.complete).toBe(true);
  });
  it('robots.txt: Sperren gelten nur mit ROBOTS=1', async () => {
    const strict = new Http({ ...cfg, respectRobots: true }, new RunLog(false));
    const r = await extractPosting(strict, `${srv.url}/privat/geheim.html`);
    expect(r.blockedByRobots).toBe(true);
    expect(srv.hits.get('/privat/geheim.html')).toBeUndefined();
    expect(cfg.respectRobots).toBe(false);
    const open = new Http(cfg, new RunLog(false));
    const r2 = await extractPosting(open, `${srv.url}/privat/geheim.html`);
    expect(r2.blockedByRobots).toBeFalsy();
    expect(srv.hits.get('/privat/geheim.html')).toBe(1);
  });
});

describe('Kompletter Lauf', () => {
  let db: SqliteDb;

  beforeAll(async () => {
    db = new SqliteDb(':memory:');
    migrateSqlite(db);
    await db.batch([
      upsertCityStmt({ id: 'halle-saale', name: 'Halle (Saale)', state: 'ST', lat: 51.48, lon: 11.97 }),
      upsertInstitutionStmt({ id: 'test-uni', name: 'Testuniversität', shortName: 'Test-Uni', kind: 'universitaet', cityId: 'halle-saale', website: srv.url, active: true, origin: 'seed' }),
      upsertSourceStmt(source()),
      upsertSourceStmt(source({ id: 'portal-feed', institutionId: null, kind: 'portal', label: 'Testportal', url: `${srv.url}/feed.xml`, adapter: 'feed', config: { feedUrl: `${srv.url}/feed.xml` }, gate: 'none' })),
    ]);
  });

  it('legt Anzeigen an, filtert grob, liest auch per robots.txt gesperrte Seiten', async () => {
    const p = new Pipeline(db, cfg, { browser: false, images: false, discovery: false, reminders: false }, new RunLog(false));
    const stats = await p.run();
    const { jobs } = await syncJobs(db, '', 100);
    const titles = jobs.map((j) => j.title).sort();
    expect(titles).toContain('Wissenschaftliche Mitarbeiterin / Doktorand*in (m/w/d) Emotionsregulation');
    expect(titles).toContain('Postdoc (m/w/d) in Kognitiver Neurowissenschaft');
    expect(titles.some((t) => /Sozialpsychologie|Wissenschaftliche Mitarbeiterin \/ Wissenschaftlicher/.test(t))).toBe(true);
    expect(titles.some((t) => /Chemielabor/.test(t))).toBe(false);
    // ohne Browser: Chemie-Stelle, die (statisch leere) JavaScript-Seite und die interne Stelle der
    // Personalabteilung (per robots.txt gesperrt, wird aber gelesen) fallen durch den Grobfilter
    expect(stats.grobfilter).toBe(3);
    expect(stats.robots ?? 0).toBe(0);
    expect((await listGateSkips(db)).map((s) => s.title)).toContain('Technische Assistenz (m/w/d) im Chemielabor');

    const job1 = jobs.find((j) => /Emotionsregulation/.test(j.title))!;
    expect(job1.deadline).toBe('2026-11-15');
    expect(job1.payGrade).toBe('E 13 TV-L');
    expect(job1.workloadPct).toBe(65);
    expect(job1.kind).toBe('promotion');
    expect(job1.referenceNo).toBe('PSY-2026/17');
    expect(job1.cityId).toBe('halle-saale');
    // gleiche Anzeige über Liste und Portal-Feed → ein Datensatz, zwei Quellen
    expect(job1.sources?.map((s) => s.sourceId).sort()).toEqual(['portal-feed', 'test-z1']);

    const job2 = jobs.find((j) => /Postdoc/.test(j.title))!;
    expect(job2.kind).toBe('postdoc');
    expect(job2.deadline).toBe('2026-11-30');
    expect(job2.payGrade).toBe('E 14 TV-L');
    expect(job2.workloadPct).toBe(100);

    const sources = await listSources(db);
    expect(sources.find((s) => s.id === 'test-z1')?.status).toBe('ok');
  });

  it('zweiter Lauf erzeugt keine Dubletten', async () => {
    const before = (await syncJobs(db, '', 100)).jobs.length;
    const p = new Pipeline(db, cfg, { browser: false, images: false, discovery: false, reminders: false }, new RunLog(false));
    const stats = await p.run();
    const after = (await syncJobs(db, '', 100)).jobs.length;
    expect(after).toBe(before);
    expect(stats.neu ?? 0).toBe(0);
    expect(stats.gesehen).toBeGreaterThan(3);
  });
});

const hasChromium = existsSync('/opt/pw-browsers/chromium') || !!process.env.CHROMIUM_PATH;

describe.skipIf(!hasChromium)('Lauf mit Browser', () => {
  it('liest JavaScript-Seiten über die Browser-Warteschlange vollständig ein', async () => {
    const db = new SqliteDb(':memory:');
    migrateSqlite(db);
    await db.batch([
      upsertCityStmt({ id: 'halle-saale', name: 'Halle (Saale)', state: 'ST', lat: 51.48, lon: 11.97 }),
      upsertInstitutionStmt({ id: 'test-uni', name: 'Testuniversität', shortName: 'Test-Uni', kind: 'universitaet', cityId: 'halle-saale', website: srv.url, active: true, origin: 'seed' }),
      upsertSourceStmt(source()),
    ]);
    const c = { ...cfg, browser: { ...cfg.browser, enabled: true } };
    const stats = await new Pipeline(db, c, { browser: true, images: false, discovery: false, reminders: false }, new RunLog(false)).run();
    const { jobs } = await syncJobs(db, '', 100);
    const js = jobs.find((j) => /Studienkoordination/.test(j.title));
    expect(stats.browserNeu).toBe(1);
    expect(js?.completeness).toBe('ok');
    expect(js?.deadline).toBe('2026-11-20');
    expect(js?.method).toMatch(/^browser/);
    expect(stats.grobfilter).toBe(1);
  });
});

describe.skipIf(!hasChromium)('Browser-Agent', () => {
  it('schließt Cookie-Banner, klickt "mehr anzeigen" und liest den vollständigen Text', async () => {
    const log = new RunLog(false);
    const c = { ...cfg, browser: { ...cfg.browser, enabled: true } };
    const pool = new BrowserPool(c, log);
    try {
      const r = await agentReadPosting(pool, new Http(c, log), new Llm(c.llm, log), log, `${srv.url}/stellen/js-job.html`);
      expect(r.steps).toContain('Cookie-Hinweis geschlossen');
      expect(r.data?.title).toMatch(/Studienkoordination/);
      expect(r.data?.descriptionMd).toMatch(/multizentrischen Psychotherapiestudie/);
      expect(r.data?.complete).toBe(true);
    } finally {
      await pool.close();
    }
  });
});

describe('Grenzen eines Laufs', () => {
  it('hält den Zwischenspeicher klein und behält die zuletzt benutzten Seiten', async () => {
    const fetched: string[] = [];
    const fake = (async (url: string | URL | Request) => {
      const u = String(url);
      if (!u.endsWith('/robots.txt')) fetched.push(u.replace('https://cache.test', ''));
      return new Response('<html><body>Seite</body></html>', { headers: { 'content-type': 'text/html' } });
    }) as typeof fetch;
    const http = new Http({ ...cfg, httpCacheMax: 2 }, new RunLog(false), fake);
    for (const p of ['/a', '/b', '/a', '/c', '/a', '/b']) await http.get(`https://cache.test${p}`);
    // /a bleibt als zuletzt benutzt im Speicher, /b fliegt für /c raus und wird neu geholt
    expect(fetched).toEqual(['/a', '/b', '/c', '/b']);
  });

  it('beginnt nach Ablauf des Zeitbudgets keine Quellen mehr und sagt, wie viele vertagt sind', async () => {
    const db = new SqliteDb(':memory:');
    migrateSqlite(db);
    await db.batch([
      upsertCityStmt({ id: 'halle-saale', name: 'Halle (Saale)', state: 'ST', lat: 51.48, lon: 11.97 }),
      upsertInstitutionStmt({ id: 'test-uni', name: 'Testuniversität', kind: 'universitaet', cityId: 'halle-saale', website: srv.url, active: true, origin: 'seed' }),
      upsertSourceStmt(source()),
      upsertSourceStmt(source({ id: 'portal-feed', institutionId: null, kind: 'portal', label: 'Testportal', url: `${srv.url}/feed.xml`, adapter: 'feed', config: { feedUrl: `${srv.url}/feed.xml` }, gate: 'none' })),
    ]);
    const log = new RunLog(false);
    const stats = await new Pipeline(db, { ...cfg, sourceBudgetMs: 0 }, { browser: false, images: false, discovery: false, reminders: false }, log).run();
    expect(stats.quellenVertagt).toBe(2);
    expect((await syncJobs(db, '', 10)).jobs).toHaveLength(0);
    expect(log.text()).toMatch(/Zeitbudget erreicht: 2 Quellen kommen im nächsten Lauf zuerst dran/);
  });
});

describe('Nur Browser-Warteschlange', () => {
  it('liest keine Quellen, erkundet nicht und räumt nichts ab', async () => {
    const db = new SqliteDb(':memory:');
    migrateSqlite(db);
    await db.batch([
      upsertCityStmt({ id: 'halle-saale', name: 'Halle (Saale)', state: 'ST', lat: 51.48, lon: 11.97 }),
      upsertInstitutionStmt({ id: 'test-uni', name: 'Testuniversität', kind: 'universitaet', cityId: 'halle-saale', website: srv.url, active: true, origin: 'seed' }),
      upsertSourceStmt(source()),
    ]);
    const stats = await new Pipeline(db, cfg, { sources: false, browser: false, reminders: false }, new RunLog(false)).run();
    expect(stats.kandidaten).toBeUndefined();
    expect(stats.abgelaufen).toBeUndefined();
    expect((await listSources(db)).find((s) => s.id === 'test-z1')?.lastRunAt ?? null).toBeNull();
  });
});
