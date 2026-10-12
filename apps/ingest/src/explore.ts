// Erkundung: Suche nach blinden Flecken. Jeder Lauf fragt mit wechselnden Suchwörtern bei der
// Jobsuche der Arbeitsagentur (und, wenn ein Schlüssel hinterlegt ist, in einer Websuche) nach Anzeigen
// und behält die, deren Website oder Arbeitgeber noch nicht im Register steht.

import { daysBetween, type Horizont } from '@stellen/core';
import type { Candidate } from './extract';
import type { DiscoverContext } from './discover';
import { baSearch } from './portals';

/** Suchwörter für den Kernbereich – bewusst andere als die festen Suchwörter des BA-Portals. */
export const CORE_EXPLORE_QUERIES = [
  'Psychologin Forschungsprojekt',
  'Verhaltensforschung',
  'Kognitionswissenschaft',
  'Arbeitspsychologie',
  'Verkehrspsychologie',
  'Gesundheitspsychologie',
  'Medienpsychologie',
  'Wirtschaftspsychologie',
  'Pädagogische Psychologie',
  'Neuropsychologie Studie',
  'Psychometrie',
  'Human Factors',
  'Studienkoordination Psychologie',
  'wissenschaftliche Mitarbeiterin Verhaltenswissenschaft',
  'Research Associate Psychology',
  'Evaluation Sozialforschung',
];

/**
 * Suchwörter für diesen Lauf: abwechselnd Kern und Brücken, täglich weiterrotierend, damit über
 * die Woche alle Suchwörter einmal drankommen.
 */
export function exploreQueries(h: Horizont, today: string, count: number): string[] {
  const bridge = h.bruecken.filter((b) => b.aktiv).flatMap((b) => (b.suche?.length ? b.suche : [b.name.replace(/\s*&\s*/g, ' ')]));
  const pool: string[] = [];
  const n = Math.max(CORE_EXPLORE_QUERIES.length, bridge.length);
  for (let i = 0; i < n; i++) {
    if (i < CORE_EXPLORE_QUERIES.length) pool.push(CORE_EXPLORE_QUERIES[i]);
    if (i < bridge.length) pool.push(bridge[i]);
  }
  const unique = [...new Set(pool)];
  if (unique.length === 0) return [];
  const day = Math.abs(daysBetween('2026-01-01', today));
  const start = (day * count) % unique.length;
  const out: string[] = [];
  for (let i = 0; i < Math.min(count, unique.length); i++) out.push(unique[(start + i) % unique.length]);
  return out;
}

/** Arbeitsagentur: nur Anzeigen der letzten zwei Wochen, damit jeden Tag Neues dabei ist. */
export async function exploreBa(ctx: DiscoverContext, query: string): Promise<Candidate[]> {
  const r = await baSearch(ctx, [query], 50, '&veroeffentlichtseit=14');
  return r.candidates.map((c) => ({ ...c, via: 'erkundung:ba' }));
}

interface BraveResult {
  url?: string;
  title?: string;
  description?: string;
}

/** Optionale Websuche (Brave Search API, Schlüssel BRAVE_API_KEY). */
export async function exploreWeb(ctx: DiscoverContext, query: string): Promise<Candidate[]> {
  const key = ctx.cfg.search.braveKey;
  if (!key) return [];
  const q = `${query} Stellenausschreibung`;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=DE&search_lang=de&freshness=pm&count=20`;
  const r = await ctx.http.get(url, { headers: { 'X-Subscription-Token': key, accept: 'application/json' }, accept: 'application/json', ignoreRobots: true, noCache: true });
  if (!r.ok) {
    ctx.log.warn(`Websuche „${query}“ fehlgeschlagen (${r.status || r.error})`);
    return [];
  }
  try {
    const data = JSON.parse(r.text) as { web?: { results?: BraveResult[] } };
    return (data.web?.results ?? [])
      .filter((x): x is Required<Pick<BraveResult, 'url'>> & BraveResult => !!x.url && /^https?:\/\//.test(x.url))
      // Listen- und Übersichtsseiten überspringen, gesucht sind einzelne Anzeigen
      .filter((x) => !/\/(?:jobs|stellen|karriere|stellenangebote|stellenausschreibungen)\/?$/i.test(new URL(x.url).pathname))
      .map((x) => ({ url: x.url, title: x.title ?? null, via: 'erkundung:web', hints: { query } }));
  } catch {
    return [];
  }
}
