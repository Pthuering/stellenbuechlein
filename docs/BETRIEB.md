# Einrichten und Betreiben

Die App läuft komplett in kostenlosen Kontingenten:

| Teil | Wo | Wofür |
|---|---|---|
| App (PWA) und API | Cloudflare Worker mit statischen Dateien | Oberfläche, Abgleich, Einstellungen |
| Datenbank | Cloudflare D1 | Anzeigen, Markierungen, Quellen, Läufe |
| Einsammeln | GitHub Actions, zweimal täglich | Anzeigen holen, Erinnerungen verschicken |
| KI (optional) | DeepSeek-API oder ein anderer OpenAI-kompatibler Dienst | schwierige Seiten auswerten, Kurzfassungen |

Du brauchst: ein GitHub-Konto, ein Cloudflare-Konto, Node.js 22 auf dem Rechner (nur für die Einrichtung) und optional einen DeepSeek-API-Schlüssel.

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
npm run db:migrate:remote
npx wrangler secret put APP_KEY       # Schlüssel für die App, z. B. aus: openssl rand -base64 32
npx wrangler secret put INGEST_KEY    # zweiter, anderer Zufallswert für die Pipeline
cd ../..
npm run deploy                        # baut die App und lädt den Worker hoch
```

Am Ende steht die Adresse da, etwa `https://stellenbuechlein.<dein-name>.workers.dev`.

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
| `API_URL` | ja | Adresse des Workers aus Schritt 2 |
| `INGEST_KEY` | ja | derselbe Wert wie im Worker |
| `DEEPSEEK_API_KEY` | nein | für KI-Auswertung und Kurzfassungen; ohne läuft alles regelbasiert |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | nein | aus Schritt 3 |
| `VAPID_SUBJECT` | nein | `mailto:` mit einer Adresse, unter der man dich erreicht |
| `CRAWLER_CONTACT` | nein | Kontakt, der im User-Agent steht, damit Seitenbetreiber sich melden können |

Danach unter *Actions → Einsammeln → Run workflow* den ersten Lauf starten. Der Lauf legt zuerst die Startdaten an (Städte, Einrichtungen, Quellen) und sammelt dann ein. Das Protokoll steht in der App unter *Ich → Quellen & Läufe → Läufe*.

## 5. Knopf „Jetzt einsammeln“ (optional)

1. Auf GitHub ein *Fine-grained personal access token* anlegen: nur dieses Repository, Berechtigung *Actions: Read and write*.
2. `npx wrangler secret put GITHUB_TOKEN` (im Ordner `apps/api`).
3. In `wrangler.toml` bei `GITHUB_REPO` das Repository eintragen (`besitzer/name`) und neu veröffentlichen.

## 6. Automatisch veröffentlichen (optional)

Der Workflow „Veröffentlichen“ lädt bei jedem Push auf `main` App und Worker hoch und wendet neue Datenbank-Migrationen an. Dafür:

- Secrets `CLOUDFLARE_API_TOKEN` (Vorlage „Edit Cloudflare Workers“, dazu D1-Bearbeitungsrechte) und `CLOUDFLARE_ACCOUNT_ID`,
- unter *Variables* `AUTO_DEPLOY` = `true`.

## 7. Aufs Handy

1. Die Worker-Adresse im Browser öffnen und den `APP_KEY` eingeben. Bequemer: einmal `https://…workers.dev/#key=DEIN_APP_KEY` öffnen, die App übernimmt den Schlüssel und entfernt ihn sofort aus der Adresse.
2. **Android (Chrome):** Menü → *App installieren*.
   **iPhone/iPad (Safari):** Teilen → *Zum Home-Bildschirm*.
3. Für Benachrichtigungen die installierte App öffnen: *Ich → Fristen-Erinnerungen → Auf diesem Gerät einschalten*. Auf dem iPhone geht das nur in der installierten App (ab iOS 16.4).

## Grenzen der kostenlosen Kontingente

Stand Oktober 2026, bei den Anbietern nachprüfen, falls sich etwas ändert:

- **Cloudflare Workers (Free):** 100.000 API-Anfragen pro Tag, 10 ms Rechenzeit pro Anfrage. Abrufe der App-Dateien zählen nicht mit. Deshalb rechnet die App den Score selbst und holt Anzeigen seitenweise.
- **Cloudflare D1 (Free):** 5 GB Speicher, 5 Millionen gelesene und 100.000 geschriebene Zeilen pro Tag. Für eine Person reicht das weit.
- **GitHub Actions:** öffentlich unbegrenzt, privat 2.000 Minuten im Monat.
- **DeepSeek:** nach Verbrauch. Die Pipeline begrenzt die KI-Aufrufe pro Lauf (`LLM_MAX_CALLS`, Standard 400).

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
| `LLM_MAX_CALLS` | 400 | KI-Aufrufe pro Lauf |
| `LLM_SUMMARIES` | 1 | `0` = keine KI-Kurzfassungen |
| `BROWSER` | 1 | `0` = ohne Browser-Agent |
| `BROWSER_MAX_ITEMS`, `BROWSER_BUDGET_MS` | 30, 12 Min. | Grenzen für den Browser-Agenten pro Lauf |
| `DISCOVERY_MAX` | 20 | Einrichtungen ohne Adresse, für die pro Lauf eine Stellenseite gesucht wird |
| `IMAGES_MAX` | 60 | Bilder (Wikipedia), die pro Lauf nachgeschlagen werden |

## Ohne Cloudflare selbst betreiben

Alles läuft auch auf einem kleinen Rechner zu Hause (Raspberry Pi, NAS) mit einer SQLite-Datei:

```bash
npm install && npm run build:web
npm run seed:local
APP_KEY=geheim PORT=8787 npm run dev:node -w @stellen/api
# per Cron zweimal täglich:
npm run ingest:local
```

Von unterwegs erreichbar wird das erst mit einer HTTPS-Adresse (z. B. über einen Tunnel). Ohne HTTPS gibt es keinen Service Worker und keine Benachrichtigungen.

## Wenn etwas nicht klappt

- **„Der Schlüssel passt nicht“:** In der App ist ein anderer Wert als `APP_KEY` im Worker. Unter *Ich → Abmelden* neu eingeben.
- **Pipeline bricht mit 401 ab:** `INGEST_KEY` in GitHub und im Worker unterscheiden sich.
- **Quelle steht auf „blockiert“:** Die robots.txt verbietet den Abruf. Unter *Ich → Quellen* lässt sich das pro Quelle bewusst übergehen, die Portale decken sie sonst mit ab.
- **Viele Quellen „ohne Adresse“:** Die Pipeline sucht nach und nach selbst und legt Vorschläge an (*Quellen → Vorschläge*). Bis dahin finden die Portale deren Anzeigen.
- **Eine Anzeige ist unvollständig:** Sie wird für den Browser-Agenten vorgemerkt und beim nächsten Lauf erneut gelesen. Einzelne Seiten lassen sich lokal prüfen: `npm run cli -w @stellen/ingest -- agent <adresse>`.
