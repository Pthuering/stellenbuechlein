# Was noch offen ist

Stand: 12. Oktober 2026. Gebaut und getestet sind App, API, Datenbank und Einsammel-Pipeline, seit diesem Stand auch Horizont mit Brücken und Weite, die Fristen-Prüfung, die Erkundung neuer Websites und der Probelauf für neue Quellen. Für die Veröffentlichung unter eigener Domain ist alles vorbereitet, samt Sicherheits-Kopfzeilen und Sperre für Suchmaschinen (118 automatische Tests, dazu Browser-Durchläufe der Demo und der echten App). Offen ist vor allem alles, was echte Websites, deine Konten oder deine Entscheidungen braucht.

## 0. Kurz entscheiden

- [ ] **„Morgens um 12“:** Eingestellt ist 12 Uhr mittags (deutsche Zeit) plus der Knopf „Jetzt einsammeln“. War Mitternacht gemeint, sind es zwei Zeilen in `.github/workflows/einsammeln.yml` (siehe [BETRIEB.md](BETRIEB.md)).
- [ ] **Domain:** eine eigene nur für die App oder eine Subdomain einer Domain, die du ohnehin nutzen willst (zum Beispiel `stellen.deine-domain.de`). Eingetragen wird sie in `apps/api/wrangler.toml` (Schritt 2a in [BETRIEB.md](BETRIEB.md)).

## 1. Bewusst später, als eigene Schritte

- [ ] **Interview-Prompt und Steckbrief-Format.** Die App liest bis dahin einen Entwurf (Version 0, `packages/core/src/steckbrief.ts`), inzwischen mit Horizont-Abschnitt (Interessen, Fähigkeiten, Brücken). Steht das Format, wird nur dieser Import angepasst; Profil, Score und Oberfläche bleiben.
- [ ] **Feinabstimmung des Scores.** Die Mechanik steht (Herzchen, Kategorien, „zählt halb“, „Lieber nicht“). Offen sind die Zahlen. Mit dem Startprofil landen fast alle Psychologie-Anzeigen über 75 %; trennscharf wird es erst mit dem Steckbrief.
- [ ] **Brücken schärfen.** Bis zum Interview gilt ein breiter Start-Horizont mit zehn Brücken. Nach den ersten echten Läufen ansehen, welche Brücken Unpassendes bringen (dann Begriffe streichen oder die Brücke pausieren) und welche Felder fehlen (KI-Vorschläge unter *Ich → Horizont*).
- [ ] **Endgültige Quellenauswahl** nach dem Interview: schärfen und ergänzen (siehe Punkt 4). Neue Websites aus der Erkundung lassen sich laufend per Probelauf aufnehmen.

## 2. Braucht dich zum Einrichten (etwa 30 Minuten, Anleitung in [BETRIEB.md](BETRIEB.md))

- [ ] Cloudflare-Konto, Datenbank anlegen, ID in `wrangler.toml` eintragen, `APP_KEY` und `INGEST_KEY` setzen, Migrationen anwenden, veröffentlichen.
- [ ] **Eigene Domain** (empfohlen): besorgen, bei Cloudflare hinzufügen (Nameserver umstellen, kann bis zu einem Tag dauern), Adresse in `wrangler.toml` eintragen, erneut veröffentlichen, GitHub-Secret `API_URL` auf die neue Adresse setzen.
- [ ] Code in ein GitHub-Repository, Secrets `API_URL` und `INGEST_KEY` eintragen, ersten Lauf starten.
- [ ] **DeepSeek-Schlüssel** (empfohlen): als GitHub-Secret `DEEPSEEK_API_KEY` für die Pipeline und als Worker-Secret `LLM_API_KEY` für die Brücken-Vorschläge. Ohne ihn läuft alles regelbasiert; es fehlen dann Kurzfassungen, KI-Urteile im Horizont, die Weite, die KI-Nachprüfung von Fristen und das KI-Urteil im Probelauf.
- [ ] **GitHub-Token im Worker** (empfohlen): für „Jetzt einsammeln“ und damit Probeläufe sofort starten statt mit dem nächsten Tageslauf.
- [ ] Optional: `BRAVE_API_KEY` als zweite Quelle für die Erkundung (Konditionen beim Anbieter prüfen).
- [ ] Optional: Push-Schlüssel (VAPID) für Erinnerungen als Benachrichtigung.
- [ ] App aufs Handy (auf dem iPhone über „Zum Home-Bildschirm“, nur dann gibt es Push).
- [ ] Name: „Stellenbüchlein“ ist ein Arbeitstitel.

## 3. Noch nicht gegen echte Websites getestet

Diese Arbeitsumgebung konnte weder Hochschul-Websites noch die Arbeitsagentur oder eine KI-Schnittstelle erreichen. Die Pipeline ist gegen einen nachgebauten Testserver geprüft (Listen, strukturierte Daten, PDFs, Cookie-Banner, per JavaScript geladene Seiten, KI-Agent, nachgebaute Jobsuche und eine Test-KI), aber nicht gegen die echten Dienste.

- [ ] **Erster echter Lauf und Durchsicht:** Quellen mit „Fehler“, „leer“ oder „Warnung“ ansehen, Adressen und Linkmuster nachschärfen. Rechne mit einigen Runden über die ersten ein bis zwei Wochen.
- [ ] **Erkundung live prüfen:** Ob die Jobsuche der Arbeitsagentur den Filter „veröffentlicht seit“ so annimmt und täglich genug Unbekanntes liefert. Die App zeigt im letzten Lauf, ob die drei Anzeigen von neuen Websites erreicht wurden; im Protokoll steht, welche Suchwörter liefen.
- [ ] **KI-Anweisungen kalibrieren:** Horizont-Urteil („passt/eher/nein“), Fristen-Nachprüfung und Quellen-Urteil sind nur mit einer Test-KI geprüft. Nach den ersten Läufen stichprobenartig ansehen, ob die KI zu streng oder zu großzügig ist (*Quellen → Aussortiert* zeigt die „nein“-Fälle mit Begründung).
- [ ] **Adapter nach Dokumentation gebaut, live zu prüfen:** Jobsuche-API der Bundesagentur für Arbeit (Version, Feldnamen), Workday, Softgarden, Personio, Brave Search, Linkmuster von PsychJob und den übrigen Portalen.
- [ ] **Laufzeit eines kompletten Laufs** messen, jetzt mit Erkundung und KI-Prüfungen. Wichtig bei privatem GitHub-Repository (2.000 Minuten im Monat).
- [ ] **robots.txt:** Wie viele Seiten den Abruf verbieten, zeigt erst der echte Lauf. Pro Quelle entscheiden, ob du sie bewusst übergehen willst; sonst decken die Portale sie ab.
- [ ] **Bilder:** Die Reihenfolge Anzeige → Einrichtung → Stadt ist eingebaut, die Fotos kommen aus Wikipedia/Wikimedia. Die Abfrage ist nicht live getestet, und die Lizenzangaben unter den Bildern sollten einmal stichprobenartig geprüft werden. Die Demo hat keine echten Fotos; dafür gibt es dort die Testfotos.
- [ ] **Entscheidung Fotos auf den Karten:** Mit Testfotos ausprobieren, ob Bilder im Stapel helfen oder zu unruhig sind. Der Schalter unter *Ich → Aussehen* steht auf „an“.

## 4. Quellenliste unvollständig

- [ ] **63 Einrichtungen ohne Adresse der Stellenseite.** Die Pipeline sucht sie selbst und legt Vorschläge an (*Ich → Quellen → Neu*). Bis dahin finden die Portale deren Anzeigen.
- [ ] **Viele Adressen nicht verifiziert** (aus der Recherche übernommen). Der Probelauf („Probelauf wiederholen“ in jeder Quelle) prüft sie einzeln.
- [ ] **Nicht recherchiert:** Unikliniken in Süddeutschland (Psychosomatik, Psychiatrie), private Hochschulen weitgehend, Fachhochschulen mit Psychologie-Studiengängen nur teilweise. Die Erkundung findet solche Websites nach und nach von selbst.
- [ ] **Städteliste:** 73 Städte. Anzeigen aus Orten außerhalb der Liste stehen ohne Stadt da (mit Koordinaten aus der Jobsuche trotzdem auf der Karte). Bei Bedarf ergänzen (`data/seed/cities.json`).
- [ ] **Portale ohne vollständige Adresse, deshalb abgeschaltet:** EURAXESS, academics.de, Helmholtz-Stellenbörse, Interamt.
- [ ] **Abgleich mit dem Hochschulkompass:** Alle Hochschulen mit Psychologie-Studiengang systematisch gegen die Startliste prüfen.

## 5. Noch nicht gebaut

- [ ] **Push bei neuen, gut passenden Anzeigen** (zum Beispiel ab 85 %). Die Einstellung ist in der API vorgesehen, aber nicht umgesetzt. Willst du das?
- [ ] **„Beworben“** ist gebaut (Knopf in jeder Anzeige, Markierung in den Listen), war aber nicht ausdrücklich besprochen. Passt das so?
- [ ] **Horizont auf der Karte:** Horizont-Anzeigen sind auf der Karte noch nicht eigens markiert (in Stapel, Listen und Filter schon).
- [ ] **Adresssuche für „Zuhause“.** Derzeit: Stadt wählen, aktuellen Standort nehmen oder Koordinaten eintragen. Standard bleibt Halle (Saale).
- [ ] **Mehrere Personen oder Profile.** Die App ist für eine Person gebaut (ein Schlüssel, ein Profil).
- [ ] **Systematischer Test mit Screenreader.** Bedienung per Tastatur und Beschriftungen sind da, ein gründlicher Test fehlt.

## 6. Bekannte Grenzen

- Eingesammelt wird einmal am Tag gegen 12 Uhr (GitHub startet geplante Läufe manchmal ein paar Minuten später) und per Knopf. Benachrichtigungen kommen mit diesem Lauf.
- Neue Anzeigen erscheinen in der App, sobald sie geöffnet wird (kein Hintergrund-Abgleich).
- „Neue Website“ heißt: Weder die Website noch der Arbeitgeber standen beim Fund im Register. Bei Jobbörsen zählt der Arbeitgeber; Anzeigen ohne erkennbaren Arbeitgeber zählen nicht mit.
- Über die Erkundung gefundene Anzeigen ohne Frist gelten nach 45 Tagen ohne neuen Fund als abgelaufen.
- Eine Frist, die die KI mit Zitat belegt, gilt auch dann, wenn sie ungewöhnlich weit in der Zukunft liegt; eine Frist vor der Veröffentlichung gilt nie.
- An die KI gehen Anzeigentexte und für Horizont, Weite und Vorschläge Stichworte aus dem Suchprofil (Themen, Methoden, Interessen, Brücken), keine Namen oder Kontaktdaten von dir.
- Die Karte ist stilisiert: Einrichtungen ohne eigene Koordinaten liegen am Stadtmittelpunkt und werden dort im Kreis verteilt.
- Die Demo enthält Anzeigen vom 9. und 12. Oktober 2026 als Kurzfassung in eigenen Worten. Ihre Fristen laufen nach und nach ab. Probelauf und KI-Vorschläge sind dort nur nachgestellt.
- Die App speichert Anzeigentexte für dich privat. Soll sie später auch anderen zugänglich sein, wäre vorher zu klären, wie Anzeigentexte und Ausnahmen von der robots.txt dann zu handhaben sind und ob die Seite dann Impressum und Datenschutzerklärung braucht.
- Unter der eigenen Domain ist die App öffentlich erreichbar, zeigt ohne Schlüssel aber nur die Anmeldung und ist für Suchmaschinen gesperrt.
