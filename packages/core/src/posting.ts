// Ist eine Seite eine einzelne Stellenanzeige? Grobe Regeln vor der KI: klare Fälle sofort, unklare warten auf Claude.

import { normalizeText } from './text';

export type PostingVerdict = 'anzeige' | 'unklar' | 'keine';

export interface PostingCheck {
  verdict: PostingVerdict;
  /** Erkannte Merkmale einer Anzeige (Aufgaben, Profil, Entgelt, Bewerbung, Umfang, Genderzusatz, Stellenbezeichnung im Titel, strukturierte Daten) */
  signals: string[];
  /** Warum die Seite nach etwas anderem aussieht (Adresse, Titel) */
  noise: string | null;
}

/** Pfadteile, unter denen keine einzelne Ausschreibung steht: Nachrichten, Termine, Formulare, Rechtliches. */
const NOISE_SEGMENT =
  /^(?:news|aktuelles|aktuell|neuigkeiten|presse|pressemitteilungen?|pressemeldungen?|medien|meldungen|blog|magazin|podcast|newsletter|veranstaltungen?|events?|termine|kalender|impressum|datenschutz|kontakt|login|anmelden|registrieren|jobalert|jobabo|publikationen|forschungsprojekte|studium|studiengaenge|studienangebot|lehre|ueber-uns|uber-uns|about|about-us|team|people|personen|mitarbeitende|vorstand|gremien|hochschulleitung|downloads?|archiv|preise|mitgliedschaft|stellungnahmen|artikel|webinare?|referenzen)$/i;
/** Bewerbungsformulare der Bewerbersysteme (umantis, softgarden …) */
const FORM_PATH = /\/application\/(?:new|checklogin)\b|\/apply(?:\/|$)|\/bewerbungsformular|\/jobs\/apply\b|\/login\b/i;
/** Steht im Pfad ein Wort für Stellen, ist ein Nachrichtenordner kein Gegenbeweis (manche Hochschulen veröffentlichen Stellen dort). */
const JOB_PATH = /stelle|job|karriere|career|ausschreib|vacanc|position|promotion|phd|doktorand|hiwi|hilfskr|praktik|stipend|recruit/i;

/** Genderzusatz in der Adresse („-m-w-d“, „_mwd“, „all-genders“) */
const GENDER_SLUG = /(?:^|[-_/(])(?:[mwdfx][-_/]){2}[mwdfx](?:$|[-_/).])|[-_](?:mwd|wmd|dmw|mfd|fmd)(?:$|[-_/.])|all-genders/i;

/** Sieht die Adresse nach einer Stelle aus? Solche Adressen werden nie über ein gelerntes Muster übersprungen. */
export function jobLikeUrl(url: string): boolean {
  try {
    const p = decodeURIComponent(new URL(url).pathname);
    return JOB_PATH.test(p) || GENDER_SLUG.test(p);
  } catch {
    return false;
  }
}

/** Pfadteil, unter dem keine einzelnen Ausschreibungen stehen (Nachrichten, Blog, Termine …)? */
export function isNoiseSegment(segment: string): boolean {
  return NOISE_SEGMENT.test(segment);
}

/** Titel, die nur eine Rubrik oder Übersicht benennen */
const NOISE_TITLE =
  /^(?:karriere|jobs?|jobportal|jobb[öo]rse|stellen(?:angebote|anzeigen|markt|b[öo]rse|portal|ausschreibungen)?|offene stellen(?:angebote)?|aktuelle stellen(?:angebote)?|arbeiten (?:bei|am|an|im)|arbeitgeber|über uns|ueber uns|unser team|team|kontakt|aktuelles|news|neuigkeiten|presse(?:mitteilungen?)?|veranstaltungen?|termine|impressum|datenschutz(?:erkl[äa]rung)?|login|anmeldung|startseite|home|bewerbung(?:sformular)?|online-?bewerbung|seite nicht gefunden|page not found|404|careers?|open positions|vacancies|working at)(?:\s*$|\s*[-–|:·]\s*)/i;

/** Berufs- oder Stellenbezeichnung im Titel */
const ROLE_TITLE =
  /praktik|masterarbeit|bachelorarbeit|abschlussarbeit|diplomarbeit|studienarbeit|werkstudent|hilfskr|hiwi|tutor|professur|professorship|professor|lehrbeauftragt|lehrauftrag|dozent|lecturer|postdoc|doktorand|phd|promotionsstelle|referent|sachbearbeit|mitarbeiter|assistenz|assistant|stipendi|fellowship|scholarship|trainee|volont|fsj|freiwillig|leitung|leiter|manager|designer|engineer|entwickler|developer|researcher|scientist|berater|consultant|koordinat|coordinator|therapeut|psychologe|psychologin|arzt|ärztin|pflege|dean/i;

const GENDER = /\((?:\s*[mwfdxi]\s*[/|,]\s*){1,3}[mwfdxi]\s*\)|\b[mwfd]\s*\/\s*[mwfd]\s*\/\s*[mwfdx]\b|\b\w+(?:\*|:|\/-?|_)innen?\b|\(all genders?\)|\(gn\)/i;

const SIGNALS: [string, RegExp][] = [
  ['aufgaben', /ihre aufgaben|ihr aufgabengebiet|aufgabengebiet|aufgabenbereich|aufgabenschwerpunkt|was sie erwartet|das erwartet sie|your tasks|your responsibilities|responsibilities|your role|tätigkeitsbeschreibung|zu ihren aufgaben|ihre tätigkeit/i],
  ['profil', /ihr profil|ihre qualifikation|einstellungsvoraussetzung|voraussetzungen|anforderungen|was sie mitbringen|das bringen sie mit|wir erwarten|your profile|requirements|qualifications|what you bring|we expect/i],
  ['angebot', /wir bieten|was wir bieten|das bieten wir|unser angebot|we offer|what we offer|benefits/i],
  ['entgelt', /entgeltgruppe|\bE\s?\d{1,2}\s?(?:TV|TVöD|TV-?L|TV-?H)|\bTV-?L\b|\bTVöD\b|\bTV-?H\b|\bAVR\b|besoldung|\bA\s?1[0-6]\b|\bW\s?[123]\b|vergütung|gehalt|salary|bezahlung nach/i],
  ['bewerbung', /bewerbungsfrist|bewerbungsschluss|bewerben sie sich|ihre bewerbung|bewerbungsunterlagen|jetzt bewerben|apply now|application deadline|closing date|how to apply|please apply|submit your application/i],
  ['umfang', /vollzeit|teilzeit|full[- ]time|part[- ]time|wochenstunden|stunden pro woche|stunden\/woche|hours per week|\d{2,3}\s?%\s*(?:der|einer|stelle|teilzeit|vollzeit|of)|befristet|unbefristet|fixed[- ]term|permanent position/i],
];

/**
 * Prüft Adresse, Titel und Text. „anzeige“: mindestens zwei Merkmale einer Ausschreibung (oder strukturierte Stellendaten
 * mit einem Merkmal). „keine“: Adresse oder Titel einer Rubrik, Nachricht oder eines Formulars und kein einziges Merkmal.
 * Alles andere ist „unklar“ und wartet, bis Claude die Seite beurteilt hat.
 */
export function checkPosting(p: { url: string; title: string; text: string; structured?: boolean }): PostingCheck {
  const head = p.text.slice(0, 20_000);
  const signals = SIGNALS.filter(([, re]) => re.test(head)).map(([k]) => k);
  if (GENDER.test(p.title) || GENDER.test(head.slice(0, 600))) signals.push('gender');
  if (ROLE_TITLE.test(p.title)) signals.push('titel');
  if (p.structured) signals.push('strukturiert');
  const noise = noiseOf(p.url, p.title);
  const strong = signals.length >= 2;
  if (strong && !(noise && signals.length < 3)) return { verdict: 'anzeige', signals, noise };
  if (noise && signals.length === 0) return { verdict: 'keine', signals, noise };
  return { verdict: 'unklar', signals, noise };
}

function noiseOf(url: string, title: string): string | null {
  const t = title.trim();
  if (NOISE_TITLE.test(t) && !GENDER.test(t) && normalizeText(t).split(' ').length <= 6) return `Titel „${t.slice(0, 60)}“`;
  let path = '';
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  if (FORM_PATH.test(path)) return 'Bewerbungsformular';
  if (JOB_PATH.test(path)) return null;
  const seg = path.split('/').filter(Boolean).find((s) => NOISE_SEGMENT.test(s));
  return seg ? `Adresse /${seg}/` : null;
}
