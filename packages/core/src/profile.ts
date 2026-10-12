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
  /** Erweiterung über den Kernbereich hinaus (fehlt bei älteren Profilen: dann gilt der Start-Horizont). */
  horizont?: Horizont;
  updatedAt: string;
}

// ---------------------------------------------------------------- Horizont

/**
 * Eine Brücke verbindet ein anderes Fachgebiet mit dem, was du mitbringst.
 * Eine Anzeige passt, wenn sie einen Feld-Begriff UND einen Anknüpfungs-Begriff enthält.
 */
export interface Bruecke {
  id: string;
  name: string;
  /** Begriffe für das andere Feld (einer reicht), z. B. „cybersecurity“, „it sicherheit“. */
  feld: string[];
  /** Begriffe für die Anknüpfung an dich (einer reicht). Leer = Standard: Mensch, Verhalten, Empirie. */
  anker: string[];
  /** Suchwörter für die Erkundung bei der Arbeitsagentur und im Netz, z. B. „Usable Security“. */
  suche?: string[];
  /** Warum diese Brücke (aus dem Interview oder selbst notiert). */
  warum?: string | null;
  aktiv: boolean;
  herkunft: 'start' | 'steckbrief' | 'ki' | 'manuell';
}

/** Wie oft eine Horizont-Karte im Stapel kommt. */
export type HorizontDosis = 'aus' | 'selten' | 'normal' | 'oft';

export const DOSIS_LABELS: Record<HorizontDosis, string> = {
  aus: 'aus',
  selten: 'jede 6. bis 8.',
  normal: 'jede 3. bis 5.',
  oft: 'jede 2. bis 3.',
};

export interface Horizont {
  dosis: HorizontDosis;
  bruecken: Bruecke[];
  /** Weite: Die KI prüft auch Anzeigen ohne Brücke darauf, ob deine Fähigkeiten dort tragen. */
  weite: boolean;
  /** Fähigkeiten und Wissen, die in andere Felder tragen (Vorauswahl für die Weite). */
  faehigkeiten: string[];
  /** Interessen außerhalb der Psychologie, Grundlage für KI-Vorschläge. */
  interessen: string[];
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

const termList = (max: number) => z.array(z.string().min(1).max(80)).max(max);

export const BrueckeSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  feld: termList(40).min(1),
  anker: termList(40).default([]),
  suche: z.array(z.string().min(2).max(80)).max(8).optional(),
  warum: z.string().max(400).nullable().optional(),
  aktiv: z.boolean().default(true),
  herkunft: z.enum(['start', 'steckbrief', 'ki', 'manuell']).default('manuell'),
});

export const HorizontSchema = z.object({
  dosis: z.enum(['aus', 'selten', 'normal', 'oft']).default('normal'),
  bruecken: z.array(BrueckeSchema).max(40).default([]),
  weite: z.boolean().default(true),
  faehigkeiten: termList(60).default([]),
  interessen: z.array(z.string().min(1).max(80)).max(30).default([]),
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
  horizont: HorizontSchema.optional(),
  updatedAt: z.string(),
});

export function parseProfile(value: unknown): Suchprofil | null {
  const r = SuchprofilSchema.safeParse(value);
  if (r.success) return r.data as Suchprofil;
  // Ein fehlerhafter Horizont soll nie das ganze Suchprofil kosten: dann gilt der Start-Horizont.
  if (value && typeof value === 'object' && 'horizont' in value) {
    const rest = SuchprofilSchema.safeParse({ ...(value as Record<string, unknown>), horizont: undefined });
    if (rest.success) return rest.data as Suchprofil;
  }
  return null;
}

/** Bringt Begriffslisten in die Grenzen des Profil-Formats (für Eingaben aus Editor und Import). */
export function cleanTerms(list: readonly string[], max = 40, maxLen = 80): string[] {
  return [...new Set(list.map((t) => t.trim()).filter((t) => t.length >= 1 && t.length <= maxLen))].slice(0, max);
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
    horizont: starterHorizont(),
  };
}

/**
 * Start-Horizont: bewusst weit, bis das Interview die Brücken festlegt. Begriffe, die in fast jeder
 * Anzeige als Floskel stehen („Weiterbildung“, „Datenschutz“, „Gesundheitsmanagement“), sind absichtlich
 * nicht dabei, sonst würde jede Anzeige eine Brücke treffen.
 */
export function starterHorizont(): Horizont {
  const b = (id: string, name: string, feld: string[], suche: string[]): Bruecke => ({ id, name, feld, anker: [], suche, warum: null, aktiv: true, herkunft: 'start' });
  return {
    dosis: 'normal',
    weite: true,
    interessen: [],
    faehigkeiten: [
      'statistik', '"r"', 'python', 'datenanalyse', 'befragung', 'fragebogen', 'interview', 'experiment', 'evaluation',
      'diagnostik', 'psychometr', 'beratung', 'didaktik', 'mixed methods', 'qualitative', 'quantitative', 'wissenschaftliches arbeiten',
    ],
    bruecken: [
      b('h-ki', 'Mensch & KI', ['künstliche intelligenz', 'künstlicher intelligenz', '"ki"', 'machine learning', 'maschinelles lernen', 'artificial intelligence', 'sprachmodell', 'language model', '"llm"', 'chatbot', 'generative ki'], ['Künstliche Intelligenz Mensch', 'KI Akzeptanz', 'Human-AI Interaction']),
      b('h-sec', 'IT-Sicherheit', ['it sicherheit', 'itsicherheit', 'cybersecurity', 'cyber security', 'cybersicherheit', 'informationssicherheit', 'security', 'phishing', 'social engineering'], ['Usable Security', 'Security Awareness', 'IT-Sicherheit Mensch']),
      b('h-arbeit', 'Arbeit & Organisation', ['arbeitsgestaltung', 'arbeitsschutz', 'arbeitsorganisation', 'arbeitsforschung', 'organisationsentwicklung', 'personalentwicklung', 'personalauswahl', 'eignungsdiagnostik', 'people analytics', 'zukunft der arbeit', 'future of work', 'new work'], ['Arbeitsgestaltung', 'Personalentwicklung', 'Organisationsentwicklung']),
      b('h-gesund', 'Gesundheit & Prävention', ['public health', 'prävention', 'gesundheitsförderung', 'versorgungsforschung', 'gesundheitskommunikation', 'epidemiolog', 'pflegewissenschaft', 'rehabilitationsforschung', 'digital health', 'digitale gesundheit'], ['Präventionsforschung', 'Versorgungsforschung', 'Gesundheitsförderung']),
      b('h-bildung', 'Bildung & Lernen', ['didaktik', 'hochschuldidaktik', 'lehrerbildung', 'lehrkräftebildung', 'e learning', 'elearning', 'bildungstechnolog', 'lernplattform', 'erwachsenenbildung', 'bildungsmonitoring', 'kompetenzmessung', 'learning analytics'], ['Hochschuldidaktik', 'Bildungsforschung Evaluation', 'E-Learning Didaktik']),
      b('h-verkehr', 'Mobilität & Verkehr', ['verkehrssicherheit', '*verkehrsforschung', '*verkehrsplanung', 'radverkehr', 'fußverkehr', 'verkehrswende', 'mobilitätswende', 'mobilitätsforschung', 'mobilitätsverhalten', 'verkehrsteilnehm', 'automatisiertes fahren', 'autonomes fahren', 'fahrerassistenz', 'luftfahrt', 'flugsicherung', 'human machine interface', '"hmi"'], ['Verkehrssicherheit', 'Mobilitätsforschung', 'Human Factors Luftfahrt']),
      b('h-umwelt', 'Umwelt & Nachhaltigkeit', ['nachhaltigkeitsforschung', 'klimaschutz', 'klimawandel', 'energiewende', 'umweltverhalten', 'transformationsforschung', 'nachhaltiges verhalten', 'sustainability'], ['Nachhaltigkeit Verhalten', 'Klimaschutz Kommunikation', 'Transformationsforschung']),
      b('h-daten', 'Daten & Methoden', ['data science', 'datenwissenschaft', 'umfrageforschung', 'survey', 'marktforschung', 'meinungsforschung', 'evaluationsforschung', 'evaluation', 'psychometr', 'testentwicklung'], ['Umfrageforschung', 'Evaluation Sozialforschung', 'Marktforschung']),
      b('h-gesell', 'Gesellschaft & Politik', ['sozialwissenschaft', 'soziolog', 'politikwissenschaft', 'politikberatung', 'demokratieforschung', 'migrationsforschung', 'integrationsforschung', 'kriminolog', 'sozialpolitik', 'konfliktforschung'], ['Sozialforschung', 'Politikberatung Wissenschaft', 'Migrationsforschung']),
      b('h-ux', 'Gestaltung & UX', ['user experience', 'usability', '"ux"', 'user research', 'interaktionsdesign', 'interaction design', 'mensch computer', 'human computer', '"hci"', 'service design', 'nutzerzentriert'], ['UX Research', 'User Researcher', 'Usability']),
    ],
  };
}

let defaultHorizont: Horizont | null = null;

/** Horizont eines Profils (ältere Profile ohne Horizont bekommen den Start-Horizont). */
export function horizontOf(p: Suchprofil): Horizont {
  return p.horizont ?? (defaultHorizont ??= starterHorizont());
}

export function emptyCategoryProfile(name = 'Eigenes Profil'): Suchprofil {
  const p = starterProfile();
  return { ...p, name, origin: 'manuell', categories: p.categories.map((c) => ({ ...c, items: [] })), avoid: [] };
}
