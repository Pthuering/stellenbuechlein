# Konzept und Entscheidungen

## Leitlinien

1. **Nichts verpassen.** Lieber eine unnötige Anzeige mehr als eine passende zu wenig. Deshalb sammelt die Pipeline breit ein und filtert nur dort grob, wo Quellen sehr viel Fachfremdes liefern.
2. **Das Suchprofil sortiert, es filtert nie.** Kein Steckbrief-Eintrag kann eine Anzeige ausblenden. Ausblenden tun nur Filter, die du selbst setzt, und die gelten nur für Stapel, Liste und Karte. Gelöscht wird dadurch nichts.
3. **Verständlich und direkt einstellbar.** Der Score besteht aus Herzchen, die man sieht und ändern kann. Kein Lernen aus dem Wischen.
4. **Vollständige Anzeigen.** Jede Anzeige soll ganz in der App stehen. Wo das nicht gelingt, steht ein Hinweis und die Anzeige kommt in die Warteschlange des Browser-Agenten.

## Welche Anzeigen hereinkommen

Quellen sind Einrichtungen mit Psychologie-Forschung oder Psychologie-Studiengang, dazu benachbarte Forschung: Psychosomatik und Psychiatrie an Unikliniken, Bildungsforschung, Arbeitswissenschaft, Institute von Max-Planck, Leibniz, Helmholtz, Fraunhofer sowie Ressortforschung. Die Startliste steht in `data/seed/` und wird nach dem Interview noch einmal geschärft.

Zwei Arten von Quellen:

- **Fachbereichs-Seiten** (Institut für Psychologie, Lehrstühle): Jede Anzeige wird übernommen.
- **Breite Quellen** (zentrale Stellenbörsen, Portale): Eine Anzeige muss mindestens einen Begriff aus dem **Grobfilter** enthalten, etwa `*psych` (passt auch auf Neuropsychologie), Kognition, Bildungsforschung, Neurowissenschaft, Verhalten, Emotion, Suchtforschung, Psychotherapie. Die Liste ist bewusst weit und in der App änderbar. Alles, was dabei aussortiert wird, steht unter *Quellen → Aussortiert*. Wird ein Begriff ergänzt, prüft der nächste Lauf die aussortierten Anzeigen erneut.

## Einsammeln: die Kaskade

Für jede Quelle probiert die Pipeline nacheinander, bis Anzeigen gefunden sind:

1. **Feed** (RSS, Atom, JSON Feed), wenn die Seite einen anbietet
2. **Bewerbungsportal-Schnittstellen** (Personio, Workday, Softgarden, weitere über Linkmuster: Umantis, SuccessFactors, Bite, HelixJobs, Teamtailor, Stellenticket, Prescreen)
3. **Listenseite** mit strukturierten Daten (JSON-LD `JobPosting`) und bewerteten Links, inklusive Seitenblättern
4. **Browser**, wenn die Liste erst per JavaScript erscheint
5. **Sitemap** der Website
6. **KI** wählt aus den Links der Seite die Anzeigen aus (wenn ein Schlüssel hinterlegt ist)

Jede einzelne Anzeige wird dann gelesen: strukturierte Daten zuerst, sonst der Hauptinhalt der Seite als Text, PDFs werden ausgelesen, ein verlinktes PDF wird angehängt. Eine Anzeige gilt als vollständig, wenn typische Abschnitte (Aufgaben, Profil, Angebot, Bewerbung) und genug Text da sind. Wenn nicht, übernimmt der **Browser-Agent**: Er öffnet die Seite in Chromium, schließt Cookie-Banner, klappt „mehr anzeigen“ auf, sucht im richtigen Frame und klickt sich notfalls mit KI-Hilfe bis zum Anzeigentext durch (höchstens sechs Schritte, keine Formulare, keine Logins).

**Portale als Sicherheitsnetz:** Die Jobsuche der Bundesagentur für Arbeit, PsychJob, die Stellenmärkte von Max-Planck, Leibniz und Fraunhofer, Academic Positions, APS und Berlin University Alliance laufen zusätzlich. Taucht dort eine Anzeige einer Einrichtung auf, deren eigene Quelle sie nicht gefunden hat, wird die Quelle mit einer Warnung markiert: ein Zeichen, dass dort etwas klemmt.

**Höflichkeit:** robots.txt wird beachtet (pro Quelle bewusst abschaltbar), pro Website mindestens 1,5 Sekunden Abstand, ein ehrlicher User-Agent mit Kontaktangabe.

## Aus der Anzeige gelesen

Regelbasiert, bei Bedarf von der KI ergänzt: Frist (mit Kontextregeln, damit ein Einstellungsdatum nicht als Frist gilt), Entgeltgruppe (E/EG/TV-L/TVöD, W- und A-Besoldung), Umfang in Prozent oder Stunden, Befristung, Beginn, Kennziffer, Kontakt, Sprache und die Stellenart (Promotion, Postdoc, Wiss. Mitarbeit, Professur, Projekt, Lehre, Klinik, Hilfskraft, Verwaltung). Fehlt eine Angabe, bleibt die Anzeige trotzdem sichtbar.

**Dubletten:** gleiche Adresse (bereinigt), sonst gleiche Einrichtung mit gleichem Titel und gleicher Frist oder Kennziffer, sonst sehr ähnlicher Titel bei derselben Einrichtung. Eine zusammengeführte Anzeige zeigt alle Fundorte („Gefunden über“).

**Ablauf:** Eine Anzeige gilt als abgelaufen, wenn die Frist vorbei ist oder sie seit drei Tagen nicht mehr gelistet war (nur wenn ihre Quellen in der Zeit fehlerfrei liefen). Abgelaufene verschwinden aus „Alle“ und aus dem Stapel und werden nach 14 Tagen gelöscht. Gemerkte, Herzensjobs und beworbene bleiben dauerhaft.

## Der Score („Herzchen-Score“)

Das Suchprofil hat vier Kategorien mit Gewicht: **Thema**, **Stellenart**, **Methoden & Können**, **Rahmen**. Jeder Eintrag hat ein bis drei Herzchen und passt über Begriffe (einer reicht) oder eine Bedingung (Stellenart, Entgelt ab, Umfang ab, unbefristet, Sprache).

- Eine Kategorie ist voll, sobald Einträge mit zusammen drei Herzchen in der Anzeige vorkommen.
- Steht eine Angabe nicht in der Anzeige (etwa kein Entgelt), zählt der Eintrag halb.
- Leere Kategorien zählen nicht, die Gewichte der übrigen werden auf 100 % umgerechnet.
- „Lieber nicht“-Einträge ziehen 5 Punkte je Herz ab.
- Begriffe passen auf Wortanfänge (`kognit` → kognitiv, Kognition), mit Stern überall im Wort (`*psych` → Neuropsychologie), in Anführungszeichen nur als ganzes Wort (`"R"`). Umlaute und Groß-/Kleinschreibung sind egal.

In jeder Anzeige zeigt „warum?“, welche Einträge gegriffen haben. Im Profil-Editor zeigt „Ausprobieren“ sofort, auf wie viele Anzeigen ein Eintrag passt.

**Reihenfolge:** Lieblingsorte zuerst (Bundesland, Stadt oder Einrichtung), dann Score, dann Frist.

## Steckbrief

Das Interview führt ein starkes Modell extern, das Ergebnis ist ein Steckbrief im JSON-Format. Format und Interview-Prompt sind ein eigener Arbeitsschritt. Bis dahin liest die App einen **Entwurf (Version 0)**, beschrieben in [STECKBRIEF-ENTWURF.md](STECKBRIEF-ENTWURF.md); in der App unter *Ich → Steckbrief importieren → Beispiel einfügen*. Der Import setzt das Suchprofil und schlägt Lieblingsorte vor, die man vor dem Übernehmen abhaken kann. Filter setzt er nie.

## Erinnerungen

Herzensjobs (Stern) bekommen Erinnerungen vor der Frist, standardmäßig 1 Monat, 1 Woche und 1 Tag vorher (änderbar). Pro Anzeige kommt immer nur die nächstliegende fällige Stufe; wer einen Job erst eine Woche vor Fristende markiert, bekommt also keine verspätete „1 Monat“-Erinnerung. Benachrichtigungen verschickt der Einsammel-Lauf zweimal täglich; in der App stehen fällige Fristen zusätzlich als Zettel oben unter „Gemerkt“.

## Technik in Kürze

- **Offline zuerst:** Die App speichert alle Anzeigen im Browser (IndexedDB). Merken, Wegwerfen und Einstellungen landen sofort lokal und gehen über eine Warteschlange an den Server, sobald er erreichbar ist. Bei Konflikten gewinnt die neuere Änderung.
- **Abgleich:** seitenweise nach Änderungszeitpunkt, gelöschte Anzeigen über „Grabsteine“.
- **Score im Browser:** spart Rechenzeit im Worker (10 ms im kostenlosen Plan) und macht Profiländerungen sofort sichtbar.
- **Zugriff:** ein App-Schlüssel für die Oberfläche, ein zweiter nur für die Pipeline.
- **Gestaltung:** liniertes Notizbuchpapier mit rosa Randlinie, Pastelltöne, Handschrift (Shantell Sans) für die Oberfläche, Literata für Anzeigentexte („Zeitungsausschnitt“), handgezeichnete Symbole und eine nachgezeichnete Karte (Natural Earth). Dunkles Notizbuch für die Nacht.
