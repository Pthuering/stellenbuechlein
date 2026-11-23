// React-Anbindung: Zustand lesen und abgeleitete Ansichten (Score, Ort, Lieblingsort) berechnen.

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import {
  compareHorizon,
  compareJobs,
  deckTier,
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
  type SavedFilter,
  type ScoreResult,
  type SortKey,
  type Suchprofil,
  deckJitter,
  ABROAD_GAPS,
  ABROAD_MIN_SCORE,
  EUROPE_BONUS,
  interleaveGaps,
  isAbroad,
  isEurope,
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
  /** Gespeicherte Filter mit Push, zu denen die Anzeige passt (Marke in Liste, Stapel und Anzeige) */
  alerts: SavedFilter[];
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
    const pushFilters = s.settings.savedFilters.filter((f) => f.push);
    const today = todayBerlin();
    const out = new Map<string, JobView>();
    for (const job of s.jobs.values()) {
      const place = placeOf(job, geo);
      const score = scoreOf(job, s.settings.profile);
      const norm = normOf(job);
      const lane = laneFor(job, s.settings.profile, h);
      out.set(job.id, {
        job,
        place,
        score,
        favorite: isFavoritePlace(job, place, favKeys),
        mark: s.marks.get(job.id),
        norm,
        lane,
        alerts: pushFilters.length ? pushFilters.filter((f) => passesFilter(job, f.filter, place, geo, norm, today, lane.lane, score.score)) : [],
      });
    }
    return out;
    // rev deckt Anzeigen, Markierungen und Lieblingsorte ab
  }, [s.rev, s.jobs, s.marks, s.favorites, s.settings.profile, s.settings.savedFilters, geo]);
}

export function filterViews(views: Iterable<JobView>, filter: JobFilter, geo: GeoContext, today = todayBerlin()): JobView[] {
  const out: JobView[] = [];
  for (const v of views) {
    // Auslandsstellen erscheinen nur, wenn sie gut passen (Gemerktes läuft nicht über diesen Filter)
    if (isAbroad(v.job) && v.score.score < ABROAD_MIN_SCORE) continue;
    if (passesFilter(v.job, filter, v.place, geo, v.norm, today, v.lane.lane, v.score.score)) out.push(v);
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

/** Kern-Karten im Stapel: Lieblingsorte zuerst, dann nach Passung, leicht gemischt (siehe deckJitter). */
function sortCore(list: JobView[], seed: string): JobView[] {
  const jitter = new Map(list.map((v) => [v.job.id, deckJitter(v.job.id, seed)]));
  const item = (v: JobView) => ({ job: v.job, score: v.score.score + (jitter.get(v.job.id) ?? 0), favorite: v.favorite, distanceKm: v.place.distanceKm });
  return [...list].sort((a, b) => compareJobs(item(a), item(b), 'empfohlen'));
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
 * Kern-Karten nach Lieblingsorten und Score (leicht gemischt: bis zu fünf Punkte auf oder ab, pro Tag fest),
 * dazwischen etwa jede 3. bis 6. Karte eine von der KI geprüfte Horizont-Karte.
 * Mit der Reihenfolge aus den Einstellungen (deckTier) kommen die Kern-Karten in Teilen: erst die gut passenden
 * (ab der Schwelle), dann der Rest, in beiden Teilen auf Wunsch die mit naher Frist zuerst. Horizont-Karten
 * werden über den ganzen Stapel eingestreut, nicht je Teil: Ihre Passung ist naturgemäß niedrig, sie kämen
 * sonst erst nach allen gut passenden Karten.
 * Stellen außerhalb Deutschlands kommen wie die Horizont-Karten dazwischen: nach jeweils 2 bis 5 anderen Karten
 * eine, also höchstens jede dritte Karte, nach Passung geordnet und Europa zuerst.
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
    const tiers = new Map<number, JobView[]>();
    const extra: JobView[] = [];
    const abroad: JobView[] = [];
    for (const v of all) {
      if (isAbroad(v.job)) {
        abroad.push(v);
        continue;
      }
      if (v.lane.promoted) {
        extra.push(v);
        continue;
      }
      const k = deckTier({ score: v.score.score, deadline: v.job.deadline }, s.settings.deck, today);
      const part = tiers.get(k);
      if (part) part.push(v);
      else tiers.set(k, [v]);
    }
    const core = [...tiers.keys()].sort((a, b) => a - b).flatMap((k) => sortCore(tiers.get(k)!, `stapel:${today}`));
    extra.sort((a, b) => compareHorizon({ lane: a.lane, score: a.score.score }, { lane: b.lane, score: b.score.score }));
    const inland = interleave(core, extra, `horizont:${today}`, h.dosis);
    // Auslandsstellen (nur ab ABROAD_MIN_SCORE, siehe filterViews): nach Passung, Europa mit Vorsprung,
    // höchstens jede dritte Karte (siehe ABROAD_GAPS)
    const rank = new Map(abroad.map((v) => [v.job.id, v.score.score + deckJitter(v.job.id, `stapel:${today}`) + (isEurope(v.job.country) ? EUROPE_BONUS : 0)]));
    abroad.sort((a, b) => rank.get(b.job.id)! - rank.get(a.job.id)!);
    return interleaveGaps(inland, abroad, `ausland:${today}`, ABROAD_GAPS).filter((v) => !v.mark?.decision);
  }, [views, s.settings.filter, s.settings.profile, s.settings.deck, geo]);
}

export function useSaved(): JobView[] {
  const s = useAppState();
  const views = useViews();
  return useMemo(() => sortSaved([...views.values()].filter((v) => v.mark?.decision === 'gemerkt'), s.settings.sort.saved), [views, s.settings.sort.saved]);
}
