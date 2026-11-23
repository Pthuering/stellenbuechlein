import { describe, expect, it } from 'vitest';
import { DEFAULT_HIGH_SCORE_ALERT, highScoreDigest, parseHighScoreAlert, reminderText, srForm } from '../src/reminders';

describe('Benachrichtigungen', () => {
  it('Fristen-Text', () => {
    expect(reminderText(0)).toBe('Frist endet heute');
    expect(reminderText(8)).toBe('Frist endet in einer Woche');
    expect(reminderText(15)).toBe('Frist endet in 2 Wochen');
    expect(reminderText(1, 'en')).toBe('Deadline is tomorrow');
    expect(reminderText(15, 'en')).toBe('Deadline in 2 weeks');
    expect(reminderText(5, 'sr')).toBe('Rok ističe za 5 dana');
    expect(reminderText(21, 'sr')).toBe('Rok ističe za 3 nedelje');
    expect(reminderText(30, 'sr')).toBe('Rok ističe za 30 dana');
  });

  it('serbische Zahlformen', () => {
    const f = (n: number) => srForm(n, 'oglas', 'oglasa', 'oglasa_');
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(f)).toEqual(['oglas', 'oglasa', 'oglasa', 'oglasa_', 'oglasa_', 'oglasa_', 'oglasa_', 'oglas', 'oglasa', 'oglasa_', 'oglas', 'oglasa_']);
  });

  it('neue, sehr gut passende Anzeigen: gebündelt, die besten zuerst', () => {
    const jobs = [
      { id: 'a', title: 'Promotion Kognition', score: 91 },
      { id: 'b', title: 'Postdoc Klinische', score: 97 },
      { id: 'c', title: 'Hilfskraft', score: 40 },
      { id: 'd', title: 'Wiss. MA', score: 88 },
      { id: 'e', title: 'Projekt', score: 86 },
    ];
    expect(highScoreDigest(jobs, 99)).toBeNull();
    const one = highScoreDigest(jobs, 95)!;
    expect(one.title).toBe('Neue Anzeige, passt zu 97 %');
    expect(one.url).toBe('/#/stelle/b');
    const many = highScoreDigest(jobs, 85)!;
    expect(many.title).toBe('4 neue Anzeigen ab 85 %');
    expect(many.body.split('\n')[0]).toBe('97 % · Postdoc Klinische');
    expect(many.body).toMatch(/und 1 weitere$/);
    expect(many.url).toBe('/#/alle');
    expect(highScoreDigest(jobs, 95, 'en')!.title).toBe('New posting, 97% match');
    const sr = highScoreDigest(jobs, 85, 'sr')!;
    expect(sr.title).toBe('4 nova oglasa od 85%');
    expect(sr.body).toMatch(/i još 1$/);
  });

  it('Einstellung mit Standardwerten und Grenzen', () => {
    expect(parseHighScoreAlert(null)).toEqual(DEFAULT_HIGH_SCORE_ALERT);
    expect(parseHighScoreAlert({ on: false, min: 92 })).toEqual({ on: false, min: 92 });
    expect(parseHighScoreAlert({ on: true, min: 7 }).min).toBe(DEFAULT_HIGH_SCORE_ALERT.min);
  });
});
