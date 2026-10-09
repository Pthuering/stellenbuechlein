// Anzeigen auf einer Quelle finden. Mehrere Wege, deren Ergebnisse zusammengeführt werden:
//   Feed (RSS/Atom/JSON) → Bewerbersystem-Schnittstelle → Listenseite (JSON-LD + Links + Seiten 2..n)
//   → Sitemap → Browser-Rendering → KI-Linkauswahl.

import type { Source, SourceConfig, SourceStatus } from '@stellen/core';
import { canonicalUrl, registrableHost } from '@stellen/core';
import { extractLinks, findFeedLinks, jobPostingsFrom, load, looksLikeJsShell, visibleText, type PageLink } from './html';
import { parseFeed, parseJsonFeed, parsePersonioXml, parseSitemap } from './feeds';
import { baDiscover } from './portals';
import type { Candidate } from './extract';
import type { Http } from './http';
import type { Llm } from './llm';
import type { BrowserPool } from './browser';
import type { IngestConfig } from './config';
import type { RunLog } from './log';

export interface DiscoverContext {
  http: Http;
  llm: Llm;
  browser: BrowserPool | null;
  cfg: IngestConfig;
  log: RunLog;
}

export interface DiscoveryResult {
  candidates: Candidate[];
  methods: string[];
  status: SourceStatus;
  note: string | null;
}

/** Voreinstellungen je Adapter/Portal. */
export const ADAPTER_DEFAULTS: Record<string, Partial<SourceConfig>> = {
  psychjob: { linkPattern: '/(?:de|en)/job/', maxPages: 8 },
  bite: { linkPattern: '/jobposting/[0-9a-f]{16,}' },
  umantis: { linkPattern: '/Vacancies/\\d+' },
  successfactors: { linkPattern: '/job/[^/]+/\\d+' },
  helixjobs: { linkPattern: 'jobad\\?prj=' },
  teamtailor: { linkPattern: '/jobs/\\d+' },
  stellenticket: { linkPattern: '/stellenausschreibungen?/' },
  prescreen: { linkPattern: '/job/' },
};

// ------------------------------------------------------------------ Link-Bewertung

const JOB_TEXT =
  /\((?:[mwdfxi]\s*[/|]\s*){1,3}[mwdfxi]\)|\b[mwdf]\/[mwdf]\/[mwdf]\b|wissenschaftliche[rn]?\b|wiss\.\s*mitarbeit|akademische[rn]? mitarbeit|doktorand|promotion|postdoc|post-doc|professur|juniorprofess|\bph\.?\s?d\b|research (?:associate|assistant|scientist|fellow)|scientist|referent(?:in)?\b|koordinat|projektmitarbeit|hilfskr|lecturer|lehrkraft|psycholog|therapeut|stellenausschreibung|kennziffer|\bposition\b|vacancy|mitarbeiter(?:in)?\b|sachbearbeit|leitung/i;
const JOB_URL = /stellen|stelle\b|\/jobs?\b|\/job\/|karriere|career|ausschreib|vacanc|position|jobposting|jobad|stellenangebot|offene-stellen|recruit|\/vacancies\/|\.pdf(?:$|\?)/i;
const NAV_TEXT =
  /^(?:impressum|datenschutz(?:erklärung)?|kontakt|sitemap|barrierefreiheit|erklärung zur barrierefreiheit|login|anmelden|newsletter|presse|startseite|home|zurück|back|weiter|next|suche|search|english|deutsch|en|de|alle stellen(?:angebote)?|stellenangebote|stellenmarkt|jobs|karriere|jobportal|job-?alert|initiativbewerbung|faq|hilfe|teilen|share|drucken|print|mehr|more|übersicht|zur übersicht|top|nach oben|menü|menu)$/i;
const NAV_URL = /impressum|datenschutz|privacy|sitemap|barrierefrei|accessibility|\/login|logout|newsletter|\/presse|facebook\.com|twitter\.com|\/\/x\.com|instagram\.com|youtube\.com|xing\.com|linkedin\.com\/(?:company|in|feed)|mailto:|initiativ|jobalert|job-alert|\/rss|\.atom$|\/feed\/?$|\/search\/?\?|\?(?:sort|filter)=/i;
const NON_POSTING_PDF = /datenschutz|privacy|impressum|satzung|ordnung|formular|merkblatt|leitfaden|brosch|flyer|antrag|richtlinie|gleichstellung|agb|verordnung|tarif|entgelttabelle|besoldungstabelle/i;
const ATS_DETAIL = /\/jobposting\/[0-9a-f]{16,}|\/vacancies\/\d+|\/job\/[^/?#]+\/\d+|jobad\?prj=|-j\d+\.html|\/jobs\/\d+|\/stellenausschreibungen?\/\d+|\/job\/\d+|\/jobdetail|stellenangebot\/\d+|job_id=|jobid=/i;

export function scoreLink(link: PageLink, listUrl: string): number {
  const text = link.text;
  const url = link.url;
  if (NAV_URL.test(url) || NAV_TEXT.test(text.trim())) return -10;
  const isPdf = /\.pdf(?:$|\?)/i.test(url);
  if (isPdf && NON_POSTING_PDF.test(`${text} ${url}`)) return -10;
  let s = 0;
  if (JOB_TEXT.test(text)) s += 3;
  if (JOB_URL.test(url)) s += 2;
  if (ATS_DETAIL.test(url)) s += 3;
  if (link.inMain) s += 1;
  if (isPdf && link.inMain) s += 2;
  if (/frist|bewerbungsschluss|deadline|kennziffer|\d{1,2}\.\d{1,2}\.\d{2,4}|e\s?1[0-5]\b|tv-?l|tvöd/i.test(link.context)) s += 1;
  if (text.length > 25 && text.length < 220) s += 1;
  const lu = new URL(listUrl);
  const u = new URL(url);
  const listCanon = canonicalUrl(listUrl);
  const canon = canonicalUrl(url);
  if (canon === listCanon) return -10;
  if (u.host === lu.host && lu.pathname.startsWith(u.pathname) && u.pathname.length < lu.pathname.length) s -= 4; // Elternseite
  if (u.host === lu.host && u.pathname === lu.pathname && u.search !== lu.search) s -= 3; // nur andere Filter/Seite
  return s;
}

function sameSite(a: string, b: string): boolean {
  return registrableHost(a) === registrableHost(b);
}

export function pickPostingLinks(links: PageLink[], listUrl: string, cfg: SourceConfig): PageLink[] {
  const pattern = cfg.linkPattern ? new RegExp(cfg.linkPattern, 'i') : null;
  const out: PageLink[] = [];
  const seen = new Set<string>();
  for (const l of links) {
    const canon = canonicalUrl(l.url);
    if (seen.has(canon)) continue;
    if (pattern) {
      if (!pattern.test(l.url) || NAV_URL.test(l.url)) continue;
    } else {
      const s = scoreLink(l, listUrl);
      const need = sameSite(l.url, listUrl) ? 4 : 5;
      if (s < need) continue;
    }
    seen.add(canon);
    out.push(l);
  }
  return out;
}

// ------------------------------------------------------------------ Seiten 2..n

const PAGE_PARAM = /^(?:page|seite|p|pg|start|startrow|offset|from|pagenr|pagenumber|tx_[a-z_]+\[@?page\]|\w*%5Bpage%5D)$/i;

export function findNextPages(links: PageLink[], listUrl: string): string[] {
  const lu = new URL(listUrl);
  const out: string[] = [];
  for (const l of links) {
    let u: URL;
    try {
      u = new URL(l.url);
    } catch {
      continue;
    }
    if (u.host !== lu.host) continue;
    const stripPage = (p: string) => p.replace(/\/(?:seite|page|p)\/\d+\/?$/i, '').replace(/\/$/, '');
    const relNext = l.rel.includes('next');
    const pathPaged = /\/(?:seite|page|p)\/\d+\/?$/i.test(u.pathname) && stripPage(u.pathname) === stripPage(lu.pathname);
    const paramPaged = u.pathname === lu.pathname && [...u.searchParams.keys()].some((k) => PAGE_PARAM.test(k));
    if (relNext || pathPaged || paramPaged) {
      if (canonicalUrl(u.toString()) !== canonicalUrl(listUrl)) out.push(u.toString());
    }
  }
  return [...new Set(out)];
}

// ------------------------------------------------------------------ einzelne Wege

async function viaFeed(url: string, ctx: DiscoverContext, via: string, ignoreRobots?: boolean): Promise<Candidate[]> {
  const r = await ctx.http.get(url, { accept: 'application/rss+xml, application/atom+xml, application/json, application/xml;q=0.9, */*;q=0.5', ignoreRobots });
  if (!r.ok) return [];
  return parseFeed(r.text, r.url, via);
}

function atsOf(url: string, cfg: SourceConfig): string | null {
  if (cfg.ats) return cfg.ats;
  if (/\.jobs\.personio\.(?:de|com)/i.test(url)) return 'personio';
  if (/myworkdayjobs\.com/i.test(url)) return 'workday';
  if (/softgarden\.(?:io|de)/i.test(url)) return 'softgarden';
  if (/umantis\.com/i.test(url)) return 'umantis';
  if (/helixjobs\.com/i.test(url)) return 'helixjobs';
  if (/onlyfy\.jobs|prescreenapp\.io/i.test(url)) return 'prescreen';
  if (/teamtailor\.com|career[s-]?\w*\.mpib-berlin/i.test(url)) return 'teamtailor';
  return null;
}

async function viaPersonio(url: string, ctx: DiscoverContext): Promise<Candidate[]> {
  const origin = new URL(url).origin;
  const r = await ctx.http.get(`${origin}/xml?language=de`, { accept: 'application/xml' });
  return r.ok ? parsePersonioXml(r.text, origin) : [];
}

async function viaWorkday(url: string, ctx: DiscoverContext, maxPages: number): Promise<Candidate[]> {
  const u = new URL(url);
  const tenant = u.hostname.split('.')[0];
  const parts = u.pathname.split('/').filter(Boolean);
  const site = parts.find((p) => !/^[a-z]{2}-[A-Z]{2}$/.test(p)) ?? parts[0];
  if (!site) return [];
  const api = `${u.origin}/wday/cxs/${tenant}/${site}/jobs`;
  const out: Candidate[] = [];
  for (let page = 0; page < maxPages * 3; page++) {
    const r = await ctx.http.get(api, {
      method: 'POST',
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: page * 20, searchText: '' }),
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      noCache: true,
    });
    if (!r.ok) break;
    const data = JSON.parse(r.text) as { total?: number; jobPostings?: { title?: string; externalPath?: string; locationsText?: string; postedOn?: string }[] };
    const list = data.jobPostings ?? [];
    for (const j of list) {
      if (!j.externalPath) continue;
      const detailUrl = `${u.origin}/${site}${j.externalPath}`;
      out.push({ url: detailUrl, title: j.title ?? null, via: 'ats:workday', hints: { locality: j.locationsText ?? null } });
    }
    if (list.length < 20 || out.length >= (data.total ?? 0)) break;
  }
  return out;
}

/** Workday-Detail über die JSON-Schnittstelle (Text steht nicht im HTML). */
export async function workdayDetail(http: Http, detailUrl: string): Promise<{ title: string; html: string; location: string | null; posted: string | null } | null> {
  const u = new URL(detailUrl);
  const tenant = u.hostname.split('.')[0];
  const parts = u.pathname.split('/').filter(Boolean);
  const siteIdx = parts.findIndex((p) => !/^[a-z]{2}-[A-Z]{2}$/.test(p));
  if (siteIdx < 0) return null;
  const site = parts[siteIdx];
  const rest = parts.slice(siteIdx + 1).join('/');
  const r = await http.get(`${u.origin}/wday/cxs/${tenant}/${site}/${rest}`, { accept: 'application/json' });
  if (!r.ok) return null;
  try {
    const d = JSON.parse(r.text) as { jobPostingInfo?: { title?: string; jobDescription?: string; location?: string; startDate?: string } };
    const info = d.jobPostingInfo;
    if (!info?.jobDescription) return null;
    return { title: info.title ?? '', html: info.jobDescription, location: info.location ?? null, posted: info.startDate ?? null };
  } catch {
    return null;
  }
}

async function viaSitemap(listUrl: string, ctx: DiscoverContext, ignoreRobots?: boolean): Promise<Candidate[]> {
  const lu = new URL(listUrl);
  const prefix = lu.pathname.replace(/\/[^/]*$/, '/');
  const maps = new Set<string>([...(await ctx.http.sitemapsFor(lu.origin)), `${lu.origin}/sitemap.xml`]);
  const queue = [...maps];
  const urls: string[] = [];
  let fetched = 0;
  while (queue.length && fetched < 6) {
    const sm = queue.shift()!;
    fetched++;
    const r = await ctx.http.get(sm, { accept: 'application/xml', ignoreRobots });
    if (!r.ok) continue;
    const parsed = parseSitemap(r.text);
    const subs = parsed.sitemaps.sort((a, b) => Number(/job|stelle|karriere|career/i.test(b)) - Number(/job|stelle|karriere|career/i.test(a)));
    queue.push(...subs.slice(0, 5));
    for (const e of parsed.urls) {
      try {
        const u = new URL(e.loc);
        if (u.host !== lu.host) continue;
        if (canonicalUrl(e.loc) === canonicalUrl(listUrl)) continue;
        const underList = prefix.length > 1 && u.pathname.startsWith(prefix) && u.pathname.length > prefix.length + 3;
        if (underList || ATS_DETAIL.test(e.loc) || /stellenausschreibung|stellenangebot\/|\/stellen\/[^/]+|\/jobs?\/[^/]+/i.test(u.pathname)) urls.push(e.loc);
      } catch {
        continue;
      }
    }
  }
  return [...new Set(urls)].slice(0, 300).map((url) => ({ url, via: 'sitemap' }));
}

async function viaLlm(listUrl: string, html: string, ctx: DiscoverContext): Promise<Candidate[]> {
  if (!ctx.llm.available) return [];
  const $ = load(html);
  const links = extractLinks($, listUrl).filter((l) => !NAV_URL.test(l.url) && l.text.length > 2);
  if (links.length === 0) return [];
  const numbered = links.slice(0, 250).map((l, i) => ({ i, text: l.text, url: l.url }));
  const r = await ctx.llm.pickPostingLinks(visibleText(html, 6000), numbered);
  if (!r) return [];
  return r.posting_links
    .map((i) => numbered[i])
    .filter(Boolean)
    .map((l) => ({ url: l.url, title: l.text, via: 'llm' }));
}

/** Liest eine Listenseite (statisches oder gerendertes HTML) inkl. JSON-LD und Links. */
function candidatesFromListHtml(html: string, url: string, cfg: SourceConfig, via: string): { candidates: Candidate[]; links: PageLink[]; feeds: string[] } {
  const $ = load(html);
  const candidates: Candidate[] = [];
  for (const jp of jobPostingsFrom($)) {
    if (jp.url) candidates.push({ url: new URL(jp.url, url).toString(), title: jp.title, via: `${via}:jsonld`, hints: { locality: jp.locality, org: jp.hiringOrganization } });
  }
  const links = extractLinks($, url);
  for (const l of pickPostingLinks(links, url, cfg)) candidates.push({ url: l.url, title: l.text || null, via });
  return { candidates, links, feeds: findFeedLinks($, url) };
}

function merge(into: Map<string, Candidate>, list: Candidate[]): number {
  let added = 0;
  for (const c of list) {
    const key = canonicalUrl(c.url);
    const existing = into.get(key);
    if (!existing) {
      into.set(key, c);
      added++;
    } else if (!existing.prefilled && c.prefilled) {
      into.set(key, { ...c, title: c.title ?? existing.title });
    } else if (!existing.title && c.title) {
      existing.title = c.title;
    }
  }
  return added;
}

// ------------------------------------------------------------------ Gesamt

export async function discover(source: Source, ctx: DiscoverContext): Promise<DiscoveryResult> {
  const cfg: SourceConfig = { ...(ADAPTER_DEFAULTS[source.adapter] ?? {}), ...(ADAPTER_DEFAULTS[source.config.ats ?? ''] ?? {}), ...source.config };
  const methods: string[] = [];
  const found = new Map<string, Candidate>();
  const notes: string[] = [];
  const ignoreRobots = !!cfg.ignoreRobots;
  const maxPages = cfg.maxPages ?? ctx.cfg.maxPagesPerList;

  if (!source.url) return { candidates: [], methods, status: 'url-fehlt', note: 'Keine Adresse hinterlegt' };

  // Portale mit eigener Schnittstelle
  if (source.adapter === 'ba-jobsuche') {
    try {
      const list = await baDiscover(source, ctx);
      merge(found, list);
      methods.push('ba-api');
      return { candidates: [...found.values()], methods, status: list.length ? 'ok' : 'leer', note: null };
    } catch (e) {
      return { candidates: [], methods, status: 'fehler', note: `BA-Schnittstelle: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // 1) Feed
  if (cfg.feedUrl) {
    const list = cfg.feedUrl.endsWith('.json')
      ? await ctx.http.get(cfg.feedUrl, { accept: 'application/json', ignoreRobots }).then((r) => (r.ok ? parseJsonFeed(r.text, r.url, 'json-feed') : []))
      : await viaFeed(cfg.feedUrl, ctx, 'feed', ignoreRobots);
    if (merge(found, list) > 0 || list.length) methods.push(cfg.feedUrl.endsWith('.json') ? 'json-feed' : 'feed');
  }

  // 2) Bewerbersystem-Schnittstellen
  const ats = atsOf(source.url, cfg);
  if (ats === 'personio') {
    const list = await viaPersonio(source.url, ctx);
    if (list.length) methods.push('ats:personio');
    merge(found, list);
  } else if (ats === 'workday') {
    const list = await viaWorkday(source.url, ctx, maxPages);
    if (list.length) methods.push('ats:workday');
    merge(found, list);
  } else if (ats === 'softgarden' && !cfg.feedUrl) {
    const origin = new URL(source.url).origin;
    const r = await ctx.http.get(`${origin}/jobs.feed.json`, { accept: 'application/json', ignoreRobots });
    if (r.ok) {
      const list = parseJsonFeed(r.text, r.url, 'ats:softgarden');
      if (list.length) methods.push('ats:softgarden');
      merge(found, list);
    }
  }

  // 3) Listenseite + Folgeseiten
  let listHtml = '';
  let listStatus = 0;
  let blocked = false;
  const first = await ctx.http.get(source.url, { ignoreRobots });
  listStatus = first.status;
  if (first.blockedByRobots) {
    blocked = true;
    notes.push('robots.txt sperrt die Listenseite');
  } else if (!first.ok) {
    notes.push(`Listenseite nicht erreichbar (${first.error ?? first.status})`);
  } else if (first.isPdf) {
    merge(found, [{ url: first.url, via: 'pdf' }]);
    methods.push('pdf');
  } else {
    listHtml = first.text;
    const { candidates, links, feeds } = candidatesFromListHtml(first.text, first.url, cfg, 'liste');
    if (merge(found, candidates) > 0) methods.push('liste');
    for (const f of feeds.slice(0, 2)) {
      if (f === cfg.feedUrl) continue;
      const list = await viaFeed(f, ctx, 'feed', ignoreRobots);
      if (merge(found, list) > 0) methods.push('feed (auf Seite gefunden)');
    }
    // Folgeseiten
    const visited = new Set([canonicalUrl(first.url)]);
    let queue = findNextPages(links, first.url);
    let pages = 1;
    if (ats === 'successfactors' || /\/search\/\?/.test(source.url)) {
      const base = new URL(first.url);
      queue = [];
      for (let i = 1; i < maxPages; i++) {
        const u = new URL(base.toString());
        u.searchParams.set('startrow', String(i * 25));
        queue.push(u.toString());
      }
    }
    while (queue.length && pages < maxPages) {
      const next = queue.shift()!;
      const key = canonicalUrl(next);
      if (visited.has(key)) continue;
      visited.add(key);
      const r = await ctx.http.get(next, { ignoreRobots });
      if (!r.ok || r.isPdf) continue;
      pages++;
      const res = candidatesFromListHtml(r.text, r.url, cfg, 'liste');
      const added = merge(found, res.candidates);
      if (added === 0 && /startrow=/.test(next)) break;
      for (const n of findNextPages(res.links, r.url)) if (!visited.has(canonicalUrl(n))) queue.push(n);
    }
    if (pages > 1) methods.push(`${pages} Listenseiten`);
  }

  // 4) Browser, wenn statisch nichts kam oder die Seite JavaScript braucht
  const needsRender = cfg.render || (listHtml && looksLikeJsShell(listHtml)) || ats === 'bite' || ats === 'teamtailor';
  if (ctx.browser && (needsRender || (found.size === 0 && !blocked)) && ctx.browser.budgetLeft) {
    const rendered = await ctx.browser.renderList(source.url);
    if (rendered) {
      listHtml = rendered.html;
      const { candidates } = candidatesFromListHtml(rendered.html, rendered.url, cfg, 'browser');
      if (merge(found, candidates) > 0) methods.push('browser');
      blocked = false;
    }
  }

  // 5) Sitemap als zusätzliches Netz, wenn bisher nichts gefunden wurde
  if (found.size === 0 && !blocked && source.kind !== 'portal') {
    const list = await viaSitemap(source.url, ctx, ignoreRobots);
    if (merge(found, list) > 0) methods.push('sitemap');
  }

  // 6) KI wählt Links, wenn die Regeln nichts erkennen
  if (found.size === 0 && listHtml && visibleText(listHtml, 2000).length > 300) {
    const list = await viaLlm(source.url, listHtml, ctx);
    if (merge(found, list) > 0) methods.push('ki-links');
  }

  const candidates = [...found.values()];
  let status: SourceStatus;
  if (candidates.length > 0) status = 'ok';
  else if (blocked) status = 'blockiert';
  else if (listStatus === 403 || listStatus === 401) status = 'blockiert';
  else if (!listHtml && !first.ok) status = 'fehler';
  else status = 'leer';
  return { candidates, methods, status, note: notes.join('; ') || null };
}
