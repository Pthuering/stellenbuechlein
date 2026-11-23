import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { addPushSubscription, setSetting, upsertCityStmt, upsertInstitutionStmt } from '@stellen/db';
import type { IngestConfig } from '../src/config';
import { RunLog } from '../src/log';
import { sendHighScoreAlert } from '../src/push';

const sent: { title: string; tag?: string; highlight?: boolean }[] = [];
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: () => undefined,
    sendNotification: async (_sub: unknown, payload: string) => {
      sent.push(JSON.parse(payload));
      return {};
    },
  },
}));

const cfg = { vapid: { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:test@example.org' } } as IngestConfig;
const now = '2026-11-23T12:00:00.000Z';

async function setup(): Promise<SqliteDb> {
  const db = new SqliteDb(':memory:');
  migrateSqlite(db);
  await db.batch([
    upsertCityStmt({ id: 'leipzig', name: 'Leipzig', state: 'SN', lat: 51.34, lon: 12.37 }),
    upsertCityStmt({ id: 'dresden', name: 'Dresden', state: 'SN', lat: 51.05, lon: 13.74 }),
    upsertInstitutionStmt({ id: 'uni-leipzig', name: 'Universität Leipzig', kind: 'universitaet', cityId: 'leipzig', active: true, origin: 'seed' }),
  ]);
  const job = (id: string, title: string, institutionId: string | null, cityId: string | null, locationText: string | null) =>
    db.run(
      `INSERT INTO jobs (id, institution_id, url, canonical_url, title, location_text, city_id, first_seen_at, last_seen_at, updated_at, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, institutionId, `https://example.org/${id}`, `https://example.org/${id}`, title, locationText, cityId, now, now, now, id],
    );
  await job('a', 'Über die Einrichtung in Leipzig', 'uni-leipzig', null, null);
  await job('b', 'Ortstext Leipzig', null, null, '04109 Leipzig');
  await job('c', 'Dresden', null, 'dresden', null);
  await job('d', 'Leipzig, aber zu niedrig', null, 'leipzig', null);
  await addPushSubscription(db, { endpoint: 'https://push.example.org/1', p256dh: 'k', auth: 'a' });
  return db;
}

const newJobs = [
  { id: 'a', title: 'Über die Einrichtung in Leipzig', score: 75 },
  { id: 'b', title: 'Ortstext Leipzig', score: 88 },
  { id: 'c', title: 'Dresden', score: 95 },
  { id: 'd', title: 'Leipzig, aber zu niedrig', score: 60 },
];

describe('Benachrichtigung für Wunschstädte', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('meldet Treffer in den Wunschstädten einzeln und nimmt sie aus der Sammelmeldung', async () => {
    const db = await setup();
    await setSetting(db, 'highlight', { cities: ['leipzig'], min: 70, push: true });
    await setSetting(db, 'notifyHighScore', { on: true, min: 85 });
    const n = await sendHighScoreAlert(db, cfg, new RunLog(false), newJobs);
    expect(n).toBe(3);
    // zwei einzelne, hervorgehobene (beste zuerst), dann die Sammelmeldung nur noch mit Dresden
    expect(sent.map((p) => p.tag)).toEqual(['hervorgehoben-b', 'hervorgehoben-a', 'neu-passend']);
    expect(sent[0]).toMatchObject({ title: '📍 Leipzig: neue Anzeige, passt zu 88 %', highlight: true });
    expect(sent[2].title).toBe('Neue Anzeige, passt zu 95 %');
  });

  it('ohne Städte oder mit ausgeschaltetem Push bleibt es bei der Sammelmeldung', async () => {
    const db = await setup();
    await setSetting(db, 'highlight', { cities: ['leipzig'], min: 70, push: false });
    await setSetting(db, 'notifyHighScore', { on: true, min: 85 });
    await sendHighScoreAlert(db, cfg, new RunLog(false), newJobs);
    expect(sent.map((p) => p.tag)).toEqual(['neu-passend']);
    expect(sent[0].title).toBe('2 neue Anzeigen ab 85 %');
  });
});
