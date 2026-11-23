// Fachprüfung ohne KI: Ist eine Anzeige fachlich einschlägig, also wirklich eine Stelle für jemanden mit
// diesem Profil? Passende Wörter irgendwo im Text reichen dafür nicht: Eine Stelle in der Primatenforschung
// nennt auch „working memory“ und „attention“. Drei Merkmale lassen sich nach Regeln prüfen:
//   Titel       – der Titel (oder die Abteilung) nennt die Psychologie oder eines der Profil-Themen
//   Abschluss   – die Anzeige verlangt einen Abschluss oder Hintergrund in Psychologie
//   Schwerpunkt – mindestens ein Thema trifft, das im Profil zwei oder drei Herzen hat (nicht nur „Psychologie allgemein“)
// Einschlägig ist eine Anzeige, wenn (Titel oder Abschluss) und Schwerpunkt erfüllt sind.
// Benutzt wird das für Auslandsstellen: Dort entscheidet es vor jeder KI, was aufgenommen und gezeigt wird.

import type { Suchprofil } from './profile';
import { FACHBEZUG_TERMS, matchItem } from './scoring';
import { compileTerms, firstMatch, normalizeText, stripNoise, type CompiledTerm } from './text';

export interface FachSignale {
  titel: boolean;
  abschluss: boolean;
  schwerpunkt: boolean;
}

const FACH = '(?:psycholog\\w*|cognitive science|kognitionswiss\\w*|behaviou?ral science|verhaltenswiss\\w*|human factors)';
const GRAD =
  "(?:degree|ph\\.?d|doctorate|doctoral|master(?:'s)?|m\\.?sc|bachelor|background|graduate|diploma|dipl[oô]me|studium|abschluss|diplom|promotion|promoviert|hochschulstudium|hochschulabschluss)";
/** „Master in Psychologie oder einem verwandten Fach“, „PhD in psychology“, „psychology graduate“ */
const ABSCHLUSS = [new RegExp(`${GRAD}[^.\\n]{0,140}?${FACH}`, 'i'), new RegExp(`${FACH}[^.\\n]{0,50}?${GRAD}`, 'i')];

let fachbezug: CompiledTerm[] | null = null;

export function fachSignale(job: { title: string; department?: string | null }, descriptionMd: string, normText: string, profile: Suchprofil): FachSignale {
  const thema = profile.categories.find((c) => c.id === 'thema')?.items ?? [];
  const head = normalizeText(stripNoise(`${job.title} ${job.department ?? ''}`));
  fachbezug ??= compileTerms(FACHBEZUG_TERMS);
  const hit = (text: string, minHearts: number) => thema.some((it) => it.hearts >= minHearts && matchItem(it, { kind: null }, text).state === 'ja');
  const focus = thema.filter((it) => it.hearts >= 2);
  return {
    titel: !!firstMatch(head, fachbezug) || hit(head, 1),
    abschluss: ABSCHLUSS.some((re) => re.test(descriptionMd.slice(0, 15_000))),
    // ohne Schwerpunkte im Profil gibt es nichts zu verlangen
    schwerpunkt: focus.length === 0 || hit(normText, 2),
  };
}

export function fachlichEinschlaegig(s: FachSignale): boolean {
  return (s.titel || s.abschluss) && s.schwerpunkt;
}
