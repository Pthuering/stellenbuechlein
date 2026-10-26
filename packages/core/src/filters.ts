// Filter und Sortierung – vom Nutzer gesetzt, nie automatisch aus dem Steckbrief.

import { daysUntil } from './dates';
import { distanceKm } from './geo';
import type { City, Favorite, HomeLocation, Institution, InstitutionKind, Job, JobKind, Lane, StateCode } from './types';

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
  /** Nur diese Ringe (leer = alle). */
  lanes: Lane[];
  /** Nur Anzeigen von Websites, die beim Fund noch nicht im Register standen. */
  newSitesOnly: boolean;
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
  lanes: [],
  newSitesOnly: false,
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
  if (f.lanes?.length) n++;
  if (f.newSitesOnly) n++;
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
  /** Ring mit dem aktuellen Profil (laneOf); ohne Angabe gilt der Ring vom Einsammeln. */
  lane?: Lane,
): boolean {
  if (f.lanes?.length && !f.lanes.includes(lane ?? job.lane ?? 'kern')) return false;
  if (f.newSitesOnly && !job.newSite) return false;
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

/**
 * Reihenfolge im Stapel (vom Nutzer gesetzt): Sortiert wird immer nach Passung, die beste Karte zuerst. Mit minScore
 * kommen erst alle Karten ab dieser Passung, danach der Rest. Mit urgentFirst kommen in beiden Teilen die Karten mit
 * naher Frist (höchstens urgentDays Tage) vor den anderen.
 */
export interface DeckOrder {
  /** Passung in Prozent; null = keine Schwelle */
  minScore: number | null;
  urgentFirst: boolean;
  urgentDays: number;
}

export const DEFAULT_DECK_ORDER: DeckOrder = { minScore: null, urgentFirst: false, urgentDays: 30 };

export function parseDeckOrder(raw: unknown): DeckOrder {
  if (!raw || typeof raw !== 'object') return DEFAULT_DECK_ORDER;
  const r = raw as Partial<DeckOrder>;
  const score = typeof r.minScore === 'number' && r.minScore > 0 && r.minScore <= 100 ? Math.round(r.minScore) : null;
  const days = typeof r.urgentDays === 'number' && r.urgentDays >= 1 && r.urgentDays <= 365 ? Math.round(r.urgentDays) : DEFAULT_DECK_ORDER.urgentDays;
  return { minScore: score, urgentFirst: r.urgentFirst === true, urgentDays: days };
}

/** Ist die Frist nah (heute bis in urgentDays Tagen)? Ohne Frist: nein. */
export function isUrgent(deadline: string | null | undefined, days: number, today: string): boolean {
  const left = daysUntil(deadline, today);
  return left != null && left >= 0 && left <= days;
}

/** Teil des Stapels, in den eine Karte gehört; 0 kommt zuerst (gut passend und Frist nah, gut passend, Rest mit naher Frist, Rest). */
export function deckTier(p: { score: number; deadline: string | null | undefined }, o: DeckOrder, today: string): number {
  const high = o.minScore == null || p.score >= o.minScore;
  const urgent = o.urgentFirst && isUrgent(p.deadline, o.urgentDays, today);
  return (high ? 0 : 2) + (urgent ? 0 : 1);
}
