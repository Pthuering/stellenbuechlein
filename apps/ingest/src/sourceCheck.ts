// Probelauf für eine neue Quelle: Bevor eine Website ins Register kommt, wird sie einmal komplett
// eingesammelt (ohne zu speichern), ein paar Anzeigen werden vollständig gelesen, und die KI beurteilt,
// ob die Seite taugt, wer ausschreibt und welche Einstellungen nötig sind.

import {
  assessDeadline,
  canonicalUrl,
  classifyKind,
  extractFields,
  siteKeyOf,
  stripMarkdown,
  todayBerlin,
  truncate,
  type City,
  type DeadlineCheck,
  type Institution,
  type InstitutionKind,
  type JobKind,
  type Source,
  type SourceConfig,
  type SourceStatus,
} from '@stellen/core';
import { finishSourceCheck, listCities, listInstitutions, listSources, pendingSourceChecks, startSourceCheck, type Db } from '@stellen/db';
import { agentReadPosting } from './agent';
import { discover, type DiscoverContext } from './discover';
import { extractPosting, type Candidate, type PostingData } from './extract';
import { load, pageTitle, visibleText } from './html';
import { errText } from './log';
import { CityMatcher, InstitutionMatcher } from './matching';
import { findJobsPage } from './sourceDiscovery';

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
  /** KI: ist das wirklich eine einzelne Anzeige? */
  aiOk: boolean | null;
  problems: string[];
}

export interface SourceCheckResult {
  /** eingegebene Adresse */
  url: string;
  /** Adresse der Stellenliste (bei Startseiten von der Pipeline gefunden) */
  listUrl: string;
  status: SourceStatus;
  methods: string[];
  candidates: number;
  candidateTitles: string[];
  samples: CheckSample[];
  /** empfohlene Einstellungen für die Quelle */
  config: SourceConfig;
  institution: { id: string | null; name: string | null; cityId: string | null; kind: InstitutionKind | null; website: string | null };
  /** Steht diese Website schon im Register? */
  registered: { sourceId: string; label: string | null; url: string | null } | null;
  kindGuess: 'fachbereich' | 'zentral';
  gateGuess: 'none' | 'psych';
  ai: { verdict: CheckVerdict; summary: string } | null;
  verdict: CheckVerdict;
  notes: string[];
  durationMs: number;
  checkedAt: string;
}

export interface CheckDeps {
  ctx: DiscoverContext;
  institutions: Institution[];
  cities: City[];
  sources: Source[];
  today?: string;
}

const RANK: Record<CheckVerdict, number> = { gut: 2, mit_einschraenkungen: 1, ungeeignet: 0 };
const worse = (a: CheckVerdict, b: CheckVerdict): CheckVerdict => (RANK[a] <= RANK[b] ? a : b);

function probeSource(url: string, config: SourceConfig): Source {
  return { id: 'probe', institutionId: null, kind: 'zentral', label: 'Probelauf', url, adapter: 'auto', config, gate: 'none', enabled: true, verified: false, status: 'neu', consecutiveFailures: 0 };
}

/** Bis zu fünf verschiedene Kandidaten, bevorzugt mit Titel. */
function pickSamples(cands: Candidate[], n = 5): Candidate[] {
  const withTitle = cands.filter((c) => c.title && c.title.length > 8);
  return [...withTitle, ...cands.filter((c) => !withTitle.includes(c))].slice(0, n);
}

export async function runSourceCheck(rawUrl: string, existingSourceId: string | null, deps: CheckDeps): Promise<SourceCheckResult> {
  const t0 = Date.now();
  const { ctx } = deps;
  const today = deps.today ?? todayBerlin();
  const notes: string[] = [];
  const url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('Die Adresse muss mit http:// oder https:// beginnen.');

  // Schon im Register?
  const existing = existingSourceId ? deps.sources.find((s) => s.id === existingSourceId) ?? null : null;
  const key = siteKeyOf(url);
  const sameUrl = deps.sources.find((s) => s.url && s.id !== existingSourceId && canonicalUrl(s.url) === canonicalUrl(url));
  const sameSite = key ? deps.sources.find((s) => s.url && s.id !== existingSourceId && s.adapter !== 'erkundung' && siteKeyOf(s.url) === key) : undefined;
  const reg = sameUrl ?? sameSite ?? null;
  if (sameUrl) notes.push('Genau diese Adresse steht schon im Register.');
  else if (sameSite) notes.push('Von dieser Website steht schon eine andere Seite im Register.');

  let config: SourceConfig = existing ? { ...existing.config } : {};
  let listUrl = url;
  let res = await discover(probeSource(listUrl, config), ctx);

  // Startseite statt Stellenliste angegeben? Dann die Stellenseite suchen.
  if (res.candidates.length === 0 && res.status !== 'blockiert') {
    const found = await findJobsPage({ id: 'probe', name: new URL(url).hostname, kind: 'sonstige', cityId: null, website: url, active: true, origin: 'user' }, ctx).catch(() => null);
    if (found && canonicalUrl(found.url) !== canonicalUrl(url)) {
      const second = await discover(probeSource(found.url, config), ctx);
      if (second.candidates.length > 0) {
        notes.push(`Auf der angegebenen Seite standen keine Anzeigen; die Stellenseite ist vermutlich ${found.url} (${found.reason}).`);
        listUrl = found.url;
        res = second;
      }
    }
  }
  if (res.status === 'blockiert') notes.push('Die robots.txt der Website sperrt das Einsammeln. Das lässt sich pro Quelle bewusst übergehen.');
  if (res.methods.includes('browser')) {
    config = { ...config, render: true };
    notes.push('Die Liste erscheint erst per JavaScript; die Quelle wird im Browser geöffnet.');
  }

  // Probe-Anzeigen vollständig lesen
  const samples: CheckSample[] = [];
  const data: (PostingData | null)[] = [];
  let agentUses = 0;
  for (const c of pickSamples(res.candidates)) {
    let d: PostingData | null = c.prefilled ?? null;
    if (!d) {
      const r = await extractPosting(ctx.http, c.url, { titleHint: c.title, ignoreRobots: !!config.ignoreRobots }).catch(() => null);
      d = r?.data ?? null;
    }
    if ((!d || !d.complete) && ctx.browser && agentUses < 2 && ctx.browser.budgetLeft) {
      agentUses++;
      const a = await agentReadPosting(ctx.browser, ctx.http, ctx.llm, ctx.log, c.url, c.title).catch(() => null);
      if (a?.data && (!d || a.data.descriptionMd.length > d.descriptionMd.length)) d = a.data;
    }
    data.push(d);
    if (!d) {
      samples.push({ url: c.url, title: c.title ?? c.url, chars: 0, complete: false, method: '–', deadline: null, deadlineCheck: null, payGrade: null, workload: null, kind: null, excerpt: '', aiOk: null, problems: ['nicht lesbar'] });
      continue;
    }
    const plain = stripMarkdown(d.descriptionMd);
    const posted = d.postedAt?.slice(0, 10) ?? null;
    const f = extractFields(plain, { title: d.title, today, reference: posted ?? today });
    const dl = assessDeadline({ iso: f.deadline, raw: f.deadlineText, yearInferred: f.deadlineYearInferred, unclear: f.deadlineUnclear, structured: d.validThrough, postedAt: posted, today, isNew: true });
    samples.push({
      url: d.url || c.url,
      title: d.title || c.title || '(ohne Titel)',
      chars: d.descriptionMd.length,
      complete: d.complete,
      method: d.method,
      deadline: dl.deadline,
      deadlineCheck: dl.check,
      payGrade: f.payGrade,
      workload: f.workloadPct ? `${f.workloadPct} %` : f.workloadText,
      kind: classifyKind(d.title, d.descriptionMd),
      excerpt: truncate(plain.replace(/\s+/g, ' '), 280),
      aiOk: null,
      problems: d.complete ? [] : [d.incompleteReason ?? 'Text unvollständig'],
    });
  }

  // Einrichtung und Ort
  const instMatcher = new InstitutionMatcher(deps.institutions);
  const cityMatcher = new CityMatcher(deps.cities);
  const org = data.find((d) => d?.hiringOrg)?.hiringOrg ?? null;
  let instId = existing?.institutionId ?? instMatcher.match(org, listUrl);
  let instName: string | null = instId ? deps.institutions.find((i) => i.id === instId)?.name ?? null : org;
  let cityId: string | null = instId ? deps.institutions.find((i) => i.id === instId)?.cityId ?? null : cityMatcher.match(data.find((d) => d?.locationText)?.locationText ?? null);
  let instKind: InstitutionKind | null = instId ? deps.institutions.find((i) => i.id === instId)?.kind ?? null : null;
  let kindGuess: 'fachbereich' | 'zentral' = /psycholog|psychology|lehrstuhl|arbeitsgruppe|\/ag-|institut-fuer|institute/i.test(listUrl) ? 'fachbereich' : 'zentral';

  // KI-Urteil
  let ai: SourceCheckResult['ai'] = null;
  if (ctx.llm.available) {
    const page = await ctx.http.get(listUrl, { ignoreRobots: !!config.ignoreRobots });
    const html = page.ok && !page.isPdf ? page.text : '';
    const $ = html ? load(html) : null;
    const review = await ctx.llm.reviewSource({
      url: listUrl,
      pageTitle: ($ && pageTitle($)) || '',
      pageText: html ? visibleText(html, 2500) : '',
      links: res.candidates.slice(0, 40).map((c, i) => ({ i, text: c.title ?? '', url: c.url })),
      samples: samples.map((s, i) => ({
        i,
        title: s.title,
        url: s.url,
        text: data[i] ? stripMarkdown(data[i]!.descriptionMd) : '',
        fields: `Frist ${s.deadline ?? '–'}, Entgelt ${s.payGrade ?? '–'}, Umfang ${s.workload ?? '–'}, ${s.chars} Zeichen, ${s.complete ? 'vollständig' : 'unvollständig'}`,
      })),
    });
    if (review) {
      ai = { verdict: review.verdict, summary: review.summary_de };
      for (const sc of review.sample_checks) {
        const s = samples[sc.index];
        if (!s) continue;
        s.aiOk = sc.is_posting;
        s.problems = [...new Set([...s.problems, ...sc.problems])];
      }
      if (!instId) {
        instName = review.institution_name ?? instName;
        instKind = review.institution_type ?? instKind;
        cityId = cityId ?? cityMatcher.match(review.city);
        const again = instMatcher.match(review.institution_name, null);
        if (again) {
          instId = again;
          instName = deps.institutions.find((i) => i.id === again)?.name ?? instName;
          cityId = deps.institutions.find((i) => i.id === again)?.cityId ?? cityId;
        }
      }
      kindGuess = review.is_department_page ? 'fachbereich' : 'zentral';
      if (review.needs_browser && ctx.browser && !config.render) {
        config = { ...config, render: true };
        notes.push('Laut KI erscheinen die Anzeigen erst per JavaScript; die Quelle wird im Browser geöffnet.');
      }
      // Linkmuster der KI nur übernehmen, wenn es die bestätigten Anzeigen trifft und den Rest ausschließt
      if (review.link_pattern && !config.linkPattern) {
        try {
          const re = new RegExp(review.link_pattern, 'i');
          const yes = samples.filter((s) => s.aiOk === true);
          const no = samples.filter((s) => s.aiOk === false);
          if (yes.length > 0 && yes.every((s) => re.test(s.url)) && no.every((s) => !re.test(s.url))) {
            const withPattern = await discover(probeSource(listUrl, { ...config, linkPattern: review.link_pattern }), ctx);
            if (withPattern.candidates.length >= yes.length) {
              config = { ...config, linkPattern: review.link_pattern };
              notes.push(`Linkmuster übernommen: nur Adressen wie ${review.link_pattern} zählen als Anzeige (${withPattern.candidates.length} statt ${res.candidates.length} Treffer).`);
              res = withPattern;
            }
          }
        } catch {
          // ungültiger Ausdruck: ignorieren
        }
      }
    }
  }

  // Urteil aus Regeln (und KI)
  let verdict: CheckVerdict = 'gut';
  if (res.candidates.length === 0) {
    verdict = 'ungeeignet';
    notes.push(res.status === 'blockiert' ? 'Keine Anzeigen gelesen (gesperrt).' : 'Keine Anzeigen gefunden. Ist das die Seite mit der Stellenliste?');
  } else {
    const read = samples.filter((s) => s.chars > 0);
    const complete = samples.filter((s) => s.complete);
    if (read.length === 0) verdict = 'ungeeignet';
    else if (complete.length < Math.ceil(samples.length / 2)) {
      verdict = 'mit_einschraenkungen';
      notes.push('Mehrere Anzeigen ließen sich nicht vollständig lesen; der Browser-Agent versucht es beim Einsammeln erneut.');
    }
  }
  if (ai) verdict = worse(verdict, ai.verdict === 'ungeeignet' && res.candidates.length > 0 && samples.some((s) => s.aiOk) ? 'mit_einschraenkungen' : ai.verdict);

  return {
    url,
    listUrl,
    status: res.status,
    methods: res.methods,
    candidates: res.candidates.length,
    candidateTitles: res.candidates.slice(0, 12).map((c) => c.title ?? c.url),
    samples,
    config,
    institution: { id: instId, name: instName, cityId, kind: instKind, website: new URL(listUrl).origin },
    registered: reg ? { sourceId: reg.id, label: reg.label, url: reg.url } : null,
    kindGuess,
    gateGuess: kindGuess === 'fachbereich' ? 'none' : 'psych',
    ai,
    verdict,
    notes,
    durationMs: Date.now() - t0,
    checkedAt: new Date().toISOString(),
  };
}

/** Arbeitet wartende Probeläufe ab (eigener Workflow „Quelle prüfen“ oder am Anfang jedes Laufs). */
export async function processPendingChecks(db: Db, ctx: DiscoverContext, limit = 5): Promise<number> {
  const pending = await pendingSourceChecks(db, new Date(Date.now() - 60 * 60_000).toISOString(), limit);
  if (pending.length === 0) return 0;
  const [institutions, cities, sources] = await Promise.all([listInstitutions(db), listCities(db), listSources(db)]);
  let done = 0;
  for (const check of pending) {
    await startSourceCheck(db, check.id);
    ctx.log.info(`Probelauf ${check.id}: ${check.url}`);
    try {
      const result = await runSourceCheck(check.url, check.sourceId, { ctx, institutions, cities, sources });
      await finishSourceCheck(db, check.id, result, null);
      ctx.log.info(`Probelauf ${check.id}: ${result.verdict}, ${result.candidates} Anzeigen über ${result.methods.join(', ') || '–'} (${Math.round(result.durationMs / 1000)} s)`);
      done++;
    } catch (e) {
      await finishSourceCheck(db, check.id, null, errText(e).slice(0, 400));
      ctx.log.warn(`Probelauf ${check.id} fehlgeschlagen: ${errText(e)}`);
    }
  }
  return done;
}
