// Horizont: Stellen außerhalb des Kernbereichs, die trotzdem zu dir passen könnten.
//
// Drei Ringe:
//   Kern     – Psychologie-Bezug, wie bisher (Grobfilter, Score)
//   Horizont – ein anderes Feld UND eine Anknüpfung an dich (Brücke aus dem Suchprofil)
//   Weite    – keine Brücke, aber deine Fähigkeiten tragen dort; das beurteilt die KI beim Einsammeln
//
// Wie beim Score gilt: Nichts wird wegen des Profils ausgeblendet. Der Horizont bestimmt nur, was
// zusätzlich eingesammelt wird und welche Karten im Stapel eingestreut werden.

import { hash64 } from './dedup';
import { CATEGORY_LABELS, horizontOf, type Bruecke, type Horizont, type HorizontDosis, type Suchprofil } from './profile';
import { allMatches, compileTerms, type CompiledTerm } from './text';
import { matchItem } from './scoring';
import { JOB_KIND_LABELS, type Job, type JobKind, type Lane } from './types';

/**
 * Standard-Anknüpfung: Begriffe, die zeigen, dass es um Menschen, Verhalten oder empirische Arbeit geht.
 * Floskeln aus Anzeigen („hohe Motivation“, „stressresistent“) sind bewusst nicht dabei.
 */
export const STANDARD_ANKER: string[] = [
  '*psych', 'verhalten', 'behavio', 'nutzerverhalten', 'nutzerstud', 'nutzerforsch', 'nutzerzentriert', 'nutzerinnen', 'user stud',
  'user research', 'menschliche faktoren', 'faktor mensch', 'human factors', 'human centered', 'human centred', 'menschzentriert',
  'mensch technik', 'mensch maschine', 'mensch computer', 'akzeptanz', 'wahrnehmung', 'entscheidungsverhalten', 'entscheidungsfindung',
  'kognit', 'cognit', 'emotion', 'stresserleben', 'stressforschung', 'beanspruchung', 'wohlbefinden', 'well being', 'wellbeing',
  'empirisch', 'empirical', 'befragung', 'umfrage', 'interviewstud', 'qualitative interviews', 'fokusgrupp', 'experiment', 'feldstud',
  'laborstud', 'probanden', 'proband', 'teilnehmende', 'sozialwissenschaftlich', 'mixed methods', 'lernprozess', 'kompetenzentwicklung',
  'kommunikationsverhalten', 'gesundheitsverhalten', 'awareness', 'beschäftigte befragt', 'arbeitsbelastung', 'mentale gesundheit',
  'mental health', 'motivation von', 'nutzerakzeptanz',
];

const compiledFor = new WeakMap<object, CompiledTerm[]>();
function compiled(key: object, terms: readonly string[]): CompiledTerm[] {
  let c = compiledFor.get(key);
  if (!c) {
    c = compileTerms(terms);
    compiledFor.set(key, c);
  }
  return c;
}
const STANDARD_KEY = {};

export interface BridgeHit {
  bridge: Bruecke;
  feld: string[];
  anker: string[];
  /** 2–6: wie viele verschiedene Begriffe getroffen haben (je Seite höchstens 3). */
  strength: number;
}

const clean = (t: CompiledTerm) => t.raw.replace(/^\*|^"|"$/g, '');

/** Welche aktiven Brücken passen auf den (normalisierten) Anzeigentext? Stärkste zuerst. */
export function matchBridges(norm: string, h: Horizont, includeInactive = false): BridgeHit[] {
  const out: BridgeHit[] = [];
  for (const b of h.bruecken) {
    if (!b.aktiv && !includeInactive) continue;
    const feld = allMatches(norm, compiled(b.feld, b.feld));
    if (feld.length === 0) continue;
    const ankerTerms = b.anker.length ? compiled(b.anker, b.anker) : compiled(STANDARD_KEY, STANDARD_ANKER);
    const anker = allMatches(norm, ankerTerms);
    if (anker.length === 0) continue;
    out.push({
      bridge: b,
      feld: feld.map(clean),
      anker: anker.map(clean),
      strength: Math.min(3, feld.length) + Math.min(3, anker.length),
    });
  }
  return out.sort((a, b) => b.strength - a.strength);
}

/** Nur das Feld prüfen (ohne Anknüpfung), z. B. für Titel in Suchergebnissen. */
export function matchFeld(norm: string, h: Horizont): Bruecke[] {
  return h.bruecken.filter((b) => b.aktiv && allMatches(norm, compiled(b.feld, b.feld)).length > 0);
}

/** Begriffe, die in andere Felder tragen: Methoden aus dem Profil plus Fähigkeiten aus dem Horizont. */
export function skillTerms(p: Suchprofil): string[] {
  const methods = p.categories.find((c) => c.id === 'methoden')?.items.flatMap((i) => i.terms ?? []) ?? [];
  return [...new Set([...methods, ...horizontOf(p).faehigkeiten])];
}

const skillCache = new WeakMap<Suchprofil, CompiledTerm[]>();

/**
 * Vorauswahl für die Weite (bevor die KI gefragt wird): mindestens eine Fähigkeit und eine
 * Anknüpfung an Menschen oder Empirie. Gibt die Treffer zurück, leer = keine Vorauswahl.
 */
export function weiteCandidate(norm: string, p: Suchprofil): { skills: string[]; anker: string[] } | null {
  const h = horizontOf(p);
  if (!h.weite) return null;
  let sk = skillCache.get(p);
  if (!sk) {
    sk = compileTerms(skillTerms(p));
    skillCache.set(p, sk);
  }
  const skills = allMatches(norm, sk);
  if (skills.length === 0) return null;
  const anker = allMatches(norm, compiled(STANDARD_KEY, STANDARD_ANKER));
  if (anker.length === 0) return null;
  return { skills: skills.map(clean), anker: anker.map(clean) };
}

/** Prüfsumme über alles, was beim Einsammeln über Horizont und Weite entscheidet. */
export function horizonGateHash(p: Suchprofil): string {
  const h = horizontOf(p);
  const parts = h.bruecken.filter((b) => b.aktiv).map((b) => `${b.feld.join(',')}|${b.anker.join(',')}`);
  return hash64(`${parts.sort().join(';')}#${h.weite ? skillTerms(p).join(',') : 'aus'}`);
}

// ---------------------------------------------------------------- In der App

export interface LaneInfo {
  lane: Lane;
  /** Wird im Stapel als Horizont-Karte eingestreut. */
  promoted: boolean;
  bridge: BridgeHit | null;
  reason: string | null;
  verdict: 'passt' | 'eher' | 'nein' | null;
  /** Etikett für Karte und Liste, z. B. „IT-Sicherheit“. */
  label: string | null;
}

const KERN: LaneInfo = { lane: 'kern', promoted: false, bridge: null, reason: null, verdict: null, label: null };

/**
 * Trifft die Anzeige eines deiner Kernthemen (Kategorie „Thema“ im Suchprofil)? Ist die Kategorie leer,
 * gilt alles als Kern.
 */
export function isThematic(job: Parameters<typeof matchItem>[1], norm: string, p: Suchprofil): boolean {
  const thema = p.categories.find((c) => c.id === 'thema');
  if (!thema || thema.items.length === 0 || thema.weight <= 0) return true;
  return thema.items.some((it) => matchItem(it, job, norm).state === 'ja');
}

/**
 * Ring einer Anzeige mit dem aktuellen Profil:
 *  - Trifft sie ein Kernthema, ist sie Kern (auch wenn sie über eine Brücke hereinkam).
 *  - Sonst Horizont, wenn eine aktive Brücke passt – auch bei Anzeigen, die nur der breite Grobfilter
 *    durchgelassen hat (z. B. „Usability“ ohne Psychologie im Text). Hat die KI „nein“ gesagt, nicht.
 *  - Weite-Anzeigen bleiben Weite.
 * `promoted` heißt: wird im Stapel als Horizont-Karte eingestreut.
 */
export function laneOf(job: Pick<Job, 'lane' | 'horizon'>, norm: string, h: Horizont, thematic = true): LaneInfo {
  if (thematic) return KERN;
  const ingest = job.lane ?? 'kern';
  const hits = matchBridges(norm, h);
  const bridge = hits[0] ?? null;
  const reason = job.horizon?.reason ?? null;
  const verdict = job.horizon?.verdict ?? null;
  const on = h.dosis !== 'aus';
  const label = bridge?.bridge.name ?? job.horizon?.label ?? null;
  if (ingest === 'weite') return { lane: 'weite', promoted: on && (h.weite || !!bridge), bridge, reason, verdict, label };
  if (ingest === 'kern' && (!bridge || verdict === 'nein')) return KERN;
  // Ist die Brücke inzwischen pausiert, wird die Anzeige nicht mehr eingestreut (bleibt aber unter „Alle“).
  return { lane: 'horizont', promoted: on && !!bridge, bridge, reason, verdict, label };
}

/** Kurze Begründung ohne KI: welche Begriffe die Brücke tragen. */
export function bridgeExplanation(hit: BridgeHit): string {
  const f = hit.feld.slice(0, 2).map((t) => `„${t}“`).join(', ');
  const a = hit.anker.slice(0, 3).map((t) => `„${t}“`).join(', ');
  return `Feld: ${f}; Anknüpfung: ${a}`;
}

/** Reihenfolge innerhalb des Horizonts: KI-Urteil, Stärke der Brücke, dann Score. */
export function compareHorizon(a: { lane: LaneInfo; score: number }, b: { lane: LaneInfo; score: number }): number {
  const v = (x: LaneInfo) => (x.verdict === 'passt' ? 2 : x.verdict === 'eher' ? 1 : 0);
  if (v(a.lane) !== v(b.lane)) return v(b.lane) - v(a.lane);
  const s = (x: LaneInfo) => x.bridge?.strength ?? 0;
  if (s(a.lane) !== s(b.lane)) return s(b.lane) - s(a.lane);
  return b.score - a.score;
}

// ---------------------------------------------------------------- Einstreuen in den Stapel

/** Abstand zwischen zwei Horizont-Karten (Anzahl Kern-Karten dazwischen). */
export const DOSIS_GAPS: Record<HorizontDosis, [number, number] | null> = {
  aus: null,
  selten: [5, 7], // jede 6. bis 8. Karte
  normal: [2, 4], // jede 3. bis 5. Karte
  oft: [1, 2], // jede 2. bis 3. Karte
};

function rng(seed: string): () => number {
  let a = parseInt(hash64(seed).slice(0, 8), 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Streut die Horizont-Karten zwischen die Kern-Karten: nach jeweils zufällig 2–4 Kern-Karten eine
 * Horizont-Karte (bei „normal“). Der Zufall hängt nur vom Startwert ab, damit sich die Reihenfolge beim
 * Wischen nicht verschiebt. Sind die Kern-Karten aufgebraucht, folgen die übrigen Horizont-Karten.
 */
export function interleave<T>(core: readonly T[], extra: readonly T[], seed: string, dosis: HorizontDosis): T[] {
  const gaps = DOSIS_GAPS[dosis];
  if (!gaps || extra.length === 0) return [...core, ...extra];
  const next = rng(seed);
  const [lo, hi] = gaps;
  const out: T[] = [];
  let ci = 0;
  let ei = 0;
  while (ci < core.length || ei < extra.length) {
    const gap = lo + Math.floor(next() * (hi - lo + 1));
    for (let k = 0; k < gap && ci < core.length; k++) out.push(core[ci++]);
    if (ei < extra.length) out.push(extra[ei++]);
    if (ci >= core.length) {
      while (ei < extra.length) out.push(extra[ei++]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- Für die KI

/** Kurzfassung des Profils für KI-Aufgaben (Horizont-Urteil, Brücken-Vorschläge). Enthält nur Stichworte. */
export function profileSummary(p: Suchprofil): string {
  const h = horizontOf(p);
  const cat = (id: 'thema' | 'stelle' | 'methoden' | 'rahmen') => p.categories.find((c) => c.id === id)?.items ?? [];
  const labels = (items: { label: string; hearts: number }[]) => [...items].sort((a, b) => b.hearts - a.hearts).map((i) => i.label).join(', ');
  const kinds = cat('stelle')
    .flatMap((i) => (i.condition?.type === 'kind' ? i.condition.kinds : []))
    .map((k: JobKind) => JOB_KIND_LABELS[k]);
  const lines = [
    `${CATEGORY_LABELS.thema}: ${labels(cat('thema')) || 'Psychologie allgemein'}`,
    `Gesuchte Stellenarten: ${[...new Set(kinds)].join(', ') || 'offen'}`,
    `${CATEGORY_LABELS.methoden}: ${labels(cat('methoden')) || '–'}`,
    `Weitere Fähigkeiten: ${h.faehigkeiten.slice(0, 25).map((t) => t.replace(/^\*|"/g, '')).join(', ') || '–'}`,
    `Interessen außerhalb der Psychologie: ${h.interessen.join(', ') || '–'}`,
    `Brücken: ${h.bruecken.filter((b) => b.aktiv).map((b) => b.name).join(', ') || '–'}`,
    `Lieber nicht: ${p.avoid.map((a) => a.label).join(', ') || '–'}`,
  ];
  return lines.join('\n');
}
