import { describe, expect, it } from 'vitest';
import { quellenGrund, quellenSchwelle } from '@stellen/core';
import { queryLanguage, sucheOf, sucheUrl, wochenplan, type Suchziel } from '../src/explore';
import { jsonListeOf, parseJsonDetail, parseJsonListe } from '../src/ats';
import { parseFeed } from '../src/feeds';
import { extractLinks, load } from '../src/html';

const DE = ['Human Factors Psychologie', 'Alternsforschung Psychologie', 'wissenschaftliche Mitarbeiterin Kognitionspsychologie', 'Mensch-KI-Interaktion Forschung', 'Bildungsforschung Psychologie'];
const EN = ['postdoc cognitive psychology', 'Human-AI Interaction psychology', 'Research Associate Psychology', 'user research psychologist'];
const ALLE = [...DE, ...EN];

/** Alle Tage einer Woche ab einem Montag. */
const woche = (start = '2026-11-23') => Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${start}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

describe('Suchmuster: Sprache und Such-Adressen', () => {
  it('erkennt deutsche und englische Wortgruppen', () => {
    for (const q of DE) expect(queryLanguage(q)).toBe('de');
    for (const q of EN) expect(queryLanguage(q)).toBe('en');
  });

  it('baut Such-Adressen mit {q} und {slug}', () => {
    expect(sucheUrl('https://www.stepstone.de/jobs/{slug}', 'Ingenieurpsychologie Human Factors')).toBe('https://www.stepstone.de/jobs/ingenieurpsychologie-human-factors');
    expect(sucheUrl('https://www.stepstone.de/jobs/{slug}', 'Gesundheitsförderung Psychologe')).toBe('https://www.stepstone.de/jobs/gesundheitsfoerderung-psychologe');
    expect(sucheUrl('https://www.academictransfer.com/en/jobs/?q={q}', 'postdoc cognitive psychology')).toBe('https://www.academictransfer.com/en/jobs/?q=postdoc%20cognitive%20psychology');
    expect(sucheOf({ suche: { adresse: 'https://x.de/?q={q}' } })).not.toBeNull();
    expect(sucheOf({ queries: ['a'] })).toBeNull();
  });
});

describe('Wochenplan', () => {
  const ziele: Suchziel[] = [
    { id: 'web', sprache: 'alle', brave: true },
    { id: 'ba', sprache: 'alle', brave: false },
    { id: 'linkedin', sprache: 'de', brave: false },
    { id: 'academictransfer', sprache: 'en', brave: false },
    { id: 'aarhus', sprache: 'en', brave: true },
  ];

  it('fragt in einer Woche jede passende Wortgruppe bei jedem Ziel genau einmal ab, jeden Tag in anderer Mischung', () => {
    const gesehen = new Map<string, number>();
    const tage: string[] = [];
    for (const tag of woche()) {
      const plan = wochenplan(ziele, ALLE, tag, 100);
      tage.push(JSON.stringify([...plan.heute.entries()]));
      for (const [ziel, qs] of plan.heute) for (const q of qs) gesehen.set(`${ziel}|${q}`, (gesehen.get(`${ziel}|${q}`) ?? 0) + 1);
    }
    const erwartet = ziele.flatMap((z) => ALLE.filter((q) => z.sprache === 'alle' || queryLanguage(q) === z.sprache).map((q) => `${z.id}|${q}`));
    expect([...gesehen.keys()].sort()).toEqual(erwartet.sort());
    expect([...gesehen.values()].every((n) => n === 1)).toBe(true);
    expect(new Set(tage).size).toBe(7);
    // Sprachen passen: LinkedIn (de) bekommt keine englische, AcademicTransfer keine deutsche Wortgruppe
    for (const k of gesehen.keys()) {
      const [ziel, q] = k.split('|');
      if (ziel === 'linkedin') expect(queryLanguage(q)).toBe('de');
      if (ziel === 'academictransfer') expect(queryLanguage(q)).toBe('en');
    }
  });

  it('hält das Brave-Budget pro Tag ein und verlängert den Durchgang, wenn es nicht für eine Woche reicht', () => {
    const budget = 2;
    const gesehen = new Set<string>();
    const plan0 = wochenplan(ziele, ALLE, '2026-11-23', budget);
    expect(plan0.braveGesamt).toBe(ALLE.length + EN.length);
    expect(plan0.braveZyklus).toBe(Math.ceil((ALLE.length + EN.length) / budget));
    for (let i = 0; i < plan0.braveZyklus; i++) {
      const tag = new Date(Date.parse('2026-11-23T12:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
      const plan = wochenplan(ziele, ALLE, tag, budget);
      expect(plan.braveHeute).toBeLessThanOrEqual(budget);
      for (const z of ['web', 'aarhus']) for (const q of plan.heute.get(z) ?? []) gesehen.add(`${z}|${q}`);
    }
    // Über den verlängerten Durchgang kommt jede Brave-Suche einmal dran
    expect(gesehen.size).toBe(ALLE.length + EN.length);
  });
});

describe('JSON-Liste (versteckte Schnittstelle, Beispiel Göttingen)', () => {
  const jl = jsonListeOf({
    jsonListe: {
      api: 'https://uni.example/api/v1/get/vacancies?lang=de',
      zeilen: 'rows',
      id: 'id',
      titel: 'titel',
      seite: 'https://uni.example/de/644546.html?details={id}',
      detail: 'https://uni.example/api/v1/get/vacancies/{id}',
    },
  })!;

  it('macht aus Kennungen Anzeigen-Adressen und merkt sich die Text-Schnittstelle', () => {
    const body = JSON.stringify({ total: 2, rows: [{ id: '76785', titel: '<a>Wissenschaftliche*r Mitarbeiter*in – Mensch-KI Kollaborationen (w/m/d)<a>' }, { id: '1', titel: '' }] });
    const list = parseJsonListe(body, jl);
    expect(list).toHaveLength(1);
    expect(list[0].url).toBe('https://uni.example/de/644546.html?details=76785');
    expect(list[0].title).toBe('Wissenschaftliche*r Mitarbeiter*in – Mensch-KI Kollaborationen (w/m/d)');
    expect(list[0].hints?.detailApi).toBe('https://uni.example/api/v1/get/vacancies/76785');
  });

  it('liest Text, Frist und Abteilung aus der Detail-Antwort', () => {
    const body = JSON.stringify({
      ID: '76785',
      Title: 'Wissenschaftliche*r Mitarbeiter*in – Mensch-KI Kollaborationen(w/m/d)',
      Description: `<p>Ihre Aufgaben: Studien zur Zusammenarbeit von Mensch und KI planen. </p><p>Ihr Profil: Psychologie. Wir bieten: Teilzeit 75 %. ${'Bewerbung bitte online. '.repeat(20)}</p>`,
      ApplicationDeadline: '11.12.2026',
      Grade: 'Entgeltgruppe 13 TV-L',
      Facilitie: { Designation: 'Department BWL - Professur für Smart Services', Loaction: 'Göttingen' },
    });
    const d = parseJsonDetail(body, 'https://uni.example/de/644546.html?details=76785', null)!;
    expect(d.title).toMatch(/Mensch-KI Kollaborationen/);
    expect(d.descriptionMd).toMatch(/Bewerbungsfrist: 11\.12\.2026/);
    expect(d.descriptionMd).toMatch(/Entgeltgruppe 13 TV-L/);
    expect(d.department).toBe('Department BWL - Professur für Smart Services');
    expect(d.locationText).toBe('Göttingen');
  });
});

describe('Lesen von Listen', () => {
  it('überspringt im Feed Einträge mit kaputtem Link, statt die ganze Quelle abzubrechen', () => {
    const rss = `<?xml version="1.0"?><rss><channel>
      <item><title>Kaputt</title><link>http://[kaputt</link></item>
      <item><title>Postdoc in Cognitive Science</title><link>https://employment.example/all-vacancies/?show=171702</link></item>
    </channel></rss>`;
    const list = parseFeed(rss, 'https://employment.example/all-vacancies/');
    expect(list.map((c) => c.url)).toEqual(['https://employment.example/all-vacancies/?show=171702']);
  });

  it('löst Links gegen <base href> auf und entfernt die Sitzungskennung aus dem Pfad', () => {
    const html = `<html><head><base href="https://www.bund.example/"></head><body><main>
      <a href="IMPORTE/Stellenangebote/interamt/2026/11/1515283.html;jsessionid=ABC123.internet611?nn=1">Wissenschaftliche/r Mitarbeiter/in (w/m/d)</a>
    </main></body></html>`;
    const links = extractLinks(load(html), 'https://www.bund.example/Content/DE/Stellen/Suche/Formular.html');
    expect(links[0].url).toBe('https://www.bund.example/IMPORTE/Stellenangebote/interamt/2026/11/1515283.html?nn=1');
  });
});

describe('Auffällige Quellen', () => {
  it('erkennt Fehler, Leere und Universitäten mit nur einem Eintrag', () => {
    expect(quellenGrund({ status: 'fehler', lastCount: 0 }, 'universitaet')).toBe('fehler');
    expect(quellenGrund({ status: 'leer', lastCount: 0 }, 'mpg')).toBe('leer');
    expect(quellenGrund({ status: 'ok', lastCount: 1 }, 'universitaet')).toBe('mager');
    expect(quellenGrund({ status: 'ok', lastCount: 1 }, 'unternehmen')).toBeNull();
    expect(quellenGrund({ status: 'ok', lastCount: 25 }, 'universitaet')).toBeNull();
  });

  it('markiert große Einrichtungen schneller als kleine Institute', () => {
    expect(quellenSchwelle('leer', 'universitaet')).toBeLessThan(quellenSchwelle('leer', 'mpg'));
    expect(quellenSchwelle('warnung', 'mpg')).toBe(1);
    expect(quellenSchwelle('mager', 'universitaet')).toBe(3);
  });
});
