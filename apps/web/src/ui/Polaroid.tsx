// Polaroid mit Foto (Anzeige → Einrichtung → Stadt) oder, wenn keins da ist, einer gezeichneten Postkarte.

import { useState, type ReactNode } from 'react';
import { texts } from '../i18n';

const t = texts({
  de: { sketch: 'Skizze der Stadt (noch kein Foto)' },
  en: { sketch: 'Sketch of the city (no photo yet)' },
  sr: { sketch: 'Skica grada (još nema fotografije)' },
});

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

// Ruhige Skizze als Platzhalter, solange es kein Foto gibt: eine Linie in Altrosa auf hellem Grund,
// ohne Sonne, Fenster und bunte Flächen – sie soll neben dem Text zurücktreten.
// Feste Farben: Die Postkarte ist ein "Abzug" und sieht im hellen wie im dunklen Notizbuch gleich aus.
const GROUND_FILL = '#f8f0e8';
const BACK = '#f6dfe6';
const LINE = '#d98fa5';

/** Gezeichnete Stadt-Silhouette, je Ort immer gleich. */
export function CityDoodle({ seed }: { seed: string }) {
  const r = rng(hashOf(seed));
  const ground = 136;
  const back: ReactNode[] = [];
  const front: ReactNode[] = [];
  // hintere Reihe: weiche Flächen ohne Kontur
  let bx = 4;
  let j = 0;
  while (bx < 316) {
    const w = 34 + Math.floor(r() * 30);
    const h = 40 + Math.floor(r() * 46);
    back.push(<rect key={`h${j}`} x={bx} y={ground - h} width={w} height={h} rx={2} fill={BACK} />);
    bx += w + 2;
    j++;
  }
  // vordere Reihe: weiße Häuser mit feiner Kontur
  const stroke = { stroke: LINE, strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  let x = 22 + Math.floor(r() * 10);
  let i = 0;
  while (x < 290) {
    const w = 24 + Math.floor(r() * 22);
    const h = 26 + Math.floor(r() * 40);
    const top = ground - h;
    const roof = r();
    front.push(<path key={`b${i}`} d={`M${x} ${ground}V${top}h${w}V${ground}`} fill="#ffffff" {...stroke} />);
    if (roof < 0.4) {
      front.push(<path key={`r${i}`} d={`M${x - 2} ${top}L${x + w / 2} ${top - 12 - r() * 8}L${x + w + 2} ${top}Z`} fill="#ffffff" {...stroke} />);
    } else if (roof < 0.58) {
      front.push(<path key={`r${i}`} d={`M${x + 3} ${top}a${w / 2 - 3} ${w / 2 - 3} 0 0 1 ${w - 6} 0`} fill="#ffffff" {...stroke} />);
    } else if (roof < 0.7) {
      const tw = Math.max(9, w * 0.38);
      front.push(<path key={`t${i}`} d={`M${x + w / 2 - tw / 2} ${top}v-14h${tw}v14`} fill="#ffffff" {...stroke} />);
      front.push(<path key={`tr${i}`} d={`M${x + w / 2 - tw / 2 - 2} ${top - 14}L${x + w / 2} ${top - 28}L${x + w / 2 + tw / 2 + 2} ${top - 14}Z`} fill="#ffffff" {...stroke} />);
    }
    x += w + 10 + Math.floor(r() * 16);
    i++;
  }
  return (
    <svg className="polaroid__img polaroid__img--sketch" viewBox="0 0 320 170" preserveAspectRatio="xMidYMid slice" role="img" aria-label={t.sketch}>
      <rect width="320" height="170" fill={GROUND_FILL} />
      {back}
      {front}
      <path d={`M8 ${ground}h304`} {...stroke} strokeWidth={1.8} />
    </svg>
  );
}

export function Polaroid({
  src,
  seed,
  caption,
  sub,
  tilt = -1.2,
  credit,
}: {
  src: string | null;
  seed: string;
  caption: ReactNode;
  sub?: ReactNode;
  tilt?: number;
  credit?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  return (
    <figure className="polaroid" style={{ ['--photo-tilt' as string]: `${tilt}deg`, margin: 0 }}>
      <span className="tape tape--tl" aria-hidden="true" />
      {showImg ? (
        <img className="polaroid__img" src={src!} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} title={credit ?? undefined} />
      ) : (
        <CityDoodle seed={seed} />
      )}
      <figcaption className="polaroid__caption">
        <span>{caption}</span>
        {sub && <small>{sub}</small>}
      </figcaption>
    </figure>
  );
}
