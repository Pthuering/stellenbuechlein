// Öffentliche JSON-Schnittstellen von Bewerbermanagement-Systemen, die vor allem Unternehmen nutzen:
// Greenhouse, Lever, SmartRecruiters, Recruitee, Ashby, dazu die Karriereseiten von Hidden Professionals
// (career.<hochschule>.de, z. B. TU Darmstadt, Goethe-Uni Frankfurt, JGU Mainz). Die Listen liefern (außer SmartRecruiters)
// den ganzen Anzeigentext mit, die Detailseite muss dann nicht mehr gelesen werden.
// Die parse*-Funktionen sind vom Netz getrennt, damit sie sich mit Beispieldaten prüfen lassen.
// Hinweis: Die Schnittstelle von SmartRecruiters sperrt per robots.txt alle Abrufer außer LinkedIn;
// sie ist nur mit dem Standard ROBOTS=0 (oder „robots.txt übergehen“ an der Quelle) lesbar.

import { htmlToMarkdown, load, readJobPosting } from './html';
import { assessCompleteness, type Candidate, type PostingData } from './extract';
import type { Http } from './http';

export type JsonAts = 'greenhouse' | 'lever' | 'smartrecruiters' | 'recruitee' | 'ashby' | 'hpcareer';

export const JSON_ATS: readonly JsonAts[] = ['greenhouse', 'lever', 'smartrecruiters', 'recruitee', 'ashby', 'hpcareer'];

const HP_API = 'https://api.career.hidden-professionals.de';

/** Erkennt das System an der Adresse der Stellenliste. */
export function jsonAtsOf(url: string): JsonAts | null {
  if (/(?:^|\.)greenhouse\.io\//i.test(url) || /\/\/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io/i.test(url)) return 'greenhouse';
  if (/\/\/(?:jobs|api)(?:\.eu)?\.lever\.co\//i.test(url)) return 'lever';
  if (/smartrecruiters\.com/i.test(url)) return 'smartrecruiters';
  if (/\.recruitee\.com/i.test(url)) return 'recruitee';
  if (/(?:jobs|api)\.ashbyhq\.com/i.test(url)) return 'ashby';
  if (/api\.career\.hidden-professionals\.de/i.test(url)) return 'hpcareer';
  return null;
}

/** Erster Pfadabschnitt (bzw. der nach einem festen Präfix), z. B. der Firmenname. */
function segment(url: string, after?: RegExp): string | null {
  try {
    const u = new URL(url);
    const path = after ? u.pathname.replace(after, '') : u.pathname;
    return path.split('/').filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

/** Adresse der Schnittstelle für eine Stellenliste. */
export function jsonAtsApi(ats: JsonAts, listUrl: string): string | null {
  const u = new URL(listUrl);
  switch (ats) {
    case 'greenhouse': {
      const token = /boards-api/.test(u.hostname) ? segment(listUrl, /^\/v1\/boards/) : (u.searchParams.get('for') ?? segment(listUrl, /^\/embed\/job_board/));
      return token ? `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true` : null;
    }
    case 'lever': {
      const company = segment(listUrl, /^\/v0\/postings/);
      const eu = /\.eu\.lever\.co/i.test(u.hostname);
      return company ? `https://api.${eu ? 'eu.' : ''}lever.co/v0/postings/${company}?mode=json` : null;
    }
    case 'smartrecruiters': {
      const company = /api\.smartrecruiters\.com/i.test(u.hostname) ? segment(listUrl, /^\/v1\/companies/) : segment(listUrl);
      if (!company) return null;
      const api = new URL(`https://api.smartrecruiters.com/v1/companies/${company}/postings`);
      const q = u.searchParams.get('q') ?? u.searchParams.get('search');
      if (q) api.searchParams.set('q', q);
      for (const k of ['country', 'city', 'department']) {
        const v = u.searchParams.get(k);
        if (v) api.searchParams.set(k, v);
      }
      return api.toString();
    }
    case 'recruitee':
      return `${u.origin}/api/offers/`;
    case 'ashby': {
      const org = /api\.ashbyhq\.com/i.test(u.hostname) ? segment(listUrl, /^\/posting-api\/job-board/) : segment(listUrl);
      return org ? `https://api.ashbyhq.com/posting-api/job-board/${org}` : null;
    }
    case 'hpcareer': {
      // career.tu-darmstadt.de/tu-darmstadt/jobs → Kürzel „tu-darmstadt“
      const slug = /hidden-professionals/i.test(u.hostname) ? segment(listUrl, /^\/company\/listjobs/) : segment(listUrl);
      return slug ? `${HP_API}/company/listjobs/${slug}` : null;
    }
  }
}

/** Greenhouse liefert den Text als maskiertes HTML („&lt;p&gt;“). */
function unescapeHtml(s: string): string {
  return /&lt;\w/.test(s) ? load(`<div>${s}</div>`)('div').text() : s;
}

function posting(url: string, title: string, html: string, method: string, extra: Partial<PostingData> = {}): Candidate {
  const md = htmlToMarkdown(html);
  const a = assessCompleteness(md);
  return {
    url,
    title,
    via: method,
    hints: { locality: extra.locationText ?? null, postedAt: extra.postedAt ?? null, org: extra.hiringOrg ?? null },
    prefilled: { url, title, descriptionMd: md, method, complete: a.complete, incompleteReason: a.reason, ...extra },
  };
}

type Obj = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const o = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);

export function parseGreenhouse(body: string): Candidate[] {
  const jobs = arr(o(JSON.parse(body)).jobs);
  return jobs.flatMap((j) => {
    const url = s(j.absolute_url);
    const title = s(j.title);
    if (!url || !title) return [];
    return [posting(url, title, unescapeHtml(s(j.content) ?? ''), 'ats:greenhouse', { locationText: s(o(j.location).name), postedAt: s(j.first_published) ?? s(j.updated_at), department: s(arr(j.departments)[0]?.name) })];
  });
}

export function parseLever(body: string): Candidate[] {
  return arr(JSON.parse(body)).flatMap((j) => {
    const url = s(j.hostedUrl);
    const title = s(j.text);
    if (!url || !title) return [];
    const lists = arr(j.lists)
      .map((l) => `<h2>${s(l.text) ?? ''}</h2>${s(l.content) ?? ''}`)
      .join('');
    const html = `${s(j.description) ?? ''}${lists}${s(j.additional) ?? ''}`;
    const cat = o(j.categories);
    const created = typeof j.createdAt === 'number' ? new Date(j.createdAt).toISOString() : null;
    return [posting(url, title, html, 'ats:lever', { locationText: s(cat.location), department: s(cat.team), postedAt: created })];
  });
}

export function parseRecruitee(body: string): Candidate[] {
  return arr(o(JSON.parse(body)).offers).flatMap((j) => {
    const url = s(j.careers_url);
    const title = s(j.title);
    if (!url || !title) return [];
    const html = `${s(j.description) ?? ''}${s(j.requirements) ? `<h2>Anforderungen</h2>${s(j.requirements)}` : ''}`;
    return [posting(url, title, html, 'ats:recruitee', { locationText: s(j.location) ?? s(j.city), department: s(j.department), postedAt: s(j.published_at) ?? s(j.created_at) })];
  });
}

export function parseAshby(body: string): Candidate[] {
  return arr(o(JSON.parse(body)).jobs).flatMap((j) => {
    if (j.isListed === false) return [];
    const url = s(j.jobUrl);
    const title = s(j.title);
    if (!url || !title) return [];
    return [posting(url, title, s(j.descriptionHtml) ?? '', 'ats:ashby', { locationText: s(j.location), department: s(j.department), postedAt: s(j.publishedAt) })];
  });
}

/** SmartRecruiters: Die Liste hat nur Titel und Ort, den Text holt smartrecruitersDetail. */
export function parseSmartRecruitersList(body: string): { candidates: Candidate[]; total: number } {
  const d = o(JSON.parse(body));
  const candidates = arr(d.content).flatMap((j): Candidate[] => {
    const id = s(j.id) ?? (typeof j.id === 'number' ? String(j.id) : null);
    const company = s(o(j.company).identifier);
    const title = s(j.name);
    if (!id || !company || !title) return [];
    const loc = o(j.location);
    return [{ url: `https://jobs.smartrecruiters.com/${company}/${id}`, title, via: 'ats:smartrecruiters', hints: { locality: s(loc.city), country: s(loc.country), postedAt: s(j.releasedDate), org: s(o(j.company).name) } }];
  });
  return { candidates, total: typeof d.totalFound === 'number' ? d.totalFound : candidates.length };
}

export function parseSmartRecruitersDetail(body: string, url: string): PostingData | null {
  const d = o(JSON.parse(body));
  const title = s(d.name);
  const sections = o(o(d.jobAd).sections);
  const html = ['jobDescription', 'qualifications', 'additionalInformation', 'companyDescription']
    .map((k) => o(sections[k]))
    .filter((x) => s(x.text))
    .map((x) => `<h2>${s(x.title) ?? ''}</h2>${s(x.text)}`)
    .join('');
  if (!title || !html) return null;
  const md = htmlToMarkdown(html);
  const a = assessCompleteness(md);
  const loc = o(d.location);
  return { url, title, descriptionMd: md, locationText: s(loc.city), country: s(loc.country), postedAt: s(d.releasedDate), hiringOrg: s(o(d.company).name), method: 'ats:smartrecruiters', complete: a.complete, incompleteReason: a.reason };
}

/** Übersetzte Felder der Hidden-Professionals-Schnittstelle: [{ languageKey, translation }]. */
function hpText(v: unknown): string | null {
  const list = arr(v);
  return s((list.find((x) => x.languageKey === 'de-DE') ?? list[0])?.translation);
}

/** Hidden Professionals: Die Liste hat Titel, Bereich und Ort, den Text holt hpCareerDetail. */
export function parseHpCareerList(body: string): Candidate[] {
  return arr(JSON.parse(body)).flatMap((j): Candidate[] => {
    const url = s(j.advertUrl);
    const title = hpText(j.name);
    if (!url || !title) return [];
    const dept = hpText(j.department);
    return [{ url, title: dept ? `${title} – ${dept}` : title, via: 'ats:hpcareer', hints: { locality: hpText(j.location), postedAt: s(j.startDateUtc), org: s(j.companyName) } }];
  });
}

/** Detail: Die Schnittstelle liefert die Anzeige als JobPosting (JSON-LD), oft mit rohen Zeilenumbrüchen. */
export function parseHpCareerDetail(body: string, url: string): PostingData | null {
  const raw = s(o(JSON.parse(body)).google4JobsData);
  if (!raw) return null;
  const ld = readJobPosting(JSON.parse(raw.replace(/[\u0000-\u001F]+/g, ' ')) as Record<string, unknown>);
  if (!ld.title || !ld.descriptionHtml) return null;
  const md = htmlToMarkdown(ld.descriptionHtml);
  const a = assessCompleteness(md);
  return {
    url,
    title: ld.title,
    descriptionMd: md,
    locationText: ld.locality,
    country: ld.country,
    postedAt: ld.datePosted,
    validThrough: ld.validThrough,
    hiringOrg: ld.hiringOrganization,
    referenceNo: ld.identifier,
    method: 'ats:hpcareer',
    complete: a.complete,
    incompleteReason: a.reason,
  };
}

/** Stellenliste über die Schnittstelle; [] wenn nichts kam. */
export async function viaJsonAts(ats: JsonAts, listUrl: string, http: Http, maxPages: number, ignoreRobots = false): Promise<Candidate[]> {
  const api = jsonAtsApi(ats, listUrl);
  if (!api) return [];
  try {
    if (ats === 'smartrecruiters') {
      const out: Candidate[] = [];
      for (let page = 0; page < maxPages * 2; page++) {
        const u = new URL(api);
        u.searchParams.set('limit', '100');
        u.searchParams.set('offset', String(page * 100));
        const r = await http.get(u.toString(), { accept: 'application/json', ignoreRobots });
        if (!r.ok) break;
        const { candidates, total } = parseSmartRecruitersList(r.text);
        out.push(...candidates);
        if (candidates.length < 100 || out.length >= total) break;
      }
      return out;
    }
    const r = await http.get(api, { accept: 'application/json', ignoreRobots });
    if (!r.ok) return [];
    if (ats === 'greenhouse') return parseGreenhouse(r.text);
    if (ats === 'lever') return parseLever(r.text);
    if (ats === 'recruitee') return parseRecruitee(r.text);
    if (ats === 'hpcareer') return parseHpCareerList(r.text);
    return parseAshby(r.text);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- BITE (viele Hochschulen)

/** Listen, die eine Seite per BITE einbindet: data-bite-jobs-api-listing="kunde:liste" oder das Listen-Skript. */
export function biteListingsIn(html: string): { customer: string; listing: string }[] {
  const out = new Map<string, { customer: string; listing: string }>();
  for (const m of html.matchAll(/data-bite-jobs-api-listing=["']([a-z0-9-]+):([a-z0-9_-]+)["']/gi)) out.set(`${m[1]}:${m[2]}`, { customer: m[1], listing: m[2] });
  for (const m of html.matchAll(/cs-assets\.b-ite\.com\/([a-z0-9-]+)\/jobs-api\/([a-z0-9_-]+?)(?:\.min)?\.js/gi)) {
    if (!/^(?:loader|api)-/.test(m[2])) out.set(`${m[1]}:${m[2]}`, { customer: m[1], listing: m[2] });
  }
  return [...out.values()];
}

/**
 * Schlüssel, Kanal und Filter aus dem Listen-Skript. Der Filter steht dort oft über eine Variable
 * („custom.zuordnung“: {in: e}, mit e = "wissenschaftliches_personal"); was sich nicht sicher lesen lässt,
 * bleibt weg (dann kommen alle Stellen des Kanals, der Grobfilter sortiert).
 */
export function parseBiteListingScript(js: string): { key: string; channel: number; filter: Record<string, { in: string[] }> | null } | null {
  const key = /key:\s*"([0-9a-f]{40})"/.exec(js)?.[1];
  if (!key) return null;
  const vars = new Map<string, string[]>();
  for (const m of js.matchAll(/\b([a-zA-Z_$][\w$]?)\s*=\s*("(?:[^"\\]|\\.)*"|\d+|\[(?:\s*"[^"]*"\s*,?)*\])/g)) {
    const v = m[2];
    vars.set(m[1], v.startsWith('[') ? [...v.matchAll(/"([^"]*)"/g)].map((x) => x[1]) : [v.replace(/^"|"$/g, '')]);
  }
  const chRaw = /channel:\s*(\d+|[a-zA-Z_$][\w$]?)/.exec(js)?.[1] ?? '0';
  const channel = /^\d+$/.test(chRaw) ? Number(chRaw) : Number(vars.get(chRaw)?.[0] ?? 0) || 0;
  const filter: Record<string, { in: string[] }> = {};
  for (const m of js.matchAll(/"(custom\.[\w.]+)":\s*\{\s*in:\s*(\[[^\]]*\]|[a-zA-Z_$][\w$]?)\s*\}/g)) {
    const values = m[2].startsWith('[') ? [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : vars.get(m[2]);
    if (values?.length) filter[m[1]] = { in: values };
  }
  return { key, channel, filter: Object.keys(filter).length ? filter : null };
}

export function parseBitePostings(body: string): { candidates: Candidate[]; total: number } {
  const d = o(JSON.parse(body));
  const candidates = arr(d.jobPostings).flatMap((j): Candidate[] => {
    const url = s(j.url);
    const title = s(j.title);
    if (!url || !title) return [];
    return [{ url, title, via: 'ats:bite', hints: { locality: s(o(j.address).city), postedAt: s(j.activatedOn) ?? s(j.startsOn), org: s(o(j.employer).name) } }];
  });
  const total = typeof d.total === 'number' ? d.total : typeof o(d.page).total === 'number' ? (o(d.page).total as number) : candidates.length;
  return { candidates, total };
}

/** Alle BITE-Listen einer Seite über die Schnittstelle von jobs.b-ite.com lesen (ohne Browser). */
export async function viaBite(html: string, http: Http, maxPages: number, ignoreRobots = false): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const { customer, listing } of biteListingsIn(html).slice(0, 4)) {
    const js = await http.get(`https://cs-assets.b-ite.com/${customer}/jobs-api/${listing}.min.js`, { accept: '*/*', ignoreRobots });
    const cfg = js.ok ? parseBiteListingScript(js.text) : null;
    if (!cfg) continue;
    for (let page = 0; page < maxPages * 2; page++) {
      const body = { key: cfg.key, channel: cfg.channel, locale: 'de', page: { num: 100, offset: page * 100 }, ...(cfg.filter ? { filter: cfg.filter } : {}) };
      const r = await http.get('https://jobs.b-ite.com/api/v1/postings/search', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', accept: 'application/json' }, noCache: true, ignoreRobots });
      if (!r.ok) break;
      const { candidates, total } = parseBitePostings(r.text);
      out.push(...candidates);
      if (candidates.length < 100 || out.length >= total) break;
    }
  }
  return out;
}

/**
 * Anzeigentext über die Schnittstelle, wenn die Liste ihn nicht mitliefert:
 * SmartRecruiters (jobs.smartrecruiters.com/<firma>/<id>) und Hidden Professionals (…/<kürzel>/job/<id>).
 * Null, wenn der Kandidat nicht von dort stammt oder nichts kam.
 */
export async function atsDetail(http: Http, c: { via: string; url: string }, ignoreRobots = false): Promise<PostingData | null> {
  let api: string;
  let parse: (body: string, url: string) => PostingData | null;
  if (c.via === 'ats:smartrecruiters') {
    const m = /smartrecruiters\.com\/([^/?#]+)\/(\d+)/i.exec(c.url);
    if (!m) return null;
    api = `https://api.smartrecruiters.com/v1/companies/${m[1]}/postings/${m[2]}`;
    parse = parseSmartRecruitersDetail;
  } else if (c.via === 'ats:hpcareer') {
    const m = /\/([^/?#]+)\/job\/(\d+)/.exec(c.url);
    if (!m) return null;
    api = `${HP_API}/job/details?slug=${encodeURIComponent(m[1])}&jobofferId=${m[2]}&isInternal=false`;
    parse = parseHpCareerDetail;
  } else return null;
  const r = await http.get(api, { accept: 'application/json', ignoreRobots });
  if (!r.ok) return null;
  try {
    return parse(r.text, c.url);
  } catch {
    return null;
  }
}
