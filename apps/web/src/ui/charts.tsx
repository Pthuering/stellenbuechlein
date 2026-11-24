// Kleine Diagramme für die Statistik: gestapelte Säulen (mit Tooltip beim Zeigen oder Tippen), waagerechte Balken
// mit direkter Beschriftung, Kennzahl-Kacheln und eine Tabellenansicht. Farben nur über die Rollen --chart-*
// (tokens.css), damit Tag und Nacht ihre eigenen, geprüften Stufen bekommen.

import { useState, type CSSProperties, type ReactNode } from 'react';
import { LANG_TAGS, lang } from '../i18n';

/** Ganze Zahl mit Tausenderpunkt in der Sprache der App. */
export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString(LANG_TAGS[lang()]);
}

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS-Farbe, z. B. var(--chart-normal) */
  color: string;
}

export function Legend({ series }: { series: ChartSeries[] }) {
  return (
    <ul className="viz-legend">
      {series.map((s) => (
        <li key={s.key}>
          <span className="viz-legend__swatch" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Runde Obergrenze für die Achse (1, 2, 5 × Zehnerpotenz). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Tooltip neben der Säule halten: links verankert, mittig oder rechts verankert, damit er nicht über den Rand ragt. */
function tipPlace(pos: number): CSSProperties {
  if (pos < 0.35) return { left: `${pos * 100}%` };
  if (pos > 0.65) return { right: `${(1 - pos) * 100}%` };
  return { left: `${pos * 100}%`, transform: 'translateX(-50%)' };
}

/** Säule mit abgerundeten oberen Ecken (4 px), unten an der Grundlinie gerade. */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Gestapelte Säulen: je Kategorie (x) eine Säule, Segmente je Reihe. values[i][k] = Wert der Reihe k in Kategorie i.
 * Zwischen den Segmenten 2 px Abstand, die oberste Kante abgerundet; Zeigen oder Tippen zeigt alle Werte der Säule.
 */
export function StackedBars({
  labels,
  series,
  values,
  ariaLabel,
  totalLabel,
  tipLabels,
  height = 170,
}: {
  labels: string[];
  series: ChartSeries[];
  values: number[][];
  ariaLabel: string;
  totalLabel: string;
  /** ausführlichere Bezeichnung im Tooltip (z. B. mit Uhrzeit) */
  tipLabels?: string[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340;
  const H = height;
  const pad = { l: 34, r: 6, t: 8, b: 20 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const totals = values.map((v) => v.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(0, ...totals));
  const n = Math.max(1, labels.length);
  const slot = plotW / n;
  const barW = Math.max(3, Math.min(22, slot * 0.68));
  const step = Math.ceil(n / 6);
  const y = (v: number) => pad.t + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <div className="viz-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tv)} y2={y(tv)} className="viz-grid" />
            <text x={pad.l - 5} y={y(tv) + 3.5} textAnchor="end" className="viz-axis">
              {fmtInt(tv)}
            </text>
          </g>
        ))}
        {values.map((vals, i) => {
          const x = pad.l + i * slot + (slot - barW) / 2;
          let base = pad.t + plotH;
          const segs: ReactNode[] = [];
          const last = vals.reduce((idx, v, k) => (v > 0 ? k : idx), -1);
          vals.forEach((v, k) => {
            if (v <= 0) return;
            const h = (v / max) * plotH;
            const gap = k === last ? 0 : Math.min(2, h / 2);
            const top = base - h;
            segs.push(
              k === last ? (
                <path key={k} d={topRounded(x, top, barW, h, 4)} fill={series[k].color} />
              ) : (
                <rect key={k} x={x} y={top + gap} width={barW} height={Math.max(0, h - gap)} fill={series[k].color} />
              ),
            );
            base = top;
          });
          return (
            <g key={i} className={hover === i ? 'viz-col viz-col--active' : 'viz-col'}>
              {segs}
              {/* Trefferfläche: die ganze Spalte, größer als die Säule */}
              <rect
                x={pad.l + i * slot}
                y={pad.t}
                width={slot}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onClick={() => setHover((h) => (h === i ? null : i))}
              />
              {(n - 1 - i) % step === 0 && (
                <text x={x + barW / 2} y={H - 5} textAnchor="middle" className="viz-axis">
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="viz-tip" style={tipPlace((pad.l + hover * slot + slot / 2) / W)} role="status">
          <b>{tipLabels?.[hover] ?? labels[hover]}</b>
          {series.map((s, k) => (
            <span key={s.key}>
              <i style={{ background: s.color }} aria-hidden="true" /> {s.label}: {fmtInt(values[hover][k] ?? 0)}
            </span>
          ))}
          {series.length > 1 && (
            <span className="viz-tip__total">
              {totalLabel}: {fmtInt(totals[hover])}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Waagerechte Balken mit Wert am Ende (eine Größe, eine Farbe). */
export function HBars({
  rows,
  color = 'var(--chart-wert)',
  format = fmtInt,
  max,
  ariaLabel,
}: {
  rows: { key: string; label: string; value: number; note?: string }[];
  color?: string;
  format?: (v: number) => string;
  max?: number;
  ariaLabel: string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="viz-hbars" aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="viz-hbars__label">{r.label}</span>
          <span className="viz-hbars__track">
            <span className="viz-hbars__bar" style={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / top) * 100)}%`, background: color }} />
          </span>
          <span className="viz-hbars__value">
            {format(r.value)}
            {r.note && <small>{r.note}</small>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Kennzahl-Kacheln: große Zahl, Bezeichnung, optional ein Satz darunter. */
export function Tiles({ items }: { items: { key: string; label: string; value: string; sub?: string }[] }) {
  return (
    <div className="viz-tiles">
      {items.map((it) => (
        <div key={it.key} className="viz-tile">
          <span className="viz-tile__value">{it.value}</span>
          <span className="viz-tile__label">{it.label}</span>
          {it.sub && <small className="viz-tile__sub">{it.sub}</small>}
        </div>
      ))}
    </div>
  );
}

/** Tabellenansicht zu einem Diagramm (aufklappbar). */
export function DataTable({ summary, head, rows }: { summary: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="viz-table">
      <summary>{summary}</summary>
      <div className="viz-table__scroll">
        <table>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{typeof c === 'number' ? fmtInt(c) : c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
