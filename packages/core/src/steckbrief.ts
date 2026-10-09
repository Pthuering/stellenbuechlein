// Import des Steckbriefs aus dem externen Interview.
//
// ENTWURF: Das endgültige Antwortformat und der Interview-Prompt sind ein eigener Arbeitsschritt.
// Dieses Modul ist die einzige Stelle, die das Format kennt – bei einem neuen Format wird nur
// hier ein weiterer Parser ergänzt. Alles andere arbeitet mit dem Suchprofil (profile.ts).

import { z } from 'zod';
import { newItemId, starterProfile, type Hearts, type ProfileItem, type Suchprofil } from './profile';
import { STATE_CODES, type JobKind, type StateCode } from './types';

const wichtigkeit = z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2);
const begriffEintrag = z.object({
  label: z.string().min(1),
  begriffe: z.array(z.string().min(1)).default([]),
  wichtigkeit,
});
const art = z.enum(['promotion', 'postdoc', 'wiss_ma', 'professur', 'projekt', 'lehre', 'shk', 'klinik', 'verwaltung', 'sonstige']);

export const SteckbriefV0Schema = z.object({
  format: z.literal('stellenbuechlein-steckbrief'),
  version: z.literal(0),
  name: z.string().optional(),
  themen: z.array(begriffEintrag).default([]),
  stellenarten: z.array(z.object({ art, wichtigkeit })).default([]),
  methoden: z.array(begriffEintrag).default([]),
  rahmen: z
    .object({
      entgelt_min: z.number().int().min(1).max(15).optional(),
      entgelt_wichtigkeit: wichtigkeit.optional(),
      umfang_min: z.number().int().min(1).max(100).optional(),
      umfang_wichtigkeit: wichtigkeit.optional(),
      unbefristet_wichtigkeit: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
      sprache: z.enum(['de', 'en']).optional(),
    })
    .default({}),
  lieber_nicht: z
    .array(
      z.object({
        label: z.string().min(1),
        begriffe: z.array(z.string().min(1)).default([]),
        art: art.optional(),
        wichtigkeit,
      }),
    )
    .default([]),
  orte: z
    .object({
      bundeslaender: z.array(z.string()).default([]),
      staedte: z.array(z.string()).default([]),
      einrichtungen: z.array(z.string()).default([]),
    })
    .default({ bundeslaender: [], staedte: [], einrichtungen: [] }),
  gewichte: z
    .object({
      thema: z.number().min(0).max(100),
      stelle: z.number().min(0).max(100),
      methoden: z.number().min(0).max(100),
      rahmen: z.number().min(0).max(100),
    })
    .partial()
    .optional(),
});

export type SteckbriefV0 = z.infer<typeof SteckbriefV0Schema>;

export interface SteckbriefImport {
  profile: Suchprofil;
  /** Vorschläge für Lieblingsorte – werden erst nach Bestätigung übernommen. */
  favorites: { states: StateCode[]; cityNames: string[]; institutionNames: string[] };
  warnings: string[];
}

const KIND_LABEL: Record<JobKind, string> = {
  promotion: 'Promotion',
  postdoc: 'Postdoc',
  wiss_ma: 'Wissenschaftliche Mitarbeit',
  professur: 'Professur',
  projekt: 'Projekt & Koordination',
  lehre: 'Lehre',
  shk: 'Hilfskraft',
  klinik: 'Klinik & Therapie',
  verwaltung: 'Verwaltung & Technik',
  sonstige: 'Sonstiges',
};

const KIND_TERMS: Partial<Record<JobKind, string[]>> = {
  promotion: ['promotion', 'doktorand', 'phd', 'doctoral'],
  postdoc: ['postdoc', 'post doc', 'postdoctoral'],
  professur: ['professur', 'professor'],
};

/** Nimmt JSON (Objekt oder Text) entgegen und baut daraus ein Suchprofil. */
export function importSteckbrief(input: unknown, now = new Date().toISOString()): SteckbriefImport | { error: string } {
  let data: unknown = input;
  if (typeof input === 'string') {
    const text = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try {
      data = JSON.parse(text);
    } catch {
      return { error: 'Das ist kein gültiges JSON. Bitte den Steckbrief vollständig einfügen.' };
    }
  }
  const parsed = SteckbriefV0Schema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: `Steckbrief passt nicht zum erwarteten Format (${first.path.join('.') || 'Wurzel'}: ${first.message}).` };
  }
  const s = parsed.data;
  const warnings: string[] = [];
  const base = starterProfile(now);
  const w = { thema: 45, stelle: 30, methoden: 10, rahmen: 15, ...(s.gewichte ?? {}) };

  const fromBegriffe = (prefix: string, e: { label: string; begriffe: string[]; wichtigkeit: number }): ProfileItem => ({
    id: newItemId(prefix),
    label: e.label,
    hearts: e.wichtigkeit as Hearts,
    terms: e.begriffe.length > 0 ? e.begriffe : [e.label],
  });

  const thema = s.themen.map((e) => fromBegriffe('t', e));
  const methoden = s.methoden.map((e) => fromBegriffe('m', e));
  const stelle: ProfileItem[] = s.stellenarten.map((e) => ({
    id: newItemId('s'),
    label: KIND_LABEL[e.art],
    hearts: e.wichtigkeit as Hearts,
    condition: { type: 'kind', kinds: [e.art] },
    terms: KIND_TERMS[e.art],
  }));
  const rahmen: ProfileItem[] = [];
  if (s.rahmen.entgelt_min) {
    rahmen.push({ id: newItemId('r'), label: `Ab E ${s.rahmen.entgelt_min}`, hearts: (s.rahmen.entgelt_wichtigkeit ?? 2) as Hearts, condition: { type: 'payMin', level: s.rahmen.entgelt_min } });
  }
  if (s.rahmen.umfang_min) {
    rahmen.push({ id: newItemId('r'), label: `Mindestens ${s.rahmen.umfang_min} %`, hearts: (s.rahmen.umfang_wichtigkeit ?? 1) as Hearts, condition: { type: 'workloadMin', pct: s.rahmen.umfang_min } });
  }
  if (s.rahmen.unbefristet_wichtigkeit) {
    rahmen.push({ id: newItemId('r'), label: 'Unbefristet', hearts: s.rahmen.unbefristet_wichtigkeit as Hearts, condition: { type: 'permanent' } });
  }
  if (s.rahmen.sprache) {
    rahmen.push({ id: newItemId('r'), label: s.rahmen.sprache === 'de' ? 'Deutschsprachig' : 'Englischsprachig', hearts: 1, condition: { type: 'language', lang: s.rahmen.sprache } });
  }
  const avoid: ProfileItem[] = s.lieber_nicht.map((e) => ({
    id: newItemId('a'),
    label: e.label,
    hearts: e.wichtigkeit as Hearts,
    terms: e.begriffe.length > 0 ? e.begriffe : undefined,
    condition: e.art ? { type: 'kind', kinds: [e.art] } : undefined,
  }));

  if (thema.length === 0) warnings.push('Keine Themen im Steckbrief – die Kategorie „Thema“ bleibt leer und zählt nicht.');
  if (stelle.length === 0) warnings.push('Keine Stellenarten im Steckbrief – „Stellenart“ zählt nicht.');

  const states = s.orte.bundeslaender
    .map((x) => x.toUpperCase().trim())
    .filter((x): x is StateCode => (STATE_CODES as string[]).includes(x));
  if (states.length < s.orte.bundeslaender.length) warnings.push('Einige Bundesländer wurden nicht erkannt (bitte Kürzel wie SN, ST, TH verwenden).');

  const profile: Suchprofil = {
    ...base,
    name: s.name ? `Steckbrief: ${s.name}` : 'Aus Steckbrief',
    origin: 'steckbrief',
    updatedAt: now,
    categories: [
      { id: 'thema', weight: w.thema, items: thema },
      { id: 'stelle', weight: w.stelle, items: stelle },
      { id: 'methoden', weight: w.methoden, items: methoden },
      { id: 'rahmen', weight: w.rahmen, items: rahmen },
    ],
    avoid,
  };
  return {
    profile,
    favorites: { states, cityNames: s.orte.staedte, institutionNames: s.orte.einrichtungen },
    warnings,
  };
}

/** Beispiel im Entwurfsformat – für Doku und Tests. */
export const STECKBRIEF_EXAMPLE: SteckbriefV0 = {
  format: 'stellenbuechlein-steckbrief',
  version: 0,
  name: 'Beispiel',
  themen: [
    { label: 'Kognitive Neurowissenschaft', begriffe: ['kognitive neurowiss', 'cognitive neuroscience', '*neurowiss'], wichtigkeit: 3 },
    { label: 'Emotionsregulation', begriffe: ['emotionsregulation', 'emotion regulation'], wichtigkeit: 2 },
    { label: 'Klinische Psychologie', begriffe: ['klinische psych', 'clinical psych'], wichtigkeit: 1 },
  ],
  stellenarten: [
    { art: 'promotion', wichtigkeit: 3 },
    { art: 'wiss_ma', wichtigkeit: 2 },
  ],
  methoden: [
    { label: 'EEG', begriffe: ['"eeg"', 'elektroenzephalogra'], wichtigkeit: 2 },
    { label: 'R / Statistik', begriffe: ['"r"', 'statistik', 'mehrebenen'], wichtigkeit: 1 },
  ],
  rahmen: { entgelt_min: 13, entgelt_wichtigkeit: 2, umfang_min: 65, umfang_wichtigkeit: 1, unbefristet_wichtigkeit: 0 },
  lieber_nicht: [{ label: 'Lehrkraft für besondere Aufgaben', begriffe: ['lehrkraft fuer besondere aufgaben', '"lfba"'], wichtigkeit: 2 }],
  orte: { bundeslaender: ['SN', 'ST', 'TH'], staedte: ['Leipzig', 'Halle (Saale)'], einrichtungen: [] },
};
