// Demo-Backend: echte Beispielanzeigen aus der Recherche, alles bleibt im Browser.
// Probeläufe für neue Quellen und KI-Vorschläge werden nur nachgestellt (es wird nichts abgerufen).

import { normalizeText, siteKeyOf, siteLabel, type Bruecke, type City, type Favorite, type FavoriteKind, type Institution, type Job, type Mark, type RunInfo, type Source, type Suchprofil } from '@stellen/core';
import { horizontOf, truncate } from '@stellen/core';
import type { AcceptCheckBody, Backend, BootstrapData, CheckResult, Discovery, GateSkip, NewSourceBody, SourceCheck, SourcePatchBody, SourcesData, SyncPage } from './backend';
import { lsGet, lsSet } from './local';
import data from './demo-data.json';

interface DemoData {
  generatedAt: string;
  dates: string[];
  cities: City[];
  institutions: Institution[];
  sources: Source[];
  jobs: Job[];
}

const D = data as unknown as DemoData;
const KEY = 'sb.demo.v1';

interface DemoState {
  marks: Record<string, Mark>;
  favorites: Favorite[];
  settings: Record<string, unknown>;
  sources: Record<string, SourcePatchBody>;
  added?: Source[];
  checks?: SourceCheck[];
  discoveries?: Record<string, Discovery['status']>;
}

function load(): DemoState {
  return lsGet<DemoState>(KEY, { marks: {}, favorites: [], settings: {}, sources: {} });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Neu entdeckte Websites der Demo: aus den Beispielanzeigen, deren Arbeitgeber nicht im Register steht. */
function demoDiscoveries(): Discovery[] {
  const map = new Map<string, Discovery>();
  for (const j of D.jobs) {
    if (!j.newSite) continue;
    const key = siteKeyOf(j.url, j.employer);
    if (!key) continue;
    const d = map.get(key);
    if (d) d.jobs++;
    else map.set(key, { siteKey: key, name: j.employer ?? siteLabel(key), sampleUrl: j.url, jobs: 1, firstSeenAt: j.firstSeenAt, lastSeenAt: j.lastSeenAt, status: 'offen' });
  }
  return [...map.values()];
}

/** Nachgestellter Probelauf: echte Beispielanzeigen derselben Website, sonst ein ehrlich beschriftetes Beispiel. */
function demoCheckResult(url: string): CheckResult {
  const key = siteKeyOf(url);
  const own = D.jobs.filter((j) => key && siteKeyOf(j.url, j.employer) === key);
  const samples = (own.length ? own : D.jobs.slice(0, 3)).slice(0, 3).map((j) => ({
    url: j.url,
    title: j.title,
    chars: j.descriptionMd.length,
    complete: true,
    method: 'html',
    deadline: j.deadline ?? null,
    deadlineCheck: j.deadlineCheck ?? (j.deadline ? 'ok' : null),
    payGrade: j.payGrade ?? null,
    workload: j.workloadPct ? `${j.workloadPct} %` : (j.workloadText ?? null),
    kind: j.kind,
    excerpt: truncate(j.summary ?? '', 280),
    aiOk: true,
    problems: [],
  }));
  const inst = own[0]?.institutionId ? D.institutions.find((i) => i.id === own[0].institutionId) : undefined;
  const name = own[0]?.employer ?? inst?.name ?? null;
  return {
    url,
    listUrl: url,
    status: 'ok',
    methods: ['liste'],
    candidates: own.length || 3,
    candidateTitles: samples.map((x) => x.title),
    samples,
    config: {},
    institution: { id: inst?.id ?? null, name, cityId: own[0]?.cityId ?? null, kind: inst?.kind ?? (own.length ? 'sonstige' : null), website: (() => { try { return new URL(url).origin; } catch { return null; } })() },
    registered: null,
    kindGuess: 'zentral',
    gateGuess: 'psych',
    ai: {
      verdict: own.length ? 'gut' : 'mit_einschraenkungen',
      summary: own.length
        ? `Nachgestellt für die Demo: Die Seite listet aktuelle Stellen von ${name ?? 'dieser Einrichtung'}. In der eingerichteten App liest die Pipeline die Seite und ein paar Anzeigen wirklich, und die KI beurteilt das Ergebnis.`
        : 'Nachgestellt für die Demo: Diese Website wurde nicht abgerufen. Die Proben unten sind Beispielanzeigen aus der Demo und zeigen nur, wie ein Ergebnis aussieht.',
    },
    verdict: own.length ? 'gut' : 'mit_einschraenkungen',
    notes: ['Demo: Es wurde nichts abgerufen. Im echten Betrieb dauert ein Probelauf zwei bis vier Minuten.'],
    durationMs: 2400,
    checkedAt: new Date().toISOString(),
  };
}

/** Feste Vorschläge, damit sich die Funktion in der Demo ausprobieren lässt. */
const DEMO_BRIDGES: Omit<Bruecke, 'id'>[] = [
  { name: 'Medien & Öffentlichkeit', feld: ['medienforschung', 'kommunikationswissenschaft', 'journalismus', 'desinformation', 'social media', 'wissenschaftskommunikation'], anker: [], suche: ['Wissenschaftskommunikation', 'Medienforschung'], warum: 'Wie Menschen Informationen aufnehmen und bewerten, ist Kognitions- und Sozialpsychologie.', aktiv: true, herkunft: 'ki' },
  { name: 'Stadt & Beteiligung', feld: ['stadtplanung', 'quartiersentwicklung', 'buergerbeteiligung', 'partizipation', 'stadtforschung'], anker: [], suche: ['Bürgerbeteiligung', 'Quartiersmanagement Forschung'], warum: 'Beteiligungsverfahren brauchen Befragungen, Moderation und ein Gespür für Gruppen.', aktiv: true, herkunft: 'ki' },
  { name: 'Sport & Bewegung', feld: ['sportwissenschaft', 'bewegungsfoerderung', 'trainingswissenschaft', 'leistungsdiagnostik'], anker: [], suche: ['Sportpsychologie', 'Bewegungsförderung'], warum: 'Motivation, Gewohnheiten und Diagnostik sind dort zentrale Themen.', aktiv: true, herkunft: 'ki' },
];

export class DemoBackend implements Backend {
  readonly demo = true;
  private s = load();
  /** Wie oft nach einem Probelauf gefragt wurde (er ist nach zwei Abfragen „fertig“). */
  private polls = new Map<number, number>();

  private save(): void {
    lsSet(KEY, this.s);
  }

  async bootstrap(): Promise<BootstrapData> {
    const enabled = D.sources.filter((x) => x.enabled);
    return {
      institutions: D.institutions,
      cities: D.cities,
      marks: Object.values(this.s.marks),
      favorites: this.s.favorites,
      settings: this.s.settings,
      runs: [],
      sourceSummary: {
        total: enabled.length + (this.s.added?.length ?? 0),
        ok: 0,
        problems: 0,
        missingUrl: enabled.filter((x) => !x.url).length,
      },
      serverTime: new Date().toISOString(),
      vapidPublicKey: null,
      ingestTrigger: false,
      aiSuggest: true,
    };
  }

  async sync(cursor: string): Promise<SyncPage> {
    return { jobs: cursor ? [] : D.jobs, next: null, deleted: [], serverTime: new Date().toISOString() };
  }

  async putMarks(marks: Mark[]): Promise<void> {
    for (const m of marks) this.s.marks[m.jobId] = m;
    this.save();
  }

  async putFavorite(kind: FavoriteKind, ref: string, on: boolean): Promise<void> {
    this.s.favorites = this.s.favorites.filter((f) => !(f.kind === kind && f.ref === ref));
    if (on) this.s.favorites.push({ kind, ref });
    this.save();
  }

  async putSetting(key: string, value: unknown): Promise<void> {
    this.s.settings[key] = value;
    this.save();
  }

  async sources(): Promise<SourcesData> {
    const status = this.s.discoveries ?? {};
    return {
      sources: [...D.sources.map((x) => ({ ...x, ...(this.s.sources[x.id] ?? {}), config: x.config }) as Source), ...(this.s.added ?? [])],
      suggestions: [],
      browserQueue: {},
      checks: [...(this.s.checks ?? [])].reverse().map((c) => this.settle(c)),
      discoveries: demoDiscoveries()
        .map((d) => ({ ...d, status: status[d.siteKey] ?? d.status }))
        .filter((d) => d.status === 'offen'),
    };
  }

  /** Nach ein paar Sekunden (oder zwei Abfragen) ist der nachgestellte Probelauf „fertig“. */
  private settle(c: SourceCheck): SourceCheck {
    if (c.status === 'laeuft' && (Date.now() - Date.parse(c.requestedAt) > 2400 || (this.polls.get(c.id) ?? 0) >= 2)) {
      const done: SourceCheck = { ...c, status: 'fertig', finishedAt: new Date().toISOString(), result: demoCheckResult(c.url) };
      this.s.checks = (this.s.checks ?? []).map((x) => (x.id === c.id ? done : x));
      this.save();
      return done;
    }
    return c;
  }

  async patchSource(id: string, patch: SourcePatchBody): Promise<void> {
    this.s.sources[id] = { ...(this.s.sources[id] ?? {}), ...patch };
    this.save();
  }

  async addSource(_body: NewSourceBody): Promise<void> {
    throw new Error('In der Demo werden Quellen über den Probelauf angelegt.');
  }

  async resolveSuggestion(): Promise<void> {
    return undefined;
  }

  async checkSource(url: string, sourceId?: string): Promise<{ check: SourceCheck; started: boolean }> {
    const now = new Date().toISOString();
    const check: SourceCheck = { id: Date.now(), url, sourceId: sourceId ?? null, status: 'laeuft', requestedAt: now, startedAt: now, finishedAt: null, result: null, error: null };
    this.s.checks = [...(this.s.checks ?? []).slice(-9), check];
    this.save();
    return { check, started: true };
  }

  async getCheck(id: number): Promise<SourceCheck> {
    await wait(150);
    this.polls.set(id, (this.polls.get(id) ?? 0) + 1);
    const c = (this.s.checks ?? []).find((x) => x.id === id);
    if (!c) throw new Error('Probelauf nicht gefunden.');
    return this.settle(c);
  }

  async acceptCheck(id: number, body: AcceptCheckBody): Promise<void> {
    const c = (this.s.checks ?? []).find((x) => x.id === id);
    if (!c?.result) throw new Error('Der Probelauf ist noch nicht fertig.');
    const name = body.institution?.name ?? D.institutions.find((i) => i.id === body.institutionId)?.name ?? 'Neue Quelle';
    const src: Source = {
      id: `demo-${normalizeText(name).replace(/ /g, '-').slice(0, 30)}-${Date.now().toString(36)}`,
      institutionId: body.institutionId ?? null,
      kind: body.kind,
      label: body.label ?? name,
      url: body.url ?? c.result.listUrl,
      adapter: 'auto',
      config: { ...c.result.config, note: 'In der Demo per nachgestelltem Probelauf angelegt.' },
      gate: body.gate,
      enabled: true,
      verified: true,
      status: 'neu',
      consecutiveFailures: 0,
    };
    this.s.added = [...(this.s.added ?? []), src];
    this.s.checks = (this.s.checks ?? []).map((x) => (x.id === id ? { ...x, status: 'uebernommen' } : x));
    const key = siteKeyOf(c.url);
    if (key) this.s.discoveries = { ...(this.s.discoveries ?? {}), [key]: 'uebernommen' };
    this.save();
  }

  async discardCheck(id: number): Promise<void> {
    this.s.checks = (this.s.checks ?? []).map((x) => (x.id === id ? { ...x, status: 'verworfen' } : x));
    this.save();
  }

  async setDiscoveryStatus(siteKey: string, status: Discovery['status']): Promise<void> {
    this.s.discoveries = { ...(this.s.discoveries ?? {}), [siteKey]: status };
    this.save();
  }

  async suggestBridges(profile: Suchprofil): Promise<Bruecke[]> {
    await wait(900);
    const have = new Set(horizontOf(profile).bruecken.map((b) => b.name.toLowerCase()));
    return DEMO_BRIDGES.filter((b) => !have.has(b.name.toLowerCase())).map((b, i) => ({ ...b, id: `hk${Date.now().toString(36)}${i}` }));
  }

  async runs(): Promise<RunInfo[]> {
    return [];
  }

  async runLog(): Promise<string> {
    return '';
  }

  async skips(): Promise<GateSkip[]> {
    return [];
  }

  async pushSubscribe(): Promise<void> {
    throw new Error('Benachrichtigungen gibt es nur in der eingerichteten App.');
  }

  async pushUnsubscribe(): Promise<void> {
    return undefined;
  }

  async triggerIngest(): Promise<void> {
    throw new Error('In der Demo wird nicht eingesammelt.');
  }
}

export const DEMO_DATE = D.generatedAt;
export const DEMO_DATES = D.dates ?? [D.generatedAt];
