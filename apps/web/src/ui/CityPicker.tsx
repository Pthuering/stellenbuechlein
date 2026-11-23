// Städte auswählen: gewählte als Chips zum Entfernen, Vorschläge aus den Lieblingsorten und eine Suche über
// alle Städte, in denen das Büchlein Einrichtungen kennt (früher nur bei den Wunschstädten).

import { useMemo, useState } from 'react';
import { normalizeText } from '@stellen/core';
import { useAppState } from '../data/hooks';
import { IconPin, IconPlus, IconSearch, IconX } from './icons';
import { texts } from '../i18n';
import { stateName } from '../i18n/labels';

const t = texts({
  de: {
    none: 'Alle Städte',
    remove: (city: string) => `${city} entfernen`,
    fromFavorites: 'Aus deinen Lieblingsorten',
    searchLabel: 'Stadt suchen',
    searchPlaceholder: 'Stadt hinzufügen, z. B. Leipzig',
    nothingFound: 'Keine Stadt gefunden. Zur Auswahl stehen die Städte, in denen das Büchlein Einrichtungen kennt.',
  },
  en: {
    none: 'All cities',
    remove: (city) => `Remove ${city}`,
    fromFavorites: 'From your favorite places',
    searchLabel: 'Search for a city',
    searchPlaceholder: 'Add a city, e.g. Leipzig',
    nothingFound: 'No city found. You can choose from the cities where the little book knows institutions.',
  },
  sr: {
    none: 'Svi gradovi',
    remove: (city) => `Ukloni ${city}`,
    fromFavorites: 'Iz tvojih omiljenih mesta',
    searchLabel: 'Pretraži grad',
    searchPlaceholder: 'Dodaj grad, npr. Leipzig',
    nothingFound: 'Grad nije pronađen. Možeš da biraš među gradovima u kojima knjižica poznaje ustanove.',
  },
});

export function CityPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const s = useAppState();
  const [q, setQ] = useState('');
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((c) => c !== id) : [...value, id]);
  const hits = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return [];
    return [...s.cities.values()].filter((c) => normalizeText(c.name).includes(n)).slice(0, 8);
  }, [q, s.cities]);
  const favCities = s.favorites.filter((f) => f.kind === 'city' && s.cities.has(f.ref) && !value.includes(f.ref));

  return (
    <>
      {value.length === 0 ? (
        <p className="hint">{t.none}</p>
      ) : (
        <div className="chips">
          {value.map((id) => {
            const name = s.cities.get(id)?.name ?? id;
            return (
              <span key={id} className="chip chip--highlight chip--removable">
                <IconPin width={14} height={14} aria-hidden="true" /> {name}
                <button type="button" onClick={() => toggle(id)} aria-label={t.remove(name)}>
                  <IconX width={14} height={14} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {favCities.length > 0 && (
        <>
          <p className="hint" style={{ marginBottom: 4 }}>
            {t.fromFavorites}
          </p>
          <div className="chips">
            {favCities.map((f) => (
              <button key={f.ref} type="button" className="chip" onClick={() => toggle(f.ref)}>
                <IconPlus width={14} height={14} aria-hidden="true" /> {s.cities.get(f.ref)!.name}
              </button>
            ))}
          </div>
        </>
      )}
      <label className="search" style={{ display: 'block', marginTop: 8 }}>
        <span className="visually-hidden">{t.searchLabel}</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} />
      </label>
      {q.trim().length >= 2 && hits.length === 0 && <p className="hint">{t.nothingFound}</p>}
      {hits.length > 0 && (
        <ul className="list">
          {hits.map((c) => {
            const on = value.includes(c.id);
            return (
              <li key={c.id} className="pick">
                <button
                  type="button"
                  className="pick__btn"
                  aria-pressed={on}
                  onClick={() => {
                    toggle(c.id);
                    if (!on) setQ('');
                  }}
                >
                  <IconPin width={20} height={20} style={{ color: on ? 'var(--primary-strong)' : 'var(--text-subtle)' }} />
                  <span>
                    {c.name} <small>{stateName(c.state)}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
