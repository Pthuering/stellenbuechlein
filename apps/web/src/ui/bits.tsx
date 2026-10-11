// Kleine Bausteine: Herzchen, Score-Kreis, Stempel, leerer Zustand, Meldungen.

import type { ReactNode } from 'react';
import { IconHeart } from './icons';
import { useAppState, useStore } from '../data/hooks';

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
          fill={full ? 'var(--rosa)' : 'none'}
          stroke="var(--ink)"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {half && (
          <path
            clipPath={`url(#half-${i})`}
            d="M12 20.1s-7.6-4.4-8.4-9.6C3 7.2 5.2 4.8 7.9 4.9c1.7 0 3.1 1 4.1 2.6 1-1.6 2.4-2.6 4.1-2.6 2.7-.1 4.9 2.3 4.3 5.6-.8 5.2-8.4 9.6-8.4 9.6Z"
            fill="var(--rosa)"
          />
        )}
      </svg>
    );
  });
  if (!onChange) {
    return (
      <span className="hearts" role="img" aria-label={label ?? `${String(value).replace('.', ',')} von ${max} Herzen`}>
        {hearts}
      </span>
    );
  }
  return (
    <span className="hearts" role="group" aria-label={label ?? 'Wichtigkeit'}>
      {hearts.map((h, i) => (
        <button
          key={i}
          type="button"
          className="hearts"
          aria-label={`${i + 1} ${i === 0 ? 'Herz' : 'Herzen'}`}
          aria-pressed={i + 1 <= value}
          onClick={() => onChange((i + 1) as 1 | 2 | 3)}
        >
          {h}
        </button>
      ))}
    </span>
  );
}

/** Handgezeichneter Kreis um die Prozentzahl. */
export function ScoreRing({ value, size = 64, className = '' }: { value: number; size?: number; className?: string }) {
  const color = value >= 75 ? 'var(--rosa-deep)' : value >= 50 ? 'var(--altrosa-ink)' : 'var(--pencil)';
  return (
    <div className={`score ${className}`} style={{ width: size, height: size }} aria-label={`Passt zu ${value} Prozent`} role="img">
      <svg viewBox="0 0 70 70" aria-hidden="true">
        <ellipse cx="35" cy="35.5" rx="27.5" ry="26.5" fill="var(--card)" opacity="0.92" />
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
  const s = { fill: 'none', stroke: 'var(--ink)', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'heart') {
    return (
      <svg viewBox="0 0 140 120" aria-hidden="true">
        <path d="M70 102S28 79 24 50c-3-19 10-32 25-31 9 0 16 6 21 14 5-8 12-14 21-14 15-1 28 12 25 31-4 29-46 52-46 52Z" fill="var(--rosa-soft)" {...{ stroke: s.stroke, strokeWidth: s.strokeWidth, strokeLinejoin: s.strokeLinejoin }} />
        <path d="M44 40c3-6 8-9 14-8" {...s} />
        <path d="M108 22l6-6M116 30h8M24 22l-6-6" {...s} stroke="var(--rosa-deep)" />
      </svg>
    );
  }
  if (kind === 'map') {
    return (
      <svg viewBox="0 0 140 120" aria-hidden="true">
        <path d="M18 30 48 18l38 13 34-13v72l-34 13-38-13-30 12Z" fill="var(--rosa-soft)" {...{ stroke: s.stroke, strokeWidth: s.strokeWidth, strokeLinejoin: s.strokeLinejoin }} />
        <path d="M48 19v72M86 31v72" {...s} />
        <path d="M62 52s-9-9-9-16a9 9 0 1 1 18 0c0 7-9 16-9 16Z" fill="var(--rosa)" {...{ stroke: s.stroke, strokeWidth: 2 }} />
        <path d="M28 70c10 4 18-6 28 0s16 8 26 2 18-4 26 2" {...s} strokeDasharray="4 6" />
      </svg>
    );
  }
  if (kind === 'search') {
    return (
      <svg viewBox="0 0 140 120" aria-hidden="true">
        <circle cx="60" cy="54" r="30" fill="var(--butter-soft)" {...{ stroke: s.stroke, strokeWidth: s.strokeWidth }} />
        <path d="m82 76 26 26" {...s} strokeWidth={6} />
        <path d="M46 46c4-8 12-11 20-9" {...s} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 140 120" aria-hidden="true">
      <path d="M30 52h66l-6 38c-1 8-8 13-16 13H52c-8 0-15-5-16-13Z" fill="var(--butter-soft)" {...{ stroke: s.stroke, strokeWidth: s.strokeWidth, strokeLinejoin: s.strokeLinejoin }} />
      <path d="M96 60c12-2 18 6 14 14s-14 9-20 7" {...s} />
      <path d="M50 40c-4-6 4-10 0-17M64 40c-4-6 4-10 0-17M78 40c-4-6 4-10 0-17" {...s} stroke="var(--pencil)" />
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
