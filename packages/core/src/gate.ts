// Grobfilter beim Einsammeln, in drei Stufen:
//   1. Titel-Ausschluss (alle Quellen): Pflege, Arzt, Ausbildung, Verwaltung, Handwerk … fallen raus, außer der
//      Titel nennt eine Psychologen- oder Forschungsrolle („Psychologin“, „Psychotherapeut“, „wiss. Mitarbeiter“).
//      Geprüft wird schon am Titel aus der Liste, also bevor die Anzeige abgerufen wird.
//   2. Fachbegriffe (nur breite Quellen, gate 'psych'): Psychologie, kognitiv, Neurowissenschaft, Human Factors,
//      Bildungsforschung … dürfen irgendwo im Text stehen.
//   3. Allerweltswörter („Persönlichkeit“, „Wohlbefinden“, „psychisch“, „Psychiatrie“ …) zählen nur im Titel.
//      Im Text stehen sie als Floskel in fast jeder Klinik- und Stellenanzeige („Sie sind eine engagierte
//      Persönlichkeit“, „Klinik für Psychiatrie und Psychotherapie“).
// Was durchfällt, wird protokolliert und ist in der App einsehbar. Anzeigen ohne Fachbegriff können noch über eine
// Brücke (von der KI geprüft) in den Stapel kommen.

import { compileTerms, allMatches, firstMatch, normalizeText, stripNoise, type CompiledTerm } from './text';
import { hash64 } from './dedup';

/**
 * Fachbegriffe, die irgendwo im Text stehen dürfen. "*" vorne = darf mitten im Wort stehen (Zusammensetzungen).
 * In der App unter Einstellungen → Quellen → Grobfilter änderbar.
 */
export const DEFAULT_GATE_TERMS: string[] = [
  '*psycholog', 'psychometr', // Psychologie, Neuropsychologie, Psychologin, Psychometrie …
  'kognit', 'cognit', '*neurowiss', 'neuroscien', 'neuroimaging', 'eeg', 'fmri', 'fmrt', 'eye tracking', 'eyetracking',
  'verhaltenswiss', 'verhaltensforsch', 'verhaltensoekonom', 'behavioural science', 'behavioral science', 'behavioural research', 'behavioral research', 'behavioural econom', 'behavioral econom',
  'emotionsforsch', 'wahrnehmungsforsch',
  'human factors', 'ux research', 'user research', 'nutzerforschung',
  '*bildungsforsch', '*lehrlern', '*lernforsch', '*unterrichtsforsch', 'educational research', 'entwicklungsforsch', 'kindheitsforsch',
  'arbeitswiss', '*arbeitsforsch', '*gesundheitsforsch', 'health research', 'suchtforsch',
  'sozialforschung', 'survey methodolog', 'umfrageforsch',
  'kriminolog', 'criminolog',
];

/**
 * Allerweltswörter mit Psychologie-Nähe: zählen nur im Titel (oder in der Abteilung), weil sie im Text meist
 * Floskel sind. „*psych“ fängt im Titel Psychiatrie, Psychosomatik, psychisch, Psychotherapie.
 */
export const GATE_TITLE_TERMS: string[] = [
  '*psych',
  '*verhalten', 'behavio', 'emotion', '*wahrnehmung', 'perception', '*neurolog',
  'erziehungswiss', 'fruehpaedagog', 'early childhood',
  'ergonom', 'mensch maschine', 'mensch technik', 'mensch computer', 'human machine', 'human computer', 'usability', 'user experience',
  'gesundheitswiss', 'public mental', 'gesundheitsverhalten',
  'suchterkrank', 'suchtmedizin', 'suchthilfe', 'addiction', 'substance use',
  'mental health', 'wohlbefinden', 'well being', 'wellbeing', 'resilien',
  'persoenlichkeit', 'personality',
  'autismus', 'autism', 'adhs', 'adhd', 'demenz', 'dementia', 'depress', 'angststoer', 'anxiety', 'ptbs', 'ptsd',
  'aufmerksamkeit', 'gedaechtnis', 'sprachverarbeitung', 'spracherwerb', 'language acquisition', 'mrt studie',
];

/**
 * Titel-Ausschluss: Berufe, die für eine Psychologin nicht in Frage kommen. Kurze Kürzel in Anführungszeichen
 * gelten nur als ganzes Wort ("ota" soll nicht auf „Otago“ passen).
 */
export const TITLE_EXCLUDE_TERMS: string[] = [
  // Pflege und Medizin
  '*pflege', 'krankenschwester', 'nurse', 'nursing', 'hebamme', '*arzt', '*aerzt', 'physician', '*mediziner',
  '"mfa"', 'medizinische fachangestellt', 'medizinischer fachangestellt', 'zahnmedizinisch',
  '"mta"', '"mtla"', '"mtra"', '"bta"', '"cta"', '"pta"', '"ota"', '"ata"', 'medizinisch technisch', 'medizinische technolog', 'medizinischer technolog',
  'laborant', 'labortechn', 'laboratoriumsanalytik', 'operationstechn', 'anaesthesietechn', 'funktionsdiagnost', 'sterilgut',
  'rettungs', 'notfallsanit', 'sanitaeter', 'apothek', 'pharmazeut', 'diaetassist', 'kodierfach',
  // Therapieberufe (Psychotherapeutinnen sind ausgenommen, siehe unten)
  '*therapeut', '*ergotherap', '*physiotherap', 'logopaed', '*musiktherap', '*kunsttherap', '*sporttherap', '*bewegungstherap', '*tanztherap',
  // Betreuung, Erziehung, Soziale Arbeit
  'erzieher', 'heilerzieh', 'heilpaedagog', '*sozialarbeit', 'sozialpaedagog', 'sozialassist', 'paedagogische fachkraft', '*jugendhilfe',
  'kita', 'kindertagesst', 'schulbegleit', 'integrationshelfer', 'betreuungsassist', 'betreuungskraft', 'alltagsbegleit',
  'praxisanleit', 'stationsleit', 'wohnbereichsleit', 'nachtwache', 'nachtdienst', 'genesungsbegleit', 'nichtfachkraft', 'famulatur',
  // Verwaltung und Büro
  'sekretaer', 'sekretariat', '*sachbearbeit', 'verwaltungsfach', 'verwaltungsangestellt', 'verwaltungsmitarbeit', 'verwaltungskraft', 'verwaltungsdienst',
  '*buchhalt', 'kaufmann', 'kauffrau', 'kaufleute', 'kaufmaennisch', 'steuerfach', 'buero', 'dokumentationsassist',
  'empfang', 'rezeption', 'telefonzentrale', 'patientenaufnahme', 'pforte', 'pfoertner',
  // Technik, Handwerk, Versorgung
  '*techniker', 'elektrik', '*elektroniker', 'mechatronik', '*mechaniker', 'schlosser', 'tischler', 'maler', 'gaertner', 'handwerk',
  'hausmeister', 'haustechnik', 'reinigung', 'kueche', 'koch', 'koechin', 'servicekraft', 'logistik', 'lager', 'transport', '*fahrer', 'zusteller',
  // Ausbildung, Freiwilligendienst, Vollzugsdienst
  'ausbildung', 'auszubild', 'azubi', 'dual studi', 'dual bachelor', 'schuelerpraktik',
  'bundesfreiwillig', '"bfd"', '"fsj"', 'freiwilliges soziales', 'freiwilliges oekolog', 'anwaerter', 'justizvollzug', 'vollzugsdienst', 'polizeivollzug',
];

/**
 * Titel, die trotz Ausschluss-Wort bleiben: Psychologen- und Forschungsrollen. Die Person „Psycholog*in“
 * prüft PSYCH_ROLE, damit „Sekretariat der Abteilung Arbeitspsychologie“ nicht als Ausnahme durchgeht.
 */
export const TITLE_EXCEPTION_TERMS: string[] = [
  '*psychotherapeut', 'psychologische fachkraft',
  'wissenschaftl', 'wiss mitarbeit', 'akademische mitarbeit', 'research', 'scientist', 'postdoc', 'post doc', '*doktorand', 'promotion', 'promovier', 'phd',
  'professur', 'professor', 'juniorprof', 'nachwuchsgruppe', 'lecturer',
];

/** Psychologin als Person, auch gegendert gekürzt („Psycholog*in“ → „psycholog“), aber nicht „Psychologie“. */
const PSYCH_ROLE = /psycholog(?:e|en|in|innen|ist|ists)?(?: |$)/;

export interface GateResult {
  pass: boolean;
  matched: string[];
}

const cache = new Map<string, CompiledTerm[]>();

function compiled(terms: readonly string[]): CompiledTerm[] {
  const key = terms.join('\u0001');
  let c = cache.get(key);
  if (!c) {
    if (cache.size > 8) cache.clear();
    c = compileTerms(terms);
    cache.set(key, c);
  }
  return c;
}

/** Titel (und Abteilung) normalisiert, wie ihn checkGate und titleExclusion erwarten. */
export function gateTitleText(title: string | null | undefined, department?: string | null): string {
  return normalizeText(stripNoise(`${title ?? ''} ${department ?? ''}`));
}

/**
 * Prüft normalisierten Suchtext gegen die Fachbegriffe und den Titel gegen die Allerweltswörter.
 * @param normSearchText Ausgabe von searchTextOf()
 * @param normTitle Ausgabe von gateTitleText(); fehlt er, zählen nur die Fachbegriffe
 */
export function checkGate(normSearchText: string, terms: readonly string[] = DEFAULT_GATE_TERMS, normTitle?: string | null): GateResult {
  const matched = allMatches(normSearchText, compiled(terms)).map((m) => m.raw);
  if (normTitle) for (const m of allMatches(normTitle, compiled(GATE_TITLE_TERMS))) if (!matched.includes(m.raw)) matched.push(m.raw);
  return { pass: matched.length > 0, matched: matched.slice(0, 12) };
}

/**
 * Fällt eine Anzeige schon wegen ihres Titels heraus? Gibt das Ausschluss-Wort zurück (für das Protokoll),
 * sonst null. Nennt der Titel eine Psychologen- oder Forschungsrolle, bleibt sie im Rennen.
 */
export function titleExclusion(title: string | null | undefined): string | null {
  if (!title) return null;
  const t = gateTitleText(title);
  const hit = firstMatch(t, compiled(TITLE_EXCLUDE_TERMS));
  if (!hit) return null;
  if (PSYCH_ROLE.test(t) || firstMatch(t, compiled(TITLE_EXCEPTION_TERMS))) return null;
  return hit.raw.replace(/^\*|"/g, '');
}

/** Kennung der festen Regeln (Titel-Wörter, Ausschluss, Ausnahmen): Teil der Grobfilter-Kennung beim Einsammeln. */
export const GATE_RULES_KEY = hash64([GATE_TITLE_TERMS, TITLE_EXCLUDE_TERMS, TITLE_EXCEPTION_TERMS, [PSYCH_ROLE.source]].map((l) => l.join('|')).join('#'));
