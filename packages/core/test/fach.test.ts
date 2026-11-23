import { describe, expect, it } from 'vitest';
import { fachSignale, fachlichEinschlaegig, searchTextOf, starterProfile, type Suchprofil } from '../src';

// Profil mit einem Schwerpunkt (3 Herzen) und „Psychologie allgemein“ mit einem Herz
const base = starterProfile('2026-10-10T00:00:00Z');
const profile: Suchprofil = {
  ...base,
  categories: base.categories.map((c) =>
    c.id === 'thema'
      ? {
          ...c,
          items: [
            { id: 'f-psych', label: 'Psychologie allgemein', hearts: 1 as const, terms: ['*psycholog', 'psychology'] },
            { id: 't-gedaecht', label: 'Gedächtnis & Lernen', hearts: 3 as const, terms: ['working memory', 'learning and memory', 'human memory'] },
          ],
        }
      : c,
  ),
};
const signale = (title: string, descriptionMd: string) => fachSignale({ title }, descriptionMd, searchTextOf({ title, descriptionMd }), profile);

describe('Fachprüfung ohne KI', () => {
  it('passende Wörter im Text reichen nicht: Primatenforschung ist nicht einschlägig', () => {
    const s = signale('Post-Doctorate in NHP systems neuroscience (M/F)', 'We record neural activity in non-human primates during working memory tasks. PhD in neuroscience or biology required.');
    expect(s).toEqual({ titel: false, abschluss: false, schwerpunkt: true });
    expect(fachlichEinschlaegig(s)).toBe(false);
  });

  it('einschlägig über den Titel oder über den verlangten Abschluss, jeweils mit Schwerpunkt', () => {
    const titel = signale('Postdoc in Cognitive Psychology', 'Experiments on working memory and attention.');
    expect(titel).toMatchObject({ titel: true, schwerpunkt: true });
    expect(fachlichEinschlaegig(titel)).toBe(true);
    const abschluss = signale('Postdoctoral Researcher (m/f/d)', 'You study learning and memory in older adults. Requirements: PhD in psychology or a related field.');
    expect(abschluss).toEqual({ titel: false, abschluss: true, schwerpunkt: true });
    expect(fachlichEinschlaegig(abschluss)).toBe(true);
    expect(fachlichEinschlaegig(signale('Wissenschaftliche Mitarbeiterin (m/w/d)', 'Arbeitsgedächtnis und working memory. Voraussetzung: abgeschlossenes Studium der Psychologie.'))).toBe(true);
  });

  it('Psychologie allein ohne einen Schwerpunkt reicht nicht', () => {
    const s = signale('Post-doc in Psychology', 'Research on personality. PhD in psychology required.');
    expect(s).toEqual({ titel: true, abschluss: true, schwerpunkt: false });
    expect(fachlichEinschlaegig(s)).toBe(false);
  });
});
