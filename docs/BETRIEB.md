# Einrichten und Betreiben

Die App läuft komplett in kostenlosen Kontingenten:

| Teil | Wo | Wofür |
|---|---|---|
| App (PWA) und API | Cloudflare Worker mit statischen Dateien, unter eigener Domain oder `….workers.dev` | die Website selbst: Oberfläche, Abgleich, Einstellungen |
| Datenbank | Cloudflare D1 | Anzeigen, Markierungen, Quellen, Läufe |
| Einsammeln | GitHub Actions, täglich gegen 12 Uhr und per Knopf | Anzeigen holen, gezielt neue Websites erkunden, Erinnerungen verschicken |
| Probelauf neuer Quellen | GitHub Actions, per Knopf in der App | eine Website prüfen, bevor sie ins Register kommt |
| KI beim Aufbereiten der Anzeigen | Claude über dein Claude-Abo: tägliche Cloud-Aufgabe, ein Orchestrator (Opus) verteilt die Anzeigen an Haiku-Subagenten (Schritt 4b) | Anzeigen auswerten (Titel, Eckdaten, Kurzfassung, ist es überhaupt eine Anzeige?), unklare Fristen nachprüfen, Horizont und Weite beurteilen |
| KI in der App (optional) | DeepSeek-API oder ein anderer OpenAI-kompatibler Dienst | KI-Assistent, Brücken-Vorschläge und Probelauf neuer Quellen, also nur, was du in der App selbst anstößt |

Die Website, die du im Browser öffnest, liefert Cloudflare aus. GitHub hostet keine Seite: Dort liegen nur der Code und die Abläufe zum Einsammeln und Prüfen.

Cloudflare liefert App und Server unter einer Adresse aus (`….workers.dev`).

Du brauchst: ein GitHub-Konto, ein Cloudflare-Konto, Node.js 22 auf dem Rechner (nur für die Einrichtung), ein Claude-Abo (Pro oder Max) für das Aufbereiten der Anzeigen und optional einen DeepSeek-API-Schlüssel für die KI in der App.

## 1. Code in ein eigenes GitHub-Repository

Den Ordner als neues Repository hochladen (privat oder öffentlich). Bei einem öffentlichen Repository sind die Actions-Minuten unbegrenzt, bei einem privaten gibt es 2.000 Minuten im Monat. Wie lange ein Lauf mit allen Quellen dauert, ist noch nicht gemessen (siehe [OFFEN.md](OFFEN.md)); bei einem privaten Repository die Minuten nach den ersten Läufen unter *Settings → Billing* prüfen.

Wichtig: Schlüssel gehören nie ins Repository, nur in die Secrets.

## 2. Cloudflare: Datenbank und Worker

```bash
npm install
cd apps/api
npx wrangler login
npx wrangler d1 create stellenbuechlein --jurisdiction eu
```

`--jurisdiction eu` hält die Datenbank in der EU; das lässt sich nur beim Anlegen festlegen. Die ausgegebene `database_id` in `apps/api/wrangler.toml` eintragen. Dann:

```bash
npm run db:migrate:remote              # legt alle Tabellen an; nach Updates erneut ausführen (neue Migrationen)
npx wrangler secret put APP_KEY       # Schlüssel für die App, z. B. aus: openssl rand -base64 32
npx wrangler secret put INGEST_KEY    # zweiter, anderer Zufallswert für die Pipeline
cd ../..
npm run deploy                        # baut die App und lädt den Worker hoch
```

Am Ende steht die Adresse da, etwa `https://stellenbuechlein.<dein-name>.workers.dev`.

Die App ist für Suchmaschinen gesperrt (`robots.txt` und Kopfzeile `X-Robots-Tag`). Weitere Sicherheits-Kopfzeilen, darunter eine Content-Security-Policy, stehen in `apps/web/public/_headers`; Cloudflare und der Node-Server wenden sie an.

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
| `API_URL` | ja | Adresse der App, die `workers.dev`-Adresse aus Schritt 2 |
| `INGEST_KEY` | ja | derselbe Wert wie im Worker |
| `DEEPSEEK_API_KEY` | nein | nur für den Probelauf neuer Quellen (Workflow „Quelle prüfen“); das Einsammeln selbst arbeitet ohne KI |
| `CLAUDE_TASK_URL`, `CLAUDE_TASK_TOKEN` | nein, aber empfohlen | API-Auslöser der Claude-Cloud-Aufgabe aus Schritt 4b: Damit startet die Aufbereitung direkt nach dem Einsammeln |
| `BRAVE_API_KEY` | nein | Websuche (Brave Search API) als zusätzliche Quelle für die Erkundung neuer Websites; ohne sucht die Erkundung nur bei der Arbeitsagentur |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | nein | aus Schritt 3 |

Danach unter *Actions → Einsammeln → Run workflow* den ersten Lauf starten. Der Lauf legt zuerst die Startdaten an (Städte, Einrichtungen, Quellen) und sammelt dann ein. Das Protokoll steht in der App unter *Ich → Quellen & Läufe → Läufe*.

**Zeitplan:** Der Workflow läuft täglich um 12 Uhr deutscher Zeit. GitHub rechnet in UTC, deshalb stehen zwei Zeiten im Workflow (10 und 11 Uhr UTC); ein kleiner erster Schritt prüft, welche davon gerade 12 Uhr in Deutschland ist, und lässt nur diese laufen. Sommer- und Winterzeit gehen so von selbst. Bei viel Betrieb startet GitHub geplante Läufe manchmal ein paar Minuten später. Eine andere Uhrzeit: die beiden `cron`-Zeilen und die Prüfung in `.github/workflows/einsammeln.yml` anpassen.

**Neue, sehr gut passende Anzeigen:** Am Ende jedes Laufs berechnet die Pipeline für alle neuen Anzeigen den Score mit deinem Suchprofil und schickt, wenn welche über der Schwelle liegen (Standard 85 %, in der App unter *Ich → Erinnerungen*), eine gebündelte Benachrichtigung. Braucht die Push-Schlüssel aus Schritt 3.

**Blinde Flecken:** Jeder Lauf endet mit der Erkundung. Sie sucht mit wechselnden Suchwörtern (Kernbereich und Brücken aus dem Horizont) bei der Jobsuche der Arbeitsagentur, mit `BRAVE_API_KEY` zusätzlich im Netz, und liest so lange Anzeigen von Websites, die noch nicht im Register stehen, bis mindestens drei neue dabei sind (`EXPLORE_MIN`). Schafft sie das nicht, steht eine Warnung im Lauf und in der App unter *Quellen & Läufe*.

**Browser-Warteschlange:** Seiten, deren Anzeigen erst per JavaScript erscheinen oder die unvollständig gelesen wurden, liest der Browser-Agent nach, im täglichen Lauf aber nur 30 (Zeitgrenze und Actions-Minuten). Nach einem großen Lauf den Rückstau unter *Actions → Browser-Warteschlange → Run workflow* abarbeiten (oder `gh workflow run browser.yml -R Pthuering/stellenbuechlein`): bis zu 300 Seiten in höchstens 105 Minuten, dabei fragt er für jede Seite die KI (grob 1 Cent pro Seite). Er läuft nie gleichzeitig mit dem Einsammeln.

**Großer Durchlauf:** Nach einem neuen Suchprofil (Umfrage oder Steckbrief) zeigt die App unter *Ich* den Kasten „Profil prüfen und freigeben“. Mit der Freigabe startet der Workflow „Großer Durchlauf“: alle Quellen ohne Mengengrenzen (beliebig viele neue Anzeigen je Quelle, bis zu 30 Listenseiten, KI ohne Obergrenze, Weite für alles, früher Aussortiertes wird mit dem neuen Profil neu beurteilt), 12 Quellen und 4 Browser-Seiten gleichzeitig, die ganze Browser-Warteschlange. GitHub erlaubt höchstens 6 Stunden pro Lauf; ist dann noch etwas offen, startet der Workflow sich selbst neu und macht dort weiter (höchstens 8 Runden). Ändert sich das Profil später, bietet die App einen neuen großen Durchlauf an. Der Lauf selbst arbeitet ohne KI; alles, was eine KI beurteilen soll, landet in der KI-Warteschlange (Schritt 4b). Bei sehr vielen Aufgaben lässt sich die Aufbereitung über mehrere Tage verteilen.

## 4b. Claude bereitet die Anzeigen auf (Cloud-Aufgabe)

Das Einsammeln arbeitet ohne KI. Was eine KI beurteilen soll, legt es in der Tabelle `ki_aufgaben` ab: Anzeigen auswerten (Titel, Eckdaten, Kurzfassung, und ob es überhaupt eine Stellenanzeige ist; was keine ist, wird entfernt), unklare Fristen mit wörtlichem Zitat nachprüfen, Horizont- und Weite-Anzeigen beurteilen (Weite-Anzeigen werden erst bei „passt“ oder „eher“ gespeichert). Abgearbeitet wird die Warteschlange von Claude mit dem Skill `ki-aufgaben` (`.claude/skills/ki-aufgaben/SKILL.md`): Ein Orchestrator (gern Opus) verteilt die Aufgaben in Teilen zu je 10 an Subagenten mit Haiku auf hoher Denkstufe und macht sonst nichts selbst. Die Subagenten beurteilen die Anzeigen und spielen die Ergebnisse ein; der Orchestrator liest keine Anzeigen. Die App zeigt unter *Ich → Einsammeln*, wie viele Anzeigen noch warten.

**Von Hand** (hier am Rechner oder per Remote Control): in Claude Code im Projektordner `/ki-aufgaben` eingeben. Die Zugangsdaten kommen aus `.env`. Die Befehle dahinter: `npm run ki -- ki-status`, `ki-export`, `ki-import` und `ki-nachholen` (legt Aufgaben für Anzeigen an, die noch ohne KI erfasst wurden).

**Was keine Stellenanzeige ist**, fängt schon das Einsammeln ab, damit weniger bei Claude landet: Eine Seite mit Nachrichten-, Termin- oder Formularadresse (oder einem Rubrik-Titel wie „Karriere“) und ohne jedes Merkmal einer Ausschreibung wird gar nicht erst gespeichert. Eine Seite mit zu wenig Merkmalen wird gespeichert, bleibt aber in der App unsichtbar (Status „pruefung“), bis Claude sie ausgewertet hat; konnte Claude sie nach drei Versuchen nicht beurteilen, erscheint sie trotzdem. In der App lässt sich jede Anzeige von Hand als „Keine Stellenanzeige“ melden. Alle Urteile landen unter *Ich → Quellen & Läufe → Aussortiert*. Daraus lernt `npm run ki -- quellen-muster` Adressanfänge, unter denen nur solche Seiten liegen (z. B. der Nachrichtenordner einer Hochschule), zeigt sie an und speichert sie mit `--los`; der Lauf überspringt sie, außer eine Adresse sieht nach einer Stelle aus. Ab und zu wiederholen.

**Dubletten:** Dieselbe Anzeige unter mehreren Adressen (gleicher Text, oder fast gleicher Text unter fast derselben Adresse wie Sprachversion oder Sitzungs-Parameter; aus zwei Quellen genügt der gleiche Titel) wird nur einmal gespeichert, die weiteren Adressen merkt sich die Tabelle `job_aliases`. Dieselbe Vorlage für zwei Orte oder zwei Kliniken bleibt getrennt. `npm run ki -- aufraeumen` wendet dieselben Regeln einmal auf den Bestand an und löscht falsche Kennziffern (Web-Adressen, Jahreszahlen); ohne `--los` zeigt es nur an.

**Täglich in der Cloud**, auch wenn der Rechner aus ist (geplante Aufgabe in Claude Code, Pro- oder Max-Abo):

1. **Umgebung anlegen** unter claude.ai/code, Umgebungen: Netzwerkzugang *Custom* mit der Adresse des Workers (`stellenbuechlein.<dein-name>.workers.dev`) und „Also include default list of common package managers“; Umgebungsvariablen `API_URL=https://stellenbuechlein.<dein-name>.workers.dev` und `INGEST_KEY=proxy`; Setup-Skript `npm ci`.
2. **Netzwerk-Secret** in derselben Umgebung: Typ *Bearer*, Host die Adresse des Workers, Wert der `INGEST_KEY`. Der Proxy hängt den Schlüssel an die Anfragen; die Sitzung selbst sieht ihn nie.
3. **Geplante Aufgabe anlegen** unter claude.ai/code/routines: Repository `Pthuering/stellenbuechlein`, die Umgebung aus Punkt 1, Modell **Opus** (das ist der Orchestrator; die Subagenten laufen laut Skill immer auf Haiku), Anweisung: „Arbeite mit dem Skill ki-aufgaben die KI-Warteschlange der Jobsuche-App vollständig ab. Du bist nur Orchestrator: Verteile die Aufgaben an Haiku-Subagenten und bearbeite nichts selbst. Committe und pushe nichts.“ Auslöser: **API** (Adresse und Token kopieren, das Token wird nur einmal gezeigt) und zur Sicherheit ein **Zeitplan** täglich um 14:07 Uhr.
4. **In GitHub** die Secrets `CLAUDE_TASK_URL` (Adresse) und `CLAUDE_TASK_TOKEN` (Token) anlegen. Ab dann startet der Einsammel-Lauf die Aufbereitung direkt nach dem Einsammeln.
5. **Testen:** in der Aufgabe *Run now*; der Lauf erscheint als Sitzung unter claude.ai/code.

Die Aufgabe zählt gegen dein Abo-Kontingent. Laut den Nutzungsbedingungen ist das Abo für die persönliche Nutzung gedacht; Produkte für andere sollen API-Schlüssel verwenden.

## 5. Knöpfe „Jetzt einsammeln“ und „Probelauf“ (empfohlen)

Beide starten einen GitHub-Workflow aus der App heraus.

1. Auf GitHub ein *Fine-grained personal access token* anlegen: nur dieses Repository, Berechtigung *Actions: Read and write*.
2. `npx wrangler secret put GITHUB_TOKEN` (im Ordner `apps/api`).
3. In `wrangler.toml` bei `GITHUB_REPO` das Repository eintragen (`besitzer/name`) und neu veröffentlichen.

Ohne Token gibt es den Knopf „Jetzt einsammeln“ nicht, und ein Probelauf für eine neue Website wartet bis zum nächsten täglichen Lauf (er wird am Anfang jedes Laufs abgearbeitet). Der Workflow für Probeläufe heißt `quelle-pruefen.yml` (änderbar über `GITHUB_CHECK_WORKFLOW`) und braucht dieselben Secrets wie das Einsammeln.

## 5a. KI im Worker (optional, für den KI-Assistenten und Brücken-Vorschläge)

Mit einem Schlüssel im Worker gibt es zwei Dinge in der App: den **KI-Assistenten** (*Ich → KI-Assistent*, dazu „KI fragen“ in jeder Anzeige und „Mit der KI besprechen“ im Horizont) und unter *Ich → Horizont → Brücken vorschlagen lassen* neue Brücken aus Profil und Interessen. Dafür braucht der Worker selbst einen Schlüssel:

```bash
cd apps/api
npx wrangler secret put LLM_API_KEY    # derselbe Schlüssel wie DEEPSEEK_API_KEY
```

`LLM_BASE_URL` und `LLM_MODEL` stehen in `wrangler.toml` (Standard DeepSeek, immer das große Modell `deepseek-v4-pro`).

**So arbeitet der KI-Assistent (Mini-Harness):** Das Gespräch läuft in der App, denn dort liegen alle Anzeigen. Die KI bekommt Werkzeuge: Anzeigen suchen und zählen, eine Anzeige vollständig lesen (mit Score-Details), Brücken an allen offenen Anzeigen testen. Ändern kann sie nichts selbst; für Markierungen, Notizen, Brücken, Suchprofil und Filter legt sie Vorschläge an, die du per „Übernehmen“ annimmst. Für möglichst gute Antworten bekommt sie eine feste Grundanweisung mit deinem ganzen Suchprofil und den Regeln der App, zu jeder Frage frischen Kontext (Datum, Datenstand, Markierungen, Filter, Lieblingsorte, die geöffnete Anzeige samt Volltext, deine Entscheidungen über ihre Vorschläge) und eine Arbeitsweise mit Prüfschritt; die Knöpfe zum Start geben zusätzlich passende Arbeitsaufträge mit. Der Worker legt Modell, höchste Denkstufe und Werkzeuge fest; nach höchstens 12 Schritten muss die KI antworten. Grundanweisung, Werkzeuge und Aufträge stehen in `packages/core/src/assistant.ts`.

**Kosten:** Eine Frage kostet je nach Recherche etwa 1 bis 5 Cent. Unter *Ich → KI-Assistent* stehen der Verbrauch von heute und im Monat (Gespräche, Brücken-Vorschläge und Probeläufe, pro Tag aufklappbar) und das Guthaben bei DeepSeek. Ab 1 € an einem Tag erscheint ein Hinweis; gesperrt wird nichts.

**Was an die KI geht:** bei Brücken-Vorschlägen nur Stichworte aus dem Suchprofil. Im KI-Assistenten zusätzlich deine Fragen, das ganze Suchprofil, Anzeigentexte, deine Markierungen und Notizen zu den Anzeigen, die sie liest, und die nächstgelegene Stadt deines Zuhauses (keine Straße). DeepSeek ist ein Anbieter aus China; persönliche Angaben gehören deshalb nicht in Fragen und Notizen.

## 6. Automatisch veröffentlichen (optional)

Der Workflow „Veröffentlichen“ lädt bei jedem Push auf `main` App und Worker hoch und wendet neue Datenbank-Migrationen an. Dafür:

- Secrets `CLOUDFLARE_API_TOKEN` (Vorlage „Edit Cloudflare Workers“, dazu D1-Bearbeitungsrechte) und `CLOUDFLARE_ACCOUNT_ID`,
- unter *Variables* `AUTO_DEPLOY` = `true`.

## 7. Aufs Handy

1. Die Adresse der App im Browser öffnen (`workers.dev`) und den `APP_KEY` eingeben. Bequemer: einmal `https://stellenbuechlein.<dein-name>.workers.dev/#key=DEIN_APP_KEY` öffnen, die App übernimmt den Schlüssel und entfernt ihn sofort aus der Adresse.
2. **Android (Chrome):** Menü → *App installieren*.
   **iPhone/iPad (Safari):** Teilen → *Zum Home-Bildschirm*.
3. Für Benachrichtigungen die installierte App öffnen: *Ich → Fristen-Erinnerungen → Auf diesem Gerät einschalten*. Auf dem iPhone geht das nur in der installierten App (ab iOS 16.4).

## Grenzen der kostenlosen Kontingente

Stand Oktober 2026, bei den Anbietern nachprüfen, falls sich etwas ändert:

- **Cloudflare Workers (Free):** 100.000 API-Anfragen pro Tag, 10 ms Rechenzeit pro Anfrage. Abrufe der App-Dateien zählen nicht mit. Deshalb rechnet die App den Score selbst und holt Anzeigen seitenweise.
- **Cloudflare D1 (Free):** 5 GB Speicher, 5 Millionen gelesene und 100.000 geschriebene Zeilen pro Tag. Für eine Person reicht das weit.
- **GitHub Actions:** öffentlich unbegrenzt, privat 2.000 Minuten im Monat.
- **Claude (Abo):** Die Aufbereitung der Anzeigen zählt gegen das Kontingent deines Claude-Abos (Fünf-Stunden-Fenster und Wochenlimit), gemeinsam mit deiner sonstigen Claude-Nutzung. Verbrauch unter claude.ai/settings/usage.
- **DeepSeek:** nach Verbrauch, nur für den KI-Assistenten, Brücken-Vorschläge und Probeläufe; die Übersicht steht unter *Ich → KI-Assistent*.
- **Brave Search API (optional):** Kontingent und Preis beim Anbieter prüfen. Die Erkundung stellt pro Lauf höchstens `EXPLORE_MAX_QUERIES` Suchanfragen.

## Stellschrauben der Pipeline

Als Umgebungsvariablen im Workflow `einsammeln.yml` oder lokal:

| Variable | Standard | Bedeutung |
|---|---|---|
| `HOST_INTERVAL_MS` | 1500 | Mindestabstand zwischen zwei Abrufen bei derselben Website |
| `ROBOTS` | 0 | `1` = Sperren aus der robots.txt beachten; Standard: nicht beachten (Abstand und Crawl-delay gelten immer) |
| `MAX_CRAWL_DELAY_MS` | 15000 | Obergrenze für `Crawl-delay` aus der robots.txt |
| `MAX_LIST_PAGES` | 6 | Wie viele Seiten einer Stellenliste verfolgt werden |
| `MAX_NEW_PER_SOURCE` | 80 | Neue Anzeigen pro Quelle und Lauf |
| `REFETCH_AFTER_DAYS` | 6 | Bekannte Anzeigen nach so vielen Tagen neu lesen (Fristverlängerungen) |
| `GONE_AFTER_DAYS` | 3 | Nicht mehr gelistet seit … Tagen = abgelaufen (nur wenn die Quelle fehlerfrei lief) |
| `PURGE_AFTER_DAYS` | 14 | Abgelaufene, nicht gemerkte Anzeigen danach löschen |
| `SOURCE_CONCURRENCY` | 6 | Quellen gleichzeitig |
| `SOURCE_BUDGET_MIN` | 90 | Nach so vielen Minuten beginnt ein Lauf keine neuen Quellen mehr (Portale ab Minute 70 nur noch sie); die übrigen kommen im nächsten Lauf zuerst dran. Der Workflow bricht nach 120 Minuten ab. |
| `HTTP_CACHE_MAX` | 200 | So viele abgerufene Seiten hält ein Lauf im Speicher (gegen doppeltes Abrufen) |
| `LLM_BASE_URL`, `LLM_MODEL` | DeepSeek, `deepseek-v4-pro` | jeder OpenAI-kompatible Dienst geht; bei DeepSeek immer das große Modell (Flash, `deepseek-chat` und `deepseek-reasoner` werden durch `deepseek-v4-pro` ersetzt) |
| `LLM_MAX_CALLS` | 900 | KI-Aufrufe pro Lauf (nur, wenn die Pipeline mit KI-Schlüssel läuft, etwa lokal; im Workflow arbeitet sie ohne KI) |
| `LLM_SUMMARIES` | 1 | `0` = keine KI-Kurzfassungen |
| `BROWSER` | 1 | `0` = ohne Browser-Agent |
| `BROWSER_MAX_ITEMS`, `BROWSER_BUDGET_MS` | 30, 12 Min. | Grenzen für den Browser-Agenten pro Lauf |
| `BROWSER_CONCURRENCY` | 1 | Seiten, die der Browser-Agent gleichzeitig liest (großer Durchlauf: 4) |
| `RUN_BUDGET_MIN` | 105 | Nach so vielen Minuten (Uhrzeit ab Laufbeginn) beginnt der Browser-Agent keine Seite mehr |
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
- **Pipeline bricht mit 401 ab:** `INGEST_KEY` in GitHub und im Worker unterscheiden sich.
- **Quelle steht auf „blockiert“:** Die Website lehnt den Abruf ab (HTTP 401 oder 403, oft ein Bot-Schutz). Häufig hilft der Browser-Agent („Seite im Browser öffnen“ in der Quelle); sonst decken die Portale sie mit ab. Sperren aus der robots.txt gelten nur, wenn `ROBOTS=1` gesetzt ist.
- **Viele Quellen „ohne Adresse“:** Die Pipeline sucht nach und nach selbst und legt Vorschläge an (*Quellen → Neu*). Bis dahin finden die Portale deren Anzeigen.
- **Probelauf bleibt auf „wartet“:** Ohne `GITHUB_TOKEN` im Worker startet er erst mit dem nächsten Einsammeln. Mit Token: unter *Actions → Quelle prüfen* nachsehen, ob der Workflow lief.
- **Erkundung bringt weniger als drei Anzeigen:** Im Protokoll des Laufs steht, wie viele Suchen und Anzeigen es waren. Häufigster Grund: Die Schnittstelle der Arbeitsagentur hat sich geändert oder antwortet nicht. Mit `BRAVE_API_KEY` gibt es eine zweite Quelle.
- **Frist „unsicher“:** Die Regeln fanden ein unplausibles Datum (weit in der Zukunft, vor der Veröffentlichung, ohne Jahr und mehrdeutig). Mit KI-Schlüssel sieht die KI im Text nach und belegt die Frist mit einem wörtlichen Zitat; sonst bleibt der Hinweis „bitte im Original prüfen“ stehen.
- **Eine Anzeige ist unvollständig:** Sie wird für den Browser-Agenten vorgemerkt und beim nächsten Lauf erneut gelesen. Einzelne Seiten lassen sich lokal prüfen: `npm run cli -w @stellen/ingest -- agent <adresse>`.
