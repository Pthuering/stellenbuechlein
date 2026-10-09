// Einfacher, erklärbarer Score:
//   Jede Kategorie ist "voll", sobald 3 Herzchen getroffen sind (unbekannte Angaben zählen halb).
//   Score = Summe der Kategorie-Anteile – Abzüge für "Lieber nicht" (5 Punkte je Herz).
// Nie ein Ausschlusskriterium: Der Score ordnet nur.

import type { Job } from './types';
import { CATEGORY_LABELS, type CategoryId, type Condition, type ProfileItem, type Suchprofil } from './profile';
import { compileTerms, firstMatch, type CompiledTerm } from './text';

export type MatchState = 'ja' | 'nein' | 'unbekannt';

export interface ItemHit {
  item: ProfileItem;
  state: MatchState;
  /** Wodurch getroffen: Begriff oder Feld. */
  via: string | null;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  /** Maximal erreichbare Punkte (Anteil am Gesamtscore). */
  max: number;
  points: number;
  /** Getroffene Herzchen (unbekannt halb), gedeckelt auf 3. */
  hearts: number;
  hits: ItemHit[];
}

export interface ScoreResult {
  score: number;
  categories: CategoryScore[];
  penalties: ItemHit[];
  penalty: number;
}

export const HEARTS_FOR_FULL = 3;
export const PENALTY_PER_HEART = 5;

type ScoreJob = Pick<Job, 'kind' | 'payLevel' | 'workloadPct' | 'isPermanent' | 'language'>;

const compiledCache = new WeakMap<ProfileItem, CompiledTerm[]>();

function termsOf(item: ProfileItem): CompiledTerm[] {
  let c = compiledCache.get(item);
  if (!c) {
    c = compileTerms(item.terms ?? []);
    compiledCache.set(item, c);
  }
  return c;
}

function evalCondition(cond: Condition, job: ScoreJob): { state: MatchState; via: string | null } {
  switch (cond.type) {
    case 'kind':
      if (!job.kind || job.kind === 'sonstige') return { state: 'unbekannt', via: null };
      return cond.kinds.includes(job.kind) ? { state: 'ja', via: 'Stellenart' } : { state: 'nein', via: null };
    case 'payMin':
      if (job.payLevel == null) return { state: 'unbekannt', via: null };
      return job.payLevel >= cond.level ? { state: 'ja', via: 'Entgelt' } : { state: 'nein', via: null };
    case 'workloadMin':
      if (job.workloadPct == null) return { state: 'unbekannt', via: null };
      return job.workloadPct >= cond.pct ? { state: 'ja', via: 'Umfang' } : { state: 'nein', via: null };
    case 'permanent':
      if (job.isPermanent == null) return { state: 'unbekannt', via: null };
      return job.isPermanent ? { state: 'ja', via: 'Befristung' } : { state: 'nein', via: null };
    case 'language':
      if (!job.language) return { state: 'unbekannt', via: null };
      return job.language === cond.lang ? { state: 'ja', via: 'Sprache' } : { state: 'nein', via: null };
  }
}

export function matchItem(item: ProfileItem, job: ScoreJob, normText: string): ItemHit {
  let state: MatchState = 'nein';
  let via: string | null = null;
  if (item.condition) {
    const r = evalCondition(item.condition, job);
    state = r.state;
    via = r.via;
  }
  if (state !== 'ja' && item.terms && item.terms.length > 0) {
    const t = firstMatch(normText, termsOf(item));
    if (t) {
      state = 'ja';
      via = `„${t.raw.replace(/^\*|^"|"$/g, '')}“`;
    }
  }
  // Ein Eintrag nur mit Begriffen kann nicht "unbekannt" sein.
  if (!item.condition && state === 'unbekannt') state = 'nein';
  return { item, state, via };
}

/**
 * Berechnet den Score einer Anzeige.
 * @param normText Ausgabe von searchTextOf(job)
 */
export function scoreJob(job: ScoreJob, normText: string, profile: Suchprofil): ScoreResult {
  const active = profile.categories.filter((c) => c.items.length > 0 && c.weight > 0);
  const weightSum = active.reduce((s, c) => s + c.weight, 0) || 1;

  const categories: CategoryScore[] = profile.categories.map((c) => {
    const isActive = active.includes(c);
    const max = isActive ? (c.weight / weightSum) * 100 : 0;
    const hits = c.items.map((it) => matchItem(it, job, normText));
    let h = 0;
    for (const hit of hits) {
      if (hit.state === 'ja') h += hit.item.hearts;
      else if (hit.state === 'unbekannt') h += hit.item.hearts / 2;
    }
    const hearts = Math.min(HEARTS_FOR_FULL, h);
    const points = isActive ? max * (hearts / HEARTS_FOR_FULL) : 0;
    return { id: c.id, label: CATEGORY_LABELS[c.id], max, points, hearts, hits };
  });

  const penalties = profile.avoid.map((it) => matchItem(it, job, normText)).filter((h) => h.state === 'ja');
  const penalty = penalties.reduce((s, h) => s + h.item.hearts * PENALTY_PER_HEART, 0);
  const raw = categories.reduce((s, c) => s + c.points, 0) - penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, categories, penalties, penalty };
}

/** Kurze Begründung für Karten: die stärksten Treffer. */
export function topReasons(result: ScoreResult, n = 3): string[] {
  const hits = result.categories
    .flatMap((c) => c.hits.filter((h) => h.state === 'ja'))
    .sort((a, b) => b.item.hearts - a.item.hearts);
  return hits.slice(0, n).map((h) => h.item.label);
}
