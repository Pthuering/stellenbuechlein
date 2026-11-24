// Grobe Einordnung der Stellenart. Wird nie zum Aussortieren benutzt, nur für Filter und Score.

import type { JobKind } from './types';

const TITLE_RULES: Array<[JobKind, RegExp]> = [
  ['professur', /(?:junior)?professur|\bprofessor(?:in|innen|ship|ships|s)?\b|\bW\s?[123]\b|tenure[- ]track|lehrstuhl/i],
  ['shk', /studentische[rn]?\s+(?:hilfskr|besch[äa]ftigt|mitarbeit)|\bshk\b|\bwhk\b|\bwhf\b|\bwhb\b|wissenschaftliche[rn]?\s+hilfskr|hilfskraft|hilfskr[äa]fte|\bhiwi|tutor(?:in|en|innen)?\b|student assistant|werkstudent/i],
  ['postdoc', /post-?\s?doc|postdoktorand|postdoctoral|promovierte[rn]?|nachwuchsgruppenleit|junior research group lead|research fellow|habilitand|akademische[rn]? r[äa]t/i],
  ['promotion', /doktorand|promotionsstelle|promotionsstipend|\bpromotion\b|zur promotion|\bph\.?\s?d\b|doctoral|doctorate|qualifikationsstelle|pre-?doc|graduiertenkolleg|stipendi/i],
  ['lehre', /lehrkraft f[üu]r besondere aufgaben|\blfba\b|\blecturer\b|lehrbeauftragt|lehrkraft|dozent(?:in)?\b/i],
  ['klinik', /psychotherapeut|psychologische[rn]?\s+psychotherap|\bapprob|klinische[rn]?\s+psycholog(?:e|in)\b|psycholog(?:e|in|innen|en)\s*\((?:[mwdx]\/){1,2}[mwdx]\)|\bpi[aw]\b|in ausbildung|in weiterbildung|ärzt|\barzt\b|pflege|therapeut/i],
  ['projekt', /projektkoordinat|koordinator(?:in)?|koordination|projektmanag|wissenschaftsmanag|referent(?:in)?\b|gesch[äa]ftsf[üu]hr|project (?:coordinator|manager)|research coordinator|studienkoordinat|study (?:coordinator|nurse)|akademische leitung|leitung|\bleiter(?:in)?\b|head of/i],
  ['wiss_ma', /wissenschaftliche[rn]?\s*[\/*:_]?\s*(?:r|n)?\s*mitarbeit|wiss\.\s*mitarbeit|akademische[rn]?\s+mitarbeit|research associate|research assistant|research scientist|\bresearcher\b|\bscientist\b|wissenschaftler(?:in)?/i],
  ['verwaltung', /sachbearbeit|verwaltung|sekret[äa]r|teamassistenz|assistenz (?:der|des)|system(?:administr|betreu)|\bit[- ]|informatiker|techniker|technische[rn]?\s+(?:angestellt|assistent|mitarbeit)|\b[mb]ta\b|laborant|elektrik|handwerk|hausmeister|buchhalt|controll|personalsach|bibliothek|[öo]ffentlichkeitsarbeit|marketing|kommunikation(?:smanag)?|referat|data steward|softwareentwickl|\bsw engineer|(?:software|web|app|game|java|python|php|front-?\s?end|back-?\s?end|full-?\s?stack|mobile|data|devops|cloud|platform|ml|machine learning)[- ]?(?:developer|entwickler|engineer)|programmierer|fachinformatik|devops/i],
];

/** Stellen an einer Professur oder einem Lehrstuhl sind keine Professur („Wissenschaftliche Mitarbeiterin am Lehrstuhl für …“). */
const AT_A_CHAIR = /mitarbeit|assisten[zt]|sekret[äa]r|referent|koordinat|coordinator|hilfskr|\bshk\b|doktorand|post-?\s?doc|\bph\.?\s?d\b|research (?:associate|assistant)(?! professor)/i;

const POSTDOC_TEXT = /abgeschlossene[rn]?\s+promotion|promotion\s+(?:in|im)\s+[^.]{0,60}(?:erforderlich|vorausgesetzt|voraussetzung)|promoviert(?:e|en)?\b|completed (?:ph\.?d|doctorate)|ph\.?d\.?\s+(?:degree|in)\b|doctoral degree|postdoc/i;
const PROMOTION_TEXT = /m[öo]glichkeit zur promotion|gelegenheit zur promotion|promotion wird (?:unterst[üu]tzt|erm[öo]glicht|angestrebt)|eigene[rn]? (?:wissenschaftlichen )?(?:weiter)?qualifi[zk]\w* \(promotion\)|zur eigenen wissenschaftlichen qualifizierung|promotionsvorhaben|promotionsprojekt|dissertation|pursue a ph\.?d|ph\.?d\.? (?:position|project|student|candidate)|doctoral (?:position|researcher|candidate|student)|kumulative promotion/i;

/**
 * Lecturer in Großbritannien, Irland, Neuseeland und Australien: feste Stelle mit eigener Forschung, entspricht einer
 * Juniorprofessur. Reine Lehre („Lecturer in Academic Skills“) erkennt man daran, dass der Text keine Forschung verlangt.
 */
const LECTURER_RESEARCH = /research[- ]active|(?:develop|establish|lead|build|conduct|pursue|maintain)\w*\s+(?:an?\s+|your\s+own\s+|the\s+)?(?:independent\s+|internationally\s+\w+\s+|high[- ]quality\s+|externally[- ]funded\s+)?research|research (?:programme|program|agenda|portfolio|profile|excellence)|teaching and research|research and teaching|research[- ]led teaching|eigene forschung/i;

export function classifyKind(title: string, text = ''): JobKind {
  const t = title || '';
  const atChair = AT_A_CHAIR.test(t);
  if (/\b(?:senior\s+)?lecturer\b/i.test(t) && !/lehrkraft|lehrbeauftragt/i.test(t) && LECTURER_RESEARCH.test(text.slice(0, 8000))) return 'professur';
  for (const [kind, re] of TITLE_RULES) {
    if (!re.test(t)) continue;
    if (kind === 'professur' && atChair) continue;
    if (kind === 'wiss_ma' || kind === 'projekt') {
      // "Wissenschaftliche Mitarbeiterin" ist oft eine Promotions- oder Postdoc-Stelle – Text entscheidet.
      const head = text.slice(0, 6000);
      if (kind === 'wiss_ma') {
        if (POSTDOC_TEXT.test(head) && !PROMOTION_TEXT.test(head)) return 'postdoc';
        if (PROMOTION_TEXT.test(head)) return 'promotion';
      }
    }
    return kind;
  }
  const head = text.slice(0, 6000);
  if (!atChair && /\bW\s?[23]\b.*profess|universit[äa]tsprofessur|juniorprofessur/i.test(head)) return 'professur';
  if (PROMOTION_TEXT.test(head) && !POSTDOC_TEXT.test(head)) return 'promotion';
  if (POSTDOC_TEXT.test(head)) return 'postdoc';
  for (const [kind, re] of TITLE_RULES) {
    if (kind === 'professur' || kind === 'promotion' || kind === 'postdoc') continue;
    if (re.test(head.slice(0, 1500))) return kind;
  }
  return 'sonstige';
}
