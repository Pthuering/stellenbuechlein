import { describe, expect, it } from 'vitest';
import { assessDeadline, extractFields, findYearlessDates, inferYear, isOpen, verifyDeadlineQuote } from '../src';

const TODAY = '2026-10-12';

describe('Fristen ohne Jahr', () => {
  it('findet „15.11.“ und „15. November“, aber keine vollständigen Daten', () => {
    const d = findYearlessDates('bis zum 15.11. oder 3. Dezember, nicht 15.11.2026 und nicht 1. Januar 2027');
    expect(d.map((x) => [x.day, x.month])).toEqual([
      [15, 11],
      [3, 12],
    ]);
  });

  it('ergänzt das Jahr vom Bezugsdatum aus', () => {
    expect(inferYear(15, 11, '2026-10-12')).toBe('2026-11-15');
    // Dezember-Anzeige mit Frist im Januar
    expect(inferYear(10, 1, '2026-12-20')).toBe('2027-01-10');
    // knapp vorbei: dieses Jahr (die Anzeige ist dann abgelaufen)
    expect(inferYear(30, 9, '2026-10-12')).toBe('2026-09-30');
    // mehrdeutig
    expect(inferYear(15, 7, '2026-10-12')).toBeNull();
  });

  it('liest Fristen ohne Jahr aus dem Text', () => {
    const f = extractFields('Bewerbungen richten Sie bitte bis zum 30.11. an die unten genannte Adresse.', { today: TODAY });
    expect(f.deadline).toBe('2026-11-30');
    expect(f.deadlineYearInferred).toBe(true);
    const g = extractFields('Bewerbungsfrist: 15. Juli', { today: TODAY });
    expect(g.deadline).toBeNull();
    expect(g.deadlineUnclear).toBe('15. Juli');
  });

  it('nimmt eine verlängerte Frist statt der ursprünglichen', () => {
    const f = extractFields('Bewerbungsfrist: 15.10.2026. Die Bewerbungsfrist wurde verlängert bis zum 31.10.2026.', { today: TODAY });
    expect(f.deadline).toBe('2026-10-31');
  });
});

describe('Fristen prüfen', () => {
  it('lässt plausible Fristen durch', () => {
    expect(assessDeadline({ iso: '2026-11-15', raw: '15.11.2026', today: TODAY, isNew: true })).toEqual({ deadline: '2026-11-15', check: 'ok', note: null, review: false });
  });

  it('markiert ergänzte Jahre', () => {
    const a = assessDeadline({ iso: '2026-11-30', raw: '30.11.', yearInferred: true, today: TODAY, isNew: true });
    expect(a.check).toBe('jahr');
    expect(a.note).toMatch(/ohne Jahr/);
  });

  it('Frist vor der Veröffentlichung kann nicht stimmen', () => {
    const a = assessDeadline({ iso: '2026-09-01', raw: '01.09.2026', postedAt: '2026-10-01', today: TODAY, isNew: true });
    expect(a).toMatchObject({ deadline: null, check: 'unsicher', review: true });
  });

  it('weit in der Zukunft: unsicher, bleibt sichtbar', () => {
    const a = assessDeadline({ iso: '2027-09-30', raw: '30.09.2027', today: TODAY, isNew: true });
    expect(a).toMatchObject({ deadline: '2027-09-30', check: 'unsicher', review: true });
  });

  it('vermuteter Tippfehler im Jahr (im Januar)', () => {
    const a = assessDeadline({ iso: '2026-01-31', raw: '31.01.2026', today: '2027-01-10', isNew: true });
    expect(a).toMatchObject({ deadline: '2027-01-31', check: 'unsicher', review: true });
    expect(a.note).toMatch(/vermutlich 31\.01\.2027/);
  });

  it('beim Fund schon vorbei: abgelaufen, KI sieht nach', () => {
    const a = assessDeadline({ iso: '2026-09-15', raw: '15.09.2026', today: TODAY, isNew: true });
    expect(a).toMatchObject({ deadline: '2026-09-15', review: true });
    expect(assessDeadline({ iso: '2026-09-15', raw: '15.09.2026', today: TODAY, isNew: false }).review).toBe(false);
  });

  it('nur Seitendaten, unplausibel weit weg: ignoriert', () => {
    expect(assessDeadline({ iso: null, raw: null, structured: '2028-01-01T00:00:00Z', today: TODAY, isNew: true }).deadline).toBeNull();
  });

  it('offen heißt: Frist heute oder später', () => {
    expect(isOpen({ status: 'aktiv', deadline: TODAY }, TODAY)).toBe(true);
    expect(isOpen({ status: 'aktiv', deadline: '2026-10-11' }, TODAY)).toBe(false);
    expect(isOpen({ status: 'aktiv', deadline: null }, TODAY)).toBe(true);
    expect(isOpen({ status: 'abgelaufen', deadline: '2026-12-01' }, TODAY)).toBe(false);
  });
});

describe('KI-Antwort zur Frist prüfen', () => {
  const text = 'Wir freuen uns auf Ihre Bewerbung bis zum 30. November 2026 über unser Portal. Beginn: 01.01.2027.';
  it('akzeptiert ein wörtliches Zitat mit passendem Datum', () => {
    expect(verifyDeadlineQuote(text, '2026-11-30', 'Bewerbung bis zum 30. November 2026')).toBe(true);
  });
  it('lehnt erfundene oder falsche Daten ab', () => {
    expect(verifyDeadlineQuote(text, '2026-12-15', 'Bewerbung bis zum 30. November 2026')).toBe(false);
    expect(verifyDeadlineQuote(text, '2026-11-30', 'Bewerbungsschluss 30.11.2026')).toBe(false);
    expect(verifyDeadlineQuote(text, '2027-11-30', 'Bewerbung bis zum 30. November 2026')).toBe(false);
  });
});
