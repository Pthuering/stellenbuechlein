// Schnittstelle zwischen App und Server – echte API (api.ts) oder Demo (demo.ts).

import type { Bruecke, City, DeadlineCheck, Favorite, FavoriteKind, Institution, InstitutionKind, Job, JobKind, Mark, RunInfo, Source, SourceConfig, SourceStatus, Suchprofil } from '@stellen/core';

export interface SourceSummary {
  total: number;
  ok: number;
  problems: number;
  missingUrl: number;
}

export interface BootstrapData {
  institutions: Institution[];
  cities: City[];
  marks: Mark[];
  favorites: Favorite[];
  settings: Record<string, unknown>;
  runs: RunInfo[];
  sourceSummary: SourceSummary | null;
  serverTime: string;
  vapidPublicKey: string | null;
  ingestTrigger: boolean;
  /** KI im Worker eingerichtet (Brücken-Vorschläge) */
  aiSuggest?: boolean;
}

export interface SyncPage {
  jobs: Job[];
  next: string | null;
  deleted: string[];
  serverTime: string;
}

export interface Suggestion {
  id: number;
  institutionId: string;
  url: string;
  reason: string | null;
  foundAt: string;
}

/** Neu entdeckte Website oder neuer Arbeitgeber (nicht im Register). */
export interface Discovery {
  siteKey: string;
  name: string | null;
  sampleUrl: string | null;
  jobs: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: 'offen' | 'geprueft' | 'uebernommen' | 'ignoriert';
}

export type CheckVerdict = 'gut' | 'mit_einschraenkungen' | 'ungeeignet';

export interface CheckSample {
  url: string;
  title: string;
  chars: number;
  complete: boolean;
  method: string;
  deadline: string | null;
  deadlineCheck: DeadlineCheck | null;
  payGrade: string | null;
  workload: string | null;
  kind: JobKind | null;
  excerpt: string;
  aiOk: boolean | null;
  problems: string[];
}

/** Ergebnis eines Probelaufs (gleiche Form wie in apps/ingest/src/sourceCheck.ts). */
export interface CheckResult {
  url: string;
  listUrl: string;
  status: SourceStatus;
  methods: string[];
  candidates: number;
  candidateTitles: string[];
  samples: CheckSample[];
  config: SourceConfig;
  institution: { id: string | null; name: string | null; cityId: string | null; kind: InstitutionKind | null; website: string | null };
  registered: { sourceId: string; label: string | null; url: string | null } | null;
  kindGuess: 'fachbereich' | 'zentral';
  gateGuess: 'none' | 'psych';
  ai: { verdict: CheckVerdict; summary: string } | null;
  verdict: CheckVerdict;
  notes: string[];
  durationMs: number;
  checkedAt: string;
}

export interface SourceCheck {
  id: number;
  url: string;
  sourceId: string | null;
  status: 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'uebernommen' | 'verworfen';
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: CheckResult | null;
  error: string | null;
}

export interface AcceptCheckBody {
  institutionId?: string;
  institution?: { name: string; cityId: string; kind: InstitutionKind; website?: string };
  kind: 'zentral' | 'fachbereich' | 'portal';
  gate: 'none' | 'psych';
  label?: string;
  url?: string;
}

export interface SourcesData {
  sources: Source[];
  suggestions: Suggestion[];
  browserQueue: Record<string, number>;
  checks: SourceCheck[];
  discoveries: Discovery[];
}

export interface GateSkip {
  url: string;
  title: string | null;
  sourceId: string | null;
  institutionId: string | null;
  seenAt: string;
  /** grobfilter | ki-nein */
  reason?: string | null;
  note?: string | null;
}

export interface SourcePatchBody {
  url?: string | null;
  enabled?: boolean;
  gate?: 'none' | 'psych';
  label?: string | null;
  verified?: boolean;
  config?: SourceConfig;
}

export interface NewSourceBody {
  institutionId?: string;
  institution?: { name: string; cityId: string; kind: Institution['kind']; website?: string };
  url: string;
  kind: 'zentral' | 'fachbereich' | 'portal';
  label?: string;
  gate?: 'none' | 'psych';
}

export interface Backend {
  readonly demo: boolean;
  bootstrap(): Promise<BootstrapData>;
  sync(cursor: string, deletedSince: string): Promise<SyncPage>;
  putMarks(marks: Mark[]): Promise<void>;
  putFavorite(kind: FavoriteKind, ref: string, on: boolean): Promise<void>;
  putSetting(key: string, value: unknown): Promise<void>;
  sources(): Promise<SourcesData>;
  patchSource(id: string, patch: SourcePatchBody): Promise<void>;
  addSource(body: NewSourceBody): Promise<void>;
  resolveSuggestion(id: number, accept: boolean): Promise<void>;
  /** Probelauf für eine Website starten; started = sofort per GitHub-Workflow, sonst beim nächsten Lauf. */
  checkSource(url: string, sourceId?: string): Promise<{ check: SourceCheck; started: boolean }>;
  getCheck(id: number): Promise<SourceCheck>;
  acceptCheck(id: number, body: AcceptCheckBody): Promise<void>;
  discardCheck(id: number): Promise<void>;
  setDiscoveryStatus(siteKey: string, status: Discovery['status']): Promise<void>;
  /** Brücken-Vorschläge der KI (nur, wenn der Worker einen KI-Schlüssel hat). */
  suggestBridges(profile: Suchprofil): Promise<Bruecke[]>;
  runs(): Promise<RunInfo[]>;
  runLog(id: number): Promise<string>;
  skips(): Promise<GateSkip[]>;
  pushSubscribe(sub: PushSubscriptionJSON): Promise<void>;
  pushUnsubscribe(endpoint: string): Promise<void>;
  triggerIngest(): Promise<void>;
}

/** Schlüssel falsch oder fehlt. */
export class AuthError extends Error {
  constructor(message = 'Der App-Schlüssel stimmt nicht.') {
    super(message);
    this.name = 'AuthError';
  }
}

/** Server nicht erreichbar (offline). */
export class OfflineError extends Error {
  constructor(message = 'Keine Verbindung zum Server.') {
    super(message);
    this.name = 'OfflineError';
  }
}
