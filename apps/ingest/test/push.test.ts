import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { addPushSubscription, getJob, setSetting, upsertCityStmt, upsertInstitutionStmt, upsertMarkStmt } from '@stellen/db';
import { scoreJob, searchTextOf, starterProfile } from '@stellen/core';
import type { IngestConfig } from '../src/config';
import { RunLog } from '../src/log';
import { sendHighScoreAlert } from '../src/push';

type Sent = { title: string; body: string; tag?: string; highlight?: boolean; i18n?: Record<string, { title: string; body: string }> };
const sent: Sent[] = [];
/** Meldungen mit diesem Tag scheitern beim Push-Dienst (vorübergehend, kein abgelaufenes Abo). */
let failTag: string | null = null;
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: () => undefined,
    sendNotification: async (_sub: unknown, payload: string) => {
      const p = JSON.parse(payload) as Sent;
      if (p.tag && p.tag === failTag) throw Object.assign(new Error('Push-Dienst nicht erreichbar'), { statusCode: 500 });
      sent.push(p);
      return {};
    },
  },
}));

const cfg = { vapid: { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:test@example.org' } } as IngestConfig;
/** Start dieses Laufs; so steht auch first_seen_at bei den Anzeigen, die er gefunden hat. */
const NOW = '2026-11-23T12:00:00.000Z';
const ago = (days: number) => new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
const later = (days: number) => new Date(Date.parse(NOW) + days * 86_400_000).toISOString();

const TEXTS: Record<string, [title: string, description: string]> = {
  a: ['Wissenschaftliche Mitarbeiterin Psychologie', 'Lehrstuhl für Klinische Psychologie, Promotion möglich.'],
  b: ['Psychologin (m/w/d) für die Studienberatung', 'Wir suchen eine Psychologin mit Schwerpunkt Klinische Psychologie für die psychologische Beratung von Studierenden.'],
  c: ['Psychologe in Dresden', 'Beratung und Diagnostik.'],
  d: ['Sachbearbeitung Haushalt', 'Verwaltung des Haushalts.'],
};
/** Passung mit dem Startprofil, wie sie die App und das Einsammeln rechnen */
async function scoreOf(db: SqliteDb, id: string): Promise<number> {
  const job = (await getJob(db, id))!;
  return scoreJob(job, searchTextOf(job), starterProfile()).score;
}

interface JobInput {
  title?: string;
  description?: string;
  institutionId?: string | null;
  cityId?: string | null;
  locationText?: string | null;
  firstSeenAt?: string;
  deadline?: string | null;
  status?: string;
}

async function insertJob(db: SqliteDb, id: string, j: JobInput = {}): Promise<void> {
  const [title, description] = TEXTS[id] ?? [j.title ?? id, j.description ?? ''];
  const seen = j.firstSeenAt ?? NOW;
  await db.run(
    `INSERT INTO jobs (id, institution_id, url, canonical_url, title, description_md, location_text, city_id, deadline, status, first_seen_at, last_seen_at, updated_at, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, j.institutionId ?? null, `https://example.org/${id}`, `https://example.org/${id}`, title, description, j.locationText ?? null, j.cityId ?? null, j.deadline ?? null, j.status ?? 'aktiv', seen, seen, seen, id],
  );
}

async function setup(): Promise<SqliteDb> {
  const db = new SqliteDb(':memory:');
  migrateSqlite(db);
  await db.batch([
    upsertCityStmt({ id: 'leipzig', name: 'Leipzig', state: 'SN', lat: 51.34, lon: 12.37 }),
    upsertCityStmt({ id: 'dresden', name: 'Dresden', state: 'SN', lat: 51.05, lon: 13.74 }),
    upsertInstitutionStmt({ id: 'uni-leipzig', name: 'Universität Leipzig', kind: 'universitaet', cityId: 'leipzig', active: true, origin: 'seed' }),
  ]);
  // Aus diesem Lauf: Leipzig über die Einrichtung, über den Ortstext und direkt; Dresden
  await insertJob(db, 'a', { institutionId: 'uni-leipzig' });
  await insertJob(db, 'b', { locationText: '04109 Leipzig' });
  await insertJob(db, 'c', { cityId: 'dresden' });
  await insertJob(db, 'd', { cityId: 'leipzig' });
  // Aus früheren Läufen
  await insertJob(db, 'alt', { title: 'Leipzig, vor drei Tagen gefunden', cityId: 'leipzig', firstSeenAt: ago(3) });
  await insertJob(db, 'uralt', { title: 'Leipzig, vor 20 Tagen gefunden', cityId: 'leipzig', firstSeenAt: ago(20) });
  await insertJob(db, 'vorbei', { title: 'Leipzig, Frist vorbei', cityId: 'leipzig', firstSeenAt: ago(1), deadline: '2026-11-20' });
  await insertJob(db, 'abgelaufen', { title: 'Leipzig, abgelaufen', cityId: 'leipzig', firstSeenAt: ago(1), status: 'abgelaufen' });
  await addPushSubscription(db, { endpoint: 'https://push.example.org/1', p256dh: 'k', auth: 'a' });
  // Die Sammelmeldung ist von Haus aus an; hier nur, wo ein Test sie braucht
  await setSetting(db, 'notifyHighScore', { on: false, min: 85 });
  return db;
}

/** Neue Anzeigen dieses Laufs mit Score, wie sie die Pipeline für die Sammelmeldung übergibt */
const newJobs = [
  { id: 'a', title: TEXTS.a[0], score: 75 },
  { id: 'b', title: TEXTS.b[0], score: 88 },
  { id: 'c', title: TEXTS.c[0], score: 95 },
  { id: 'd', title: TEXTS.d[0], score: 60 },
];

const leipzig = (over: Record<string, unknown> = {}) => ({ id: 'f-leipzig', name: 'Leipzig', filter: { cities: ['leipzig'] }, push: true, pushSince: ago(1), ...over });

async function recorded(db: SqliteDb): Promise<string[]> {
  const rows = await db.all<{ filter_id: string; job_id: string }>('SELECT filter_id, job_id FROM filter_alerts_sent ORDER BY filter_id, job_id');
  return rows.map((r) => `${r.filter_id}:${r.job_id}`);
}

const run = (db: SqliteDb, jobs = newJobs, at = NOW, c: IngestConfig = cfg) => sendHighScoreAlert(db, c, new RunLog(false), jobs, at);

describe('Benachrichtigung für gespeicherte Filter', () => {
  beforeEach(() => {
    sent.length = 0;
    failTag = null;
  });

  it('meldet neue Treffer eines Filters mit Push einzeln, hält sie fest und nimmt sie aus der Sammelmeldung', async () => {
    const db = await setup();
    await setSetting(db, 'savedFilters', [leipzig()]);
    await setSetting(db, 'notifyHighScore', { on: true, min: 85 });
    const n = await run(db);
    // drei Treffer in Leipzig seit gestern (nicht „alt“), dann die Sammelmeldung nur noch mit Dresden
    expect(n).toBe(4);
    expect(sent.slice(0, 3).map((p) => p.tag).sort()).toEqual(['filter-f-leipzig-a', 'filter-f-leipzig-b', 'filter-f-leipzig-d']);
    expect(sent[3].tag).toBe('neu-passend');
    expect(sent[3].title).toBe('Neue Anzeige, passt zu 95 %');
    const a = sent.find((p) => p.tag === 'filter-f-leipzig-a')!;
    const score = await scoreOf(db, 'a');
    expect(a).toMatchObject({ title: `🔔 Leipzig: neue Anzeige, passt zu ${score} %`, body: TEXTS.a[0], highlight: true });
    expect(a.i18n?.en.title).toBe(`🔔 Leipzig: new posting, ${score}% match`);
    expect(a.i18n?.sr.title).toBe(`🔔 Leipzig: novi oglas, poklapanje ${score}%`);
    expect(await recorded(db)).toEqual(['f-leipzig:a', 'f-leipzig:b', 'f-leipzig:d']);
  });

  it('meldet einen Treffer je Filter nur einmal, neue aus späteren Läufen aber schon', async () => {
    const db = await setup();
    await setSetting(db, 'savedFilters', [leipzig()]);
    await run(db);
    expect(sent).toHaveLength(3);
    sent.length = 0;
    // Nächster Lauf ohne neue Anzeigen: nichts
    expect(await run(db, [], later(1))).toBe(0);
    expect(sent).toHaveLength(0);
    // Übernächster Lauf mit einer neuen Anzeige in Leipzig: nur diese
    await insertJob(db, 'e', { title: 'Neu in Leipzig', cityId: 'leipzig', firstSeenAt: later(2) });
    expect(await run(db, [{ id: 'e', title: 'Neu in Leipzig', score: 40 }], later(2))).toBe(1);
    expect(sent.map((p) => p.tag)).toEqual(['filter-f-leipzig-e']);
    expect(await recorded(db)).toEqual(['f-leipzig:a', 'f-leipzig:b', 'f-leipzig:d', 'f-leipzig:e']);
  });

  it('übergeht Filter ohne Push', async () => {
    const db = await setup();
    await setSetting(db, 'savedFilters', [leipzig({ push: false })]);
    await setSetting(db, 'notifyHighScore', { on: true, min: 85 });
    await run(db);
    expect(sent.map((p) => p.tag)).toEqual(['neu-passend']);
    expect(sent[0].title).toBe('2 neue Anzeigen ab 85 %');
    expect(await recorded(db)).toEqual([]);
  });

  it('meldet seit pushSince, aber höchstens zwei Wochen zurück; mehr als drei Treffer gebündelt', async () => {
    const db = await setup();
    await setSetting(db, 'savedFilters', [leipzig({ pushSince: ago(30) })]);
    await run(db);
    // a, b, d aus diesem Lauf und „alt“ (vor drei Tagen); nicht „uralt“, nicht „vorbei“, nicht „abgelaufen“
    expect(sent.map((p) => p.tag)).toEqual(['filter-f-leipzig']);
    expect(sent[0]).toMatchObject({ title: '🔔 Leipzig: 4 neue Anzeigen', highlight: true });
    expect(sent[0].i18n?.sr.title).toBe('🔔 Leipzig: 4 nova oglasa');
    expect(await recorded(db)).toEqual(['f-leipzig:a', 'f-leipzig:alt', 'f-leipzig:b', 'f-leipzig:d']);
  });

  it('übernimmt die Wunschstädte aus „highlight“: nur Anzeigen aus diesem Lauf, ab der Schwelle', async () => {
    const db = await setup();
    expect(await scoreOf(db, 'a')).toBeGreaterThanOrEqual(60);
    expect(await scoreOf(db, 'b')).toBeGreaterThanOrEqual(60);
    expect(await scoreOf(db, 'd')).toBeLessThan(60);
    await setSetting(db, 'highlight', { cities: ['leipzig'], min: 60, push: true });
    await run(db);
    expect(sent.map((p) => p.tag).sort()).toEqual(['filter-wunschstaedte-a', 'filter-wunschstaedte-b']);
    expect(sent[0].title.startsWith('🔔 Wunschstädte: ')).toBe(true);
  });

  it('meldet keine Anzeigen, über die schon entschieden ist', async () => {
    const db = await setup();
    await db.batch([
      upsertMarkStmt({ jobId: 'b', decision: 'abgelehnt', decidedAt: NOW, star: false, updatedAt: NOW }),
      upsertMarkStmt({ jobId: 'd', decision: 'gemerkt', decidedAt: NOW, star: false, updatedAt: NOW }),
      // Nur ein Stern ohne Entscheidung: bleibt ein Treffer
      upsertMarkStmt({ jobId: 'a', decision: null, star: true, updatedAt: NOW }),
    ]);
    await setSetting(db, 'savedFilters', [leipzig()]);
    await run(db);
    expect(sent.map((p) => p.tag)).toEqual(['filter-f-leipzig-a']);
    expect(await recorded(db)).toEqual(['f-leipzig:a']);
  });

  it('hält nichts fest, solange Push nicht eingerichtet ist, kein Gerät angemeldet ist oder die Meldung nicht ankommt', async () => {
    const db = await setup();
    await setSetting(db, 'savedFilters', [leipzig()]);
    await run(db, newJobs, NOW, { vapid: null } as IngestConfig);
    expect(sent).toHaveLength(0);
    expect(await recorded(db)).toEqual([]);

    await db.run('DELETE FROM push_subscriptions');
    await run(db);
    expect(sent).toHaveLength(0);
    expect(await recorded(db)).toEqual([]);

    await addPushSubscription(db, { endpoint: 'https://push.example.org/1', p256dh: 'k', auth: 'a' });
    failTag = 'filter-f-leipzig-b';
    await run(db);
    expect(sent.map((p) => p.tag).sort()).toEqual(['filter-f-leipzig-a', 'filter-f-leipzig-d']);
    expect(await recorded(db)).toEqual(['f-leipzig:a', 'f-leipzig:d']);

    // Im nächsten Lauf kommt der fehlgeschlagene noch einmal
    sent.length = 0;
    failTag = null;
    await run(db, [], later(1));
    expect(sent.map((p) => p.tag)).toEqual(['filter-f-leipzig-b']);
  });

  it('ein Fehler bei den Filtern hält die Sammelmeldung nicht auf', async () => {
    const db = await setup();
    await setSetting(db, 'savedFilters', [leipzig()]);
    await setSetting(db, 'notifyHighScore', { on: true, min: 85 });
    await db.run('DROP TABLE filter_alerts_sent');
    expect(await run(db)).toBe(2);
    expect(sent.map((p) => p.tag)).toEqual(['neu-passend']);
    expect(sent[0].title).toBe('2 neue Anzeigen ab 85 %');
  });
});
