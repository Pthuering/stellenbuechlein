// Suchprofil: das, was der Score benutzt. Bewusst einfach und für Menschen lesbar:
// vier Kategorien mit Einträgen, jeder Eintrag hat 1–3 Herzchen.

import { z } from 'zod';
import type { JobKind } from './types';

export type Hearts = 1 | 2 | 3;

export type Condition =
  | { type: 'kind'; kinds: JobKind[] }
  | { type: 'payMin'; level: number }
  | { type: 'workloadMin'; pct: number }
  | { type: 'permanent' }
  | { type: 'language'; lang: 'de' | 'en' };

export interface ProfileItem {
  id: string;
  label: string;
  hearts: Hearts;
  /** Begriffe – einer davon muss in der Anzeige vorkommen. */
  terms?: string[];
  /** Oder: Bedingung auf erkannte Felder (Stellenart, Entgelt, Umfang …). */
  condition?: Condition;
}

export type CategoryId = 'thema' | 'stelle' | 'methoden' | 'rahmen';

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  thema: 'Thema',
  stelle: 'Stellenart',
  methoden: 'Methoden & Können',
  rahmen: 'Rahmen',
};

export const CATEGORY_HINTS: Record<CategoryId, string> = {
  thema: 'Fachgebiete und Forschungsthemen',
  stelle: 'Promotion, Postdoc, Mitarbeit …',
  methoden: 'Methoden, Software, Erfahrungen',
  rahmen: 'Entgelt, Umfang, Befristung',
};

export interface ProfileCategory {
  id: CategoryId;
  /** Anteil am Score (wird über aktive Kategorien auf 100 % umgerechnet). */
  weight: number;
  items: ProfileItem[];
}

export interface Suchprofil {
  version: 1;
  name: string;
  origin: 'start' | 'steckbrief' | 'manuell';
  categories: ProfileCategory[];
  /** "Lieber nicht" – zieht Punkte ab, sortiert aber nie aus. */
  avoid: ProfileItem[];
  updatedAt: string;
}

export const CATEGORY_ORDER: CategoryId[] = ['thema', 'stelle', 'methoden', 'rahmen'];

const hearts = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const jobKind = z.enum(['promotion', 'postdoc', 'wiss_ma', 'professur', 'projekt', 'lehre', 'shk', 'klinik', 'verwaltung', 'sonstige']);
const condition = z.discriminatedUnion('type', [
  z.object({ type: z.literal('kind'), kinds: z.array(jobKind).min(1) }),
  z.object({ type: z.literal('payMin'), level: z.number().int().min(1).max(15) }),
  z.object({ type: z.literal('workloadMin'), pct: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal('permanent') }),
  z.object({ type: z.literal('language'), lang: z.enum(['de', 'en']) }),
]);
const item = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  hearts,
  terms: z.array(z.string().min(1).max(80)).max(40).optional(),
  condition: condition.optional(),
});

export const SuchprofilSchema = z.object({
  version: z.literal(1),
  name: z.string().max(120),
  origin: z.enum(['start', 'steckbrief', 'manuell']),
  categories: z
    .array(
      z.object({
        id: z.enum(['thema', 'stelle', 'methoden', 'rahmen']),
        weight: z.number().min(0).max(100),
        items: z.array(item).max(80),
      }),
    )
    .length(4),
  avoid: z.array(item).max(40),
  updatedAt: z.string(),
});

export function parseProfile(value: unknown): Suchprofil | null {
  const r = SuchprofilSchema.safeParse(value);
  return r.success ? (r.data as Suchprofil) : null;
}

let idCounter = 0;
export function newItemId(prefix = 'i'): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/** Startprofil, bis ein Steckbrief importiert ist. Breit gehalten, damit nichts verloren geht. */
export function starterProfile(now = new Date().toISOString()): Suchprofil {
  return {
    version: 1,
    name: 'Startprofil',
    origin: 'start',
    updatedAt: now,
    categories: [
      {
        id: 'thema',
        weight: 45,
        items: [
          { id: 't-psych', label: 'Psychologie', hearts: 2, terms: ['*psycholog', 'psychology'] },
          { id: 't-klin', label: 'Klinische Psychologie & Psychotherapie', hearts: 1, terms: ['klinische psych', 'clinical psych', '*psychotherap'] },
          { id: 't-kogn', label: 'Kognition & Neurowissenschaft', hearts: 1, terms: ['kognit', 'cognit', '*neurowiss', 'neuroscien'] },
          { id: 't-bild', label: 'Bildung & Entwicklung', hearts: 1, terms: ['*bildungsforsch', 'entwicklungspsych', 'paedagogische psych', 'educational psych', 'developmental'] },
        ],
      },
      {
        id: 'stelle',
        weight: 30,
        items: [
          { id: 's-prom', label: 'Promotion', hearts: 3, condition: { type: 'kind', kinds: ['promotion'] }, terms: ['promotion', 'doktorand', 'phd', 'doctoral'] },
          { id: 's-wiss', label: 'Wissenschaftliche Mitarbeit', hearts: 2, condition: { type: 'kind', kinds: ['wiss_ma'] } },
          { id: 's-post', label: 'Postdoc', hearts: 2, condition: { type: 'kind', kinds: ['postdoc'] } },
          { id: 's-proj', label: 'Projekt & Koordination', hearts: 1, condition: { type: 'kind', kinds: ['projekt'] } },
        ],
      },
      {
        id: 'methoden',
        weight: 10,
        items: [
          { id: 'm-stat', label: 'Statistik & R', hearts: 1, terms: ['statistik', 'statistical', '"r"', 'mehrebenen', 'multilevel', 'strukturgleichung'] },
          { id: 'm-exp', label: 'Experimente', hearts: 1, terms: ['experiment'] },
        ],
      },
      {
        id: 'rahmen',
        weight: 15,
        items: [
          { id: 'r-eg', label: 'Ab E 13', hearts: 2, condition: { type: 'payMin', level: 13 } },
          { id: 'r-umf', label: 'Mindestens 65 %', hearts: 1, condition: { type: 'workloadMin', pct: 65 } },
        ],
      },
    ],
    avoid: [
      { id: 'a-shk', label: 'Studentische Hilfskraft', hearts: 2, condition: { type: 'kind', kinds: ['shk'] } },
      { id: 'a-verw', label: 'Verwaltung & Technik', hearts: 2, condition: { type: 'kind', kinds: ['verwaltung'] } },
    ],
  };
}

export function emptyCategoryProfile(name = 'Eigenes Profil'): Suchprofil {
  const p = starterProfile();
  return { ...p, name, origin: 'manuell', categories: p.categories.map((c) => ({ ...c, items: [] })), avoid: [] };
}
