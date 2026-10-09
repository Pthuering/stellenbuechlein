// Grobfilter beim Einsammeln: Nur bei breiten Quellen (zentrale Stellenbörsen, Portale) wird geprüft,
// ob irgendein Bezug zu Psychologie/Verhaltensforschung vorkommt. Bewusst großzügig – lieber eine
// Anzeige zu viel. Was durchfällt, wird protokolliert und ist in der App einsehbar.

import { compileTerms, allMatches, type CompiledTerm } from './text';

/**
 * Standard-Begriffe. "*" vorne = darf mitten im Wort stehen (Zusammensetzungen).
 * In der App unter Einstellungen → Quellen → Grobfilter änderbar.
 */
export const DEFAULT_GATE_TERMS: string[] = [
  '*psych', // Psychologie, Psychiatrie, Psychotherapie, psychisch, Neuropsychologie, Psychometrie …
  'kognit', 'cognit', '*neurowiss', 'neuroscien', '*neurolog', 'neuroimaging',
  '*verhalten', 'behavio',
  'emotion', '*wahrnehmung', 'perception',
  '*bildungsforsch', '*lehrlern', '*lernforsch', '*unterrichtsforsch', 'erziehungswiss', 'educational research',
  'entwicklungsforsch', 'kindheitsforsch', 'fruehpaedagog', 'early childhood',
  'arbeitswiss', '*arbeitsforsch', 'human factors', 'ergonom', 'mensch maschine', 'mensch technik', 'usability', 'user experience', 'ux research',
  '*gesundheitsforsch', 'gesundheitswiss', 'health research', 'public mental', 'gesundheitsverhalten',
  'suchtforsch', 'suchterkrank', 'suchtmedizin', 'suchthilfe', 'addiction', 'substance use',
  'mental health', 'wohlbefinden', 'well being', 'wellbeing', 'resilien',
  'persoenlichkeit', 'personality',
  'autismus', 'autism', 'adhs', 'adhd', 'demenz', 'dementia', 'depress', 'angststoer', 'anxiety', 'ptbs', 'ptsd',
  'aufmerksamkeit', 'gedaechtnis', 'sprachverarbeitung', 'spracherwerb', 'language acquisition',
  'eye tracking', 'eyetracking', 'eeg', 'fmri', 'fmrt', 'mrt studie',
  'kriminolog', 'criminolog',
  'sozialforschung', 'survey methodolog', 'umfrageforsch',
];

export interface GateResult {
  pass: boolean;
  matched: string[];
}

let cacheKey = '';
let cacheCompiled: CompiledTerm[] = [];

function compiled(terms: readonly string[]): CompiledTerm[] {
  const key = terms.join('\u0001');
  if (key !== cacheKey) {
    cacheKey = key;
    cacheCompiled = compileTerms(terms);
  }
  return cacheCompiled;
}

/**
 * Prüft normalisierten Suchtext gegen die Grobfilter-Begriffe.
 * @param normSearchText Ausgabe von searchTextOf()
 */
export function checkGate(normSearchText: string, terms: readonly string[] = DEFAULT_GATE_TERMS): GateResult {
  const matches = allMatches(normSearchText, compiled(terms));
  return { pass: matches.length > 0, matched: matches.map((m) => m.raw).slice(0, 12) };
}
