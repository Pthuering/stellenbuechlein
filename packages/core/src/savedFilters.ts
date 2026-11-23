// Gespeicherte Filter (Einstellung „savedFilters“): Kriterien unter einem Namen, im Stapel und in der Liste
// mit einem Tipp anwendbar. Mit Push meldet das tägliche Einsammeln neue Treffer, unabhängig davon, welcher
// Filter im Stapel gerade gilt. Löst die frühere Einstellung „highlight“ (Wunschstädte) ab.

import { DEFAULT_FILTER, parseFilter, type JobFilter } from './filters';
import { srForm, type UiLang } from './reminders';

export interface SavedFilter {
  id: string;
  /** Vom Nutzer vergeben (oder vorgeschlagen); bleibt, wie er ist, in jeder Sprache */
  name: string;
  filter: JobFilter;
  /** Neue Treffer als Benachrichtigung */
  push: boolean;
  /**
   * Ab wann Treffer als neu gelten: Zeitpunkt, an dem Push eingeschaltet oder die Kriterien geändert wurden.
   * Sonst käme beim Einschalten eine Meldung über alles, was schon da war.
   */
  pushSince: string | null;
}

export const MAX_SAVED_FILTERS = 30;

export function newSavedFilterId(): string {
  return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Frühere Einstellung „highlight“: Städte, Schwelle und Push. */
interface LegacyHighlight {
  cities?: unknown;
  min?: unknown;
  push?: unknown;
}

/**
 * Gespeicherte Filter aus den Einstellungen. Fehlt die Einstellung, aber es gibt noch Wunschstädte aus „highlight“,
 * werden diese zu einem gespeicherten Filter „Wunschstädte“ (Städte, ab der Schwelle, Push wie eingestellt).
 */
export function parseSavedFilters(raw: unknown, legacyHighlight?: unknown): SavedFilter[] {
  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    const out: SavedFilter[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const id = typeof r.id === 'string' && r.id ? r.id : null;
      const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name, filter: parseFilter(r.filter), push: r.push === true, pushSince: typeof r.pushSince === 'string' && r.pushSince ? r.pushSince : null });
      if (out.length >= MAX_SAVED_FILTERS) break;
    }
    return out;
  }
  const h = legacyHighlight && typeof legacyHighlight === 'object' ? (legacyHighlight as LegacyHighlight) : null;
  const cities = Array.isArray(h?.cities) ? [...new Set(h.cities.filter((c): c is string => typeof c === 'string' && c.length > 0))] : [];
  if (!h || cities.length === 0) return [];
  const min = typeof h.min === 'number' && h.min > 0 && h.min <= 100 ? Math.round(h.min) : 70;
  return [
    {
      id: 'wunschstaedte',
      name: 'Wunschstädte',
      filter: { ...DEFAULT_FILTER, cities, minScore: min },
      push: h.push !== false,
      // Ohne Zeitpunkt: Wunschstädte haben bisher nur Anzeigen aus dem jeweiligen Lauf gemeldet
      pushSince: null,
    },
  ];
}

export interface FilterAlertHit {
  id: string;
  title: string;
  score: number;
}

export interface AlertMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Benachrichtigungen für neue Treffer eines gespeicherten Filters: bis zu drei einzeln (je eine pro Anzeige,
 * direkt zu ihr), bei mehr eine gebündelte mit den drei besten. Reihenfolge: beste zuerst.
 */
export function filterAlertMessages(filter: Pick<SavedFilter, 'id' | 'name'>, hits: readonly FilterAlertHit[], lang: UiLang = 'de'): AlertMessage[] {
  if (hits.length === 0) return [];
  const pct = (n: number) => (lang === 'de' ? `${n} %` : `${n}%`);
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  if (sorted.length <= 3) {
    return sorted.map((j) => ({
      title: `🔔 ${filter.name}: ${lang === 'en' ? `new posting, ${pct(j.score)} match` : lang === 'sr' ? `novi oglas, poklapanje ${pct(j.score)}` : `neue Anzeige, passt zu ${pct(j.score)}`}`,
      body: j.title,
      url: `/#/stelle/${encodeURIComponent(j.id)}`,
      tag: `filter-${filter.id}-${j.id}`,
    }));
  }
  const n = sorted.length;
  const title =
    lang === 'en'
      ? `🔔 ${filter.name}: ${n} new postings`
      : lang === 'sr'
        ? `🔔 ${filter.name}: ${n} ${srForm(n, 'novi oglas', 'nova oglasa', 'novih oglasa')}`
        : `🔔 ${filter.name}: ${n} neue Anzeigen`;
  const top = sorted.slice(0, 3).map((j) => `${pct(j.score)} · ${j.title}`);
  const rest = n - 3;
  const more = `\n… ${lang === 'en' ? `and ${rest} more` : lang === 'sr' ? `i još ${rest}` : `und ${rest} weitere`}`;
  return [{ title, body: `${top.join('\n')}${more}`, url: `/#/filter/${encodeURIComponent(filter.id)}`, tag: `filter-${filter.id}` }];
}
