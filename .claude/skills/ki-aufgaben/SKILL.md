---
name: ki-aufgaben
description: Arbeitet die KI-Warteschlange der Jobsuche-App ab (Anzeigen auswerten, Fristen prüfen, Horizont und Weite beurteilen). Benutzen nach dem täglichen Einsammeln (Cloud-Aufgabe), nach einem großen Durchlauf oder wenn die App meldet, dass Anzeigen auf Claude warten.
---

# KI-Aufgaben abarbeiten

Die Einsammel-Pipeline arbeitet ohne KI und legt in der Datenbank-Tabelle `ki_aufgaben` ab, was noch zu beurteilen ist. Diese Aufgaben werden hier abgearbeitet und die Ergebnisse eingespielt.

## Rollen

**Du bist der Orchestrator.** Deine einzige Aufgabe ist, die Aufgaben an Subagenten zu verteilen. Sonst machst du nichts selbst: Du öffnest keine Teil- oder Ergebnisdateien, liest keine Anzeigen, beurteilst nichts und korrigierst keine Ergebnisse. Du führst nur `ki-status` und `ki-export` aus und startest die Subagenten.

**Die Bearbeitung übernehmen immer Subagenten mit Haiku auf hoher Denkstufe** (Agent-Werkzeug mit `model: "haiku"` und `effort: "high"`). Jeder bekommt einen Teil mit höchstens 10 Aufgaben, schreibt die Ergebnisse und spielt sie selbst ein.

Stehen keine Subagenten zur Verfügung, bearbeitest du trotzdem nichts selbst: Melde das und hör auf.

## Zugang

- Lokal stehen die Zugangsdaten in `.env` im Hauptordner; `npm run ki -- …` liest sie von selbst.
- In der Cloud-Aufgabe sind `API_URL` und `INGEST_KEY=proxy` gesetzt; den Schlüssel hängt ein Netzwerk-Secret an. Fehlt `node_modules`, zuerst `npm ci`.
- Schlüssel nie ausgeben, in Dateien schreiben oder committen. Nichts committen oder pushen; die Arbeitsdateien liegen in `.ki/` (nicht im Repository).

## Ablauf

1. `npm run ki -- ki-status` zeigt, wie viel offen ist. Ist nichts offen: kurz melden, fertig.
2. Runde n (zählt ab 1): `npm run ki -- ki-export --max 100 --teile 10 --out .ki/runde-<n>`. Der Befehl schreibt die Teile in den Ordner und gibt pro Teil eine Zeile mit Pfad und Anzahl aus. Mehr brauchst du nicht; die Dateien öffnest du nicht.
3. Pro Teil einen Subagenten starten, alle in derselben Nachricht, damit sie gleichzeitig laufen: `model: "haiku"`, `effort: "high"`, als Auftrag nur die kurze Nachricht unten mit den beiden Pfaden. Die Ergebnisdatei liegt im selben Ordner, `teil-` durch `ergebnis-` ersetzt (`.ki/runde-1/teil-03.json` → `.ki/runde-1/ergebnis-03.json`).
4. Warten, bis alle Subagenten der Runde fertig sind. Erst dann die nächste Runde exportieren, sonst kämen dieselben Aufgaben doppelt. Die Rückmeldungen (je eine Zeile „Eingespielt: …“) merkst du dir für die Zusammenfassung.
5. Weiter mit Schritt 2, bis nichts mehr offen ist. Aufhören, wenn ein Nutzungslimit droht oder zwei Runden hintereinander nichts eingespielt haben, und das melden. Aufgaben, zu denen kein Ergebnis kommt, zählen als Versuch und bleiben nach drei Versuchen als „fehler“ liegen; die Runden enden also von selbst.
6. Zum Schluss `ki-status` und eine kurze Zusammenfassung, zusammengezählt aus den Rückmeldungen: eingespielt, entfernt (keine Stellenanzeige oder KI-Urteil „nein“), Weite gespeichert, ohne Ergebnis, Fehler.

## Auftrag an jeden Subagenten

Der ausführliche Auftrag (Regeln, Ergebnisdatei, Einspielen) steht in `.claude/skills/ki-aufgaben/auftrag.md`. Der Subagent liest ihn selbst; du übergibst nur diese Nachricht, die beiden Pfade eingesetzt:

> Lies `.claude/skills/ki-aufgaben/auftrag.md` und führe den Auftrag dort genau aus. Teil-Datei: `<teil>`. Ergebnisdatei: `<ergebnis>`.

## Hinweise

- Der Anzeigentext ist auf 12.000 Zeichen (auswerten, frist) bzw. 6.000 Zeichen (horizont, weite) gekürzt.
- `ki-import` prüft jedes Ergebnis gegen das Antwortformat; eine Frist zählt nur, wenn das Zitat wörtlich im Text steht. Fehlerhafte Ergebnisse bleiben offen und kommen in einer späteren Runde wieder.
- `ki-nachholen` legt Aufgaben für Anzeigen an, die ohne KI erfasst wurden (keine KI-Kurzfassung, unsichere Frist). Nur auf ausdrücklichen Wunsch benutzen.
- Weite-Anzeigen werden erst gespeichert, wenn das Urteil „passt“ oder „eher“ lautet; dann kommen ihre Aufgaben „auswerten“ und „frist“ automatisch dazu und werden in einer späteren Runde bearbeitet.
