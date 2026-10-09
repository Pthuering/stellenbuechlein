// Filter und Sortierung – vom Nutzer gesetzt, nie automatisch aus dem Steckbrief.

import { daysUntil } from './dates';
import { distanceKm } from './geo';
import type { City, Favorite, HomeLocation, Institution, InstitutionKind, Job, JobKind, StateCode } from './types';

export interface JobFilter {
  /** null = ganz Deutschland */
  radiusKm: number | null;
  states: StateCode[];
  kinds: JobKind[];
  institutionKinds: InstitutionKind[];
  payMin: number | null;
  workloadMin: number | null;
  permanentOnly: boolean;
  /** Nur Stellen, deren Frist noch mindestens so viele Tage entfernt ist (ohne Frist bleibt drin). */
  minDaysLeft: number | null;
  text: string;
}

export const DEFAULT_FILTER: JobFilter = {
  radiusKm: null,
  states: [],
  kinds: [],
  institutionKinds: [],
  payMin: null,
  workloadMin: null,
  permanentOnly: false,
  minDaysLeft: null,
  text: '',
};

export function countActiveFilters(f: JobFilter): number {
  let n = 0;
  if (f.radiusKm != null) n++;
  if (f.states.length) n++;
  if (f.kinds.length) n++;
  if (f.institutionKinds.length) n++;
  if (f.payMin != null) n++;
  if (f.workloadMin != null) n++;
  if (f.permanentOnly) n++;
  if (f.minDaysLeft != null) n++;
  if (f.text.trim()) n++;
  return n;
}

export interface GeoContext {
  home: HomeLocation;
  institutions: Map<string, Institution>;
  cities: Map<string, City>;
}

export interface JobPlace {
  lat: number | null;
  lon: number | null;
  cityId: string | null;
  state: StateCode | null;
  distanceKm: number | null;
}

/** Ort einer Anzeige: eigene Koordinaten, sonst die der Einrichtung, sonst die der Stadt. */
export function placeOf(job: Pick<Job, 'lat' | 'lon' | 'cityId' | 'institutionId'>, ctx: GeoContext): JobPlace {
  const inst = job.institutionId ? ctx.institutions.get(job.institutionId) : undefined;
  const cityId = job.cityId ?? inst?.cityId ?? null;
  const city = cityId ? ctx.cities.get(cityId) : undefined;
  const lat = job.lat ?? inst?.lat ?? city?.lat ?? null;
  const lon = job.lon ?? inst?.lon ?? city?.lon ?? null;
  const distance = lat != null && lon != null ? distanceKm(ctx.home.lat, ctx.home.lon, lat, lon) : null;
  return { lat, lon, cityId, state: city?.state ?? null, distanceKm: distance };
}

export function passesFilter(
  job: Job,
  f: JobFilter,
  place: JobPlace,
  ctx: GeoContext,
  normText: string,
  today: string,
): boolean {
  if (f.radiusKm != null && (place.distanceKm == null || place.distanceKm > f.radiusKm)) return false;
  if (f.states.length && (!place.state || !f.states.includes(place.state))) return false;
  if (f.kinds.length && (!job.kind || !f.kinds.includes(job.kind))) return false;
  if (f.institutionKinds.length) {
    const inst = job.institutionId ? ctx.institutions.get(job.institutionId) : undefined;
    if (!inst || !f.institutionKinds.includes(inst.kind)) return false;
  }
  if (f.payMin != null && job.payLevel != null && job.payLevel < f.payMin) return false;
  if (f.workloadMin != null && job.workloadPct != null && job.workloadPct < f.workloadMin) return false;
  if (f.permanentOnly && job.isPermanent !== true) return false;
  if (f.minDaysLeft != null) {
    const d = daysUntil(job.deadline, today);
    if (d != null && d < f.minDaysLeft) return false;
  }
  const q = f.text.trim();
  if (q) {
    const words = q
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .split(/\s+/)
      .filter(Boolean);
    const inst = job.institutionId ? ctx.institutions.get(job.institutionId) : undefined;
    const city = place.cityId ? ctx.cities.get(place.cityId) : undefined;
    const hay = `${normText} ${(inst?.name ?? '').toLowerCase()} ${(city?.name ?? '').toLowerCase()}`
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    if (!words.every((w) => hay.includes(w))) return false;
  }
  return true;
}

export function favoriteKeySet(favs: readonly Favorite[]): Set<string> {
  return new Set(favs.map((f) => `${f.kind}:${f.ref}`));
}

/** Gehört die Anzeige zu einem Lieblingsort (Bundesland, Stadt oder Einrichtung)? */
export function isFavoritePlace(job: Pick<Job, 'institutionId'>, place: JobPlace, favKeys: Set<string>): boolean {
  if (favKeys.size === 0) return false;
  if (job.institutionId && favKeys.has(`institution:${job.institutionId}`)) return true;
  if (place.cityId && favKeys.has(`city:${place.cityId}`)) return true;
  if (place.state && favKeys.has(`state:${place.state}`)) return true;
  return false;
}

export type SortKey = 'empfohlen' | 'frist' | 'neu' | 'entfernung';

export const SORT_LABELS: Record<SortKey, string> = {
  empfohlen: 'Lieblingsorte & Score',
  frist: 'Frist zuerst',
  neu: 'Neueste zuerst',
  entfernung: 'Nächste zuerst',
};

export interface SortableJob {
  job: Job;
  score: number;
  favorite: boolean;
  distanceKm: number | null;
}

export function compareJobs(a: SortableJob, b: SortableJob, key: SortKey): number {
  const deadlineCmp = (x: SortableJob, y: SortableJob) => {
    const dx = x.job.deadline ?? '9999-12-31';
    const dy = y.job.deadline ?? '9999-12-31';
    return dx < dy ? -1 : dx > dy ? 1 : 0;
  };
  switch (key) {
    case 'empfohlen':
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return deadlineCmp(a, b);
    case 'frist': {
      const c = deadlineCmp(a, b);
      return c !== 0 ? c : b.score - a.score;
    }
    case 'neu':
      return a.job.firstSeenAt < b.job.firstSeenAt ? 1 : a.job.firstSeenAt > b.job.firstSeenAt ? -1 : b.score - a.score;
    case 'entfernung': {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return da !== db ? da - db : b.score - a.score;
    }
  }
}
