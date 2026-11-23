// Hervorhebung: Anzeigen in den unter „Erinnerungen“ ausgewählten Städten, die mindestens zur dort
// eingestellten Schwelle passen (Einstellung „highlight“, Logik in core/reminders.ts).

import { highlightCity } from '@stellen/core';
import type { JobView } from '../data/hooks';
import type { State } from '../data/store';
import { IconPin } from '../ui/icons';
import { fmtPct, texts } from '../i18n';

/** Name der ausgewählten Stadt, wenn die Anzeige hervorgehoben wird, sonst null. */
export function highlightOf(v: JobView, s: Pick<State, 'settings' | 'cities'>): string | null {
  const h = s.settings.highlight;
  if (h.cities.length === 0) return null;
  const id = highlightCity({ cityId: v.place.cityId, locationText: v.job.locationText, score: v.score.score }, h, s.cities);
  return id ? (s.cities.get(id)?.name ?? null) : null;
}

const t = texts({
  de: { chip: 'Wunschstadt', title: (city: string, pct: string) => `In ${city} und passt ab ${pct}: hervorgehoben` },
  en: { chip: 'Chosen city', title: (city, pct) => `In ${city} and a match from ${pct}: highlighted` },
  sr: { chip: 'Izabrani grad', title: (city, pct) => `Grad ${city}, poklapanje od ${pct}: istaknuto` },
});

/** Kleine Marke für hervorgehobene Anzeigen (Liste, Stapel, ganze Anzeige). */
export function highlightChip(city: string, min: number, size: 'tiny' | 'normal' = 'tiny') {
  return (
    <span className={`chip chip--highlight ${size === 'tiny' ? 'chip--tiny' : ''}`} title={t.title(city, fmtPct(min))}>
      <IconPin width={size === 'tiny' ? 12 : 14} height={size === 'tiny' ? 12 : 14} aria-hidden="true" /> {t.chip}
    </span>
  );
}
