# Stellenbüchlein

Private App für die Suche nach Forschungsstellen mit Psychologie-Bezug in Deutschland: Universitäten, Hochschulen, Unikliniken und außeruniversitäre Institute (Max-Planck, Leibniz, Helmholtz, Fraunhofer, Ressortforschung). Die Anzeigen werden täglich gegen 12 Uhr (oder per Knopf) eingesammelt, nach einem einstellbaren Suchprofil sortiert und im Notizbuch-Look angezeigt. Dazu kommen Stellen außerhalb des Kernbereichs, die über eine „Brücke“ zu dir passen könnten, und in jedem Lauf mindestens drei Anzeigen von Websites, die noch nicht im Quellen-Register stehen.

„Stellenbüchlein“ ist ein Arbeitstitel.

## Was die App kann

- **Stapel:** Karteikarten zum Wischen. Rechts merken, links weglegen, Stern für Herzensjobs, hochwischen oder tippen für die ganze Anzeige. Jede Karte zeigt Foto (Anzeige, sonst Einrichtung, sonst Stadt, sonst eine gezeichnete Postkarte), Score, Eckdaten und Frist. Etwa jede 3. bis 5. Karte kommt aus dem **Horizont** (lavendelfarbenes Etikett, „Warum das passen könnte“). Der Verlauf zeigt alle gemerkten und weggelegten Anzeigen, jede Entscheidung lässt sich ändern.
- **Horizont:** Brücken in andere Felder (z. B. IT-Sicherheit, Mensch & KI, UX), auch außerhalb der Forschung. Die KI prüft jede Brücken-Anzeige auf Plausibilität und schreibt einen Satz, warum sie passen könnte; in der **Weite** schlägt sie auch Stellen ohne Brücke vor, in denen deine Fähigkeiten tragen. Brücken kommen aus dem Steckbrief, aus KI-Vorschlägen oder von dir, und lassen sich in jeder Anzeige pausieren.
- **Fristen:** Offen ist nur, was nicht abgelaufen ist. Fristen ohne Jahr werden ergänzt, verlängerte Fristen erkannt, unplausible Daten von der KI mit wörtlichem Zitat nachgeprüft; was unsicher bleibt, ist gelb markiert.
- **Blinde Flecken:** Jeder Lauf erkundet mit wechselnden Suchwörtern Websites außerhalb des Registers und bringt mindestens drei Anzeigen von dort mit. Neue Websites stehen unter *Quellen → Neu* und kommen per Probelauf ins Register.
- **Neue Quellen mit Probelauf:** Website eingeben, die Pipeline liest Liste und Probe-Anzeigen, die KI beurteilt das Ergebnis (Stellenliste? wer schreibt aus? vollständig gelesen? nötige Einstellungen?). Übernommen wird erst nach deiner Bestätigung.
- **Karte:** gemerkte (oder alle offenen) Anzeigen auf einer gezeichneten Deutschlandkarte. Tippen zoomt von Deutschland über Bundesland und Stadt bis zur Einrichtung. Orte lassen sich dort direkt als Lieblingsort markieren.
- **Gemerkt:** sortierbare Liste (Frist, Score, neu, Nähe), Fristen-Zettel für Herzensjobs, abgelaufene Gemerkte bleiben erhalten.
- **Alle:** jede offene Anzeige, unabhängig vom Wischen, mit Suche, Filtern und Sortierung.
- **Ich:** Suchprofil mit Herzchen-Score, Horizont, Steckbrief-Import, Lieblingsorte, Zuhause und Umkreis (Standard: Halle (Saale)), Fristen-Erinnerungen (1 Monat, 1 Woche, 1 Tag vorher, änderbar, auch als Push), Quellen mit Zustand, Vorschlägen, Aussortiertem und Lauf-Protokollen, Bilder auf den Karten an oder aus, helles und dunkles Notizbuch.

Gestaltung: Weiß und Beige als Fläche, Rosa als Primärfarbe, Lavendel sparsam für Orientierung, Hellgelb nur für Fristen und Herzensjobs. Die Regeln stehen in [docs/GESTALTUNG.md](docs/GESTALTUNG.md).

Grundsätze: Lieber eine unnötige Anzeige mehr als eine passende zu wenig. Das Suchprofil sortiert nur, es filtert nie etwas weg. Wischen ist nur Anzeige und verändert den Score nicht. Mehr dazu in [docs/KONZEPT.md](docs/KONZEPT.md).

## Aufbau

```
apps/web      PWA (React, Vite) – Notizbuch-Oberfläche, offline nutzbar, Push-Erinnerungen
apps/api      Cloudflare Worker (Hono) – API unter /api und Auslieferung der PWA, Datenbank D1
apps/ingest   Einsammel-Pipeline (Node, läuft in GitHub Actions) – Kaskade aus JSON-LD, Feeds,
              Bewerbungsportalen, Sitemaps, KI-Auswertung und Browser-Agent (Playwright)
packages/core Gemeinsame Logik: Score, Felder (Entgelt, Umfang, Befristung, Frist), Dubletten, Filter
packages/db   Datenbankschema und -zugriff (D1, SQLite lokal, Fernzugriff für die Pipeline)
data/seed     Startliste: 73 Städte, 158 Einrichtungen, Portale
```

Kosten: Alles läuft in kostenlosen Kontingenten (Cloudflare Workers und D1, GitHub Actions). Nur die KI kostet etwas, je nach Anzahl neuer Anzeigen Cent-Beträge pro Lauf (DeepSeek-API, austauschbar). Ohne KI läuft alles regelbasiert, nur die Weite und die KI-Urteile fallen weg.

## Schnell ausprobieren

```bash
npm install
npm run build:demo            # eine einzelne HTML-Datei mit echten Beispielanzeigen
open apps/web/dist-demo/index.html
```

Die Demo braucht keinen Server, alles bleibt im Browser. Sie enthält echte Anzeigen vom 9. und 12. Oktober 2026, darunter drei Horizont-Anzeigen und fünf von Websites außerhalb des Registers. Probelauf und KI-Vorschläge sind in der Demo nur nachgestellt. Die Beispielanzeigen haben keine Fotos; unter *Ich → Aussehen → Testfotos* lassen sich eigene Bilder darauf verteilen.

## Lokal entwickeln

```bash
npm install
npm run seed:local                       # Startdaten in ./stellen.sqlite
npm run ingest:local -- --max 5          # ein kleiner Einsammel-Lauf (braucht Internet)
npm run build:web
APP_KEY=geheim npm run dev:node -w @stellen/api   # API + gebaute App auf http://localhost:8787
npm run dev:web                          # Oberfläche mit Hot Reload auf http://localhost:5173
```

Einzelne Quelle testen, ohne etwas zu speichern:

```bash
npm run cli -w @stellen/ingest -- test-source https://www.example-uni.de/stellen --render
npm run cli -w @stellen/ingest -- check-source https://www.example-uni.de/      # Probelauf mit KI-Urteil
npm run cli -w @stellen/ingest -- agent https://www.example-uni.de/stellen/123
```

## Einrichten für den echten Betrieb

Schritt für Schritt in [docs/BETRIEB.md](docs/BETRIEB.md): Cloudflare-Konto, Datenbank, Schlüssel, GitHub-Secrets, App aufs Handy.

## Prüfen

```bash
npm run typecheck
npm test                      # Kernlogik, API, Pipeline gegen einen lokalen Testserver
npm run build:demo && npm run smoke:demo -w @stellen/web   # Demo im echten Browser durchklicken
```

## Was noch offen ist

Siehe [docs/OFFEN.md](docs/OFFEN.md). Das Steckbrief-Format ist noch ein Entwurf: [docs/STECKBRIEF-ENTWURF.md](docs/STECKBRIEF-ENTWURF.md).
