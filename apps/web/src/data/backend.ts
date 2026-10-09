// Schnittstelle zwischen App und Server – echte API (api.ts) oder Demo (demo.ts).

import type { City, Favorite, FavoriteKind, Institution, Job, Mark, RunInfo, Source, SourceConfig } from '@stellen/core';

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

export interface SourcesData {
  sources: Source[];
  suggestions: Suggestion[];
  browserQueue: Record<string, number>;
}

export interface GateSkip {
  url: string;
  title: string | null;
  sourceId: string | null;
  institutionId: string | null;
  seenAt: string;
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
