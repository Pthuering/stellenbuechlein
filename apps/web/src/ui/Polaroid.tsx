// Polaroid mit Foto (Anzeige → Einrichtung → Stadt) oder, wenn keins da ist, einer gezeichneten Postkarte.

import { useState, type ReactNode } from 'react';

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

const SKIES = ['var(--rosa-soft)', 'var(--lavendel-soft)', 'var(--minze-soft)', 'var(--butter-soft)', 'var(--pfirsich-soft)'];
const HOUSES = ['var(--rosa)', 'var(--lavendel)', 'var(--minze)', 'var(--butter)', 'var(--pfirsich)', 'var(--himmel)'];

/** Gezeichnete Stadt-Silhouette, je Ort immer gleich. */
export function CityDoodle({ seed }: { seed: string }) {
  const r = rng(hashOf(seed));
  const sky = SKIES[Math.floor(r() * SKIES.length)];
  const ground = 132;
  const parts: ReactNode[] = [];
  let x = 18;
  let i = 0;
  while (x < 300) {
    const w = 26 + Math.floor(r() * 26);
    const h = 34 + Math.floor(r() * 58);
    const top = ground - h;
    const fill = HOUSES[Math.floor(r() * HOUSES.length)];
    const roof = r();
    const stroke = { stroke: '#3b2741', strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
    parts.push(<path key={`b${i}`} d={`M${x} ${ground}V${top}h${w}V${ground}`} fill={fill} {...stroke} />);
    if (roof < 0.35) {
      parts.push(<path key={`r${i}`} d={`M${x - 3} ${top}L${x + w / 2} ${top - 16 - r() * 10}L${x + w + 3} ${top}Z`} fill="#fffdfb" {...stroke} />);
    } else if (roof < 0.55) {
      parts.push(<path key={`r${i}`} d={`M${x + 3} ${top}a${w / 2 - 3} ${w / 2 - 3} 0 0 1 ${w - 6} 0`} fill="#fffdfb" {...stroke} />);
      parts.push(<path key={`s${i}`} d={`M${x + w / 2} ${top - w / 2 + 3}v-9`} {...stroke} />);
    } else if (roof < 0.68) {
      const tw = Math.max(10, w * 0.4);
      parts.push(<path key={`t${i}`} d={`M${x + w / 2 - tw / 2} ${top}v-18h${tw}v18`} fill={fill} {...stroke} />);
      parts.push(<path key={`tr${i}`} d={`M${x + w / 2 - tw / 2 - 2} ${top - 18}L${x + w / 2} ${top - 34}L${x + w / 2 + tw / 2 + 2} ${top - 18}Z`} fill="#fffdfb" {...stroke} />);
    }
    // Fenster
    for (let wy = top + 10; wy < ground - 12; wy += 15) {
      for (let wx = x + 7; wx < x + w - 8; wx += 11) {
        if (r() < 0.75) parts.push(<rect key={`w${i}-${wx}-${wy}`} x={wx} y={wy} width={4.5} height={6} rx={1} fill="#3b2741" opacity={0.75} />);
      }
    }
    x += w + 6 + Math.floor(r() * 8);
    i++;
  }
  const sunX = 40 + r() * 230;
  return (
    <svg className="polaroid__img" viewBox="0 0 320 170" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Gezeichnete Stadtansicht">
      <rect width="320" height="170" fill={sky} />
      <circle cx={sunX} cy={34} r={14} fill="var(--butter)" stroke="#3b2741" strokeWidth={2} />
      <path d={`M${sunX - 24} 34h-6M${sunX + 24} 34h6M${sunX} 10v-6M${sunX - 17} 17l-4-4M${sunX + 17} 17l4-4`} stroke="#3b2741" strokeWidth={2} strokeLinecap="round" />
      <path d={`M${(sunX + 130) % 300} 50q6-8 12 0 6-8 12 0`} fill="none" stroke="#3b2741" strokeWidth={2} strokeLinecap="round" />
      {parts}
      <path d={`M6 ${ground}h308`} stroke="#3b2741" strokeWidth={2.2} strokeLinecap="round" />
      <path d={`M14 ${ground + 12}q40-6 80 0t80 0 80 0 60 0`} fill="none" stroke="#3b2741" strokeWidth={1.6} strokeLinecap="round" opacity={0.5} />
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
