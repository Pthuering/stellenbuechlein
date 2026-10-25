// Baut das Paket für die eigene Website aus dem fertigen Build (dist/ → dist-site/):
// dieselbe App, dazu config.json (anfangs Dummy-Daten), .htaccess für Apache-Webspace
// (IONOS, Strato, all-inkl, …), _headers für Netlify/Cloudflare Pages und eine Anleitung.
//   npm run build:site   (baut vorher dist/)
// Den Inhalt von dist-site/ in einen Ordner der Website hochladen, z. B. per FTP nach /stellen/.

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../dist');
const out = resolve(here, '../dist-site');
if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('Erst die App bauen: npm run build -w @stellen/web');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
cpSync(dist, out, { recursive: true });

// Ohne eigenen Server spricht die App mit dem Cloudflare-Worker unter einer anderen Adresse.
// Deshalb dürfen Abrufe auch an fremde https-Adressen gehen (alles andere bleibt wie im Worker).
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; " +
  "connect-src 'self' https:; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";

const config = {
  _hinweis: [
    'daten: "dummy" = erfundene Anzeigen, alles bleibt im Browser.',
    'daten: "live" = echte Anzeigen vom Server. apiUrl ist die Adresse des Cloudflare-Workers,',
    'z. B. "https://stellenbuechlein.dein-name.workers.dev" (leer, wenn die App selbst im Worker läuft).',
    'Im Worker muss ALLOWED_ORIGIN die Adresse dieser Website sein. Anleitung: docs/WEBSITE.md',
  ],
  daten: 'dummy',
  apiUrl: '',
};
writeFileSync(resolve(out, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);

const headers = readFileSync(resolve(dist, '_headers'), 'utf8').replace(/Content-Security-Policy: .*/, `Content-Security-Policy: ${CSP}`);
writeFileSync(resolve(out, '_headers'), headers);

const htaccess = `# Taras Cutesy Jobsearch App auf Apache-Webspace (IONOS, Strato, all-inkl, Hetzner Webhosting, …).
# Die Datei gilt nur für diesen Ordner. Wird sie vom Anbieter nicht unterstützt, läuft die App
# trotzdem, nur ohne die Sicherheits-Kopfzeilen.

DirectoryIndex index.html
Options -Indexes

<IfModule mod_rewrite.c>
  RewriteEngine On
  # Nur über https: Ohne https gibt es keine Installation aufs Handy und keine Benachrichtigungen.
  RewriteCond %{HTTPS} !=on
  RewriteCond %{HTTP:X-Forwarded-Proto} !https
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>

AddType application/manifest+json .webmanifest
AddType application/json .json
AddType font/woff2 .woff2
AddType image/svg+xml .svg

<IfModule mod_headers.c>
  Header always set Content-Security-Policy "${CSP}"
  Header always set Referrer-Policy "no-referrer"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set Permissions-Policy "geolocation=(self), camera=(), microphone=(), payment=(), usb=()"
  Header always set X-Robots-Tag "noindex, nofollow"

  # Dateien mit Prüfsumme im Namen (Ordner assets/) ändern sich nie …
  <FilesMatch "\\.(js|css|woff2)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  # … App-Hülle, Service Worker und Einstellungen dagegen immer frisch laden
  <FilesMatch "^(index\\.html|config\\.json|manifest\\.webmanifest|sw\\.js|registerSW\\.js|workbox-[^.]+\\.js)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`;
writeFileSync(resolve(out, '.htaccess'), htaccess);

const readme = `Taras Cutesy Jobsearch App – Paket für die eigene Website
==============================================

1. Den GESAMTEN Inhalt dieses Ordners (auch die versteckte Datei .htaccess) in einen
   Ordner deiner Website hochladen, zum Beispiel per FTP nach /stellen/.
   Danach ist die App unter https://deine-website.de/stellen/ erreichbar.
2. Die Website muss über https erreichbar sein (bei fast allen Anbietern kostenlos
   per Let's Encrypt einschaltbar). Sonst lässt sich die App nicht aufs Handy installieren.
3. Anfangs zeigt die App erfundene Dummy-Anzeigen (config.json: "daten": "dummy").
   Was du merkst und einstellst, bleibt im jeweiligen Browser.
4. Was noch ersetzt werden muss, steht in der App: oben auf "Checkliste" tippen
   (oder Ich → Platzhalter-Checkliste).
5. Echte Anzeigen: Server einrichten (docs/BETRIEB.md), dann in config.json
   "daten": "live" und "apiUrl" eintragen. Kein neuer Build nötig. Details: docs/WEBSITE.md

Die App ist für Suchmaschinen gesperrt (robots.txt, X-Robots-Tag, meta robots).
Liegt robots.txt nicht im Hauptordner der Website, wirkt nur die Sperre per Kopfzeile
und meta-Tag; das reicht für Suchmaschinen wie Google und Bing.
`;
writeFileSync(resolve(out, 'LIESMICH.txt'), readme);

console.log(`Website-Paket: ${out}\n  config.json steht auf "dummy". Inhalt des Ordners auf die Website hochladen.`);
