# Einrichten und Betreiben

Die App läuft komplett in kostenlosen Kontingenten:

| Teil | Wo | Wofür |
|---|---|---|
| App (PWA) und API | Cloudflare Worker mit statischen Dateien, unter eigener Domain oder `….workers.dev` | die Website selbst: Oberfläche, Abgleich, Einstellungen |
| Datenbank | Cloudflare D1 | Anzeigen, Markierungen, Quellen, Läufe |
| Einsammeln | GitHub Actions, täglich gegen 12 Uhr und per Knopf | Anzeigen holen, gezielt neue Websites erkunden, Erinnerungen verschicken |
| Probelauf neuer Quellen | GitHub Actions, per Knopf in der App | eine Website prüfen, bevor sie ins Register kommt |
| KI (optional, empfohlen) | DeepSeek-API oder ein anderer OpenAI-kompatibler Dienst | schwierige Seiten auswerten, Kurzfassungen, unplausible Fristen nachprüfen, Horizont und Weite beurteilen, neue Quellen prüfen |

Die Website, die du im Browser öffnest, liefert Cloudflare aus. GitHub hostet keine Seite: Dort liegen nur der Code und die Abläufe zum Einsammeln und Prüfen.

Du brauchst: ein GitHub-Konto, ein Cloudflare-Konto, Node.js 22 auf dem Rechner (nur für die Einrichtung), für eine eigene Adresse eine Domain (Schritt 2a) und optional einen DeepSeek-API-Schlüssel.

## 1. Code in ein eigenes GitHub-Repository

Den Ordner als neues Repository hochladen (privat oder öffentlich). Bei einem öffentlichen Repository sind die Actions-Minuten unbegrenzt, bei einem privaten gibt es 2.000 Minuten im Monat. Wie lange ein Lauf mit allen Quellen dauert, ist noch nicht gemessen (siehe [OFFEN.md](OFFEN.md)); bei einem privaten Repository die Minuten nach den ersten Läufen unter *Settings → Billing* prüfen.

Wichtig: Schlüssel gehören nie ins Repository, nur in die Secrets.

## 2. Cloudflare: Datenbank und Worker

```bash
npm install
cd apps/api
npx wrangler login
npx wrangler d1 create stellenbuechlein
```

Die ausgegebene `database_id` in `apps/api/wrangler.toml` eintragen. Dann:

```bash
npm run db:migrate:remote              # legt alle Tabellen an; nach Updates erneut ausführen (neue Migrationen)
npx wrangler secret put APP_KEY       # Schlüssel für die App, z. B. aus: openssl rand -base64 32
npx wrangler secret put INGEST_KEY    # zweiter, anderer Zufallswert für die Pipeline
cd ../..
npm run deploy                        # baut die App und lädt den Worker hoch
```

Am Ende steht die Adresse da, etwa `https://stellenbuechlein.<dein-name>.workers.dev`.

## 2a. Eigene Adresse (empfohlen)

Mit einer eigenen Domain heißt die App zum Beispiel `https://stellen.deine-domain.de` statt `….workers.dev`. Am Hosting ändert sich nichts: Cloudflare liefert sie weiter im kostenlosen Plan aus, Kosten hat nur die Domain selbst.

1. **Domain besorgen.** `.de` gibt es bei Cloudflare nicht, dafür einen beliebigen Domain-Anbieter nehmen. Endungen wie `.com`, `.org`, `.app` oder `.dev` lassen sich auch direkt bei Cloudflare registrieren (zum Selbstkostenpreis); dann liegt die Domain schon dort, und der nächste Punkt entfällt.
2. **Domain bei Cloudflare verwalten lassen.** Im Cloudflare-Dashboard *Domain hinzufügen*, den kostenlosen Plan wählen und die gefundenen DNS-Einträge übernehmen. Läuft unter der Domain schon eine Website oder kommen E-Mails an, prüfen, ob deren Einträge vollständig dabei sind (zum Beispiel MX für E-Mail); beides läuft danach weiter wie bisher. Zum Schluss beim Domain-Anbieter die zwei Nameserver von Cloudflare eintragen. Bis Cloudflare die Domain als aktiv meldet, dauert es meist Minuten, selten bis zu einem Tag.
3. **Nur falls die App schon unter `workers.dev` auf dem Handy läuft:** sie dort einmal mit Internet öffnen, damit keine Entscheidung in der Warteschlange hängt, und unter *Ich → Fristen-Erinnerungen* „Auf diesem Gerät ausschalten“ tippen. Nach dem nächsten Punkt ist die alte Adresse nicht mehr erreichbar.
4. **Adresse eintragen.** In `apps/api/wrangler.toml` die drei Zeilen unter „Eigene Adresse“ aktivieren und die Adresse eintragen. Eine Subdomain wie `stellen.deine-domain.de` hält die Domain selbst frei für anderes. Dann:

   ```bash
   npm run deploy
   ```

   DNS-Eintrag und Zertifikat legt Cloudflare selbst an; nach ein paar Minuten ist die App unter der neuen Adresse erreichbar.
5. **Pipeline umstellen.** Mit eigener Adresse schaltet Cloudflare die `workers.dev`-Adresse ab. Deshalb in GitHub das Secret `API_URL` (Schritt 4) auf die neue Adresse ändern. Sollen beide Adressen erreichbar bleiben, in `wrangler.toml` oben `workers_dev = true` eintragen.
6. **Aufs Handy** wie in Schritt 7, mit der neuen Adresse. Für den Browser ist sie eine neue App: Schlüssel eingeben, installieren, Erinnerungen einschalten und eine alte Installation löschen. Markierungen, Suchprofil und Einstellungen liegen auf dem Server und sind sofort da; nur hell oder dunkel ist gegebenenfalls neu zu wählen.

Die App ist für Suchmaschinen gesperrt (`robots.txt` und Kopfzeile `X-Robots-Tag`), damit sie unter der eigenen Domain nicht gefunden wird. Weitere Sicherheits-Kopfzeilen, darunter eine Content-Security-Policy, stehen in `apps/web/public/_headers`; Cloudflare und der Node-Server wenden sie an.

## 3. Schlüssel für Benachrichtigungen (optional, für Push-Erinnerungen)

```bash
npx web-push generate-vapid-keys
```

- Den **öffentlichen** Schlüssel in `apps/api/wrangler.toml` bei `VAPID_PUBLIC_KEY` eintragen und `npm run deploy` wiederholen.
- Beide Schlüssel kommen außerdem als GitHub-Secrets in die Pipeline (Schritt 4).

Ohne diese Schlüssel erscheinen die Erinnerungen trotzdem in der App oben unter „Gemerkt“.

## 4. GitHub: Secrets für die Einsammel-Pipeline

Im Repository unter *Settings → Secrets and variables → Actions → New repository secret*:

| Secret | Pflicht | Inhalt |
|---|---|---|
| `API_URL` | ja | Adresse der App: eigene Domain aus Schritt 2a, sonst die `workers.dev`-Adresse aus Schritt 2 |
| `INGEST_KEY` | ja | derselbe Wert wie im Worker |
| `DEEPSEEK_API_KEY` | nein, aber empfohlen | KI für Kurzfassungen, Fristen-Nachprüfung, Horizont und Weite, Probeläufe; ohne läuft alles regelbasiert, die Weite fällt dann weg |
| `BRAVE_API_KEY` | nein | Websuche (Brave Search API) als zusätzliche Quelle für die Erkundung neuer Websites; ohne sucht die Erkundung nur bei der Arbeitsagentur |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | nein | aus Schritt 3 |
| `VAPID_SUBJECT` | nein | `mailto:` mit einer Adresse, unter der man dich erreicht |
| `CRAWLER_CONTACT` | nein | Kontakt, der im User-Agent steht, damit Seitenbetreiber sich melden können |

Danach unter *Actions → Einsammeln → Run workflow* den ersten Lauf starten. Der Lauf legt zuerst die Startdaten an (Städte, Einrichtungen, Quellen) und sammelt dann ein. Das Protokoll steht in der App unter *Ich → Quellen & Läufe → Läufe*.

**Zeitplan:** Der Workflow läuft täglich um 12 Uhr deutscher Zeit. GitHub rechnet in UTC, deshalb stehen zwei Zeiten im Workflow (10 und 11 Uhr UTC); ein kleiner erster Schritt prüft, welche davon gerade 12 Uhr in Deutschland ist, und lässt nur diese laufen. Sommer- und Winterzeit gehen so von selbst. Bei viel Betrieb startet GitHub geplante Läufe manchmal ein paar Minuten später. Eine andere Uhrzeit: die beiden `cron`-Zeilen und die Prüfung in `.github/workflows/einsammeln.yml` anpassen.

**Blinde Flecken:** Jeder Lauf endet mit der Erkundung. Sie sucht mit wechselnden Suchwörtern (Kernbereich und Brücken aus dem Horizont) bei der Jobsuche der Arbeitsagentur, mit `BRAVE_API_KEY` zusätzlich im Netz, und liest so lange Anzeigen von Websites, die noch nicht im Register stehen, bis mindestens drei neue dabei sind (`EXPLORE_MIN`). Schafft sie das nicht, steht eine Warnung im Lauf und in der App unter *Quellen & Läufe*.

## 5. Knöpfe „Jetzt einsammeln“ und „Probelauf“ (empfohlen)

Beide starten einen GitHub-Workflow aus der App heraus.

1. Auf GitHub ein *Fine-grained personal access token* anlegen: nur dieses Repository, Berechtigung *Actions: Read and write*.
2. `npx wrangler secret put GITHUB_TOKEN` (im Ordner `apps/api`).
3. In `wrangler.toml` bei `GITHUB_REPO` das Repository eintragen (`besitzer/name`) und neu veröffentlichen.

Ohne Token gibt es den Knopf „Jetzt einsammeln“ nicht, und ein Probelauf für eine neue Website wartet bis zum nächsten täglichen Lauf (er wird am Anfang jedes Laufs abgearbeitet). Der Workflow für Probeläufe heißt `quelle-pruefen.yml` (änderbar über `GITHUB_CHECK_WORKFLOW`) und braucht dieselben Secrets wie das Einsammeln.

## 5a. KI im Worker (optional, für Brücken-Vorschläge)

Unter *Ich → Horizont → Brücken vorschlagen lassen* schlägt die KI neue Brücken aus Profil und Interessen vor. Dafür braucht der Worker selbst einen Schlüssel:

```bash
cd apps/api
npx wrangler secret put LLM_API_KEY    # derselbe Schlüssel wie DEEPSEEK_API_KEY
```

`LLM_BASE_URL` und `LLM_MODEL` stehen in `wrangler.toml` (Standard DeepSeek). An die KI gehen dabei nur Stichworte aus dem Suchprofil (Themen, Methoden, Interessen, Namen der Brücken).

## 6. Automatisch veröffentlichen (optional)

Der Workflow „Veröffentlichen“ lädt bei jedem Push auf `main` App und Worker hoch und wendet neue Datenbank-Migrationen an. Dafür:

- Secrets `CLOUDFLARE_API_TOKEN` (Vorlage „Edit Cloudflare Workers“, dazu D1-Bearbeitungsrechte) und `CLOUDFLARE_ACCOUNT_ID`,
- unter *Variables* `AUTO_DEPLOY` = `true`.

## 7. Aufs Handy

1. Die Adresse der App im Browser öffnen (eigene Domain oder `workers.dev`) und den `APP_KEY` eingeben. Bequemer: einmal `https://stellen.deine-domain.de/#key=DEIN_APP_KEY` öffnen, die App übernimmt den Schlüssel und entfernt ihn sofort aus der Adresse.
2. **Android (Chrome):** Menü → *App installieren*.
   **iPhone/iPad (Safari):** Teilen → *Zum Home-Bildschirm*.
3. Für Benachrichtigungen die installierte App öffnen: *Ich → Fristen-Erinnerungen → Auf diesem Gerät einschalten*. Auf dem iPhone geht das nur in der installierten App (ab iOS 16.4).

## Grenzen der kostenlosen Kontingente

Stand Oktober 2026, bei den Anbietern nachprüfen, falls sich etwas ändert:

- **Cloudflare Workers (Free):** 100.000 API-Anfragen pro Tag, 10 ms Rechenzeit pro Anfrage. Abrufe der App-Dateien zählen nicht mit. Deshalb rechnet die App den Score selbst und holt Anzeigen seitenweise.
- **Cloudflare D1 (Free):** 5 GB Speicher, 5 Millionen gelesene und 100.000 geschriebene Zeilen pro Tag. Für eine Person reicht das weit.
- **GitHub Actions:** öffentlich unbegrenzt, privat 2.000 Minuten im Monat.
- **DeepSeek:** nach Verbrauch. Die Pipeline begrenzt die KI-Aufrufe pro Lauf (`LLM_MAX_CALLS`, Standard 900). Pro neuer Anzeige fallen meist ein bis zwei Aufrufe an (Kurzfassung, bei Horizont und Weite das Urteil, bei unplausiblen Fristen die Nachprüfung), dazu höchstens `WEITE_MAX_CHECKS` Weite-Prüfungen.
- **Brave Search API (optional):** Kontingent und Preis beim Anbieter prüfen. Die Erkundung stellt pro Lauf höchstens `EXPLORE_MAX_QUERIES` Suchanfragen.

## Stellschrauben der Pipeline

Als Umgebungsvariablen im Workflow `einsammeln.yml` oder lokal:

| Variable | Standard | Bedeutung |
|---|---|---|
| `HOST_INTERVAL_MS` | 1500 | Mindestabstand zwischen zwei Abrufen bei derselben Website |
| `MAX_CRAWL_DELAY_MS` | 15000 | Obergrenze für `Crawl-delay` aus der robots.txt |
| `MAX_LIST_PAGES` | 6 | Wie viele Seiten einer Stellenliste verfolgt werden |
| `MAX_NEW_PER_SOURCE` | 80 | Neue Anzeigen pro Quelle und Lauf |
| `REFETCH_AFTER_DAYS` | 6 | Bekannte Anzeigen nach so vielen Tagen neu lesen (Fristverlängerungen) |
| `GONE_AFTER_DAYS` | 3 | Nicht mehr gelistet seit … Tagen = abgelaufen (nur wenn die Quelle fehlerfrei lief) |
| `PURGE_AFTER_DAYS` | 14 | Abgelaufene, nicht gemerkte Anzeigen danach löschen |
| `SOURCE_CONCURRENCY` | 6 | Quellen gleichzeitig |
| `LLM_BASE_URL`, `LLM_MODEL` | DeepSeek, `deepseek-chat` | jeder OpenAI-kompatible Dienst geht |
| `LLM_MAX_CALLS` | 900 | KI-Aufrufe pro Lauf |
| `LLM_SUMMARIES` | 1 | `0` = keine KI-Kurzfassungen |
| `BROWSER` | 1 | `0` = ohne Browser-Agent |
| `BROWSER_MAX_ITEMS`, `BROWSER_BUDGET_MS` | 30, 12 Min. | Grenzen für den Browser-Agenten pro Lauf |
| `DISCOVERY_MAX` | 20 | Einrichtungen ohne Adresse, für die pro Lauf eine Stellenseite gesucht wird |
| `IMAGES_MAX` | 60 | Bilder (Wikipedia), die pro Lauf nachgeschlagen werden |
| `EXPLORE` | 1 | `0` = keine Erkundung neuer Websites |
| `EXPLORE_MIN` | 3 | So viele Anzeigen von Websites außerhalb des Registers soll jeder Lauf mindestens bringen |
| `EXPLORE_MAX_READS` | 40 | Höchstens so viele Anzeigen liest die Erkundung pro Lauf |
| `EXPLORE_QUERIES`, `EXPLORE_MAX_QUERIES` | 6, 18 | Suchwörter im ersten Durchgang und insgesamt (rotieren täglich) |
| `WEITE_MAX_CHECKS` | 60 | KI-Prüfungen für die Weite pro Lauf; der Rest kommt im nächsten Lauf dran |
| `BA_API_BASE` | Arbeitsagentur | Adresse der Jobsuche-Schnittstelle (nur für Tests ändern) |

## Ohne Cloudflare selbst betreiben

Alles läuft auch auf einem kleinen Rechner zu Hause (Raspberry Pi, NAS) mit einer SQLite-Datei:

```bash
npm install && npm run build:web
npm run seed:local
APP_KEY=geheim PORT=8787 npm run dev:node -w @stellen/api
# per Cron täglich um 12 Uhr (arbeitet auch wartende Probeläufe ab):
npm run ingest:local
# für Probeläufe sofort, z. B. alle 10 Minuten:
npm run cli -w @stellen/ingest -- check-sources
```

Von unterwegs erreichbar wird das erst mit einer HTTPS-Adresse (z. B. über einen Tunnel). Ohne HTTPS gibt es keinen Service Worker und keine Benachrichtigungen. Dasselbe geht auf einem gemieteten kleinen Server, etwa bei einem deutschen Anbieter; HTTPS übernimmt dann ein vorgeschalteter Webserver wie Caddy. Der Node-Server schickt dieselben Sicherheits-Kopfzeilen wie Cloudflare (aus `_headers`).

## Wenn etwas nicht klappt

- **„Der Schlüssel passt nicht“:** In der App ist ein anderer Wert als `APP_KEY` im Worker. Unter *Ich → Abmelden* neu eingeben.
- **`npm run deploy` lehnt die eigene Adresse ab:** Die Domain ist bei Cloudflare noch nicht aktiv (Nameserver beim Domain-Anbieter prüfen), oder für die Subdomain gibt es schon einen CNAME-Eintrag. Den Eintrag im Cloudflare-Dashboard löschen und erneut veröffentlichen.
- **Seit dem Umzug auf die eigene Domain bricht das Einsammeln ab:** Das Secret `API_URL` zeigt noch auf die `workers.dev`-Adresse (Schritt 2a, Punkt 5).
- **Pipeline bricht mit 401 ab:** `INGEST_KEY` in GitHub und im Worker unterscheiden sich.
- **Quelle steht auf „blockiert“:** Die robots.txt verbietet den Abruf. Unter *Ich → Quellen* lässt sich das pro Quelle bewusst übergehen, die Portale decken sie sonst mit ab.
- **Viele Quellen „ohne Adresse“:** Die Pipeline sucht nach und nach selbst und legt Vorschläge an (*Quellen → Neu*). Bis dahin finden die Portale deren Anzeigen.
- **Probelauf bleibt auf „wartet“:** Ohne `GITHUB_TOKEN` im Worker startet er erst mit dem nächsten Einsammeln. Mit Token: unter *Actions → Quelle prüfen* nachsehen, ob der Workflow lief.
- **Erkundung bringt weniger als drei Anzeigen:** Im Protokoll des Laufs steht, wie viele Suchen und Anzeigen es waren. Häufigster Grund: Die Schnittstelle der Arbeitsagentur hat sich geändert oder antwortet nicht. Mit `BRAVE_API_KEY` gibt es eine zweite Quelle.
- **Frist „unsicher“:** Die Regeln fanden ein unplausibles Datum (weit in der Zukunft, vor der Veröffentlichung, ohne Jahr und mehrdeutig). Mit KI-Schlüssel sieht die KI im Text nach und belegt die Frist mit einem wörtlichen Zitat; sonst bleibt der Hinweis „bitte im Original prüfen“ stehen.
- **Eine Anzeige ist unvollständig:** Sie wird für den Browser-Agenten vorgemerkt und beim nächsten Lauf erneut gelesen. Einzelne Seiten lassen sich lokal prüfen: `npm run cli -w @stellen/ingest -- agent <adresse>`.
