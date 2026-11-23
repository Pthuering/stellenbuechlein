// Gespeicherte Filter in der App: anlegen, ändern, löschen, Namensvorschlag und die Marke für Anzeigen, zu denen
// ein Filter mit Push passt (ersetzt die frühere Marke „Wunschstadt“). Logik und Format: core/savedFilters.ts.

import { MAX_SAVED_FILTERS, newSavedFilterId, sameFilter, type JobFilter, type SavedFilter } from '@stellen/core';
import type { State, Store } from '../data/store';
import { IconBell } from '../ui/icons';
import { fmtPct, srForm, texts } from '../i18n';
import { jobKindLabel, laneName } from '../i18n/labels';

const t = texts({
  de: {
    permanent: 'unbefristet',
    minTerm: (y: number) => `ab ${y} ${y === 1 ? 'Jahr' : 'Jahre'}`,
    fromPct: (p: string) => `ab ${p}`,
    pay: (l: number) => `ab E ${l}`,
    km: (r: number) => `${r} km`,
    more: (n: number) => `+${n}`,
    fallback: 'Mein Filter',
    chipTitle: (names: string) => `Passt zu deinem Filter mit Benachrichtigung: ${names}`,
  },
  en: {
    permanent: 'permanent',
    minTerm: (y) => `${y}+ ${y === 1 ? 'year' : 'years'}`,
    fromPct: (p) => `${p}+`,
    pay: (l) => `E ${l}+`,
    km: (r) => `${r} km`,
    more: (n) => `+${n}`,
    fallback: 'My filter',
    chipTitle: (names) => `Matches your filter with notifications: ${names}`,
  },
  sr: {
    permanent: 'na neodređeno',
    minTerm: (y) => `od ${y} ${srForm(y, 'godine', 'godine', 'godina')}`,
    fromPct: (p) => `od ${p}`,
    pay: (l) => `od E ${l}`,
    km: (r) => `${r} km`,
    more: (n) => `+${n}`,
    fallback: 'Moj filter',
    chipTitle: (names) => `Odgovara tvom filteru sa obaveštenjima: ${names}`,
  },
});

/** Kurzer Namensvorschlag aus den Kriterien, z. B. „Leipzig, Halle · ab 5 Jahre · ab 70 %“. */
export function suggestFilterName(f: JobFilter, s: Pick<State, 'cities'>): string {
  const cities = (f.cities ?? []).map((id) => s.cities.get(id)?.name ?? id);
  const parts = [
    cities.length ? cities.slice(0, 2).join(', ') + (cities.length > 2 ? ` ${t.more(cities.length - 2)}` : '') : '',
    f.states.length && !cities.length ? f.states.slice(0, 3).join(', ') + (f.states.length > 3 ? ` ${t.more(f.states.length - 3)}` : '') : '',
    f.radiusKm != null ? t.km(f.radiusKm) : '',
    f.permanentOnly ? t.permanent : f.minTermYears != null ? t.minTerm(f.minTermYears) : '',
    f.minScore != null ? t.fromPct(fmtPct(f.minScore)) : '',
    f.kinds.length ? jobKindLabel(f.kinds[0]) + (f.kinds.length > 1 ? ` ${t.more(f.kinds.length - 1)}` : '') : '',
    f.payMin != null ? t.pay(f.payMin) : '',
    f.lanes?.length ? f.lanes.map(laneName).join(', ') : '',
    f.text.trim() ? `„${f.text.trim()}“` : '',
  ].filter(Boolean);
  return (parts.join(' · ') || t.fallback).slice(0, 80);
}

/** Der gespeicherte Filter mit genau diesen Kriterien (der „aktive“), sonst null. */
export function savedFilterFor(f: JobFilter, list: readonly SavedFilter[]): SavedFilter | null {
  return list.find((sf) => sameFilter(sf.filter, f)) ?? null;
}

export function addSavedFilter(store: Store, list: readonly SavedFilter[], name: string, filter: JobFilter, push: boolean): SavedFilter {
  const sf: SavedFilter = { id: newSavedFilterId(), name: name.trim().slice(0, 80) || t.fallback, filter: { ...filter }, push, pushSince: push ? new Date().toISOString() : null };
  store.updateSettings('savedFilters', [...list, sf].slice(-MAX_SAVED_FILTERS));
  return sf;
}

/**
 * Ändert einen gespeicherten Filter. Wird Push eingeschaltet oder ändern sich die Kriterien, zählen ab jetzt
 * nur neue Treffer (pushSince), sonst käme eine Meldung über alles, was schon da war.
 */
export function updateSavedFilter(store: Store, list: readonly SavedFilter[], id: string, patch: Partial<Pick<SavedFilter, 'name' | 'filter' | 'push'>>): void {
  store.updateSettings(
    'savedFilters',
    list.map((sf) => {
      if (sf.id !== id) return sf;
      const next: SavedFilter = { ...sf, ...patch, name: (patch.name ?? sf.name).trim().slice(0, 80) || sf.name };
      const pushOn = patch.push === true && !sf.push;
      const changed = patch.filter && !sameFilter(patch.filter, sf.filter);
      if (next.push && (pushOn || changed)) next.pushSince = new Date().toISOString();
      return next;
    }),
  );
}

export function removeSavedFilter(store: Store, list: readonly SavedFilter[], id: string): void {
  store.updateSettings(
    'savedFilters',
    list.filter((sf) => sf.id !== id),
  );
}

/** Marke für Anzeigen, die zu einem Filter mit Push passen (Liste, Stapel, ganze Anzeige). */
export function alertChip(alerts: readonly SavedFilter[], size: 'tiny' | 'normal' = 'tiny') {
  if (alerts.length === 0) return null;
  const icon = size === 'tiny' ? 12 : 14;
  return (
    <span className={`chip chip--highlight ${size === 'tiny' ? 'chip--tiny' : ''}`} title={t.chipTitle(alerts.map((a) => a.name).join(', '))}>
      <IconBell width={icon} height={icon} aria-hidden="true" /> {alerts[0].name}
      {alerts.length > 1 ? ` ${t.more(alerts.length - 1)}` : ''}
    </span>
  );
}
