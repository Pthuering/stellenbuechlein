// Auslandsanzeigen: Freigabe, Regeln vor der KI (passt zum Kern?) und Deckel je Lauf.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { listGateSkips, syncJobs, upsertSourceStmt } from '@stellen/db';
import type { Source } from '@stellen/core';
import { configFromEnv, type IngestConfig } from '../src/config';
import { RunLog } from '../src/log';
import { Pipeline } from '../src/pipeline';
import { startFixtureServer, type FixtureServer } from './fixtures/server';

let srv: FixtureServer;
let cfg: IngestConfig;
const NOW = new Date('2026-10-12T10:00:00Z');

beforeAll(async () => {
  srv = await startFixtureServer();
  cfg = configFromEnv({ ...process.env, LLM_API_KEY: '', DEEPSEEK_API_KEY: '', BRAVE_API_KEY: '' });
  cfg.minHostIntervalMs = 5;
  cfg.llm.apiKey = null;
  cfg.browser.enabled = false;
});

afterAll(async () => {
  await srv.close();
});

async function run(setting: unknown) {
  const db = new SqliteDb(':memory:');
  migrateSqlite(db);
  const portal: Source = {
    id: 'test-portal',
    institutionId: null,
    kind: 'portal',
    label: 'Testportal',
    url: `${srv.url}/ausland/`,
    adapter: 'auto',
    config: { linkPattern: '/ausland/' },
    gate: 'psych',
    enabled: true,
    verified: true,
    status: 'neu',
    consecutiveFailures: 0,
  };
  await db.batch([upsertSourceStmt(portal)]);
  if (setting) await db.run('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', ['ausland', JSON.stringify(setting), NOW.toISOString()]);
  const stats = await new Pipeline(db, cfg, { browser: false, images: false, discovery: false, reminders: false, explore: false, now: NOW }, new RunLog(false)).run();
  return { db, stats, jobs: (await syncJobs(db, '', 100)).jobs };
}

describe('Ausland', () => {
  it('ohne Freigabe werden Auslandsanzeigen wie bisher verworfen', async () => {
    const { stats, jobs } = await run(null);
    expect(stats.ausland).toBe(3);
    expect(jobs).toEqual([]);
  });

  it('mit Freigabe: nur was zum Kern passt, mit Land; außerhalb Europas gilt ein eigener Deckel', async () => {
    const { db, stats, jobs } = await run({ an: true, proLauf: 10, weltweitProLauf: 0, minPassung: 50 });
    // (den Zusatz „– Universität Zürich“ kürzt die Titelbereinigung weg; das Land ist da schon erkannt)
    expect(jobs.map((j) => [j.title, j.country, j.lane])).toEqual([['Postdoc (m/w/d) Kognitive Psychologie', 'CH', 'kern']]);
    expect(stats.neuAusland).toBe(1);
    // Finanzstelle in Wien: Psychologie kommt vor, die Stelle passt aber nicht; wird vermerkt und nicht wieder gelesen
    expect(stats.auslandUnpassend).toBe(1);
    expect((await listGateSkips(db)).map((s) => [s.reason, s.title])).toEqual([['ausland', 'Referent:in Finanzen (m/w/d), Wien']]);
    // Boston passt, aber der Deckel für Länder außerhalb Europas ist erreicht: kommt in einem späteren Lauf wieder
    expect(stats.auslandVertagt).toBe(1);
  });

  it('Deckel je Lauf: was nicht mehr hineinpasst, wird vertagt und nicht vermerkt', async () => {
    const { db, stats, jobs } = await run({ an: true, proLauf: 1, weltweitProLauf: 1, minPassung: 50 });
    expect(jobs).toHaveLength(1);
    expect(stats.auslandVertagt).toBe(1);
    expect((await listGateSkips(db)).filter((s) => s.reason === 'ausland')).toHaveLength(1);
  });
});
