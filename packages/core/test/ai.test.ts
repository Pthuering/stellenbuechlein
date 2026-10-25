import { describe, expect, it } from 'vitest';
import { bigModel, parseBridgeSuggestions, toSuggestedBridges, withoutThinking } from '../src/ai';
import { starterProfile } from '../src/profile';

describe('Modellwahl', () => {
  it('nutzt immer das große Modell, nie Flash', () => {
    for (const m of [undefined, '', 'deepseek-chat', 'deepseek-reasoner', 'deepseek-flash', 'deepseek-v4-flash', 'DeepSeek-V4.1-Flash-1017']) {
      expect(bigModel(m)).toBe('deepseek-v4-pro');
    }
    expect(bigModel('deepseek-v4-pro')).toBe('deepseek-v4-pro');
    expect(bigModel('gpt-5')).toBe('gpt-5');
  });

  it('schaltet den Denkmodus nur bei DeepSeek ab', () => {
    expect(withoutThinking('https://api.deepseek.com')).toEqual({ thinking: { type: 'disabled' } });
    expect(withoutThinking('https://api.openai.com/v1')).toEqual({});
  });
});

describe('Brücken-Vorschläge der KI', () => {
  it('behält brauchbare Brücken und lässt einzelne unbrauchbare weg', () => {
    const { bruecken, problems } = parseBridgeSuggestions({
      bruecken: [
        { name: 'Usability', feld: ['usability', 'ux research', 'nutzerstudie'], anker: null, suche: 'UX Research Psychologie', warum: 'x'.repeat(400) },
        { name: 'Zu dünn', feld: ['a'], warum: 'Nur ein Begriff.' },
        { name: 'Lernen digital', feld: ['e-learning', 'lernplattform', 'e-learning'], suche: ['Instructional Design', 'Lerndesign', 'a', 'b', 'c', 'd'], warum: 'Lernpsychologie.' },
      ],
    });
    expect(bruecken.map((b) => b.name)).toEqual(['Usability', 'Lernen digital']);
    expect(bruecken[0].anker).toEqual([]);
    expect(bruecken[0].suche).toEqual(['UX Research Psychologie']);
    expect(bruecken[0].warum).toHaveLength(300);
    expect(bruecken[0].warum.endsWith('…')).toBe(true);
    expect(bruecken[1].feld).toEqual(['e-learning', 'lernplattform']);
    expect(bruecken[1].suche).toEqual(['Instructional Design', 'Lerndesign']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Brücke 2 \(name, feld, warum\): feld/);
  });

  it('findet die Liste auch unter „brücken“ oder ohne Hülle', () => {
    const b = { name: 'Usability', feld: ['usability', 'ux research'], warum: 'Weil.' };
    expect(parseBridgeSuggestions({ brücken: [b] }).bruecken).toHaveLength(1);
    expect(parseBridgeSuggestions({ Bruecken: [b] }).bruecken).toHaveLength(1);
    expect(parseBridgeSuggestions({ vorschlaege: [b] }).bruecken).toHaveLength(1);
    expect(parseBridgeSuggestions([b]).bruecken).toHaveLength(1);
  });

  it('meldet eine Antwort ohne Brücken-Liste mit den gefundenen Feldern', () => {
    expect(parseBridgeSuggestions({ ideen: 'keine', anzahl: 0 })).toEqual({ bruecken: [], problems: ['kein Feld "bruecken" (gefunden: ideen, anzahl)'] });
    expect(parseBridgeSuggestions(null).bruecken).toEqual([]);
  });

  it('macht daraus Vorschläge ohne die vorhandenen Brücken', () => {
    const p = starterProfile();
    const { bruecken } = parseBridgeSuggestions({ bruecken: [{ name: 'Neu hier', feld: ['abc', 'def'], warum: 'Weil.' }] });
    const out = toSuggestedBridges(bruecken, p);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Neu hier', herkunft: 'ki', aktiv: true });
  });
});
