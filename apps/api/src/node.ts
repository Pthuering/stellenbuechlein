// Node-Variante: API + PWA aus einem Prozess, Daten in einer SQLite-Datei.
// Für lokale Entwicklung oder Selbstbetrieb (Raspberry Pi, kleiner Server).
//
//   APP_KEY=geheim DB_PATH=./stellen.sqlite npx tsx apps/api/src/node.ts

import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite } from '@stellen/db/sqlite';
import { createApp } from './app';

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? resolve(here, '../../../stellen.sqlite');
const webDist = process.env.WEB_DIST ?? resolve(here, '../../web/dist');
const port = Number(process.env.PORT ?? 8787);

const db = openSqlite(dbPath);
const env = {
  APP_KEY: process.env.APP_KEY,
  INGEST_KEY: process.env.INGEST_KEY,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITHUB_REPO: process.env.GITHUB_REPO,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN,
};

const api = createApp({ db: () => db, env: () => env });

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function staticFile(pathname: string): Promise<Response> {
  const clean = decodeURIComponent(pathname).replace(/\.\.+/g, '');
  let file = join(webDist, clean);
  if (!existsSync(file) || clean.endsWith('/')) file = join(webDist, 'index.html');
  if (!existsSync(file)) return new Response('Die App ist noch nicht gebaut (npm run build:web).', { status: 404 });
  const body = await readFile(file);
  return new Response(body, { headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' } });
}

serve({
  port,
  fetch: (req) => {
    const url = new URL(req.url);
    return url.pathname.startsWith('/api/') ? api.fetch(req) : staticFile(url.pathname);
  },
});

console.log(`Stellenbüchlein läuft auf http://localhost:${port} (Datenbank: ${dbPath})`);
if (!env.APP_KEY) console.warn('Achtung: APP_KEY ist nicht gesetzt – die App kann sich nicht anmelden.');
