// Alle: jede gefundene, noch offene Anzeige – unabhängig vom Wischen. Weggelegte bleiben drin.

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { countActiveFilters, DEFAULT_FILTER, SORT_LABELS, todayBerlin, type SortKey } from '@stellen/core';
import { filterViews, openViews, sortViews, useAppState, useGeo, useStore, useViews } from '../data/hooks';
import { Empty } from '../ui/bits';
import { JobRow } from '../ui/JobRow';
import { PageHead } from '../ui/PageHead';
import { IconFilter, IconSearch, IconX } from '../ui/icons';
import { FilterSheet } from './FilterSheet';
import { srForm, texts } from '../i18n';
import { sortLabel } from '../i18n/labels';

const PAGE = 40;
const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

const t = texts({
  de: {
    title: 'Alle Anzeigen',
    open: (n: number) => (n === 1 ? '1 offene Anzeige' : `${n} offene Anzeigen`),
    ofThemPassed: (n: number) => `, davon ${n} weggelegt`,
    shownOf: (shown: number, open: number) => `${shown} von ${open} offenen Anzeigen`,
    filterLabel: (n: number) => `Filter${n ? ` (${n} aktiv)` : ''}`,
    search: 'Suchen',
    searchPlaceholder: 'Titel, Thema, Ort, Einrichtung …',
    sort: 'Sortieren',
    filtersActive: (n: number, query: boolean) => `${n} Filter aktiv${query ? ', dazu die Suche' : ''}.`,
    searchActive: 'Suche aktiv.',
    showAll: 'alles zeigen',
    noPostings: 'Noch keine Anzeigen',
    nothingFound: 'Nichts gefunden',
    noPostingsText: 'Sobald die Pipeline eingesammelt hat, steht hier jede gefundene Anzeige.',
    nothingFoundText: 'Mit dieser Suche und diesen Filtern passt keine Anzeige. Filter blenden nur aus, gelöscht wird nichts.',
    more: (n: number) => `Weitere ${n} zeigen`,
  },
  en: {
    title: 'All postings',
    open: (n) => (n === 1 ? '1 open posting' : `${n} open postings`),
    ofThemPassed: (n) => `, ${n} of them passed`,
    shownOf: (shown, open) => `${shown} of ${open} open ${open === 1 ? 'posting' : 'postings'}`,
    filterLabel: (n) => (n ? `Filters (${n} active)` : 'Filters'),
    search: 'Search',
    searchPlaceholder: 'Title, topic, place, institution…',
    sort: 'Sort',
    filtersActive: (n, query) => `${n} ${n === 1 ? 'filter' : 'filters'} active${query ? ', plus the search' : ''}.`,
    searchActive: 'Search active.',
    showAll: 'show all',
    noPostings: 'No postings yet',
    nothingFound: 'Nothing found',
    noPostingsText: 'Once the pipeline has collected postings, every one it finds will show up here.',
    nothingFoundText: 'No posting matches this search and these filters. Filters only hide postings; nothing gets deleted.',
    more: (n) => `Show ${n} more`,
  },
  sr: {
    title: 'Svi oglasi',
    open: (n) => `${n} ${srForm(n, 'otvoren oglas', 'otvorena oglasa', 'otvorenih oglasa')}`,
    ofThemPassed: (n) => `, od toga ${n} ${srForm(n, 'preskočen', 'preskočena', 'preskočenih')}`,
    shownOf: (shown, open) => `${shown} od ${open} ${srForm(open, 'otvorenog oglasa', 'otvorena oglasa', 'otvorenih oglasa')}`,
    filterLabel: (n) => (n ? `Filteri (aktivno: ${n})` : 'Filteri'),
    search: 'Pretraga',
    searchPlaceholder: 'Naziv, tema, mesto, ustanova…',
    sort: 'Sortiraj',
    filtersActive: (n, query) => `${n} ${srForm(n, 'aktivan filter', 'aktivna filtera', 'aktivnih filtera')}${query ? ', uz to i pretraga' : ''}.`,
    searchActive: 'Pretraga je aktivna.',
    showAll: 'prikaži sve',
    noPostings: 'Još nema oglasa',
    nothingFound: 'Ništa nije pronađeno',
    noPostingsText: 'Čim prikupljanje oglasa prođe, ovde će stajati svaki pronađeni oglas.',
    nothingFoundText: 'Nijedan oglas ne odgovara ovoj pretrazi i ovim filterima. Filteri samo sakrivaju oglase, ništa se ne briše.',
    more: (n) => `Prikaži još ${n}`,
  },
});
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
        title={t.title}
        sub={list.length === open.length ? `${t.open(open.length)}${rejected ? t.ofThemPassed(rejected) : ''}` : t.shownOf(list.length, open.length)}
      >
        <button type="button" className="icon-btn" onClick={() => setFilterOpen(true)} aria-label={t.filterLabel(active)}>
          <IconFilter width={24} height={24} />
          {active > 0 && <span className="badge">{active}</span>}
        </button>
      </PageHead>

      <div className="toolbar">
        <label className="search">
          <span className="visually-hidden">{t.search}</span>
          <IconSearch />
          <input className="input" type="search" value={query} placeholder={t.searchPlaceholder} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
        </label>
        <label>
          <span className="visually-hidden">{t.sort}</span>
          <select className="select" value={sort} onChange={(e) => store.updateSettings('sort', { ...s.settings.sort, all: e.target.value as SortKey })}>
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {sortLabel(k)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(active > 0 || query) && (
        <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {active > 0 ? t.filtersActive(active, !!query) : t.searchActive}
          <button
            type="button"
            className="btn btn--quiet btn--small"
            onClick={() => {
              setQuery('');
              store.updateSettings('filter', DEFAULT_FILTER);
            }}
          >
            <IconX width={16} height={16} /> {t.showAll}
          </button>
        </p>
      )}

      {list.length === 0 ? (
        <Empty
          art="search"
          title={open.length === 0 ? t.noPostings : t.nothingFound}
          text={open.length === 0 ? t.noPostingsText : t.nothingFoundText}
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
                {t.more(Math.min(PAGE, list.length - limit))}
              </button>
            </div>
          )}
        </>
      )}
      {filterOpen && <FilterSheet onClose={() => setFilterOpen(false)} />}
    </section>
  );
}
