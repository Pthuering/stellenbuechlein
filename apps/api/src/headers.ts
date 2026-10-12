// Kopfzeilen-Regeln im Format von Cloudflare (_headers) lesen und anwenden.
// Cloudflare wendet apps/web/public/_headers beim Ausliefern der App selbst an; der Node-Server
// nutzt diese Funktionen, damit der Selbstbetrieb dieselben Kopfzeilen schickt.
//
// Unterstützt wird, was die App braucht: Pfade mit einem "*" (beliebig viele Zeichen) und
// Platzhaltern (":name", ein Pfadabschnitt), Kommentare mit "#", mehrere passende Regeln
// (gleichnamige Werte werden wie bei Cloudflare mit Komma verbunden) und "! Name" zum Entfernen.

export interface HeaderRule {
  pattern: string;
  matcher: RegExp;
  set: Array<[name: string, value: string]>;
  detach: string[];
}

function toMatcher(pattern: string): RegExp {
  let path = pattern;
  if (/^https?:\/\//i.test(path)) path = path.replace(/^https?:\/\/[^/]*/i, '') || '/';
  let src = '';
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '*') {
      src += '.*';
    } else if (ch === ':' && /[A-Za-z_]/.test(path[i + 1] ?? '')) {
      while (/\w/.test(path[i + 1] ?? '')) i++;
      src += '[^/]+';
    } else {
      src += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${src}$`);
}

export function parseHeadersFile(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  let current: HeaderRule | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: trimmed, matcher: toMatcher(trimmed), set: [], detach: [] };
      rules.push(current);
      continue;
    }
    if (!current) continue;
    if (trimmed.startsWith('!')) {
      const name = trimmed.slice(1).trim();
      if (name) current.detach.push(name.toLowerCase());
      continue;
    }
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    current.set.push([trimmed.slice(0, colon).trim(), trimmed.slice(colon + 1).trim()]);
  }
  return rules;
}

/** Alle Kopfzeilen, die für einen Pfad gelten (Schlüssel in Kleinbuchstaben). */
export function headersFor(rules: readonly HeaderRule[], pathname: string): Record<string, string> {
  const out: Record<string, string> = {};
  const detached = new Set<string>();
  for (const rule of rules) {
    if (!rule.matcher.test(pathname)) continue;
    for (const [name, value] of rule.set) {
      const key = name.toLowerCase();
      out[key] = out[key] ? `${out[key]}, ${value}` : value;
    }
    for (const name of rule.detach) detached.add(name);
  }
  for (const name of detached) delete out[name];
  return out;
}
