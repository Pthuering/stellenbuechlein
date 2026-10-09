// Portal-Funde einer Einrichtung und einer Stadt zuordnen.

import { normalizeText, registrableHost, type City, type Institution } from '@stellen/core';

const GENERIC = new Set(['universitaet', 'hochschule', 'institut', 'klinikum', 'zentrum', 'stiftung', 'gmbh', 'e v', 'der', 'die', 'das', 'fuer', 'und']);

export class InstitutionMatcher {
  private names: { id: string; norm: string; short: string | null }[];
  private byHost = new Map<string, string[]>();
  private byFullHost = new Map<string, string>();

  constructor(institutions: Institution[]) {
    this.names = institutions.map((i) => ({ id: i.id, norm: normalizeText(i.name), short: i.shortName ? normalizeText(i.shortName) : null }));
    for (const i of institutions) {
      if (!i.website) continue;
      try {
        const full = new URL(i.website).hostname.replace(/^www\./, '').toLowerCase();
        this.byFullHost.set(full, i.id);
      } catch {
        continue;
      }
      const h = registrableHost(i.website);
      if (!h) continue;
      this.byHost.set(h, [...(this.byHost.get(h) ?? []), i.id]);
    }
  }

  match(org?: string | null, url?: string | null): string | null {
    if (org) {
      const n = normalizeText(org);
      let best: { id: string; len: number } | null = null;
      for (const x of this.names) {
        const hit = n === x.norm || n.includes(x.norm) || (n.length >= 12 && x.norm.includes(n));
        if (hit && (!best || x.norm.length > best.len)) best = { id: x.id, len: x.norm.length };
      }
      if (best) return best.id;
      for (const x of this.names) {
        if (x.short && x.short.length >= 3 && !GENERIC.has(x.short) && new RegExp(`(?:^| )${x.short}(?: |$)`).test(n)) return x.id;
      }
    }
    if (url) {
      try {
        const full = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        // Unterdomain (jobs.uni-x.de) → Hauptdomain
        for (let h = full; h.includes('.'); h = h.slice(h.indexOf('.') + 1)) {
          const id = this.byFullHost.get(h);
          if (id) return id;
        }
        const reg = registrableHost(url);
        const ids = reg ? this.byHost.get(reg) : undefined;
        if (ids && ids.length === 1) return ids[0];
      } catch {
        return null;
      }
    }
    return null;
  }
}

export class CityMatcher {
  private list: { id: string; re: RegExp; len: number }[];

  constructor(cities: City[]) {
    this.list = cities
      .map((c) => {
        const base = normalizeText(c.name.replace(/\s*\(.*\)$/, '').replace(/ (?:am|im|in der) .*$/, ''));
        return { id: c.id, re: new RegExp(`(?:^| )${base}(?: |$)`), len: base.length };
      })
      .sort((a, b) => b.len - a.len);
  }

  match(text?: string | null): string | null {
    if (!text) return null;
    const n = normalizeText(text);
    return this.list.find((c) => c.re.test(n))?.id ?? null;
  }
}
