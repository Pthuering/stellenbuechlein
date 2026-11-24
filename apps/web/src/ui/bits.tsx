// Kleine Bausteine: Herzchen, Score-Kreis, Stempel, leerer Zustand, Meldungen.

import type { ReactNode } from 'react';
import { isOuterLane, type Lane } from '@stellen/core';
import { IconHeart } from './icons';
import { useAppState, useStore } from '../data/hooks';
import { fmtNum, srForm, texts } from '../i18n';

const t = texts({
  de: {
    heartsOf: (v: number, max: number) => `${fmtNum(v)} von ${max} Herzen`,
    importance: 'Wichtigkeit',
    hearts: (n: number) => `${n} ${n === 1 ? 'Herz' : 'Herzen'}`,
    match: (v: number) => `Passt zu ${v} Prozent`,
    bridgeCard: 'Brücken-Karte, ohne Prozentzahl',
    horizonCard: 'Horizont-Karte, ohne Prozentzahl',
  },
  en: {
    heartsOf: (v, max) => `${fmtNum(v)} of ${max} hearts`,
    importance: 'Importance',
    hearts: (n) => `${n} ${n === 1 ? 'heart' : 'hearts'}`,
    match: (v) => `${v} percent match`,
    bridgeCard: 'Bridge card, no match percentage',
    horizonCard: 'Horizon card, no match percentage',
  },
  sr: {
    heartsOf: (v, max) => `${fmtNum(v)} od ${max} srca`,
    importance: 'Važnost',
    hearts: (n) => `${n} ${srForm(n, 'srce', 'srca', 'srca')}`,
    match: (v) => `Poklapanje ${v} posto`,
    bridgeCard: 'Kartica preko mosta, bez procenta poklapanja',
    horizonCard: 'Kartica sa horizonta, bez procenta poklapanja',
  },
});

export function Hearts({ value, max = 3, onChange, label }: { value: number; max?: number; onChange?: (v: 1 | 2 | 3) => void; label?: string }) {
  const hearts = Array.from({ length: max }, (_, i) => {
    const full = i + 1 <= value;
    const half = !full && i + 0.5 <= value;
    return (
      <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <clipPath id={`half-${i}`}>
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
        <path
          d="M12 20.1s-7.6-4.4-8.4-9.6C3 7.2 5.2 4.8 7.9 4.9c1.7 0 3.1 1 4.1 2.6 1-1.6 2.4-2.6 4.1-2.6 2.7-.1 4.9 2.3 4.3 5.6-.8 5.2-8.4 9.6-8.4 9.6Z"
          fill={full ? 'var(--primary)' : 'none'}
          stroke="var(--text)"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {half && (
          <path
            clipPath={`url(#half-${i})`}
            d="M12 20.1s-7.6-4.4-8.4-9.6C3 7.2 5.2 4.8 7.9 4.9c1.7 0 3.1 1 4.1 2.6 1-1.6 2.4-2.6 4.1-2.6 2.7-.1 4.9 2.3 4.3 5.6-.8 5.2-8.4 9.6-8.4 9.6Z"
            fill="var(--primary)"
          />
        )}
      </svg>
    );
  });
  if (!onChange) {
    return (
      <span className="hearts" role="img" aria-label={label ?? t.heartsOf(value, max)}>
        {hearts}
      </span>
    );
  }
  return (
    <span className="hearts" role="group" aria-label={label ?? t.importance}>
      {hearts.map((h, i) => (
        <button
          key={i}
          type="button"
          className="hearts"
          aria-label={t.hearts(i + 1)}
          aria-pressed={i + 1 <= value}
          onClick={() => onChange((i + 1) as 1 | 2 | 3)}
        >
          {h}
        </button>
      ))}
    </span>
  );
}

/**
 * Farbe der Prozentzahlen: immer das kräftige Rot, auch bei niedriger Passung (Wunsch vom 24.11.2026; vorher
 * wurde sie unter 75 % blasser und unter 50 % grau). Die Zahl selbst sagt, wie gut es passt.
 */
export const SCORE_COLOR = 'var(--primary-strong)';

/** Handgezeichneter Kreis um die Prozentzahl. */
export function ScoreRing({ value, size = 64, className = '' }: { value: number; size?: number; className?: string }) {
  const color = SCORE_COLOR;
  return (
    <div className={`score ${className}`} style={{ width: size, height: size }} aria-label={t.match(value)} role="img">
      <svg viewBox="0 0 70 70" aria-hidden="true">
        <ellipse cx="35" cy="35.5" rx="27.5" ry="26.5" fill="var(--surface-raised)" opacity="0.92" />
        <path
          d="M36 7.5C52.5 6.6 63.6 18.3 63.4 34.6 63.2 51.7 51.2 63.7 34.4 63.4 17.6 63.1 6.4 51 6.7 34.6 7 18.9 18.7 7.9 35.4 8.4c8.1.3 14.2 3.6 18.4 8.6"
          fill="none"
          stroke={color}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="score__num" style={{ fontSize: size * 0.36, color }}>
        {value}
        <small>%</small>
      </span>
    </div>
  );
}

/**
 * Symbole der Karten außerhalb des Kerns (gleiche Farbe, anderes Bild): Brücke (intern „horizont“) als kleine
 * Bogenbrücke, Horizont (intern „weite“) als halbe Sonne über der Linie. Koordinaten im 70er-Raster des Score-Kreises.
 */
function OuterSymbol({ lane }: { lane: Lane }) {
  if (lane === 'horizont') {
    // Bogenbrücke mit Geländer über dem Wasser
    return (
      <>
        <path d="M15 37.2c6.8-.4 13.6.3 20.2 0 6.8-.3 13.3.2 19.8-.1" />
        <path d="M15.6 31.6c6.6-.3 13.2.2 19.6 0 6.6-.2 12.9.2 19.2 0" />
        <path d="M16.5 31.8v5.2M53.6 31.6v5.4M35 31.7v5.3" />
        <path d="M18 48.5c3.6-7.4 9.6-11.2 17-11.2s13.4 3.8 17 11.2" />
        <path d="M18.5 54.2c2.4-1.5 4.8-1.5 7.2 0s4.8 1.5 7.2 0 4.8-1.5 7.2 0 4.8 1.5 7.2 0 4.8-1.5 7.2 0" />
      </>
    );
  }
  return (
    <>
      <path d="M25.5 41.5a9.5 9.5 0 0 1 19 0" />
      <path d="M18.5 41.8c5.6-.5 11.6.3 17.2-.2 5.4-.4 10.4.2 15.8 0" />
      <path d="M24 48.2c4.2-.3 8.6.2 12.6-.1 3.4-.2 6.6.1 9.6 0" />
      <path d="M35 24.5v4" />
      <path d="M23.6 29.4l2.6 2.6" />
      <path d="M46.4 29.4l-2.6 2.6" />
    </>
  );
}

const outerLabel = (lane: Lane) => (lane === 'horizont' ? t.bridgeCard : t.horizonCard);

/**
 * Kennung der Brücken- und Horizont-Karten: derselbe handgezeichnete Kreis wie bei der Passung, aber lavendelfarben
 * und mit Symbol statt Zahl. Diese Karten haben bewusst keine Passung in Prozent.
 */
export function OuterRing({ lane, size = 64, className = '' }: { lane: Lane; size?: number; className?: string }) {
  const color = 'var(--secondary-strong)';
  return (
    <div className={`score score--outer ${className}`} style={{ width: size, height: size }} aria-label={outerLabel(lane)} role="img">
      <svg viewBox="0 0 70 70" aria-hidden="true">
        <ellipse cx="35" cy="35.5" rx="27.5" ry="26.5" fill="var(--secondary-soft)" opacity="0.95" />
        <path
          d="M36 7.5C52.5 6.6 63.6 18.3 63.4 34.6 63.2 51.7 51.2 63.7 34.4 63.4 17.6 63.1 6.4 51 6.7 34.6 7 18.9 18.7 7.9 35.4 8.4c8.1.3 14.2 3.6 18.4 8.6"
          fill="none"
          stroke={color}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <g fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <OuterSymbol lane={lane} />
        </g>
      </svg>
    </div>
  );
}

/** Kleines Symbol für Listen (an der Stelle der Prozentzahl). */
export function OuterIcon({ lane, size = 28 }: { lane: Lane; size?: number }) {
  return (
    <svg className="mini-outer" width={size} height={size} viewBox={lane === 'horizont' ? '12 25 46 34' : '15 20 40 32'} role="img" aria-label={outerLabel(lane)}>
      <g fill="none" stroke="var(--secondary-strong)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <OuterSymbol lane={lane} />
      </g>
    </svg>
  );
}

/** Passung in Prozent; bei Brücken- und Horizont-Karten stattdessen ihr Symbol. */
export function MatchMark({ value, lane, size = 64, className = '' }: { value: number; lane: Lane; size?: number; className?: string }) {
  return isOuterLane(lane) ? <OuterRing lane={lane} size={size} className={className} /> : <ScoreRing value={value} size={size} className={className} />;
}

export function Empty({ title, text, children, art = 'teacup' }: { title: string; text?: string; children?: ReactNode; art?: 'teacup' | 'map' | 'heart' | 'search' }) {
  return (
    <div className="empty">
      <Doodle kind={art} />
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

/** Kleine Zeichnungen für leere Seiten. */
export function Doodle({ kind }: { kind: 'teacup' | 'map' | 'heart' | 'search' }) {
  const s = { fill: 'none', stroke: 'var(--text)', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'heart') {
    return (
      <svg viewBox="0 0 140 120" aria-hidden="true">
        <path d="M70 102S28 79 24 50c-3-19 10-32 25-31 9 0 16 6 21 14 5-8 12-14 21-14 15-1 28 12 25 31-4 29-46 52-46 52Z" fill="var(--primary-soft)" {...{ stroke: s.stroke, strokeWidth: s.strokeWidth, strokeLinejoin: s.strokeLinejoin }} />
        <path d="M44 40c3-6 8-9 14-8" {...s} />
        <path d="M108 22l6-6M116 30h8M24 22l-6-6" {...s} stroke="var(--primary-strong)" />
      </svg>
    );
  }
  if (kind === 'map') {
    return (
      <svg viewBox="0 0 140 120" aria-hidden="true">
        <path d="M18 30 48 18l38 13 34-13v72l-34 13-38-13-30 12Z" fill="var(--primary-soft)" {...{ stroke: s.stroke, strokeWidth: s.strokeWidth, strokeLinejoin: s.strokeLinejoin }} />
        <path d="M48 19v72M86 31v72" {...s} />
        <path d="M62 52s-9-9-9-16a9 9 0 1 1 18 0c0 7-9 16-9 16Z" fill="var(--primary)" {...{ stroke: s.stroke, strokeWidth: 2 }} />
        <path d="M28 70c10 4 18-6 28 0s16 8 26 2 18-4 26 2" {...s} strokeDasharray="4 6" />
      </svg>
    );
  }
  if (kind === 'search') {
    return (
      <svg viewBox="0 0 140 120" aria-hidden="true">
        <circle cx="60" cy="54" r="30" fill="var(--accent-soft)" {...{ stroke: s.stroke, strokeWidth: s.strokeWidth }} />
        <path d="m82 76 26 26" {...s} strokeWidth={6} />
        <path d="M46 46c4-8 12-11 20-9" {...s} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 140 120" aria-hidden="true">
      <path d="M30 52h66l-6 38c-1 8-8 13-16 13H52c-8 0-15-5-16-13Z" fill="var(--accent-soft)" {...{ stroke: s.stroke, strokeWidth: s.strokeWidth, strokeLinejoin: s.strokeLinejoin }} />
      <path d="M96 60c12-2 18 6 14 14s-14 9-20 7" {...s} />
      <path d="M50 40c-4-6 4-10 0-17M64 40c-4-6 4-10 0-17M78 40c-4-6 4-10 0-17" {...s} stroke="var(--text-muted)" />
      <path d="M22 110h96" {...s} />
      <path d="M57 70c3 3 9 3 12 0" {...s} />
      <path d="M54 63h.5M72 63h.5" {...s} strokeWidth={3.2} />
    </svg>
  );
}

export function Toasts() {
  const s = useAppState();
  const store = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {s.toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.run();
                store.dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function HeartIcon({ filled }: { filled?: boolean }) {
  return <IconHeart filled={filled} />;
}
