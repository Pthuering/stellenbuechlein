// RSS, Atom, JSON-Feeds und Sitemaps lesen.

import { XMLParser } from 'fast-xml-parser';
import { collectObjects, htmlToMarkdown, readJobPosting, typeIs } from './html';
import { assessCompleteness, type Candidate } from './extract';

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', cdataPropName: '#cdata', trimValues: true });

function txt(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return txt(o['#cdata'] ?? o['#text'] ?? o['@_href'] ?? null);
  }
  return null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function toIso(d: string | null): string | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Wandelt einen Feed-Eintrag in einen Kandidaten. Lange Inhalte gelten als vollständige Anzeige. */
function itemToCandidate(link: string, title: string | null, contentHtml: string | null, date: string | null, via: string): Candidate {
  const c: Candidate = { url: link, title, via, hints: { postedAt: toIso(date) } };
  if (contentHtml && contentHtml.length > 600) {
    const md = /<[a-z][\s\S]*>/i.test(contentHtml) ? htmlToMarkdown(contentHtml) : contentHtml;
    const a = assessCompleteness(md);
    if (a.complete) {
      c.prefilled = { url: link, title: title ?? '', descriptionMd: md, postedAt: toIso(date), method: via, complete: true };
    }
  }
  return c;
}

export function parseFeed(body: string, baseUrl: string, via = 'feed'): Candidate[] {
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJsonFeed(trimmed, baseUrl, via);
  let doc: Record<string, unknown>;
  try {
    doc = xml.parse(trimmed) as Record<string, unknown>;
  } catch {
    return [];
  }
  const out: Candidate[] = [];
  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = (rss?.channel ?? (doc['rdf:RDF'] as Record<string, unknown> | undefined)) as Record<string, unknown> | undefined;
  const rssItems = asArray(channel?.item as unknown[] | undefined).concat(asArray((doc['rdf:RDF'] as Record<string, unknown> | undefined)?.item as unknown[] | undefined));
  for (const it of rssItems as Record<string, unknown>[]) {
    const link = txt(it.link) ?? txt(it.guid);
    if (!link) continue;
    const content = txt(it['content:encoded']) ?? txt(it.description);
    out.push(itemToCandidate(new URL(link, baseUrl).toString(), txt(it.title), content, txt(it.pubDate) ?? txt(it['dc:date']), via));
  }
  const feed = doc.feed as Record<string, unknown> | undefined;
  for (const e of asArray(feed?.entry as unknown[] | undefined) as Record<string, unknown>[]) {
    const links = asArray(e.link as unknown[]) as Record<string, unknown>[];
    const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
    const href = (alt?.['@_href'] as string | undefined) ?? txt(e.id);
    if (!href) continue;
    const content = txt(e.content) ?? txt(e.summary);
    out.push(itemToCandidate(new URL(href, baseUrl).toString(), txt(e.title), content, txt(e.updated) ?? txt(e.published), via));
  }
  return out;
}

/** JSON Feed (jsonfeed.org) oder JSON mit schema.org JobPosting (z. B. softgarden jobs.feed.json). */
export function parseJsonFeed(body: string, baseUrl: string, via = 'json-feed'): Candidate[] {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }
  const out: Candidate[] = [];
  const objs: Record<string, unknown>[] = [];
  collectObjects(data, objs);
  const postings = objs.filter((o) => typeIs(o, 'JobPosting'));
  if (postings.length) {
    for (const o of postings) {
      const jp = readJobPosting(o);
      const url = jp.url ? new URL(jp.url, baseUrl).toString() : null;
      if (!url) continue;
      const md = jp.descriptionHtml ? (/<[a-z][\s\S]*>/i.test(jp.descriptionHtml) ? htmlToMarkdown(jp.descriptionHtml) : jp.descriptionHtml) : '';
      const a = assessCompleteness(md);
      out.push({
        url,
        title: jp.title,
        via,
        hints: { locality: jp.locality, org: jp.hiringOrganization, postedAt: jp.datePosted, lat: jp.lat, lon: jp.lon, country: jp.country },
        prefilled: a.complete
          ? {
              url,
              title: jp.title ?? '',
              descriptionMd: md,
              postedAt: jp.datePosted,
              validThrough: jp.validThrough,
              hiringOrg: jp.hiringOrganization,
              locationText: jp.locality,
              lat: jp.lat,
              lon: jp.lon,
              country: jp.country,
              imageUrl: jp.image,
              referenceNo: jp.identifier,
              method: via,
              complete: true,
            }
          : undefined,
      });
    }
    return out;
  }
  const items = (data as { items?: Record<string, unknown>[] })?.items;
  for (const it of asArray(items)) {
    const url = (it.url ?? it.external_url ?? it.id) as string | undefined;
    if (!url) continue;
    out.push(itemToCandidate(new URL(url, baseUrl).toString(), (it.title as string) ?? null, ((it.content_html ?? it.content_text) as string) ?? null, (it.date_published as string) ?? null, via));
  }
  return out;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

export function parseSitemap(body: string): { urls: SitemapEntry[]; sitemaps: string[] } {
  let doc: Record<string, unknown>;
  try {
    doc = xml.parse(body) as Record<string, unknown>;
  } catch {
    return { urls: [], sitemaps: [] };
  }
  const urlset = doc.urlset as Record<string, unknown> | undefined;
  const index = doc.sitemapindex as Record<string, unknown> | undefined;
  const urls = (asArray(urlset?.url as unknown[]) as Record<string, unknown>[])
    .map((u) => ({ loc: txt(u.loc) ?? '', lastmod: txt(u.lastmod) }))
    .filter((u) => u.loc);
  const sitemaps = (asArray(index?.sitemap as unknown[]) as Record<string, unknown>[]).map((s) => txt(s.loc) ?? '').filter(Boolean);
  return { urls, sitemaps };
}

/** Personio-XML-Feed: enthält den vollständigen Anzeigentext. */
export function parsePersonioXml(body: string, origin: string): Candidate[] {
  let doc: Record<string, unknown>;
  try {
    doc = xml.parse(body) as Record<string, unknown>;
  } catch {
    return [];
  }
  const root = (doc['workzag-jobs'] ?? doc.positions ?? doc) as Record<string, unknown>;
  const positions = asArray(root.position as unknown[]) as Record<string, unknown>[];
  return positions.map((p) => {
    const id = txt(p.id) ?? '';
    const url = `${origin}/job/${id}`;
    const parts = (asArray((p.jobDescriptions as Record<string, unknown> | undefined)?.jobDescription as unknown[]) as Record<string, unknown>[])
      .map((d) => `## ${txt(d.name) ?? ''}\n\n${htmlToMarkdown(txt(d.value) ?? '')}`)
      .join('\n\n');
    const title = txt(p.name);
    return {
      url,
      title,
      via: 'ats:personio',
      hints: { locality: txt(p.office), org: txt(p.subcompany) },
      prefilled: { url, title: title ?? '', descriptionMd: parts, locationText: txt(p.office), postedAt: txt(p.createdAt), method: 'ats:personio', complete: parts.length > 300 },
    } satisfies Candidate;
  });
}

const JSON_TITLE_KEYS = ['title', 'job_title', 'jobTitle', 'titel', 'name', 'position', 'stellenbezeichnung', 'bezeichnung', 'text'];
const JSON_URL_KEYS = ['url', 'link', 'href', 'detailUrl', 'detail_url', 'advertUrl', 'jobUrl', 'hostedUrl', 'absolute_url', 'careers_url', 'applyOnlineUrl', 'publicUrl', 'permalink'];

/**
 * Beliebige JSON-Stellenliste (eigene Schnittstellen von Kliniken, Hochschulen, Firmen): sucht Objekte
 * mit Titel- und Adressfeld. Den Text liest danach die normale Detailseite. Die Adresse darf relativ sein.
 */
export function candidatesFromJson(body: string, baseUrl: string): Candidate[] {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return [];
  }
  const out = new Map<string, Candidate>();
  const visit = (v: unknown, depth: number): void => {
    if (depth > 6 || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    const o = v as Record<string, unknown>;
    const title = JSON_TITLE_KEYS.map((k) => o[k]).find((x): x is string => typeof x === 'string' && x.trim().length > 3);
    const rawUrl = JSON_URL_KEYS.map((k) => o[k]).find((x): x is string => typeof x === 'string' && x.trim().length > 1 && !/\.(?:png|jpe?g|svg|gif|webp)(?:\?|$)/i.test(x));
    if (title && rawUrl) {
      try {
        const url = new URL(rawUrl.trim(), baseUrl).toString();
        if (/^https?:/.test(url) && !out.has(url)) out.set(url, { url, title: title.trim(), via: 'json' });
        return;
      } catch {
        // ungültige Adresse: weiter in die Tiefe
      }
    }
    for (const x of Object.values(o)) visit(x, depth + 1);
  };
  visit(data, 0);
  return [...out.values()];
}
