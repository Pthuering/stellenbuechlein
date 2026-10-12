// Fristen absichern. Grundsatz: Eine Anzeige gilt nur als offen, solange ihre Frist nicht vorbei ist,
// und eine Frist wird nur dann als sicher gezeigt, wenn sie plausibel ist. Alles Zweifelhafte wird als
// „unsicher“ markiert (und beim Einsammeln von der KI nachgeprüft), statt still falsch zu sein.

import { addDays, daysBetween, isoDate, pad2 } from './dates';
import type { DeadlineCheck, Job } from './types';

/** Ab so vielen Tagen in der Zukunft ist eine Frist ungewöhnlich und wird nachgeprüft. */
export const DEADLINE_MAX_AHEAD_DAYS = 240;

export const DEADLINE_CHECK_LABELS: Record<DeadlineCheck, string> = {
  ok: 'aus der Anzeige',
  jahr: 'Jahr ergänzt',
  ki: 'von der KI im Text nachgeprüft',
  unsicher: 'unsicher, bitte im Original prüfen',
};

function dateOnly(s: string | null | undefined): string | null {
  const m = s ? /^(\d{4}-\d{2}-\d{2})/.exec(s) : null;
  return m ? m[1] : null;
}

/**
 * Ergänzt das Jahr zu einer Frist ohne Jahresangabe („bis zum 15.11.“).
 * Bezugspunkt ist das Veröffentlichungsdatum, sonst der Tag des Fundes.
 *  - Liegt das Datum im Jahr des Bezugs höchstens 45 Tage davor, gilt dieses Jahr
 *    (dann ist die Anzeige vermutlich schon abgelaufen).
 *  - Sonst das folgende Jahr, wenn das höchstens 150 Tage voraus ist (Dezember → Januar).
 *  - Alles andere ist mehrdeutig: null.
 */
export function inferYear(day: number, month: number, reference: string): string | null {
  const y = Number(reference.slice(0, 4));
  const thisYear = isoDate(y, month, day);
  if (thisYear && thisYear >= addDays(reference, -45)) return thisYear;
  const nextYear = isoDate(y + 1, month, day);
  if (nextYear && nextYear <= addDays(reference, 150)) return nextYear;
  return null;
}

export interface DeadlineInput {
  /** Frist aus dem Anzeigentext (ISO) */
  iso: string | null;
  /** Wortlaut im Text */
  raw: string | null;
  yearInferred?: boolean;
  /** Fristhinweis, der sich keinem Datum sicher zuordnen ließ */
  unclear?: string | null;
  /** strukturierte Angabe der Seite (JSON-LD validThrough) */
  structured?: string | null;
  postedAt?: string | null;
  today: string;
  /** Die Anzeige wird gerade zum ersten Mal gefunden. */
  isNew?: boolean;
}

export interface DeadlineAssessment {
  deadline: string | null;
  check: DeadlineCheck | null;
  note: string | null;
  /** Die KI soll im Text nachsehen. */
  review: boolean;
}

/** Prüft eine gefundene Frist auf Plausibilität. */
export function assessDeadline(i: DeadlineInput): DeadlineAssessment {
  let iso = i.iso;
  let check: DeadlineCheck | null = iso ? (i.yearInferred ? 'jahr' : 'ok') : null;
  let note: string | null = iso && i.yearInferred && i.raw ? `im Text ohne Jahr („${i.raw}“)` : null;
  const structured = dateOnly(i.structured);
  let structuredOnly = false;

  if (!iso && i.unclear) {
    return { deadline: null, check: 'unsicher', note: `„${i.unclear}“ steht ohne Jahr im Text und ist nicht eindeutig`, review: true };
  }
  if (!iso && structured) {
    // Nur strukturiert angegeben: Viele Systeme setzen hier ein Ablaufdatum der Seite, nicht die Bewerbungsfrist.
    iso = structured;
    check = 'ok';
    note = 'aus den Seitendaten, nicht aus dem Anzeigentext';
    structuredOnly = true;
  }
  if (!iso) return { deadline: null, check: null, note: null, review: false };

  const posted = dateOnly(i.postedAt);
  const ahead = daysBetween(i.today, iso);

  if (posted && iso < posted) {
    // Eine Frist vor der Veröffentlichung kann nicht stimmen. Sichtbar lassen, aber ohne Datum.
    return { deadline: null, check: 'unsicher', note: `das Datum ${fmt(iso)} liegt vor der Veröffentlichung (${fmt(posted)})`, review: true };
  }
  if (ahead > DEADLINE_MAX_AHEAD_DAYS) {
    if (structuredOnly) return { deadline: null, check: null, note: null, review: false };
    return { deadline: iso, check: 'unsicher', note: `liegt ungewöhnlich weit in der Zukunft (${fmt(iso)})`, review: true };
  }
  if (ahead < 0) {
    // Vermutlicher Tippfehler im Jahr (oft im Januar): vor knapp einem Jahr, ein Jahr später aber bald
    const next = sameDayNextYear(iso);
    const typo = ahead < -300 && next >= i.today && daysBetween(i.today, next) <= 120 && (!posted || daysBetween(posted, i.today) <= 60);
    if (typo && i.isNew) {
      return { deadline: next, check: 'unsicher', note: `im Text steht ${fmt(iso)}, gemeint ist vermutlich ${fmt(next)}`, review: true };
    }
    // Nur die Seitendaten sagen „abgelaufen“, im Text steht keine Frist: lieber die KI fragen als still verstecken
    if (structuredOnly && i.isNew) return { deadline: null, check: null, note: null, review: true };
    // Schon beim Fund vorbei: Die KI sieht nach, ob die Frist verlängert wurde oder sich verschrieben wurde.
    return { deadline: iso, check, note, review: !!i.isNew };
  }
  return { deadline: iso, check, note, review: false };
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function sameDayNextYear(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(y + 1, m, d) ?? `${y + 1}-${pad2(m)}-${pad2(Math.min(d, 28))}`;
}

/**
 * Prüft die Antwort der KI gegen den Text: Das Zitat muss wörtlich vorkommen und Tag und Monat der
 * genannten Frist enthalten. So kann die KI keine Frist erfinden.
 */
export function verifyDeadlineQuote(text: string, iso: string, quote: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !quote || quote.length < 4) return false;
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const q = squash(quote);
  if (!squash(text).includes(q)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dayRe = new RegExp(`(?<!\\d)0?${d}(?!\\d)`);
  if (!dayRe.test(q)) return false;
  const monthNames: Record<number, string[]> = {
    1: ['jan'], 2: ['feb'], 3: ['mär', 'maer', 'mrz', 'mar'], 4: ['apr'], 5: ['mai', 'may'], 6: ['jun'],
    7: ['jul'], 8: ['aug'], 9: ['sep'], 10: ['okt', 'oct'], 11: ['nov'], 12: ['dez', 'dec'],
  };
  const monthOk = new RegExp(`(?<!\\d)0?${d}\\.\\s?0?${m}\\.`).test(q) || new RegExp(`(?<!\\d)${y}-${pad2(m)}-${pad2(d)}`).test(q) || monthNames[m].some((n) => q.includes(n));
  if (!monthOk) return false;
  // Steht ein Jahr im Zitat, muss es das genannte sein
  const years: string[] = q.match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g) ?? [];
  const shortYear = new RegExp(`(?<!\\d)${d}\\.\\s?0?${m}\\.\\s?${String(y).slice(2)}(?!\\d)`).test(q);
  return years.length === 0 ? true : years.includes(String(y)) || shortYear;
}

/** Ist die Anzeige noch offen? Abgelaufen, wenn die Pipeline sie so markiert hat oder die Frist vorbei ist. */
export function isOpen(job: Pick<Job, 'status' | 'deadline'>, today: string): boolean {
  if (job.status !== 'aktiv') return false;
  return !job.deadline || job.deadline >= today;
}
