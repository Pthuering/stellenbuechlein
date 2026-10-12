// Alle: jede gefundene, noch offene Anzeige – unabhängig vom Wischen. Weggelegte bleiben drin.

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { countActiveFilters, DEFAULT_FILTER, SORT_LABELS, todayBerlin, type SortKey } from '@stellen/core';
import { filterViews, openViews, sortViews, useAppState, useGeo, useStore, useViews } from '../data/hooks';
import { Empty } from '../ui/bits';
import { JobRow } from '../ui/JobRow';
import { PageHead } from '../ui/PageHead';
import { IconFilter, IconSearch, IconX } from '../ui/icons';
import { FilterSheet } from './FilterSheet';

const PAGE = 40;
// Suche gilt nur hier (nicht für Stapel und Karte) und bleibt beim Reiterwechsel erhalten.
let lastQuery = '';

export function AllJobsScreen() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const geo = useGeo();
  const [filterOpen, setFilterOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [query, setQueryState] = useState(lastQuery);
  const setQuery = (q: string) => {
    lastQuery = q;
    setQueryState(q);
  };
  const deferredQuery = useDeferredValue(query);
  const sentinel = useRef<HTMLDivElement>(null);
  const f = s.settings.filter;
  const sort = s.settings.sort.all;
  const active = countActiveFilters({ ...f, text: '' });

  const { open, list } = useMemo(() => {
    const today = todayBerlin();
    const open = openViews(views, today);
    return { open, list: sortViews(filterViews(open, { ...f, text: deferredQuery }, geo, today), sort) };
  }, [views, f, geo, sort, deferredQuery]);

  useEffect(() => setLimit(PAGE), [f, sort, deferredQuery]);

  // Beim Herunterscrollen automatisch weitere Zeilen zeigen
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length]);

  const rejected = list.filter((v) => v.mark?.decision === 'abgelehnt').length;

  return (
    <section className="screen paper" aria-labelledby="all-title">
      <PageHead
        id="all-title"
        title="Alle Anzeigen"
        sub={
          list.length === open.length
            ? `${open.length} offene Anzeigen${rejected ? `, davon ${rejected} weggelegt` : ''}`
            : `${list.length} von ${open.length} offenen Anzeigen`
        }
      >
        <button type="button" className="icon-btn" onClick={() => setFilterOpen(true)} aria-label={`Filter${active ? ` (${active} aktiv)` : ''}`}>
          <IconFilter width={24} height={24} />
          {active > 0 && <span className="badge">{active}</span>}
        </button>
      </PageHead>

      <div className="toolbar">
        <label className="search">
          <span className="visually-hidden">Suchen</span>
          <IconSearch />
          <input className="input" type="search" value={query} placeholder="Titel, Thema, Ort, Einrichtung …" onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
        </label>
        <label>
          <span className="visually-hidden">Sortieren</span>
          <select className="select" value={sort} onChange={(e) => store.updateSettings('sort', { ...s.settings.sort, all: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(active > 0 || query) && (
        <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {active > 0 ? `${active} Filter aktiv${query ? ', dazu die Suche' : ''}.` : 'Suche aktiv.'}
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => {
              setQuery('');
              store.updateSettings('filter', DEFAULT_FILTER);
            }}
          >
            <IconX width={16} height={16} /> alles zeigen
          </button>
        </p>
      )}

      {list.length === 0 ? (
        <Empty
          art="search"
          title={open.length === 0 ? 'Noch keine Anzeigen' : 'Nichts gefunden'}
          text={open.length === 0 ? 'Sobald die Pipeline eingesammelt hat, steht hier jede gefundene Anzeige.' : 'Mit dieser Suche und diesen Filtern passt keine Anzeige. Filter blenden nur aus, gelöscht wird nichts.'}
        />
      ) : (
        <>
          <ul className="list">
            {list.slice(0, limit).map((v) => (
              <JobRow key={v.job.id} v={v} showDecision />
            ))}
          </ul>
          {limit < list.length && (
            <div className="list-more" ref={sentinel}>
              <button type="button" className="btn btn--small" onClick={() => setLimit((l) => l + PAGE)}>
                Weitere {Math.min(PAGE, list.length - limit)} zeigen
              </button>
            </div>
          )}
        </>
      )}
      {filterOpen && <FilterSheet onClose={() => setFilterOpen(false)} />}
    </section>
  );
}
