// KI-Warteschlange für Claude: Die Pipeline arbeitet ohne KI und legt fest, was eine KI noch erledigen soll
// (Tabelle ki_aufgaben). Hier werden die Aufgaben als Paket für eine Claude-Sitzung ausgegeben und die
// Ergebnisse eingespielt. Anweisungen und Antwortformate sind dieselben wie bei der KI im Lauf (llm.ts).

import { z } from 'zod';
import {
  assessDeadline,
  canonicalUrl,
  classifyKind,
  DEFAULT_GATE_TERMS,
  parseProfile,
  profileSummary,
  starterProfile,
  stripMarkdown,
  todayBerlin,
  verifyDeadlineQuote,
  type JobHorizon,
} from '@stellen/core';
import {
  aiTaskDoneStmt,
  aiTaskFailedStmt,
  countOpenAiTasks,
  enqueueAiTaskStmt,
  gateSkipStmt,
  getSetting,
  listOpenAiTasks,
  NOT_A_POSTING,
  removeJobIfUnmarked,
  touchJobSourceStmt,
  upsertJobStmt,
  type AiTaskKind,
  type Db,
  type JobWrite,
  type Stmt,
} from '@stellen/db';
import { DEADLINE_SCHEMA, deadlinePrompt, EXTRACT_FIELDS, EXTRACT_PROMPT, EXTRACT_SCHEMA, HORIZON_PROMPT, HORIZON_SCHEMA } from './llm';
import { cleanTitle, GENERIC_TITLE, gateHashFor } from './pipeline';

/** Wie viel Anzeigentext eine Aufgabe mitbekommt (Zeichen). */
const TEXT_MAX: Record<AiTaskKind, number> = { auswerten: 12_000, frist: 12_000, horizont: 6_000, weite: 6_000 };

export interface AiPackageTask {
  id: number;
  art: AiTaskKind;
  titel: string;
  url: string;
  arbeitgeber: string | null;
  /** auswerten: Der Titel fehlt oder ist nichtssagend, bitte aus dem Text bestimmen. */
  titel_fehlt?: boolean;
  /** frist: was die Regeln gefunden haben */
  bisher_erkannt?: string | null;
  /** horizont: die Brücke, über die die Anzeige kam */
  bruecke?: { name: string; warum: string | null } | null;
  text: string;
}

export interface AiPackage {
  version: 1;
  heute: string;
  /** Für horizont und weite: Kurzfassung des Suchprofils */
  profil: string;
  /** Pro Art: Anweisung (wie die System-Anweisung der KI im Lauf) und die Felder der Antwort */
  anleitung: Record<AiTaskKind, { anweisung: string; antwort: string }>;
  ergebnis_format: string;
  aufgaben: AiPackageTask[];
}

function looksBroken(title: string): boolean {
  return !title || title.length < 6 || GENERIC_TITLE.test(title) || /^\(?[mwdfx](?:\s*\/\s*[mwdfx]){1,3}\)?$/i.test(title.trim());
}

async function loadProfileAndGate(db: Db) {
  const profile = parseProfile(await getSetting<unknown>(db, 'profile', null)) ?? starterProfile();
  const gateTerms = (await getSetting<string[] | null>(db, 'gateTerms', null)) ?? DEFAULT_GATE_TERMS;
  // Die Einsammel-Pipeline läuft ohne KI, also mit „regeln“ in der Kennung
  return { profile, gateHash: gateHashFor(gateTerms.length ? gateTerms : DEFAULT_GATE_TERMS, profile, false) };
}

interface JobRow {
  id: string;
  title: string;
  url: string;
  canonical_url: string;
  description_md: string;
  employer: string | null;
  institution_id: string | null;
  posted_at: string | null;
  pay_grade: string | null;
  pay_level: number | null;
  workload_pct: number | null;
  fixed_term: string | null;
  start_text: string | null;
  department: string | null;
  horizon: string | null;
  lane: string | null;
}

async function loadJobs(db: Db, ids: string[]): Promise<Map<string, JobRow>> {
  if (!ids.length) return new Map();
  const rows = await db.all<JobRow>(
    `SELECT id, title, url, canonical_url, description_md, employer, institution_id, posted_at, pay_grade, pay_level, workload_pct, fixed_term, start_text, department, horizon, lane
     FROM jobs WHERE id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/** Gibt bis zu max offene Aufgaben als Paket aus. Aufgaben zu inzwischen gelöschten Anzeigen werden erledigt. */
export async function exportAiTasks(db: Db, opts: { max?: number; arten?: AiTaskKind[] } = {}): Promise<AiPackage> {
  const tasks = await listOpenAiTasks(db, opts.max ?? 40, opts.arten);
  const jobs = await loadJobs(db, [...new Set(tasks.filter((t) => t.art !== 'weite').map((t) => t.jobId))]);
  const { profile } = await loadProfileAndGate(db);
  const gone: Stmt[] = [];
  const aufgaben: AiPackageTask[] = [];
  for (const t of tasks) {
    const p = (t.payload ?? {}) as Record<string, unknown>;
    if (t.art === 'weite') {
      const job = p.job as JobWrite | undefined;
      if (!job) {
        gone.push(aiTaskDoneStmt(t.id, { entfallen: 'Anzeige fehlt in der Aufgabe' }));
        continue;
      }
      aufgaben.push({ id: t.id, art: t.art, titel: job.title, url: job.url, arbeitgeber: job.employer ?? null, text: stripMarkdown(job.descriptionMd).slice(0, TEXT_MAX.weite) });
      continue;
    }
    const job = jobs.get(t.jobId);
    if (!job) {
      gone.push(aiTaskDoneStmt(t.id, { entfallen: 'Anzeige gibt es nicht mehr' }));
      continue;
    }
    const base = { id: t.id, art: t.art, titel: job.title, url: job.url, arbeitgeber: job.employer, text: stripMarkdown(job.description_md).slice(0, TEXT_MAX[t.art]) };
    if (t.art === 'auswerten') aufgaben.push({ ...base, titel_fehlt: p.titelFehlt === true || looksBroken(job.title) });
    else if (t.art === 'frist') aufgaben.push({ ...base, bisher_erkannt: (p.gefunden as string | null) ?? null });
    else aufgaben.push({ ...base, bruecke: p.bruecke ? { name: String(p.bruecke), warum: (p.warum as string | null) ?? null } : null });
  }
  await db.batch(gone);
  const heute = todayBerlin();
  return {
    version: 1,
    heute,
    profil: profileSummary(profile),
    anleitung: {
      auswerten: { anweisung: `${EXTRACT_PROMPT} Ist titel_fehlt gesetzt, bestimme title aus dem Text (Stellenbezeichnung wie in der Anzeige).`, antwort: EXTRACT_FIELDS },
      frist: { anweisung: deadlinePrompt(heute), antwort: 'deadline (YYYY-MM-DD oder null), quote (wörtliche Textstelle oder null), still_open (bool oder null)' },
      horizont: { anweisung: `${HORIZON_PROMPT} Die Anzeige kam über die genannte Brücke herein.`, antwort: 'verdict (passt | eher | nein), reason_de, label' },
      weite: { anweisung: `${HORIZON_PROMPT} Die Anzeige trifft keine Brücke; prüfe, ob die Fähigkeiten der Person dort tragen.`, antwort: 'verdict (passt | eher | nein), reason_de, label' },
    },
    ergebnis_format: 'JSON-Liste [{"id": <id der Aufgabe>, "ergebnis": { …Felder wie unter anleitung[art].antwort… }}], eine Zeile pro Aufgabe; Aufgaben, die du nicht sicher beurteilen kannst, weglassen.',
    aufgaben,
  };
}

export interface ImportReport {
  erledigt: number;
  fehler: string[];
  entfernt: number;
  weiteGespeichert: number;
  offen: number;
}

const SCHEMAS: Record<AiTaskKind, z.ZodType<unknown, z.ZodTypeDef, unknown>> = {
  auswerten: EXTRACT_SCHEMA,
  frist: DEADLINE_SCHEMA,
  horizont: HORIZON_SCHEMA,
  weite: HORIZON_SCHEMA,
};

/** Spielt Ergebnisse ein (Format wie ergebnis_format). Unbekannte oder schon erledigte Aufgaben werden übersprungen. */
export async function importAiResults(db: Db, results: { id: number; ergebnis: unknown }[], now = new Date().toISOString()): Promise<ImportReport> {
  const report: ImportReport = { erledigt: 0, fehler: [], entfernt: 0, weiteGespeichert: 0, offen: 0 };
  const ids = [...new Set(results.map((r) => Number(r.id)).filter(Number.isFinite))];
  if (!ids.length) return report;
  const rows = await db.all<{ id: number; art: AiTaskKind; job_id: string; payload: string | null }>(
    `SELECT id, art, job_id, payload FROM ki_aufgaben WHERE status = 'offen' AND id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  const tasks = new Map(rows.map((r) => [r.id, r]));
  const jobs = await loadJobs(db, [...new Set(rows.filter((r) => r.art !== 'weite').map((r) => r.job_id))]);
  const { gateHash } = await loadProfileAndGate(db);
  const today = todayBerlin();

  for (const res of results) {
    const t = tasks.get(Number(res.id));
    if (!t) continue;
    const stmts: Stmt[] = [];
    const parsed = SCHEMAS[t.art].safeParse(res.ergebnis);
    if (!parsed.success) {
      const msg = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'ergebnis'}: ${i.message}`).join('; ');
      report.fehler.push(`Aufgabe ${t.id} (${t.art}): ${msg}`);
      await db.batch([aiTaskFailedStmt(t.id, msg, now)]);
      continue;
    }
    const payload = t.payload ? (JSON.parse(t.payload) as Record<string, unknown>) : {};
    if (t.art === 'weite') {
      const r = parsed.data as z.infer<typeof HORIZON_SCHEMA>;
      const job = payload.job as JobWrite;
      if (r.verdict === 'nein') {
        stmts.push(gateSkipStmt({ url: canonicalUrl(String(payload.url ?? job.url)), sourceId: String(payload.sourceId), institutionId: job.institutionId, title: job.title.slice(0, 200), textHash: gateHash, reason: 'ki-nein', note: r.reason_de || null }, now));
      } else {
        const horizon: JobHorizon = { bridges: [], label: r.label, reason: r.reason_de || null, verdict: r.verdict };
        stmts.push(upsertJobStmt({ ...job, lane: 'weite', horizon, updatedAt: now }), touchJobSourceStmt(job.id, String(payload.sourceId), String(payload.url ?? job.url), now));
        for (const f of (payload.folge as { art: AiTaskKind; payload: unknown }[] | undefined) ?? []) stmts.push(enqueueAiTaskStmt(f.art, job.id, f.payload, now));
        report.weiteGespeichert++;
      }
    } else {
      const job = jobs.get(t.job_id);
      if (!job) {
        await db.batch([aiTaskDoneStmt(t.id, { entfallen: 'Anzeige gibt es nicht mehr' }, now)]);
        continue;
      }
      if (t.art === 'auswerten') {
        const r = parsed.data as z.infer<typeof EXTRACT_SCHEMA>;
        if (!r.is_job_posting) {
          if (await removeJobIfUnmarked(db, job.id, now)) {
            stmts.push(gateSkipStmt({ url: job.canonical_url, sourceId: 'ki', institutionId: job.institution_id, title: job.title.slice(0, 200), textHash: NOT_A_POSTING, reason: NOT_A_POSTING, note: null }, now));
            report.entfernt++;
          }
        } else {
          const title = (payload.titelFehlt === true || looksBroken(job.title)) && r.title ? cleanTitle(r.title) : job.title;
          const payGrade = job.pay_grade ?? r.pay_grade;
          const payLevel = job.pay_level ?? (payGrade ? Number(/(\d{1,2})/.exec(payGrade)?.[1] ?? NaN) || null : null);
          const workload = job.workload_pct ?? (r.workload_pct && r.workload_pct <= 100 ? Math.round(r.workload_pct) : null);
          const summary = r.summary_de && r.summary_de.length > 30 ? r.summary_de : null;
          stmts.push({
            sql: `UPDATE jobs SET title = ?, kind = ?, pay_grade = ?, pay_level = ?, workload_pct = ?, fixed_term = COALESCE(fixed_term, ?), start_text = COALESCE(start_text, ?),
                  department = COALESCE(department, ?), summary = COALESCE(?, summary), summary_ai = CASE WHEN ? IS NULL THEN summary_ai ELSE 1 END, updated_at = ? WHERE id = ?`,
            params: [title, classifyKind(title, job.description_md), payGrade, payLevel, workload, r.fixed_term, r.start, r.department, summary, summary, now, job.id],
          });
        }
      } else if (t.art === 'frist') {
        const r = parsed.data as z.infer<typeof DEADLINE_SCHEMA>;
        const plain = stripMarkdown(job.description_md);
        // Nur ein wörtlich belegtes Datum zählt, damit nichts erfunden ist
        if (r.deadline && r.quote && verifyDeadlineQuote(plain, r.deadline, r.quote)) {
          const again = assessDeadline({ iso: r.deadline, raw: r.quote, postedAt: job.posted_at?.slice(0, 10) ?? null, today, isNew: false });
          if (again.deadline) {
            stmts.push({ sql: "UPDATE jobs SET deadline = ?, deadline_check = 'ki', deadline_note = ?, updated_at = ? WHERE id = ?", params: [again.deadline, `„${r.quote.replace(/\s+/g, ' ').trim().slice(0, 140)}“`, now, job.id] });
          }
        }
      } else {
        const r = parsed.data as z.infer<typeof HORIZON_SCHEMA>;
        if (r.verdict === 'nein' && payload.aussen === true) {
          // Anzeige ohne Psychologie-Bezug, die nur über die Brücke kam: wie bei der KI im Lauf aussortieren
          if (await removeJobIfUnmarked(db, job.id, now)) {
            stmts.push(gateSkipStmt({ url: job.canonical_url, sourceId: 'ki', institutionId: job.institution_id, title: job.title.slice(0, 200), textHash: gateHash, reason: 'ki-nein', note: r.reason_de || null }, now));
            report.entfernt++;
          }
        } else {
          const prev = (job.horizon ? JSON.parse(job.horizon) : {}) as JobHorizon;
          const horizon: JobHorizon = { ...prev, label: r.label ?? prev.label ?? null, reason: r.reason_de || null, verdict: r.verdict };
          stmts.push({ sql: 'UPDATE jobs SET horizon = ?, updated_at = ? WHERE id = ?', params: [JSON.stringify(horizon), now, job.id] });
        }
      }
    }
    stmts.push(aiTaskDoneStmt(t.id, parsed.data, now));
    await db.batch(stmts);
    report.erledigt++;
  }
  const open = await countOpenAiTasks(db);
  report.offen = Object.values(open).reduce((s, n) => s + n, 0);
  return report;
}
