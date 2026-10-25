# Was noch offen ist

Stand: 23. Oktober 2026. Gebaut und getestet sind App, API, Datenbank und Einsammel-Pipeline mit Horizont, Weite, Fristen-Prüfung, Erkundung und Probelauf. Seit diesem Stand dazu:

- **Website-Paket** für den eigenen Webspace ([WEBSITE.md](WEBSITE.md)), läuft auch in einem Unterordner und zeigt anfangs **Dummy-Daten**,
- die **Platzhalter-Checkliste** in der App,
- **Benachrichtigung bei neuen, sehr gut passenden Anzeigen** und **Horizont auf der Karte**,
- eine **Adresssuche** fürs Zuhause,
- neue Anbindungen: BITE-Schnittstelle (viele Hochschulen), Hidden Professionals (TU Darmstadt, Goethe, JGU), Greenhouse, Lever, SmartRecruiters, Recruitee, Ashby und beliebige JSON-Listen,
- eine stark erweiterte **Startliste: 531 Einrichtungen mit 620 Stellenseiten** (vorher 158 und 127), davon 110 Unternehmen.

Insgesamt laufen 131 automatische Tests und ein Browser-Durchlauf der Demo. Was jetzt noch Dummy, Beispiel oder Standardwert ist, zeigt die App selbst in der Checkliste. Die Liste hier ergänzt sie um Entscheidungen und Arbeit, die die App nicht sehen kann.

## 0. Kurz entscheiden

- [x] **Wo die App wohnt:** vorerst im Cloudflare-Worker unter `https://stellenbuechlein.philipp-thuering.workers.dev` (entschieden am 25. Oktober). Eine Subdomain deiner Domain ([BETRIEB.md](BETRIEB.md), Schritt 2a) oder deine Website ([WEBSITE.md](WEBSITE.md)) lassen sich später ergänzen.
- [ ] **„Morgens um 12“:** Eingestellt ist 12 Uhr mittags (deutsche Zeit) plus der Knopf „Jetzt einsammeln“. War Mitternacht gemeint, sind es zwei Zeilen in `.github/workflows/einsammeln.yml`.
- [ ] **Benachrichtigung bei neuen Anzeigen:** ist an (ab 85 %). Mit dem Startprofil liegen fast alle Psychologie-Anzeigen darüber, es käme also täglich eine Sammelnachricht. Nach dem Steckbrief passt die Schwelle besser; sonst unter *Ich → Erinnerungen* ausschalten.
- [ ] **Unternehmen im Stapel:** Firmen sind normale Quellen mit Grobfilter (nur Anzeigen mit Psychologie-Bezug, der Rest über Brücken). Sollen sie seltener erscheinen, lässt sich im Filter die Einrichtungsart „Unternehmen“ abwählen.

## 1. Bewusst später, als eigene Schritte

- [ ] **Interview-Prompt und Steckbrief-Format.** Die App liest bis dahin einen Entwurf (Version 0, `packages/core/src/steckbrief.ts`). Steht das Format, wird nur dieser Import angepasst.
- [ ] **Feinabstimmung des Scores** (Zahlen), **Brücken schärfen**, **endgültige Quellenauswahl** nach dem Interview.

## 2. Einrichtung

Erledigt am 25. Oktober 2026:

- [x] **GitHub:** privates Repository `Pthuering/stellenbuechlein` mit den Secrets `API_URL`, `INGEST_KEY`, `VAPID_PUBLIC_KEY` und `VAPID_PRIVATE_KEY`.
- [x] **Cloudflare:** Datenbank in der EU (Region EEUR) mit allen Tabellen, Worker mit `APP_KEY` und `INGEST_KEY`, öffentlicher Push-Schlüssel und `GITHUB_REPO` in `apps/api/wrangler.toml`.
- [x] **Lokale Kopie aller Schlüssel** in `.env` im Hauptordner (nicht im Repository). In Cloudflare und GitHub lassen sich Secrets nicht mehr auslesen.

Fehlt noch, mit Anleitung in [BETRIEB.md](BETRIEB.md) und in der Checkliste der App (*Server und Konten*):

- [ ] **DeepSeek-Schlüssel:** GitHub-Secret `DEEPSEEK_API_KEY`, für Brücken-Vorschläge zusätzlich das Worker-Secret `LLM_API_KEY` (Schritte 4 und 5a).
- [ ] **GitHub-Token** für „Jetzt einsammeln“ und sofortige Probeläufe (Schritt 5).
- [ ] **Kontaktadresse** (`CRAWLER_CONTACT`, `VAPID_SUBJECT`): bewusst vorerst leer.
- [ ] **Erster Lauf** unter *Actions → Einsammeln → Run workflow*, sonst startet er von selbst um 12 Uhr. Danach im Repository unter *Settings → Billing* nachsehen, wie viele der 2.000 Minuten ein Lauf braucht.
- [ ] Optional: **automatisch veröffentlichen** bei jedem Push (Schritt 6).

## 3. Quellen: Stand der Recherche vom 23. Oktober

Neun parallele Recherchen haben Hochschulen und Kliniken in allen Regionen, außeruniversitäre Institute und Unternehmen abgesucht und jede eingetragene Adresse abgerufen. 515 der 620 Stellenseiten wurden dabei geprüft (die Seite war erreichbar und listet Anzeigen, auch eine gerade leere Liste zählt). Was nicht geprüft werden konnte, hat eine Notiz mit Grund.

- [ ] **Erster echter Lauf und Durchsicht.** Quellen mit „Fehler“, „leer“ oder „Warnung“ unter *Ich → Quellen & Läufe* ansehen. Für gezielte Tests ohne Speichern: `npm run cli -w @stellen/ingest -- test-source <adresse>` und die Stichprobe `… -- probe --n 60` (Ergebnis siehe unten).
- [ ] **17 Einrichtungen ohne Stellenseite**, u. a. BIPS (Website liefert leere Antworten), Touro Berlin, VICTORIA, HS Harz, HS Neu-Ulm (Bot-Schutz), BKH Landshut, forsa, viasto, concept m. Die Pipeline sucht selbst und legt Vorschläge an.
- [ ] **Seiten hinter Bot-Schutz** (HU Berlin, GESIS, MPI-IS, MEDIAN) oder zeitweise nicht erreichbar (MHH, Universitätsmedizin Magdeburg und Greifswald, WZB, CISPA, Frankfurt UAS am Recherchetag). Beim ersten Lauf prüfen; die Portale decken solche Lücken ab.
- [x] **robots.txt:** Sperren gelten nicht mehr (Standard `ROBOTS=0`); Abstand pro Website und Crawl-delay bleiben. Damit sind auch SmartRecruiters (Bosch, Aumovio, NIQ/GfK) und die bisher gesperrten Hochschulseiten lesbar.
- [ ] **Große Konzerne** (BMW, Mercedes-Benz, SAP, Zalando, Telekom, Porsche) laden ihre Suche nur per JavaScript; dafür braucht es den Browser-Agenten. Nach dem ersten Lauf prüfen, ob die Stichwortsuche greift.
- [ ] **Globale Listen** (NIQ, Kantar, Human8, Pearson) enthalten viel aus dem Ausland. Der Grobfilter sortiert nach Psychologie, nicht nach Land; ausländische Orte stehen ohne Stadt da.
- [ ] **Koordinaten neuer Städte** (87) sind auf etwa 0,01 Grad genau aus der Recherche übernommen. Für die Karte reicht das.
- [ ] **Abgleich mit dem Hochschulkompass** bleibt sinnvoll: Die Recherche hat nach Psychologie-Studiengängen gesucht, aber nicht systematisch Studiengang für Studiengang.
- [ ] **Portale ohne vollständige Adresse, deshalb abgeschaltet:** EURAXESS, academics.de, Helmholtz-Stellenbörse, Interamt.

## 4. Noch nicht gegen echte Dienste getestet

- [ ] **Erkundung** (Jobsuche der Arbeitsagentur), **KI-Anweisungen** (Horizont-Urteil, Fristen-Nachprüfung, Quellen-Urteil), **Workday/Softgarden/Personio** im großen Lauf, **Laufzeit** eines kompletten Laufs mit jetzt rund 650 Quellen (wichtig bei privatem GitHub-Repository: 2.000 Minuten im Monat), **Bilder** aus Wikimedia.
- Live geprüft sind seit diesem Stand: BITE, Hidden Professionals, Ashby, Lever, Greenhouse, JSON-Listen (LMU Klinikum, FOM) und die Adresssuche.

## 5. Noch nicht gebaut

- [ ] **Mehrere Personen oder Profile.** Die App ist für eine Person gebaut (ein Schlüssel, ein Profil).
- [ ] **Systematischer Test mit Screenreader.** Bedienung per Tastatur und Beschriftungen sind da, ein gründlicher Test fehlt.

## 6. Bekannte Grenzen

- Eingesammelt wird einmal am Tag gegen 12 Uhr und per Knopf. Benachrichtigungen kommen mit diesem Lauf.
- Neue Anzeigen erscheinen in der App, sobald sie geöffnet wird (kein Hintergrund-Abgleich).
- Mit Dummy-Daten ist die App ohne Schlüssel für alle sichtbar, die die Adresse kennen; mit echten Daten nur mit Schlüssel. Suchmaschinen sind in beiden Fällen ausgesperrt.
- Die Dummy-Anzeigen sind erfunden; ihre Einrichtungen, Städte und Quellen sind echt. Der Knopf in einer Dummy-Anzeige führt zur echten Stellenliste der Einrichtung.
- Die Adresssuche schickt die Eingabe an OpenStreetMap (Nominatim); gespeichert wird der Ort auf etwa 100 m gerundet.
- An die KI gehen Anzeigentexte und Stichworte aus dem Suchprofil, keine Namen oder Kontaktdaten von dir.
- Die Karte ist stilisiert: Einrichtungen ohne eigene Koordinaten liegen am Stadtmittelpunkt.
- „Neue Website“ heißt: Weder die Website noch der Arbeitgeber standen beim Fund im Register. Bei Jobbörsen und Bewerbermanagement-Systemen mit Firmennamen im Pfad (Lever, Greenhouse, SmartRecruiters, JOIN) zählt der Arbeitgeber.
- Soll die App später auch anderen zugänglich sein, wäre vorher zu klären, wie Anzeigentexte, Ausnahmen von der robots.txt sowie Impressum und Datenschutzerklärung zu handhaben sind.
