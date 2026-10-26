import { describe, expect, it } from 'vitest';
import {
  checkGate,
  classifyKind,
  compileTerm,
  dueReminders,
  heuristicSummary,
  importSteckbrief,
  normalizeText,
  scoreJob,
  searchTextOf,
  starterProfile,
  STECKBRIEF_EXAMPLE,
  canonicalUrl,
  fuzzyKey,
  textSimilarity,
  jobIdForUrl,
  type Suchprofil,
} from '../src';

describe('Textabgleich', () => {
  it('normalisiert Umlaute und Zeichen', () => {
    expect(normalizeText('Pädagogische Psychologie (m/w/d)')).toBe('paedagogische psychologie m w d');
  });
  it('Wortanfang vs. überall vs. exakt', () => {
    const text = normalizeText('Entwicklungspsychologie und kognitive Prozesse, Auswertung mit R und SPSS');
    expect(compileTerm('psycholog')!.re.test(text)).toBe(false);
    expect(compileTerm('*psycholog')!.re.test(text)).toBe(true);
    expect(compileTerm('kognitiv')!.re.test(text)).toBe(true);
    expect(compileTerm('"r"')!.re.test(text)).toBe(true);
    expect(compileTerm('"r"')!.re.test(normalizeText('Forschung'))).toBe(false);
  });
  it('Bindestrich-Wörter werden auch zusammengezogen gefunden', () => {
    const t = searchTextOf({ title: 'Lehr-Lern-Forschung', descriptionMd: '' });
    expect(compileTerm('*lehrlern')!.re.test(t)).toBe(true);
  });
});

describe('Grobfilter', () => {
  it('lässt Psychologie-Bezug durch', () => {
    const r = checkGate(normalizeText('Wissenschaftliche Mitarbeiterin am Institut für Psychologie'));
    expect(r.pass).toBe(true);
  });
  it('lässt "Die Universität sucht" nicht wegen "sucht" durch', () => {
    const r = checkGate(normalizeText('Die Universität sucht eine Elektrikerin für die Haustechnik.'));
    expect(r.pass).toBe(false);
  });
  it('findet Zusammensetzungen', () => {
    expect(checkGate(normalizeText('Professur für Neuropsychologie')).pass).toBe(true);
    expect(checkGate(normalizeText('Studie zur Emotionsregulation mit EEG')).pass).toBe(true);
  });
});

describe('Stellenart', () => {
  it.each([
    ['Doktorand*in (m/w/d) Kognitive Psychologie', '', 'promotion'],
    ['Wissenschaftliche Mitarbeiterin (E 13, 65 %)', 'Die Möglichkeit zur Promotion ist gegeben.', 'promotion'],
    ['Wissenschaftlicher Mitarbeiter (m/w/d)', 'Voraussetzung ist eine abgeschlossene Promotion in Psychologie.', 'postdoc'],
    ['Postdoc in Developmental Psychology', '', 'postdoc'],
    ['W2-Professur für Sozialpsychologie', '', 'professur'],
    ['Studentische Hilfskraft (SHK) im Projekt XY', '', 'shk'],
    ['Psychologischer Psychotherapeut (m/w/d) für die Ambulanz', '', 'klinik'],
    ['Sachbearbeitung Drittmittel (m/w/d)', '', 'verwaltung'],
  ])('%s', (title, text, kind) => {
    expect(classifyKind(title, text)).toBe(kind);
  });
});

describe('Score', () => {
  const profile: Suchprofil = starterProfile('2026-10-10T00:00:00Z');
  const job = {
    kind: 'promotion' as const,
    payLevel: 13,
    workloadPct: 65,
    isPermanent: false,
    language: 'de' as const,
  };
  it('volle Kategorie bei 3 Herzchen', () => {
    const text = searchTextOf({ title: 'Doktorand*in Psychologie', descriptionMd: 'Experimente zur Wahrnehmung, Auswertung mit Statistik.' });
    const r = scoreJob(job, text, profile);
    const stelle = r.categories.find((c) => c.id === 'stelle')!;
    expect(stelle.hearts).toBe(3);
    expect(stelle.points).toBeCloseTo(stelle.max);
    expect(r.score).toBeGreaterThan(70);
  });
  it('unbekannte Angaben zählen halb', () => {
    const text = searchTextOf({ title: 'Stelle', descriptionMd: 'Psychologie' });
    const r = scoreJob({ ...job, payLevel: null, workloadPct: null }, text, profile);
    const rahmen = r.categories.find((c) => c.id === 'rahmen')!;
    expect(rahmen.hearts).toBe(1.5);
  });
  it('Abzug für "Lieber nicht"', () => {
    const text = searchTextOf({ title: 'Studentische Hilfskraft Psychologie', descriptionMd: '' });
    const r = scoreJob({ ...job, kind: 'shk' }, text, profile);
    expect(r.penalty).toBe(10);
  });
  it('leere Kategorien zählen nicht', () => {
    const p: Suchprofil = { ...profile, categories: profile.categories.map((c) => (c.id === 'thema' ? c : { ...c, items: [] })), avoid: [] };
    const r = scoreJob(job, searchTextOf({ title: 'Psychologie', descriptionMd: 'klinische Psychologie, kognitive Prozesse' }), p);
    expect(r.score).toBe(100);
  });
});

describe('Steckbrief-Import (Entwurfsformat)', () => {
  it('baut ein Suchprofil und Ortsvorschläge', () => {
    const r = importSteckbrief(JSON.stringify(STECKBRIEF_EXAMPLE));
    if ('error' in r) throw new Error(r.error);
    expect(r.profile.origin).toBe('steckbrief');
    expect(r.profile.categories.find((c) => c.id === 'thema')!.items).toHaveLength(3);
    expect(r.favorites.states).toEqual(['SN', 'ST', 'TH']);
  });
  it('meldet Fehler verständlich', () => {
    const r = importSteckbrief('{"format":"falsch"}');
    expect('error' in r).toBe(true);
  });
});

describe('Dubletten', () => {
  it('vereinheitlicht URLs', () => {
    expect(canonicalUrl('http://Example.org/job/1/?utm_source=x&b=2&a=1#top')).toBe('https://example.org/job/1?a=1&b=2');
    expect(jobIdForUrl('https://a.de/x?utm_medium=y')).toBe(jobIdForUrl('https://a.de/x'));
  });
  it('fuzzyKey ignoriert Genderzusätze', () => {
    const a = fuzzyKey({ institutionId: 'uni', title: 'Wissenschaftliche Mitarbeiterin (m/w/d) Psychologie', deadline: '2026-11-15' });
    const b = fuzzyKey({ institutionId: 'uni', title: 'Wissenschaftliche Mitarbeiterin (w/m/d) – Psychologie', deadline: '2026-11-15' });
    expect(a).toBe(b);
  });
  it('Textähnlichkeit: dieselbe Anzeige mit anderem Datum nahe 1, anderes Projekt weit darunter', () => {
    const body = 'Im Projekt KIDS untersuchen wir die Sprachentwicklung von Kleinkindern. Ihre Aufgaben sind die Planung und Durchführung von Studien, die Auswertung mit R und die Mitarbeit in der Lehre. Wir bieten eine Stelle nach E 13 TV-L mit 65 Prozent.';
    const other = 'Im Projekt MOVE untersuchen wir Bewegung im Alter mit Sensoren. Ihre Aufgaben sind die Rekrutierung älterer Teilnehmender, die Datenerhebung im Feld und die Auswertung mit Python. Wir bieten eine Stelle nach E 13 TV-L mit 65 Prozent.';
    expect(textSimilarity(`Veröffentlicht am 15.10.2026. ${body}`, `Veröffentlicht am 16.10.2026. ${body}`)).toBeGreaterThan(0.85);
    expect(textSimilarity(body, other)).toBeLessThan(0.3);
  });
});

describe('Erinnerungen', () => {
  it('nur die engste Stufe, einmal', () => {
    const items = [{ jobId: 'a', deadline: '2026-10-15', star: true }];
    const due = dueReminders(items, [30, 7, 1], new Set(), '2026-10-10');
    expect(due).toEqual([{ jobId: 'a', days: 7, daysLeft: 5, covers: [30, 7] }]);
    expect(dueReminders(items, [30, 7, 1], new Set(['a:7']), '2026-10-10')).toEqual([]);
  });
  it('ignoriert Anzeigen ohne Stern', () => {
    expect(dueReminders([{ jobId: 'a', deadline: '2026-10-11', star: false }], [30, 7, 1], new Set(), '2026-10-10')).toEqual([]);
  });
});

describe('Kurzfassung', () => {
  it('nimmt den Aufgaben-Abschnitt', () => {
    const md = 'Die Universität ist eine der ältesten Hochschulen.\n\n## Ihre Aufgaben\n\n- Planung von EEG-Studien\n- Auswertung der Daten\n- Mitarbeit in der Lehre\n- Publikationen\n\n## Ihr Profil\n\n- Master';
    expect(heuristicSummary(md)).toBe('Planung von EEG-Studien; Auswertung der Daten; Mitarbeit in der Lehre');
  });
});
