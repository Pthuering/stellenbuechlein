// Erzeugt die stilisierte Deutschlandkarte (src/map/germany.json) aus Natural-Earth-Daten (gemeinfrei):
// projiziert, vereinfacht und mit Rough.js "von Hand nachgezeichnet".
//   npx tsx apps/web/scripts/build-map.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rough from 'roughjs';
import { MAP_HEIGHT, MAP_WIDTH, project } from '../../../packages/core/src/geo';

type Pt = [number, number];
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../../data/geo/de_states.geojson');
const out = resolve(here, '../src/map/germany.json');

interface Feature {
  properties: { iso_3166_2: string; name: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
}

function sqDistToSeg(p: Pt, a: Pt, b: Pt): number {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b;
    else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplify(points: Pt[], tol: number): Pt[] {
  if (points.length <= 3) return points;
  const sq = tol * tol;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let max = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqDistToSeg(points[i], points[first], points[last]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > sq && idx > 0) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function area(r: Pt[]): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}

function centroid(r: Pt[]): Pt {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    cx += (r[j][0] + r[i][0]) * f;
    cy += (r[j][1] + r[i][1]) * f;
    a += f;
  }
  a *= 0.5;
  return [Math.round((cx / (6 * a)) * 10) / 10, Math.round((cy / (6 * a)) * 10) / 10];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const toPath = (rings: Pt[][]) => rings.map((r) => `M${r.map((p) => `${r1(p[0])},${r1(p[1])}`).join('L')}Z`).join('');

const fc = JSON.parse(readFileSync(src, 'utf8')) as { features: Feature[] };
const gen = rough.generator();

// Kleinere Länder etwas weniger vereinfachen, damit sie erkennbar bleiben
const LABEL_NUDGE: Record<string, Pt> = { BB: [40, 40], NI: [-20, 30], SH: [0, 10], HE: [0, 10], BY: [10, 0] };

const states = fc.features.map((f) => {
  const code = f.properties.iso_3166_2.replace('DE-', '');
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
  const tol = ['BE', 'HB', 'HH', 'SL'].includes(code) ? 0.9 : 2.2;
  const rings: Pt[][] = [];
  for (const poly of polys) {
    for (const ring of poly) {
      const pts = ring.map(([lon, lat]) => project(lon, lat) as Pt);
      const s = simplify(pts, tol);
      if (s.length >= 4 && Math.abs(area(s)) > 12) rings.push(s);
    }
  }
  const outer = rings.reduce((a, b) => (Math.abs(area(b)) > Math.abs(area(a)) ? b : a));
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  const [cx, cy] = centroid(outer);
  const nudge = LABEL_NUDGE[code] ?? [0, 0];
  const d = toPath(rings);
  // Handgezeichnete Kontur: nur die Außenringe, zwei leicht versetzte Striche
  const sketch = rings
    .filter((r) => area(r) !== 0)
    .map((r, i) => {
      const drawable = gen.polygon(r, { roughness: 0.9, bowing: 0.6, seed: 11 + i + code.charCodeAt(0), disableMultiStroke: true, preserveVertices: true });
      return gen
        .toPaths(drawable)
        .map((p) => p.d)
        .join('');
    })
    .join('')
    .replace(/(\d+\.\d)\d+/g, '$1');
  return {
    code,
    name: f.properties.name,
    d,
    sketch,
    bbox: [r1(Math.min(...xs)), r1(Math.min(...ys)), r1(Math.max(...xs)), r1(Math.max(...ys))],
    label: [r1(cx + nudge[0]), r1(cy + nudge[1])],
  };
});

writeFileSync(out, JSON.stringify({ width: MAP_WIDTH, height: MAP_HEIGHT, source: 'Natural Earth (gemeinfrei)', states }));
console.log(`Karte geschrieben: ${out} (${Math.round(JSON.stringify(states).length / 1024)} KB, ${states.length} Länder)`);
