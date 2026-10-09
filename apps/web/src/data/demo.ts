// Demo-Backend: echte Beispielanzeigen aus der Recherche, alles bleibt im Browser.

import type { City, Favorite, FavoriteKind, Institution, Job, Mark, RunInfo, Source } from '@stellen/core';
import type { Backend, BootstrapData, GateSkip, NewSourceBody, SourcePatchBody, SourcesData, SyncPage } from './backend';
import { lsGet, lsSet } from './local';
import data from './demo-data.json';

interface DemoData {
  generatedAt: string;
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
}

function load(): DemoState {
  return lsGet<DemoState>(KEY, { marks: {}, favorites: [], settings: {}, sources: {} });
}

export class DemoBackend implements Backend {
  readonly demo = true;
  private s = load();

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
        total: enabled.length,
        ok: 0,
        problems: 0,
        missingUrl: enabled.filter((x) => !x.url).length,
      },
      serverTime: new Date().toISOString(),
      vapidPublicKey: null,
      ingestTrigger: false,
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
    return {
      sources: D.sources.map((x) => ({ ...x, ...(this.s.sources[x.id] ?? {}), config: x.config }) as Source),
      suggestions: [],
      browserQueue: {},
    };
  }

  async patchSource(id: string, patch: SourcePatchBody): Promise<void> {
    this.s.sources[id] = { ...(this.s.sources[id] ?? {}), ...patch };
    this.save();
  }

  async addSource(_body: NewSourceBody): Promise<void> {
    throw new Error('In der Demo können keine Quellen angelegt werden.');
  }

  async resolveSuggestion(): Promise<void> {
    return undefined;
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
