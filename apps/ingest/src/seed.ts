// Lädt die Startdaten (Städte, Einrichtungen, Quellen, Portale) aus data/seed in die Datenbank.
// Mehrfaches Ausführen ist unbedenklich: bestehende Einträge werden aktualisiert, von Hand
// bestätigte Quellen-Adressen bleiben erhalten.

import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { City, Gate, Institution, InstitutionKind, Source, SourceConfig, StateCode } from '@stellen/core';
import { upsertCityStmt, upsertInstitutionStmt, upsertSourceStmt, type Db, type Stmt } from '@stellen/db';

export const SEED_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../data/seed');

interface SeedCity {
  id: string;
  name: string;
  state: StateCode;
  lat: number;
  lon: number;
  wiki?: string;
}

interface SeedSource {
  kind: 'zentral' | 'fachbereich';
  label?: string;
  url: string | null;
  ats?: string;
  format?: string;
  rss?: string | null;
  verified?: boolean;
  note?: string;
  gate?: Gate;
}

interface SeedInstitution {
  id: string;
  name: string;
  short?: string;
  kind: InstitutionKind;
  city: string;
  website?: string;
  wiki?: string;
  gate?: Gate;
  note?: string;
  sources: SeedSource[];
}

interface SeedPortal {
  id: string;
  label: string;
  url: string | null;
  adapter: string;
  gate: Gate;
  enabled: boolean;
  verified: boolean;
  config: SourceConfig;
}

const NO_ATS = new Set(['cms', 'unbekannt', '', undefined]);

export function sourceFromSeed(inst: SeedInstitution, s: SeedSource, index: number): Source {
  const config: SourceConfig = {};
  if (s.ats && !NO_ATS.has(s.ats)) config.ats = s.ats;
  if (s.format === 'js-nachgeladen') config.render = true;
  if (s.rss) config.feedUrl = s.rss;
  if (s.note) config.note = s.note;
  if (s.verified) config.researchVerified = true;
  if (s.format) config.format = s.format;
  const gate: Gate = s.gate ?? inst.gate ?? (s.kind === 'fachbereich' ? 'none' : 'psych');
  return {
    id: `${inst.id}-${s.kind === 'fachbereich' ? 'f' : 'z'}${index + 1}`,
    institutionId: inst.id,
    kind: s.kind,
    label: s.label ?? null,
    url: s.url,
    adapter: 'auto',
    config,
    gate,
    enabled: true,
    verified: false,
    status: s.url ? 'neu' : 'url-fehlt',
    consecutiveFailures: 0,
  };
}

export function loadSeed(dir = SEED_DIR): { cities: City[]; institutions: Institution[]; sources: Source[] } {
  const rawCities = JSON.parse(readFileSync(join(dir, 'cities.json'), 'utf8')) as SeedCity[];
  const rawInst = JSON.parse(readFileSync(join(dir, 'institutions.json'), 'utf8')) as SeedInstitution[];
  const rawPortals = JSON.parse(readFileSync(join(dir, 'portals.json'), 'utf8')) as SeedPortal[];
  const cityById = new Map(rawCities.map((c) => [c.id, c]));

  const cities: City[] = rawCities.map((c) => ({ id: c.id, name: c.name, state: c.state, lat: c.lat, lon: c.lon, wikiDe: c.wiki ?? c.name }));
  const institutions: Institution[] = rawInst.map((i) => {
    const city = cityById.get(i.city);
    return {
      id: i.id,
      name: i.name,
      shortName: i.short ?? null,
      kind: i.kind,
      cityId: i.city,
      lat: city?.lat ?? null,
      lon: city?.lon ?? null,
      website: i.website ?? null,
      wikiDe: i.wiki ?? null,
      active: true,
      origin: 'seed',
    };
  });

  const sources: Source[] = [];
  for (const inst of rawInst) {
    if (inst.sources.length === 0) {
      // Ohne bekannte Stellenseite: Platzhalter, damit die Pipeline selbst danach sucht.
      sources.push(sourceFromSeed(inst, { kind: 'zentral', url: null, note: 'Stellenseite noch unbekannt – wird automatisch gesucht' }, 0));
      continue;
    }
    const counters = { zentral: 0, fachbereich: 0 };
    for (const s of inst.sources) {
      sources.push(sourceFromSeed(inst, s, counters[s.kind]++));
    }
  }
  for (const p of rawPortals) {
    sources.push({
      id: `portal-${p.id}`,
      institutionId: null,
      kind: 'portal',
      label: p.label,
      url: p.url,
      adapter: p.adapter,
      config: p.config,
      gate: p.gate,
      enabled: p.enabled && !!p.url,
      verified: false,
      status: p.url ? 'neu' : 'url-fehlt',
      consecutiveFailures: 0,
    });
  }
  return { cities, institutions, sources };
}

export async function applySeed(db: Db, dir = SEED_DIR): Promise<{ cities: number; institutions: number; sources: number }> {
  const seed = loadSeed(dir);
  const now = new Date().toISOString();
  const stmts: Stmt[] = [
    ...seed.cities.map((c) => upsertCityStmt(c)),
    ...seed.institutions.map((i) => upsertInstitutionStmt(i, now)),
    ...seed.sources.map((s) => upsertSourceStmt(s, now)),
  ];
  await db.batch(stmts);
  // Deaktivierte Portale bleiben deaktiviert, aktivierte werden beim ersten Seed eingeschaltet.
  return { cities: seed.cities.length, institutions: seed.institutions.length, sources: seed.sources.length };
}
