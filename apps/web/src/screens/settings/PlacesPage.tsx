// Lieblingsorte: Bundesländer, Städte und Einrichtungen, deren Anzeigen immer oben stehen.

import { useMemo, useState } from 'react';
import { normalizeText, STATE_CODES, type FavoriteKind, type StateCode } from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { IconHeart, IconSearch, IconX } from '../../ui/icons';
import { texts } from '../../i18n';
import { institutionKindLabel, stateName } from '../../i18n/labels';
import { SubPage } from './Settings';

const GROUPS: FavoriteKind[] = ['state', 'city', 'institution'];

const t = texts({
  de: {
    title: 'Lieblingsorte',
    sub: 'Ihre Anzeigen stehen in Stapel und Listen ganz oben',
    groups: { state: 'Bundesländer', city: 'Städte', institution: 'Einrichtungen' } as Record<FavoriteKind, string>,
    none: 'Noch keine Lieblingsorte. Bundesland antippen oder unten nach Stadt oder Einrichtung suchen. Auf der Karte geht es auch: hineinzoomen und „Als Lieblingsort“ wählen.',
    remove: (name: string) => `${name} entfernen`,
    tapState: 'Bundesland antippen',
    searchTitle: 'Stadt oder Einrichtung suchen',
    searchLabel: 'Stadt oder Einrichtung',
    searchPlaceholder: 'z. B. Leipzig, Max-Planck, Charité',
    nothingFound: 'Nichts gefunden. Neue Einrichtungen lassen sich unter „Quellen“ anlegen.',
    city: (state: string) => `Stadt, ${state}`,
  },
  en: {
    title: 'Favorite places',
    sub: 'Their postings come first in the stack and lists',
    groups: { state: 'Federal states', city: 'Cities', institution: 'Institutions' },
    none: 'No favorite places yet. Tap a federal state or search for a city or institution below. It also works on the map: zoom in and choose “Set as favorite place”.',
    remove: (name) => `Remove ${name}`,
    tapState: 'Tap a federal state',
    searchTitle: 'Search for a city or institution',
    searchLabel: 'City or institution',
    searchPlaceholder: 'e.g. Leipzig, Max-Planck, Charité',
    nothingFound: 'Nothing found. You can add new institutions under “Sources”.',
    city: (state) => `City, ${state}`,
  },
  sr: {
    title: 'Omiljena mesta',
    sub: 'Njihovi oglasi stoje na samom vrhu, u špilu i na listama',
    groups: { state: 'Savezne pokrajine', city: 'Gradovi', institution: 'Ustanove' },
    none: 'Još nema omiljenih mesta. Dodirni saveznu pokrajinu ili ispod potraži grad ili ustanovu. Može i na mapi: uvećaj prikaz i izaberi „Dodaj u omiljena mesta“.',
    remove: (name) => `Ukloni iz omiljenih: ${name}`,
    tapState: 'Dodirni saveznu pokrajinu',
    searchTitle: 'Potraži grad ili ustanovu',
    searchLabel: 'Grad ili ustanova',
    searchPlaceholder: 'npr. Leipzig, Max-Planck, Charité',
    nothingFound: 'Ništa nije pronađeno. Nove ustanove možeš da dodaš u odeljku „Izvori“.',
    city: (state) => `Grad, ${state}`,
  },
});

export function PlacesPage() {
  const s = useAppState();
  const store = useStore();
  const [q, setQ] = useState('');
  const fav = (kind: FavoriteKind, ref: string) => s.favorites.some((f) => f.kind === kind && f.ref === ref);
  const toggle = (kind: FavoriteKind, ref: string) => store.setFavorite(kind, ref, !fav(kind, ref));

  const nameOf = (kind: FavoriteKind, ref: string) =>
    kind === 'state' ? stateName(ref as StateCode) : kind === 'city' ? s.cities.get(ref)?.name ?? ref : s.institutions.get(ref)?.name ?? ref;

  const hits = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return { cities: [], insts: [] };
    const cities = [...s.cities.values()].filter((c) => normalizeText(c.name).includes(n)).slice(0, 8);
    const insts = [...s.institutions.values()]
      .filter((i) => normalizeText(`${i.name} ${i.shortName ?? ''} ${s.cities.get(i.cityId ?? '')?.name ?? ''}`).includes(n))
      .slice(0, 12);
    return { cities, insts };
  }, [q, s.cities, s.institutions]);

  return (
    <SubPage title={t.title} sub={t.sub}>
      {s.favorites.length === 0 ? (
        <p className="notice">{t.none}</p>
      ) : (
        GROUPS.map((kind) => {
          const list = s.favorites.filter((f) => f.kind === kind);
          if (list.length === 0) return null;
          return (
            <div key={kind}>
              <h2 className="section-title">{t.groups[kind]}</h2>
              <div className="chips">
                {list.map((f) => (
                  <span key={f.ref} className="chip chip--primary chip--removable">
                    <IconHeart filled width={14} height={14} /> {nameOf(f.kind, f.ref)}
                    <button type="button" onClick={() => toggle(f.kind, f.ref)} aria-label={t.remove(nameOf(f.kind, f.ref))}>
                      <IconX width={14} height={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}

      <h2 className="section-title">{t.tapState}</h2>
      <div className="chips">
        {STATE_CODES.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={fav('state', c)} onClick={() => toggle('state', c)}>
            {stateName(c)}
          </button>
        ))}
      </div>

      <h2 className="section-title">{t.searchTitle}</h2>
      <label className="search" style={{ display: 'block' }}>
        <span className="visually-hidden">{t.searchLabel}</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} />
      </label>
      {q.trim().length >= 2 && hits.cities.length === 0 && hits.insts.length === 0 && <p className="hint">{t.nothingFound}</p>}
      {(hits.cities.length > 0 || hits.insts.length > 0) && (
        <ul className="list">
          {hits.cities.map((c) => {
            const on = fav('city', c.id);
            return (
              <li key={`c${c.id}`} className="pick">
                <button type="button" className="pick__btn" aria-pressed={on} onClick={() => toggle('city', c.id)}>
                  <IconHeart filled={on} width={20} height={20} style={{ color: on ? 'var(--primary-strong)' : 'var(--text-subtle)' }} />
                  <span>
                    {c.name} <small>{t.city(stateName(c.state))}</small>
                  </span>
                </button>
              </li>
            );
          })}
          {hits.insts.map((i) => {
            const on = fav('institution', i.id);
            return (
              <li key={`i${i.id}`} className="pick">
                <button type="button" className="pick__btn" aria-pressed={on} onClick={() => toggle('institution', i.id)}>
                  <IconHeart filled={on} width={20} height={20} style={{ color: on ? 'var(--primary-strong)' : 'var(--text-subtle)' }} />
                  <span>
                    {i.name}{' '}
                    <small>
                      {institutionKindLabel(i.kind)}
                      {i.cityId ? `, ${s.cities.get(i.cityId)?.name ?? ''}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SubPage>
  );
}
