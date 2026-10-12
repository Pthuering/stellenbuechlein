// Anzeige-Texte für Fristen, Orte, Fakten.

import { daysUntil, formatDateDe, formatKm, JOB_KIND_LABELS, todayBerlin, type City, type DeadlineCheck, type Institution, type Job, type LaneInfo } from '@stellen/core';
import { TEST_PHOTO_CREDIT, testPhotoFor } from '../data/testPhotos';

export function deadlineInfo(deadline: string | null | undefined, today = todayBerlin()): { date: string; left: string; urgent: boolean; past: boolean } | null {
  if (!deadline) return null;
  const d = daysUntil(deadline, today)!;
  const date = formatDateDe(deadline);
  let left: string;
  if (d < 0) left = d === -1 ? 'gestern abgelaufen' : `seit ${-d} Tagen abgelaufen`;
  else if (d === 0) left = 'endet heute';
  else if (d === 1) left = 'endet morgen';
  else left = `noch ${d} Tage`;
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
    return { date: null, left: 'Frist unklar', urgent: false, past: false, unsure: true, check, note };
  }
  const base = deadlineInfo(job.deadline, today)!;
  return { ...base, unsure: check === 'unsicher', check, note };
}

/** Kurztext zur Prüfung einer Frist, für Karte und Detail. */
export function deadlineCheckText(d: DeadlineView): string | null {
  if (d.check === 'unsicher') return `Frist unsicher${d.note ? `: ${d.note}` : ''}. Bitte im Original prüfen.`;
  if (d.check === 'jahr') return 'Jahr ergänzt, im Text stand die Frist ohne Jahr';
  if (d.check === 'ki') return `von der KI im Text nachgeprüft${d.note ? `: ${d.note}` : ''}`;
  return null;
}

/** Etikett für Horizont- und Weite-Anzeigen. */
export function laneLabel(l: LaneInfo): string | null {
  if (l.lane === 'kern') return null;
  if (l.lane === 'weite') return l.label ? `Weite: ${l.label}` : 'Weite';
  return l.label ? `Horizont: ${l.label}` : 'Horizont';
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.`;
}

export function institutionName(inst: Institution | undefined, short = false): string {
  if (!inst) return 'Unbekannte Einrichtung';
  return short ? (inst.shortName ?? inst.name) : inst.name;
}

/** Einrichtung aus dem Register, sonst der Arbeitgeber laut Anzeige. */
export function employerName(job: Pick<Job, 'employer'>, inst: Institution | undefined, short = false): string {
  if (inst) return institutionName(inst, short);
  return job.employer?.trim() || 'Arbeitgeber unbekannt';
}

export function placeLabel(city: City | undefined, km: number | null): { city: string; km: string } {
  return { city: city?.name ?? 'Ort unbekannt', km: km != null ? formatKm(km) : '' };
}

export function kindLabel(job: Job): string | null {
  return job.kind && job.kind !== 'sonstige' ? JOB_KIND_LABELS[job.kind] : null;
}

export type ChipTone = 'primary' | 'neutral' | 'plain';

/** Höchstens drei Chips auf der Karte: Stellenart (Primärrolle), Entgelt und Umfang zusammen, Befristung. */
export function factChips(job: Job): { text: string; tone: ChipTone }[] {
  const out: { text: string; tone: ChipTone }[] = [];
  const k = kindLabel(job);
  if (k) out.push({ text: k, tone: 'primary' });
  const workload = job.workloadPct ? `${job.workloadPct} %` : job.workloadText;
  const frame = [job.payGrade, workload].filter(Boolean).join(', ');
  if (frame) out.push({ text: frame, tone: 'neutral' });
  if (job.isPermanent === true) out.push({ text: 'unbefristet', tone: 'neutral' });
  else if (job.fixedTerm) out.push({ text: job.fixedTerm.replace(/\s*\(.*\)$/, '').slice(0, 28), tone: 'plain' });
  return out;
}

/** Bild in der Reihenfolge Anzeige → Einrichtung → Stadt → (nur Demo) Testfoto; null = Skizze zeigen. */
export function jobImage(job: Job, inst: Institution | undefined, city: City | undefined, testPhotos: string[]): { src: string | null; credit: string | null } {
  const base = imageFor(job, inst, city);
  if (base.src || testPhotos.length === 0) return base;
  return { src: testPhotoFor(testPhotos, inst?.id ?? city?.id ?? job.id), credit: TEST_PHOTO_CREDIT };
}

export function imageFor(job: Job, inst: Institution | undefined, city: City | undefined): { src: string | null; credit: string | null } {
  if (job.imageUrl) return { src: job.imageUrl, credit: job.imageCredit ?? 'Bild aus der Anzeige' };
  if (inst?.imageUrl) return { src: inst.imageUrl, credit: inst.imageCredit ?? null };
  if (city?.imageUrl) return { src: city.imageUrl, credit: city.imageCredit ?? null };
  return { src: null, credit: null };
}

const METHODS: Record<string, string> = {
  liste: 'Stellenliste',
  browser: 'Browser',
  sitemap: 'Sitemap',
  feed: 'Feed',
  'json-feed': 'JSON-Feed',
  'feed (auf Seite gefunden)': 'Feed (auf der Seite verlinkt)',
  'ki-links': 'KI-Linkauswahl',
  pdf: 'PDF',
  'ba-api': 'Jobsuche der Arbeitsagentur',
};

/** Wie die Pipeline die Anzeigen gefunden hat, in Worten. */
export function methodLabel(m: string): string {
  if (METHODS[m]) return METHODS[m];
  const ats = /^ats:(\w+)/.exec(m);
  if (ats) return `Bewerbersystem ${ats[1][0].toUpperCase()}${ats[1].slice(1)}`;
  return m;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'noch nie';
  const diff = Date.now() - Date.parse(iso);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
