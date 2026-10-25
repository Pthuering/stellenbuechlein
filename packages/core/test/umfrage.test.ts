import { describe, expect, it } from 'vitest';
import {
  compileTerm,
  compileTerms,
  eigeneAuswahl,
  FACHGEBIETE,
  gewichteAusHerzen,
  importSteckbrief,
  LIEBER_NICHT,
  METHODEN,
  neueUmfrage,
  parseProfile,
  parseUmfrage,
  searchTextOf,
  starterHorizont,
  THEMEN,
  umfrageAlsText,
  umfrageZuSteckbrief,
  firstMatch,
  type UmfrageAntworten,
} from '../src';

const KATALOG = [...FACHGEBIETE, ...THEMEN, ...METHODEN, ...LIEBER_NICHT];

describe('Umfrage: Kataloge', () => {
  it('ids sind eindeutig und alle Begriffe gültig', () => {
    const ids = KATALOG.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of KATALOG) {
      expect(v.label.length).toBeLessThanOrEqual(120);
      expect(v.begriffe.length).toBeLessThanOrEqual(40);
      if (!v.art) expect(v.begriffe.length, v.id).toBeGreaterThan(0);
      for (const t of v.begriffe) expect(compileTerm(t), `${v.id}: ${t}`).not.toBeNull();
    }
  });

  it('Floskeln aus Anzeigen treffen keine Themen', () => {
    const text = searchTextOf({
      title: 'Sachbearbeitung (m/w/d)',
      descriptionMd:
        'Wir suchen eine engagierte Persönlichkeit mit hoher Motivation und Stressresistenz. Zur Wahrnehmung der Aufgaben bzw. beziehungsweise ' +
        'der Durchführung von Projekten. Die Vergütung erfolgt in Abhängigkeit von der Qualifikation. Wir bieten Vereinbarkeit von Familie und Beruf, ' +
        'Kinderbetreuung, Berücksichtigung von Erziehungszeiten, Weiterbildung, betriebliches Gesundheitsmanagement und nachhaltig gute Arbeitsbedingungen. ' +
        'Alternativ ist auch Teilzeit möglich. Wir lehnen jede Form von Diskriminierung ab. Ein erweitertes Führungszeugnis wird benötigt. Gesucht wird zum 1. Januar.',
    });
    for (const v of [...FACHGEBIETE, ...THEMEN]) {
      expect(firstMatch(text, compileTerms(v.begriffe))?.raw ?? null, v.id).toBeNull();
    }
  });
});

function antworten(): UmfrageAntworten {
  const a = neueUmfrage('2026-10-25T20:00:00.000Z').antworten;
  return {
    ...a,
    name: 'Anna',
    stand: 'master',
    fachgebiete: [
      { id: 'f-klin', label: 'Klinische Psychologie & Psychotherapie', herzen: 3 },
      { id: 'f-neuro', label: 'Neuropsychologie & Neurowissenschaft', herzen: 2 },
    ],
    themen: [{ id: 't-emo', label: 'Emotionen & Emotionsregulation', herzen: 3 }, eigeneAuswahl('Interozeption / interoception', 1)!],
    stellenarten: [
      { art: 'promotion', herzen: 3 },
      { art: 'wiss_ma', herzen: 2 },
    ],
    lieberNicht: [
      { id: 'n-shk', label: 'Hilfskraft-Stellen', herzen: 2 },
      { id: 'n-tier', label: 'Tierversuche', herzen: 3 },
    ],
    entgelt: { min: 13, herzen: 2 },
    umfang: { min: 65, herzen: 1 },
    unbefristet: 0,
    sprache: 'egal',
    methoden: [{ id: 'm-eeg', label: 'EEG', herzen: 2 }],
    bundeslaender: ['SN', 'ST'],
    orte: [{ kind: 'city', ref: 'leipzig', label: 'Leipzig' }],
    bruecken: ['h-ki', 'h-ux'],
    interessen: ['Künstliche Intelligenz'],
    dosis: 'selten',
    gewichte: { thema: 3, stelle: 2, methoden: 1, rahmen: 2 },
  };
}

describe('Umfrage: Umwandeln', () => {
  it('Gewichte: zwei Herzen überall = Standard, Summe immer 100', () => {
    expect(gewichteAusHerzen({ thema: 2, stelle: 2, methoden: 2, rahmen: 2 })).toEqual({ thema: 45, stelle: 30, methoden: 10, rahmen: 15 });
    const w = gewichteAusHerzen({ thema: 3, stelle: 1, methoden: 1, rahmen: 3 });
    expect(w.thema + w.stelle + w.methoden + w.rahmen).toBe(100);
    expect(w.thema).toBeGreaterThan(45);
  });

  it('eigene Einträge: Schrägstrich trennt Schreibweisen', () => {
    const e = eigeneAuswahl('Emotionsregulation / emotion regulation')!;
    expect(e.label).toBe('Emotionsregulation');
    expect(e.begriffe).toEqual(['emotionsregulation', 'emotion regulation']);
    expect(eigeneAuswahl('  ')).toBeNull();
  });

  it('wird zu einem gültigen Suchprofil mit Horizont', () => {
    const r = importSteckbrief(umfrageZuSteckbrief(antworten()));
    if ('error' in r) throw new Error(r.error);
    const p = r.profile;
    expect(parseProfile(p)).not.toBeNull();
    const cat = (id: string) => p.categories.find((c) => c.id === id)!;
    expect(cat('thema').items.map((i) => i.label)).toEqual(['Klinische Psychologie & Psychotherapie', 'Neuropsychologie & Neurowissenschaft', 'Emotionen & Emotionsregulation', 'Interozeption']);
    // Katalog-Einträge bekommen die Begriffe aus dem Katalog, eigene ihre eigenen
    expect(cat('thema').items[0].terms).toContain('*psychotherap');
    expect(cat('thema').items[3].terms).toEqual(['interozeption', 'interoception']);
    expect(cat('stelle').items.map((i) => i.hearts)).toEqual([3, 2]);
    expect(cat('rahmen').items.map((i) => i.label)).toEqual(['Ab E 13', 'Mindestens 65 %']);
    expect(cat('thema').weight).toBeGreaterThan(45);
    expect(p.avoid.find((x) => x.label === 'Hilfskraft-Stellen')?.condition).toEqual({ type: 'kind', kinds: ['shk'] });
    expect(p.avoid.find((x) => x.label === 'Tierversuche')?.terms).toContain('tierversuch');
    expect(p.horizont?.bruecken.map((b) => b.name)).toEqual(['Mensch & KI', 'Gestaltung & UX']);
    expect(p.horizont?.bruecken.every((b) => b.herkunft === 'steckbrief')).toBe(true);
    expect(p.horizont?.dosis).toBe('selten');
    expect(p.horizont?.interessen).toEqual(['Künstliche Intelligenz']);
    expect(p.horizont?.faehigkeiten).toEqual(starterHorizont().faehigkeiten);
    expect(r.favorites.states).toEqual(['SN', 'ST']);
    expect(r.warnings).toEqual([]);
  });

  it('leere Umfrage ergibt ein leeres Profil mit Hinweisen statt eines Fehlers', () => {
    const r = importSteckbrief(umfrageZuSteckbrief(neueUmfrage().antworten));
    if ('error' in r) throw new Error(r.error);
    expect(r.profile.categories.every((c) => c.items.length === 0)).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('Umfrage: Speichern', () => {
  it('liest gespeicherte Stände tolerant', () => {
    const s = neueUmfrage('2026-10-25T20:00:00.000Z');
    s.antworten = antworten();
    s.seite = 7;
    expect(parseUmfrage(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const kaputt = { ...s, antworten: { ...s.antworten, bundeslaender: ['SN', 'XX'], entgelt: 'viel', fachgebiete: [{ id: 'f-klin' }, s.antworten.fachgebiete[1]] } };
    const p = parseUmfrage(kaputt)!;
    expect(p.antworten.bundeslaender).toEqual(['SN']);
    expect(p.antworten.entgelt).toEqual({ min: null, herzen: 2 });
    expect(p.antworten.fachgebiete).toHaveLength(1);
    expect(parseUmfrage(null)).toBeNull();
  });

  it('als Text lesbar', () => {
    const s = neueUmfrage('2026-10-25T20:00:00.000Z');
    s.antworten = antworten();
    const t = umfrageAlsText(s);
    expect(t).toContain('Umfrage für das Suchprofil: Anna');
    expect(t).toContain('Klinische Psychologie & Psychotherapie ♥♥♥');
    expect(t).toContain('Interozeption ♥ (eigene: interozeption, interoception)');
    expect(t).toContain('Sachsen, Sachsen-Anhalt');
    expect(t).toContain('Mensch & KI, Gestaltung & UX');
  });
});
