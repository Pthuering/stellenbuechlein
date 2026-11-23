import { describe, expect, it } from 'vitest';
import {
  deckJitter,
  deckTier,
  parseDeckOrder,
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
  it('"R" passt nicht auf Genderendungen, „i. d. R.“ oder Kürzel', () => {
    const r = compileTerm('"r"')!.re;
    const noise = searchTextOf({
      title: 'Medizinische/r Technologin/-e (MT-R)',
      descriptionMd: 'Wissenschaftliche\\*r Mitarbeiter\\*in, Jede:r Bewerber(in), i. d. R. in Vollzeit. Fragen an r.mueller@uni.example oder [E-Mail](mailto:a@b.example?subject=R%C3%BCckfrage). R&D Team.',
    });
    expect(r.test(noise)).toBe(false);
    expect(compileTerm('mitarbeiter')!.re.test(noise)).toBe(true);
    expect(r.test(searchTextOf({ title: 'Stelle', descriptionMd: 'Kenntnisse in SPSS/R oder Python.' }))).toBe(true);
    expect(r.test(searchTextOf({ title: 'Stelle', descriptionMd: 'Auswertung mit Python, R und Mplus' }))).toBe(true);
  });
  it('Wortgruppen passen auch auf gebeugte Formen', () => {
    const t = normalizeText('Mitarbeit in der Kognitiven Psychologie: Untersuchung kognitiver Prozesse, Forschung zur visuellen Suche');
    expect(compileTerm('kognitive psych')!.re.test(t)).toBe(true);
    expect(compileTerm('kognitive prozess')!.re.test(t)).toBe(true);
    expect(compileTerm('visuelle suche')!.re.test(t)).toBe(true);
    // kurze Wörter müssen genau so dastehen, und die Reihenfolge zählt
    expect(compileTerm('e prime')!.re.test(normalizeText('entwickelte Primer für die PCR'))).toBe(false);
    expect(compileTerm('psychologie kognitive')!.re.test(t)).toBe(false);
    // „kognitive Verhaltenstherapie“ ist keine Kognitive Psychologie
    expect(compileTerm('kognitive psych')!.re.test(normalizeText('Ausbildung in kognitiver Verhaltenstherapie'))).toBe(false);
  });
  it('Adressen: Rechner und Pfad bleiben durchsuchbar, Anhängsel nicht', () => {
    const t = searchTextOf({ title: 'Stelle', descriptionMd: '[Institut](https://www.psychologie.uni.example/ae?ref=kognition) sekretariat@psychologie.uni.example' });
    expect(compileTerm('*psycholog')!.re.test(t)).toBe(true);
    expect(compileTerm('kognit')!.re.test(t)).toBe(false);
    expect(compileTerm('sekretariat')!.re.test(t)).toBe(false);
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
    ['Fullstack Developer (Lisboa, PT)', '', 'verwaltung'],
    ['SW Engineer - Onboard Software (m/f/d)', '', 'verwaltung'],
    ['Wissenschaftliche*r Mitarbeiter*in (m/w/d) Professur Allg. Psychologie', '', 'wiss_ma'],
    ['Wissenschaftlicher Mitarbeiter für Lehrstuhl für Pädagogische Psychologie', 'Die Möglichkeit zur Promotion ist gegeben.', 'promotion'],
    ['Sekretär/in am Lehrstuhl für Sozialpsychologie', 'Der Lehrstuhl gehört zur Universitätsprofessur für Sozialpsychologie.', 'verwaltung'],
    ['Visiting Assistant Professor', '', 'professur'],
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
  it('unbekannte Stellenart zählt einmal halb, nicht je Eintrag', () => {
    const text = searchTextOf({ title: 'Stelle', descriptionMd: 'Psychologie' });
    const r = scoreJob({ ...job, kind: 'sonstige' }, text, profile);
    const stelle = r.categories.find((c) => c.id === 'stelle')!;
    // Im Startprofil stehen vier Stellenarten (3, 2, 2, 1 Herzen): nur die wichtigste zählt halb.
    expect(stelle.hearts).toBe(1.5);
    expect(stelle.hits.filter((h) => h.state === 'unbekannt').map((h) => h.item.id)).toEqual(['s-prom']);
  });
  it('Stellenart-Begriffe zählen nur bei unbekannter Art und nur im Titel', () => {
    const prof = { id: 's-prof', label: 'Professur', hearts: 3 as const, condition: { type: 'kind' as const, kinds: ['professur' as const] }, terms: ['professur', 'professor'] };
    const p: Suchprofil = { ...profile, categories: profile.categories.map((c) => (c.id === 'stelle' ? { ...c, items: [prof] } : c)) };
    const stelle = (kind: 'klinik' | 'sonstige', title: string, descriptionMd: string) =>
      scoreJob({ ...job, kind, title }, searchTextOf({ title, descriptionMd }), p).categories.find((c) => c.id === 'stelle')!.hearts;
    expect(stelle('klinik', 'Ergotherapeut (m/w/d)', 'Vorstand: Herr Professor Dr. med. Muster')).toBe(0);
    expect(stelle('sonstige', 'Mitarbeit im Projekt', 'Leitung: Professor Dr. Muster')).toBe(1.5);
    expect(stelle('sonstige', 'Professorin für Psychologie (Vertretung)', '')).toBe(3);
  });
  it('Thema zählt höchstens halb ohne Psychologie-Bezug oder bei anderem Beruf im Titel', () => {
    const thema = (title: string, descriptionMd: string) => scoreJob({ ...job, title }, searchTextOf({ title, descriptionMd }), profile).categories.find((c) => c.id === 'thema')!;
    const robotik = thema('Wissenschaftliche Mitarbeiterin', 'Kognitive Robotik und Neurowissenschaft, kognitive Architekturen.');
    expect(robotik.limit).toBe('kein-fachbezug');
    expect(robotik.hearts).toBe(0.5);
    const ergo = thema('Ergotherapeut (m/w/d)', 'Kognitives Training, Klinische Psychologie und Psychotherapie, Team aus Psychologen, Neurowissenschaft.');
    expect(ergo.limit).toBe('anderer-beruf');
    expect(ergo.hearts).toBe(1.5);
    expect(thema('Frontend Developer', 'Studien zur kognitiven Psychologie').limit).toBe('anderer-beruf');
    expect(thema('Psychologe oder Sozialpädagoge (m/w/d)', 'Beratung').limit).toBeNull();
    expect(thema('Wissenschaftliche Mitarbeiterin', 'Kognitive Psychologie, Arbeitsgedächtnis').limit).toBeNull();
    // ohne Thema-Treffer gibt es nichts zu begrenzen
    expect(thema('Sachbearbeitung', 'Haushalt').limit).toBeNull();
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

describe('Leichtes Mischen im Stapel', () => {
  it('höchstens fünf Punkte auf oder ab, je Karte und Tag fest', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `j${i}`);
    const values = ids.map((id) => deckJitter(id, 'stapel:2026-11-23'));
    expect(Math.max(...values)).toBeLessThanOrEqual(5);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-5);
    expect(new Set(values.map((v) => Math.round(v))).size).toBeGreaterThan(6);
    expect(deckJitter('j1', 'stapel:2026-11-23')).toBe(deckJitter('j1', 'stapel:2026-11-23'));
    expect(deckJitter('j1', 'stapel:2026-11-24')).not.toBe(deckJitter('j1', 'stapel:2026-11-23'));
  });
});

describe('Reihenfolge im Stapel', () => {
  const today = '2026-10-26';
  const tier = (score: number, deadline: string | null, o: Parameters<typeof parseDeckOrder>[0]) => deckTier({ score, deadline }, parseDeckOrder(o), today);
  it('ohne Einstellung ist alles ein Teil', () => {
    expect(new Set([tier(90, '2026-11-01', null), tier(10, null, null)]).size).toBe(1);
  });
  it('erst ab der Schwelle, dann der Rest', () => {
    expect(tier(75, null, { minScore: 70 })).toBeLessThan(tier(69, '2026-10-30', { minScore: 70 }));
  });
  it('nahe Fristen zuerst, innerhalb der gut passenden und innerhalb des Rests', () => {
    const o = { minScore: 70, urgentFirst: true, urgentDays: 30 };
    const order = [tier(80, '2026-11-20', o), tier(95, '2026-12-31', o), tier(40, '2026-11-01', o), tier(50, null, o)];
    expect(order).toEqual([0, 1, 2, 3]);
    // Frist schon vorbei oder weiter als die gewählten Tage: nicht nah
    expect(tier(80, '2026-10-20', o)).toBe(1);
    expect(tier(80, '2026-11-20', { ...o, urgentDays: 14 })).toBe(1);
  });
  it('liest nur sinnvolle Werte', () => {
    expect(parseDeckOrder({ minScore: 150, urgentDays: -3, urgentFirst: 'ja' })).toEqual({ minScore: null, urgentFirst: false, urgentDays: 30 });
  });
});
