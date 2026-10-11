# Was noch offen ist

Stand: 10. Oktober 2026. Gebaut und getestet sind App, API, Datenbank und Einsammel-Pipeline (70 automatische Tests, dazu ein Browser-Durchlauf der Demo und ein Durchlauf App gegen API mit lokaler Datenbank). Offen ist vor allem alles, was echte Websites, deine Konten oder deine Entscheidungen braucht.

## 1. Bewusst später, als eigene Schritte

- [ ] **Interview-Prompt und Steckbrief-Format.** Die App liest bis dahin einen Entwurf (Version 0, `packages/core/src/steckbrief.ts`). Steht das Format, wird nur dieser Import angepasst; Profil, Score und Oberfläche bleiben.
- [ ] **Feinabstimmung des Scores.** Die Mechanik steht (Herzchen, Kategorien, „zählt halb“, „Lieber nicht“). Offen sind die Zahlen: Gewichte, ob „unbekannt = halb“ so bleibt, wie stark „Lieber nicht“ abzieht. Mit dem Startprofil landen fast alle Psychologie-Anzeigen über 75 %; trennscharf wird es erst mit dem Steckbrief.
- [ ] **Endgültige Quellenauswahl** nach dem Interview: schärfen und ergänzen (siehe Punkt 4).

## 2. Braucht dich zum Einrichten (etwa 30 Minuten, Anleitung in [BETRIEB.md](BETRIEB.md))

- [ ] Cloudflare-Konto, Datenbank anlegen, ID in `wrangler.toml` eintragen, `APP_KEY` und `INGEST_KEY` setzen, veröffentlichen.
- [ ] Code in ein GitHub-Repository, Secrets `API_URL` und `INGEST_KEY` eintragen, ersten Lauf starten.
- [ ] Optional: DeepSeek-Schlüssel. Ohne ihn läuft alles regelbasiert; es fehlen dann KI-Kurzfassungen, die KI-Linkauswahl und die KI-Schritte des Browser-Agenten.
- [ ] Optional: Push-Schlüssel (VAPID) für Erinnerungen als Benachrichtigung.
- [ ] App aufs Handy (auf dem iPhone über „Zum Home-Bildschirm“, nur dann gibt es Push).
- [ ] Name: „Stellenbüchlein“ ist ein Arbeitstitel.

## 3. Noch nicht gegen echte Websites getestet

Diese Arbeitsumgebung konnte keine Hochschul-Websites abrufen. Die Pipeline ist gegen einen nachgebauten Testserver geprüft (Listen, strukturierte Daten, PDFs, Cookie-Banner, per JavaScript geladene Seiten, KI-Agent mit Test-KI), aber nicht gegen die echten Seiten.

- [ ] **Erster echter Lauf und Durchsicht:** Quellen mit „Fehler“, „leer“ oder „Warnung“ ansehen, Adressen und Linkmuster nachschärfen. Rechne mit einigen Runden über die ersten ein bis zwei Wochen.
- [ ] **Adapter nach Dokumentation gebaut, live zu prüfen:** Jobsuche-API der Bundesagentur für Arbeit (Version, Feldnamen), Workday, Softgarden, Personio, Linkmuster von PsychJob und den übrigen Portalen.
- [ ] **Laufzeit eines kompletten Laufs** messen. Wichtig bei privatem GitHub-Repository (2.000 Minuten im Monat).
- [ ] **robots.txt:** Wie viele Seiten den Abruf verbieten, zeigt erst der echte Lauf. Pro Quelle entscheiden, ob du sie bewusst übergehen willst; sonst decken die Portale sie ab.
- [ ] **Bilder:** Die Reihenfolge Anzeige → Einrichtung → Stadt ist eingebaut, die Fotos kommen aus Wikipedia/Wikimedia. Die Abfrage ist nicht live getestet, und die Lizenzangaben unter den Bildern sollten einmal stichprobenartig geprüft werden. Die Demo hat keine echten Fotos, weil Wikimedia aus der Arbeitsumgebung nicht erreichbar war; dafür gibt es dort die Testfotos.
- [ ] **Entscheidung Fotos auf den Karten:** Mit Testfotos ausprobieren, ob Bilder im Stapel helfen oder zu unruhig sind. Der Schalter unter *Ich → Aussehen* steht auf „an“; bei „aus“ zeigt die Karte Ort und Score in einer Kopfzeile.

## 4. Quellenliste unvollständig

- [ ] **63 Einrichtungen ohne Adresse der Stellenseite.** Die Pipeline sucht sie selbst und legt Vorschläge zum Bestätigen an (*Ich → Quellen → Vorschläge*). Bis dahin finden die Portale deren Anzeigen.
- [ ] **Viele Adressen nicht verifiziert** (aus der Recherche übernommen).
- [ ] **Nicht recherchiert:** Unikliniken in Süddeutschland (Psychosomatik, Psychiatrie), private Hochschulen weitgehend, Fachhochschulen mit Psychologie-Studiengängen nur teilweise.
- [ ] **Portale ohne vollständige Adresse, deshalb abgeschaltet:** EURAXESS, academics.de, Helmholtz-Stellenbörse, Interamt.
- [ ] **Abgleich mit dem Hochschulkompass:** Alle Hochschulen mit Psychologie-Studiengang systematisch gegen die Startliste prüfen.

## 5. Noch nicht gebaut

- [ ] **Push bei neuen, gut passenden Anzeigen** (zum Beispiel ab 85 %). Die Einstellung ist in der API vorgesehen, aber nicht umgesetzt. Willst du das?
- [ ] **„Beworben“** ist gebaut (Knopf in jeder Anzeige, Markierung in den Listen), war aber nicht ausdrücklich besprochen. Passt das so?
- [ ] **Adresssuche für „Zuhause“.** Derzeit: Stadt wählen, aktuellen Standort nehmen oder Koordinaten eintragen. Standard bleibt Halle (Saale).
- [ ] **Mehrere Personen oder Profile.** Die App ist für eine Person gebaut (ein Schlüssel, ein Profil).
- [ ] **Systematischer Test mit Screenreader.** Bedienung per Tastatur und Beschriftungen sind da, ein gründlicher Test fehlt.

## 6. Bekannte Grenzen

- Benachrichtigungen kommen mit dem Einsammel-Lauf, also zweimal am Tag, nicht zu einer festen Uhrzeit.
- Neue Anzeigen erscheinen in der App, sobald sie geöffnet wird (kein Hintergrund-Abgleich).
- Die Karte ist stilisiert: Einrichtungen ohne eigene Koordinaten liegen am Stadtmittelpunkt und werden dort im Kreis verteilt.
- Die Demo enthält Anzeigen vom 9. Oktober 2026 als Kurzfassung in eigenen Worten. Ihre Fristen laufen nach und nach ab.
- Die App speichert Anzeigentexte für dich privat. Soll sie später auch anderen zugänglich sein, wäre vorher zu klären, wie Anzeigentexte und Ausnahmen von der robots.txt dann zu handhaben sind.
