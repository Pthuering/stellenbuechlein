import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTER, countActiveFilters, parseFilter, passesFilter, sameFilter, termOf, type GeoContext, type JobFilter, type JobPlace } from '../src/filters';
import { termOfText } from '../src/fields';
import { filterAlertMessages, parseSavedFilters } from '../src/savedFilters';
import type { City, Job } from '../src/types';

const TODAY = '2026-11-23';

describe('Vertragsdauer aus dem Text', () => {
  it('erkennt unbefristet, auch in Worten der KI', () => {
    expect(termOfText('unbefristet', TODAY)).toEqual({ permanent: true, months: null });
    expect(termOfText('Festanstellung', TODAY)).toEqual({ permanent: true, months: null });
    expect(termOfText('auf Lebenszeit (Beamtenverhältnis)', TODAY)).toEqual({ permanent: true, months: null });
    expect(termOfText('permanent position', TODAY)).toEqual({ permanent: true, months: null });
  });

  it('befristet mit Option auf unbefristet bleibt befristet', () => {
    expect(termOfText('befristet, Übernahme in ein unbefristetes Verhältnis möglich', TODAY)?.permanent).toBe(false);
  });

  it('liest Jahre und Monate, auch als Wort und bei Spannen die untere Grenze', () => {
    expect(termOfText('befristet, 3 Jahre', TODAY)).toEqual({ permanent: false, months: 36 });
    expect(termOfText('befristet, 1,5 Jahre', TODAY)).toEqual({ permanent: false, months: 18 });
    expect(termOfText('befristet, 18 Monate', TODAY)).toEqual({ permanent: false, months: 18 });
    expect(termOfText('in der Regel drei Jahre', TODAY)).toEqual({ permanent: false, months: 36 });
    expect(termOfText('für fünf Jahre', TODAY)).toEqual({ permanent: false, months: 60 });
    expect(termOfText('Praktikum, für mindestens drei bis sechs Monate', TODAY)).toEqual({ permanent: false, months: 3 });
    expect(termOfText('fixed-term for 2 years', TODAY)).toEqual({ permanent: false, months: 24 });
  });

  it('„bis <Datum>“ zählt ab heute', () => {
    expect(termOfText('befristet bis 31.12.2031', TODAY)).toEqual({ permanent: false, months: 61 });
    expect(termOfText('befristet bis 30.06.2027', TODAY)).toEqual({ permanent: false, months: 7 });
  });

  it('befristet ohne Dauer und ohne Text', () => {
    expect(termOfText('befristet', TODAY)).toEqual({ permanent: false, months: null });
    expect(termOfText('', TODAY)).toBeNull();
    expect(termOfText(null, TODAY)).toBeNull();
  });

  it('isPermanent der Regeln geht vor, fehlt beides, gibt es keine Angabe', () => {
    expect(termOf({ isPermanent: true, fixedTerm: null }, TODAY)).toEqual({ permanent: true, months: null });
    expect(termOf({ isPermanent: null, fixedTerm: 'unbefristet' }, TODAY)).toEqual({ permanent: true, months: null });
    expect(termOf({ isPermanent: false, fixedTerm: null }, TODAY)).toEqual({ permanent: false, months: null });
    expect(termOf({ isPermanent: null, fixedTerm: null }, TODAY)).toBeNull();
  });
});

const cities = new Map<string, City>([
  ['leipzig', { id: 'leipzig', name: 'Leipzig', state: 'SN', lat: 51.34, lon: 12.37 } as City],
  ['frankfurt-main', { id: 'frankfurt-main', name: 'Frankfurt am Main', state: 'HE', lat: 50.11, lon: 8.68 } as City],
]);
const ctx: GeoContext = { home: { label: 'Leipzig', lat: 51.34, lon: 12.37 } as GeoContext['home'], institutions: new Map(), cities };

function job(over: Partial<Job> = {}): Job {
  return { id: 'j', title: 'Wiss. Mitarbeiter:in', descriptionMd: '', status: 'aktiv', lane: 'kern', ...over } as Job;
}
function place(over: Partial<JobPlace> = {}): JobPlace {
  return { lat: null, lon: null, cityId: null, state: null, distanceKm: null, ...over };
}
const pass = (j: Job, f: Partial<JobFilter>, p: JobPlace = place(), score?: number) => passesFilter(j, { ...DEFAULT_FILTER, ...f }, p, ctx, '', TODAY, undefined, score);

describe('Filter: neue Kriterien', () => {
  it('Städte über die zugeordnete Stadt, sonst über den Ortstext als ganzes Wort', () => {
    expect(pass(job(), { cities: ['leipzig'] }, place({ cityId: 'leipzig' }))).toBe(true);
    expect(pass(job({ locationText: 'Leipzig' }), { cities: ['leipzig'] }, place({ cityId: 'dresden' }))).toBe(false);
    expect(pass(job({ locationText: '04109 Leipzig, Sachsen' }), { cities: ['leipzig'] })).toBe(true);
    expect(pass(job({ locationText: 'Frankfurt am Main' }), { cities: ['frankfurt-main'] })).toBe(true);
    expect(pass(job({ locationText: 'Frankfurt (Oder)' }), { cities: ['frankfurt-main'] })).toBe(false);
    expect(pass(job({ locationText: 'Leipziger Land' }), { cities: ['leipzig'] })).toBe(false);
  });

  it('Passung mindestens greift nur mit Score', () => {
    expect(pass(job(), { minScore: 70 }, place(), 70)).toBe(true);
    expect(pass(job(), { minScore: 70 }, place(), 69)).toBe(false);
    expect(pass(job(), { minScore: 70 })).toBe(true);
  });

  it('Mindestdauer: unbefristet zählt mit, unbekannte Dauer nur auf Wunsch', () => {
    const five = { minTermYears: 5 };
    expect(pass(job({ isPermanent: true }), five)).toBe(true);
    expect(pass(job({ fixedTerm: 'unbefristet' }), five)).toBe(true);
    expect(pass(job({ fixedTerm: 'befristet, 5 Jahre' }), five)).toBe(true);
    expect(pass(job({ fixedTerm: 'befristet, 3 Jahre' }), five)).toBe(false);
    expect(pass(job({ fixedTerm: 'befristet bis 31.12.2031' }), five)).toBe(true);
    expect(pass(job({ fixedTerm: 'befristet' }), five)).toBe(false);
    expect(pass(job({ fixedTerm: 'befristet' }), { ...five, termUnknown: true })).toBe(true);
    expect(pass(job(), five)).toBe(false);
    expect(pass(job(), { ...five, termUnknown: true })).toBe(true);
  });

  it('nur unbefristet: bekannte Befristung fliegt immer raus, fehlende Angabe nur auf Wunsch drin', () => {
    expect(pass(job({ isPermanent: true }), { permanentOnly: true })).toBe(true);
    expect(pass(job({ fixedTerm: 'Festanstellung' }), { permanentOnly: true })).toBe(true);
    expect(pass(job({ fixedTerm: 'befristet' }), { permanentOnly: true, termUnknown: true })).toBe(false);
    expect(pass(job(), { permanentOnly: true })).toBe(false);
    expect(pass(job(), { permanentOnly: true, termUnknown: true })).toBe(true);
  });

  it('Kriterien lassen sich kombinieren', () => {
    const f = { cities: ['leipzig'], minTermYears: 5, minScore: 60 };
    expect(pass(job({ isPermanent: true }), f, place({ cityId: 'leipzig' }), 75)).toBe(true);
    expect(pass(job({ isPermanent: true }), f, place({ cityId: 'leipzig' }), 55)).toBe(false);
    expect(pass(job({ fixedTerm: 'befristet, 2 Jahre' }), f, place({ cityId: 'leipzig' }), 75)).toBe(false);
    expect(pass(job({ isPermanent: true }), f, place({ cityId: 'frankfurt-main' }), 75)).toBe(false);
  });

  it('zählt die neuen Kriterien als aktive Filter', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTER, cities: ['leipzig'], minScore: 70, minTermYears: 5, termUnknown: true })).toBe(3);
  });
});

describe('Filter einlesen und vergleichen', () => {
  it('ergänzt fehlende Felder und verwirft kaputte Werte', () => {
    expect(parseFilter(null)).toEqual(DEFAULT_FILTER);
    const f = parseFilter({ radiusKm: 50, states: ['SN', 'SN', 3], minScore: 140, minTermYears: 5, cities: ['leipzig'], text: 7 });
    expect(f).toEqual({ ...DEFAULT_FILTER, radiusKm: 50, states: ['SN'], minTermYears: 5, cities: ['leipzig'] });
  });

  it('gleich trotz anderer Reihenfolge; „auch ohne Angabe“ zählt nur mit Dauer-Filter', () => {
    expect(sameFilter({ ...DEFAULT_FILTER, cities: ['a', 'b'] }, { ...DEFAULT_FILTER, cities: ['b', 'a'] })).toBe(true);
    expect(sameFilter({ ...DEFAULT_FILTER, termUnknown: true }, DEFAULT_FILTER)).toBe(true);
    expect(sameFilter({ ...DEFAULT_FILTER, minTermYears: 5, termUnknown: true }, { ...DEFAULT_FILTER, minTermYears: 5 })).toBe(false);
    expect(sameFilter({ ...DEFAULT_FILTER, minScore: 70 }, DEFAULT_FILTER)).toBe(false);
    expect(sameFilter({ ...DEFAULT_FILTER, text: ' klinik ' }, { ...DEFAULT_FILTER, text: 'klinik' })).toBe(true);
  });
});

describe('Gespeicherte Filter', () => {
  it('liest gespeicherte Filter und lässt Unbrauchbares weg', () => {
    const list = parseSavedFilters([
      { id: 'a', name: ' Leipzig unbefristet ', filter: { cities: ['leipzig'], permanentOnly: true }, push: true, pushSince: '2026-11-23T10:00:00Z' },
      { id: 'a', name: 'doppelt', filter: {} },
      { id: 'b', name: '', filter: {} },
      { name: 'ohne id', filter: {} },
      'kaputt',
    ]);
    expect(list).toEqual([
      { id: 'a', name: 'Leipzig unbefristet', filter: { ...DEFAULT_FILTER, cities: ['leipzig'], permanentOnly: true }, push: true, pushSince: '2026-11-23T10:00:00Z' },
    ]);
  });

  it('übernimmt Wunschstädte aus der alten Einstellung, solange es keine gespeicherten Filter gibt', () => {
    const [w] = parseSavedFilters(undefined, { cities: ['leipzig', 'leipzig'], min: 80, push: true });
    expect(w).toEqual({ id: 'wunschstaedte', name: 'Wunschstädte', filter: { ...DEFAULT_FILTER, cities: ['leipzig'], minScore: 80 }, push: true, pushSince: null });
    expect(parseSavedFilters(undefined, { cities: [], min: 80 })).toEqual([]);
    expect(parseSavedFilters([], { cities: ['leipzig'] })).toEqual([]);
  });

  it('meldet bis zu drei Treffer einzeln, mehr gebündelt, in allen drei Sprachen', () => {
    const f = { id: 'f1', name: 'Leipzig' };
    const hits = [
      { id: 'a', title: 'Wiss. Mitarbeiter:in', score: 72 },
      { id: 'b', title: 'Doktorand:in', score: 91 },
    ];
    const two = filterAlertMessages(f, hits);
    expect(two).toHaveLength(2);
    expect(two[0]).toEqual({ title: '🔔 Leipzig: neue Anzeige, passt zu 91 %', body: 'Doktorand:in', url: '/#/stelle/b', tag: 'filter-f1-b' });
    expect(filterAlertMessages(f, hits, 'en')[1].title).toBe('🔔 Leipzig: new posting, 72% match');
    expect(filterAlertMessages(f, hits, 'sr')[1].title).toBe('🔔 Leipzig: novi oglas, poklapanje 72%');

    const five = [...hits, ...['c', 'd', 'e'].map((id, i) => ({ id, title: `Stelle ${id}`, score: 80 + i }))];
    const bundle = filterAlertMessages(f, five);
    expect(bundle).toHaveLength(1);
    expect(bundle[0].title).toBe('🔔 Leipzig: 5 neue Anzeigen');
    expect(bundle[0].url).toBe('/#/filter/f1');
    expect(bundle[0].body.split('\n')[0]).toBe('91 % · Doktorand:in');
    expect(bundle[0].body).toMatch(/und 2 weitere$/);
    expect(filterAlertMessages(f, five, 'sr')[0].title).toBe('🔔 Leipzig: 5 novih oglasa');
    expect(filterAlertMessages(f, [])).toEqual([]);
  });
});
