// React-Anbindung: Zustand lesen und abgeleitete Ansichten (Score, Ort, Lieblingsort) berechnen.

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import {
  compareJobs,
  favoriteKeySet,
  isFavoritePlace,
  passesFilter,
  placeOf,
  scoreJob,
  searchTextOf,
  todayBerlin,
  type GeoContext,
  type Job,
  type JobFilter,
  type JobPlace,
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
      });
    }
    return out;
    // rev deckt Anzeigen, Markierungen und Lieblingsorte ab
  }, [s.rev, s.jobs, s.marks, s.favorites, s.settings.profile, geo]);
}

export function filterViews(views: Iterable<JobView>, filter: JobFilter, geo: GeoContext, today = todayBerlin()): JobView[] {
  const out: JobView[] = [];
  for (const v of views) {
    if (passesFilter(v.job, filter, v.place, geo, v.norm, today)) out.push(v);
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

/** Der Stapel: aktive, noch nicht entschiedene Anzeigen, die zu den Filtern passen. */
export function useDeck(): JobView[] {
  const s = useAppState();
  const views = useViews();
  const geo = useGeo();
  return useMemo(() => {
    const today = todayBerlin();
    const open = [...views.values()].filter((v) => v.job.status === 'aktiv' && !v.mark?.decision && !(v.job.deadline && v.job.deadline < today));
    return sortViews(filterViews(open, s.settings.filter, geo, today), 'empfohlen');
  }, [views, s.settings.filter, geo]);
}

export function useSaved(): JobView[] {
  const s = useAppState();
  const views = useViews();
  return useMemo(() => sortSaved([...views.values()].filter((v) => v.mark?.decision === 'gemerkt'), s.settings.sort.saved), [views, s.settings.sort.saved]);
}
