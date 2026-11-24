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
  ABROAD_GAPS_MORE,
  ABROAD_MIN_SCORE,
  moreFrom,
  EUROPE_BONUS,
  interleaveGaps,
  isAbroad,
  isEurope,
  fachSignale,
  fachlichEinschlaegig,
  isOuterLane,
  laneAllowed,
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
  /** Nur bei Auslandsstellen: false, wenn sie nicht gezeigt wird (Passung zu niedrig oder fachlich nicht einschlägig). */
  abroadOk?: boolean;
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
        abroadOk: isAbroad(job) ? score.score >= ABROAD_MIN_SCORE && fachlichEinschlaegig(fachSignale(job, job.descriptionMd, norm, s.settings.profile)) : undefined,
        // Gespeicherte Filter melden nur Kern-Karten (Horizont-Karten haben keine Passung in Prozent)
        alerts: pushFilters.length && !isOuterLane(lane.lane) ? pushFilters.filter((f) => passesFilter(job, f.filter, place, geo, norm, today, lane.lane, score.score)) : [],
      });
    }
    return out;
    // rev deckt Anzeigen, Markierungen und Lieblingsorte ab
  }, [s.rev, s.jobs, s.marks, s.favorites, s.settings.profile, s.settings.savedFilters, geo]);
}

export function filterViews(views: Iterable<JobView>, filter: JobFilter, geo: GeoContext, today = todayBerlin()): JobView[] {
  const out: JobView[] = [];
  for (const v of views) {
    // Auslandsstellen erscheinen nur, wenn sie gut passen und fachlich einschlägig sind (Gemerktes läuft nicht über diesen Filter)
    if (v.abroadOk === false) continue;
    if (passesFilter(v.job, filter, v.place, geo, v.norm, today, v.lane.lane, v.score.score)) out.push(v);
  }
  return out;
}

/**
 * Passung zum Sortieren: Horizont-Karten haben keine Prozentzahl und stehen bei der Sortierung nach Passung hinter
 * den Kern-Karten (untereinander: „passt“ vor „eher“).
 */
export function sortScore(v: JobView): number {
  if (!isOuterLane(v.lane.lane)) return v.score.score;
  return v.lane.verdict === 'passt' ? -1 : v.lane.verdict === 'eher' ? -2 : -3;
}

export function sortViews(list: JobView[], key: SortKey): JobView[] {
  return [...list].sort((a, b) =>
    compareJobs(
      { job: a.job, score: sortScore(a), favorite: a.favorite, distanceKm: a.place.distanceKm },
      { job: b.job, score: sortScore(b), favorite: b.favorite, distanceKm: b.place.distanceKm },
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
  if (key === 'score') return [...list].sort((a, b) => sortScore(b) - sortScore(a));
  return sortViews(list, k);
}

/** Offene Anzeigen: aktiv und Frist nicht vorbei (heute zählt noch). */
export function openViews(views: Map<string, JobView>, today = todayBerlin()): JobView[] {
  return [...views.values()].filter((v) => isOpen(v.job, today));
}

/**
 * Der Stapel: offene, noch nicht entschiedene Anzeigen.
 * Kern-Karten, die zu den Filtern passen, nach Lieblingsorten und Score (leicht gemischt: bis zu fünf Punkte auf
 * oder ab, pro Tag fest), dazwischen etwa jede 3. bis 6. Karte eine von der KI geprüfte Horizont-Karte.
 * Mit der Reihenfolge aus den Einstellungen (deckTier) kommen die Kern-Karten in Teilen: erst die gut passenden
 * (ab der Schwelle), dann der Rest, in beiden Teilen auf Wunsch die mit naher Frist zuerst.
 * Horizont-Karten (über eine Brücke oder ohne) haben keine Passung in Prozent. Sie laufen an den Filtern vorbei
 * und kommen über den ganzen Stapel im eingestellten Rhythmus; zurückhalten lassen sie sich nur ausdrücklich
 * (Ring-Filter ohne Horizont, Horizont in den Einstellungen aus, Brücke pausiert). Noch ungeprüfte warten auf
 * das Urteil der KI und kommen bis dahin gar nicht in den Stapel.
 * Stellen außerhalb Deutschlands kommen wie die Horizont-Karten dazwischen: nach jeweils 2 bis 5 anderen Karten
 * eine, also höchstens jede dritte Karte, nach Passung geordnet und Europa zuerst.
 * Sind die gut passenden normalen Einträge durch (Schwelle lowBelow in der Reihenfolge) und ist „öfter einstreuen“
 * gewählt, kommen ab dem letzten gut passenden normalen Eintrag Brücken und Horizont eine Stufe häufiger und
 * Auslandskarten jede dritte Karte.
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
    const open = openViews(views, today);
    const all = filterViews(open, s.settings.filter, geo, today);
    const tiers = new Map<number, JobView[]>();
    // Horizont-Karten: alle geprüften, die der Ring-Filter zulässt, unabhängig von den übrigen Filtern
    const extra = open.filter((v) => v.lane.promoted && !isAbroad(v.job) && laneAllowed(s.settings.filter, v.lane.lane));
    const abroad: JobView[] = [];
    for (const v of all) {
      if (isAbroad(v.job)) {
        abroad.push(v);
        continue;
      }
      // Horizont-Karten kommen oben dazu; ungeprüfte warten auf das Urteil der KI
      if (isOuterLane(v.lane.lane)) continue;
      const k = deckTier({ score: v.score.score, deadline: v.job.deadline }, s.settings.deck, today);
      const part = tiers.get(k);
      if (part) part.push(v);
      else tiers.set(k, [v]);
    }
    const core = [...tiers.keys()].sort((a, b) => a - b).flatMap((k) => sortCore(tiers.get(k)!, `stapel:${today}`));
    extra.sort((a, b) => compareHorizon({ lane: a.lane, score: a.score.score }, { lane: b.lane, score: b.score.score }));
    // Nach dem letzten gut passenden normalen Eintrag öfter einstreuen, wenn so gewählt (Filter → Reihenfolge)
    const o = s.settings.deck;
    const more = o.lowBelow != null && o.lowMode === 'mehr';
    const good = (v: JobView) => !isOuterLane(v.lane.lane) && v.score.score >= o.lowBelow!;
    const inland = interleave(core, extra, `horizont:${today}`, h.dosis, more ? moreFrom(core, good) : undefined);
    // Auslandsstellen (nur ab ABROAD_MIN_SCORE, siehe filterViews): nach Passung, Europa mit Vorsprung,
    // höchstens jede dritte Karte (siehe ABROAD_GAPS)
    const rank = new Map(abroad.map((v) => [v.job.id, v.score.score + deckJitter(v.job.id, `stapel:${today}`) + (isEurope(v.job.country) ? EUROPE_BONUS : 0)]));
    abroad.sort((a, b) => rank.get(b.job.id)! - rank.get(a.job.id)!);
    const abroadMore = more ? { from: moreFrom(inland, good), gaps: ABROAD_GAPS_MORE } : undefined;
    return interleaveGaps(inland, abroad, `ausland:${today}`, ABROAD_GAPS, abroadMore).filter((v) => !v.mark?.decision);
  }, [views, s.settings.filter, s.settings.profile, s.settings.deck, geo]);
}

export function useSaved(): JobView[] {
  const s = useAppState();
  const views = useViews();
  return useMemo(() => sortSaved([...views.values()].filter((v) => v.mark?.decision === 'gemerkt'), s.settings.sort.saved), [views, s.settings.sort.saved]);
}
