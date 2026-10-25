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

/** Sprachen der App-Oberfläche (Benachrichtigungen gibt es in allen dreien). */
export type UiLang = 'de' | 'en' | 'sr';
export const UI_LANGS: UiLang[] = ['de', 'en', 'sr'];

/**
 * Serbische Zahlform (ohne die Zahl): 1 oglas, 2–4 oglasa, 5 oglasa, 11 oglasa, 21 oglas, 22 oglasa.
 * Für Brüche (1,5) gilt die Form für viele.
 */
export function srForm(n: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(n)) return many;
  const i = Math.abs(n);
  const d = i % 10;
  const h = i % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

export function reminderText(daysLeft: number, lang: UiLang = 'de'): string {
  const weeks = Math.round(daysLeft / 7);
  const inWeeks = daysLeft > 7 && daysLeft < 28;
  if (lang === 'en') {
    if (daysLeft === 0) return 'Deadline is today';
    if (daysLeft === 1) return 'Deadline is tomorrow';
    if (inWeeks) return weeks === 1 ? 'Deadline in one week' : `Deadline in ${weeks} weeks`;
    return `Deadline in ${daysLeft} days`;
  }
  if (lang === 'sr') {
    if (daysLeft === 0) return 'Rok ističe danas';
    if (daysLeft === 1) return 'Rok ističe sutra';
    if (inWeeks) return weeks === 1 ? 'Rok ističe za nedelju dana' : `Rok ističe za ${weeks} ${srForm(weeks, 'nedelju', 'nedelje', 'nedelja')}`;
    return `Rok ističe za ${daysLeft} ${srForm(daysLeft, 'dan', 'dana', 'dana')}`;
  }
  if (daysLeft === 0) return 'Frist endet heute';
  if (daysLeft === 1) return 'Frist endet morgen';
  if (inWeeks) return weeks === 1 ? 'Frist endet in einer Woche' : `Frist endet in ${weeks} Wochen`;
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
export function highScoreDigest(jobs: readonly { id: string; title: string; score: number }[], min: number, lang: UiLang = 'de'): { title: string; body: string; url: string; tag: string } | null {
  const hits = jobs.filter((j) => j.score >= min).sort((a, b) => b.score - a.score);
  if (hits.length === 0) return null;
  const pct = (n: number) => (lang === 'de' ? `${n} %` : `${n}%`);
  if (hits.length === 1) {
    const j = hits[0];
    const title = lang === 'en' ? `New posting, ${pct(j.score)} match` : lang === 'sr' ? `Novi oglas, poklapanje ${pct(j.score)}` : `Neue Anzeige, passt zu ${pct(j.score)}`;
    return { title, body: j.title, url: `/#/stelle/${encodeURIComponent(j.id)}`, tag: 'neu-passend' };
  }
  const top = hits.slice(0, 3).map((j) => `${pct(j.score)} · ${j.title}`);
  const rest = hits.length - 3;
  const more = rest > 0 ? `\n… ${lang === 'en' ? `and ${rest} more` : lang === 'sr' ? `i još ${rest}` : `und ${rest} weitere`}` : '';
  const n = hits.length;
  const title =
    lang === 'en'
      ? `${n} new postings from ${pct(min)}`
      : lang === 'sr'
        ? `${n} ${srForm(n, 'novi oglas', 'nova oglasa', 'novih oglasa')} od ${pct(min)}`
        : `${n} neue Anzeigen ab ${pct(min)}`;
  return { title, body: `${top.join('\n')}${more}`, url: '/#/alle', tag: 'neu-passend' };
}
