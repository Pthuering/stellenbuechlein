# Auf der eigenen Website hosten

Das Stellenbüchlein lässt sich als fertiges Paket auf jeden Webspace laden, der Dateien ausliefert: IONOS, Strato, all-inkl, Hetzner Webhosting, ein eigener Server, GitHub Pages, Netlify oder Cloudflare Pages. Es braucht dort weder PHP noch eine Datenbank.

Anfangs zeigt die App **Dummy-Daten**: erfundene Anzeigen bei echten Einrichtungen, damit du sie ausprobieren und herzeigen kannst. Echte Anzeigen kommen erst, wenn der Server (Cloudflare-Worker) und die Einsammel-Pipeline eingerichtet sind ([BETRIEB.md](BETRIEB.md)). Umgestellt wird dann mit einer einzigen Zeile in `config.json`, ohne neuen Build.

## 1. Paket bauen

```bash
npm install
npm run build:site
```

Das Paket liegt danach in `apps/web/dist-site/`:

| Datei | Wofür |
|---|---|
| `index.html`, `assets/`, `icons/`, `manifest.webmanifest`, `sw.js` | die App selbst (installierbar, offline nutzbar) |
| `config.json` | Dummy-Daten oder Server, siehe Schritt 4 |
| `.htaccess` | Sicherheits-Kopfzeilen, https-Umleitung und Zwischenspeicher für Apache-Webspace |
| `_headers` | dasselbe für Netlify und Cloudflare Pages |
| `robots.txt` | Sperre für Suchmaschinen |
| `LIESMICH.txt` | Kurzfassung dieser Anleitung |

## 2. Hochladen

Den **gesamten Inhalt** von `dist-site/` in einen Ordner deiner Website laden, zum Beispiel per FTP oder im Dateimanager des Anbieters nach `/stellen/`. Danach ist die App unter `https://deine-website.de/stellen/` erreichbar.

- Die Datei `.htaccess` beginnt mit einem Punkt und ist in manchen FTP-Programmen versteckt. Sie muss mit hoch.
- Alle Pfade sind relativ. Die App läuft in jedem Ordner, auch direkt im Hauptverzeichnis oder unter einer Subdomain wie `stellen.deine-website.de`.
- Für ein Update einfach erneut bauen und alles überschreiben. Die installierte App holt sich die neue Fassung beim nächsten Öffnen selbst.

## 3. https einschalten

Ohne https lässt sich die App nicht aufs Handy installieren, und es gibt keine Benachrichtigungen. Bei fast allen Anbietern gibt es ein kostenloses Zertifikat (Let's Encrypt) in der Verwaltungsoberfläche. Die `.htaccess` leitet danach automatisch von http auf https um.

## 4. Dummy-Daten oder echte Anzeigen: `config.json`

```json
{ "daten": "dummy", "apiUrl": "" }
```

- `"daten": "dummy"`: erfundene Anzeigen, Fristen rücken jeden Tag mit. Was jemand merkt oder einstellt, bleibt im jeweiligen Browser. Ohne Anmeldung sichtbar für alle, die die Adresse kennen.
- `"daten": "live"`: echte Anzeigen vom Server. Die App fragt dann nach dem App-Schlüssel (`APP_KEY`).
- `"apiUrl"`: Adresse des Cloudflare-Workers, zum Beispiel `"https://stellenbuechlein.dein-name.workers.dev"`. Leer lassen, wenn die App selbst im Worker läuft.

Die Datei wird bei jedem Start frisch gelesen. Eine Änderung wirkt also sofort, ohne neuen Build und ohne neue Installation auf dem Handy.

## 5. Mit dem Server verbinden (wenn er läuft)

Wenn die App auf deiner Website liegt und der Server bei Cloudflare, sind es zwei Adressen. Der Worker muss deshalb Anfragen von deiner Website ausdrücklich erlauben:

1. Server einrichten wie in [BETRIEB.md](BETRIEB.md), Schritte 1 bis 4.
2. In `apps/api/wrangler.toml` unter `[vars]` eintragen und neu veröffentlichen (`npm run deploy`):

   ```toml
   ALLOWED_ORIGIN = "https://deine-website.de, https://www.deine-website.de"
   ```

   Gemeint ist nur der Teil bis zum ersten Schrägstrich, ohne Ordner.
3. In `config.json` auf der Website `"daten": "live"` und `"apiUrl"` mit der Adresse des Workers eintragen.
4. App öffnen, App-Schlüssel eingeben. Bequemer: einmal `https://deine-website.de/stellen/#key=DEIN_APP_KEY` öffnen; der Schlüssel wird übernommen und sofort aus der Adresse entfernt.

**Alternative:** Statt der eigenen Website liefert der Worker die App gleich mit aus, auf Wunsch unter einer Subdomain deiner Domain (Schritt 2a in [BETRIEB.md](BETRIEB.md)). Dann entfallen `ALLOWED_ORIGIN` und `apiUrl`; dafür muss die Domain bei Cloudflare verwaltet werden.

## 6. Platzhalter-Checkliste

In der App führt oben der Knopf **Checkliste** (oder *Ich → Platzhalter-Checkliste*) zu allem, was noch Dummy, Beispiel oder Standardwert ist: Dummy-Anzeigen, Startprofil, Zuhause, Name, Konten und Schlüssel, Quellen. Was die App selbst erkennt (etwa https oder eine echte Server-Verbindung), hakt sie ab; den Rest hakst du ab. Die Punkte stehen im Code in `apps/web/src/lib/checklist.ts`.

## Sicherheit und Suchmaschinen

- Die App ist für Suchmaschinen gesperrt: `meta robots`, Kopfzeile `X-Robots-Tag` und `robots.txt`. Liegt die App in einem Unterordner, wirkt `robots.txt` dort nicht (Suchmaschinen lesen sie nur im Hauptverzeichnis); Kopfzeile und meta-Tag reichen aber.
- `.htaccess` setzt eine Content-Security-Policy: Skripte und Schriften nur von der eigenen Adresse, Abrufe auch an andere https-Adressen (für den Worker), Bilder auch von fremden https-Adressen (Fotos aus Anzeigen und Wikimedia).
- Unterstützt der Anbieter `.htaccess` oder `mod_headers` nicht, läuft die App trotzdem, nur ohne diese Kopfzeilen.
- Die App setzt keine Cookies. Ob die Website für den Ordner einen Link auf Impressum und Datenschutzerklärung braucht, hängt davon ab, wie die Seite sonst genutzt wird; das steht als Punkt in der Checkliste.

## Ausprobieren ohne Webspace

```bash
npm run build:site
npx vite preview --outDir dist-site -w @stellen/web    # http://localhost:4173
```

Oder die Einzeldatei-Demo: `npm run build:demo`, dann `apps/web/dist-demo/index.html` im Browser öffnen.
