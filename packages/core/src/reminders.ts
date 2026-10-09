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
  if (daysLeft < 28) return `Frist endet in ${weeks} Wochen`;
  return `Frist endet in ${daysLeft} Tagen`;
}
