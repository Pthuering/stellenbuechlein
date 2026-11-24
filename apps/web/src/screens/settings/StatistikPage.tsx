// Statistik: wie die App arbeitet. Jeder Einsammel-Lauf legt am Ende im Hintergrund einen Schnappschuss ab (Tabelle
// statistik): was er gefunden, aussortiert und aufgenommen hat, wie der Bestand danach aussieht und was Tara mit den
// Anzeigen gemacht hat. Dazu kommen die Urteile der KI und die Entscheidungen je Tag. Hier wird alles nur gezeigt.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { laufKennzahlen, PASSUNG_STUFEN, STAT_RINGE, type GemerktWeggelegt, type StatRing, type StatSchnappschuss } from '@stellen/core';
import type { StatistikDaten } from '../../data/backend';
import { useAppState, useStore } from '../../data/hooks';
import { fmtDate, fmtDayMonth, fmtNum, fmtPct, LANG_TAGS, lang, srForm, texts, useLang } from '../../i18n';
import { relativeTime } from '../../lib/format';
import { DataTable, fmtInt, HBars, Legend, StackedBars, Tiles, type ChartSeries } from '../../ui/charts';
import { SubPage } from './Settings';

type Lauf = StatSchnappschuss['lauf'] & { runId: number };
type FunnelKey = 'bekannt' | 'frueherAussortiert' | 'titel' | 'grobfilter' | 'keineAnzeige' | 'dubletten' | 'verschoben' | 'horizontWartet' | 'neu';
const FUNNEL: FunnelKey[] = ['bekannt', 'frueherAussortiert', 'titel', 'grobfilter', 'keineAnzeige', 'dubletten', 'verschoben', 'horizontWartet', 'neu'];
type Urteil = 'passt' | 'eher' | 'nein';
const URTEILE: Urteil[] = ['passt', 'eher', 'nein'];
type KiArt = 'auswerten' | 'frist' | 'horizont' | 'weite';

/** Tage, über die die KI-Urteile und Entscheidungen gezeigt werden (der Server liefert 90) */
const TAGE = 30;
/** so viele Läufe in den Diagrammen */
const LAEUFE = 30;

const RING_FARBE: Record<StatRing, string> = {
  normal: 'var(--chart-normal)',
  bruecke: 'var(--chart-bruecke)',
  horizont: 'var(--chart-horizont)',
  ausland: 'var(--chart-ausland)',
};
const URTEIL_FARBE: Record<Urteil, string> = { passt: 'var(--chart-passt)', eher: 'var(--chart-eher)', nein: 'var(--chart-nein)' };

const t = texts({
  de: {
    title: 'Statistik',
    sub: 'Wie die App arbeitet: jeder Lauf, die Urteile der KI, der Bestand und was du daraus machst',
    loading: 'wird geladen …',
    demo: 'In der Demo gibt es nur einen Beispiel-Lauf. Im echten Betrieb legt jeder Einsammel-Lauf hier im Hintergrund seine Zahlen ab.',
    error: (msg: string) => `Die Statistik ließ sich nicht laden: ${msg}`,
    retry: 'Erneut versuchen',
    running: (when: string) => `Gerade läuft ein Lauf (gestartet ${when}). Seine Zahlen kommen, sobald er fertig ist.`,
    noRuns: 'Noch kein abgeschlossener Lauf.',
    nextRun: 'Kommt mit dem nächsten Einsammel-Lauf.',
    asTable: 'Als Tabelle',
    total: 'zusammen',
    ring: { normal: 'normale Einträge', bruecke: 'Brücke', horizont: 'Horizont', ausland: 'Ausland' } as Record<StatRing, string>,
    urteil: { passt: 'passt', eher: 'eher', nein: 'nein' } as Record<Urteil, string>,
    art: { auswerten: 'aufbereiten', frist: 'Frist', horizont: 'Brücke', weite: 'Horizont' } as Record<KiArt, string>,

    lastRun: 'Letzter Lauf',
    lastRunSub: (date: string, ok: boolean) => `${date}${ok ? '' : ', mit Fehlern beendet'}`,
    found: 'Seiten in den Listen',
    foundSub: 'aus allen Quellen',
    added: 'neu aufgenommen',
    addedSub: (bridge: number, abroad: number) => `${bridge} über Brücken, ${abroad} im Ausland`,
    sorted: 'aussortiert',
    sortedSub: 'am Titel, am Grobfilter, keine Anzeige',
    duration: 'Dauer',
    minutes: (n: number) => `${n} min`,
    sources: (ok: number, failed: number) => `${ok} Quellen ok, ${failed} mit Fehler`,
    funnel: 'Wohin die Seiten gingen',
    funnelKey: {
      bekannt: 'schon bekannt, nur aufgefrischt',
      frueherAussortiert: 'früher aussortiert, nicht neu geladen',
      titel: 'am Titel aussortiert (Pflege, Arzt …)',
      grobfilter: 'am Grobfilter aussortiert',
      keineAnzeige: 'keine einzelne Stellenanzeige',
      dubletten: 'Dublette einer bekannten Anzeige',
      verschoben: 'auf den nächsten Lauf verschoben',
      horizontWartet: 'Horizont-Kandidat, wartet auf die KI',
      neu: 'neu aufgenommen',
    } as Record<FunnelKey, string>,
    funnelHint: 'Anteil an allen Seiten in den Listen. Nicht lesbare oder gesperrte Seiten fehlen, deshalb ergibt die Summe nicht ganz 100 %.',
    runExtra: (closed: number, ki: number, calls: number) =>
      `Geschlossen: ${closed} Anzeigen (Frist vorbei oder nicht mehr gelistet). Für die KI eingereiht: ${ki} Aufgaben. Abrufe: ${fmtInt(calls)}.`,

    perRun: 'Neu je Lauf',
    perRunSub: (n: number) => `die letzten ${n} Läufe`,
    candidates: 'Horizont-Kandidaten',
    perRunHint: 'Normale Einträge, Brücken und Auslandsstellen stehen sofort im Bestand. Horizont-Kandidaten kommen erst dazu, wenn die KI „passt“ oder „eher“ sagt.',
    foundPerRun: 'Seiten in den Listen je Lauf',
    foundPerRunHint: 'Fällt die Zahl plötzlich, liefert eine Quelle nicht mehr (siehe Quellen & Läufe).',

    ki: 'Urteile der KI',
    kiSub: (n: number) => `die letzten ${n} Tage`,
    bridgeVerdicts: 'Brücken-Kandidaten',
    horizonVerdicts: 'Horizont-Kandidaten',
    kiHint: 'Nur „passt“ und „eher“ kommen in den Stapel. Ein hoher Nein-Anteil heißt: Der Grobfilter schickt viele unpassende Kandidaten zur KI.',
    noVerdicts: 'In dieser Zeit keine Urteile.',
    prepared: 'Anzeigen aufbereitet',
    preparedSub: (none: number, pct: string) => `${fmtInt(none)} davon keine Stellenanzeige (${pct})`,
    deadlines: 'Fristen gesucht',
    deadlinesSub: (n: number) => `${fmtInt(n)} mit Frist gefunden`,
    bridgesAccepted: 'Brücken angenommen',
    horizonAccepted: 'Horizont angenommen',
    ofN: (x: number, n: number) => `${fmtInt(x)} von ${fmtInt(n)}`,
    failed: 'ohne Ergebnis',
    failedSub: 'nach drei Versuchen aufgegeben',
    wait: 'Wartezeit',
    hours: (h: string) => `${h} Std.`,
    waitSub: 'vom Einreihen bis zum Ergebnis, im Mittel',
    queue: 'jetzt offen',
    queueNone: 'nichts wartet',

    stock: 'Bestand',
    stockSub: 'offene Anzeigen nach jedem Lauf',
    stockHint: 'Brücke und Horizont zählen erst mit dem Urteil der KI. Ausland: nur die Stellen, die die App zeigt (Passung ab 75 %, fachlich passend).',
    open: 'offen',
    waiting: 'warten auf die KI',
    waitingSub: 'Brücke oder Horizont ohne Urteil',
    deadlineSoon: 'Frist in 14 Tagen',
    withDeadline: (n: number) => `${fmtInt(n)} mit Frist`,
    abroad: 'Ausland gezeigt',
    abroadSub: (all: number) => `von ${fmtInt(all)} im Bestand`,

    fit: 'Passung der normalen Einträge',
    fitSub: (median: string) => `Median ${median}`,
    fitHint: 'Brücke und Horizont haben keine Prozentzahl und fehlen hier.',

    effect: 'Wirkung',
    effectSub: 'was du gemerkt oder weggelegt hast',
    decisions: 'Entscheidungen je Tag',
    decision: { gemerkt: 'gemerkt', abgelehnt: 'weggelegt' } as Record<'gemerkt' | 'abgelehnt', string>,
    noDecisions: 'In dieser Zeit keine Entscheidungen.',
    keepByFit: 'Merkquote nach Passung',
    keepByRing: 'Merkquote nach Art',
    keepHint: 'Anteil gemerkt an allen Entscheidungen, gerechnet mit dem Profil von heute. Steigt die Quote mit der Passung, sortiert die Prozentzahl richtig. Bei Brücke und Horizont zeigt sie, ob die Karten den Stapel bereichern.',
    decided: 'entschieden',
    hearts: 'mit Herz',
    applied: 'beworben',

    runs: 'Alle Läufe',
    day: 'Tag',
    runsHead: ['Lauf', 'Dauer', 'Seiten', 'bekannt', 'Titel', 'Grobfilter', 'keine Anzeige', 'neu', 'Brücke', 'Ausland', 'Horizont-Kand.', 'Quellen mit Fehler'],
  },
  en: {
    title: 'Statistics',
    sub: 'How the app works: every run, the AI’s verdicts, the postings on hand and what you do with them',
    loading: 'loading…',
    demo: 'The demo has only one example run. In real use, every collecting run stores its numbers here in the background.',
    error: (msg) => `Couldn’t load the statistics: ${msg}`,
    retry: 'Try again',
    running: (when) => `A run is in progress (started ${when}). Its numbers appear once it’s done.`,
    noRuns: 'No finished run yet.',
    nextRun: 'Comes with the next collecting run.',
    asTable: 'As a table',
    total: 'total',
    ring: { normal: 'regular entries', bruecke: 'Bridge', horizont: 'Horizon', ausland: 'Abroad' },
    urteil: { passt: 'fits', eher: 'maybe', nein: 'no' },
    art: { auswerten: 'prepare', frist: 'deadline', horizont: 'Bridge', weite: 'Horizon' },

    lastRun: 'Last run',
    lastRunSub: (date, ok) => `${date}${ok ? '' : ', ended with errors'}`,
    found: 'Pages in the lists',
    foundSub: 'from all sources',
    added: 'newly added',
    addedSub: (bridge, abroad) => `${bridge} via bridges, ${abroad} abroad`,
    sorted: 'filtered out',
    sortedSub: 'by title, by pre-filter, not a posting',
    duration: 'Duration',
    minutes: (n) => `${n} min`,
    sources: (ok, failed) => `${ok} ${ok === 1 ? 'source' : 'sources'} OK, ${failed} with errors`,
    funnel: 'Where the pages went',
    funnelKey: {
      bekannt: 'already known, just refreshed',
      frueherAussortiert: 'filtered out before, not reloaded',
      titel: 'filtered out by title (nursing, doctor …)',
      grobfilter: 'filtered out by the pre-filter',
      keineAnzeige: 'not a single job posting',
      dubletten: 'duplicate of a known posting',
      verschoben: 'postponed to the next run',
      horizontWartet: 'Horizon candidate, waiting for the AI',
      neu: 'newly added',
    },
    funnelHint: 'Share of all pages in the lists. Unreadable or blocked pages are left out, so the total doesn’t quite reach 100%.',
    runExtra: (closed, ki, calls) =>
      `Closed: ${closed} ${closed === 1 ? 'posting' : 'postings'} (deadline passed or no longer listed). Queued for the AI: ${ki} ${ki === 1 ? 'task' : 'tasks'}. Requests: ${fmtInt(calls)}.`,

    perRun: 'New per run',
    perRunSub: (n) => `the last ${n} runs`,
    candidates: 'Horizon candidates',
    perRunHint: 'Regular entries, bridges and postings abroad are on hand right away. Horizon candidates are added only once the AI says “fits” or “maybe”.',
    foundPerRun: 'Pages in the lists per run',
    foundPerRunHint: 'If the number drops suddenly, a source has stopped delivering (see Sources & runs).',

    ki: 'AI verdicts',
    kiSub: (n) => `the last ${n} days`,
    bridgeVerdicts: 'Bridge candidates',
    horizonVerdicts: 'Horizon candidates',
    kiHint: 'Only “fits” and “maybe” go into the stack. A high share of “no” means the pre-filter sends many unsuitable candidates to the AI.',
    noVerdicts: 'No verdicts in this period.',
    prepared: 'Postings prepared',
    preparedSub: (none, pct) => `${fmtInt(none)} of them not a job posting (${pct})`,
    deadlines: 'Deadlines checked',
    deadlinesSub: (n) => `${fmtInt(n)} with a deadline found`,
    bridgesAccepted: 'Bridges accepted',
    horizonAccepted: 'Horizon accepted',
    ofN: (x, n) => `${fmtInt(x)} of ${fmtInt(n)}`,
    failed: 'no result',
    failedSub: 'given up after three attempts',
    wait: 'Waiting time',
    hours: (h) => `${h} h`,
    waitSub: 'from queueing to result, on average',
    queue: 'open now',
    queueNone: 'nothing waiting',

    stock: 'Postings on hand',
    stockSub: 'open postings after each run',
    stockHint: 'Bridge and Horizon count only once the AI has judged them. Abroad: only the postings the app shows (match from 75%, right field).',
    open: 'open',
    waiting: 'waiting for the AI',
    waitingSub: 'Bridge or Horizon without a verdict',
    deadlineSoon: 'Deadline within 14 days',
    withDeadline: (n) => `${fmtInt(n)} with a deadline`,
    abroad: 'Abroad shown',
    abroadSub: (all) => `of ${fmtInt(all)} on hand`,

    fit: 'Match of regular entries',
    fitSub: (median) => `median ${median}`,
    fitHint: 'Bridge and Horizon have no percentage and are left out here.',

    effect: 'Effect',
    effectSub: 'what you saved or passed',
    decisions: 'Decisions per day',
    decision: { gemerkt: 'saved', abgelehnt: 'passed' },
    noDecisions: 'No decisions in this period.',
    keepByFit: 'Save rate by match',
    keepByRing: 'Save rate by kind',
    keepHint: 'Share saved of all decisions, calculated with today’s profile. If the rate rises with the match, the percentage sorts correctly. For Bridge and Horizon it shows whether those cards enrich the stack.',
    decided: 'decided',
    hearts: 'with a heart',
    applied: 'applied',

    runs: 'All runs',
    day: 'Day',
    runsHead: ['Run', 'Duration', 'Pages', 'known', 'title', 'pre-filter', 'not a posting', 'new', 'Bridge', 'Abroad', 'Horizon cand.', 'sources with errors'],
  },
  sr: {
    title: 'Statistika',
    sub: 'Kako aplikacija radi: svaki prolaz, ocene AI, oglasi na raspolaganju i šta ti radiš s njima',
    loading: 'učitava se…',
    demo: 'U demu postoji samo jedan primer prolaza. U pravoj upotrebi svaki prolaz prikupljanja ovde u pozadini beleži svoje brojeve.',
    error: (msg) => `Statistika nije mogla da se učita: ${msg}`,
    retry: 'Pokušaj ponovo',
    running: (when) => `Prolaz je upravo u toku (pokrenut ${when}). Njegovi brojevi stižu kad se završi.`,
    noRuns: 'Još nema završenog prolaza.',
    nextRun: 'Stiže sa sledećim prolazom prikupljanja.',
    asTable: 'Kao tabela',
    total: 'ukupno',
    ring: { normal: 'obični oglasi', bruecke: 'Most', horizont: 'Horizont', ausland: 'Inostranstvo' },
    urteil: { passt: 'odgovara', eher: 'možda', nein: 'ne' },
    art: { auswerten: 'obrada', frist: 'rok', horizont: 'Most', weite: 'Horizont' },

    lastRun: 'Poslednji prolaz',
    lastRunSub: (date, ok) => `${date}${ok ? '' : ', završen sa greškama'}`,
    found: 'Stranice u listama',
    foundSub: 'iz svih izvora',
    added: 'novo dodato',
    addedSub: (bridge, abroad) => `${bridge} preko mostova, ${abroad} u inostranstvu`,
    sorted: 'odbačeno',
    sortedSub: 'po naslovu, grubim filterom, nije oglas',
    duration: 'Trajanje',
    minutes: (n) => `${n} min`,
    sources: (ok, failed) => `${ok} ${srForm(ok, 'izvor', 'izvora', 'izvora')} u redu, ${failed} sa greškom`,
    funnel: 'Gde su stranice završile',
    funnelKey: {
      bekannt: 'već poznato, samo osveženo',
      frueherAussortiert: 'ranije odbačeno, nije ponovo učitano',
      titel: 'odbačeno po naslovu (nega, lekar …)',
      grobfilter: 'odbačeno grubim filterom',
      keineAnzeige: 'nije pojedinačan oglas za posao',
      dubletten: 'duplikat poznatog oglasa',
      verschoben: 'odloženo za sledeći prolaz',
      horizontWartet: 'kandidat za Horizont, čeka AI',
      neu: 'novo dodato',
    },
    funnelHint: 'Udeo u svim stranicama iz listi. Nečitljive ili blokirane stranice nisu uračunate, pa zbir ne dostiže sasvim 100%.',
    runExtra: (closed, ki, calls) =>
      `Zatvoreno: ${closed} ${srForm(closed, 'oglas', 'oglasa', 'oglasa')} (rok je prošao ili više nije na listi). Poslato AI na obradu: ${ki} ${srForm(ki, 'zadatak', 'zadatka', 'zadataka')}. Zahtevi: ${fmtInt(calls)}.`,

    perRun: 'Novo po prolazu',
    perRunSub: (n) => `poslednjih ${n} prolaza`,
    candidates: 'Kandidati za Horizont',
    perRunHint: 'Obični oglasi, mostovi i oglasi iz inostranstva odmah su na raspolaganju. Kandidati za Horizont dolaze tek kad AI kaže „odgovara“ ili „možda“.',
    foundPerRun: 'Stranice u listama po prolazu',
    foundPerRunHint: 'Ako broj naglo padne, neki izvor više ne isporučuje (vidi Izvori i prolazi).',

    ki: 'Ocene AI',
    kiSub: (n) => `poslednjih ${n} dana`,
    bridgeVerdicts: 'Kandidati preko mosta',
    horizonVerdicts: 'Kandidati za Horizont',
    kiHint: 'U špil ulaze samo „odgovara“ i „možda“. Visok udeo odgovora „ne“ znači da grubi filter šalje AI mnogo neodgovarajućih kandidata.',
    noVerdicts: 'U ovom periodu nema ocena.',
    prepared: 'Obrađeni oglasi',
    preparedSub: (none, pct) => `od toga ${fmtInt(none)} nije oglas za posao (${pct})`,
    deadlines: 'Provereni rokovi',
    deadlinesSub: (n) => `rok pronađen kod ${fmtInt(n)}`,
    bridgesAccepted: 'Prihvaćeni mostovi',
    horizonAccepted: 'Prihvaćen Horizont',
    ofN: (x, n) => `${fmtInt(x)} od ${fmtInt(n)}`,
    failed: 'bez rezultata',
    failedSub: 'odustato posle tri pokušaja',
    wait: 'Vreme čekanja',
    hours: (h) => `${h} h`,
    waitSub: 'od slanja na obradu do rezultata, u proseku',
    queue: 'trenutno čeka',
    queueNone: 'ništa ne čeka',

    stock: 'Oglasi na raspolaganju',
    stockSub: 'otvoreni oglasi posle svakog prolaza',
    stockHint: 'Most i Horizont se računaju tek kad ih AI oceni. Inostranstvo: samo oglasi koje aplikacija prikazuje (poklapanje od 75%, odgovarajuća oblast).',
    open: 'otvoreno',
    waiting: 'čeka AI',
    waitingSub: 'Most ili Horizont bez ocene',
    deadlineSoon: 'Rok za 14 dana',
    withDeadline: (n) => `${fmtInt(n)} sa rokom`,
    abroad: 'Prikazano iz inostranstva',
    abroadSub: (all) => `od ${fmtInt(all)} na raspolaganju`,

    fit: 'Poklapanje običnih oglasa',
    fitSub: (median) => `medijana ${median}`,
    fitHint: 'Most i Horizont nemaju procenat i ovde nisu uračunati.',

    effect: 'Učinak',
    effectSub: 'šta si sačuvala ili preskočila',
    decisions: 'Odluke po danu',
    decision: { gemerkt: 'sačuvano', abgelehnt: 'preskočeno' },
    noDecisions: 'U ovom periodu nema odluka.',
    keepByFit: 'Udeo sačuvanih po poklapanju',
    keepByRing: 'Udeo sačuvanih po vrsti',
    keepHint: 'Udeo sačuvanih u svim odlukama, izračunat prema današnjem profilu. Ako udeo raste sa poklapanjem, procenat dobro razvrstava. Kod Mosta i Horizonta pokazuje da li te kartice obogaćuju špil.',
    decided: 'odlučeno',
    hearts: 'sa srcem',
    applied: 'prijava poslata',

    runs: 'Svi prolazi',
    day: 'Dan',
    runsHead: ['Prolaz', 'Trajanje', 'Stranice', 'poznato', 'naslov', 'grubi filter', 'nije oglas', 'novo', 'Most', 'Inostranstvo', 'kand. Horizont', 'izvori sa greškom'],
  },
});

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LANG_TAGS[lang()], { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
}

/** Passungsstufe als Bereich: „60–79 %“, oben „80–100 %“. */
function stufeLabel(st: string): string {
  const r = st === '80+' ? '80–100' : st.replace('-', '–');
  return lang() === 'de' ? `${r} %` : `${r}%`;
}

function pct(x: number, n: number): string {
  return fmtPct(n ? Math.round((x / n) * 100) : 0);
}

/** Läufe aus den Schnappschüssen und der Lauf-Tabelle, der Zeit nach; nur Läufe, die Quellen gelesen haben. */
function laeufeAus(d: StatistikDaten): Lauf[] {
  const m = new Map<number, Lauf>();
  for (const s of d.schnappschuesse) if (s.daten) m.set(s.runId, { ...s.daten.lauf, runId: s.runId });
  for (const r of d.laeufe) {
    if (!r.finishedAt) continue;
    m.set(r.id, { ...laufKennzahlen({ start: r.startedAt, ende: r.finishedAt, ok: r.ok, stats: r.stats }), runId: r.id });
  }
  return [...m.values()].filter((l) => l.gefunden > 0 || l.neu > 0).sort((a, b) => a.start.localeCompare(b.start));
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="stat-section">
      <h2 className="section-title">
        {title}
        {sub && <small className="stat-section__sub">{sub}</small>}
      </h2>
      {children}
    </section>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="hint stat-hint">{children}</p>;
}

function quote(g: GemerktWeggelegt): { value: number; n: number } {
  const n = g.gemerkt + g.weggelegt;
  return { value: n ? Math.round((g.gemerkt / n) * 100) : 0, n };
}

export function StatistikPage() {
  useLang();
  const s = useAppState();
  const store = useStore();
  const [data, setData] = useState<StatistikDaten | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await store.api.statistik());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  const laeufe = useMemo(() => (data ? laeufeAus(data) : []), [data]);
  const schnapp = useMemo(
    () => (data?.schnappschuesse ?? []).filter((x): x is { runId: number; erstelltAt: string; daten: StatSchnappschuss } => !!x.daten).sort((a, b) => a.erstelltAt.localeCompare(b.erstelltAt)),
    [data],
  );
  const seit = useMemo(() => new Date(Date.now() - TAGE * 86_400_000).toISOString().slice(0, 10), []);

  if (!data) {
    return (
      <SubPage title={t.title} sub={t.sub}>
        {error ? (
          <div className="notice notice--warn">
            <p style={{ margin: 0 }}>{t.error(error)}</p>
            <button type="button" className="btn btn--small" style={{ marginTop: 8 }} onClick={() => void load()}>
              {t.retry}
            </button>
          </div>
        ) : (
          <p className="hint">{t.loading}</p>
        )}
      </SubPage>
    );
  }

  // Ein Lauf ohne Ende, der länger als die Lauf-Sperre (6 Stunden) her ist, wurde abgebrochen
  const laeuft = data.laeufe.find((r) => !r.finishedAt && Date.now() - Date.parse(r.startedAt) < 6 * 3_600_000);
  const letzter = laeufe.at(-1);
  const zuletzt = laeufe.slice(-LAEUFE);
  const letzterSchnapp = schnapp.at(-1)?.daten;
  const lauflabel = zuletzt.map((l) => fmtDayMonth(l.start));
  const laufTip = zuletzt.map((l) => `${fmtDate(l.start)}, ${fmtTime(l.start)}`);

  return (
    <SubPage title={t.title} sub={t.sub}>
      {s.demo && <p className="notice notice--info">{t.demo}</p>}
      {laeuft && <p className="hint">{t.running(relativeTime(laeuft.startedAt))}</p>}

      {/* 1 · Letzter Lauf */}
      <Section title={t.lastRun} sub={letzter ? t.lastRunSub(`${fmtDate(letzter.start)}, ${fmtTime(letzter.start)}`, letzter.ok) : undefined}>
        {letzter ? <LetzterLauf l={letzter} /> : <Hint>{t.noRuns}</Hint>}
      </Section>

      {/* 2 · Neu je Lauf */}
      {zuletzt.length > 0 && (
        <Section title={t.perRun} sub={t.perRunSub(zuletzt.length)}>
          <NeuJeLauf laeufe={zuletzt} labels={lauflabel} tips={laufTip} />
        </Section>
      )}

      {/* 3 · Urteile der KI */}
      <Section title={t.ki} sub={t.kiSub(TAGE)}>
        <KiUrteile data={data} seit={seit} />
      </Section>

      {/* 4 · Bestand und 5 · Passung */}
      <Section title={t.stock} sub={t.stockSub}>
        {letzterSchnapp ? <Bestand schnapp={schnapp.slice(-LAEUFE)} /> : <Hint>{t.nextRun}</Hint>}
      </Section>
      {letzterSchnapp && (
        <Section title={t.fit} sub={letzterSchnapp.bestand.passungMedian != null ? t.fitSub(fmtPct(letzterSchnapp.bestand.passungMedian)) : undefined}>
          <HBars
            ariaLabel={t.fit}
            rows={PASSUNG_STUFEN.map((st) => {
              const v = letzterSchnapp.bestand.passung[st];
              return { key: st, label: stufeLabel(st), value: v, note: pct(v, letzterSchnapp.bestand.normal) };
            }).reverse()}
          />
          <Hint>{t.fitHint}</Hint>
        </Section>
      )}

      {/* 6 · Wirkung */}
      <Section title={t.effect} sub={t.effectSub}>
        <Wirkung data={data} seit={seit} snap={letzterSchnapp ?? null} />
      </Section>

      {/* 7 · Alle Läufe */}
      {laeufe.length > 0 && (
        <Section title={t.runs}>
          <DataTable
            summary={t.asTable}
            head={t.runsHead}
            rows={[...laeufe].reverse().map((l) => [
              `${fmtDate(l.start)}, ${fmtTime(l.start)}`,
              t.minutes(l.minuten),
              l.gefunden,
              l.bekannt,
              l.titel,
              l.grobfilter,
              l.keineAnzeige,
              l.neu,
              l.neuBruecke,
              l.neuAusland,
              l.horizontWartet,
              l.quellenFehler,
            ])}
          />
        </Section>
      )}
    </SubPage>
  );
}

function LetzterLauf({ l }: { l: Lauf }) {
  const aussortiert = l.titel + l.grobfilter + l.keineAnzeige;
  return (
    <>
      <Tiles
        items={[
          { key: 'gefunden', label: t.found, value: fmtInt(l.gefunden), sub: t.foundSub },
          { key: 'neu', label: t.added, value: fmtInt(l.neu), sub: t.addedSub(l.neuBruecke, l.neuAusland) },
          { key: 'aussortiert', label: t.sorted, value: fmtInt(aussortiert), sub: t.sortedSub },
          { key: 'dauer', label: t.duration, value: t.minutes(l.minuten), sub: t.sources(l.quellenOk, l.quellenFehler) },
        ]}
      />
      <h3 className="stat-subtitle">{t.funnel}</h3>
      <HBars ariaLabel={t.funnel} rows={FUNNEL.map((k) => ({ key: k, label: t.funnelKey[k], value: l[k], note: pct(l[k], l.gefunden) }))} />
      <Hint>{t.funnelHint}</Hint>
      <Hint>{t.runExtra(l.abgelaufen, l.kiAufgaben, l.abrufe)}</Hint>
    </>
  );
}

function NeuJeLauf({ laeufe, labels, tips }: { laeufe: Lauf[]; labels: string[]; tips: string[] }) {
  const series: ChartSeries[] = [
    { key: 'normal', label: t.ring.normal, color: RING_FARBE.normal },
    { key: 'bruecke', label: t.ring.bruecke, color: RING_FARBE.bruecke },
    { key: 'ausland', label: t.ring.ausland, color: RING_FARBE.ausland },
    { key: 'kandidaten', label: t.candidates, color: RING_FARBE.horizont },
  ];
  const values = laeufe.map((l) => [Math.max(0, l.neu - l.neuBruecke - l.neuAusland), l.neuBruecke, l.neuAusland, l.horizontWartet]);
  return (
    <>
      <Legend series={series} />
      <StackedBars labels={labels} tipLabels={tips} series={series} values={values} ariaLabel={t.perRun} totalLabel={t.total} />
      <Hint>{t.perRunHint}</Hint>
      <h3 className="stat-subtitle">{t.foundPerRun}</h3>
      <StackedBars
        labels={labels}
        tipLabels={tips}
        series={[{ key: 'gefunden', label: t.found, color: 'var(--chart-wert)' }]}
        values={laeufe.map((l) => [l.gefunden])}
        ariaLabel={t.foundPerRun}
        totalLabel={t.total}
        height={120}
      />
      <Hint>{t.foundPerRunHint}</Hint>
    </>
  );
}

function KiUrteile({ data, seit }: { data: StatistikDaten; seit: string }) {
  const rows = data.ki.filter((r) => r.tag >= seit);
  const sum = (art: string, ergebnis?: string) => rows.filter((r) => r.art === art && (ergebnis == null || r.ergebnis === ergebnis)).reduce((a, r) => a + r.n, 0);
  const series: ChartSeries[] = URTEILE.map((u) => ({ key: u, label: t.urteil[u], color: URTEIL_FARBE[u] }));

  const chart = (art: 'horizont' | 'weite', title: string) => {
    const tage = [...new Set(rows.filter((r) => r.art === art && URTEILE.includes(r.ergebnis as Urteil)).map((r) => r.tag))].sort();
    if (tage.length === 0)
      return (
        <div className="stat-multiple">
          <h3 className="stat-subtitle">{title}</h3>
          <Hint>{t.noVerdicts}</Hint>
        </div>
      );
    const values = tage.map((tag) => URTEILE.map((u) => rows.filter((r) => r.tag === tag && r.art === art && r.ergebnis === u).reduce((a, r) => a + r.n, 0)));
    return (
      <div className="stat-multiple">
        <h3 className="stat-subtitle">{title}</h3>
        <StackedBars labels={tage.map(fmtDayMonth)} tipLabels={tage.map(fmtDate)} series={series} values={values} ariaLabel={title} totalLabel={t.total} height={130} />
        <DataTable summary={t.asTable} head={[t.day, ...URTEILE.map((u) => t.urteil[u])]} rows={tage.map((tag, i) => [fmtDate(tag), ...values[i]])} />
      </div>
    );
  };

  const angenommen = (art: string) => {
    const ja = sum(art, 'passt') + sum(art, 'eher');
    const alle = ja + sum(art, 'nein');
    return { value: alle ? pct(ja, alle) : '–', sub: t.ofN(ja, alle) };
  };
  const anzeigen = sum('auswerten', 'anzeige') + sum('auswerten', 'keine-anzeige');
  const keine = sum('auswerten', 'keine-anzeige');
  const fehler = rows.filter((r) => r.ergebnis === 'fehler').reduce((a, r) => a + r.n, 0);
  const mitWarte = rows.filter((r) => r.stunden != null && r.ergebnis !== 'fehler');
  const nW = mitWarte.reduce((a, r) => a + r.n, 0);
  const stunden = nW ? mitWarte.reduce((a, r) => a + (r.stunden ?? 0) * r.n, 0) / nW : null;
  const offen = Object.entries(data.kiOffen).filter(([, n]) => n > 0);
  const offenSumme = offen.reduce((a, [, n]) => a + n, 0);
  const b = angenommen('horizont');
  const h = angenommen('weite');

  return (
    <>
      <Legend series={series} />
      <div className="stat-multiples">
        {chart('horizont', t.bridgeVerdicts)}
        {chart('weite', t.horizonVerdicts)}
      </div>
      <Hint>{t.kiHint}</Hint>
      <Tiles
        items={[
          { key: 'bruecke', label: t.bridgesAccepted, value: b.value, sub: b.sub },
          { key: 'horizont', label: t.horizonAccepted, value: h.value, sub: h.sub },
          { key: 'auswerten', label: t.prepared, value: fmtInt(anzeigen), sub: t.preparedSub(keine, pct(keine, anzeigen)) },
          { key: 'frist', label: t.deadlines, value: fmtInt(sum('frist') - sum('frist', 'fehler')), sub: t.deadlinesSub(sum('frist', 'frist')) },
          { key: 'warte', label: t.wait, value: stunden == null ? '–' : t.hours(fmtNum(Math.round(stunden * 10) / 10)), sub: t.waitSub },
          { key: 'fehler', label: t.failed, value: fmtInt(fehler), sub: t.failedSub },
          {
            key: 'offen',
            label: t.queue,
            value: fmtInt(offenSumme),
            sub: offen.length ? offen.map(([art, n]) => `${t.art[art as KiArt] ?? art} ${n}`).join(', ') : t.queueNone,
          },
        ]}
      />
    </>
  );
}

function Bestand({ schnapp }: { schnapp: { runId: number; erstelltAt: string; daten: StatSchnappschuss }[] }) {
  const series: ChartSeries[] = STAT_RINGE.map((r) => ({ key: r, label: t.ring[r], color: RING_FARBE[r] }));
  const werte = (b: StatSchnappschuss['bestand']) => [b.normal, b.bruecke, b.horizont, b.auslandSichtbar];
  const values = schnapp.map((x) => werte(x.daten.bestand));
  const b = schnapp[schnapp.length - 1].daten.bestand;
  return (
    <>
      <Tiles
        items={[
          { key: 'offen', label: t.open, value: fmtInt(b.offen), sub: t.withDeadline(b.mitFrist) },
          { key: 'frist', label: t.deadlineSoon, value: fmtInt(b.fristBald) },
          { key: 'wartet', label: t.waiting, value: fmtInt(b.wartetAufKi), sub: t.waitingSub },
          { key: 'ausland', label: t.abroad, value: fmtInt(b.auslandSichtbar), sub: t.abroadSub(b.ausland) },
        ]}
      />
      <Legend series={series} />
      <StackedBars
        labels={schnapp.map((x) => fmtDayMonth(x.erstelltAt))}
        tipLabels={schnapp.map((x) => `${fmtDate(x.erstelltAt)}, ${fmtTime(x.erstelltAt)}`)}
        series={series}
        values={values}
        ariaLabel={t.stock}
        totalLabel={t.total}
      />
      <Hint>{t.stockHint}</Hint>
      <DataTable
        summary={t.asTable}
        head={[t.runsHead[0], ...STAT_RINGE.map((r) => t.ring[r]), t.waiting, t.open]}
        rows={[...schnapp].reverse().map((x, i, arr) => [`${fmtDate(x.erstelltAt)}, ${fmtTime(x.erstelltAt)}`, ...values[arr.length - 1 - i], x.daten.bestand.wartetAufKi, x.daten.bestand.offen])}
      />
    </>
  );
}

function Wirkung({ data, seit, snap }: { data: StatistikDaten; seit: string; snap: StatSchnappschuss | null }) {
  const rows = data.entscheidungen.filter((r) => r.tag >= seit);
  const tage = [...new Set(rows.map((r) => r.tag))].sort();
  const series: ChartSeries[] = [
    { key: 'gemerkt', label: t.decision.gemerkt, color: 'var(--chart-passt)' },
    { key: 'abgelehnt', label: t.decision.abgelehnt, color: 'var(--chart-nein)' },
  ];
  const values = tage.map((tag) => (['gemerkt', 'abgelehnt'] as const).map((d) => rows.filter((r) => r.tag === tag && r.entscheidung === d).reduce((a, r) => a + r.n, 0)));
  const w = snap?.wirkung;
  const entschieden = w ? STAT_RINGE.reduce((a, r) => a + w.nachRing[r].gemerkt + w.nachRing[r].weggelegt, 0) : 0;

  return (
    <>
      {w && (
        <Tiles
          items={[
            { key: 'entschieden', label: t.decided, value: fmtInt(entschieden) },
            { key: 'herz', label: t.hearts, value: fmtInt(w.herz) },
            { key: 'beworben', label: t.applied, value: fmtInt(w.beworben) },
          ]}
        />
      )}
      <h3 className="stat-subtitle">{t.decisions}</h3>
      {tage.length ? (
        <>
          <Legend series={series} />
          <StackedBars labels={tage.map(fmtDayMonth)} tipLabels={tage.map(fmtDate)} series={series} values={values} ariaLabel={t.decisions} totalLabel={t.total} height={130} />
          <DataTable summary={t.asTable} head={[t.day, t.decision.gemerkt, t.decision.abgelehnt]} rows={tage.map((tag, i) => [fmtDate(tag), ...values[i]])} />
        </>
      ) : (
        <Hint>{t.noDecisions}</Hint>
      )}
      {w && entschieden > 0 && (
        <>
          <h3 className="stat-subtitle">{t.keepByFit}</h3>
          <HBars
            ariaLabel={t.keepByFit}
            max={100}
            format={fmtPct}
            rows={PASSUNG_STUFEN.map((st) => {
              const q = quote(w.nachPassung[st]);
              return { key: st, label: stufeLabel(st), value: q.value, note: t.ofN(w.nachPassung[st].gemerkt, q.n) };
            }).reverse()}
          />
          <h3 className="stat-subtitle">{t.keepByRing}</h3>
          <HBars
            ariaLabel={t.keepByRing}
            max={100}
            format={fmtPct}
            rows={STAT_RINGE.map((r) => {
              const q = quote(w.nachRing[r]);
              return { key: r, label: t.ring[r], value: q.value, note: t.ofN(w.nachRing[r].gemerkt, q.n) };
            })}
          />
          <Hint>{t.keepHint}</Hint>
        </>
      )}
    </>
  );
}
