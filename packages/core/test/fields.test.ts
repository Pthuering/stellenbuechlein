import { describe, expect, it } from 'vitest';
import { extractFields, findDates } from '../src';

const TODAY = '2026-10-10';

describe('findDates', () => {
  it('erkennt deutsche und englische Formate', () => {
    const d = findDates('Frist 15.11.2026, Beginn 1. Januar 2027, start March 3, 2027, ISO 2026-12-01, kurz 5.1.27');
    expect(d.map((x) => x.iso)).toEqual(['2026-11-15', '2027-01-01', '2027-03-03', '2026-12-01', '2027-01-05']);
  });
  it('verwirft ungültige Daten', () => {
    expect(findDates('am 31.02.2026')).toEqual([]);
  });
});

describe('extractFields – Frist', () => {
  it('nimmt das Datum nach "Bewerbungsfrist"', () => {
    const f = extractFields('Die Stelle ist befristet bis zum 31.12.2028. Bewerbungsfrist: 15.11.2026. Beginn zum 01.01.2027.', { today: TODAY });
    expect(f.deadline).toBe('2026-11-15');
  });
  it('erkennt "Bewerbungen ... bis zum"', () => {
    const f = extractFields('Ihre Bewerbung richten Sie bitte bis zum 20. November 2026 an bewerbung@uni.de.', { today: TODAY });
    expect(f.deadline).toBe('2026-11-20');
  });
  it('verwechselt Vertragsende nicht mit Frist', () => {
    const f = extractFields('Die Stelle ist zunächst befristet bis zum 31.03.2029. Wir freuen uns auf Ihre Bewerbung.', { today: TODAY });
    expect(f.deadline).toBeNull();
  });
  it('englische Frist', () => {
    const f = extractFields('Please submit your application no later than November 30, 2026 via our portal.', { today: TODAY });
    expect(f.deadline).toBe('2026-11-30');
  });
  it('Application deadline mit Ordinalzahl', () => {
    const f = extractFields('Application deadline: 1st December 2026', { today: TODAY });
    expect(f.deadline).toBe('2026-12-01');
  });
});

describe('extractFields – Entgelt', () => {
  it.each([
    ['Die Vergütung erfolgt nach Entgeltgruppe 13 TV-L.', 'E 13 TV-L', 13],
    ['Vergütung: E 13 TV-L (75 %)', 'E 13 TV-L', 13],
    ['bis E 13 TV-H', 'bis E 13 TV-H', 13],
    ['Bezahlung nach TV-L E13', 'E 13 TV-L', 13],
    ['eingruppiert in EG 14 TVöD-Bund', 'E 14 TVöD-Bund', 14],
    ['75 % TV-L 13', 'E 13 TV-L', 13],
    ['W2-Professur für Sozialpsychologie (Besoldungsgruppe W2)', 'W2', 15],
  ])('%s', (text, grade, level) => {
    const f = extractFields(text, { today: TODAY });
    expect(f.payGrade).toBe(grade);
    expect(f.payLevel).toBe(level);
  });
  it('ignoriert Raumnummern', () => {
    const f = extractFields('Das Büro befindet sich in Gebäude E 2, Raum 104.', { today: TODAY });
    expect(f.payGrade).toBeNull();
  });
});

describe('extractFields – Umfang, Befristung, Beginn, Kennziffer', () => {
  it('Prozent aus dem Titel', () => {
    const f = extractFields('Text ohne Angabe', { title: 'Wiss. Mitarbeiter*in (65 %)', today: TODAY });
    expect(f.workloadPct).toBe(65);
  });
  it('Prozent mit Kontext im Text', () => {
    const f = extractFields('Die Stelle ist mit 75 % der regelmäßigen Arbeitszeit zu besetzen.', { today: TODAY });
    expect(f.workloadPct).toBe(75);
  });
  it('Wochenstunden', () => {
    const f = extractFields('Teilzeit mit 32 Stunden pro Woche', { today: TODAY });
    expect(f.workloadPct).toBe(80);
    expect(f.workloadText).toBe('32 Std./Woche');
  });
  it('Vollzeit', () => {
    expect(extractFields('Es handelt sich um eine Vollzeitstelle.', { today: TODAY }).workloadPct).toBe(100);
  });
  it('befristet mit Dauer', () => {
    const f = extractFields('Die Stelle ist auf drei Jahre befristet. Sie ist befristet für 3 Jahre.', { today: TODAY });
    expect(f.isPermanent).toBe(false);
    expect(f.fixedTerm).toMatch(/^befristet/);
  });
  it('befristet für 3 Jahre', () => {
    const f = extractFields('Die Stelle ist befristet für 3 Jahre (WissZeitVG).', { today: TODAY });
    expect(f.fixedTerm).toBe('befristet, 3 Jahre');
  });
  it('unbefristet', () => {
    const f = extractFields('Es handelt sich um eine unbefristete Stelle.', { today: TODAY });
    expect(f.isPermanent).toBe(true);
  });
  it('befristet vor unbefristet', () => {
    const f = extractFields('Die Stelle ist befristet; eine unbefristete Weiterbeschäftigung wird angestrebt.', { today: TODAY });
    expect(f.isPermanent).toBe(false);
  });
  it('Beginn', () => {
    expect(extractFields('zu besetzen zum nächstmöglichen Zeitpunkt', { today: TODAY }).startText).toBe('zum nächstmöglichen Zeitpunkt');
    expect(extractFields('Einstellung zum 01.01.2027', { today: TODAY }).startText).toBe('01.01.2027');
  });
  it('Kennziffer und Kontakt', () => {
    const f = extractFields('Kennziffer: 2026/123. Fragen beantwortet Frau Muster (anna.muster@uni-halle.de).', { today: TODAY });
    expect(f.referenceNo).toBe('2026/123');
    expect(f.contact).toBe('anna.muster@uni-halle.de');
  });
});
