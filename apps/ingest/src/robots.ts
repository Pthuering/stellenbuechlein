// robots.txt auswerten (Allow/Disallow mit Platzhaltern, Crawl-delay, Sitemaps).

interface Rule {
  allow: boolean;
  pattern: string;
  re: RegExp;
}

interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay: number | null;
}

export interface RobotsInfo {
  groups: Group[];
  sitemaps: string[];
}

function toRegex(pattern: string): RegExp {
  let p = pattern.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  if (p.endsWith('$')) p = `${p.slice(0, -1)}$`;
  else p = p.replace(/\\\$$/, '$');
  return new RegExp(`^${p}`);
}

export function parseRobots(text: string): RobotsInfo {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'sitemap') {
      sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (key === 'disallow' || key === 'allow') {
      if (key === 'disallow' && value === '') continue; // leeres Disallow = alles erlaubt
      current.rules.push({ allow: key === 'allow', pattern: value, re: toRegex(value) });
    } else if (key === 'crawl-delay') {
      const n = Number(value.replace(',', '.'));
      if (Number.isFinite(n)) current.crawlDelay = n;
    }
  }
  return { groups, sitemaps };
}

function groupFor(info: RobotsInfo, uaToken: string): Group | null {
  const token = uaToken.toLowerCase();
  const specific = info.groups.find((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  if (specific) return specific;
  return info.groups.find((g) => g.agents.includes('*')) ?? null;
}

export function isAllowed(info: RobotsInfo, uaToken: string, pathWithQuery: string): boolean {
  const g = groupFor(info, uaToken);
  if (!g) return true;
  let best: Rule | null = null;
  for (const r of g.rules) {
    if (!r.re.test(pathWithQuery)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

export function crawlDelaySeconds(info: RobotsInfo, uaToken: string): number | null {
  return groupFor(info, uaToken)?.crawlDelay ?? null;
}
