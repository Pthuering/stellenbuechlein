// Lieblingsorte: Bundesländer, Städte und Einrichtungen, deren Anzeigen immer oben stehen.

import { useMemo, useState } from 'react';
import { INSTITUTION_KIND_LABELS, normalizeText, STATE_CODES, STATES, type FavoriteKind, type StateCode } from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { IconHeart, IconSearch, IconX } from '../../ui/icons';
import { SubPage } from './Settings';

export function PlacesPage() {
  const s = useAppState();
  const store = useStore();
  const [q, setQ] = useState('');
  const fav = (kind: FavoriteKind, ref: string) => s.favorites.some((f) => f.kind === kind && f.ref === ref);
  const toggle = (kind: FavoriteKind, ref: string) => store.setFavorite(kind, ref, !fav(kind, ref));

  const nameOf = (kind: FavoriteKind, ref: string) =>
    kind === 'state' ? STATES[ref as StateCode] ?? ref : kind === 'city' ? s.cities.get(ref)?.name ?? ref : s.institutions.get(ref)?.name ?? ref;

  const hits = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return { cities: [], insts: [] };
    const cities = [...s.cities.values()].filter((c) => normalizeText(c.name).includes(n)).slice(0, 8);
    const insts = [...s.institutions.values()]
      .filter((i) => normalizeText(`${i.name} ${i.shortName ?? ''} ${s.cities.get(i.cityId ?? '')?.name ?? ''}`).includes(n))
      .slice(0, 12);
    return { cities, insts };
  }, [q, s.cities, s.institutions]);

  const groups: { kind: FavoriteKind; title: string }[] = [
    { kind: 'state', title: 'Bundesländer' },
    { kind: 'city', title: 'Städte' },
    { kind: 'institution', title: 'Einrichtungen' },
  ];

  return (
    <SubPage title="Lieblingsorte" sub="Ihre Anzeigen stehen in Stapel und Listen ganz oben">
      {s.favorites.length === 0 ? (
        <p className="notice">Noch keine Lieblingsorte. Bundesland antippen oder unten nach Stadt oder Einrichtung suchen. Auf der Karte geht es auch: hineinzoomen und „Als Lieblingsort“ wählen.</p>
      ) : (
        groups.map((g) => {
          const list = s.favorites.filter((f) => f.kind === g.kind);
          if (list.length === 0) return null;
          return (
            <div key={g.kind}>
              <h2 className="section-title">{g.title}</h2>
              <div className="chips">
                {list.map((f) => (
                  <span key={f.ref} className="chip chip--rosa chip--removable">
                    <IconHeart filled width={14} height={14} /> {nameOf(f.kind, f.ref)}
                    <button type="button" onClick={() => toggle(f.kind, f.ref)} aria-label={`${nameOf(f.kind, f.ref)} entfernen`}>
                      <IconX width={14} height={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}

      <h2 className="section-title">Bundesland antippen</h2>
      <div className="chips">
        {STATE_CODES.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={fav('state', c)} onClick={() => toggle('state', c)}>
            {STATES[c]}
          </button>
        ))}
      </div>

      <h2 className="section-title">Stadt oder Einrichtung suchen</h2>
      <label className="search" style={{ display: 'block' }}>
        <span className="visually-hidden">Stadt oder Einrichtung</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. Leipzig, Max-Planck, Charité" />
      </label>
      {q.trim().length >= 2 && hits.cities.length === 0 && hits.insts.length === 0 && <p className="hint">Nichts gefunden. Neue Einrichtungen lassen sich unter „Quellen“ anlegen.</p>}
      {(hits.cities.length > 0 || hits.insts.length > 0) && (
        <ul className="list">
          {hits.cities.map((c) => {
            const on = fav('city', c.id);
            return (
              <li key={`c${c.id}`} className="pick">
                <button type="button" className="pick__btn" aria-pressed={on} onClick={() => toggle('city', c.id)}>
                  <IconHeart filled={on} width={20} height={20} style={{ color: on ? 'var(--rosa-deep)' : 'var(--pencil-soft)' }} />
                  <span>
                    {c.name} <small>Stadt, {STATES[c.state]}</small>
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
                  <IconHeart filled={on} width={20} height={20} style={{ color: on ? 'var(--rosa-deep)' : 'var(--pencil-soft)' }} />
                  <span>
                    {i.name}{' '}
                    <small>
                      {INSTITUTION_KIND_LABELS[i.kind]}
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
