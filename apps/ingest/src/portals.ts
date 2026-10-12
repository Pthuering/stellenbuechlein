// Portale mit eigener Schnittstelle (Bundesagentur für Arbeit) und gemeinsame Portal-Hilfen.

import type { Source } from '@stellen/core';
import type { Candidate, PostingData } from './extract';
import type { DiscoverContext } from './discover';

const BA_HEADERS = { 'X-API-Key': 'jobboerse-jobsuche', accept: 'application/json' };

interface BaListItem {
  refnr?: string;
  referenznummer?: string;
  titel?: string;
  beruf?: string;
  arbeitgeber?: string;
  aktuelleVeroeffentlichungsdatum?: string;
  externeUrl?: string;
  arbeitsort?: { ort?: string; plz?: string; land?: string; koordinaten?: { lat?: number; lon?: number } };
}

interface BaDetail {
  titel?: string;
  stellenbeschreibung?: string;
  arbeitgeber?: string;
  externeUrl?: string;
  allianzpartnerUrl?: string;
  eintrittsdatum?: string;
  arbeitsorte?: { ort?: string; land?: string; koordinaten?: { lat?: number; lon?: number } }[];
}

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

/**
 * Suche über die (inoffizielle, öffentliche) Jobsuche-Schnittstelle der Bundesagentur für Arbeit.
 * Liefert je Suchbegriff bis zu `size` Anzeigen; `anyOk` sagt, ob die Schnittstelle überhaupt geantwortet hat.
 */
export async function baSearch(ctx: DiscoverContext, queries: string[], size = 100, extra = ''): Promise<{ candidates: Candidate[]; anyOk: boolean }> {
  const base = ctx.cfg.baApiBase;
  const out = new Map<string, Candidate>();
  let anyOk = false;
  for (const q of queries) {
    let items: BaListItem[] = [];
    for (const version of ['v4', 'v6']) {
      const url = `${base}/pc/${version}/jobs?was=${encodeURIComponent(q)}&angebotsart=1&page=1&size=${size}${extra}`;
      const r = await ctx.http.get(url, { headers: BA_HEADERS, accept: 'application/json', ignoreRobots: true });
      if (!r.ok) continue;
      try {
        const data = JSON.parse(r.text) as { stellenangebote?: BaListItem[] };
        items = data.stellenangebote ?? [];
        anyOk = true;
        break;
      } catch {
        continue;
      }
    }
    for (const it of items) {
      const ref = it.refnr ?? it.referenznummer;
      if (!ref) continue;
      if (it.arbeitsort?.land && !/deutschland|germany/i.test(it.arbeitsort.land)) continue;
      const url = it.externeUrl || `https://www.arbeitsagentur.de/jobsuche/jobdetail/${ref}`;
      if (out.has(ref)) continue;
      out.set(ref, {
        url,
        title: it.titel ?? null,
        via: 'ba-api',
        hints: {
          org: it.arbeitgeber ?? null,
          locality: it.arbeitsort?.ort ?? null,
          lat: it.arbeitsort?.koordinaten?.lat ?? null,
          lon: it.arbeitsort?.koordinaten?.lon ?? null,
          postedAt: it.aktuelleVeroeffentlichungsdatum ?? null,
          country: 'DE',
          // Fallback-Text aus der BA-Detailansicht lädt die Pipeline, falls die Originalseite nicht klappt.
          baRef: ref,
          query: q,
        },
      });
    }
  }
  return { candidates: [...out.values()], anyOk };
}

export async function baDiscover(source: Source, ctx: DiscoverContext): Promise<Candidate[]> {
  const queries = (source.config.queries as string[] | undefined) ?? ['wissenschaftlicher Mitarbeiter Psychologie'];
  const r = await baSearch(ctx, queries);
  if (!r.anyOk) throw new Error('Schnittstelle nicht erreichbar oder Format geändert');
  return r.candidates;
}

/** Lädt die Anzeigenbeschreibung direkt aus der BA-Schnittstelle (Fallback). */
export async function baDetail(ctx: DiscoverContext, ref: string): Promise<PostingData | null> {
  for (const version of ['v4', 'v3']) {
    const r = await ctx.http.get(`${ctx.cfg.baApiBase}/pc/${version}/jobdetails/${b64(ref)}`, { headers: BA_HEADERS, accept: 'application/json', ignoreRobots: true });
    if (!r.ok) continue;
    try {
      const d = JSON.parse(r.text) as BaDetail;
      if (!d.stellenbeschreibung) return null;
      const ort = d.arbeitsorte?.[0];
      return {
        url: d.externeUrl || `https://www.arbeitsagentur.de/jobsuche/jobdetail/${ref}`,
        title: d.titel ?? '',
        descriptionMd: d.stellenbeschreibung.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n'),
        hiringOrg: d.arbeitgeber ?? null,
        locationText: ort?.ort ?? null,
        lat: ort?.koordinaten?.lat ?? null,
        lon: ort?.koordinaten?.lon ?? null,
        method: 'ba-api',
        complete: d.stellenbeschreibung.length > 600,
      };
    } catch {
      continue;
    }
  }
  return null;
}

const OUTSIDE_DE = /\b(?:österreich|austria|schweiz|switzerland|suisse|svizzera|liechtenstein|wien|vienna|graz|innsbruck|salzburg|linz|klagenfurt|zürich|zurich|bern|basel|luzern|lausanne|genf|geneva|st\.? gallen|fribourg|lugano|nijmegen|amsterdam|utrecht|maastricht|leiden|groningen|luxemburg|luxembourg)\b/i;

/** Liegt eine Portal-Anzeige erkennbar außerhalb Deutschlands? */
export function isOutsideGermany(p: { country?: string | null; locationText?: string | null; title?: string | null }): boolean {
  const c = (p.country ?? '').trim().toUpperCase();
  if (c && !['DE', 'DEU', 'GERMANY', 'DEUTSCHLAND'].includes(c)) return true;
  if (p.locationText && OUTSIDE_DE.test(p.locationText) && !/deutschland|germany/i.test(p.locationText)) return true;
  return false;
}
