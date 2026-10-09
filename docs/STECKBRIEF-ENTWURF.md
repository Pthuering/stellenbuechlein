# Steckbrief: Entwurf des Formats (Version 0)

Das endgültige Format und der Interview-Prompt sind ein eigener Schritt. Dieser Entwurf zeigt, was die App heute einlesen kann, und dient als Ausgangspunkt. Eingelesen wird er in `packages/core/src/steckbrief.ts`; ein neues Format braucht dort nur einen weiteren Parser.

## Grundregeln für das Interview-Ergebnis

- **Großzügig statt streng.** Lieber mehr Begriffe und Schreibweisen (deutsch und englisch, Wortanfänge statt ganzer Wörter) als zu wenige. Der Steckbrief sortiert nur, er sortiert nie etwas aus.
- **Wichtigkeit als 1 bis 3 Herzchen.** 3 = zentral, 2 = wichtig, 1 = schön, wenn es passt.
- **Begriffsschreibweise:** `kognit` passt auf Wortanfänge (kognitiv, Kognition), `*psych` passt überall im Wort (Neuropsychologie), `"R"` nur auf das ganze Wort. Umlaute dürfen als ä oder ae geschrieben werden.

## Felder

| Feld | Inhalt |
|---|---|
| `format`, `version` | immer `"stellenbuechlein-steckbrief"` und `0` |
| `name` | Name des Profils |
| `themen[]` | Fachgebiete und Forschungsthemen: `label`, `begriffe[]`, `wichtigkeit` |
| `stellenarten[]` | `art` (promotion, postdoc, wiss_ma, professur, projekt, lehre, klinik, shk, verwaltung) mit `wichtigkeit` |
| `methoden[]` | Methoden, Software, Erfahrungen: wie `themen` |
| `rahmen` | `entgelt_min` (z. B. 13 für E 13), `umfang_min` (Prozent), jeweils mit `…_wichtigkeit`; `unbefristet_wichtigkeit` (0 bis 3); `sprache` (`de` oder `en`) |
| `lieber_nicht[]` | `label`, `begriffe[]` und/oder `art`, `wichtigkeit` (zieht 5 Punkte je Herz ab) |
| `orte` | Vorschläge für Lieblingsorte: `bundeslaender` (Kürzel wie SN, ST, TH), `staedte`, `einrichtungen` |
| `gewichte` | optional: Anteil der Kategorien `thema`, `stelle`, `methoden`, `rahmen` (Standard 45/30/10/15) |

## Beispiel

```json
{
  "format": "stellenbuechlein-steckbrief",
  "version": 0,
  "name": "Beispiel",
  "themen": [
    { "label": "Kognitive Neurowissenschaft", "begriffe": ["kognitive neurowiss", "cognitive neuroscience", "*neurowiss"], "wichtigkeit": 3 },
    { "label": "Emotionsregulation", "begriffe": ["emotionsregulation", "emotion regulation"], "wichtigkeit": 2 },
    { "label": "Klinische Psychologie", "begriffe": ["klinische psych", "clinical psych"], "wichtigkeit": 1 }
  ],
  "stellenarten": [
    { "art": "promotion", "wichtigkeit": 3 },
    { "art": "wiss_ma", "wichtigkeit": 2 }
  ],
  "methoden": [
    { "label": "EEG", "begriffe": ["\"eeg\"", "elektroenzephalogra"], "wichtigkeit": 2 },
    { "label": "R / Statistik", "begriffe": ["\"r\"", "statistik", "mehrebenen"], "wichtigkeit": 1 }
  ],
  "rahmen": { "entgelt_min": 13, "entgelt_wichtigkeit": 2, "umfang_min": 65, "umfang_wichtigkeit": 1, "unbefristet_wichtigkeit": 0 },
  "lieber_nicht": [
    { "label": "Lehrkraft für besondere Aufgaben", "begriffe": ["lehrkraft fuer besondere aufgaben", "\"lfba\""], "wichtigkeit": 2 }
  ],
  "orte": { "bundeslaender": ["SN", "ST", "TH"], "staedte": ["Leipzig", "Halle (Saale)"], "einrichtungen": [] }
}
```

In der App: *Ich → Steckbrief importieren*, einfügen oder als Datei wählen, prüfen, Lieblingsorte abhaken, übernehmen. Das bisherige Profil lässt sich direkt danach wiederherstellen.
