import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import { configFromEnv, type IngestConfig } from '../src/config';
import { RunLog } from '../src/log';
import { Http } from '../src/http';
import { Llm } from '../src/llm';
import { BrowserPool } from '../src/browser';
import { agentReadPosting } from '../src/agent';
import { startFixtureServer, type FixtureServer } from './fixtures/server';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { listGateSkips, syncJobs, upsertCityStmt, upsertInstitutionStmt, upsertSourceStmt } from '@stellen/db';
import { Pipeline } from '../src/pipeline';
import { runSourceCheck } from '../src/sourceCheck';
import type { Source } from '@stellen/core';

// Nachgebauter OpenAI-kompatibler Endpunkt (wie DeepSeek), antwortet je nach Aufgabe.
let llmServer: Server;
let llmUrl = '';
const requests: { system: string; user: string }[] = [];
let srv: FixtureServer;
let cfg: IngestConfig;

beforeAll(async () => {
  srv = await startFixtureServer();
  llmServer = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const data = JSON.parse(body) as { messages: { role: string; content: string }[] };
      const system = data.messages.find((m) => m.role === 'system')?.content ?? '';
      const user = data.messages.find((m) => m.role === 'user')?.content ?? '';
      requests.push({ system, user });
      let answer: unknown = {};
      if (/steuerst einen Browser/.test(system)) {
        const m = /\[(\d+)\] a „Hier entlang zu allen Details“/.exec(user);
        answer = m ? { action: 'click', index: Number(m[1]), reason: 'Link zur vollständigen Anzeige' } : { action: 'done', index: null, reason: 'fertig' };
      } else if (/Person mit Psychologie-Hintergrund, Stellen außerhalb/.test(system)) {
        if (/Usable Security/.test(user)) answer = { verdict: 'passt', reason_de: 'Nutzerstudien und Experimente zu Phishing sind angewandte Verhaltensforschung.', label: 'IT-Sicherheit × Verhalten' };
        else if (/Studienberatung/.test(user)) answer = { verdict: 'passt', reason_de: 'Beratung und Lernstrategien knüpfen an Pädagogische Psychologie an.', label: 'Beratung × Lernen' };
        else if (/Mobilitätsplanung/.test(user)) answer = { verdict: 'eher', reason_de: 'Die Befragung braucht empirische Methoden, der Rest ist Planung.', label: 'Mobilität × Befragung' };
        else answer = { verdict: 'nein', reason_de: 'Dafür braucht es eine steuerrechtliche Ausbildung.', label: null };
      } else if (/prüfst die Bewerbungsfrist/.test(system)) {
        answer = /15\.07\.2027/.test(user)
          ? { deadline: '2027-07-15', quote: 'Bewerbungsschluss für die erste Runde: 15.07.2027', still_open: true }
          : { deadline: '2027-01-01', quote: 'erfundene Frist 1. Januar', still_open: true };
      } else if (/als Quelle für Stellenanzeigen taugt/.test(system)) {
        answer = {
          is_job_list: true,
          institution_name: 'Testuniversität',
          city: 'Halle (Saale)',
          institution_type: 'universitaet',
          is_department_page: true,
          sample_checks: [{ index: 0, is_posting: true, problems: [] }],
          link_pattern: null,
          needs_browser: false,
          verdict: 'gut',
          summary_de: 'Liste mit Stellen des Instituts für Psychologie, die Anzeigen sind vollständig lesbar.',
        };
      } else if (/liest Stellenausschreibungen/.test(system)) {
        answer = { is_job_posting: true, title: 'Promotionsstelle Entwicklungspsychologie (Sprachentwicklung)', institution: null, department: 'Lehrstuhl für Entwicklungspsychologie', location: null, deadline: '2026-11-28', pay_grade: null, workload_pct: null, fixed_term: null, start: null, summary_de: 'Promotion zur Sprachentwicklung von Kleinkindern. Studien mit Eye-Tracking planen und auswerten.' };
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
    });
  });
  await new Promise<void>((r) => llmServer.listen(0, '127.0.0.1', r));
  llmUrl = `http://127.0.0.1:${(llmServer.address() as AddressInfo).port}`;
  cfg = configFromEnv({ ...process.env, LLM_API_KEY: 'test', LLM_BASE_URL: llmUrl });
  cfg.minHostIntervalMs = 5;
  cfg.explore.enabled = false;
  cfg.browser.executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
});

afterAll(async () => {
  await srv.close();
  await new Promise<void>((r) => llmServer.close(() => r()));
});

describe('KI-Anbindung', () => {
  it('liefert strukturierte Felder (OpenAI-kompatibles JSON)', async () => {
    const llm = new Llm(cfg.llm, new RunLog(false));
    const r = await llm.extractPosting('Text', 'https://x.de');
    expect(r?.deadline).toBe('2026-11-28');
    expect(llm.calls).toBe(1);
  });

  it('hält das Aufruf-Limit ein', async () => {
    const llm = new Llm({ ...cfg.llm, maxCalls: 1 }, new RunLog(false));
    await llm.extractPosting('a', 'b');
    expect(await llm.extractPosting('a', 'b')).toBeNull();
    expect(llm.calls).toBe(1);
  });

  it.skipIf(!existsSync('/opt/pw-browsers/chromium'))('Browser-Agent folgt dem KI-Klick zur vollständigen Anzeige', async () => {
    const log = new RunLog(false);
    const pool = new BrowserPool(cfg, log);
    try {
      const r = await agentReadPosting(pool, new Http(cfg, log), new Llm(cfg.llm, log), log, `${srv.url}/stellen/teaser.html`);
      expect(r.steps.join(' ')).toMatch(/KI-Klick: a „Hier entlang zu allen Details“/);
      expect(r.data?.descriptionMd).toMatch(/episodischem Gedächtnis/);
      expect(r.data?.complete).toBe(true);
    } finally {
      await pool.close();
    }
  });
});

describe('KI im Lauf: Horizont, Weite, Fristen', () => {
  it('urteilt über Horizont- und Weite-Anzeigen und belegt Fristen mit Zitat', async () => {
    const db = new SqliteDb(':memory:');
    migrateSqlite(db);
    const src: Source = { id: 'test-zentral', institutionId: 'test-uni', kind: 'zentral', label: null, url: `${srv.url}/zentral/`, adapter: 'auto', config: {}, gate: 'psych', enabled: true, verified: true, status: 'neu', consecutiveFailures: 0 };
    await db.batch([
      upsertCityStmt({ id: 'halle-saale', name: 'Halle (Saale)', state: 'ST', lat: 51.48, lon: 11.97 }),
      upsertInstitutionStmt({ id: 'test-uni', name: 'Testuniversität', shortName: 'Test-Uni', kind: 'universitaet', cityId: 'halle-saale', website: srv.url, active: true, origin: 'seed' }),
      upsertSourceStmt(src),
    ]);
    const c = { ...cfg, browser: { ...cfg.browser, enabled: false } };
    const stats = await new Pipeline(db, c, { browser: false, images: false, discovery: false, reminders: false, explore: false, now: new Date('2026-10-12T10:00:00Z') }, new RunLog(false)).run();
    const { jobs } = await syncJobs(db, '', 100);
    const t = (re: RegExp) => jobs.find((j) => re.test(j.title));

    expect(t(/Usable Security/)?.horizon).toMatchObject({ verdict: 'passt', label: 'IT-Sicherheit × Verhalten' });
    expect(t(/Usable Security/)?.horizon?.reason).toMatch(/Verhaltensforschung/);
    expect(t(/Mobilität/)?.horizon?.verdict).toBe('eher');
    expect(t(/Studienberatung/)).toMatchObject({ lane: 'weite' });
    expect(t(/Studienberatung/)?.horizon?.reason).toMatch(/Lernstrategien/);
    expect(t(/Steuern/)).toBeUndefined();
    expect(t(/Hausmeister/)).toBeUndefined();
    const skips = await listGateSkips(db);
    expect(skips.find((k) => /Steuern/.test(k.title ?? ''))).toMatchObject({ reason: 'ki-nein', note: expect.stringMatching(/steuerrechtliche/) });
    expect(skips.find((k) => /Hausmeister/.test(k.title ?? ''))?.reason).toBe('grobfilter');
    expect(stats.neuWeite).toBe(1);

    // Ungewöhnlich weite Frist: von der KI mit wörtlichem Zitat belegt
    const weit = t(/Kognitive Psychologie/);
    expect(weit?.deadline).toBe('2027-07-15');
    expect(weit?.deadlineCheck).toBe('ki');
    expect(weit?.deadlineNote).toMatch(/erste Runde: 15\.07\.2027/);
  });

  it('Probelauf einer neuen Quelle: findet die Stellenseite und fragt die KI', async () => {
    const log = new RunLog(false);
    const ctx = { http: new Http(cfg, log), llm: new Llm(cfg.llm, log), browser: null, cfg, log };
    const inst = { id: 'test-uni', name: 'Testuniversität', shortName: 'Test-Uni', kind: 'universitaet' as const, cityId: 'halle-saale', website: srv.url, active: true, origin: 'seed' as const };
    const sources: Source[] = [{ id: 'test-z1', institutionId: 'test-uni', kind: 'zentral', label: null, url: `${srv.url}/stellen/`, adapter: 'auto', config: {}, gate: 'psych', enabled: true, verified: true, status: 'ok', consecutiveFailures: 0 }];
    const r = await runSourceCheck(`${srv.url}/`, null, { ctx, institutions: [inst], cities: [{ id: 'halle-saale', name: 'Halle (Saale)', state: 'ST', lat: 51.48, lon: 11.97 }], sources, today: '2026-10-12' });
    expect(r.listUrl).toBe(`${srv.url}/stellen/`);
    expect(r.notes.join(' ')).toMatch(/Stellenseite ist vermutlich/);
    expect(r.candidates).toBeGreaterThanOrEqual(4);
    expect(r.samples.length).toBeGreaterThanOrEqual(3);
    expect(r.samples.some((s) => s.deadline === '2026-11-15' && s.payGrade === 'E 13 TV-L')).toBe(true);
    expect(r.registered?.sourceId).toBe('test-z1');
    expect(r.institution.id).toBe('test-uni');
    expect(r.kindGuess).toBe('fachbereich');
    expect(r.ai?.summary).toMatch(/Instituts für Psychologie/);
    expect(r.verdict).toBe('gut');
  });
});
