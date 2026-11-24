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
  quellenGrund,
  quellenSchwelle,
  scoreJob,
  searchTextOf,
  type Job,
  type StatQuelle,
  type StatQuellenPruefung,
  type StatRing,
  type StatSchnappschuss,
  type Suchprofil,
} from '@stellen/core';
import { countOpenAiTasks, listInstitutions, listMarks, listSources, listStatistik, rowToJob, type Db, type JobRow } from '@stellen/db';

type Stats = Record<string, number>;

/** Auffällige Quellen aus dem letzten Schnappschuss (für die Zählung „Läufe in Folge“). */
export async function letzteQuellen(db: Db): Promise<StatQuelle[]> {
  const [last] = await listStatistik(db, 1);
  const d = last?.daten as Partial<StatSchnappschuss> | null | undefined;
  return d?.quellen?.liste ?? [];
}

interface CheckRow {
  id: number;
  source_id: string;
  status: string;
  requested_at: string;
  finished_at: string | null;
  result: string | null;
  error: string | null;
}

/** Letzter Probelauf je Quelle, zusammengefasst für die Statistik. */
async function letztePruefungen(db: Db): Promise<Map<string, StatQuellenPruefung>> {
  const rows = await db.all<CheckRow>('SELECT id, source_id, status, requested_at, finished_at, result, error FROM source_checks WHERE source_id IS NOT NULL ORDER BY id DESC LIMIT 2000');
  const out = new Map<string, StatQuellenPruefung>();
  for (const r of rows) {
    if (out.has(r.source_id)) continue;
    let res: { verdict?: string; candidates?: number; listUrl?: string; url?: string; notes?: string[] } = {};
    try {
      res = r.result ? JSON.parse(r.result) : {};
    } catch {
      res = {};
    }
    out.set(r.source_id, {
      id: r.id,
      status: r.status,
      am: r.finished_at ?? r.requested_at,
      urteil: res.verdict ?? null,
      anzeigen: typeof res.candidates === 'number' ? res.candidates : null,
      adresse: res.listUrl && res.url && res.listUrl !== res.url ? res.listUrl : null,
      hinweis: r.error ?? res.notes?.[0] ?? null,
    });
  }
  return out;
}

/**
 * Befund aller aktiven Quellen nach dem Lauf: auffällig ist, was Fehler meldet, gesperrt ist, leer bleibt, bei einer
 * Universität höchstens einen Eintrag liefert oder wo ein Portal eine fehlende Anzeige fand. Gezählt wird, wie viele
 * Läufe in Folge das so ist; ab der Schwelle (quellenSchwelle) ist die Quelle markiert.
 */
export async function quellenBefund(db: Db, vorher: StatQuelle[], today: string): Promise<{ liste: StatQuelle[]; aktiv: number }> {
  const [sources, insts, pruefungen] = await Promise.all([listSources(db, true), listInstitutions(db), letztePruefungen(db)]);
  const kindOf = new Map(insts.map((i) => [i.id, i]));
  const prev = new Map(vorher.map((q) => [q.id, q]));
  const liste: StatQuelle[] = [];
  let aktiv = 0;
  for (const s of sources) {
    if (s.adapter === 'erkundung' || !s.url) continue;
    aktiv++;
    const inst = s.institutionId ? kindOf.get(s.institutionId) : undefined;
    const art = s.kind === 'portal' ? 'portal' : inst?.kind ?? 'sonstige';
    const grund = quellenGrund({ status: s.status, lastCount: s.lastCount ?? null }, art);
    if (!grund) continue;
    const p = prev.get(s.id);
    const weiter = p && p.grund === grund;
    // Ohne Vorgeschichte zählen bei Fehlern die Fehlversuche in Folge, die die Quelle selbst mitführt
    const laeufe = weiter ? p.laeufe + 1 : grund === 'fehler' || grund === 'blockiert' ? Math.max(1, s.consecutiveFailures) : 1;
    liste.push({
      id: s.id,
      name: inst?.name ?? s.label ?? s.id,
      url: s.url,
      art,
      grund,
      anzahl: s.lastCount ?? null,
      laeufe,
      seit: weiter ? p.seit : today,
      markiert: laeufe >= quellenSchwelle(grund, art),
      notiz: s.statusNote ?? null,
      pruefung: pruefungen.get(s.id) ?? null,
    });
  }
  liste.sort((a, b) => Number(b.markiert) - Number(a.markiert) || b.laeufe - a.laeufe || a.name.localeCompare(b.name));
  return { liste, aktiv };
}

export async function buildSnapshot(
  db: Db,
  profile: Suchprofil,
  run: { start: string; ende: string; ok: boolean; stats: Stats },
  today: string,
  quellen?: StatSchnappschuss['quellen'],
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

  return { version: 1, lauf: laufKennzahlen(run), bestand, ...(quellen ? { quellen } : {}), wirkung };
}
