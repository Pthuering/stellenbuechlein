import { describe, expect, it } from 'vitest';
import { ABROAD_GAPS, countryCode, countryOf, interleaveGaps, isAbroad, isEurope, parseAusland } from '../src';

describe('Land einer Stelle', () => {
  it('liest die Länderangabe eines Portals', () => {
    expect(countryCode('CH')).toBe('CH');
    expect(countryCode('che')).toBe('CH');
    expect(countryCode('Switzerland')).toBe('CH');
    expect(countryCode('Österreich')).toBe('AT');
    expect(countryCode('UK')).toBe('GB');
    expect(countryCode('Deutschland')).toBe('DE');
    expect(countryCode('irgendwo')).toBeNull();
  });

  it('erkennt das Land aus Ortsangabe und Titel', () => {
    expect(countryOf({ locationText: 'Zürich' })).toBe('CH');
    expect(countryOf({ locationText: 'Leiden, Netherlands' })).toBe('NL');
    expect(countryOf({ title: 'Eid. anerkannte:r Psychotherapeut:in (a) - Hybrid / Region Zürich / Uster (40-100%)' })).toBe('CH');
    expect(countryOf({ title: 'Fullstack developer (Lisboa, PT, 1200-246)' })).toBe('PT');
    expect(countryOf({ title: 'Frontend / UX Engineer - Robotics Data Operations, Kitchener, ON' })).toBe('CA');
    expect(countryOf({ title: 'Robotics Pod Lead', locationText: 'Peking - Beijing Shi - China' })).toBe('CN');
  });

  it('liest ein ausdrückliches Feld „Country“ im Anzeigentext', () => {
    const table = ['Application Deadline', '', '20 Dec 2026', '', 'Country', '', 'Sweden', '', 'Type of Contract', '', 'Temporary'].join('\n');
    expect(countryOf({ title: 'PhD position in Experimental Pragmatics', text: table })).toBe('SE');
    expect(countryOf({ title: 'Postdoc', text: ['Organisation: Uni', 'Country: Netherlands', 'City: Leiden'].join('\n') })).toBe('NL');
    // ein Bundesland ist kein Land, und Fließtext zählt nicht
    expect(countryOf({ title: 'Referent:in', text: ['Land', '', 'Niedersachsen', '', 'Ort', '', 'Hannover'].join('\n') })).toBeNull();
    expect(countryOf({ title: 'Postdoc', text: 'We welcome applicants from every country, including Sweden.' })).toBeNull();
  });

  it('im Zweifel unbekannt statt Ausland', () => {
    expect(countryOf({ title: 'Wissenschaftliche Mitarbeiterin (m/w/d) Psychologie', locationText: 'Halle (Saale)', germanCity: true })).toBe('DE');
    // Städtenamen mitten im Titel sind keine Ortsangabe
    expect(countryOf({ title: 'Referent:in für die Wiener Schule der Psychologie' })).toBeNull();
    expect(countryOf({ title: 'Postdoc im Projekt London Calling der Universität Leipzig' })).toBeNull();
    expect(countryOf({ title: 'Technische Assistenz CD-ROM-Archiv' })).toBeNull();
    // die Angabe des Portals geht vor
    expect(countryOf({ country: 'DE', title: 'Koordination (Standort Wien)' })).toBe('DE');
  });

  it('Europa und Ausland', () => {
    expect(isEurope('RS')).toBe(true);
    expect(isEurope('US')).toBe(false);
    expect(isAbroad({ country: 'CH' })).toBe(true);
    expect(isAbroad({ country: null })).toBe(false);
    expect(isAbroad({ country: 'DE' })).toBe(false);
  });
});

describe('Einstellung „ausland“', () => {
  it('ohne Einstellung gilt die Antwort aus der Umfrage, Zahlen bleiben in Grenzen', () => {
    expect(parseAusland(null).an).toBe(false);
    expect(parseAusland(null, true)).toMatchObject({ an: true, proLauf: 40, weltweitProLauf: 10, minPassung: 65 });
    expect(parseAusland({ an: true, proLauf: 5, weltweitProLauf: -3, minPassung: 250 })).toEqual({ an: true, proLauf: 5, weltweitProLauf: 10, minPassung: 65 });
  });
});

describe('Auslandskarten im Stapel', () => {
  it('höchstens jede dritte Karte kommt aus dem Ausland', () => {
    const inland = Array.from({ length: 300 }, (_, i) => `d${i}`);
    const ausland = Array.from({ length: 80 }, (_, i) => `a${i}`);
    const deck = interleaveGaps(inland, ausland, 'ausland:2026-11-23', ABROAD_GAPS);
    expect(deck).toHaveLength(380);
    // in jedem Fenster von drei Karten höchstens eine Auslandskarte, solange es deutsche Karten gibt
    const lastInland = deck.lastIndexOf('d299');
    for (let i = 0; i + 3 <= lastInland; i++) expect(deck.slice(i, i + 3).filter((x) => x.startsWith('a')).length).toBeLessThanOrEqual(1);
    const shown = deck.slice(0, 120);
    expect(shown.filter((x) => x.startsWith('a')).length / shown.length).toBeLessThanOrEqual(1 / 3);
    // Reihenfolge innerhalb beider Sorten bleibt erhalten
    expect(deck.filter((x) => x.startsWith('a'))).toEqual(ausland);
    expect(deck.filter((x) => x.startsWith('d'))).toEqual(inland);
  });
});
