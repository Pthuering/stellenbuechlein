// Statistik-Schnappschuss am Ende jedes Einsammel-Laufs: Kennzahlen des Laufs, Zustand des Bestands, Passung
// und Wirkung (was Tara gemerkt oder weggelegt hat). Gerechnet wie in der App (Passung, Ring, Auslandsregeln).

import {
  ABROAD_MIN_SCORE,
  daysUntil,
  fachSignale,
  fachlichEinschlaegig,
  horizontOf,
  isAbroad,
  isOpen,
  isThematic,
  laufKennzahlen,
  laneOf,
  leereRinge,
  leereStufen,
  passungStufe,
  scoreJob,
  searchTextOf,
  type Job,
  type StatRing,
  type StatSchnappschuss,
  type Suchprofil,
} from '@stellen/core';
import { countOpenAiTasks, listMarks, rowToJob, type Db, type JobRow } from '@stellen/db';

type Stats = Record<string, number>;

export async function buildSnapshot(
  db: Db,
  profile: Suchprofil,
  run: { start: string; ende: string; ok: boolean; stats: Stats },
  today: string,
): Promise<StatSchnappschuss> {
  const [rows, marks, kiOffen] = await Promise.all([
    db.all<JobRow>(`SELECT * FROM jobs WHERE status IN ('aktiv', 'pruefung') OR id IN (SELECT job_id FROM marks WHERE decision IS NOT NULL)`),
    listMarks(db),
    countOpenAiTasks(db),
  ]);
  const hz = horizontOf(profile);

  // Ring und Passung je Anzeige, wie die App sie zeigt
  const info = new Map<string, { job: Job; ring: StatRing; promoted: boolean; wartet: boolean; score: number; sichtbar: boolean }>();
  for (const r of rows) {
    const job = rowToJob(r);
    const norm = searchTextOf(job);
    const score = scoreJob(job, norm, profile).score;
    const lane = laneOf(job, norm, hz, isThematic(job, norm, profile));
    const abroad = isAbroad(job);
    const ring: StatRing = abroad ? 'ausland' : lane.lane === 'horizont' ? 'bruecke' : lane.lane === 'weite' ? 'horizont' : 'normal';
    const sichtbar = abroad ? score >= ABROAD_MIN_SCORE && fachlichEinschlaegig(fachSignale(job, job.descriptionMd, norm, profile)) : true;
    info.set(job.id, { job, ring, promoted: lane.promoted, wartet: lane.lane !== 'kern' && lane.verdict == null, score, sichtbar });
  }

  const bestand: StatSchnappschuss['bestand'] = {
    offen: 0,
    normal: 0,
    bruecke: 0,
    horizont: 0,
    wartetAufKi: 0,
    ausland: 0,
    auslandSichtbar: 0,
    mitFrist: 0,
    fristBald: 0,
    passung: leereStufen(() => 0),
    passungMedian: null,
    kiOffen: Object.values(kiOffen).reduce((a, b) => a + b, 0),
  };
  const scores: number[] = [];
  for (const v of info.values()) {
    if (v.job.status !== 'aktiv' || !isOpen(v.job, today)) continue;
    bestand.offen++;
    if (v.job.deadline) {
      bestand.mitFrist++;
      const left = daysUntil(v.job.deadline, today);
      if (left != null && left <= 14) bestand.fristBald++;
    }
    if (v.ring === 'ausland') {
      bestand.ausland++;
      if (v.sichtbar) bestand.auslandSichtbar++;
    } else if (v.ring === 'normal') {
      bestand.normal++;
      bestand.passung[passungStufe(v.score)]++;
      scores.push(v.score);
    } else if (v.wartet) bestand.wartetAufKi++;
    else if (v.promoted) bestand[v.ring]++;
  }
  scores.sort((a, b) => a - b);
  if (scores.length) bestand.passungMedian = scores[Math.floor(scores.length / 2)];

  const wirkung: StatSchnappschuss['wirkung'] = {
    nachRing: leereRinge(() => ({ gemerkt: 0, weggelegt: 0 })),
    nachPassung: leereStufen(() => ({ gemerkt: 0, weggelegt: 0 })),
    herz: marks.filter((m) => m.star).length,
    beworben: marks.filter((m) => m.appliedAt).length,
  };
  for (const m of marks) {
    if (m.decision !== 'gemerkt' && m.decision !== 'abgelehnt') continue;
    const v = info.get(m.jobId);
    if (!v) continue;
    const key = m.decision === 'gemerkt' ? 'gemerkt' : 'weggelegt';
    wirkung.nachRing[v.ring][key]++;
    if (v.ring === 'normal') wirkung.nachPassung[passungStufe(v.score)][key]++;
  }

  return { version: 1, lauf: laufKennzahlen(run), bestand, wirkung };
}
