// Erkundung und Suchseiten: Suche nach blinden Flecken mit den Wortgruppen des Suchmusters (Kern + Brücken).
//  - Erkundung: Jobsuche der Arbeitsagentur und Websuche (Brave); behalten wird, was von Websites oder
//    Arbeitgebern außerhalb des Registers kommt.
//  - Suchseiten (Portal-Quellen mit config.suche, z. B. LinkedIn, StepStone, AcademicTransfer): Die Seite wird mit
//    denselben Wortgruppen über ihre eigene Suche abgefragt.
// Ein Wochenplan verteilt alle Paare aus Ziel und Wortgruppe so über die Tage, dass jeder Tag eine andere Mischung
// abfragt, das Brave-Budget pro Tag eingehalten wird und nach einer Woche jede Wortgruppe überall einmal dran war.

import { daysBetween, type Horizont } from '@stellen/core';
import type { Candidate } from './extract';
import type { DiscoverContext } from './discover';
import { baSearch } from './portals';

/**
 * Suchwörter für den Kernbereich – bewusst andere als die festen Suchwörter des BA-Portals. Immer Wortgruppen
 * (Fach plus Stellenart oder Forschung): Ein einzelnes Wort wie „Verhaltensforschung“ oder „Psychometrie“ bringt
 * bei der Arbeitsagentur vor allem fachfremde Stellen.
 */
export const CORE_EXPLORE_QUERIES = [
  'Psychologin Forschungsprojekt',
  'wissenschaftlicher Mitarbeiter Allgemeine Psychologie',
  'wissenschaftliche Mitarbeiterin Kognitionspsychologie',
  'Postdoc Experimentalpsychologie',
  'Kognitionswissenschaft wissenschaftlicher Mitarbeiter',
  'Verhaltensforschung Psychologie',
  'Arbeitspsychologie Forschung',
  'Ingenieurpsychologie Human Factors',
  'Human Factors Psychologie',
  'Verkehrspsychologie Forschung',
  'Gesundheitspsychologie Forschung',
  'Medienpsychologie wissenschaftlicher Mitarbeiter',
  'Wirtschaftspsychologie Professur',
  'Pädagogische Psychologie wissenschaftlicher Mitarbeiter',
  'Neuropsychologie Studie',
  'Psychometrie Diagnostik Forschung',
  'Alternsforschung Psychologie',
  'Studienkoordination Psychologie',
  'wissenschaftliche Mitarbeiterin Verhaltenswissenschaft',
  'Research Associate Psychology',
  'Evaluation Sozialforschung Psychologie',
  ...[
    'PhD position psychology',
    'postdoctoral researcher psychology',
    'postdoc cognitive psychology',
    'cognitive neuroscience research position',
    'behavioural science researcher',
    'research assistant psychology Germany',
    'human factors researcher psychology',
    'user research psychologist',
    // Englische Gegenstücke der deutschen Kern-Wortgruppen, für Suchseiten im Ausland (AcademicTransfer, LinkedIn Europa …)
    'postdoc experimental psychology',
    'research associate cognitive science',
    'postdoc attention perception',
    'postdoc ageing psychology',
    'engineering psychology human factors',
    'work psychology research',
    'assistant professor cognitive psychology',
    'lecturer psychology research',
  ],
];

/** Sprache einer Wortgruppe: deutsch, sobald ein deutsches Wort oder ein Umlaut darin steht. */
export function queryLanguage(q: string): 'de' | 'en' {
  return /[äöüß]|psycholog(?:ie|e|in)\b|mitarbeit|forschung|wissenschaft|studie|professur|prävention|entwicklung|gestaltung|didaktik|koordination|diagnostik|interaktion|intelligenz|verhalten|sozial/i.test(q) ? 'de' : 'en';
}

/** Alle Wortgruppen des Suchmusters: abwechselnd Kern und Brücken (nur aktive), ohne Doppelte. */
export function suchmuster(h: Horizont): string[] {
  const bridge = h.bruecken.filter((b) => b.aktiv).flatMap((b) => (b.suche?.length ? b.suche : [b.name.replace(/\s*&\s*/g, ' ')]));
  const pool: string[] = [];
  const n = Math.max(CORE_EXPLORE_QUERIES.length, bridge.length);
  for (let i = 0; i < n; i++) {
    if (i < CORE_EXPLORE_QUERIES.length) pool.push(CORE_EXPLORE_QUERIES[i]);
    if (i < bridge.length) pool.push(bridge[i]);
  }
  return [...new Set(pool)];
}

/**
 * Suchwörter für diesen Lauf: abwechselnd Kern und Brücken, täglich weiterrotierend, damit über
 * die Woche alle Suchwörter einmal drankommen.
 */
export function exploreQueries(h: Horizont, today: string, count: number): string[] {
  const unique = suchmuster(h);
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

/**
 * Websuche über die Brave Search API (Schlüssel BRAVE_API_KEY). Mit `site` nur Treffer dieser Website
 * (Suchseiten ohne eigene abrufbare Suche, etwa Aarhus University), dann ohne Länder-Einschränkung.
 */
export async function exploreWeb(ctx: DiscoverContext, query: string, site?: string): Promise<Candidate[]> {
  const key = ctx.cfg.search.braveKey;
  if (!key) return [];
  const english = queryLanguage(query) === 'en';
  const q = site ? `site:${site} ${query}` : english ? `${query} job vacancy` : `${query} Stellenausschreibung`;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&country=${site ? 'ALL' : 'DE'}&search_lang=${english ? 'en' : 'de'}&freshness=pm&count=20`;
  const r = await ctx.http.get(url, { headers: { 'X-Subscription-Token': key, accept: 'application/json' }, accept: 'application/json', ignoreRobots: true, noCache: true });
  if (!r.ok) {
    ctx.log.warn(`Websuche „${q}“ fehlgeschlagen (${r.status || r.error})`);
    return [];
  }
  try {
    const data = JSON.parse(r.text) as { web?: { results?: BraveResult[] } };
    return (data.web?.results ?? [])
      .filter((x): x is Required<Pick<BraveResult, 'url'>> & BraveResult => !!x.url && /^https?:\/\//.test(x.url))
      // Listen- und Übersichtsseiten überspringen, gesucht sind einzelne Anzeigen
      .filter((x) => !/\/(?:jobs|stellen|karriere|stellenangebote|stellenausschreibungen)\/?$/i.test(new URL(x.url).pathname))
      .map((x) => ({ url: x.url, title: x.title ?? null, via: site ? 'suche:web' : 'erkundung:web', hints: { query } }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- Suchseiten und Wochenplan

/**
 * Suchseite (config.suche einer Portal-Quelle): Die Seite wird nicht über eine feste Liste gelesen, sondern mit den
 * Wortgruppen des Suchmusters abgefragt, entweder über ihre eigene Suche (`adresse` mit {q} oder {slug}) oder über
 * die Websuche mit `site:` (`website`, kostet Brave-Anfragen).
 */
export interface SucheConfig {
  /** Such-Adresse mit {q} (URL-kodiert) oder {slug} (klein, mit Bindestrichen) */
  adresse?: string;
  /** Website für die Websuche mit site:, z. B. "international.au.dk/about/profile/vacant-positions" */
  website?: string;
  /** Welche Wortgruppen die Seite bekommt (Standard: alle) */
  sprache?: 'de' | 'en' | 'alle';
  /** Trefferseiten je Wortgruppe (Standard 1: die Seiten sortieren nach Relevanz) */
  seiten?: number;
}

export function sucheOf(cfg: Record<string, unknown>): SucheConfig | null {
  const s = cfg.suche as SucheConfig | undefined;
  return s && typeof s === 'object' && (typeof s.adresse === 'string' || typeof s.website === 'string') ? s : null;
}

/** Such-Adresse für eine Wortgruppe. */
export function sucheUrl(tpl: string, query: string): string {
  const slug = query
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return tpl.replace(/\{q\}/g, encodeURIComponent(query)).replace(/\{slug\}/g, slug);
}

/** Wohin eine Wortgruppe geht: Websuche allgemein, Arbeitsagentur oder eine Suchseite. */
export interface Suchziel {
  id: string;
  sprache: 'de' | 'en' | 'alle';
  /** kostet eine Brave-Anfrage je Wortgruppe */
  brave: boolean;
}

export interface Wochenplan {
  /** Wortgruppen je Ziel für heute */
  heute: Map<string, string[]>;
  /** Tag im Wochenplan (0–6) */
  tag: number;
  /** Tage, bis jede Brave-Anfrage einmal dran war (mindestens 7) */
  braveZyklus: number;
  braveHeute: number;
  braveGesamt: number;
  /** Paare aus Ziel und Wortgruppe insgesamt (über die Woche bzw. den Brave-Zyklus) */
  gesamt: number;
}

/** Ein Montag als Anfang der Zählung: Tag 0 des Plans ist immer ein Montag. */
const PLAN_START = '2026-11-23';

/**
 * Wochenplan: Jede Wortgruppe kommt bei jedem Ziel, dessen Sprache passt, einmal pro Woche dran. Die Wortgruppen
 * eines Ziels sind mit eigenem Versatz über die Woche verteilt, so fragt jeder Tag eine andere Mischung aus Websites
 * und Wortgruppen ab. Anfragen, die Brave kosten, verteilen sich so, dass höchstens `braveProTag` an einem Tag
 * anfallen; reicht das für eine Woche nicht, dauert ihr Durchgang entsprechend länger.
 */
export function wochenplan(ziele: Suchziel[], queries: string[], today: string, braveProTag: number): Wochenplan {
  const tag = Math.abs(daysBetween(PLAN_START, today));
  const passt = (z: Suchziel) => queries.filter((q) => z.sprache === 'alle' || queryLanguage(q) === z.sprache);
  const braveGesamt = ziele.filter((z) => z.brave).reduce((n, z) => n + passt(z).length, 0);
  const braveZyklus = Math.max(7, Math.ceil(braveGesamt / Math.max(1, braveProTag)));
  const heute = new Map<string, string[]>();
  const add = (id: string, q: string) => heute.set(id, [...(heute.get(id) ?? []), q]);
  let gesamt = 0;
  // Kostenlose Ziele: jede Wortgruppe einmal pro Woche, mit Versatz je Ziel, damit nicht alle Ziele am selben Tag
  // dieselbe Wortgruppe bekommen
  ziele.forEach((z, zi) => {
    const qs = passt(z);
    gesamt += qs.length;
    if (!z.brave) qs.forEach((q, k) => (k + zi * 3) % 7 === tag % 7 && add(z.id, q));
  });
  // Brave: alle Paare reihum über die Ziele verzahnt, dann der Reihe nach auf die Tage des Durchgangs verteilt.
  // So kommen an einem Tag höchstens ceil(gesamt / Durchgang) ≤ braveProTag zusammen, und keine Suche fällt weg.
  const listen = ziele.filter((z) => z.brave).map((z) => passt(z).map((q) => ({ z, q })));
  const paare: { z: Suchziel; q: string }[] = [];
  for (let k = 0; listen.some((l) => k < l.length); k++) for (const l of listen) if (l[k]) paare.push(l[k]);
  let braveHeute = 0;
  paare.forEach((p, j) => {
    if (j % braveZyklus === tag % braveZyklus) {
      add(p.z.id, p.q);
      braveHeute++;
    }
  });
  return { heute, tag: tag % 7, braveZyklus, braveHeute, braveGesamt, gesamt };
}
