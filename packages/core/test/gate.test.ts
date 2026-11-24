import { describe, expect, it } from 'vitest';
import { checkGate, gateTitleText, normalizeText, searchTextOf, titleExclusion, DEFAULT_GATE_TERMS } from '../src';

const gate = (title: string, text: string) =>
  checkGate(searchTextOf({ title, descriptionMd: text }), DEFAULT_GATE_TERMS, gateTitleText(title)).pass;

describe('Grobfilter: Fachbegriffe im Text, Allerweltswörter nur im Titel', () => {
  it('lässt Fachbegriffe irgendwo im Text durch', () => {
    expect(gate('Wissenschaftliche Mitarbeiterin (m/w/d)', 'Am Institut für Psychologie suchen wir …')).toBe(true);
    expect(gate('Doktorand (m/w/d)', 'Studie zur Emotionsregulation mit EEG')).toBe(true);
    expect(gate('Researcher', 'Our human factors group studies driver attention.')).toBe(true);
  });

  it('zählt Floskeln im Text nicht mehr', () => {
    expect(gate('Kaufmännische Leitung (m/w/d)', 'Sie sind eine engagierte Persönlichkeit mit Resilienz. Klinik für Psychiatrie und Psychotherapie.')).toBe(false);
    expect(gate('Data Scientist', 'Wir achten auf das Wohlbefinden und psychische Gesundheit unserer Mitarbeitenden.')).toBe(false);
  });

  it('zählt Allerweltswörter im Titel', () => {
    expect(gate('Stationssekretärin Psychiatrie', 'Aufgaben: Terminplanung.')).toBe(true);
    expect(gate('Projektmitarbeit Mental Health', 'Projekt in einer Stiftung.')).toBe(true);
  });

  it('ohne Titel zählen nur die Fachbegriffe', () => {
    expect(checkGate(normalizeText('Persönlichkeit und Wohlbefinden')).pass).toBe(false);
    expect(checkGate(normalizeText('Professur für Neuropsychologie')).pass).toBe(true);
  });
});

describe('Titel-Ausschluss', () => {
  it('nimmt Pflege, Medizin, Therapie, Verwaltung und Ausbildung heraus', () => {
    expect(titleExclusion('Pflegefachkraft (m/w/d) Allgemeinpsychiatrie')).toBe('pflege');
    expect(titleExclusion('Gesundheits- und Krankenpfleger (w/m/d) im Nachtdienst')).toBe('pflege');
    expect(titleExclusion('Assistenzärztin / Assistenzarzt - Klinik für Neurologie')).not.toBeNull();
    expect(titleExclusion('Facharzt (w/m/d) Psychiatrie und/oder Psychotherapie')).toBe('arzt');
    expect(titleExclusion('Ergotherapeut/-in (m/w/d)')).not.toBeNull();
    expect(titleExclusion('MFA Psychiatrische Institutsambulanz (m/w/d)')).toBe('mfa');
    expect(titleExclusion('Sekretariat der Abteilung Arbeits- und Organisationspsychologie (w/m/d)')).toBe('sekretariat');
    expect(titleExclusion('Duales Studium Soziale Arbeit (B.A.) 2027')).toBe('dual studi');
    expect(titleExclusion('Beschäftigte/r im Allgemeinen Vollzugsdienst')).toBe('vollzugsdienst');
  });

  it('lässt Psychologen- und Forschungsrollen trotz Ausschluss-Wort stehen', () => {
    expect(titleExclusion('Psycholog*in in Ausbildung (m/w/d) für die Station E64')).toBeNull();
    expect(titleExclusion('Pädagog:in / Psycholog:in / Sozialarbeiter:in (m/w/d)')).toBeNull();
    expect(titleExclusion('Psychologische Psychotherapeutin (m/w/d) für die Suchtstation')).toBeNull();
    expect(titleExclusion('Wissenschaftliche Mitarbeiterin Pflegewissenschaft')).toBeNull();
    expect(titleExclusion('wissenschaftl. Mitarbeiter*in Physiotherapiewissenschaft')).toBeNull();
    expect(titleExclusion('Postdoc in Nursing Research')).toBeNull();
  });

  it('lässt Stellen ohne Ausschluss-Wort in Ruhe', () => {
    expect(titleExclusion('Psychologin (m/w/d) Psychosomatik')).toBeNull();
    expect(titleExclusion('UX Researcher (m/w/d)')).toBeNull();
    expect(titleExclusion('Data Scientist')).toBeNull();
    expect(titleExclusion('Otago Fellowship in Psychology')).toBeNull();
    expect(titleExclusion(null)).toBeNull();
  });
});
