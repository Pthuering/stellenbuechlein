// Anzeige-Texte für Fristen, Orte, Fakten.

import { daysUntil, formatDateDe, formatKm, JOB_KIND_LABELS, todayBerlin, type City, type Institution, type Job } from '@stellen/core';

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

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.`;
}

export function institutionName(inst: Institution | undefined, short = false): string {
  if (!inst) return 'Unbekannte Einrichtung';
  return short ? (inst.shortName ?? inst.name) : inst.name;
}

export function placeLabel(city: City | undefined, km: number | null): { city: string; km: string } {
  return { city: city?.name ?? 'Ort unbekannt', km: km != null ? formatKm(km) : '' };
}

export function kindLabel(job: Job): string | null {
  return job.kind && job.kind !== 'sonstige' ? JOB_KIND_LABELS[job.kind] : null;
}

export function factChips(job: Job): { text: string; tone: 'rosa' | 'lavendel' | 'minze' | 'butter' | 'pfirsich' }[] {
  const out: { text: string; tone: 'rosa' | 'lavendel' | 'minze' | 'butter' | 'pfirsich' }[] = [];
  const k = kindLabel(job);
  if (k) out.push({ text: k, tone: 'rosa' });
  if (job.payGrade) out.push({ text: job.payGrade, tone: 'lavendel' });
  if (job.workloadPct) out.push({ text: `${job.workloadPct} %`, tone: 'minze' });
  else if (job.workloadText) out.push({ text: job.workloadText, tone: 'minze' });
  if (job.isPermanent === true) out.push({ text: 'unbefristet', tone: 'butter' });
  else if (job.fixedTerm) out.push({ text: job.fixedTerm.replace(/\s*\(.*\)$/, '').slice(0, 28), tone: 'pfirsich' });
  return out;
}

export function imageFor(job: Job, inst: Institution | undefined, city: City | undefined): { src: string | null; credit: string | null } {
  if (job.imageUrl) return { src: job.imageUrl, credit: job.imageCredit ?? 'Bild aus der Anzeige' };
  if (inst?.imageUrl) return { src: inst.imageUrl, credit: inst.imageCredit ?? null };
  if (city?.imageUrl) return { src: city.imageUrl, credit: city.imageCredit ?? null };
  return { src: null, credit: null };
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
