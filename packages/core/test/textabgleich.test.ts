// Der schnelle Abgleich (Wortbaum, siehe termMatches in text.ts) muss genau dasselbe liefern wie die Regel `re`.

import { describe, expect, it } from 'vitest';
import { compileTerm, compileTerms, firstMatch, allMatches, normalizeText, searchTextOf, stripNoise, termMatches } from '../src';

const TERMS = [
  'kognitiv', '*psycholog', '"R"', '"SPSS"', 'EEG', 'kognitive psych', 'visuelle suche', 'e prime', 'lehr lern', 'lehrlern',
  '*mensch technik', '"machine learning"', 'human factors', 'mixed methods', 'r', 'psychologie kognitive', 'arbeit', 'arbeitspsych',
  'mensch maschine', 'aufmerksam', 'in', 'von der', 'kognitiver prozess',
];

/** Lange Texte (über der Schwelle für den Wortbaum) mit Treffern und Beinahe-Treffern. */
const TEXTS = [
  'Wir suchen eine wissenschaftliche Mitarbeiterin für Entwicklungspsychologie und kognitive Prozesse. Auswertung mit R und SPSS, EEG-Labor vorhanden.',
  'Die Arbeitsgruppe Kognitive Psychologie untersucht visuelle Suche und Aufmerksamkeit (Human Factors, Mensch-Maschine-Interaktion) mit E-Prime.',
  'Steeg und Sohn suchen Programmierer für Machine Learning; Kenntnisse in Rust, keine Psychologie. Arbeitszeit flexibel, Arbeitsort Berlin.',
  'Lehr-Lern-Forschung, empirische Bildungsforschung und Mixed Methods; Mensch-Technik-Interaktion; Kenntnisse in R von Vorteil.',
  'machine learnings und machine-learning sind nicht dasselbe wie machine learning am Ende',
  'Ausbildung in kognitiver Verhaltenstherapie, Psychologie kognitiver Prozesse, von der Universität',
].map((t) => searchTextOf({ title: 'Stelle', descriptionMd: `${t} ${'Fülltext ohne Bezug, '.repeat(20)}${t}` }));

describe('Schneller Abgleich', () => {
  it('liefert für jeden Begriff dasselbe wie die Regel', () => {
    for (const raw of TERMS) {
      const term = compileTerm(raw)!;
      for (const text of [...TEXTS, ...TEXTS.map((t) => t.slice(0, 120)), '', 'r', 'machine learning']) {
        expect(termMatches(term, text), `${raw} in „${text.slice(0, 60)}…“`).toBe(term.re.test(text));
      }
    }
  });

  it('bleibt richtig, wenn zwischendurch neue Begriffe dazukommen', () => {
    const text = TEXTS[1];
    expect(termMatches(compileTerm('kognitive psych')!, text)).toBe(true);
    // neuer Begriff nach dem ersten Durchlauf desselben Texts
    const neu = compileTerm('aufmerksamkeitsforschung')!;
    expect(termMatches(neu, text)).toBe(false);
    expect(termMatches(compileTerm('visuelle such')!, text)).toBe(true);
  });

  it('firstMatch und allMatches wie mit der Regel', () => {
    const terms = compileTerms(TERMS);
    for (const text of TEXTS) {
      expect(firstMatch(text, terms)?.raw ?? null).toBe(terms.find((t) => t.re.test(text))?.raw ?? null);
      expect(allMatches(text, terms).map((t) => t.raw)).toEqual(terms.filter((t) => t.re.test(text)).map((t) => t.raw));
    }
  });
});

/** Die ursprüngliche Fassung von stripNoise (nur Regeln), gegen die die schnelle geprüft wird. */
function stripNoiseRegeln(raw: string): string {
  return raw
    .replace(/mailto:[^\s)]*/gi, ' ')
    .replace(/[\w.+-]+@/g, ' @')
    .replace(/(https?:\/\/[^\s)?#]*)[?#][^\s)]*/g, '$1')
    .replace(/\bi\.\s?d\.\s?R\./g, ' ')
    .replace(/\bR\s?(?:&|&amp;)\s?D\b/g, 'RnD')
    .replace(/(\p{Lu}{2,})-(\p{Lu})(?![\p{L}\d])/gu, '$1$2')
    .replace(/(\p{Ll})(?:\\?[\/*:_]-?(?:innen|rin|in|en|er|r|n|e)|\((?:innen|in|en|er|r|n|e)\))(?![\p{L}\d])/gu, '$1');
}

describe('Störendes entfernen', () => {
  it('liefert dasselbe wie die Regeln', () => {
    const cases = [
      'a@b', 'a@@b', '@x', 'x.y+z-w_1@host.de und a@b@c', 'ä@b', '', 'Mail: max.muster@uni-x.de (mailto:max@uni-x.de)',
      'https://uni.de/jobs?id=1&to=a@b.de#x und i. d. R. sowie R & D, R&amp;D', 'MT-R', 'AB-C-D', 'ABC-DE-F', 'AB-X-Y', 'A-B', 'ÄÖ-Ü',
      'MT-RS', 'MT-R2', '𝐀𝐁-𝐂', 'MT-𝐂', 'Mitarbeiter/in', 'Mitarbeiter/innen', 'Kolleg:innen', 'Bewerber(in)', 'Wissenschaftliche*r',
      'a/in/in', 'x*innen:innen', 'Mitarbeiter\\/in', 'Mitarbeiter/-in', 'Ärzt/innen', 'Ärztin/Arzt', 'a/inx', 'a(in)b', 'a(in)', '𝐚/in',
      'MITARBEITER/IN', 'a_e', 'a:e:e', '(in', 'a/', 'a\\', 'a\\/e', 'Medizinische/r MT-R (m/w/d), Kenntnisse in R',
    ];
    for (const s of cases) expect(stripNoise(s), JSON.stringify(s)).toBe(stripNoiseRegeln(s));
  });
});

describe('Suchtext', () => {
  it('hängt Wörter mit Bindestrich zusammengezogen an', () => {
    const t = searchTextOf({ title: 'Lehr-Lern-Forschung', descriptionMd: 'EEG-Labor, -führend, offen-, a--b, Mensch‐Technik‑Interaktion' });
    expect(t).toBe(
      `${normalizeText('Lehr-Lern-Forschung\n\nEEG-Labor, -führend, offen-, a--b, Mensch‐Technik‑Interaktion')} lehrlernforschung eeglabor menschtechnikinteraktion`,
    );
  });
});
