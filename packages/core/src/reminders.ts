// Fristen-Erinnerungen für Herzensjobs (★).

import { daysUntil, todayBerlin } from './dates';

export const DEFAULT_REMINDER_DAYS = [30, 7, 1];

export interface ReminderCandidate {
  jobId: string;
  deadline: string | null | undefined;
  star: boolean;
}

export interface DueReminder {
  jobId: string;
  /** Erinnerungsstufe (z. B. 7 = "eine Woche vorher"). */
  days: number;
  daysLeft: number;
  /** Alle Stufen, die damit als erledigt gelten (größere, schon übersprungene Stufen inklusive). */
  covers: number[];
}

/**
 * Welche Erinnerungen sind heute fällig?
 * Pro Anzeige höchstens eine: die engste erreichte Stufe. Größere Stufen, die beim Markieren schon
 * vorbei waren, werden still als erledigt mitgezählt.
 */
export function dueReminders(
  items: readonly ReminderCandidate[],
  thresholds: readonly number[] = DEFAULT_REMINDER_DAYS,
  sent: ReadonlySet<string> = new Set(),
  today: string = todayBerlin(),
): DueReminder[] {
  const levels = [...new Set(thresholds.filter((t) => t >= 0))].sort((a, b) => b - a);
  const out: DueReminder[] = [];
  for (const it of items) {
    if (!it.star || !it.deadline) continue;
    const left = daysUntil(it.deadline, today);
    if (left == null || left < 0) continue;
    const reached = levels.filter((t) => left <= t);
    if (reached.length === 0) continue;
    const tightest = Math.min(...reached);
    if (sent.has(`${it.jobId}:${tightest}`)) continue;
    out.push({ jobId: it.jobId, days: tightest, daysLeft: left, covers: reached });
  }
  return out;
}

export function reminderText(daysLeft: number): string {
  if (daysLeft === 0) return 'Frist endet heute';
  if (daysLeft === 1) return 'Frist endet morgen';
  if (daysLeft <= 7) return `Frist endet in ${daysLeft} Tagen`;
  const weeks = Math.round(daysLeft / 7);
  if (daysLeft < 28) return weeks === 1 ? 'Frist endet in einer Woche' : `Frist endet in ${weeks} Wochen`;
  return `Frist endet in ${daysLeft} Tagen`;
}

// ---------------------------------------------------------------- Neue, sehr gut passende Anzeigen

/** Einstellung „notifyHighScore“: Benachrichtigung, wenn ein Lauf Anzeigen ab `min` Prozent bringt. */
export interface HighScoreAlert {
  on: boolean;
  min: number;
}

export const DEFAULT_HIGH_SCORE_ALERT: HighScoreAlert = { on: true, min: 85 };

export function parseHighScoreAlert(raw: unknown): HighScoreAlert {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<HighScoreAlert>;
  const min = typeof r.min === 'number' && r.min >= 50 && r.min <= 100 ? Math.round(r.min) : DEFAULT_HIGH_SCORE_ALERT.min;
  return { on: typeof r.on === 'boolean' ? r.on : DEFAULT_HIGH_SCORE_ALERT.on, min };
}

/**
 * Eine gebündelte Benachrichtigung pro Lauf: bei einer Anzeige direkt zu ihr, bei mehreren zur Liste
 * „Alle“ mit den drei besten im Text. Null, wenn keine neue Anzeige die Schwelle erreicht.
 */
export function highScoreDigest(jobs: readonly { id: string; title: string; score: number }[], min: number): { title: string; body: string; url: string; tag: string } | null {
  const hits = jobs.filter((j) => j.score >= min).sort((a, b) => b.score - a.score);
  if (hits.length === 0) return null;
  if (hits.length === 1) {
    const j = hits[0];
    return { title: `Neue Anzeige, passt zu ${j.score} %`, body: j.title, url: `/#/stelle/${encodeURIComponent(j.id)}`, tag: 'neu-passend' };
  }
  const top = hits.slice(0, 3).map((j) => `${j.score} % · ${j.title}`);
  const more = hits.length > 3 ? `\n… und ${hits.length - 3} weitere` : '';
  return { title: `${hits.length} neue Anzeigen ab ${min} %`, body: `${top.join('\n')}${more}`, url: '/#/alle', tag: 'neu-passend' };
}
