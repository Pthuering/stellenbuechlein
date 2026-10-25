import { describe, expect, it } from 'vitest';
import { DEFAULT_HIGH_SCORE_ALERT, highScoreDigest, parseHighScoreAlert, reminderText } from '../src/reminders';

describe('Benachrichtigungen', () => {
  it('Fristen-Text', () => {
    expect(reminderText(0)).toBe('Frist endet heute');
    expect(reminderText(8)).toBe('Frist endet in einer Woche');
    expect(reminderText(15)).toBe('Frist endet in 2 Wochen');
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
  });

  it('Einstellung mit Standardwerten und Grenzen', () => {
    expect(parseHighScoreAlert(null)).toEqual(DEFAULT_HIGH_SCORE_ALERT);
    expect(parseHighScoreAlert({ on: false, min: 92 })).toEqual({ on: false, min: 92 });
    expect(parseHighScoreAlert({ on: true, min: 7 }).min).toBe(DEFAULT_HIGH_SCORE_ALERT.min);
  });
});
