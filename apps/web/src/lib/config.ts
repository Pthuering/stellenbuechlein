// Einstellungen der Website, die sich ohne neuen Build ändern lassen: config.json neben index.html.
//   { "daten": "dummy" }                                         → erfundene Anzeigen, alles im Browser
//   { "daten": "live", "apiUrl": "" }                            → Server unter derselben Adresse (/api)
//   { "daten": "live", "apiUrl": "https://….workers.dev" }       → Server unter anderer Adresse
// Ohne config.json gilt "live" mit derselben Adresse (so läuft die App im Cloudflare-Worker).

import { lsGet, lsSet } from '../data/local';

export interface AppConfig {
  daten: 'dummy' | 'live';
  /** Adresse des Servers ohne /api am Ende; leer = dieselbe Adresse wie die App. */
  apiUrl: string;
}

const CACHE_KEY = 'sb.config';

let current: AppConfig = { daten: __DEMO__ ? 'dummy' : 'live', apiUrl: '' };

function parse(raw: unknown): AppConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const daten = r.daten === 'dummy' || r.daten === 'live' ? r.daten : null;
  if (!daten) return null;
  const apiUrl = typeof r.apiUrl === 'string' ? r.apiUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '') : '';
  return { daten, apiUrl };
}

/** Liest config.json (immer frisch vom Server); offline gilt die zuletzt gelesene Fassung. */
export async function loadConfig(): Promise<AppConfig> {
  if (__DEMO__) return current;
  try {
    const res = await fetch('./config.json', { cache: 'no-store' });
    // Keine Datei: 404, oder (im Worker) die App-Hülle statt JSON
    const isJson = /json/i.test(res.headers.get('content-type') ?? '');
    if (res.status === 404 || (res.ok && !isJson)) {
      lsSet(CACHE_KEY, null);
      return current;
    }
    if (res.ok) {
      const cfg = parse(await res.json().catch(() => null));
      if (cfg) {
        lsSet(CACHE_KEY, cfg);
        current = cfg;
        return current;
      }
      console.warn('config.json ist ungültig, es gilt die zuletzt gelesene Fassung.');
    }
  } catch {
    // offline
  }
  current = parse(lsGet<unknown>(CACHE_KEY, null)) ?? current;
  return current;
}

export function appConfig(): AppConfig {
  return current;
}

/** Basis für API-Aufrufe ("" = gleiche Adresse). */
export function apiBase(): string {
  return current.apiUrl;
}
