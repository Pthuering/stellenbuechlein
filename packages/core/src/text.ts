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
 */
export function compileTerm(term: string): CompiledTerm | null {
  let t = term.trim();
  if (!t) return null;
  // "R" in Anführungszeichen = genau dieses Wort (für kurze Begriffe wie R, SPSS, KI)
  const exact = /^["„“].+["“”]$/.test(t);
  if (exact) {
    const norm = normalizeText(t.slice(1, -1));
    if (!norm) return null;
    return { raw: term, norm, anywhere: false, re: new RegExp(`(?:^| )${escapeRegExp(norm)}(?: |$)`) };
  }
  const anywhere = t.startsWith('*');
  t = t.replace(/^\*+/, '').replace(/\*+$/, '');
  const norm = normalizeText(t);
  if (!norm) return null;
  const body = escapeRegExp(norm);
  const re = anywhere ? new RegExp(body) : new RegExp(`(?:^| )${body}`);
  return { raw: term, norm, anywhere, re };
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
    if (t.re.test(normText)) return t;
  }
  return null;
}

/** Alle passenden Begriffe (jeweils einmal). */
export function allMatches(normText: string, terms: readonly CompiledTerm[]): CompiledTerm[] {
  return terms.filter((t) => t.re.test(normText));
}

/** Text, gegen den Profil- und Grobfilter-Begriffe geprüft werden. */
export function searchTextOf(job: { title: string; department?: string | null; descriptionMd: string }): string {
  // Zusammengesetzte Wörter mit Bindestrich zusätzlich zusammengezogen anhängen,
  // damit "Lehr-Lern-Forschung" auch auf "lehrlernforschung" passt.
  const raw = `${job.title}\n${job.department ?? ''}\n${job.descriptionMd}`;
  const norm = normalizeText(raw);
  const hyphenated = raw.match(/[\p{L}\d]+(?:[-‐‑][\p{L}\d]+)+/gu);
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
