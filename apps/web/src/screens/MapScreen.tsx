// Karte: gemerkte (oder alle offenen) Anzeigen auf einer gezeichneten Deutschlandkarte.
// Tippen zoomt hinein: Deutschland → Bundesland → Stadt → Einrichtung.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DE_BOUNDS, isOpen, MAP_HEIGHT, MAP_WIDTH, project, STATES, todayBerlin, type FavoriteKind, type StateCode } from '@stellen/core';
import { filterViews, sortSaved, sortViews, useAppState, useGeo, useStore, useViews, type JobView } from '../data/hooks';
import { institutionName, plural } from '../lib/format';
import { Empty } from '../ui/bits';
import { JobRow } from '../ui/JobRow';
import { PageHead } from '../ui/PageHead';
import { IconChevron, IconHeart } from '../ui/icons';

interface MapStateShape {
  code: StateCode;
  name: string;
  d: string;
  sketch: string;
  bbox: [number, number, number, number];
  label: [number, number];
}
interface MapData {
  width: number;
  height: number;
  source: string;
  states: MapStateShape[];
}

interface Selection {
  state: StateCode | null;
  city: string | null;
  inst: string | null;
}

interface Pin {
  key: string;
  level: 'state' | 'city' | 'inst';
  ref: string;
  x: number;
  y: number;
  count: number;
  label: string;
  fav: boolean;
}

const UNITS_PER_KM = MAP_HEIGHT / ((DE_BOUNDS.maxLat - DE_BOUNDS.minLat) * 111.2);
const NO_INST = '_ohne';

let mapCache: MapData | null = null;
let lastSel: Selection = { state: null, city: null, inst: null };

function useMapData(): MapData | null {
  const [data, setData] = useState(mapCache);
  useEffect(() => {
    if (data) return;
    let alive = true;
    void import('../map/germany.json').then((mod) => {
      mapCache = mod.default as unknown as MapData;
      if (alive) setData(mapCache);
    });
    return () => {
      alive = false;
    };
  }, [data]);
  return data;
}

function fit(x0: number, y0: number, x1: number, y1: number, maxScale: number) {
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);
  const s = Math.min(MAP_WIDTH / bw, MAP_HEIGHT / bh, maxScale);
  return { s, tx: MAP_WIDTH / 2 - (s * (x0 + x1)) / 2, ty: MAP_HEIGHT / 2 - (s * (y0 + y1)) / 2 };
}

/** Punkte, die (fast) aufeinanderliegen, auf einem kleinen Kreis verteilen. */
function spread(pins: Pin[], minDist: number): Pin[] {
  const out = pins.map((p) => ({ ...p }));
  const used = new Set<number>();
  for (let i = 0; i < out.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < out.length; j++) {
      if (!used.has(j) && Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) < minDist) group.push(j);
    }
    if (group.length < 2) continue;
    const cx = group.reduce((a, k) => a + out[k].x, 0) / group.length;
    const cy = group.reduce((a, k) => a + out[k].y, 0) / group.length;
    const r = minDist * (0.75 + group.length * 0.12);
    group.forEach((k, n) => {
      used.add(k);
      const a = -Math.PI / 2 + (n / group.length) * Math.PI * 2;
      out[k].x = cx + Math.cos(a) * r;
      out[k].y = cy + Math.sin(a) * r;
    });
  }
  return out;
}

export function MapScreen() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const geo = useGeo();
  const map = useMapData();
  const svgRef = useRef<SVGSVGElement>(null);
  const [pxPerUnit, setPxPerUnit] = useState(0.36);
  const [sel, setSelState] = useState<Selection>(lastSel);
  const [limit, setLimit] = useState(40);
  const mode = s.settings.ui.mapMode;

  const setSel = (next: Selection) => {
    lastSel = next;
    setSelState(next);
    setLimit(40);
  };

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 360;
      const h = el.clientHeight || 480;
      setPxPerUnit(Math.min(w / MAP_WIDTH, h / MAP_HEIGHT));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  // Welche Anzeigen zeigt die Karte?
  const jobs = useMemo(() => {
    const all = [...views.values()];
    if (mode === 'gemerkt') return sortSaved(all.filter((v) => v.mark?.decision === 'gemerkt'), s.settings.sort.saved);
    const today = todayBerlin();
    const open = all.filter((v) => isOpen(v.job, today));
    return sortViews(filterViews(open, s.settings.filter, geo, today), 'empfohlen');
  }, [views, mode, s.settings.sort.saved, s.settings.filter, geo]);

  const located = jobs.filter((v) => v.place.state);
  const unlocated = jobs.filter((v) => !v.place.state);

  const inSel = useMemo(() => {
    if (sel.inst) return located.filter((v) => v.place.cityId === sel.city && (v.job.institutionId ?? NO_INST) === sel.inst);
    if (sel.city) return located.filter((v) => v.place.cityId === sel.city);
    if (sel.state) return located.filter((v) => v.place.state === sel.state);
    return jobs;
  }, [jobs, located, sel]);

  const statesWithJobs = useMemo(() => {
    const m = new Map<StateCode, number>();
    for (const v of located) m.set(v.place.state!, (m.get(v.place.state!) ?? 0) + 1);
    return m;
  }, [located]);

  const isFav = (kind: FavoriteKind, ref: string) => s.favorites.some((f) => f.kind === kind && f.ref === ref);

  // Ausschnitt
  const view = useMemo(() => {
    if (!map) return { s: 1, tx: 0, ty: 0 };
    if (sel.city) {
      const c = s.cities.get(sel.city);
      if (c) {
        const [x, y] = project(c.lon, c.lat);
        const half = 32 * UNITS_PER_KM;
        return fit(x - half, y - half, x + half, y + half, 14);
      }
    }
    if (sel.state) {
      const st = map.states.find((x) => x.code === sel.state);
      if (st) {
        const [x0, y0, x1, y1] = st.bbox;
        const pad = Math.max(x1 - x0, y1 - y0) * 0.08;
        return fit(x0 - pad, y0 - pad, x1 + pad, y1 + pad, 7);
      }
    }
    return { s: 1, tx: 0, ty: 0 };
  }, [map, sel.state, sel.city, s.cities]);

  // Markierungen je Ebene
  const pins = useMemo((): Pin[] => {
    if (!map) return [];
    if (!sel.state) {
      // Berlin/Brandenburg, Bremen/Niedersachsen … liegen dicht beieinander: auseinanderziehen
      return spread(
        map.states
          .filter((st) => statesWithJobs.has(st.code))
          .map((st): Pin => ({ key: `s:${st.code}`, level: 'state', ref: st.code, x: st.label[0], y: st.label[1], count: statesWithJobs.get(st.code)!, label: st.name, fav: isFav('state', st.code) })),
        30 / pxPerUnit,
      );
    }
    if (!sel.city) {
      const byCity = new Map<string, number>();
      for (const v of located) if (v.place.state === sel.state && v.place.cityId) byCity.set(v.place.cityId, (byCity.get(v.place.cityId) ?? 0) + 1);
      const list: Pin[] = [];
      for (const [id, count] of byCity) {
        const c = s.cities.get(id);
        if (!c) continue;
        const [x, y] = project(c.lon, c.lat);
        list.push({ key: `c:${id}`, level: 'city', ref: id, x, y, count, label: c.name, fav: isFav('city', id) });
      }
      return list;
    }
    const city = s.cities.get(sel.city);
    if (!city) return [];
    const byInst = new Map<string, number>();
    for (const v of located) if (v.place.cityId === sel.city) byInst.set(v.job.institutionId ?? NO_INST, (byInst.get(v.job.institutionId ?? NO_INST) ?? 0) + 1);
    const list: Pin[] = [];
    for (const [id, count] of byInst) {
      const inst = id === NO_INST ? undefined : s.institutions.get(id);
      const [x, y] = inst?.lat != null && inst.lon != null ? project(inst.lon, inst.lat) : project(city.lon, city.lat);
      list.push({ key: `i:${id}`, level: 'inst', ref: id, x, y, count, label: inst ? institutionName(inst, true) : 'Ohne Einrichtung', fav: inst ? isFav('institution', id) : false });
    }
    // Einrichtungen am selben Ort auseinanderziehen (Abstand in Kartenpunkten bei aktuellem Zoom)
    return spread(list, 26 / (pxPerUnit * view.s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, sel.state, sel.city, statesWithJobs, located, s.cities, s.institutions, s.favorites, pxPerUnit, view.s]);

  const toScreen = (x: number, y: number): [number, number] => [x * view.s + view.tx, y * view.s + view.ty];
  const u = (px: number) => px / pxPerUnit; // Bildschirmpixel → Kartenpunkte (ungezoomt)

  const home = project(s.settings.home.lon, s.settings.home.lat);
  const [hx, hy] = toScreen(home[0], home[1]);
  const radius = s.settings.filter.radiusKm;

  const tapPin = (p: Pin) => {
    if (p.level === 'state') setSel({ state: p.ref as StateCode, city: null, inst: null });
    else if (p.level === 'city') setSel({ ...sel, city: p.ref, inst: null });
    else setSel({ ...sel, inst: sel.inst === p.ref ? null : p.ref });
  };

  // Überschrift, Lieblingsort-Knopf
  const selCity = sel.city ? s.cities.get(sel.city) : undefined;
  const selInst = sel.inst && sel.inst !== NO_INST ? s.institutions.get(sel.inst) : undefined;
  const favTarget: { kind: FavoriteKind; ref: string; name: string } | null = selInst
    ? { kind: 'institution', ref: selInst.id, name: institutionName(selInst, true) }
    : selCity
      ? { kind: 'city', ref: selCity.id, name: selCity.name }
      : sel.state
        ? { kind: 'state', ref: sel.state, name: STATES[sel.state] }
        : null;
  const favOn = favTarget ? isFav(favTarget.kind, favTarget.ref) : false;
  const listTitle = selInst ? selInst.name : sel.inst === NO_INST ? 'Ohne Einrichtung' : selCity ? `In ${selCity.name}` : sel.state ? `In ${STATES[sel.state]}` : mode === 'gemerkt' ? 'Alle gemerkten' : 'Alle offenen';

  return (
    <section className="screen paper" aria-labelledby="map-title">
      <PageHead id="map-title" title="Karte" sub={mode === 'gemerkt' ? plural(jobs.length, 'gemerkte Anzeige', 'gemerkte Anzeigen') : plural(jobs.length, 'offene Anzeige', 'offene Anzeigen')}>
        <div className="segmented segmented--small" role="group" aria-label="Was die Karte zeigt">
          <button type="button" aria-pressed={mode === 'gemerkt'} onClick={() => store.updateSettings('ui', { ...s.settings.ui, mapMode: 'gemerkt' })}>
            Gemerkt
          </button>
          <button type="button" aria-pressed={mode === 'alle'} onClick={() => store.updateSettings('ui', { ...s.settings.ui, mapMode: 'alle' })}>
            Alle
          </button>
        </div>
      </PageHead>

      <nav className="crumbs" aria-label="Kartenausschnitt">
        {sel.state ? (
          <button type="button" onClick={() => setSel({ state: null, city: null, inst: null })}>
            Deutschland
          </button>
        ) : (
          <span aria-current="location">Deutschland</span>
        )}
        {sel.state && (
          <>
            <IconChevron width={14} height={14} aria-hidden="true" />
            {sel.city ? (
              <button type="button" onClick={() => setSel({ state: sel.state, city: null, inst: null })}>
                {STATES[sel.state]}
              </button>
            ) : (
              <span aria-current="location">{STATES[sel.state]}</span>
            )}
          </>
        )}
        {selCity && (
          <>
            <IconChevron width={14} height={14} aria-hidden="true" />
            {sel.inst ? (
              <button type="button" onClick={() => setSel({ ...sel, inst: null })}>
                {selCity.name}
              </button>
            ) : (
              <span aria-current="location">{selCity.name}</span>
            )}
          </>
        )}
        {sel.inst && (
          <>
            <IconChevron width={14} height={14} aria-hidden="true" />
            <span aria-current="location">{selInst ? institutionName(selInst, true) : 'Ohne Einrichtung'}</span>
          </>
        )}
      </nav>

      <div className="map-wrap">
        {!map ? (
          <div className="map-svg map-svg--loading" aria-hidden="true" />
        ) : (
          <svg ref={svgRef} className="map-svg" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Karte, Ausschnitt ${listTitle}`}>
            <g className="zoom" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}>
              {map.states.map((st) => {
                const has = statesWithJobs.has(st.code);
                const fav = isFav('state', st.code);
                const active = sel.state === st.code;
                const cls = ['state', has ? 'state--has' : '', fav ? 'state--fav' : '', active ? 'state--active' : '', sel.state && !active ? 'state--dim' : ''].join(' ');
                return (
                  <path
                    key={st.code}
                    className={cls}
                    d={st.d}
                    onClick={() => setSel(active && !sel.city ? { state: null, city: null, inst: null } : { state: st.code, city: null, inst: null })}
                  >
                    <title>{st.name}</title>
                  </path>
                );
              })}
              {map.states.map((st) => (
                <path key={`k${st.code}`} className="sketch" d={st.sketch} />
              ))}
              {radius != null && <circle className="radius" cx={home[0]} cy={home[1]} r={radius * UNITS_PER_KM} />}
            </g>

            {/* Markierungen in Bildschirmgröße: wandern mit dem Zoom mit, bleiben aber gleich groß */}
            <g className="home" style={{ transform: `translate(${hx}px, ${hy}px)` }} aria-hidden="true">
              <path d={`M${u(-9)} ${u(2)}L0 ${u(-8)}L${u(9)} ${u(2)}V${u(10)}H${u(-9)}Z`} strokeWidth={u(1.8)} strokeLinejoin="round" />
              <path d={`M${u(-2.5)} ${u(10)}v${u(-6)}h${u(5)}v${u(6)}`} fill="none" stroke="var(--text)" strokeWidth={u(1.6)} />
            </g>

            {selCity &&
              (() => {
                const [cx, cy] = toScreen(...project(selCity.lon, selCity.lat));
                const rr = 9 * UNITS_PER_KM * view.s;
                return (
                  <g key={`stadt:${selCity.id}`} className="city-mark" style={{ transform: `translate(${cx}px, ${cy}px)` }} aria-hidden="true">
                    <circle r={rr} strokeWidth={u(1.6)} strokeDasharray={`${u(5)} ${u(5)}`} />
                    <text y={-rr - u(10)} style={{ fontSize: u(19) }}>
                      {selCity.name}
                    </text>
                  </g>
                );
              })()}
            {pins.map((p) => {
              const [x, y] = toScreen(p.x, p.y);
              const r = u(11 + Math.min(10, Math.sqrt(p.count) * 3.2));
              const selected = sel.inst === p.ref && p.level === 'inst';
              const showLabel = p.level !== 'state';
              return (
                <g
                  key={p.key}
                  className={`bubble bubble--${p.level} ${p.fav ? 'bubble--fav' : ''} ${selected ? 'bubble--selected' : ''}`}
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    tapPin(p);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.label}: ${plural(p.count, 'Anzeige', 'Anzeigen')}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      tapPin(p);
                    }
                  }}
                >
                  <circle className="bubble__hit" r={Math.max(r + u(4), u(23))} />
                  <circle r={r} strokeWidth={u(selected ? 3 : 2)} />
                  {p.fav && <path className="bubble__heart" transform={`translate(${r * 0.72} ${-r * 0.72}) scale(${u(0.62)})`} d="M0 6.5s-6.2-3.6-6.9-7.9c-.5-2.7 1.3-4.7 3.5-4.6 1.4 0 2.6.8 3.4 2.1.8-1.3 2-2.1 3.4-2.1 2.2-.1 4 1.9 3.5 4.6-.7 4.3-6.9 7.9-6.9 7.9Z" />}
                  <text style={{ fontSize: u(14) }}>{p.count}</text>
                  {showLabel && (
                    <text className="bubble__label" x={r + u(5)} y={0} style={{ fontSize: u(13.5), strokeWidth: u(3.5) }}>
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        <p className="map-legend hint" aria-hidden="true">
          <span className="legend-item">
            <span className="swatch swatch--has" /> mit Anzeigen
          </span>
          <span className="legend-item">
            <span className="swatch swatch--fav" /> Lieblingsort
          </span>
          <span className="legend-item">
            <span className="swatch swatch--home" /> Zuhause
          </span>
          {radius != null && (
            <span className="legend-item">
              <span className="swatch swatch--radius" /> Umkreis {radius} km
            </span>
          )}
        </p>
      </div>

      <div className="map-list-head">
        <h2 className="section-title" style={{ margin: 0 }}>
          {listTitle} <span className="count">({inSel.length})</span>
        </h2>
        {favTarget && (
          <button type="button" className={`btn btn--small ${favOn ? 'btn--primary' : ''}`} aria-pressed={favOn} onClick={() => store.setFavorite(favTarget.kind, favTarget.ref, !favOn)}>
            <IconHeart filled={favOn} width={18} height={18} /> {favOn ? 'Lieblingsort' : 'Als Lieblingsort'}
          </button>
        )}
      </div>
      {favTarget && !favOn && <p className="hint">Anzeigen aus Lieblingsorten stehen in Stapel und Liste ganz oben.</p>}

      {jobs.length === 0 ? (
        <Empty
          art="map"
          title={mode === 'gemerkt' ? 'Noch nichts auf der Karte' : 'Keine offenen Anzeigen'}
          text={mode === 'gemerkt' ? 'Gemerkte Anzeigen erscheinen hier an ihrem Ort. Oben auf „Alle“ tippen, um alle offenen Anzeigen zu sehen.' : 'Mit den aktuellen Filtern bleibt nichts übrig.'}
        />
      ) : (
        <>
          <ul className="list">
            {inSel.slice(0, limit).map((v: JobView) => (
              <JobRow key={v.job.id} v={v} />
            ))}
          </ul>
          {limit < inSel.length && (
            <div className="list-more">
              <button type="button" className="btn btn--small" onClick={() => setLimit((l) => l + 40)}>
                Weitere zeigen
              </button>
            </div>
          )}
          {!sel.state && unlocated.length > 0 && <p className="hint">{plural(unlocated.length, 'Anzeige hat', 'Anzeigen haben')} keinen erkannten Ort und steh{unlocated.length === 1 ? 't' : 'en'} nur in der Liste.</p>}
        </>
      )}
    </section>
  );
}
