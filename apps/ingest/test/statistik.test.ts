import { beforeEach, describe, expect, it } from 'vitest';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { aiTaskDoneStmt, aiTaskFailedStmt, enqueueAiTaskStmt, entscheidungenTage, kiTage, upsertJobStmt, upsertMarkStmt, type JobWrite } from '@stellen/db';
import { canonicalUrl, contentHash, jobIdForUrl, starterProfile } from '@stellen/core';
import { buildSnapshot } from '../src/statistik';

const NOW = '2026-10-26T10:00:00.000Z';
const TODAY = '2026-10-26';

function job(slug: string, over: Partial<JobWrite> = {}): JobWrite {
  const url = `https://uni.example/jobs/${slug}`;
  return {
    id: jobIdForUrl(url),
    institutionId: null,
    url,
    canonicalUrl: canonicalUrl(url),
    title: 'Wissenschaftliche Mitarbeiterin (m/w/d) Kognitive Psychologie',
    descriptionMd: 'Am Institut für Psychologie, Arbeitsgruppe Kognitive Psychologie, ist eine Stelle zu besetzen. E 13 TV-L, 65 %.',
    kind: 'wiss_ma',
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    updatedAt: NOW,
    status: 'aktiv',
    completeness: 'ok',
    contentHash: contentHash(slug, 'x'),
    fuzzyKey: null,
    deadline: '2026-11-03',
    ...over,
  };
}

let db: SqliteDb;
const a = job('a');
const b = job('b', { deadline: null });
const zurich = job('z', { country: 'CH', title: 'Postdoc Kognitive Psychologie, Zürich' });
const alt = job('alt', { status: 'abgelaufen', deadline: '2026-10-01' });

beforeEach(async () => {
  db = new SqliteDb(':memory:');
  migrateSqlite(db);
  await db.batch([
    upsertJobStmt(a),
    upsertJobStmt(b),
    upsertJobStmt(zurich),
    upsertJobStmt(alt),
    upsertMarkStmt({ jobId: a.id, decision: 'gemerkt', decidedAt: NOW, star: true, appliedAt: null, note: null, updatedAt: NOW }),
    upsertMarkStmt({ jobId: alt.id, decision: 'abgelehnt', decidedAt: NOW, star: false, appliedAt: null, note: null, updatedAt: NOW }),
    upsertMarkStmt({ jobId: 'gibt-es-nicht', decision: 'abgelehnt', decidedAt: NOW, star: false, appliedAt: null, note: null, updatedAt: NOW }),
  ]);
});

describe('Statistik-Schnappschuss', () => {
  it('zählt Lauf, Bestand und Wirkung', async () => {
    const snap = await buildSnapshot(
      db,
      starterProfile(NOW),
      { start: '2026-10-26T11:00:00.000Z', ende: '2026-10-26T12:30:00.000Z', ok: true, stats: { kandidaten: 100, gesehen: 60, titelAusschluss: 20, grobfilter: 10, neu: 5, neuHorizont: 2, quelle_ok: 3, quelle_fehler: 1 } },
      TODAY,
    );
    expect(snap.lauf).toMatchObject({ gefunden: 100, bekannt: 60, titel: 20, grobfilter: 10, neu: 5, neuBruecke: 2, quellenOk: 3, quellenFehler: 1, minuten: 90 });
    // offen: a, b und Zürich (die abgelaufene zählt nicht)
    expect(snap.bestand.offen).toBe(3);
    expect(snap.bestand.normal).toBe(2);
    expect(snap.bestand.ausland).toBe(1);
    expect(snap.bestand.mitFrist).toBe(2);
    expect(snap.bestand.fristBald).toBe(2);
    expect(Object.values(snap.bestand.passung).reduce((x, y) => x + y, 0)).toBe(2);
    // Entscheidungen zu Anzeigen, die es noch gibt (auch abgelaufene), die gelöschte fehlt
    expect(snap.wirkung.nachRing.normal).toEqual({ gemerkt: 1, weggelegt: 1 });
    expect(snap.wirkung.herz).toBe(1);
  });
});

describe('Statistik je Tag', () => {
  it('zählt KI-Ergebnisse nach Art und Urteil, gescheiterte Versuche erst am Ende', async () => {
    await db.batch([
      enqueueAiTaskStmt('horizont', a.id, null, NOW),
      enqueueAiTaskStmt('auswerten', b.id, null, NOW),
      enqueueAiTaskStmt('frist', a.id, null, NOW),
    ]);
    const ids = (await db.all<{ id: number; art: string }>('SELECT id, art FROM ki_aufgaben')).reduce<Record<string, number>>((m, r) => ({ ...m, [r.art]: r.id }), {});
    await db.batch([
      aiTaskDoneStmt(ids.horizont, { verdict: 'eher', reason_de: 'x', label: null }, '2026-10-26T20:00:00.000Z'),
      aiTaskDoneStmt(ids.auswerten, { is_job_posting: false }, '2026-10-26T20:00:00.000Z'),
      aiTaskFailedStmt(ids.frist, 'nicht beantwortet', '2026-10-26T20:00:00.000Z'),
    ]);
    const ki = await kiTage(db, '2026-10-01');
    expect(ki.map((r) => [r.art, r.ergebnis, r.n])).toEqual([
      ['auswerten', 'keine-anzeige', 1],
      ['horizont', 'eher', 1],
    ]);
    expect(Math.round(ki[0].stunden ?? 0)).toBe(10);
  });

  it('zählt Entscheidungen nach Ring, gelöschte Anzeigen als „weg“', async () => {
    const e = await entscheidungenTage(db, '2026-10-01');
    expect(e.map((r) => [r.entscheidung, r.ring, r.n]).sort()).toEqual([
      ['abgelehnt', 'kern', 1],
      ['abgelehnt', 'weg', 1],
      ['gemerkt', 'kern', 1],
    ]);
  });
});
