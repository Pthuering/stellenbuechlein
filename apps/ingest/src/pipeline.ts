// Ein kompletter Einsammel-Lauf:
//   Probeläufe für neue Quellen → Bilder → Stellenseiten-Suche → alle Quellen (Einrichtungen, dann Portale)
//   → Erkundung (Anzeigen von Websites, die noch nicht im Register stehen) → Browser-Warteschlange
//   → Ablauf/Aufräumen → Fristen-Erinnerungen.
//
// Jede neue Anzeige bekommt einen Ring: Kern (Psychologie-Bezug), Horizont (Brücke aus dem Suchprofil,
// von der KI auf Plausibilität geprüft) oder Weite (keine Brücke, aber die KI hält die Fähigkeiten für
// übertragbar). Fristen werden auf Plausibilität geprüft und bei Zweifeln von der KI im Text nachgesehen.

import {
  addDays,
  assessDeadline,
  canonicalUrl,
  checkGate,
  classifyKind,
  cleanTitleForKey,
  contentHash,
  detectLanguage,
  extractFields,
  fuzzyKey,
  hash64,
  heuristicSummary,
  horizonGateHash,
  horizontOf,
  isThematic,
  jobIdForUrl,
  matchBridges,
  matchFeld,
  normalizeText,
  parseProfile,
  profileSummary,
  scoreJob,
  searchTextOf,
  starterProfile,
  stripMarkdown,
  titleSimilarity,
  todayBerlin,
  truncate,
  verifyDeadlineQuote,
  weiteCandidate,
  DEFAULT_GATE_TERMS,
  type City,
  type DeadlineAssessment,
  type FoundVia,
  type Horizont,
  type Institution,
  type JobHorizon,
  type Lane,
  type Source,
  type Suchprofil,
} from '@stellen/core';
import {
  addSuggestionStmt,
  browserDoneStmt,
  discoveryStmt,
  linkJobInstitutionStmt,
  listDiscoveries,
  enqueueBrowserStmt,
  expireJobs,
  finishRun,
  gateSkipStmt,
  getSetting,
  imagesToCheck,
  listCities,
  listInstitutions,
  listSources,
  loadGateSkipIndex,
  loadJobIndex,
  markSeenStmt,
  nextBrowserItems,
  purgeExpired,
  setCityImage,
  setInstitutionImage,
  sourceRunStmt,
  startRun,
  touchJobSourceStmt,
  upsertJobStmt,
  type Db,
  type JobIndexEntry,
  type JobWrite,
  type Stmt,
} from '@stellen/db';
import type { IngestConfig } from './config';
import { RunLog, errText } from './log';
import { Http } from './http';
import { Llm } from './llm';
import { BrowserPool } from './browser';
import { agentReadPosting } from './agent';
import { discover, workdayDetail, type DiscoverContext } from './discover';
import { atsDetail } from './ats';
import { assessCompleteness, extractPosting, type Candidate, type PostingData } from './extract';
import { htmlToMarkdown } from './html';
import { baDetail, isOutsideGermany } from './portals';
import { CityMatcher, InstitutionMatcher } from './matching';
import { wikipediaImage } from './images';
import { findJobsPage } from './sourceDiscovery';
import { sendHighScoreAlert, sendReminders } from './push';
import { Registry } from './registry';
import { exploreBa, exploreQueries, exploreWeb } from './explore';
import { processPendingChecks } from './sourceCheck';

export interface PipelineOptions {
  only?: string[];
  browser?: boolean;
  images?: boolean;
  discovery?: boolean;
  reminders?: boolean;
  /** Erkundung nach Anzeigen von neuen Websites (Standard: an, außer bei --only) */
  explore?: boolean;
  /** Wartende Probeläufe für neue Quellen abarbeiten */
  checks?: boolean;
  /** Quellen lesen, erkunden und aufräumen (Standard: an). Aus = nur die Browser-Warteschlange. */
  sources?: boolean;
  maxSources?: number;
  fetchImpl?: typeof fetch;
  /** fester Zeitpunkt (für Tests) */
  now?: Date;
}

/** Ergebnis der Einordnung einer Anzeige ohne Psychologie-Bezug. */
type OutsideDecision =
  | { lane: Exclude<Lane, 'kern'>; horizon: JobHorizon }
  | { skip: 'grobfilter' | 'ki-nein'; note: string | null }
  | { defer: string };

interface JobMeta {
  lane: Lane;
  horizon: JobHorizon | null;
  isNew: boolean;
}

const GENERIC_TITLE = /^(?:stellenangebote?|stellenausschreibung(?:en)?|stellenanzeige|jobs?|job ?details?|karriere|ausschreibung|startseite|home|details?|anzeige|offene stellen|stellenmarkt|vacancies|job offer|position)$/i;
const GENERIC_WORDS = new Set(['wissenschaftliche', 'wissenschaftlicher', 'wissenschaftlichen', 'mitarbeiter', 'mitarbeiterin', 'mitarbeitende', 'stelle', 'position', 'research', 'associate', 'in', 'r', 'm', 'w', 'd', 'f', 'x', 'und', 'oder', 'der', 'die', 'das', 'fuer', 'im', 'am', 'zur', 'zum', 'e', 'tv', 'l']);

function significantWords(title: string): number {
  return cleanTitleForKey(title)
    .split(' ')
    .filter((w) => w.length > 2 && !GENERIC_WORDS.has(w) && !/^\d+$/.test(w)).length;
}

function cleanTitle(t: string | null | undefined): string {
  if (!t) return '';
  let s = t.replace(/\s+/g, ' ').trim();
  s = s.replace(/\s+[|–—]\s+[^|–—]{3,80}$/, ''); // " | Universität X"
  return s.slice(0, 260);
}

function dateOnly(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

export type RunStats = Record<string, number>;

export class Pipeline {
  readonly log: RunLog;
  readonly http: Http;
  readonly llm: Llm;
  private pool: BrowserPool | null;
  private ctx: DiscoverContext;
  private institutions = new Map<string, Institution>();
  private cities = new Map<string, City>();
  private instMatcher = new InstitutionMatcher([]);
  private cityMatcher = new CityMatcher([]);
  private index = new Map<string, JobIndexEntry>();
  private fuzzy = new Map<string, JobIndexEntry>();
  private byInstitution = new Map<string, JobIndexEntry[]>();
  private sourcesByJob = new Map<string, Set<string>>();
  private gateTerms: string[] = DEFAULT_GATE_TERMS;
  private gateHash = '';
  private gateSkips = new Map<string, string>();
  private primaryOk = new Map<string, string[]>();
  /** Echte Startzeit für das Zeitbudget (now kann in Tests ein festes Datum sein). */
  private readonly startedMs = Date.now();
  private healthWarnings = new Map<string, string>();
  private profile: Suchprofil = starterProfile();
  private horizon: Horizont = horizontOf(this.profile);
  private summaryForAi = '';
  /** Neue Anzeigen dieses Laufs mit Score, für die Benachrichtigung über sehr gut passende */
  private newScored: { id: string; title: string; score: number }[] = [];
  private registry = new Registry([], []);
  private weiteChecks = 0;
  /** Sonderquelle für die Erkundung (in der Datenbank angelegt, wird nie direkt eingesammelt). */
  private readonly exploreSource: Source = {
    id: 'erkundung',
    institutionId: null,
    kind: 'portal',
    label: 'Erkundung (neue Websites)',
    url: null,
    adapter: 'erkundung',
    config: {},
    gate: 'psych',
    enabled: false,
    verified: true,
    status: 'ok',
    consecutiveFailures: 0,
  };
  readonly stats: RunStats = {};
  private now: string;
  private today: string;

  constructor(
    private readonly db: Db,
    private readonly cfg: IngestConfig,
    private readonly opts: PipelineOptions = {},
    log?: RunLog,
  ) {
    this.log = log ?? new RunLog();
    this.http = new Http(cfg, this.log, opts.fetchImpl);
    this.llm = new Llm(cfg.llm, this.log, opts.fetchImpl);
    const useBrowser = opts.browser ?? cfg.browser.enabled;
    this.pool = useBrowser ? new BrowserPool(cfg, this.log) : null;
    this.ctx = { http: this.http, llm: this.llm, browser: this.pool, cfg, log: this.log };
    const now = opts.now ?? new Date();
    this.now = now.toISOString();
    this.today = todayBerlin(now);
  }

  private bump(key: string, n = 1): void {
    this.stats[key] = (this.stats[key] ?? 0) + n;
  }

  // ---------------------------------------------------------------- Laden

  private async load(): Promise<Source[]> {
    const [insts, cities, sources, index, skips, gateTerms, jobSources, profileRaw, allSources, discoveries] = await Promise.all([
      listInstitutions(this.db),
      listCities(this.db),
      listSources(this.db, true),
      loadJobIndex(this.db),
      loadGateSkipIndex(this.db),
      getSetting<string[]>(this.db, 'gateTerms', DEFAULT_GATE_TERMS),
      this.db.all<{ job_id: string; source_id: string }>('SELECT job_id, source_id FROM job_sources'),
      getSetting<unknown>(this.db, 'profile', null),
      listSources(this.db),
      listDiscoveries(this.db, 'alle', 5000),
    ]);
    this.profile = parseProfile(profileRaw) ?? starterProfile();
    this.horizon = horizontOf(this.profile);
    this.summaryForAi = profileSummary(this.profile);
    // Register: alle Quellen (auch abgeschaltete), Websites der Einrichtungen und bereits bearbeitete Funde
    this.registry = new Registry(allSources, insts, discoveries.filter((d) => d.status !== 'offen').map((d) => d.siteKey));
    for (const i of insts) this.institutions.set(i.id, i);
    for (const c of cities) this.cities.set(c.id, c);
    this.instMatcher = new InstitutionMatcher(insts);
    this.cityMatcher = new CityMatcher(cities);
    for (const e of index) this.indexEntry(e);
    for (const r of jobSources) {
      const set = this.sourcesByJob.get(r.job_id) ?? new Set<string>();
      set.add(r.source_id);
      this.sourcesByJob.set(r.job_id, set);
    }
    this.gateSkips = skips;
    this.gateTerms = gateTerms?.length ? gateTerms : DEFAULT_GATE_TERMS;
    // Ändern sich Grobfilter, Brücken oder Weite, wird Aussortiertes beim nächsten Fund neu geprüft.
    this.gateHash = hash64(`${this.gateTerms.join('|')}#${horizonGateHash(this.profile)}#${this.llm.available ? 'ki' : 'regeln'}`);
    const bridges = this.horizon.bruecken.filter((b) => b.aktiv).length;
    this.log.info(`${insts.length} Einrichtungen, ${sources.length} aktive Quellen, ${index.length} bekannte Anzeigen, ${this.registry.size} Websites im Register.`);
    this.log.info(`Horizont: ${bridges} aktive Brücken, Weite ${this.horizon.weite ? (this.llm.available ? 'an' : 'an, aber ohne KI-Schlüssel nicht möglich') : 'aus'}.`);
    return sources;
  }

  private indexEntry(e: JobIndexEntry): void {
    this.index.set(e.canonicalUrl, e);
    if (e.fuzzyKey) this.fuzzy.set(e.fuzzyKey, e);
    if (e.institutionId) {
      const list = this.byInstitution.get(e.institutionId) ?? [];
      list.push(e);
      this.byInstitution.set(e.institutionId, list);
    }
  }

  private indexJob(j: JobWrite, extraUrls: string[] = []): void {
    const e: JobIndexEntry = {
      id: j.id,
      canonicalUrl: j.canonicalUrl,
      contentHash: j.contentHash,
      fuzzyKey: j.fuzzyKey,
      status: j.status,
      completeness: j.completeness,
      institutionId: j.institutionId,
      title: j.title,
      deadline: j.deadline ?? null,
      descriptionLength: j.descriptionMd.length,
    };
    this.indexEntry(e);
    for (const u of extraUrls) this.index.set(canonicalUrl(u), e);
  }

  // ---------------------------------------------------------------- Lauf

  async run(): Promise<RunStats> {
    const runId = await startRun(this.db, this.now);
    let ok = false;
    try {
      if (this.opts.checks !== false) {
        const n = await processPendingChecks(this.db, this.ctx).catch((e) => {
          this.log.warn(`Probeläufe: ${errText(e)}`);
          return 0;
        });
        if (n) this.bump('probelaeufe', n);
      }
      const sources = await this.load();
      const full = this.opts.sources !== false;
      if (full && this.opts.images !== false) await this.resolveImages();
      if (full && this.opts.discovery !== false) await this.findMissingJobPages(sources);
      if (full) await this.processSources(sources);
      if (full && (this.opts.explore ?? (this.cfg.explore.enabled && !this.opts.only?.length))) await this.explore();
      if (this.pool) await this.processBrowserQueue(sources);
      await this.flushHealthWarnings();
      if (full) {
        const t = Date.parse(this.now);
        this.bump(
          'abgelaufen',
          await expireJobs(this.db, this.today, new Date(t - this.cfg.goneAfterDays * 86_400_000).toISOString(), this.now, new Date(t - 45 * 86_400_000).toISOString()),
        );
        this.bump('geloescht', await purgeExpired(this.db, new Date(t - this.cfg.purgeAfterDays * 86_400_000).toISOString(), this.now));
      }
      if (this.opts.reminders !== false) {
        this.bump('erinnerungen', await sendReminders(this.db, this.cfg, this.log, this.today));
        this.bump('benachrichtigtNeu', await sendHighScoreAlert(this.db, this.cfg, this.log, this.newScored));
      }
      ok = true;
    } catch (e) {
      this.log.error(`Lauf abgebrochen: ${errText(e)}`);
    } finally {
      await this.pool?.close();
      this.stats.http = this.http.requests;
      this.stats.ki = this.llm.calls;
      if (this.llm.failures) this.stats.kiFehler = this.llm.failures;
      if (this.llm.costUsd) this.stats.kiKostenUsd = Math.round(this.llm.costUsd * 10_000) / 10_000;
      if (this.pool) this.stats.browserSekunden = Math.round(this.pool.usedMs / 1000);
      this.log.info(`Fertig: ${JSON.stringify(this.stats)}`);
      await finishRun(this.db, runId, ok, this.stats, this.log.text()).catch((e) => console.error(e));
    }
    return this.stats;
  }

  // ---------------------------------------------------------------- Bilder und fehlende Stellenseiten

  private async resolveImages(): Promise<void> {
    const todo = (await imagesToCheck(this.db, addDays(this.today, -30))).slice(0, this.cfg.images.maxPerRun);
    for (const t of todo) {
      const img = await wikipediaImage(this.http, t.wikiDe).catch(() => null);
      if (t.kind === 'institution') await setInstitutionImage(this.db, t.id, img?.url ?? null, img?.credit ?? null);
      else await setCityImage(this.db, t.id, img?.url ?? null, img?.credit ?? null);
      if (img) this.bump('bilder');
    }
  }

  private async findMissingJobPages(sources: Source[]): Promise<void> {
    const missing = sources.filter((s) => s.status === 'url-fehlt' && s.institutionId).slice(0, this.cfg.discovery.maxInstitutionsPerRun);
    const stmts: Stmt[] = [];
    for (const s of missing) {
      const inst = this.institutions.get(s.institutionId!);
      if (!inst) continue;
      try {
        const found = await findJobsPage(inst, this.ctx);
        if (found) {
          stmts.push(addSuggestionStmt(inst.id, found.url, found.reason, this.now));
          this.bump('vorschlaege');
          this.log.info(`Vorschlag für ${inst.shortName ?? inst.name}: ${found.url} (${found.reason})`);
        }
      } catch (e) {
        this.log.warn(`Suche nach Stellenseite für ${inst.name} fehlgeschlagen: ${errText(e)}`);
      }
    }
    await this.db.batch(stmts);
  }

  // ---------------------------------------------------------------- Quellen

  private async processSources(all: Source[]): Promise<void> {
    let sources = all.filter((s) => s.url);
    if (this.opts.only?.length) sources = sources.filter((s) => this.opts.only!.includes(s.id));
    if (this.opts.maxSources) sources = sources.slice(0, this.opts.maxSources);
    // Am längsten nicht gelesene Quellen zuerst: Reicht die Zeit nicht, macht der nächste Lauf dort weiter.
    const byLastRun = (a: Source, b: Source) => (a.lastRunAt ?? '').localeCompare(b.lastRunAt ?? '');
    const primary = sources.filter((s) => s.kind !== 'portal').sort(byLastRun);
    const portals = sources.filter((s) => s.kind === 'portal');
    // Zeitbudget (Workflow-Grenze 120 Minuten): Portale laufen zuletzt (sie zeigen Lücken der Quellen),
    // bekommen aber ein eigenes Zeitfenster.
    const deadline = this.startedMs + this.cfg.sourceBudgetMs;
    const primaryDeadline = deadline - (portals.length ? Math.min(20 * 60_000, this.cfg.sourceBudgetMs / 4) : 0);
    let next = 0;
    const worker = async () => {
      while (next < primary.length && Date.now() < primaryDeadline) {
        const s = primary[next++];
        await this.processSource(s);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, this.cfg.sourceConcurrency) }, worker));
    let skipped = primary.length - next;
    for (const p of portals) {
      if (Date.now() >= deadline) skipped++;
      else await this.processSource(p);
    }
    if (skipped) {
      this.bump('quellenVertagt', skipped);
      this.log.warn(`Zeitbudget erreicht: ${skipped} Quellen kommen im nächsten Lauf zuerst dran.`);
    }
  }

  private async processSource(source: Source): Promise<void> {
    const t0 = Date.now();
    const stmts: Stmt[] = [];
    let found = 0;
    try {
      const res = await discover(source, this.ctx);
      found = res.candidates.length;
      this.bump('kandidaten', found);
      const budget = { left: this.cfg.maxNewDetailsPerSource };
      for (const c of res.candidates) {
        try {
          await this.handleCandidate(source, c, stmts, budget);
        } catch (e) {
          this.bump('fehlerDetail');
          this.log.warn(`[${source.id}] ${c.url}: ${errText(e)}`);
        }
        if (stmts.length >= 60) await this.db.batch(stmts.splice(0));
      }
      const ok = res.status === 'ok' || res.status === 'leer';
      if (ok && source.institutionId && source.kind !== 'portal' && res.status === 'ok') {
        this.primaryOk.set(source.institutionId, [...(this.primaryOk.get(source.institutionId) ?? []), source.id]);
      }
      stmts.push(sourceRunStmt(source.id, { status: res.status, note: res.note, count: found, methods: res.methods, ok }, this.now));
      this.bump(`quelle_${res.status}`);
      this.log.info(`[${source.id}] ${res.status}: ${found} Kandidaten über ${res.methods.join(', ') || '–'} (${Math.round((Date.now() - t0) / 1000)} s)${res.note ? ` – ${res.note}` : ''}`);
    } catch (e) {
      stmts.push(sourceRunStmt(source.id, { status: 'fehler', note: errText(e).slice(0, 300), count: null, methods: [], ok: false }, this.now));
      this.bump('quelle_fehler');
      this.log.error(`[${source.id}] ${errText(e)}`);
    }
    await this.db.batch(stmts);
  }

  /** Bestehende vollständige Anzeigen alle paar Tage neu lesen (Fristverlängerung, Korrekturen). */
  private refetchToday(id: string): boolean {
    const n = parseInt(hash64(`${id}|${this.today}`).slice(0, 6), 16);
    return n % Math.max(1, this.cfg.refetchAfterDays) === 0;
  }

  /** Verarbeitet einen Kandidaten. Gibt die neu angelegte Anzeige zurück (sonst null). */
  private async handleCandidate(source: Source, c: Candidate, stmts: Stmt[], budget: { left: number }): Promise<JobWrite | null> {
    const canon = canonicalUrl(c.url);
    const existing = this.index.get(canon);
    if (existing) {
      this.bump('gesehen');
      stmts.push(markSeenStmt(existing.id, this.now), touchJobSourceStmt(existing.id, source.id, c.url, this.now));
      this.sourcesByJob.set(existing.id, (this.sourcesByJob.get(existing.id) ?? new Set()).add(source.id));
      // Zuerst ohne Einrichtung gefunden (Portal, Erkundung), jetzt in einer Quelle mit Einrichtung
      if (!existing.institutionId && source.institutionId) {
        stmts.push(linkJobInstitutionStmt(existing.id, source.institutionId, this.now));
        existing.institutionId = source.institutionId;
      }
      const refetch = existing.completeness === 'teilweise' || this.refetchToday(existing.id);
      if (!refetch || budget.left <= 0) return null;
      budget.left--;
      const data = await this.readCandidate(source, c, stmts);
      if (!data) return null;
      const terms = checkGate(searchTextOf({ title: data.title, descriptionMd: data.descriptionMd }), this.gateTerms).matched;
      const job = await this.buildJob(source, c, data, terms, { lane: 'kern', horizon: null, isNew: false });
      if (!job) return null;
      if (job.contentHash !== existing.contentHash || (existing.completeness === 'teilweise' && job.completeness === 'ok')) {
        stmts.push(this.replaceContentStmt(existing.id, job));
        existing.contentHash = job.contentHash;
        existing.completeness = job.completeness;
        this.bump('aktualisiert');
      }
      return null;
    }
    if (this.gateSkips.get(canon) === this.gateHash) {
      this.bump('grobfilterBekannt');
      return null;
    }
    if (budget.left <= 0) {
      this.bump('verschoben');
      return null;
    }
    budget.left--;
    const data = await this.readCandidate(source, c, stmts);
    if (!data) return null;
    if (source.kind === 'portal' && isOutsideGermany({ country: data.country ?? c.hints?.country, locationText: data.locationText ?? c.hints?.locality })) {
      this.bump('ausland');
      return null;
    }
    const norm = searchTextOf({ title: data.title, descriptionMd: data.descriptionMd });
    const gate = checkGate(norm, this.gateTerms);
    let meta: JobMeta = { lane: 'kern', horizon: null, isNew: true };
    if (source.gate === 'psych' && !gate.pass) {
      if (!data.complete && this.pool) {
        // Unvollständiger Text (z. B. JavaScript-Seite) – erst vollständig lesen, dann einordnen.
        stmts.push(enqueueBrowserStmt(c.url, source.id, source.institutionId, data.incompleteReason ?? 'Text unvollständig', this.now));
        this.bump('browserVorgemerkt');
        return null;
      }
      const d = await this.decideOutside(norm, data);
      if ('defer' in d) {
        this.bump('weiteVerschoben');
        return null;
      }
      if ('skip' in d) {
        stmts.push(gateSkipStmt({ url: canon, sourceId: source.id, institutionId: source.institutionId, title: truncate(data.title || c.title || c.url, 200), textHash: this.gateHash, reason: d.skip, note: d.note }, this.now));
        this.gateSkips.set(canon, this.gateHash);
        this.bump(d.skip === 'ki-nein' ? 'kiNein' : 'grobfilter');
        return null;
      }
      meta = { lane: d.lane, horizon: d.horizon, isNew: true };
    } else {
      meta = { lane: 'kern', horizon: await this.horizonForCore(norm, data), isNew: true };
    }
    const job = await this.buildJob(source, c, data, gate.matched, meta);
    if (!job) {
      this.bump('keineAnzeige');
      return null;
    }
    const dup = this.findDuplicate(job, source.id);
    if (dup) {
      this.bump('dubletten');
      stmts.push(markSeenStmt(dup.id, this.now), touchJobSourceStmt(dup.id, source.id, c.url, this.now));
      this.index.set(canon, dup);
      if (dup.completeness === 'teilweise' && job.completeness === 'ok') {
        stmts.push(this.replaceContentStmt(dup.id, job));
        dup.completeness = 'ok';
        this.bump('aktualisiert');
      }
      return null;
    }
    if (source.kind === 'portal' && job.institutionId) this.portalHealth(job, source);
    stmts.push(upsertJobStmt(job), touchJobSourceStmt(job.id, source.id, c.url, this.now));
    this.indexJob(job, [c.url]);
    this.sourcesByJob.set(job.id, new Set([source.id]));
    this.bump('neu');
    this.newScored.push({ id: job.id, title: job.title, score: scoreJob(job, searchTextOf(job), this.profile).score });
    if (job.lane === 'horizont') this.bump('neuHorizont');
    if (job.lane === 'weite') this.bump('neuWeite');
    if (job.newSite) {
      this.bump('neueWebsites');
      const key = this.registry.siteKey(job.url, data.hiringOrg);
      if (key) stmts.push(discoveryStmt(key, data.hiringOrg ?? null, job.url, this.now));
    }
    if (job.completeness === 'teilweise' && this.pool) {
      stmts.push(enqueueBrowserStmt(job.url, source.id, job.institutionId, data.incompleteReason ?? 'Text unvollständig', this.now));
      this.bump('browserVorgemerkt');
    }
    return job;
  }

  /**
   * Hat der breite Grobfilter eine Anzeige durchgelassen, die keines deiner Kernthemen trifft, aber über eine
   * Brücke passt (z. B. „UX Researcher“ ohne Psychologie im Text), zeigt die App sie als Horizont-Karte.
   * Die KI liefert dafür den Satz „Warum das passen könnte“ – oder „nein“, dann wird sie nicht eingestreut.
   */
  private async horizonForCore(norm: string, data: PostingData): Promise<JobHorizon | null> {
    if (isThematic({ kind: classifyKind(data.title, data.descriptionMd) }, norm, this.profile)) return null;
    const hits = matchBridges(norm, this.horizon);
    if (hits.length === 0) return null;
    const bridges = hits.map((h) => h.bridge.id);
    if (!this.llm.available) return { bridges, label: hits[0].bridge.name };
    const v = await this.llm.horizonVerdict(this.summaryForAi, { title: data.title, org: data.hiringOrg ?? null, text: stripMarkdown(data.descriptionMd) }, { name: hits[0].bridge.name, warum: hits[0].bridge.warum });
    if (v) this.bump('horizontKiKern');
    return { bridges, label: v?.label ?? hits[0].bridge.name, reason: v?.reason_de ?? null, verdict: v?.verdict ?? null };
  }

  /**
   * Anzeige ohne Psychologie-Bezug aus einer breiten Quelle: Horizont (Brücke passt), Weite (KI hält die
   * Fähigkeiten für übertragbar) oder aussortieren. Völlig Fremdes sortiert die KI aus („nein“).
   */
  private async decideOutside(norm: string, data: PostingData): Promise<OutsideDecision> {
    const posting = { title: data.title, org: data.hiringOrg ?? null, text: stripMarkdown(data.descriptionMd) };
    const hits = matchBridges(norm, this.horizon);
    if (hits.length > 0) {
      const bridges = hits.map((h) => h.bridge.id);
      if (!this.llm.available) return { lane: 'horizont', horizon: { bridges, label: hits[0].bridge.name } };
      const v = await this.llm.horizonVerdict(this.summaryForAi, posting, { name: hits[0].bridge.name, warum: hits[0].bridge.warum });
      if (v?.verdict === 'nein') return { skip: 'ki-nein', note: v.reason_de };
      return { lane: 'horizont', horizon: { bridges, label: v?.label ?? hits[0].bridge.name, reason: v?.reason_de ?? null, verdict: v?.verdict ?? null } };
    }
    const w = weiteCandidate(norm, this.profile);
    if (!w) return { skip: 'grobfilter', note: null };
    if (!this.llm.available) return { skip: 'grobfilter', note: null };
    if (this.weiteChecks >= this.cfg.horizon.maxWeiteChecks) return { defer: 'Weite-Kontingent für diesen Lauf aufgebraucht' };
    this.weiteChecks++;
    const v = await this.llm.horizonVerdict(this.summaryForAi, posting, null);
    if (!v) return { defer: 'KI nicht erreichbar' };
    if (v.verdict === 'nein') return { skip: 'ki-nein', note: v.reason_de };
    return { lane: 'weite', horizon: { bridges: [], label: v.label, reason: v.reason_de, verdict: v.verdict } };
  }

  /** Liest die Anzeige hinter einem Kandidaten – mit allen Ausweichwegen. */
  private async readCandidate(source: Source, c: Candidate, stmts: Stmt[]): Promise<PostingData | null> {
    if (c.prefilled?.complete) return this.withHints(c.prefilled, c);
    if (c.via === 'ats:workday') {
      const d = await workdayDetail(this.http, c.url);
      if (d) {
        const md = htmlToMarkdown(d.html);
        const a = assessCompleteness(md);
        return this.withHints({ url: c.url, title: d.title, descriptionMd: md, locationText: d.location, method: 'ats:workday', complete: a.complete, incompleteReason: a.reason }, c);
      }
    }
    if (c.via === 'ats:smartrecruiters' || c.via === 'ats:hpcareer') {
      const d = await atsDetail(this.http, c, !!source.config.ignoreRobots);
      if (d) return this.withHints(d, c);
    }
    const r = await extractPosting(this.http, c.url, { titleHint: c.title, ignoreRobots: !!source.config.ignoreRobots });
    if (r.notAPosting) {
      this.bump('keineAnzeige');
      return null;
    }
    let data = r.data ? this.withHints(r.data, c) : null;
    if (!data || !data.complete) {
      let fallback: PostingData | null = c.prefilled ?? null;
      if (c.hints?.baRef) fallback = (await baDetail(this.ctx, c.hints.baRef)) ?? fallback;
      if (fallback && (!data || fallback.descriptionMd.length > data.descriptionMd.length)) {
        data = this.withHints({ ...fallback, url: data?.url ?? fallback.url }, c);
      }
    }
    if (!data) {
      this.bump('fehlerDetail');
      if (r.blockedByRobots) {
        this.bump('robots');
        return null;
      }
      if (this.pool && (r.needsBrowser || r.status === 403 || r.status === 0)) {
        stmts.push(enqueueBrowserStmt(c.url, source.id, source.institutionId, r.error ?? 'Abruf fehlgeschlagen', this.now));
        this.bump('browserVorgemerkt');
      } else {
        this.log.warn(`[${source.id}] ${c.url}: ${r.error ?? 'nicht lesbar'}`);
      }
      return null;
    }
    return data;
  }

  private withHints(d: PostingData, c: Candidate): PostingData {
    const h = c.hints ?? {};
    return {
      ...d,
      title: d.title || c.title || '',
      locationText: d.locationText ?? h.locality ?? null,
      lat: d.lat ?? h.lat ?? null,
      lon: d.lon ?? h.lon ?? null,
      hiringOrg: d.hiringOrg ?? h.org ?? null,
      hiringOrgUrl: d.hiringOrgUrl ?? h.orgUrl ?? null,
      postedAt: d.postedAt ?? h.postedAt ?? null,
      country: d.country ?? h.country ?? null,
    };
  }

  /** Baut den Datensatz: Felder, Frist (geprüft), Stellenart, Kurzfassung (Regeln, bei Bedarf KI), Ort, Einrichtung. */
  private async buildJob(source: Source, c: Candidate, data: PostingData, psychTerms: string[], meta: JobMeta): Promise<JobWrite | null> {
    let title = cleanTitle(data.title || c.title);
    const plain = stripMarkdown(data.descriptionMd);
    const postedAt = dateOnly(data.postedAt);
    const fields = extractFields(plain, { title, today: this.today, reference: postedAt ?? this.today });
    let payGrade = fields.payGrade;
    let payLevel = fields.payLevel;
    let workloadPct = fields.workloadPct;
    let fixedTerm = fields.fixedTerm;
    let startText = fields.startText;
    let department: string | null = data.department ?? null;
    let summary: string | null = null;
    let summaryAi = false;

    const titleMissing = !title || title.length < 6 || GENERIC_TITLE.test(title);
    if (this.llm.available && (titleMissing || this.cfg.llm.summaries)) {
      const r = await this.llm.extractPosting(plain, data.url);
      if (r) {
        if (!r.is_job_posting && titleMissing) return null;
        if (titleMissing && r.title) title = cleanTitle(r.title);
        payGrade = payGrade ?? r.pay_grade;
        if (payLevel == null && r.pay_grade) payLevel = Number(/(\d{1,2})/.exec(r.pay_grade)?.[1] ?? NaN) || null;
        workloadPct = workloadPct ?? (r.workload_pct && r.workload_pct <= 100 ? Math.round(r.workload_pct) : null);
        fixedTerm = fixedTerm ?? r.fixed_term;
        startText = startText ?? r.start;
        department = department ?? r.department;
        if (r.summary_de && r.summary_de.length > 30) {
          summary = r.summary_de;
          summaryAi = true;
        }
      }
    }
    if (!title || GENERIC_TITLE.test(title)) title = title || c.title || 'Stellenausschreibung';
    summary = summary ?? heuristicSummary(data.descriptionMd);
    const dl = await this.checkDeadline(plain, fields, data, postedAt, meta.isNew);

    const institutionId = source.institutionId ?? this.instMatcher.match(data.hiringOrg, data.hiringOrgUrl ?? data.url);
    const inst = institutionId ? this.institutions.get(institutionId) : undefined;
    const placeCity = this.cityMatcher.match(data.locationText);
    const cityId = placeCity ?? inst?.cityId ?? null;
    const url = data.url || c.url;
    const foundVia: FoundVia = source.id === this.exploreSource.id ? 'erkundung' : source.kind === 'portal' ? 'portal' : 'quelle';
    const newSite = !this.registry.known(url, institutionId, data.hiringOrg ?? c.hints?.org ?? null);
    const job: JobWrite = {
      id: jobIdForUrl(url),
      institutionId,
      url,
      canonicalUrl: canonicalUrl(url),
      title,
      department,
      locationText: data.locationText ?? null,
      cityId,
      lat: data.lat ?? null,
      lon: data.lon ?? null,
      descriptionMd: data.descriptionMd.slice(0, 90_000),
      summary,
      summaryByAi: summaryAi,
      kind: classifyKind(title, data.descriptionMd),
      payGrade,
      payLevel,
      workloadPct,
      workloadText: fields.workloadText,
      fixedTerm,
      isPermanent: fields.isPermanent,
      startText,
      deadline: dl.deadline,
      deadlineText: fields.deadlineText ?? fields.deadlineUnclear,
      deadlineCheck: dl.check,
      deadlineNote: dl.note,
      referenceNo: fields.referenceNo ?? data.referenceNo ?? null,
      contact: fields.contact,
      language: detectLanguage(data.descriptionMd),
      imageUrl: data.imageUrl ?? null,
      imageKind: data.imageUrl ? 'posting' : null,
      pdfUrl: data.pdfUrl ?? null,
      postedAt,
      firstSeenAt: this.now,
      lastSeenAt: this.now,
      updatedAt: this.now,
      status: dl.deadline && dl.deadline < this.today ? 'abgelaufen' : 'aktiv',
      completeness: data.complete ? 'ok' : 'teilweise',
      method: data.method,
      psychTerms,
      contentHash: contentHash(title, data.descriptionMd),
      fuzzyKey: null,
      lane: meta.lane,
      horizon: meta.horizon,
      newSite,
      foundVia,
      employer: data.hiringOrg ?? c.hints?.org ?? null,
      extra: { via: c.via, sourceId: source.id, fetchedAt: this.now, incompleteReason: data.incompleteReason ?? null, query: c.hints?.query ?? null },
    };
    job.fuzzyKey = fuzzyKey(job);
    return job;
  }

  /**
   * Frist absichern: Regeln, Plausibilität, bei Zweifeln die KI mit wörtlichem Zitat.
   * Ergebnis: nie eine erfundene Frist, unklare Fälle sichtbar als „unsicher“.
   */
  private async checkDeadline(plain: string, fields: ReturnType<typeof extractFields>, data: PostingData, postedAt: string | null, isNew: boolean): Promise<DeadlineAssessment> {
    let dl = assessDeadline({
      iso: fields.deadline,
      raw: fields.deadlineText,
      yearInferred: fields.deadlineYearInferred,
      unclear: fields.deadlineUnclear,
      structured: data.validThrough,
      postedAt,
      today: this.today,
      isNew,
    });
    const hint = !fields.deadline && !fields.deadlineUnclear && /bewerbungsfrist|bewerbungsschluss|einsendeschluss|deadline|closing date|bis zum|bis sp[äa]testens/i.test(plain);
    if (!this.llm.available || !(dl.review || (hint && isNew))) {
      if (dl.check === 'unsicher') this.bump('fristUnsicher');
      return dl;
    }
    this.bump('fristKiPruefung');
    const r = await this.llm.checkDeadline(plain, this.today, fields.deadline ?? fields.deadlineUnclear ?? null);
    if (r?.deadline && r.quote && verifyDeadlineQuote(plain, r.deadline, r.quote)) {
      // Wörtlich im Text belegt: gilt, auch wenn sie ungewöhnlich weit weg ist – nur nie vor der Veröffentlichung.
      const again = assessDeadline({ iso: r.deadline, raw: r.quote, postedAt, today: this.today, isNew: false });
      if (again.deadline) {
        dl = { deadline: again.deadline, check: 'ki', note: `„${truncate(r.quote.replace(/\s+/g, ' ').trim(), 140)}“`, review: false };
        this.bump('fristKiBestaetigt');
      }
    } else if (r && r.deadline == null && r.quote == null && dl.check !== 'unsicher' && !fields.deadline) {
      // Die KI findet keine Frist: dann auch keine Seitendaten-Frist übernehmen
      dl = { deadline: null, check: null, note: null, review: false };
    }
    if (dl.check === 'unsicher') this.bump('fristUnsicher');
    return dl;
  }

  private findDuplicate(job: JobWrite, sourceId: string): JobIndexEntry | null {
    if (job.fuzzyKey) {
      const e = this.fuzzy.get(job.fuzzyKey);
      if (e && !this.sourcesByJob.get(e.id)?.has(sourceId)) return e;
    }
    if (!job.institutionId || significantWords(job.title) < 2) return null;
    for (const e of this.byInstitution.get(job.institutionId) ?? []) {
      if (e.status !== 'aktiv' || this.sourcesByJob.get(e.id)?.has(sourceId)) continue;
      if (e.deadline && job.deadline && e.deadline !== job.deadline) continue;
      if (titleSimilarity(e.title, job.title) >= 0.85) return e;
    }
    return null;
  }

  private replaceContentStmt(id: string, j: JobWrite): Stmt {
    return {
      sql: `UPDATE jobs SET title = ?, description_md = ?, summary = ?, summary_ai = ?, kind = ?, pay_grade = ?, pay_level = ?, workload_pct = ?,
            workload_text = ?, fixed_term = ?, is_permanent = ?, start_text = ?, deadline = ?, deadline_text = ?, deadline_check = ?, deadline_note = ?,
            reference_no = ?, contact = ?, language = ?, image_url = COALESCE(?, image_url), pdf_url = COALESCE(?, pdf_url), content_hash = ?, completeness = ?, method = ?,
            status = CASE WHEN ? IS NOT NULL AND ? < ? THEN 'abgelaufen' WHEN ? IS NOT NULL AND ? >= ? THEN 'aktiv' ELSE status END,
            updated_at = ?, last_seen_at = ? WHERE id = ?`,
      params: [
        j.title, j.descriptionMd, j.summary ?? null, j.summaryByAi ? 1 : 0, j.kind, j.payGrade ?? null, j.payLevel ?? null, j.workloadPct ?? null,
        j.workloadText ?? null, j.fixedTerm ?? null, j.isPermanent == null ? null : j.isPermanent ? 1 : 0, j.startText ?? null, j.deadline ?? null,
        j.deadlineText ?? null, j.deadlineCheck ?? null, j.deadlineNote ?? null, j.referenceNo ?? null, j.contact ?? null, j.language ?? null,
        j.imageUrl ?? null, j.pdfUrl ?? null, j.contentHash,
        j.completeness, j.method ?? null,
        j.deadline ?? null, j.deadline ?? null, this.today,
        j.deadline ?? null, j.deadline ?? null, this.today,
        this.now, this.now, id,
      ],
    };
  }

  /** Portal fand eine Anzeige, die die (erfolgreich gelaufene) Institutsquelle nicht hatte → Hinweis an der Quelle. */
  private portalHealth(job: JobWrite, portal: Source): void {
    const primary = this.primaryOk.get(job.institutionId!);
    if (!primary?.length) return;
    for (const sid of primary) {
      this.healthWarnings.set(sid, `${portal.label ?? portal.id} fand „${truncate(job.title, 80)}“, die hier fehlte – Quelle prüfen`);
    }
  }

  private async flushHealthWarnings(): Promise<void> {
    if (this.healthWarnings.size === 0) return;
    const stmts: Stmt[] = [...this.healthWarnings].map(([id, note]) => ({
      sql: "UPDATE sources SET status = 'warnung', status_note = ? WHERE id = ?",
      params: [note, id],
    }));
    await this.db.batch(stmts);
    this.bump('quellenWarnung', stmts.length);
  }

  // ---------------------------------------------------------------- Erkundung (blinde Flecken)

  /**
   * Sucht gezielt Anzeigen von Websites, die noch nicht im Register stehen: wechselnde Suchwörter aus
   * Kernbereich und Brücken bei der Arbeitsagentur (und optional in einer Websuche). Liest so lange,
   * bis mindestens `explore.minNew` neue Anzeigen von neuen Websites dabei sind oder das Budget aufgebraucht ist.
   */
  private async explore(): Promise<void> {
    const target = this.cfg.explore.minNew;
    if (target <= 0) return;
    const budget = { left: this.cfg.explore.maxReads };
    const queries = exploreQueries(this.horizon, this.today, this.cfg.explore.maxQueries);
    const tried = new Set<string>();
    const stmts: Stmt[] = [];
    let found = 0;
    let qi = 0;
    let searches = 0;
    this.log.info(`Erkundung: Ziel sind mindestens ${target} Anzeigen von Websites außerhalb des Registers.`);
    while (found < target && budget.left > 0 && qi < queries.length) {
      const batch = queries.slice(qi, qi + (qi === 0 ? this.cfg.explore.queriesPerRun : 2));
      qi += batch.length;
      const cands: Candidate[] = [];
      for (const q of batch) {
        searches++;
        cands.push(...(await exploreBa(this.ctx, q).catch((e) => (this.log.warn(`Erkundung „${q}“ (Arbeitsagentur): ${errText(e)}`), []))));
        cands.push(...(await exploreWeb(this.ctx, q).catch((e) => (this.log.warn(`Erkundung „${q}“ (Websuche): ${errText(e)}`), []))));
      }
      // Nur Unbekanntes: weder als Anzeige noch als Website im Register
      const fresh = cands.filter((c) => {
        const canon = canonicalUrl(c.url);
        if (tried.has(canon) || this.index.has(canon) || this.gateSkips.get(canon) === this.gateHash) return false;
        tried.add(canon);
        const inst = this.instMatcher.match(c.hints?.org ?? null, c.url);
        return !this.registry.known(c.url, inst, c.hints?.org ?? null);
      });
      // Titel mit Psychologie-Bezug oder Brücke zuerst
      const rank = (c: Candidate) => {
        const n = normalizeText(c.title ?? '');
        return (checkGate(n, this.gateTerms).pass ? 2 : 0) + (matchFeld(n, this.horizon).length ? 1 : 0);
      };
      fresh.sort((a, b) => rank(b) - rank(a));
      // Möglichst verschiedene Websites zuerst: reihum je eine Anzeige pro Website/Arbeitgeber
      const groups = new Map<string, Candidate[]>();
      for (const c of fresh) {
        const key = this.registry.siteKey(c.url, c.hints?.org ?? null) ?? c.url;
        groups.set(key, [...(groups.get(key) ?? []), c]);
      }
      const ordered: Candidate[] = [];
      for (let round = 0; ordered.length < fresh.length; round++) {
        for (const list of groups.values()) if (list[round]) ordered.push(list[round]);
      }
      for (const c of ordered) {
        if (found >= target || budget.left <= 0) break;
        try {
          const job = await this.handleCandidate(this.exploreSource, c, stmts, budget);
          if (job?.newSite) {
            found++;
            this.log.info(`Erkundung: neu „${truncate(job.title, 80)}“ (${this.registry.siteKey(job.url, c.hints?.org) ?? job.url}, ${job.lane ?? 'kern'})`);
          }
        } catch (e) {
          this.log.warn(`Erkundung ${c.url}: ${errText(e)}`);
        }
        if (stmts.length >= 40) await this.db.batch(stmts.splice(0));
      }
    }
    await this.db.batch(stmts);
    this.stats.erkundungSuchen = searches;
    this.stats.erkundet = found;
    this.stats.erkundungZiel = target;
    if (found < target) {
      this.stats.erkundungFehlt = target - found;
      this.log.warn(`Erkundung: nur ${found} von ${target} Anzeigen von neuen Websites gefunden (${searches} Suchen, ${this.cfg.explore.maxReads - budget.left} Anzeigen gelesen).`);
    } else {
      this.log.info(`Erkundung: ${found} Anzeigen von neuen Websites (${searches} Suchen).`);
    }
  }

  // ---------------------------------------------------------------- Browser-Warteschlange

  private async processBrowserQueue(sources: Source[]): Promise<void> {
    if (!this.pool) return;
    const items = await nextBrowserItems(this.db, this.cfg.browser.maxQueueItemsPerRun);
    if (items.length === 0) return;
    this.log.info(`Browser-Agent: ${items.length} Seite(n) in der Warteschlange.`);
    const byId = new Map(sources.map((s) => [s.id, s]));
    for (const item of items) {
      if (!this.pool.budgetLeft || Date.now() - this.startedMs > this.cfg.runBudgetMs) {
        this.log.info('Browser-Zeitbudget für diesen Lauf aufgebraucht – Rest beim nächsten Lauf.');
        break;
      }
      const stmts: Stmt[] = [];
      try {
        const res = await agentReadPosting(this.pool, this.http, this.llm, this.log, item.url);
        const source: Source = byId.get(item.sourceId ?? '') ?? {
          id: item.sourceId ?? 'browser',
          institutionId: item.institutionId,
          kind: 'zentral',
          label: 'Browser',
          url: item.url,
          adapter: 'auto',
          config: {},
          gate: 'none',
          enabled: true,
          verified: false,
          status: 'ok',
          consecutiveFailures: 0,
        };
        if (!res.data || res.data.descriptionMd.length < 300) {
          stmts.push(browserDoneStmt(item.url, false, res.steps.join(' | ').slice(0, 400) || 'kein Text', this.now));
          this.bump('browserOhneErfolg');
        } else {
          res.data.url = item.url; // Identität bleibt die ursprüngliche Adresse
          const canon = canonicalUrl(item.url);
          const existing = this.index.get(canon);
          const norm = searchTextOf({ title: res.data.title, descriptionMd: res.data.descriptionMd });
          const gate = checkGate(norm, this.gateTerms);
          let meta: JobMeta | null = { lane: 'kern', horizon: null, isNew: !existing };
          if (!existing && source.gate === 'psych' && !gate.pass) {
            const d = await this.decideOutside(norm, res.data);
            if ('skip' in d) {
              stmts.push(gateSkipStmt({ url: canon, sourceId: source.id, institutionId: source.institutionId, title: truncate(res.data.title, 200), textHash: this.gateHash, reason: d.skip, note: d.note }, this.now));
              this.bump(d.skip === 'ki-nein' ? 'kiNein' : 'grobfilter');
              meta = null;
            } else if ('defer' in d) {
              meta = null;
            } else {
              meta = { lane: d.lane, horizon: d.horizon, isNew: true };
            }
          }
          if (meta) {
            const job = await this.buildJob(source, { url: item.url, via: 'browser' }, res.data, gate.matched, meta);
            if (job) {
              if (existing) {
                stmts.push(this.replaceContentStmt(existing.id, job));
                this.bump('browserVervollstaendigt');
              } else {
                stmts.push(upsertJobStmt(job), touchJobSourceStmt(job.id, source.id, item.url, this.now));
                this.indexJob(job);
                this.bump('browserNeu');
                if (job.newSite) {
                  this.bump('neueWebsites');
                  const key = this.registry.siteKey(job.url, res.data.hiringOrg);
                  if (key) stmts.push(discoveryStmt(key, res.data.hiringOrg ?? null, job.url, this.now));
                }
              }
            }
          }
          stmts.push(browserDoneStmt(item.url, res.data.complete, res.data.complete ? null : res.data.incompleteReason ?? null, this.now));
          this.log.info(`Browser-Agent ${res.data.complete ? 'vollständig' : 'teilweise'}: ${item.url} (${res.steps.join(', ') || 'ohne Klicks'})`);
        }
      } catch (e) {
        stmts.push(browserDoneStmt(item.url, false, errText(e).slice(0, 300), this.now));
        this.log.warn(`Browser-Agent: ${item.url}: ${errText(e)}`);
      }
      await this.db.batch(stmts);
    }
  }
}

export async function runPipeline(db: Db, cfg: IngestConfig, opts: PipelineOptions = {}, log?: RunLog): Promise<RunStats> {
  return new Pipeline(db, cfg, opts, log).run();
}
