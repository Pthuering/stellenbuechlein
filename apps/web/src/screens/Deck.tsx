// Der Stapel: Karteikarten zum Wischen. Rechts = merken, links = weglegen, hoch/tippen = alles lesen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countActiveFilters, topReasons } from '@stellen/core';
import { useAppState, useDeck, useStore, type JobView } from '../data/hooks';
import { openJob } from '../lib/router';
import { deadlineInfo, factChips, imageFor, institutionName, placeLabel } from '../lib/format';
import { Polaroid } from '../ui/Polaroid';
import { Empty, ScoreRing } from '../ui/bits';
import { IconArrowUp, IconFilter, IconHeart, IconHistory, IconStar, IconUndo, IconX } from '../ui/icons';
import { FilterSheet } from './FilterSheet';
import { HistorySheet } from './HistorySheet';

type Dir = 'left' | 'right' | 'up' | 'star';

function tiltOf(id: string, range = 1.6): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * range;
}

interface CardApi {
  fly(dir: Dir): void;
}

function DeckCard({
  view,
  depth,
  apiRef,
  onDecide,
}: {
  view: JobView;
  depth: number;
  apiRef?: React.MutableRefObject<CardApi | null>;
  onDecide?: (dir: Dir) => void;
}) {
  const s = useAppState();
  const ref = useRef<HTMLElement>(null);
  const likeRef = useRef<HTMLSpanElement>(null);
  const nopeRef = useRef<HTMLSpanElement>(null);
  const starRef = useRef<HTMLSpanElement>(null);
  const drag = useRef({ x: 0, y: 0, dx: 0, dy: 0, t: 0, active: false, decided: false });
  const { job } = view;
  const inst = job.institutionId ? s.institutions.get(job.institutionId) : undefined;
  const city = view.place.cityId ? s.cities.get(view.place.cityId) : undefined;
  const img = imageFor(job, inst, city);
  const place = placeLabel(city, view.place.distanceKm);
  const dl = deadlineInfo(job.deadline);
  const reasons = topReasons(view.score, 3);
  const tilt = tiltOf(job.id);
  const top = depth === 0;

  const baseTransform = top ? `rotate(${tilt}deg)` : `translateY(${depth * 10}px) scale(${1 - depth * 0.035}) rotate(${tilt}deg)`;

  const setStamps = (like: number, nope: number, star: number) => {
    if (likeRef.current) likeRef.current.style.opacity = String(like);
    if (nopeRef.current) nopeRef.current.style.opacity = String(nope);
    if (starRef.current) starRef.current.style.opacity = String(star);
  };

  const fly = useCallback(
    (dir: Dir) => {
      const el = ref.current;
      if (!el || drag.current.decided) return;
      if (dir === 'up') {
        openJob(job.id);
        return;
      }
      drag.current.decided = true;
      const w = el.offsetWidth;
      el.classList.remove('card--settle');
      el.classList.add('card--flying');
      if (dir === 'right' || dir === 'star') {
        setStamps(dir === 'right' ? 1 : 0, 0, dir === 'star' ? 1 : 0);
        el.style.transform = `translate(${w * 1.35}px, ${drag.current.dy - 40}px) rotate(22deg)`;
      } else {
        setStamps(0, 1, 0);
        el.style.transform = `translate(${-w * 1.35}px, ${drag.current.dy - 40}px) rotate(-22deg)`;
      }
      el.style.opacity = '0.2';
      window.setTimeout(() => onDecide?.(dir), 260);
    },
    [job.id, onDecide],
  );

  useEffect(() => {
    if (top && apiRef) apiRef.current = { fly };
    return () => {
      if (top && apiRef && apiRef.current?.fly === fly) apiRef.current = null;
    };
  }, [top, apiRef, fly]);

  const onDown = (e: React.PointerEvent) => {
    if (!top || (e.target as HTMLElement).closest('button, a')) return;
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, t: Date.now(), active: true, decided: false };
    ref.current?.classList.remove('card--settle');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || !ref.current) return;
    d.dx = e.clientX - d.x;
    d.dy = e.clientY - d.y;
    const rot = tilt + d.dx / 18;
    ref.current.style.transform = `translate(${d.dx}px, ${d.dy}px) rotate(${rot}deg)`;
    const w = ref.current.offsetWidth || 320;
    setStamps(Math.max(0, Math.min(1, d.dx / (w * 0.32))), Math.max(0, Math.min(1, -d.dx / (w * 0.32))), 0);
  };

  const onUp = () => {
    const d = drag.current;
    if (!d.active || !ref.current) return;
    d.active = false;
    const el = ref.current;
    const w = el.offsetWidth || 320;
    const dt = Math.max(1, Date.now() - d.t);
    const vx = d.dx / dt;
    const moved = Math.hypot(d.dx, d.dy);
    if (moved < 6 && dt < 350) {
      el.style.transform = '';
      openJob(job.id);
      return;
    }
    if (d.dx > w * 0.33 || (vx > 0.6 && d.dx > 40)) return fly('right');
    if (d.dx < -w * 0.33 || (vx < -0.6 && d.dx < -40)) return fly('left');
    if (d.dy < -90 && Math.abs(d.dx) < 90) {
      el.classList.add('card--settle');
      el.style.transform = '';
      setStamps(0, 0, 0);
      openJob(job.id);
      return;
    }
    el.classList.add('card--settle');
    el.style.transform = '';
    setStamps(0, 0, 0);
  };

  return (
    <article
      ref={ref}
      className={`card ${top ? 'card--top' : 'card--behind'} card--settle`}
      style={{ ['--tilt' as string]: `${tilt}deg`, transform: top ? undefined : baseTransform, zIndex: 3 - depth }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-hidden={!top}
      aria-label={top ? `${job.title}, ${institutionName(inst)}` : undefined}
    >
      <div className="card__photo">
        <Polaroid
          src={img.src}
          credit={img.credit}
          seed={view.place.cityId ?? job.institutionId ?? job.id}
          caption={place.city}
          sub={place.km ? `${place.km} von zu Hause` : undefined}
          tilt={-tilt * 0.8}
        />
      </div>
      <ScoreRing className="card__score" value={view.score.score} size={68} />
      {view.favorite && (
        <span className="card__fav chip chip--rosa">
          <IconHeart filled width={14} height={14} /> Lieblingsort
        </span>
      )}
      <div className="card__body">
        <p className="card__inst">
          {institutionName(inst)}
          {job.department ? `, ${job.department}` : ''}
        </p>
        <h2 className="card__title">{job.title}</h2>
        <div className="chips">
          {factChips(job).map((c) => (
            <span key={c.text} className={`chip chip--${c.tone}`}>
              {c.text}
            </span>
          ))}
        </div>
        {dl ? (
          <p className="card__deadline">
            <span className={dl.urgent ? 'marker' : 'marker marker--rosa'}>Frist {dl.date}</span> {dl.left}
          </p>
        ) : (
          <p className="card__deadline" style={{ color: 'var(--pencil)' }}>
            Keine Frist angegeben
          </p>
        )}
        {job.summary && <p className="card__summary print">{job.summary}</p>}
        {reasons.length > 0 && <p className="card__reasons">passt wegen {reasons.join(', ')}</p>}
      </div>
      {top && (
        <button type="button" className="card__more" onClick={() => openJob(job.id)}>
          <IconArrowUp width={16} height={16} /> ganze Anzeige lesen
        </button>
      )}
      <span ref={likeRef} className="stamp stamp--like" aria-hidden="true">
        Gemerkt!
      </span>
      <span ref={nopeRef} className="stamp stamp--nope" aria-hidden="true">
        Nö.
      </span>
      <span ref={starRef} className="stamp stamp--star" aria-hidden="true">
        Herzensjob!
      </span>
    </article>
  );
}

export function DeckScreen() {
  const s = useAppState();
  const store = useStore();
  const deckRaw = useDeck();
  const [pinned, setPinned] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'filter' | 'verlauf' | null>(null);
  const api = useRef<CardApi | null>(null);
  const activeFilters = countActiveFilters(s.settings.filter);

  // Nach "Rückgängig" kommt die Karte oben auf den Stapel zurück.
  const deck = useMemo(() => {
    if (!pinned) return deckRaw;
    const i = deckRaw.findIndex((v) => v.job.id === pinned);
    if (i <= 0) return deckRaw;
    return [deckRaw[i], ...deckRaw.slice(0, i), ...deckRaw.slice(i + 1)];
  }, [deckRaw, pinned]);

  const undo = useCallback(() => {
    const id = store.undo();
    if (id) setPinned(id);
  }, [store]);

  const decide = useCallback(
    (v: JobView, dir: Dir) => {
      setPinned(null);
      if (dir === 'right') {
        store.decide(v.job.id, 'gemerkt');
        store.toast('Gemerkt.', { label: 'Rückgängig', run: undo });
      } else if (dir === 'left') {
        store.decide(v.job.id, 'abgelehnt');
        store.toast('Weggelegt. Bleibt unter „Alle“.', { label: 'Rückgängig', run: undo });
      } else if (dir === 'star') {
        store.setStar(v.job.id, true, true);
        store.toast('Herzensjob! Erinnerung kommt vor der Frist.', { label: 'Rückgängig', run: undo });
      }
    },
    [store, undo],
  );

  const top = deck[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || location.hash.includes('/stelle/')) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') api.current?.fly('right');
      else if (e.key === 'ArrowLeft') api.current?.fly('left');
      else if (e.key === 'ArrowUp' && top) openJob(top.job.id);
      else if (e.key.toLowerCase() === 's') api.current?.fly('star');
      else if (e.key.toLowerCase() === 'z' || e.key === 'Backspace') undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, sheet, undo]);

  const waiting = deck.length;
  return (
    <section className="screen screen--deck paper" aria-labelledby="deck-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="deck-title">
            Stapel
          </h1>
          <p className="page-sub">{waiting === 0 ? 'Alles durchgeschaut' : waiting === 1 ? '1 Anzeige wartet' : `${waiting} Anzeigen warten`}</p>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" className="icon-btn" onClick={() => setSheet('filter')} aria-label={`Filter${activeFilters ? ` (${activeFilters} aktiv)` : ''}`}>
            <IconFilter width={24} height={24} />
            {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
          </button>
          <button type="button" className="icon-btn" onClick={() => setSheet('verlauf')} aria-label="Verlauf: gemerkte und weggelegte Anzeigen">
            <IconHistory width={24} height={24} />
          </button>
        </div>
      </div>

      <div className="deck">
        {top ? (
          deck
            .slice(0, 3)
            .map((v, i) => ({ v, i }))
            .reverse()
            .map(({ v, i }) => <DeckCard key={v.job.id} view={v} depth={i} apiRef={i === 0 ? api : undefined} onDecide={i === 0 ? (dir) => decide(v, dir) : undefined} />)
        ) : (
          <Empty
            title={s.jobs.size === 0 ? (s.sync.busy ? 'Anzeigen werden geladen …' : 'Noch keine Anzeigen') : 'Alles durchgeschaut'}
            text={
              s.jobs.size === 0
                ? s.sync.error ?? 'Sobald die Einsammel-Pipeline gelaufen ist, liegen hier die ersten Karten.'
                : activeFilters
                  ? 'Mit den aktuellen Filtern ist nichts mehr übrig. Neue Anzeigen kommen zweimal am Tag.'
                  : 'Neue Anzeigen kommen zweimal am Tag dazu.'
            }
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="btn btn--small" onClick={() => setSheet('verlauf')}>
                Verlauf ansehen
              </button>
              {activeFilters > 0 && (
                <button type="button" className="btn btn--small btn--primary" onClick={() => setSheet('filter')}>
                  Filter ändern
                </button>
              )}
            </div>
          </Empty>
        )}
      </div>

      <div className="deck-actions" aria-label="Aktionen für die oberste Karte">
        <button type="button" className="round-btn round-btn--small" onClick={undo} disabled={s.undo.length === 0} aria-label="Rückgängig">
          <IconUndo />
        </button>
        <button type="button" className="round-btn round-btn--nope" onClick={() => api.current?.fly('left')} disabled={!top} aria-label="Weglegen (Nö)">
          <IconX />
        </button>
        <button type="button" className="round-btn round-btn--star" onClick={() => api.current?.fly('star')} disabled={!top} aria-label="Herzensjob: merken und vor der Frist erinnern">
          <IconStar />
        </button>
        <button type="button" className="round-btn round-btn--like" onClick={() => api.current?.fly('right')} disabled={!top} aria-label="Merken">
          <IconHeart />
        </button>
      </div>

      {sheet === 'filter' && <FilterSheet onClose={() => setSheet(null)} />}
      {sheet === 'verlauf' && <HistorySheet onClose={() => setSheet(null)} onUndo={(id) => setPinned(id)} />}
    </section>
  );
}
