import { describe, expect, it } from 'vitest';
import { checkPosting } from '../src';

const AD = `## Ihre Aufgaben
- Durchführung von Studien zur Emotionsregulation
## Ihr Profil
- Master in Psychologie
Die Stelle ist mit 65 % zu besetzen, Vergütung nach Entgeltgruppe 13 TV-L. Bewerbungsfrist: 15.11.2026.`;

describe('Einzelne Anzeige oder etwas anderes?', () => {
  it('erkennt eine Ausschreibung an ihren Merkmalen', () => {
    const c = checkPosting({ url: 'https://uni.example/stellen/123', title: 'Wissenschaftliche Mitarbeiterin (m/w/d)', text: AD });
    expect(c.verdict).toBe('anzeige');
    expect(c.signals).toEqual(expect.arrayContaining(['aufgaben', 'profil', 'entgelt', 'bewerbung', 'gender', 'titel']));
  });

  it('sortiert Nachrichten, Rubriken und Formulare ohne jedes Merkmal aus', () => {
    expect(checkPosting({ url: 'https://uni.example/news/2026/neuer-rektor', title: 'Neuer Rektor gewählt', text: 'Der Senat hat gewählt.' }).verdict).toBe('keine');
    expect(checkPosting({ url: 'https://firma.example/karriere', title: 'Karriere', text: 'Arbeiten in einem tollen Umfeld.' }).noise).toMatch(/Titel/);
    expect(checkPosting({ url: 'https://x.umantis.com/Vacancies/12/Application/New/1', title: 'Bewerbung', text: '' }).verdict).toBe('keine');
  });

  it('lässt eine Stelle im Nachrichtenordner gelten, wenn ihre Adresse nach Stelle aussieht', () => {
    const c = checkPosting({ url: 'https://portal.mytum.de/jobs/wissenschaftler/NewsArticle_20261020_082625', title: 'Research Associate', text: AD });
    expect(c.noise).toBeNull();
    expect(c.verdict).toBe('anzeige');
  });

  it('ist bei wenig Merkmalen unklar, statt etwas wegzuwerfen', () => {
    expect(checkPosting({ url: 'https://wzb.example/forschung/brueckenprofessur', title: 'Transatlantische Brückenprofessur', text: 'Die Professur verbindet zwei Standorte.' }).verdict).toBe('unklar');
    // Nachrichtenadresse, aber eine Anzeige mit Merkmalen: nie „keine“
    expect(checkPosting({ url: 'https://uni.example/aktuelles/2026/x', title: 'Doktorand*in gesucht', text: 'Wir bieten eine Promotionsstelle.' }).verdict).not.toBe('keine');
  });
});
