// HTML-Werkzeuge: JSON-LD, Links, Hauptinhalt (Readability), Umwandlung in Markdown, Feeds.

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

export function load(html: string): CheerioAPI {
  return cheerio.load(html);
}

export function absolutize(href: string | undefined | null, base: string): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith('#') || /^(mailto|tel|javascript|data):/i.test(h)) return null;
  try {
    const u = new URL(h, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ JSON-LD

type Json = Record<string, unknown>;

export function extractJsonLd($: CheerioAPI): Json[] {
  const out: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const data = JSON.parse(raw.replace(/^\s*<!--|-->\s*$/g, ''));
      collectObjects(data, out);
    } catch {
      // Manche Seiten liefern kaputtes JSON-LD – ignorieren.
    }
  });
  return out;
}

export function collectObjects(data: unknown, out: Json[]): void {
  if (Array.isArray(data)) {
    for (const d of data) collectObjects(d, out);
    return;
  }
  if (data && typeof data === 'object') {
    const o = data as Json;
    out.push(o);
    if (Array.isArray(o['@graph'])) collectObjects(o['@graph'], out);
    if (Array.isArray(o.itemListElement)) collectObjects(o.itemListElement, out);
    if (o.item && typeof o.item === 'object') collectObjects(o.item, out);
  }
}

export function typeIs(o: Json, t: string): boolean {
  const ty = o['@type'];
  return Array.isArray(ty) ? ty.includes(t) : ty === t;
}

export function str(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return str(v[0]);
  if (v && typeof v === 'object') {
    const o = v as Json;
    return str(o.name ?? o['@value'] ?? o.url ?? null);
  }
  return null;
}

export interface JobPostingLd {
  title: string | null;
  descriptionHtml: string | null;
  url: string | null;
  datePosted: string | null;
  validThrough: string | null;
  employmentType: string | null;
  hiringOrganization: string | null;
  hiringOrganizationUrl: string | null;
  locality: string | null;
  postalCode: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  image: string | null;
  identifier: string | null;
}

export function readJobPosting(o: Json): JobPostingLd {
  const loc = Array.isArray(o.jobLocation) ? (o.jobLocation[0] as Json) : (o.jobLocation as Json | undefined);
  const addr = (loc?.address ?? {}) as Json;
  const geo = (loc?.geo ?? {}) as Json;
  const org = (o.hiringOrganization ?? {}) as Json;
  const ident = o.identifier as Json | string | undefined;
  return {
    title: str(o.title) ?? str(o.name),
    descriptionHtml: typeof o.description === 'string' ? o.description : null,
    url: str(o.url),
    datePosted: str(o.datePosted),
    validThrough: str(o.validThrough),
    employmentType: str(o.employmentType),
    hiringOrganization: typeof org === 'string' ? org : str(org.name),
    hiringOrganizationUrl: typeof org === 'object' ? str(org.sameAs ?? org.url) : null,
    locality: str(addr.addressLocality),
    postalCode: str(addr.postalCode),
    country: str(addr.addressCountry),
    lat: geo.latitude != null ? Number(geo.latitude) : null,
    lon: geo.longitude != null ? Number(geo.longitude) : null,
    image: str(o.image),
    identifier: typeof ident === 'string' ? ident : ident ? str(ident.value ?? ident.name) : null,
  };
}

export function jobPostingsFrom($: CheerioAPI): JobPostingLd[] {
  return extractJsonLd($).filter((o) => typeIs(o, 'JobPosting')).map(readJobPosting);
}

// ------------------------------------------------------------------ Links

export interface PageLink {
  url: string;
  text: string;
  /** Text der umgebenden Zeile/Listeneintrag (für Kontext). */
  context: string;
  inMain: boolean;
  rel: string;
}

const MAIN_SELECTORS = ['main', '[role="main"]', 'article', '#content', '#main', '.content', '#inhalt', '.main-content', '#maincontent', '.page-content'];

export function mainRoot($: CheerioAPI) {
  for (const sel of MAIN_SELECTORS) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) return el;
  }
  return $('body').first();
}

export function extractLinks($: CheerioAPI, baseUrl: string): PageLink[] {
  const main = mainRoot($);
  const mainSet = new Set(main.find('a').toArray());
  const out: PageLink[] = [];
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const a = $(el);
    const url = absolutize(a.attr('href'), baseUrl);
    if (!url) return;
    const text = a.text().replace(/\s+/g, ' ').trim() || (a.attr('title') ?? '').trim() || (a.attr('aria-label') ?? '').trim();
    const ctxEl = a.closest('li, tr, article, .job, .stelle, .card, .teaser, div');
    const context = ctxEl.text().replace(/\s+/g, ' ').trim().slice(0, 400);
    const key = `${url}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url, text, context, inMain: mainSet.has(el), rel: (a.attr('rel') ?? '').toLowerCase() });
  });
  return out;
}

export function findFeedLinks($: CheerioAPI, baseUrl: string): string[] {
  const out: string[] = [];
  $('link[rel="alternate"]').each((_, el) => {
    const t = ($(el).attr('type') ?? '').toLowerCase();
    if (/rss|atom|feed\+json|json/.test(t)) {
      const u = absolutize($(el).attr('href'), baseUrl);
      if (u) out.push(u);
    }
  });
  return [...new Set(out)];
}

export function metaContent($: CheerioAPI, ...names: string[]): string | null {
  for (const n of names) {
    const v = $(`meta[property="${n}"]`).attr('content') ?? $(`meta[name="${n}"]`).attr('content');
    if (v && v.trim()) return v.trim();
  }
  return null;
}

export function pageTitle($: CheerioAPI): string | null {
  const h1 = $('main h1, article h1, h1').first().text().replace(/\s+/g, ' ').trim();
  if (h1 && h1.length > 6 && h1.length < 300) return h1;
  const og = metaContent($, 'og:title');
  if (og) return og;
  const t = $('title').first().text().replace(/\s+/g, ' ').trim();
  return t ? t.split(/\s[|–—-]\s/)[0].trim() : null;
}

/** Bild der Seite, sofern es nicht nur ein Logo ist. */
export function pageImage($: CheerioAPI, baseUrl: string): string | null {
  const og = metaContent($, 'og:image', 'twitter:image');
  const url = absolutize(og, baseUrl);
  if (!url || isLogoUrl(url)) return null;
  const w = Number(metaContent($, 'og:image:width') ?? 0);
  if (w && w < 400) return null;
  return url;
}

export function isLogoUrl(url: string): boolean {
  return /logo|favicon|icon|wappen|siegel|signet|\.svg(\?|$)|placeholder|default[-_]?image|share[-_]?image|social[-_]?media/i.test(url);
}

// ------------------------------------------------------------------ Hauptinhalt und Markdown

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*' });
turndown.remove(['script', 'style', 'noscript', 'iframe', 'form', 'button', 'nav', 'select', 'input', 'template', 'canvas']);
turndown.remove((node) => node.nodeName.toLowerCase() === 'svg');
turndown.addRule('img', { filter: 'img', replacement: () => '' });
turndown.addRule('tableCell', {
  filter: ['th', 'td'],
  replacement: (content) => ` ${content.replace(/\n+/g, ' ').trim()} |`,
});
turndown.addRule('tableRow', {
  filter: 'tr',
  replacement: (content) => `\n|${content}`,
});

export function htmlToMarkdown(html: string): string {
  const md = turndown.turndown(html);
  return md
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*\[\s*\]\([^)]*\)\s*$/gm, '')
    .trim();
}

export interface MainContent {
  title: string | null;
  html: string;
  markdown: string;
  textLength: number;
}

/** Hauptinhalt per Readability; fällt auf <main>/<article> zurück, wenn Readability zu viel wegschneidet. */
export function mainContent(html: string, url: string): MainContent {
  let readable: { title: string | null; html: string; textLength: number } | null = null;
  try {
    const { document } = parseHTML(html);
    // Readability braucht eine Basis-URL für relative Links.
    const base = document.createElement('base');
    base.setAttribute('href', url);
    document.head?.appendChild(base);
    const art = new Readability(document as unknown as Document, { charThreshold: 200, keepClasses: false }).parse();
    if (art?.content) readable = { title: art.title ?? null, html: art.content, textLength: art.textContent?.length ?? 0 };
  } catch {
    readable = null;
  }
  const $ = load(html);
  $('script, style, noscript, nav, header, footer, form, aside, .cookie, #cookie, [class*="cookie"], [id*="cookie"], [class*="consent"], .breadcrumb, .skip-link').remove();
  const root = mainRoot($);
  const rootHtml = root.html() ?? '';
  const rootText = root.text().replace(/\s+/g, ' ').trim().length;
  const useRoot = !readable || readable.textLength < rootText * 0.6;
  const chosenHtml = useRoot ? rootHtml : readable!.html;
  const markdown = htmlToMarkdown(chosenHtml);
  return {
    title: readable?.title ?? pageTitle($),
    html: chosenHtml,
    markdown,
    textLength: useRoot ? rootText : readable!.textLength,
  };
}

/** Sichtbarer Text (grob) – für Heuristiken und KI-Anfragen. */
export function visibleText(html: string, max = 20_000): string {
  const $ = load(html);
  $('script, style, noscript, svg, template').remove();
  return $('body').text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, max);
}

/** Erkennt Seiten, deren Inhalt erst per JavaScript entsteht. */
export function looksLikeJsShell(html: string): boolean {
  const text = visibleText(html, 5000);
  const scripts = (html.match(/<script\b/gi) ?? []).length;
  if (/enable javascript|javascript (?:is )?(?:required|disabled)|bitte aktivieren sie javascript|javascript aktivieren|anubis|checking your browser|just a moment/i.test(text)) return true;
  if (text.length < 400 && scripts >= 3) return true;
  if (/<div id="(?:root|app|__next|__nuxt)">\s*<\/div>/i.test(html)) return true;
  return false;
}
