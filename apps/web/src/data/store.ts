// Zentraler Zustand der App: Anzeigen, Markierungen, Lieblingsorte, Einstellungen.
// Offline zuerst: Alles liegt im Browser-Zwischenspeicher, Änderungen gehen über eine Warteschlange
// an den Server, sobald er erreichbar ist.

import {
  DEFAULT_FILTER,
  DEFAULT_HOME,
  DEFAULT_GATE_TERMS,
  DEFAULT_HIGH_SCORE_ALERT,
  DEFAULT_REMINDER_DAYS,
  parseHighScoreAlert,
  parseProfile,
  parseUmfrage,
  starterProfile,
  type City,
  type Decision,
  type Favorite,
  type FavoriteKind,
  type HighScoreAlert,
  type HomeLocation,
  type Institution,
  type Job,
  type JobFilter,
  type Mark,
  type RunInfo,
  type SortKey,
  type Suchprofil,
  type UmfrageStand,
} from '@stellen/core';
import { AuthError, OfflineError, type Backend, type SourceSummary } from './backend';
import { idbGet, idbSet, lsGet, lsSet } from './local';

export type SavedSort = 'frist' | 'score' | 'neu' | 'ort';

export interface Settings {
  profile: Suchprofil;
  filter: JobFilter;
  home: HomeLocation;
  reminders: { days: number[]; push: boolean };
  /** Benachrichtigung, wenn ein Lauf neue Anzeigen ab min Prozent bringt */
  notifyHighScore: HighScoreAlert;
  gateTerms: string[];
  sort: { all: SortKey; saved: SavedSort };
  /** cardImages: Fotos bzw. Skizze auf den Karten im Stapel zeigen */
  ui: { mapMode: 'gemerkt' | 'alle'; cardImages: boolean };
  /** Platzhalter-Checkliste: von Hand abgehakte Punkte, Leiste oben ausgeblendet */
  checklist: { done: string[]; hideBanner: boolean };
  /** Umfrage für das Suchprofil: Antworten und Seite zum Weitermachen */
  umfrage: UmfrageStand | null;
}

export function defaultSettings(): Settings {
  return {
    profile: starterProfile(),
    filter: DEFAULT_FILTER,
    home: DEFAULT_HOME,
    reminders: { days: DEFAULT_REMINDER_DAYS, push: true },
    notifyHighScore: DEFAULT_HIGH_SCORE_ALERT,
    gateTerms: DEFAULT_GATE_TERMS,
    sort: { all: 'empfohlen', saved: 'frist' },
    ui: { mapMode: 'gemerkt', cardImages: true },
    checklist: { done: [], hideBanner: false },
    umfrage: null,
  };
}

function settingsFrom(raw: Record<string, unknown>, base = defaultSettings()): Settings {
  const s = { ...base };
  const profile = parseProfile(raw.profile);
  if (profile) s.profile = profile;
  if (raw.filter && typeof raw.filter === 'object') s.filter = { ...DEFAULT_FILTER, ...(raw.filter as Partial<JobFilter>) };
  if (raw.home && typeof raw.home === 'object' && typeof (raw.home as HomeLocation).lat === 'number') s.home = raw.home as HomeLocation;
  if (raw.reminders && typeof raw.reminders === 'object') s.reminders = { ...s.reminders, ...(raw.reminders as Settings['reminders']) };
  if (raw.notifyHighScore !== undefined) s.notifyHighScore = parseHighScoreAlert(raw.notifyHighScore);
  if (Array.isArray(raw.gateTerms) && raw.gateTerms.length) s.gateTerms = raw.gateTerms as string[];
  if (raw.sort && typeof raw.sort === 'object') s.sort = { ...s.sort, ...(raw.sort as Settings['sort']) };
  if (raw.ui && typeof raw.ui === 'object') s.ui = { ...s.ui, ...(raw.ui as Settings['ui']) };
  if (raw.checklist && typeof raw.checklist === 'object') {
    const c = raw.checklist as Partial<Settings['checklist']>;
    s.checklist = { done: Array.isArray(c.done) ? c.done.filter((x): x is string => typeof x === 'string') : [], hideBanner: c.hideBanner === true };
  }
  if (raw.umfrage !== undefined) s.umfrage = parseUmfrage(raw.umfrage);
  return s;
}

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export interface State {
  phase: 'loading' | 'login' | 'ready';
  demo: boolean;
  jobs: Map<string, Job>;
  institutions: Map<string, Institution>;
  cities: Map<string, City>;
  marks: Map<string, Mark>;
  favorites: Favorite[];
  settings: Settings;
  sync: { cursor: string; lastSyncAt: string | null; busy: boolean; error: string | null };
  runs: RunInfo[];
  sourceSummary: SourceSummary | null;
  vapidPublicKey: string | null;
  ingestTrigger: boolean;
  aiSuggest: boolean;
  pending: number;
  toasts: Toast[];
  undo: { jobId: string; prev: Mark | null }[];
  /** Zählt jede Änderung an Anzeigen/Markierungen/Einstellungen (für Memos). */
  rev: number;
}

type Write =
  | { t: 'mark'; mark: Mark }
  | { t: 'fav'; kind: FavoriteKind; ref: string; on: boolean }
  | { t: 'setting'; key: string; value: unknown };

const QUEUE_KEY = 'sb.queue';
const CACHE_JOBS = 'jobs.v1';
const CACHE_META = 'meta.v1';
const CACHE_BOOT = 'boot.v1';

interface CachedBoot {
  institutions: Institution[];
  cities: City[];
  marks: Mark[];
  favorites: Favorite[];
  settings: Record<string, unknown>;
  runs: RunInfo[];
  sourceSummary: SourceSummary | null;
  vapidPublicKey: string | null;
  ingestTrigger: boolean;
  aiSuggest?: boolean;
}

export class Store {
  private listeners = new Set<() => void>();
  private queue: Write[] = lsGet<Write[]>(QUEUE_KEY, []);
  private flushing = false;
  private toastId = 0;
  state: State;

  constructor(
    private backend: Backend | null,
    demo: boolean,
  ) {
    this.state = {
      phase: backend ? 'loading' : 'login',
      demo,
      jobs: new Map(),
      institutions: new Map(),
      cities: new Map(),
      marks: new Map(),
      favorites: [],
      settings: defaultSettings(),
      sync: { cursor: '', lastSyncAt: null, busy: false, error: null },
      runs: [],
      sourceSummary: null,
      vapidPublicKey: null,
      ingestTrigger: false,
      aiSuggest: false,
      pending: this.queue.length,
      toasts: [],
      undo: [],
      rev: 0,
    };
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = (): State => this.state;

  private set(patch: Partial<State>, bumpRev = false): void {
    this.state = { ...this.state, ...patch, rev: bumpRev ? this.state.rev + 1 : this.state.rev };
    for (const l of this.listeners) l();
  }

  get api(): Backend {
    if (!this.backend) throw new AuthError('Kein App-Schlüssel hinterlegt.');
    return this.backend;
  }

  setBackend(b: Backend): void {
    this.backend = b;
    this.set({ phase: 'loading' });
    void this.init();
  }

  // ---------------------------------------------------------------- Laden und Abgleich

  async init(): Promise<void> {
    if (!this.backend) return;
    const cacheKey = (k: string) => `${this.state.demo ? 'demo.' : ''}${k}`;
    const [jobs, meta, boot] = await Promise.all([
      idbGet<Job[]>(cacheKey(CACHE_JOBS)),
      idbGet<{ cursor: string; lastSyncAt: string | null }>(cacheKey(CACHE_META)),
      idbGet<CachedBoot>(cacheKey(CACHE_BOOT)),
    ]);
    if (jobs && boot && !this.state.demo) {
      this.applyBoot(boot);
      this.set(
        {
          jobs: new Map(jobs.map((j) => [j.id, j])),
          sync: { ...this.state.sync, cursor: meta?.cursor ?? '', lastSyncAt: meta?.lastSyncAt ?? null },
          phase: 'ready',
        },
        true,
      );
    }
    await this.refresh();
    window.addEventListener('online', () => void this.flush());
    window.setInterval(() => {
      if (this.queue.length) void this.flush();
    }, 60_000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const last = this.state.sync.lastSyncAt ? Date.parse(this.state.sync.lastSyncAt) : 0;
      if (Date.now() - last > 5 * 60_000) void this.refresh();
    });
  }

  private applyBoot(b: CachedBoot): void {
    const marks = new Map(b.marks.map((m) => [m.jobId, m]));
    // Noch nicht gesendete Änderungen haben Vorrang vor dem Serverstand.
    let favorites = b.favorites;
    const settingsRaw = { ...b.settings };
    for (const w of this.queue) {
      if (w.t === 'mark') marks.set(w.mark.jobId, w.mark);
      if (w.t === 'fav') favorites = [...favorites.filter((f) => !(f.kind === w.kind && f.ref === w.ref)), ...(w.on ? [{ kind: w.kind, ref: w.ref }] : [])];
      if (w.t === 'setting') settingsRaw[w.key] = w.value;
    }
    this.set(
      {
        institutions: new Map(b.institutions.map((i) => [i.id, i])),
        cities: new Map(b.cities.map((c) => [c.id, c])),
        marks,
        favorites,
        settings: settingsFrom(settingsRaw),
        runs: b.runs,
        sourceSummary: b.sourceSummary,
        vapidPublicKey: b.vapidPublicKey,
        ingestTrigger: b.ingestTrigger,
        aiSuggest: !!b.aiSuggest,
      },
      true,
    );
  }

  async refresh(): Promise<void> {
    if (!this.backend || this.state.sync.busy) return;
    this.set({ sync: { ...this.state.sync, busy: true, error: null } });
    try {
      await this.flush();
      const boot = await this.backend.bootstrap();
      const cached: CachedBoot = {
        institutions: boot.institutions,
        cities: boot.cities,
        marks: boot.marks,
        favorites: boot.favorites,
        settings: boot.settings,
        runs: boot.runs,
        sourceSummary: boot.sourceSummary,
        vapidPublicKey: boot.vapidPublicKey,
        ingestTrigger: boot.ingestTrigger,
        aiSuggest: !!boot.aiSuggest,
      };
      this.applyBoot(cached);
      const jobs = new Map(this.state.jobs);
      let cursor = this.state.sync.cursor;
      const deletedSince = this.state.sync.lastSyncAt ?? '';
      let serverTime = boot.serverTime;
      for (let i = 0; i < 200; i++) {
        const page = await this.backend.sync(cursor, deletedSince);
        for (const j of page.jobs) jobs.set(j.id, j);
        if (i === 0) for (const id of page.deleted) jobs.delete(id);
        serverTime = page.serverTime;
        if (page.jobs.length) cursor = `${page.jobs[page.jobs.length - 1].updatedAt}|${page.jobs[page.jobs.length - 1].id}`;
        if (!page.next) break;
      }
      this.set({ jobs, phase: 'ready', sync: { cursor, lastSyncAt: serverTime, busy: false, error: null } }, true);
      const ck = (k: string) => `${this.state.demo ? 'demo.' : ''}${k}`;
      void idbSet(ck(CACHE_JOBS), [...jobs.values()]);
      void idbSet(ck(CACHE_META), { cursor, lastSyncAt: serverTime });
      void idbSet(ck(CACHE_BOOT), cached);
    } catch (e) {
      if (e instanceof AuthError) {
        this.set({ phase: 'login', sync: { ...this.state.sync, busy: false, error: e.message } });
        return;
      }
      const msg = e instanceof OfflineError ? 'Offline – zeige gespeicherten Stand.' : e instanceof Error ? e.message : String(e);
      this.set({ phase: this.state.jobs.size || this.state.institutions.size ? 'ready' : this.state.phase === 'loading' ? 'ready' : this.state.phase, sync: { ...this.state.sync, busy: false, error: msg } });
    }
  }

  // ---------------------------------------------------------------- Warteschlange

  private enqueue(w: Write): void {
    // Gleiche Ziele zusammenfassen (nur der letzte Stand zählt)
    this.queue = this.queue.filter((q) => {
      if (q.t === 'mark' && w.t === 'mark') return q.mark.jobId !== w.mark.jobId;
      if (q.t === 'fav' && w.t === 'fav') return !(q.kind === w.kind && q.ref === w.ref);
      if (q.t === 'setting' && w.t === 'setting') return q.key !== w.key;
      return true;
    });
    this.queue.push(w);
    lsSet(QUEUE_KEY, this.queue);
    this.set({ pending: this.queue.length });
    void this.flush();
  }

  async flush(): Promise<void> {
    if (!this.backend || this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    let failed = false;
    try {
      const marks = this.queue.filter((q): q is Extract<Write, { t: 'mark' }> => q.t === 'mark').map((q) => q.mark);
      if (marks.length) await this.backend.putMarks(marks);
      this.queue = this.queue.filter((q) => q.t !== 'mark' || !marks.includes(q.mark));
      lsSet(QUEUE_KEY, this.queue);
      for (const w of [...this.queue]) {
        if (w.t === 'fav') await this.backend.putFavorite(w.kind, w.ref, w.on);
        if (w.t === 'setting') await this.backend.putSetting(w.key, w.value);
        this.queue = this.queue.filter((q) => q !== w);
        lsSet(QUEUE_KEY, this.queue);
      }
    } catch (e) {
      failed = true;
      if (e instanceof AuthError) this.set({ phase: 'login' });
    } finally {
      this.flushing = false;
      this.set({ pending: this.queue.length });
      // Was während des Sendens dazukam, gleich hinterherschicken (bei Fehlern erst beim nächsten Anlass)
      if (!failed && this.queue.length) window.setTimeout(() => void this.flush(), 400);
    }
  }

  // ---------------------------------------------------------------- Markierungen

  private writeMark(jobId: string, patch: Partial<Mark>, rememberUndo = false): Mark {
    const prev = this.state.marks.get(jobId) ?? null;
    const now = new Date().toISOString();
    const mark: Mark = {
      jobId,
      decision: prev?.decision ?? null,
      decidedAt: prev?.decidedAt ?? null,
      star: prev?.star ?? false,
      appliedAt: prev?.appliedAt ?? null,
      note: prev?.note ?? null,
      ...patch,
      updatedAt: now,
    };
    const marks = new Map(this.state.marks);
    marks.set(jobId, mark);
    const undo = rememberUndo ? [...this.state.undo.slice(-19), { jobId, prev }] : this.state.undo;
    this.set({ marks, undo }, true);
    this.enqueue({ t: 'mark', mark });
    return mark;
  }

  decide(jobId: string, decision: Decision | null): void {
    this.writeMark(jobId, { decision, decidedAt: decision ? new Date().toISOString() : null, ...(decision === 'abgelehnt' ? { star: false } : {}) }, true);
  }

  /** Herzensjob: merkt die Anzeige automatisch mit. */
  setStar(jobId: string, star: boolean, rememberUndo = false): void {
    const prev = this.state.marks.get(jobId);
    const patch: Partial<Mark> = { star };
    if (star && prev?.decision !== 'gemerkt') Object.assign(patch, { decision: 'gemerkt', decidedAt: new Date().toISOString() });
    this.writeMark(jobId, patch, rememberUndo);
  }

  setApplied(jobId: string, applied: boolean): void {
    const prev = this.state.marks.get(jobId);
    const patch: Partial<Mark> = { appliedAt: applied ? new Date().toISOString() : null };
    if (applied && prev?.decision !== 'gemerkt') Object.assign(patch, { decision: 'gemerkt', decidedAt: new Date().toISOString() });
    this.writeMark(jobId, patch);
  }

  setNote(jobId: string, note: string): void {
    this.writeMark(jobId, { note: note.trim() ? note : null });
  }

  undo(): string | null {
    const last = this.state.undo[this.state.undo.length - 1];
    if (!last) return null;
    const marks = new Map(this.state.marks);
    const now = new Date().toISOString();
    const restored: Mark = last.prev
      ? { ...last.prev, updatedAt: now }
      : { jobId: last.jobId, decision: null, decidedAt: null, star: false, appliedAt: null, note: null, updatedAt: now };
    marks.set(last.jobId, restored);
    this.set({ marks, undo: this.state.undo.slice(0, -1) }, true);
    this.enqueue({ t: 'mark', mark: restored });
    return last.jobId;
  }

  // ---------------------------------------------------------------- Lieblingsorte und Einstellungen

  isFavorite(kind: FavoriteKind, ref: string): boolean {
    return this.state.favorites.some((f) => f.kind === kind && f.ref === ref);
  }

  setFavorite(kind: FavoriteKind, ref: string, on: boolean): void {
    const favorites = this.state.favorites.filter((f) => !(f.kind === kind && f.ref === ref));
    if (on) favorites.push({ kind, ref });
    this.set({ favorites }, true);
    this.enqueue({ t: 'fav', kind, ref, on });
  }

  updateSettings<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.set({ settings: { ...this.state.settings, [key]: value } }, true);
    this.enqueue({ t: 'setting', key, value });
  }

  // ---------------------------------------------------------------- Meldungen

  toast(text: string, action?: Toast['action'], ms = 4500): void {
    const id = ++this.toastId;
    this.set({ toasts: [{ id, text, action }] });
    window.setTimeout(() => this.dismissToast(id), ms);
  }

  dismissToast(id: number): void {
    this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }
}
