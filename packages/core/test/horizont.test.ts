import { describe, expect, it } from 'vitest';
import {
  importSteckbrief,
  interleave,
  isThematic,
  laneOf,
  matchBridges,
  parseProfile,
  passesFilter,
  profileSummary,
  searchTextOf,
  siteKeyOf,
  starterHorizont,
  starterProfile,
  STECKBRIEF_EXAMPLE,
  weiteCandidate,
  DEFAULT_FILTER,
  type Horizont,
  type Job,
} from '../src';

const norm = (title: string, text: string) => searchTextOf({ title, descriptionMd: text });

describe('Brücken', () => {
  const h = starterHorizont();

  it('Feld und Anknüpfung müssen beide vorkommen', () => {
    const usable = norm('Wissenschaftliche:r Mitarbeiter:in Usable Security', 'Wir untersuchen in Nutzerstudien und mit Methoden der Verhaltensforschung, wie Beschäftigte Phishing-Mails erkennen.');
    const hits = matchBridges(usable, h);
    expect(hits[0].bridge.name).toBe('IT-Sicherheit');
    expect(hits[0].feld).toContain('phishing');
    expect(hits[0].anker.length).toBeGreaterThan(1);

    const pureIt = norm('Administrator:in IT-Sicherheit', 'Betrieb von Firewalls und Netzwerken, Patch-Management, Rufbereitschaft.');
    expect(matchBridges(pureIt, h)).toEqual([]);
  });

  it('einzelne Allerweltswörter reichen nicht als Anknüpfung', () => {
    // „Experimente“, „empirisch“, „Akzeptanz“ und „Befragung“ stehen in zu vielen Anzeigen
    const data = norm('Data Scientist IT-Sicherheit', 'Experimente zur Angriffserkennung, empirische Auswertung, Befragung der Fachabteilungen, hohe Akzeptanz der Lösung.');
    expect(matchBridges(data, h)).toEqual([]);
    const human = norm('Data Scientist IT-Sicherheit', 'Experimente zur Angriffserkennung; im Team mit der Arbeitspsychologie untersuchen wir den Faktor Mensch.');
    expect(matchBridges(human, h)[0]?.bridge.name).toBe('IT-Sicherheit');
  });

  it('Floskeln lösen keine Brücke aus', () => {
    const lab = norm('Technische Assistenz Chemielabor', 'Wir bieten Weiterbildung, betriebliches Gesundheitsmanagement und Datenschutz. Hohe Motivation und Stressresistenz erwünscht.');
    expect(matchBridges(lab, h)).toEqual([]);
  });

  it('pausierte Brücken zählen nicht', () => {
    const paused: Horizont = { ...h, bruecken: h.bruecken.map((b) => ({ ...b, aktiv: b.id !== 'h-sec' })) };
    const t = norm('Security Awareness', 'Social Engineering und das Verhalten von Beschäftigten in einer Befragung untersuchen');
    expect(matchBridges(t, paused).map((x) => x.bridge.id)).not.toContain('h-sec');
  });
});

describe('Weite-Vorauswahl', () => {
  it('braucht eine Fähigkeit und eine Anknüpfung', () => {
    const p = starterProfile();
    expect(weiteCandidate(norm('Referent:in Verkehrsplanung', 'Auswertung einer Befragung zum Mobilitätsverhalten von Pendlerinnen mit Statistik'), p)).not.toBeNull();
    // Fähigkeit ohne Verbindung zu Menschen und Verhalten: kein Kandidat
    expect(weiteCandidate(norm('Referent:in Verkehrsplanung', 'Auswertung einer Befragung von Pendlerinnen mit Statistik'), p)).toBeNull();
    expect(weiteCandidate(norm('Koch/Köchin', 'Zubereitung von Speisen in der Mensa'), p)).toBeNull();
  });
});

describe('Ring einer Anzeige', () => {
  const h = starterHorizont();
  const t = norm('Usable Security', 'Nutzerstudien zu Phishing, Befragung von Beschäftigten');

  it('Trifft die Anzeige ein Kernthema, ist sie Kern – egal, wie sie hereinkam', () => {
    expect(laneOf({ lane: 'kern' }, t, h, true).lane).toBe('kern');
    expect(laneOf({ lane: 'horizont' }, t, h, true).lane).toBe('kern');
  });

  it('Horizont wird erst eingestreut, wenn die KI die Karte geprüft hat, und nur bei aktiver Brücke', () => {
    const passt = { lane: 'horizont' as const, horizon: { bridges: ['h-sec'], verdict: 'passt' as const } };
    expect(laneOf({ lane: 'horizont' }, t, h, false)).toMatchObject({ lane: 'horizont', promoted: false, label: 'IT-Sicherheit' });
    expect(laneOf(passt, t, h, false)).toMatchObject({ lane: 'horizont', promoted: true, label: 'IT-Sicherheit' });
    expect(laneOf({ ...passt, horizon: { ...passt.horizon, verdict: 'eher' } }, t, h, false).promoted).toBe(true);
    const off: Horizont = { ...h, bruecken: h.bruecken.map((b) => ({ ...b, aktiv: false })) };
    expect(laneOf(passt, t, off, false).promoted).toBe(false);
    expect(laneOf(passt, t, { ...h, dosis: 'aus' }, false).promoted).toBe(false);
  });

  it('Vom Grobfilter durchgelassen, aber ohne Kernthema: Horizont, wenn eine Brücke passt', () => {
    const ux = norm('UX Researcher', 'Usability-Tests, Interviews und Befragungen mit Nutzerinnen');
    expect(laneOf({ lane: 'kern' }, ux, h, false)).toMatchObject({ lane: 'horizont', promoted: false, label: 'Gestaltung & UX' });
    expect(laneOf({ lane: 'kern', horizon: { bridges: [], verdict: 'eher' } }, ux, h, false)).toMatchObject({ lane: 'horizont', promoted: true });
    // KI sagte „nein“: bleibt Kern (wird nicht eingestreut)
    expect(laneOf({ lane: 'kern', horizon: { verdict: 'nein' } }, ux, h, false).lane).toBe('kern');
    // ohne Brücke bleibt es Kern
    expect(laneOf({ lane: 'kern' }, norm('Technische Assistenz EEG-Labor', 'Messungen betreuen'), h, false).lane).toBe('kern');
  });

  it('Kernthema aus dem Profil', () => {
    const p = starterProfile();
    expect(isThematic({ kind: null }, norm('Postdoc Psychologie', 'Forschung'), p)).toBe(true);
    expect(isThematic({ kind: null }, norm('UX Researcher', 'Usability-Tests'), p)).toBe(false);
    // Ein Themenwort in einer fachfremden Anzeige macht sie nicht zum Kern
    expect(isThematic({ kind: null, title: 'Wissenschaftliche Mitarbeiterin' }, norm('Wissenschaftliche Mitarbeiterin', 'Kognitive Robotik und Neurowissenschaft'), p)).toBe(false);
    expect(isThematic({ kind: 'klinik', title: 'Ergotherapeut (m/w/d)' }, norm('Ergotherapeut (m/w/d)', 'Team aus Psychologen, kognitives Training'), p)).toBe(false);
  });

  it('Filter nach Ring', () => {
    const job = { lane: 'horizont', status: 'aktiv', newSite: true } as unknown as Job;
    const place = { lat: null, lon: null, cityId: null, state: null, distanceKm: null };
    const geo = { home: { label: '', lat: 0, lon: 0 }, institutions: new Map(), cities: new Map() };
    expect(passesFilter(job, { ...DEFAULT_FILTER, lanes: ['kern'] }, place, geo, '', '2026-10-12', 'horizont')).toBe(false);
    expect(passesFilter(job, { ...DEFAULT_FILTER, lanes: ['horizont'], newSitesOnly: true }, place, geo, '', '2026-10-12', 'horizont')).toBe(true);
  });
});

describe('Einstreuen in den Stapel', () => {
  const core = Array.from({ length: 30 }, (_, i) => `k${i}`);
  const extra = Array.from({ length: 6 }, (_, i) => `h${i}`);

  it('jede 3. bis 6. Karte ist eine Horizont-Karte', () => {
    const mixed = interleave(core, extra, 'horizont:2026-10-12', 'normal');
    expect(mixed).toHaveLength(36);
    const positions = mixed.map((x, i) => (x.startsWith('h') ? i : -1)).filter((i) => i >= 0);
    let last = -1;
    for (const p of positions) {
      const gap = p - last; // Abstand zur vorigen Horizont-Karte
      expect(gap).toBeGreaterThanOrEqual(3);
      expect(gap).toBeLessThanOrEqual(6);
      last = p;
    }
  });

  it('gleicher Startwert, gleiche Reihenfolge; Kern-Reihenfolge bleibt erhalten', () => {
    expect(interleave(core, extra, 'x', 'normal')).toEqual(interleave(core, extra, 'x', 'normal'));
    expect(interleave(core, extra, 'x', 'normal').filter((x) => x.startsWith('k'))).toEqual(core);
  });

  it('übrige Horizont-Karten kommen ans Ende, „aus“ hängt nur an', () => {
    expect(interleave(['k0'], ['h0', 'h1'], 'x', 'normal')).toEqual(['k0', 'h0', 'h1']);
    expect(interleave(['k0', 'k1'], ['h0'], 'x', 'aus')).toEqual(['k0', 'k1', 'h0']);
  });

  it('nach den gut passenden öfter: bis dahin wie sonst, danach jede 2. bis 3. Karte', () => {
    const many = Array.from({ length: 20 }, (_, i) => `h${i}`);
    const plain = interleave(core, many, 'horizont:2026-11-24', 'normal');
    const more = interleave(core, many, 'horizont:2026-11-24', 'normal', 12);
    // Bis zur Kern-Karte k11 ändert sich nichts (beim Wischen verschiebt sich also nichts)
    const until = plain.indexOf('k11');
    expect(more.slice(0, until + 1)).toEqual(plain.slice(0, until + 1));
    // Direkt nach k11 kommt eine Horizont-Karte, danach liegen höchstens zwei Kern-Karten zwischen zwei Horizont-Karten
    expect(more[more.indexOf('k11') + 1]).toMatch(/^h/);
    const rest = more.slice(more.indexOf('k11') + 1, more.indexOf('k29') + 1);
    let run = 0;
    for (const x of rest) {
      run = x.startsWith('k') ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(2);
    }
    expect(more.filter((x) => x.startsWith('k'))).toEqual(core);
    expect(more).toHaveLength(core.length + many.length);
    // „aus“ bleibt aus
    expect(interleave(['k0', 'k1'], ['h0'], 'x', 'aus', 0)).toEqual(['k0', 'k1', 'h0']);
  });
});

describe('Steckbrief mit Horizont', () => {
  it('Brücken aus dem Interview ersetzen die Start-Brücken', () => {
    const r = importSteckbrief(STECKBRIEF_EXAMPLE);
    if ('error' in r) throw new Error(r.error);
    expect(r.profile.horizont?.bruecken.map((b) => b.name)).toEqual(['Mensch & KI', 'IT-Sicherheit']);
    expect(r.profile.horizont?.bruecken.every((b) => b.herkunft === 'steckbrief')).toBe(true);
    expect(r.profile.horizont?.interessen).toContain('IT-Sicherheit');
  });

  it('ohne Horizont-Abschnitt gilt der breite Start-Horizont', () => {
    const { horizont: _h, ...rest } = STECKBRIEF_EXAMPLE;
    const r = importSteckbrief(rest);
    if ('error' in r) throw new Error(r.error);
    expect(r.profile.horizont?.bruecken.length).toBe(starterHorizont().bruecken.length);
  });

  it('Kurzfassung für die KI enthält nur Stichworte', () => {
    const s = profileSummary(starterProfile());
    expect(s).toMatch(/Thema: Psychologie/);
    expect(s).toMatch(/Brücken: Mensch & KI/);
  });
});

describe('Profil mit fehlerhaftem Horizont', () => {
  it('behält das Suchprofil und nimmt den Start-Horizont', () => {
    const p = starterProfile();
    const broken = { ...p, name: 'Mein Profil', horizont: { ...p.horizont, bruecken: [{ id: 'x', name: 'leer', feld: [], anker: [], aktiv: true, herkunft: 'manuell' }] } };
    const parsed = parseProfile(broken);
    expect(parsed?.name).toBe('Mein Profil');
    expect(parsed?.horizont).toBeUndefined();
  });
});

describe('Register', () => {
  it('Website, Bewerbersystem oder Arbeitgeber', () => {
    expect(siteKeyOf('https://www.cispa.de/de/jobs/123')).toBe('cispa.de');
    expect(siteKeyOf('https://institut.jobs.personio.de/job/9')).toBe('institut.jobs.personio.de');
    // Arbeitgeber im Pfad: jede Firma ist eine eigene Website
    expect(siteKeyOf('https://jobs.lever.co/Beispielfirma/1234-abcd')).toBe('jobs.lever.co/beispielfirma');
    expect(siteKeyOf('https://job-boards.greenhouse.io/firma/jobs/42')).toBe('job-boards.greenhouse.io/firma');
    expect(siteKeyOf('https://jobs.smartrecruiters.com/BoschGroup/7440000')).toBe('jobs.smartrecruiters.com/boschgroup');
    expect(siteKeyOf('https://join.com/companies/firma/123-ux')).toBe('join.com/firma');
    expect(siteKeyOf('https://www.arbeitsagentur.de/jobsuche/jobdetail/10000-1', 'Stiftung Beispiel gGmbH')).toBe('arbeitgeber:stiftung beispiel ggmbh');
    expect(siteKeyOf('https://www.arbeitsagentur.de/jobsuche/jobdetail/10000-1')).toBeNull();
  });
});
