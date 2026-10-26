// URLs vereinheitlichen, IDs und Prüfsummen bilden, Dubletten erkennen.

import { cleanTitleForKey, normalizeText } from './text';

const TRACKING_PARAMS = /^(?:utm_[a-z]+|fbclid|gclid|mc_[a-z]+|ref|referrer|source|src|_pc|trk|trackingid|campaign|sessionid|jsessionid|phpsessid|wt_mc|wt\.mc_id|l|lang|locale|language|hl)$/i;

/** Vereinheitlicht eine URL für Vergleiche (Tracking-Parameter, Anker, Groß/Klein im Host). */
export function canonicalUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) u.port = '';
  const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k));
  keep.sort(([a], [b]) => a.localeCompare(b));
  u.search = '';
  for (const [k, v] of keep) u.searchParams.append(k, v);
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  const s = u.toString();
  // http und https gelten als gleich
  return s.replace(/^http:\/\//, 'https://');
}

/** FNV-1a 32 Bit. */
function fnv1a(str: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 64-Bit-ähnliche Prüfsumme als 16 Hex-Zeichen (zwei unabhängige FNV-Läufe). */
export function hash64(str: string): string {
  const a = fnv1a(str, 0x811c9dc5).toString(16).padStart(8, '0');
  const b = fnv1a(str, 0x01000193 ^ 0x5bd1e995).toString(16).padStart(8, '0');
  return a + b;
}

export function jobIdForUrl(url: string): string {
  return `j${hash64(canonicalUrl(url))}`;
}

/** Prüfsumme des Inhalts – ändert sich, wenn die Anzeige überarbeitet wurde. */
export function contentHash(title: string, descriptionMd: string): string {
  return hash64(`${normalizeText(title)}\n${normalizeText(descriptionMd)}`);
}

/**
 * Schlüssel für die Dubletten-Erkennung über Quellen hinweg (Institutsseite vs. Portal):
 * Einrichtung + bereinigter Titel + (Frist oder Kennziffer).
 */
export function fuzzyKey(p: { institutionId: string | null; title: string; deadline?: string | null; referenceNo?: string | null }): string | null {
  if (!p.institutionId) return null;
  const t = cleanTitleForKey(p.title);
  if (t.length < 8) return null;
  const extra = p.referenceNo ? `ref:${normalizeText(p.referenceNo)}` : p.deadline ? `frist:${p.deadline}` : '';
  if (!extra) return null;
  return `${p.institutionId}|${t}|${extra}`;
}

/** Ähnlichkeit zweier Titel (Jaccard über Wörter), 0..1. */
export function titleSimilarity(a: string, b: string): number {
  const wa = new Set(cleanTitleForKey(a).split(' ').filter((w) => w.length > 2));
  const wb = new Set(cleanTitleForKey(b).split(' ').filter((w) => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

function shingles(text: string, n = 5): Set<string> {
  const w = normalizeText(text).split(' ').filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  if (out.size === 0 && w.length) out.add(w.join(' '));
  return out;
}

/**
 * Ähnlichkeit zweier Anzeigentexte (Jaccard über Folgen von fünf Wörtern), 0..1. Dieselbe Anzeige unter zwei Adressen
 * liegt nahe 1 (nur Datum oder Kopfzeile anders), zwei Stellen mit gleichem Titel aus verschiedenen Projekten weit darunter.
 */
export function textSimilarity(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const s of sa) if (sb.has(s)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/**
 * Könnten zwei Anzeigen am selben Ort sein? Nein nur, wenn beide einen Ort nennen und die Orte verschieden sind:
 * Dieselbe Ausschreibung für Bayreuth und Augsburg sind zwei Stellen, keine Dublette.
 */
export function samePlace(a: { cityId?: string | null; locationText?: string | null }, b: { cityId?: string | null; locationText?: string | null }): boolean {
  if (a.cityId && b.cityId) return a.cityId === b.cityId;
  const la = a.locationText ? normalizeText(a.locationText).replace(/\b\d{5}\b/g, '').trim() : '';
  const lb = b.locationText ? normalizeText(b.locationText).replace(/\b\d{5}\b/g, '').trim() : '';
  if (!la || !lb) return true;
  return la === lb || la.includes(lb) || lb.includes(la);
}

const NOISE_QUERY = /^(?:sessid|sid|c|feedid|display|jobdbpvid|agid)$/i;
const LOCALE_SEGMENT = /^(?:de|en|fr|es|it|nl|pl|de[-_]de|en[-_](?:us|gb|de)|default)$/i;

/**
 * Adresse ohne das, was dieselbe Seite nur anders aufruft: Sprachteil (/en-US/, /de_DE/), Sitzungs- und
 * Herkunfts-Parameter, „/view“ hinter einem PDF, eine angehängte „-1“ oder „-2“ (Neuveröffentlichung).
 */
export function urlKey(url: string): string {
  try {
    const u = new URL(canonicalUrl(url));
    const path = u.pathname
      .split('/')
      .filter((s) => s && !LOCALE_SEGMENT.test(s))
      .join('/')
      .replace(/\/view$/i, '')
      .replace(/-\d{1,2}$/, '')
      .toLowerCase();
    const query = [...u.searchParams].filter(([k]) => !NOISE_QUERY.test(k)).map(([k, v]) => `${k}=${v}`).join('&');
    return `${u.host.replace(/^www\./, '')}/${path}${query ? `?${query}` : ''}`;
  } catch {
    return url;
  }
}

/** Domain ohne www – für Zuordnung von Portal-Funden zu Einrichtungen. */
export function registrableHost(url: string): string | null {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const parts = h.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : h;
  } catch {
    return null;
  }
}
