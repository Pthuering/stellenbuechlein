// Der Stapel: Karteikarten zum Wischen. Rechts = merken, links = weglegen, hoch/tippen = alles lesen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countActiveFilters, topReasons } from '@stellen/core';
import { useAppState, useDeck, useStore, type JobView } from '../data/hooks';
import { openJob } from '../lib/router';
import { deadlineOf, employerName, factChips, jobImage, laneLabel, placeLabel } from '../lib/format';
import { useTestPhotos } from '../data/testPhotos';
import { Polaroid } from '../ui/Polaroid';
import { Empty, ScoreRing } from '../ui/bits';
import { IconArrowUp, IconFilter, IconHeart, IconHistory, IconPin, IconStar, IconUndo, IconX } from '../ui/icons';
import { FilterSheet } from './FilterSheet';
import { HistorySheet } from './HistorySheet';
import { bridgeText } from './JobDetail';
import { srForm, texts } from '../i18n';
import { profileLabel } from '../i18n/katalog';

const t = texts({
  de: {
    fromHome: (km: string) => `${km} von zu Hause`,
    favorite: 'Lieblingsort',
    newSite: 'neue Website',
    demo: 'Dummy',
    deadlineUnsure: (date: string) => `Frist ${date}?`,
    deadlineUnclear: 'Frist unklar',
    checkOriginal: 'bitte im Original prüfen',
    deadline: (date: string) => `Frist ${date}`,
    noDeadline: 'Keine Frist angegeben',
    whyFit: 'Warum das passen könnte:',
    reasons: (list: string) => `passt wegen ${list}`,
    readAll: 'ganze Anzeige lesen',
    stampLike: 'Gemerkt!',
    stampNope: 'Nö.',
    stampStar: 'Herzensjob!',
    toastSaved: 'Gemerkt.',
    toastPassed: 'Weggelegt. Bleibt unter „Alle“.',
    toastStar: 'Herzensjob! Erinnerung kommt vor der Frist.',
    undo: 'Rückgängig',
    title: 'Stapel',
    allSeen: 'Alles durchgeschaut',
    waiting: (n: number) => (n === 1 ? '1 Anzeige wartet' : `${n} Anzeigen warten`),
    filterLabel: (n: number) => `Filter${n ? ` (${n} aktiv)` : ''}`,
    historyLabel: 'Verlauf: gemerkte und weggelegte Anzeigen',
    loading: 'Anzeigen werden geladen …',
    noPostings: 'Noch keine Anzeigen',
    firstCards: 'Sobald die Einsammel-Pipeline gelaufen ist, liegen hier die ersten Karten.',
    filteredOut: 'Mit den aktuellen Filtern ist nichts mehr übrig. Neue Anzeigen kommen täglich gegen 12 Uhr.',
    comeBack: 'Neue Anzeigen kommen täglich gegen 12 Uhr dazu, oder per „Jetzt einsammeln“ unter „Ich“.',
    viewHistory: 'Verlauf ansehen',
    changeFilters: 'Filter ändern',
    actions: 'Aktionen für die oberste Karte',
    passLabel: 'Weglegen (Nö)',
    starLabel: 'Herzensjob: merken und vor der Frist erinnern',
    save: 'Merken',
  },
  en: {
    fromHome: (km) => `${km} from home`,
    favorite: 'Favorite place',
    newSite: 'new website',
    demo: 'Demo',
    deadlineUnsure: (date) => `Deadline ${date}?`,
    deadlineUnclear: 'Deadline unclear',
    checkOriginal: 'please check the original',
    deadline: (date) => `Deadline ${date}`,
    noDeadline: 'No deadline given',
    whyFit: 'Why this could fit:',
    reasons: (list) => `fits because of ${list}`,
    readAll: 'read the full posting',
    stampLike: 'Saved!',
    stampNope: 'Nope.',
    stampStar: 'Dream job!',
    toastSaved: 'Saved.',
    toastPassed: 'Passed. It’s still under “All”.',
    toastStar: 'Dream job! You’ll get a reminder before the deadline.',
    undo: 'Undo',
    title: 'Stack',
    allSeen: 'All caught up',
    waiting: (n) => (n === 1 ? '1 posting waiting' : `${n} postings waiting`),
    filterLabel: (n) => (n ? `Filters (${n} active)` : 'Filters'),
    historyLabel: 'History: saved and passed postings',
    loading: 'Loading postings…',
    noPostings: 'No postings yet',
    firstCards: 'Once the collecting pipeline has run, the first cards will be here.',
    filteredOut: 'Nothing’s left with the current filters. New postings arrive daily around noon.',
    comeBack: 'New postings arrive daily around noon, or tap “Collect now” under “Me”.',
    viewHistory: 'View history',
    changeFilters: 'Change filters',
    actions: 'Actions for the top card',
    passLabel: 'Pass (nope)',
    starLabel: 'Dream job: save and remind me before the deadline',
    save: 'Save',
  },
  sr: {
    fromHome: (km) => `${km} od kuće`,
    favorite: 'Omiljeno mesto',
    newSite: 'novi sajt',
    demo: 'Demo',
    deadlineUnsure: (date) => `Rok ${date}?`,
    deadlineUnclear: 'Rok nejasan',
    checkOriginal: 'proveri u originalu',
    deadline: (date) => `Rok ${date}`,
    noDeadline: 'Rok nije naveden',
    whyFit: 'Zašto bi ovo moglo da odgovara:',
    reasons: (list) => `zašto odgovara: ${list}`,
    readAll: 'pročitaj ceo oglas',
    stampLike: 'Sačuvano!',
    stampNope: 'Ma ne.',
    stampStar: 'Posao iz snova!',
    toastSaved: 'Sačuvano.',
    toastPassed: 'Preskočeno. Ostaje u odeljku „Sve“.',
    toastStar: 'Posao iz snova! Podsetnik stiže pre roka.',
    undo: 'Opozovi',
    title: 'Špil',
    allSeen: 'Sve je pregledano',
    waiting: (n) => `${n} ${srForm(n, 'oglas čeka', 'oglasa čekaju', 'oglasa čeka')}`,
    filterLabel: (n) => (n ? `Filteri (aktivno: ${n})` : 'Filteri'),
    historyLabel: 'Istorija: sačuvani i preskočeni oglasi',
    loading: 'Učitavam oglase…',
    noPostings: 'Još nema oglasa',
    firstCards: 'Čim prikupljanje oglasa prođe prvi put, ovde će se pojaviti prve kartice.',
    filteredOut: 'Sa trenutnim filterima nije ostalo ništa. Novi oglasi stižu svaki dan oko podne.',
    comeBack: 'Novi oglasi stižu svaki dan oko podne, a možeš i da dodirneš „Prikupi sada“ u odeljku „Ja“.',
    viewHistory: 'Pogledaj istoriju',
    changeFilters: 'Promeni filtere',
    actions: 'Radnje za gornju karticu',
    passLabel: 'Preskoči (ma ne)',
    starLabel: 'Posao iz snova: sačuvaj i podseti me pre roka',
    save: 'Sačuvaj',
  },
});

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
  const testPhotos = useTestPhotos();
  const ref = useRef<HTMLElement>(null);
  const likeRef = useRef<HTMLSpanElement>(null);
  const nopeRef = useRef<HTMLSpanElement>(null);
  const starRef = useRef<HTMLSpanElement>(null);
  const drag = useRef({ x: 0, y: 0, dx: 0, dy: 0, t: 0, active: false, decided: false });
  const { job } = view;
  const inst = job.institutionId ? s.institutions.get(job.institutionId) : undefined;
  const city = view.place.cityId ? s.cities.get(view.place.cityId) : undefined;
  const img = jobImage(job, inst, city, testPhotos);
  const showPhoto = s.settings.ui.cardImages !== false;
  const place = placeLabel(city, view.place.distanceKm);
  const dl = deadlineOf(job);
  const reasons = topReasons(view.score, 3).map(profileLabel);
  const lane = view.lane.promoted || view.lane.lane !== 'kern' ? laneLabel(view.lane) : null;
  const why = view.lane.lane !== 'kern' ? (view.lane.reason ?? (view.lane.bridge ? bridgeText(view.lane.bridge) : null)) : null;
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
      aria-label={top ? `${job.title}, ${employerName(job, inst)}` : undefined}
    >
      {showPhoto ? (
        <>
          <div className="card__photo">
            <Polaroid
              src={img.src}
              credit={img.credit}
              seed={view.place.cityId ?? job.institutionId ?? job.id}
              caption={place.city}
              sub={place.km ? t.fromHome(place.km) : undefined}
              tilt={-tilt * 0.8}
            />
          </div>
          <ScoreRing className="card__score" value={view.score.score} size={68} />
          {view.favorite && (
            <span className="card__fav chip chip--primary">
              <IconHeart filled width={14} height={14} /> {t.favorite}
            </span>
          )}
        </>
      ) : (
        // Ohne Bild: Ort und Score in einer Kopfzeile, mehr Platz für den Text
        <div className="card__head">
          <div className="card__where">
            <span className="card__place">
              <IconPin width={16} height={16} /> {place.city}
              {place.km ? `, ${place.km}` : ''}
            </span>
            {view.favorite && (
              <span className="chip chip--primary chip--tiny">
                <IconHeart filled width={12} height={12} /> {t.favorite}
              </span>
            )}
          </div>
          <ScoreRing value={view.score.score} size={58} />
        </div>
      )}
      <div className="card__body">
        {(lane || job.newSite || job.dummy) && (
          <p className="card__tags">
            {lane && <span className="lane-tag">{lane}</span>}
            {job.newSite && <span className="chip chip--neutral chip--tiny">{t.newSite}</span>}
            {job.dummy && <span className="chip chip--neutral chip--tiny chip--dummy">{t.demo}</span>}
          </p>
        )}
        <p className="card__inst">
          {employerName(job, inst)}
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
          dl.unsure ? (
            <p className="card__deadline card__deadline--unsure">
              {dl.date ? t.deadlineUnsure(dl.date) : t.deadlineUnclear} <span>{t.checkOriginal}</span>
            </p>
          ) : (
            <p className="card__deadline">
              <span className={dl.urgent ? 'marker' : ''}>{t.deadline(dl.date ?? '')}</span> <span style={{ color: 'var(--text-muted)' }}>{dl.left}</span>
            </p>
          )
        ) : (
          <p className="card__deadline" style={{ color: 'var(--text-muted)' }}>
            {t.noDeadline}
          </p>
        )}
        {why ? (
          // Horizont-Karte: Die Begründung ist wichtiger als die Kurzfassung (die steht in der Anzeige)
          <p className="card__why">
            <b>{t.whyFit}</b> {why}
          </p>
        ) : (
          <>
            {job.summary && <p className="card__summary print">{job.summary}</p>}
            {reasons.length > 0 && <p className="card__reasons">{t.reasons(reasons.join(', '))}</p>}
          </>
        )}
      </div>
      {top && (
        <button type="button" className="card__more" onClick={() => openJob(job.id)}>
          <IconArrowUp width={16} height={16} /> {t.readAll}
        </button>
      )}
      <span ref={likeRef} className="stamp stamp--like" aria-hidden="true">
        {t.stampLike}
      </span>
      <span ref={nopeRef} className="stamp stamp--nope" aria-hidden="true">
        {t.stampNope}
      </span>
      <span ref={starRef} className="stamp stamp--star" aria-hidden="true">
        {t.stampStar}
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
        store.toast(t.toastSaved, { label: t.undo, run: undo });
      } else if (dir === 'left') {
        store.decide(v.job.id, 'abgelehnt');
        store.toast(t.toastPassed, { label: t.undo, run: undo });
      } else if (dir === 'star') {
        store.setStar(v.job.id, true, true);
        store.toast(t.toastStar, { label: t.undo, run: undo });
      }
    },
    [store, undo],
  );

  const top = deck[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || location.hash.includes('/stelle/')) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
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
            {t.title}
          </h1>
          <p className="page-sub">{waiting === 0 ? t.allSeen : t.waiting(waiting)}</p>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" className="icon-btn" onClick={() => setSheet('filter')} aria-label={t.filterLabel(activeFilters)}>
            <IconFilter width={24} height={24} />
            {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
          </button>
          <button type="button" className="icon-btn" onClick={() => setSheet('verlauf')} aria-label={t.historyLabel}>
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
            title={s.jobs.size === 0 ? (s.sync.busy ? t.loading : t.noPostings) : t.allSeen}
            text={s.jobs.size === 0 ? s.sync.error ?? t.firstCards : activeFilters ? t.filteredOut : t.comeBack}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="btn btn--small" onClick={() => setSheet('verlauf')}>
                {t.viewHistory}
              </button>
              {activeFilters > 0 && (
                <button type="button" className="btn btn--small btn--primary" onClick={() => setSheet('filter')}>
                  {t.changeFilters}
                </button>
              )}
            </div>
          </Empty>
        )}
      </div>

      <div className="deck-actions" aria-label={t.actions}>
        <button type="button" className="round-btn round-btn--small" onClick={undo} disabled={s.undo.length === 0} aria-label={t.undo}>
          <IconUndo />
        </button>
        <button type="button" className="round-btn round-btn--nope" onClick={() => api.current?.fly('left')} disabled={!top} aria-label={t.passLabel}>
          <IconX />
        </button>
        <button type="button" className="round-btn round-btn--star" onClick={() => api.current?.fly('star')} disabled={!top} aria-label={t.starLabel}>
          <IconStar />
        </button>
        <button type="button" className="round-btn round-btn--like" onClick={() => api.current?.fly('right')} disabled={!top} aria-label={t.save}>
          <IconHeart />
        </button>
      </div>

      {sheet === 'filter' && <FilterSheet onClose={() => setSheet(null)} />}
      {sheet === 'verlauf' && <HistorySheet onClose={() => setSheet(null)} onUndo={(id) => setPinned(id)} />}
    </section>
  );
}
