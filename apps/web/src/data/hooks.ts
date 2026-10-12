// React-Anbindung: Zustand lesen und abgeleitete Ansichten (Score, Ort, Lieblingsort) berechnen.

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import {
  compareHorizon,
  compareJobs,
  favoriteKeySet,
  horizontOf,
  interleave,
  isFavoritePlace,
  isOpen,
  isThematic,
  laneOf,
  passesFilter,
  placeOf,
  scoreJob,
  searchTextOf,
  todayBerlin,
  type GeoContext,
  type Horizont,
  type Job,
  type JobFilter,
  type JobPlace,
  type LaneInfo,
  type Mark,
  type ScoreResult,
  type SortKey,
  type Suchprofil,
} from '@stellen/core';
import type { SavedSort, State, Store } from './store';

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('Store fehlt');
  return s;
}

export function useAppState(): State {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export interface JobView {
  job: Job;
  place: JobPlace;
  score: ScoreResult;
  favorite: boolean;
  mark: Mark | undefined;
  norm: string;
  /** Ring mit dem aktuellen Profil: Kern, Horizont (Brücke) oder Weite */
  lane: LaneInfo;
}

// Normalisierter Suchtext pro Anzeigen-Objekt (ändert sich nur, wenn die Anzeige neu geladen wird)
const normCache = new WeakMap<Job, string>();
function normOf(job: Job): string {
  let n = normCache.get(job);
  if (n == null) {
    n = searchTextOf(job);
    normCache.set(job, n);
  }
  return n;
}

// Score-Cache: pro Anzeige und Profil
const scoreCache = new WeakMap<Job, { profile: Suchprofil; result: ScoreResult }>();
function scoreOf(job: Job, profile: Suchprofil): ScoreResult {
  const hit = scoreCache.get(job);
  if (hit && hit.profile === profile) return hit.result;
  const result = scoreJob(job, normOf(job), profile);
  scoreCache.set(job, { profile, result });
  return result;
}

// Ring-Cache: pro Anzeige und Profil (Kernthemen und Brücken stehen im Profil)
const laneCache = new WeakMap<Job, { p: Suchprofil; info: LaneInfo }>();
function laneFor(job: Job, p: Suchprofil, h: Horizont): LaneInfo {
  const hit = laneCache.get(job);
  if (hit && hit.p === p) return hit.info;
  const norm = normOf(job);
  const info = laneOf(job, norm, h, isThematic(job, norm, p));
  laneCache.set(job, { p, info });
  return info;
}

export function useGeo(): GeoContext {
  const s = useAppState();
  return useMemo(() => ({ home: s.settings.home, institutions: s.institutions, cities: s.cities }), [s.settings.home, s.institutions, s.cities]);
}

/** Alle Anzeigen mit Score, Ort und Markierung. */
export function useViews(): Map<string, JobView> {
  const s = useAppState();
  const geo = useGeo();
  return useMemo(() => {
    const favKeys = favoriteKeySet(s.favorites);
    const h = horizontOf(s.settings.profile);
    const out = new Map<string, JobView>();
    for (const job of s.jobs.values()) {
      const place = placeOf(job, geo);
      out.set(job.id, {
        job,
        place,
        score: scoreOf(job, s.settings.profile),
        favorite: isFavoritePlace(job, place, favKeys),
        mark: s.marks.get(job.id),
        norm: normOf(job),
        lane: laneFor(job, s.settings.profile, h),
      });
    }
    return out;
    // rev deckt Anzeigen, Markierungen und Lieblingsorte ab
  }, [s.rev, s.jobs, s.marks, s.favorites, s.settings.profile, geo]);
}

export function filterViews(views: Iterable<JobView>, filter: JobFilter, geo: GeoContext, today = todayBerlin()): JobView[] {
  const out: JobView[] = [];
  for (const v of views) {
    if (passesFilter(v.job, filter, v.place, geo, v.norm, today, v.lane.lane)) out.push(v);
  }
  return out;
}

export function sortViews(list: JobView[], key: SortKey): JobView[] {
  return [...list].sort((a, b) =>
    compareJobs(
      { job: a.job, score: a.score.score, favorite: a.favorite, distanceKm: a.place.distanceKm },
      { job: b.job, score: b.score.score, favorite: b.favorite, distanceKm: b.place.distanceKm },
      key,
    ),
  );
}

export function sortSaved(list: JobView[], key: SavedSort): JobView[] {
  const k: SortKey = key === 'frist' ? 'frist' : key === 'neu' ? 'neu' : key === 'ort' ? 'entfernung' : 'empfohlen';
  if (key === 'score') return [...list].sort((a, b) => b.score.score - a.score.score);
  return sortViews(list, k);
}

/** Offene Anzeigen: aktiv und Frist nicht vorbei (heute zählt noch). */
export function openViews(views: Map<string, JobView>, today = todayBerlin()): JobView[] {
  return [...views.values()].filter((v) => isOpen(v.job, today));
}

/**
 * Der Stapel: offene, noch nicht entschiedene Anzeigen, die zu den Filtern passen.
 * Kern-Karten nach Lieblingsorten und Score, dazwischen etwa jede 3. bis 5. Karte eine Horizont-Karte.
 * Gemischt wird über alle offenen Anzeigen (auch schon entschiedene) und erst danach gefiltert, damit sich
 * die Reihenfolge beim Wischen nicht verschiebt.
 */
export function useDeck(): JobView[] {
  const s = useAppState();
  const views = useViews();
  const geo = useGeo();
  return useMemo(() => {
    const today = todayBerlin();
    const h = horizontOf(s.settings.profile);
    const all = filterViews(openViews(views, today), s.settings.filter, geo, today);
    const core = sortViews(all.filter((v) => !v.lane.promoted), 'empfohlen');
    const extra = all.filter((v) => v.lane.promoted).sort((a, b) => compareHorizon({ lane: a.lane, score: a.score.score }, { lane: b.lane, score: b.score.score }));
    return interleave(core, extra, `horizont:${today}`, h.dosis).filter((v) => !v.mark?.decision);
  }, [views, s.settings.filter, s.settings.profile, geo]);
}

export function useSaved(): JobView[] {
  const s = useAppState();
  const views = useViews();
  return useMemo(() => sortSaved([...views.values()].filter((v) => v.mark?.decision === 'gemerkt'), s.settings.sort.saved), [views, s.settings.sort.saved]);
}
