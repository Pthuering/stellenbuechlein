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
| `horizont` | optional: Stellen außerhalb des Kernbereichs, siehe unten |

## Horizont

Am Ende des Interviews: Welche Themen außerhalb der Psychologie findest du spannend? Wo könntest du dir vorstellen, dein Wissen und Können einzusetzen, auch außerhalb der Forschung? Daraus entstehen **Brücken**: ein anderes Feld plus die Anknüpfung an die Person. Brücken dürfen weit reichen; eingegrenzt wird über das, was die Person im Interview sagt.

| Feld | Inhalt |
|---|---|
| `horizont.interessen[]` | Themen außerhalb der Psychologie in Worten, z. B. „Künstliche Intelligenz“ (die KI nutzt sie für Vorschläge und Urteile) |
| `horizont.faehigkeiten[]` | Fähigkeiten und Wissen als Suchbegriffe, die in andere Felder tragen, z. B. `statistik`, `"r"`, `befragung`, `didaktik` (Vorauswahl für die Weite; die Begriffe aus `methoden` zählen zusätzlich) |
| `horizont.bruecken[]` | `name`; `feld[]` (Begriffe für das andere Feld, einer reicht); `anker[]` (optional: Begriffe für die Anknüpfung, leer = Standard: Menschen, Verhalten, Empirie); `suche[]` (optional: Suchwörter für die Erkundung, z. B. „Usable Security“); `warum` (ein Satz) |
| `horizont.start_bruecken_behalten` | `true` = die zehn breiten Start-Brücken bleiben zusätzlich (Standard: nur die Brücken aus dem Steckbrief) |
| `horizont.weite` | `true` (Standard) = die KI prüft auch Anzeigen ohne Brücke auf übertragbare Fähigkeiten |
| `horizont.dosis` | wie oft eine Horizont-Karte im Stapel kommt: `aus`, `selten` (jede 6. bis 8.), `normal` (jede 3. bis 5., Standard), `oft` (jede 2. bis 3.) |

Für Feld-Begriffe gilt: keine Floskeln, die in fast jeder Anzeige stehen („Weiterbildung“, „Datenschutz“, „Gesundheitsmanagement“, „Motivation“), sonst passt die Brücke überall. Fehlt der Abschnitt, gilt der breite Start-Horizont.

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
  "orte": { "bundeslaender": ["SN", "ST", "TH"], "staedte": ["Leipzig", "Halle (Saale)"], "einrichtungen": [] },
  "horizont": {
    "interessen": ["Künstliche Intelligenz", "IT-Sicherheit", "Nachhaltigkeit"],
    "faehigkeiten": ["statistik", "\"r\"", "\"eeg\"", "experiment", "befragung", "datenanalyse"],
    "bruecken": [
      {
        "name": "Mensch & KI",
        "feld": ["kuenstliche intelligenz", "\"ki\"", "machine learning", "sprachmodell", "chatbot"],
        "anker": [],
        "suche": ["KI Akzeptanz", "Human-AI Interaction"],
        "warum": "Wie Menschen mit KI-Systemen arbeiten und ihnen vertrauen, ist eine psychologische Frage."
      },
      {
        "name": "IT-Sicherheit",
        "feld": ["it sicherheit", "cybersecurity", "informationssicherheit", "phishing", "security"],
        "anker": ["verhalten", "awareness", "nutzer", "mensch", "befragung", "experiment", "akzeptanz"],
        "suche": ["Usable Security", "Security Awareness"],
        "warum": "Die größte Schwachstelle ist oft das Verhalten von Menschen, nicht die Technik."
      }
    ],
    "start_bruecken_behalten": false,
    "weite": true,
    "dosis": "normal"
  }
}
```

## Umfrage in der App

Seit dem 25. Oktober 2026 fragt die App selbst: *Ich → Umfrage für Profil starten*. 21 kurze Seiten in acht Teilen (Über dich, Inhalte, Die Stelle, Rahmen, Können, Orte, Horizont, Zum Schluss), mit Vorschlägen zum Antippen, Herzchen und Fortschrittsanzeige. Fragen und Vorschläge mit ihren Suchbegriffen stehen in `packages/core/src/umfrage.ts`; daraus entsteht ein Steckbrief in diesem Format, den derselbe Import einliest.

- Die Antworten liegen als Einstellung `umfrage` auf dem Server (Zwischenstand mit Seite, weitermachen geht auf jedem Gerät). Katalog-Einträge speichern nur ihre id, die Begriffe kommen beim Umwandeln aus dem Katalog; bessere Begriffe dort wirken also auch auf ältere Antworten.
- Was (noch) nicht in den Score eingeht, bleibt für den Feinschliff gespeichert: Stand, Studium und Abschlussarbeit, Start, Einrichtungsarten, Mobilität, Traumstelle, Sonstiges. Auf der Ergebnisseite gibt „Antworten kopieren“ alles als Text aus.
- Brücken: Zur Wahl stehen die zehn Start-Brücken; gewählte werden zu Brücken aus dem Steckbrief. Wählt man keine, bleiben alle zehn.

In der App: *Ich → Steckbrief importieren*, einfügen oder als Datei wählen, prüfen, Lieblingsorte abhaken, übernehmen. Das bisherige Profil lässt sich direkt danach wiederherstellen. Die Brücken stehen danach unter *Ich → Horizont* und lassen sich dort bearbeiten, pausieren und um KI-Vorschläge ergänzen.
