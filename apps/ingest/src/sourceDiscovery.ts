// Stellenseiten für Einrichtungen ohne bekannte Adresse finden – als Vorschlag zur Bestätigung in der App.

import type { Institution } from '@stellen/core';
import { canonicalUrl } from '@stellen/core';
import { extractLinks, load } from './html';
import { pickPostingLinks, type DiscoverContext } from './discover';

const JOBS_LINK_TEXT = /stellen(?:angebote|ausschreibungen|markt|börse|portal)?|karriere|jobs?\b|offene stellen|arbeiten (?:an|bei|am)|arbeitgeber|vacancies|job (?:offers|opportunities|openings)|open positions|careers?/i;
const COMMON_PATHS = [
  '/stellenangebote',
  '/stellenausschreibungen',
  '/stellen',
  '/karriere',
  '/jobs',
  '/karriere/stellenangebote',
  '/de/karriere/stellenangebote',
  '/universitaet/stellenangebote',
  '/de/stellenangebote',
  '/career',
  '/en/careers',
];

export interface PageCheck {
  url: string;
  postingLinks: number;
}

async function checkPage(url: string, ctx: DiscoverContext): Promise<PageCheck | null> {
  const r = await ctx.http.get(url);
  if (!r.ok || r.isPdf) return null;
  const $ = load(r.text);
  const links = extractLinks($, r.url);
  return { url: r.url, postingLinks: pickPostingLinks(links, r.url, {}).length };
}

/** Sucht die Stellenseite; liefert die beste Kandidatin samt Begründung. */
export async function findJobsPage(inst: Institution, ctx: DiscoverContext): Promise<{ url: string; reason: string } | null> {
  if (!inst.website) return null;
  const home = await ctx.http.get(inst.website);
  const candidates = new Map<string, string>();
  if (home.ok && !home.isPdf) {
    const $ = load(home.text);
    for (const l of extractLinks($, home.url)) {
      if (JOBS_LINK_TEXT.test(l.text) || /stellen|karriere|jobs?\b|career/i.test(new URL(l.url).pathname)) {
        if (!/presse|news|aktuelles\/?$|studium|studierende|ausbildung\/?$|praktik/i.test(l.url)) candidates.set(canonicalUrl(l.url), `Link „${l.text.slice(0, 50)}“ auf der Startseite`);
      }
    }
  }
  const origin = new URL(inst.website).origin;
  for (const p of COMMON_PATHS) candidates.set(canonicalUrl(origin + p), `übliche Adresse ${p}`);

  let best: { check: PageCheck; reason: string } | null = null;
  let tried = 0;
  for (const [url, reason] of candidates) {
    if (tried >= 10) break;
    tried++;
    const c = await checkPage(url, ctx).catch(() => null);
    if (!c) continue;
    if (!best || c.postingLinks > best.check.postingLinks) best = { check: c, reason };
    // Unterseiten einer Karriere-Startseite (z. B. "Wissenschaftliches Personal") eine Ebene tiefer prüfen
    if (c.postingLinks < 2 && tried < 10) {
      const r = await ctx.http.get(c.url);
      if (r.ok && !r.isPdf) {
        const $ = load(r.text);
        for (const l of extractLinks($, r.url).filter((x) => /wissenschaft|stellen|ausschreib|jobs?\b|karriere/i.test(`${x.text} ${x.url}`)).slice(0, 3)) {
          tried++;
          const d = await checkPage(l.url, ctx).catch(() => null);
          if (d && (!best || d.postingLinks > best.check.postingLinks)) best = { check: d, reason: `${reason} → „${l.text.slice(0, 40)}“` };
        }
      }
    }
  }
  if (best && best.check.postingLinks >= 2) {
    return { url: best.check.url, reason: `${best.reason}; ${best.check.postingLinks} Anzeigen-Links erkannt` };
  }
  // Mit KI unter den gefundenen Links wählen
  if (ctx.llm.available && candidates.size) {
    const list = [...candidates.entries()].slice(0, 60).map(([url, reason], i) => ({ i, text: reason, url }));
    const pick = await ctx.llm.pickJobsPage(inst.name, list);
    if (pick?.index != null && list[pick.index]) {
      return { url: list[pick.index].url, reason: `KI-Vorschlag (${pick.confidence})` };
    }
  }
  return best && best.check.postingLinks > 0 ? { url: best.check.url, reason: `${best.reason}; nur ${best.check.postingLinks} Anzeigen-Link erkannt` } : null;
}
