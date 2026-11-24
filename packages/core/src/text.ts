// Textnormalisierung und Begriffs-Abgleich.
// Gleiche Regeln für Anzeigen, Steckbrief-Begriffe und Grobfilter, damit Treffer nachvollziehbar sind.

/**
 * Normalisiert Text für den Abgleich: Kleinbuchstaben, Umlaute ausgeschrieben (ä→ae, ß→ss),
 * Akzente entfernt, alles außer Buchstaben/Ziffern wird zu einem Leerzeichen.
 * "Kognitive Neuro-Wissenschaft (m/w/d)" → "kognitive neuro wissenschaft m w d"
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/­/g, '') // weiches Trennzeichen
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Wie normalizeText, aber Bindestriche verschwinden ganz ("Lehr-Lern-Forschung" → "lehrlernforschung"). */
export function normalizeCompact(input: string): string {
  return normalizeText(input.replace(/[-‐‑–]/g, ''));
}

export interface CompiledTerm {
  /** Original-Begriff, wie im Profil eingetragen. */
  raw: string;
  /** Normalisierte Form. */
  norm: string;
  /** true = darf mitten im Wort stehen (Begriff begann mit *), sonst Wortanfang. */
  anywhere: boolean;
  re: RegExp;
  /**
   * Für den schnellen Abgleich (termMatches): Wörter, die im Text vorkommen müssen, als Nummern im Wortbaum.
   * Fehlt oder leer = nur über `re` prüfen.
   */
  keys?: number[];
  /** true = die Wörter allein entscheiden (ein einzelnes Wort), `re` muss nicht mehr laufen. */
  direct?: boolean;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Übersetzt einen Begriff in eine Suchregel.
 *  - "kognitiv"   → passt auf Wörter, die so anfangen (kognitive, kognitiven …)
 *  - "*psycholog" → passt überall, auch in Zusammensetzungen (Entwicklungspsychologie)
 *  - "EEG"        → Wortanfang, also "eeg", "eeg-labor", aber nicht "steeg"
 * Ein abschließendes * ist erlaubt und ändert nichts (Wortanfang ist ohnehin Präfix-Suche).
 *  - Wortgruppen ("kognitive psych", "visual search") passen auch auf gebeugte Formen: Jedes Wort ab vier
 *    Buchstaben darf weitergehen ("der Kognitiven Psychologie", "kognitiver Prozesse"). Kurze Wörter
 *    ("von", "in", "e") müssen genau so dastehen.
 */
export function compileTerm(term: string): CompiledTerm | null {
  let t = term.trim();
  if (!t) return null;
  // "R" in Anführungszeichen = genau dieses Wort (für kurze Begriffe wie R, SPSS, KI)
  const exact = /^["„“].+["“”]$/.test(t);
  if (exact) {
    const norm = normalizeText(t.slice(1, -1));
    if (!norm) return null;
    const words = norm.split(' ');
    // Ein Wort: genau dieses Wort im Text. Mehrere: Jedes Wort muss vorkommen, die Reihenfolge prüft re.
    const keys = words.length === 1 ? wordKeysOf(words, true) : wordKeysOf(words, false);
    return { raw: term, norm, anywhere: false, re: new RegExp(`(?:^| )${escapeRegExp(norm)}(?: |$)`), keys, direct: words.length === 1 };
  }
  const anywhere = t.startsWith('*');
  t = t.replace(/^\*+/, '').replace(/\*+$/, '');
  const norm = normalizeText(t);
  if (!norm) return null;
  const words = norm.split(' ');
  const body = words.map((w, i) => (i < words.length - 1 && w.length >= 4 ? `${escapeRegExp(w)}[a-z0-9]*` : escapeRegExp(w))).join(' ');
  const re = anywhere ? new RegExp(body) : new RegExp(`(?:^| )${body}`);
  // Jedes Wort steht an einem Wortanfang – außer bei * das erste, das darf mitten im Wort stehen.
  const keys = wordKeysOf(anywhere ? words.slice(1) : words, false);
  return { raw: term, norm, anywhere, re, keys, direct: !anywhere && words.length === 1 };
}

// ---------------------------------------------------------------- Schneller Abgleich
// Eine Anzeige hat im Mittel 7.000 Zeichen, ein Profil mit Brücken über 400 Begriffe. Jeden Begriff einzeln
// durch den ganzen Text zu schicken, kostete beim Start der App bei 8.000 Anzeigen über 10 Sekunden.
// Darum geht jeder Text nur einmal Wort für Wort durch einen Wortbaum aller Begriffswörter. Ein Begriff
// aus einem Wort ist damit entschieden; bei Wortgruppen läuft die Regel nur noch, wenn alle Wörter vorkommen.
// Das Ergebnis ist dasselbe wie mit `re` allein (geprüft an allen Live-Anzeigen).

interface WordNode {
  next: (WordNode | undefined)[];
  /** Schlüssel der Wörter, die hier enden und ein Wort im Text nur beginnen müssen */
  prefix: number[] | null;
  /** Schlüssel der Wörter, die hier enden und genau einem Wort im Text entsprechen müssen */
  exact: number[] | null;
}

// Begriffswörter sind normalisiert (nur 0–9 und a–z): Kinder als Feld über die Zeichen 0 (48) bis z (122)
const SLOT_FIRST = 48;
const SLOTS = 122 - SLOT_FIRST + 1;
const newNode = (): WordNode => ({ next: new Array<WordNode | undefined>(SLOTS).fill(undefined), prefix: null, exact: null });
const wordRoot: WordNode = newNode();
const wordKeys = new Map<string, number>();

/** Wörter eines Begriffs als Nummern im Wortbaum; undefined, wenn eins andere Zeichen als 0–9/a–z enthält. */
function wordKeysOf(words: readonly string[], exact: boolean): number[] | undefined {
  if (!words.every((w) => /^[0-9a-z]+$/.test(w))) return undefined;
  return words.map((w) => wordKey(w, exact));
}

/** Nummer eines Worts im Wortbaum (exact: Das Wort im Text muss genau so lauten, sonst nur so beginnen). */
function wordKey(word: string, exact: boolean): number {
  const k = `${exact ? '=' : '^'}${word}`;
  let id = wordKeys.get(k);
  if (id !== undefined) return id;
  id = wordKeys.size;
  wordKeys.set(k, id);
  let node = wordRoot;
  for (let i = 0; i < word.length; i++) {
    const slot = word.charCodeAt(i) - SLOT_FIRST;
    node = node.next[slot] ??= newNode();
  }
  if (exact) (node.exact ??= []).push(id);
  else (node.prefix ??= []).push(id);
  return id;
}

/** Welche Wörter des Wortbaums kommen im Text vor? Wortgrenze ist das Leerzeichen, wie in `re`. */
function scanWords(text: string): Uint8Array {
  const present = new Uint8Array(wordKeys.size);
  const n = text.length;
  let i = 0;
  for (;;) {
    let node: WordNode | undefined = wordRoot;
    let j = i;
    while (j < n) {
      const c = text.charCodeAt(j);
      if (c === 32) break;
      // Zeichen außerhalb 0–z kommen in keinem Begriffswort vor
      node = c >= SLOT_FIRST && c < SLOT_FIRST + SLOTS ? node.next[c - SLOT_FIRST] : undefined;
      if (!node) break;
      j++;
      if (node.prefix) for (const id of node.prefix) present[id] = 1;
    }
    if (node?.exact && (j === n || text.charCodeAt(j) === 32)) for (const id of node.exact) present[id] = 1;
    const space = text.indexOf(' ', j);
    if (space < 0) return present;
    i = space + 1;
  }
}

/** Kurze Texte (z. B. Titel) prüft die Regel schneller, als der Durchlauf sich lohnt. */
const SCAN_MIN_LENGTH = 300;
// Zuletzt durchlaufener Text: Ein Score fragt Dutzende Begriffe am selben Text ab.
let scannedText: string | null = null;
let scanned: Uint8Array = new Uint8Array(0);

/** Passt der Begriff auf den Text? Gleiches Ergebnis wie `term.re.test(text)`, bei langen Texten viel schneller. */
export function termMatches(term: CompiledTerm, text: string): boolean {
  const keys = term.keys;
  if (!keys || keys.length === 0 || text.length < SCAN_MIN_LENGTH) return term.re.test(text);
  // Neue Begriffe seit dem letzten Durchlauf (größerer Wortbaum): Text neu durchlaufen
  if (text !== scannedText || scanned.length !== wordKeys.size) {
    scanned = scanWords(text);
    scannedText = text;
  }
  for (const k of keys) if (!scanned[k]) return false;
  return term.direct === true || term.re.test(text);
}

export function compileTerms(terms: readonly string[]): CompiledTerm[] {
  const out: CompiledTerm[] = [];
  const seen = new Set<string>();
  for (const t of terms) {
    const c = compileTerm(t);
    if (!c) continue;
    const key = (c.anywhere ? '*' : '') + c.norm;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Gibt den ersten passenden Begriff zurück oder null. normText muss normalizeText-Ausgabe sein. */
export function firstMatch(normText: string, terms: readonly CompiledTerm[]): CompiledTerm | null {
  for (const t of terms) {
    if (termMatches(t, normText)) return t;
  }
  return null;
}

/** Alle passenden Begriffe (jeweils einmal). */
export function allMatches(normText: string, terms: readonly CompiledTerm[]): CompiledTerm[] {
  return terms.filter((t) => termMatches(t, normText));
}

/**
 * Entfernt, was beim Abgleich nur Fehltreffer erzeugt. Ohne das passt ein kurzer Begriff wie "R" auf
 * „Medizinische/r“, „i. d. R.“ oder „MT-R“ und damit auf jede vierte Anzeige.
 *  - Genderendungen: „Mitarbeiter/in“, „Wissenschaftliche*r“, „Kolleg:innen“, „Bewerber(in)“ → Grundwort
 *  - „i. d. R.“ und „R&D“
 *  - Kürzel mit angehängtem Buchstaben: „MT-R“ → „MTR“
 *  - bei Links und E-Mail-Adressen alles außer Rechner und Pfad (dort steht manchmal das Fach)
 */
export function stripNoise(raw: string): string {
  // Reihenfolge wie gehabt: E-Mail vor Link (ein @ im Link trennt ihn sonst anders auf)
  const s = stripMailNames(raw.replace(/mailto:[^\s)]*/gi, ' '))
    .replace(/(https?:\/\/[^\s)?#]*)[?#][^\s)]*/g, '$1')
    .replace(/\bi\.\s?d\.\s?R\./g, ' ')
    .replace(/\bR\s?(?:&|&amp;)\s?D\b/g, 'RnD');
  return stripGenderEndings(stripAbbrevLetter(s));
}

// Die drei Schritte unten suchen vom seltenen Zeichen aus (@, Bindestrich, / * : _ ( ) statt an jeder Textstelle.
// Mit Unicode-Klassen wie \p{Ll} an jeder Stelle kostete das im Browser bei 8.000 Anzeigen mehrere Sekunden.
// Das Ergebnis ist jeweils dasselbe wie mit der Regel im Kommentar (geprüft an allen Live-Anzeigen).

const isMailChar = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 46 || c === 43 || c === 45;

/** Name vor dem @ einer E-Mail-Adresse weg – wie s.replace(/[\w.+-]+@/g, ' @'). */
function stripMailNames(s: string): string {
  let at = s.indexOf('@');
  if (at < 0) return s;
  let out = '';
  let last = 0;
  while (at >= 0) {
    let start = at;
    while (start > last && isMailChar(s.charCodeAt(start - 1))) start--;
    if (start < at) {
      out += `${s.slice(last, start)} @`;
      last = at + 1;
    }
    at = s.indexOf('@', at + 1);
  }
  return out + s.slice(last);
}

/** „MT-R“ → „MTR“ – wie s.replace(/(\p{Lu}{2,})-(\p{Lu})(?![\p{L}\d])/gu, '$1$2'). */
const ABBREV_HYPHEN = /-(?<=\p{Lu}{2}-)(?=\p{Lu}(?![\p{L}\d]))/gu;
function stripAbbrevLetter(s: string): string {
  return s.replace(ABBREV_HYPHEN, '');
}

/**
 * „Mitarbeiter/in“ → „Mitarbeiter“ – wie
 * s.replace(/(\p{Ll})(?:\\?[\/*:_]-?(?:innen|rin|in|en|er|r|n|e)|\((?:innen|in|en|er|r|n|e)\))(?![\p{L}\d])/gu, '$1').
 */
const GENDER_START = /[\\/*:_(]/g;
const GENDER_SUFFIX = /(?:\\?[\/*:_]-?(?:innen|rin|in|en|er|r|n|e)|\((?:innen|in|en|er|r|n|e)\))(?![\p{L}\d])/uy;
const LOWER = /^\p{Ll}$/u;
/** Länge des Kleinbuchstabens, der direkt vor i endet (1 oder 2 Code-Einheiten); 0 = keiner. */
function lowerBefore(s: string, i: number): number {
  if (i <= 0) return 0;
  const lo = s.charCodeAt(i - 1);
  if (lo >= 0xdc00 && lo <= 0xdfff && i >= 2) {
    const hi = s.charCodeAt(i - 2);
    if (hi >= 0xd800 && hi <= 0xdbff) return LOWER.test(s.slice(i - 2, i)) ? 2 : 0;
  }
  if (lo >= 97 && lo <= 122) return 1;
  return LOWER.test(s[i - 1]) ? 1 : 0;
}
function stripGenderEndings(s: string): string {
  let out = '';
  let last = 0;
  GENDER_START.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GENDER_START.exec(s))) {
    const q = m.index;
    // Der Kleinbuchstabe davor darf nicht schon zum vorigen Treffer gehören (wie bei der Regel)
    const len = lowerBefore(s, q);
    if (!len || q - len < last) continue;
    GENDER_SUFFIX.lastIndex = q;
    const sm = GENDER_SUFFIX.exec(s);
    if (!sm) continue;
    out += s.slice(last, q);
    last = q + sm[0].length;
    GENDER_START.lastIndex = last;
  }
  return last === 0 ? s : out + s.slice(last);
}

const HYPHEN = /[-‐‑]/g;
const WORD_CHAR = /[\p{L}\d]/u;

/** Länge (1 oder 2 Code-Einheiten) des Buchstabens bzw. der Ziffer, die bei i beginnt; 0 = keins. */
function wordCharAt(s: string, i: number): number {
  if (i < 0 || i >= s.length) return 0;
  const lo = s.charCodeAt(i);
  // zweite Hälfte eines Ersatzpaars: Das Zeichen beginnt eine Stelle früher
  if (lo >= 0xdc00 && lo <= 0xdfff && i > 0) {
    const hi = s.charCodeAt(i - 1);
    if (hi >= 0xd800 && hi <= 0xdbff) return 0;
  }
  const ch = String.fromCodePoint(s.codePointAt(i)!);
  return WORD_CHAR.test(ch) ? ch.length : 0;
}

/** Länge des Buchstabens bzw. der Ziffer, die direkt vor i endet; 0 = keins. */
function wordCharBefore(s: string, i: number): number {
  if (i <= 0) return 0;
  const lo = s.charCodeAt(i - 1);
  if (lo >= 0xdc00 && lo <= 0xdfff && i >= 2) {
    const hi = s.charCodeAt(i - 2);
    if (hi >= 0xd800 && hi <= 0xdbff) return WORD_CHAR.test(s.slice(i - 2, i)) ? 2 : 0;
  }
  return WORD_CHAR.test(s[i - 1]) ? 1 : 0;
}

/**
 * Wörter mit Bindestrich („Lehr-Lern-Forschung“), wie raw.match(/(?<![\p{L}\d])[\p{L}\d]+(?:[-‐‑][\p{L}\d]+)+/gu).
 * Sucht von den Bindestrichen aus statt an jeder Textstelle – bei langen Anzeigen gut zehnmal so schnell.
 */
function hyphenatedWords(s: string): string[] | null {
  const out: string[] = [];
  HYPHEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HYPHEN.exec(s))) {
    const p = m.index;
    if (!wordCharBefore(s, p) || !wordCharAt(s, p + 1)) continue;
    let start = p;
    for (let k; (k = wordCharBefore(s, start)); ) start -= k;
    let end = p;
    for (;;) {
      // end steht auf einem Bindestrich, nach dem ein Wortzeichen folgt
      end += 1;
      for (let k; (k = wordCharAt(s, end)); ) end += k;
      const c = s.charCodeAt(end);
      if ((c === 0x2d || c === 0x2010 || c === 0x2011) && wordCharAt(s, end + 1)) continue;
      break;
    }
    out.push(s.slice(start, end));
    HYPHEN.lastIndex = end;
  }
  return out.length ? out : null;
}

/** Text, gegen den Profil- und Grobfilter-Begriffe geprüft werden. */
export function searchTextOf(job: { title: string; department?: string | null; descriptionMd: string }): string {
  // Zusammengesetzte Wörter mit Bindestrich zusätzlich zusammengezogen anhängen,
  // damit "Lehr-Lern-Forschung" auch auf "lehrlernforschung" passt.
  const raw = stripNoise(`${job.title}\n${job.department ?? ''}\n${job.descriptionMd}`);
  const norm = normalizeText(raw);
  const hyphenated = hyphenatedWords(raw);
  if (!hyphenated) return norm;
  const extra = hyphenated.map((w) => normalizeCompact(w)).join(' ');
  return `${norm} ${extra}`;
}

/** Entfernt Markdown-Auszeichnungen grob für Vorschautexte. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]+/g, '')
    .replace(/^\s*[-+]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Kürzt auf maximal n Zeichen an einer Wortgrenze. */
export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(' ');
  return (i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:.–-]+$/, '') + ' …';
}

/** Entfernt Gender-Zusätze wie (m/w/d) aus Titeln für Vergleiche. */
export function cleanTitleForKey(title: string): string {
  return normalizeText(
    title
      .replace(/\((?:[mwfdx]\s*\/\s*){1,3}[mwfdx]\)/gi, ' ')
      .replace(/\b(?:[mwfdx]\s*\/\s*){2,3}[mwfdx]\b/gi, ' ')
      .replace(/\(\s*\d{1,3}\s*%\s*\)/g, ' ')
      .replace(/[*:_]in(nen)?\b/gi, ''),
  );
}

/** Sehr einfache Spracherkennung (de/en) über häufige Funktionswörter. */
export function detectLanguage(text: string): 'de' | 'en' | null {
  const t = ` ${normalizeText(text.slice(0, 4000))} `;
  const count = (words: string[]) => words.reduce((n, w) => n + (t.split(` ${w} `).length - 1), 0);
  const de = count(['und', 'der', 'die', 'das', 'mit', 'fuer', 'sie', 'wir', 'ist', 'eine', 'zur', 'im']);
  const en = count(['and', 'the', 'with', 'for', 'you', 'we', 'is', 'an', 'of', 'to', 'in', 'our']);
  if (de + en < 5) return null;
  return de >= en ? 'de' : 'en';
}
