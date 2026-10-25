// Echte API über HTTP (gleiche Herkunft wie die App).

import type { AssistantMessage, AssistantStepResult, Bruecke, FavoriteKind, KiUsageReport, Mark, RunInfo, Suchprofil } from '@stellen/core';
import {
  AuthError,
  OfflineError,
  type AcceptCheckBody,
  type Backend,
  type BootstrapData,
  type Discovery,
  type GateSkip,
  type NewSourceBody,
  type SourceCheck,
  type SourcePatchBody,
  type SourcesData,
  type SyncPage,
} from './backend';
import { texts } from '../i18n';

const t = texts({
  de: { serverStatus: (status: number) => `Server antwortet mit ${status}.` },
  en: { serverStatus: (status) => `The server responded with ${status}.` },
  sr: { serverStatus: (status) => `Server odgovara kodom ${status}.` },
});

export class HttpBackend implements Backend {
  readonly demo = false;

  constructor(
    private readonly key: string,
    private readonly base = '',
  ) {}

  private async call<T>(path: string, init: RequestInit = {}, asText = false): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
      });
    } catch {
      throw new OfflineError();
    }
    if (res.status === 401) throw new AuthError();
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? t.serverStatus(res.status));
    }
    return (asText ? await res.text() : await res.json()) as T;
  }

  bootstrap(): Promise<BootstrapData> {
    return this.call('/api/bootstrap');
  }

  sync(cursor: string, deletedSince: string): Promise<SyncPage> {
    const q = new URLSearchParams({ cursor, deletedSince, limit: '80' });
    return this.call(`/api/sync?${q}`);
  }

  async putMarks(marks: Mark[]): Promise<void> {
    if (marks.length === 0) return;
    await this.call('/api/marks/batch', { method: 'POST', body: JSON.stringify({ marks }) });
  }

  async putFavorite(kind: FavoriteKind, ref: string, on: boolean): Promise<void> {
    await this.call('/api/favorites', { method: 'PUT', body: JSON.stringify({ kind, ref, on }) });
  }

  async putSetting(key: string, value: unknown): Promise<void> {
    await this.call(`/api/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) });
  }

  sources(): Promise<SourcesData> {
    return this.call('/api/sources');
  }

  async patchSource(id: string, patch: SourcePatchBody): Promise<void> {
    await this.call(`/api/sources/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  async addSource(body: NewSourceBody): Promise<void> {
    await this.call('/api/sources', { method: 'POST', body: JSON.stringify(body) });
  }

  async resolveSuggestion(id: number, accept: boolean): Promise<void> {
    await this.call(`/api/suggestions/${id}`, { method: 'POST', body: JSON.stringify({ accept }) });
  }

  checkSource(url: string, sourceId?: string): Promise<{ check: SourceCheck; started: boolean }> {
    return this.call('/api/sources/checks', { method: 'POST', body: JSON.stringify({ url, sourceId }) });
  }

  async getCheck(id: number): Promise<SourceCheck> {
    return (await this.call<{ check: SourceCheck }>(`/api/sources/checks/${id}`)).check;
  }

  async acceptCheck(id: number, body: AcceptCheckBody): Promise<void> {
    await this.call(`/api/sources/checks/${id}/accept`, { method: 'POST', body: JSON.stringify(body) });
  }

  async discardCheck(id: number): Promise<void> {
    await this.call(`/api/sources/checks/${id}/discard`, { method: 'POST' });
  }

  async setDiscoveryStatus(siteKey: string, status: Discovery['status']): Promise<void> {
    await this.call('/api/discoveries/status', { method: 'POST', body: JSON.stringify({ siteKey, status }) });
  }

  async suggestBridges(profile: Suchprofil): Promise<Bruecke[]> {
    return (await this.call<{ bruecken: Bruecke[] }>('/api/horizont/vorschlaege', { method: 'POST', body: JSON.stringify({ profile }) })).bruecken;
  }

  async runs(): Promise<RunInfo[]> {
    return (await this.call<{ runs: RunInfo[] }>('/api/runs')).runs;
  }

  runLog(id: number): Promise<string> {
    return this.call(`/api/runs/${id}/log`, {}, true);
  }

  async skips(): Promise<GateSkip[]> {
    return (await this.call<{ skips: GateSkip[] }>('/api/skips')).skips;
  }

  async pushSubscribe(sub: PushSubscriptionJSON): Promise<void> {
    await this.call('/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
  }

  async pushUnsubscribe(endpoint: string): Promise<void> {
    await this.call('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
  }

  async triggerIngest(gross = false): Promise<void> {
    await this.call('/api/ingest/trigger', { method: 'POST', body: JSON.stringify({ gross }) });
  }

  assistantStep(messages: AssistantMessage[], final: boolean, signal?: AbortSignal): Promise<AssistantStepResult> {
    return this.call('/api/ki/schritt', { method: 'POST', body: JSON.stringify({ messages, final }), signal });
  }

  kiUsage(): Promise<KiUsageReport> {
    return this.call('/api/ki/verbrauch');
  }
}
