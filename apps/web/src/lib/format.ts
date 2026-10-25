// Anzeige-Texte für Fristen, Orte, Fakten.

import { daysUntil, todayBerlin, type City, type DeadlineCheck, type Institution, type Job, type LaneInfo } from '@stellen/core';
import { testPhotoCredit, testPhotoFor } from '../data/testPhotos';
import { fmtDate, fmtDayMonth, fmtKm, fmtPct, lang, srForm, texts } from '../i18n';
import { jobKindLabel, laneName } from '../i18n/labels';
import { profileLabel } from '../i18n/katalog';

const t = texts({
  de: {
    expiredYesterday: 'gestern abgelaufen',
    expiredDaysAgo: (n: number) => `seit ${n} Tagen abgelaufen`,
    endsToday: 'endet heute',
    endsTomorrow: 'endet morgen',
    daysLeft: (n: number) => `noch ${n} Tage`,
    deadlineUnclear: 'Frist unklar',
    checkUnsure: (note: string | null) => `Frist unsicher${note ? `: ${note}` : ''}. Bitte im Original prüfen.`,
    checkYear: 'Jahr ergänzt, im Text stand die Frist ohne Jahr',
    checkAi: (note: string | null) => `von der KI im Text nachgeprüft${note ? `: ${note}` : ''}`,
    unknownInstitution: 'Unbekannte Einrichtung',
    unknownEmployer: 'Arbeitgeber unbekannt',
    unknownPlace: 'Ort unbekannt',
    permanent: 'unbefristet',
    imageFromPosting: 'Bild aus der Anzeige',
    never: 'noch nie',
    justNow: 'gerade eben',
    minutesAgo: (n: number) => `vor ${n} Min.`,
    hoursAgo: (n: number) => `vor ${n} Std.`,
    yesterday: 'gestern',
    daysAgo: (n: number) => `vor ${n} Tagen`,
    methods: {
      liste: 'Stellenliste',
      browser: 'Browser',
      sitemap: 'Sitemap',
      feed: 'Feed',
      'json-feed': 'JSON-Feed',
      'feed (auf Seite gefunden)': 'Feed (auf der Seite verlinkt)',
      'ki-links': 'KI-Linkauswahl',
      pdf: 'PDF',
      'ba-api': 'Jobsuche der Arbeitsagentur',
    } as Record<string, string>,
    ats: (name: string) => `Bewerbersystem ${name}`,
  },
  en: {
    expiredYesterday: 'expired yesterday',
    expiredDaysAgo: (n) => `expired ${n} days ago`,
    endsToday: 'ends today',
    endsTomorrow: 'ends tomorrow',
    daysLeft: (n) => `${n} days left`,
    deadlineUnclear: 'Deadline unclear',
    checkUnsure: (note) => `Deadline uncertain${note ? `: ${note}` : ''}. Please check the original.`,
    checkYear: 'Year added; the posting gave the deadline without a year',
    checkAi: (note) => `double-checked in the text by the AI${note ? `: ${note}` : ''}`,
    unknownInstitution: 'Unknown institution',
    unknownEmployer: 'Employer unknown',
    unknownPlace: 'Location unknown',
    permanent: 'permanent',
    imageFromPosting: 'Image from the posting',
    never: 'never',
    justNow: 'just now',
    minutesAgo: (n) => `${n} min ago`,
    hoursAgo: (n) => `${n} h ago`,
    yesterday: 'yesterday',
    daysAgo: (n) => `${n} days ago`,
    methods: {
      liste: 'Job list',
      browser: 'Browser',
      sitemap: 'Sitemap',
      feed: 'Feed',
      'json-feed': 'JSON feed',
      'feed (auf Seite gefunden)': 'Feed (linked on the page)',
      'ki-links': 'AI link selection',
      pdf: 'PDF',
      'ba-api': 'Federal Employment Agency job search',
    },
    ats: (name) => `Applicant system ${name}`,
  },
  sr: {
    expiredYesterday: 'isteklo juče',
    expiredDaysAgo: (n) => `isteklo pre ${n} ${srForm(n, 'dan', 'dana', 'dana')}`,
    endsToday: 'ističe danas',
    endsTomorrow: 'ističe sutra',
    daysLeft: (n) => `još ${n} ${srForm(n, 'dan', 'dana', 'dana')}`,
    deadlineUnclear: 'Rok nejasan',
    checkUnsure: (note) => `Rok nije siguran${note ? `: ${note}` : ''}. Proveri u originalu.`,
    checkYear: 'Godina je dopunjena, u tekstu je rok naveden bez godine',
    checkAi: (note) => `dodatno provereno u tekstu pomoću AI${note ? `: ${note}` : ''}`,
    unknownInstitution: 'Nepoznata ustanova',
    unknownEmployer: 'Poslodavac nepoznat',
    unknownPlace: 'Mesto nepoznato',
    permanent: 'na neodređeno',
    imageFromPosting: 'Slika iz oglasa',
    never: 'nikad',
    justNow: 'upravo sada',
    minutesAgo: (n) => `pre ${n} min`,
    hoursAgo: (n) => `pre ${n} h`,
    yesterday: 'juče',
    daysAgo: (n) => `pre ${n} ${srForm(n, 'dan', 'dana', 'dana')}`,
    methods: {
      liste: 'Lista oglasa',
      browser: 'Pregledač',
      sitemap: 'Mapa sajta',
      feed: 'Fid',
      'json-feed': 'JSON fid',
      'feed (auf Seite gefunden)': 'Fid (povezan na stranici)',
      'ki-links': 'AI izbor linkova',
      pdf: 'PDF',
      'ba-api': 'Pretraga poslova Savezne agencije za zapošljavanje',
    },
    ats: (name) => `Sistem za prijave ${name}`,
  },
});

export function deadlineInfo(deadline: string | null | undefined, today = todayBerlin()): { date: string; left: string; urgent: boolean; past: boolean } | null {
  if (!deadline) return null;
  const d = daysUntil(deadline, today)!;
  const date = fmtDate(deadline);
  let left: string;
  if (d < 0) left = d === -1 ? t.expiredYesterday : t.expiredDaysAgo(-d);
  else if (d === 0) left = t.endsToday;
  else if (d === 1) left = t.endsTomorrow;
  else left = t.daysLeft(d);
  return { date, left, urgent: d >= 0 && d <= 14, past: d < 0 };
}

export interface DeadlineView {
  /** "15.11.2026" oder null, wenn die Frist unklar ist */
  date: string | null;
  left: string;
  urgent: boolean;
  past: boolean;
  /** Bitte im Original prüfen */
  unsure: boolean;
  check: DeadlineCheck | null;
  note: string | null;
}

/** Frist einer Anzeige samt Prüfvermerk; null = keine Frist angegeben. */
export function deadlineOf(job: Pick<Job, 'deadline' | 'deadlineCheck' | 'deadlineNote' | 'deadlineText'>, today = todayBerlin()): DeadlineView | null {
  const check = job.deadlineCheck ?? null;
  const note = job.deadlineNote ?? null;
  if (!job.deadline) {
    if (check !== 'unsicher') return null;
    return { date: null, left: t.deadlineUnclear, urgent: false, past: false, unsure: true, check, note };
  }
  const base = deadlineInfo(job.deadline, today)!;
  return { ...base, unsure: check === 'unsicher', check, note };
}

/** Kurztext zur Prüfung einer Frist, für Karte und Detail. Die Notiz stammt aus der Anzeige bzw. der KI und bleibt, wie sie ist. */
export function deadlineCheckText(d: DeadlineView): string | null {
  if (d.check === 'unsicher') return t.checkUnsure(d.note);
  if (d.check === 'jahr') return t.checkYear;
  if (d.check === 'ki') return t.checkAi(d.note);
  return null;
}

/** Etikett für Horizont- und Weite-Anzeigen. */
export function laneLabel(l: LaneInfo): string | null {
  if (l.lane === 'kern') return null;
  const name = laneName(l.lane);
  return l.label ? `${name}: ${profileLabel(l.label)}` : name;
}

/** „15.11.“ (Tag und Monat in der Sprache der App) */
export function shortDate(iso: string | null | undefined): string {
  return fmtDayMonth(iso);
}

export function institutionName(inst: Institution | undefined, short = false): string {
  if (!inst) return t.unknownInstitution;
  return short ? (inst.shortName ?? inst.name) : inst.name;
}

/** Einrichtung aus dem Register, sonst der Arbeitgeber laut Anzeige. */
export function employerName(job: Pick<Job, 'employer'>, inst: Institution | undefined, short = false): string {
  if (inst) return institutionName(inst, short);
  return job.employer?.trim() || t.unknownEmployer;
}

export function placeLabel(city: City | undefined, km: number | null): { city: string; km: string } {
  return { city: city?.name ?? t.unknownPlace, km: km != null ? fmtKm(km) : '' };
}

/** „Ort unbekannt“ */
export function unknownPlace(): string {
  return t.unknownPlace;
}

export function kindLabel(job: Job): string | null {
  return job.kind && job.kind !== 'sonstige' ? jobKindLabel(job.kind) : null;
}

export type ChipTone = 'primary' | 'neutral' | 'plain';

/**
 * Höchstens drei Chips auf der Karte: Stellenart (Primärrolle), Entgelt und Umfang zusammen, Befristung.
 * Entgeltgruppe, Umfang-Text und Befristung stammen aus der Anzeige und bleiben im Original.
 */
export function factChips(job: Job): { text: string; tone: ChipTone }[] {
  const out: { text: string; tone: ChipTone }[] = [];
  const k = kindLabel(job);
  if (k) out.push({ text: k, tone: 'primary' });
  const workload = job.workloadPct ? fmtPct(job.workloadPct) : job.workloadText;
  const frame = [job.payGrade, workload].filter(Boolean).join(', ');
  if (frame) out.push({ text: frame, tone: 'neutral' });
  if (job.isPermanent === true) out.push({ text: t.permanent, tone: 'neutral' });
  else if (job.fixedTerm) out.push({ text: job.fixedTerm.replace(/\s*\(.*\)$/, '').slice(0, 28), tone: 'plain' });
  return out;
}

/** Bild in der Reihenfolge Anzeige → Einrichtung → Stadt → (nur Demo) Testfoto; null = Skizze zeigen. */
export function jobImage(job: Job, inst: Institution | undefined, city: City | undefined, testPhotos: string[]): { src: string | null; credit: string | null } {
  const base = imageFor(job, inst, city);
  if (base.src || testPhotos.length === 0) return base;
  return { src: testPhotoFor(testPhotos, inst?.id ?? city?.id ?? job.id), credit: testPhotoCredit() };
}

export function imageFor(job: Job, inst: Institution | undefined, city: City | undefined): { src: string | null; credit: string | null } {
  if (job.imageUrl) return { src: job.imageUrl, credit: job.imageCredit ?? t.imageFromPosting };
  if (inst?.imageUrl) return { src: inst.imageUrl, credit: inst.imageCredit ?? null };
  if (city?.imageUrl) return { src: city.imageUrl, credit: city.imageCredit ?? null };
  return { src: null, credit: null };
}

/** Wie die Pipeline die Anzeigen gefunden hat, in Worten. */
export function methodLabel(m: string): string {
  if (t.methods[m]) return t.methods[m];
  const ats = /^ats:(\w+)/.exec(m);
  if (ats) return t.ats(`${ats[1][0].toUpperCase()}${ats[1].slice(1)}`);
  return m;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return t.never;
  const diff = Date.now() - Date.parse(iso);
  const min = Math.round(diff / 60000);
  if (min < 1) return t.justNow;
  if (min < 60) return t.minutesAgo(min);
  const h = Math.round(min / 60);
  if (h < 24) return t.hoursAgo(h);
  const d = Math.round(h / 24);
  return d === 1 ? t.yesterday : t.daysAgo(d);
}

/**
 * Zahl mit Wort: plural(3, 'Quelle', 'Quellen') → „3 Quellen“.
 * Für Englisch und Serbisch die Formen der Sprache übergeben: plural(n, one, many, few) – `few` nur Serbisch (2–4).
 */
export function plural(n: number, one: string, many: string, few = many): string {
  if (lang() === 'sr') return `${n} ${srForm(n, one, few, many)}`;
  return `${n} ${n === 1 ? one : many}`;
}
