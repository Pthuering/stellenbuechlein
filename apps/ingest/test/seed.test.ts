import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSTITUTION_KINDS, STATE_CODES } from '@stellen/core';
import { loadSeed, SEED_DIR } from '../src/seed';

const raw = JSON.parse(readFileSync(join(SEED_DIR, 'institutions.json'), 'utf8')) as { id: string; kind: string; city: string; website?: string; sources: { kind: string; url: string | null; format?: string; rss?: string }[] }[];
const cities = JSON.parse(readFileSync(join(SEED_DIR, 'cities.json'), 'utf8')) as { id: string; state: string; lat: number; lon: number }[];

const validUrl = (u: string) => {
  try {
    return /^https?:$/.test(new URL(u).protocol);
  } catch {
    return false;
  }
};

describe('Startdaten (data/seed)', () => {
  it('Städte: eindeutig, Bundesland bekannt, Koordinaten in Deutschland', () => {
    expect(new Set(cities.map((c) => c.id)).size).toBe(cities.length);
    for (const c of cities) {
      expect(STATE_CODES, c.id).toContain(c.state);
      expect(c.lat > 47 && c.lat < 55.2 && c.lon > 5.8 && c.lon < 15.1, c.id).toBe(true);
    }
  });

  it('Einrichtungen: eindeutige IDs, bekannte Art und Stadt, gültige Adressen', () => {
    const cityIds = new Set(cities.map((c) => c.id));
    expect(new Set(raw.map((i) => i.id)).size).toBe(raw.length);
    for (const i of raw) {
      expect(i.id, i.id).toMatch(/^[a-z0-9-]+$/);
      expect(INSTITUTION_KINDS, i.id).toContain(i.kind);
      expect(cityIds.has(i.city), `${i.id}: Stadt ${i.city}`).toBe(true);
      if (i.website) expect(validUrl(i.website), `${i.id}: ${i.website}`).toBe(true);
      for (const s of i.sources) {
        expect(['zentral', 'fachbereich'], i.id).toContain(s.kind);
        expect(s.url && validUrl(s.url), `${i.id}: ${s.url}`).toBe(true);
        if (s.rss) expect(validUrl(s.rss), `${i.id}: ${s.rss}`).toBe(true);
      }
    }
  });

  it('jede Quellen-Adresse gehört genau einer Einrichtung', () => {
    const owner = new Map<string, string>();
    for (const i of raw)
      for (const s of i.sources) {
        const k = (s.url ?? '').replace(/\/+$/, '').toLowerCase();
        expect(owner.get(k) ?? i.id, `${s.url} bei ${owner.get(k)} und ${i.id}`).toBe(i.id);
        owner.set(k, i.id);
      }
  });

  it('lässt sich laden; Quellen-IDs sind eindeutig', () => {
    const seed = loadSeed();
    expect(seed.institutions.length).toBe(raw.length);
    expect(new Set(seed.sources.map((s) => s.id)).size).toBe(seed.sources.length);
  });
});
