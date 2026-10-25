# Konzept und Entscheidungen

## Leitlinien

1. **Nichts verpassen.** Lieber eine unnötige Anzeige mehr als eine passende zu wenig. Deshalb sammelt die Pipeline breit ein und filtert nur dort grob, wo Quellen sehr viel Fachfremdes liefern.
2. **Das Suchprofil sortiert, es filtert nie.** Kein Steckbrief-Eintrag kann eine Anzeige ausblenden. Ausblenden tun nur Filter, die du selbst setzt, und die gelten nur für Stapel, Liste und Karte. Gelöscht wird dadurch nichts.
3. **Verständlich und direkt einstellbar.** Der Score besteht aus Herzchen, die man sieht und ändern kann. Kein Lernen aus dem Wischen.
4. **Vollständige Anzeigen.** Jede Anzeige soll ganz in der App stehen. Wo das nicht gelingt, steht ein Hinweis und die Anzeige kommt in die Warteschlange des Browser-Agenten.
5. **Keine blinden Flecken.** Jeder Lauf sucht gezielt nach Anzeigen von Websites, die noch nicht im Register stehen, und bringt mindestens drei davon mit.
6. **Fristen stimmen oder sind als unsicher markiert.** Offen ist eine Anzeige nur, solange ihre Frist nicht vorbei ist. Zweifelhafte Daten werden nachgeprüft statt still übernommen.

## Welche Anzeigen hereinkommen

Quellen sind Einrichtungen mit Psychologie-Forschung oder Psychologie-Studiengang, dazu benachbarte Forschung: Psychosomatik und Psychiatrie an Unikliniken und Fachkliniken, Bildungsforschung, Arbeitswissenschaft, Institute von Max-Planck, Leibniz, Helmholtz, Fraunhofer, DFKI, Ressortforschung von Bund und Ländern, Stiftungen und Verbände. Dazu kommen **Unternehmen**, die hin und wieder Psycholog:innen suchen: Testverlage und Eignungsdiagnostik, Markt- und Sozialforschung, UX und Human Factors (auch in Konzernen), Digital Health, Klinikträger, Beratung, Verkehrspsychologie, Bildungsverlage. Die Startliste steht in `data/seed/` (recherchiert am 23. Oktober 2026, mit Prüfstatus je Adresse) und wird nach dem Interview noch einmal geschärft.

Zwei Arten von Quellen:

- **Fachbereichs-Seiten** (Institut für Psychologie, Lehrstühle): Jede Anzeige wird übernommen.
- **Breite Quellen** (zentrale Stellenbörsen, Portale): Eine Anzeige muss mindestens einen Begriff aus dem **Grobfilter** enthalten, etwa `*psych` (passt auch auf Neuropsychologie), Kognition, Bildungsforschung, Neurowissenschaft, Verhalten, Emotion, Suchtforschung, Psychotherapie. Die Liste ist bewusst weit und in der App änderbar. Alles, was dabei aussortiert wird, steht unter *Quellen → Aussortiert*. Wird ein Begriff ergänzt, prüft der nächste Lauf die aussortierten Anzeigen erneut.

## Horizont: über den Kern hinaus

Neben dem **Kern** (Stellen, die deine Kernthemen aus dem Suchprofil treffen) gibt es zwei weitere Ringe:

- **Horizont:** Stellen aus anderen Feldern, die über eine **Brücke** passen. Eine Brücke besteht aus Feld-Begriffen (z. B. `cybersecurity`, `phishing`) und Anknüpfungs-Begriffen (Menschen, Verhalten, Empirie; ohne eigene Angabe gilt eine Standardliste). Eine Anzeige passt, wenn sie aus beiden Gruppen mindestens einen Begriff enthält. Floskeln, die in fast jeder Anzeige stehen („Weiterbildung“, „Datenschutz“, „hohe Motivation“), sind bewusst keine Begriffe.
- **Weite:** Stellen ohne Brücke, in denen eine deiner Fähigkeiten und ein Bezug zu Menschen oder Empirie vorkommt. Hier urteilt die KI, ob deine Fähigkeiten dort tragen.

Beim Einsammeln aus breiten Quellen gilt: Was den Grobfilter nicht passiert, kommt über eine Brücke oder die Weite trotzdem herein. Für jede solche Anzeige gibt die KI ein Urteil ab („passt“, „eher“, „nein“) und einen Satz, warum die Stelle passen könnte. „Nein“ heißt: völlig fremd (andere Ausbildung nötig, nichts vom Wissen gebraucht); solche Anzeigen stehen unter *Quellen → Aussortiert* mit der Begründung der KI. Brücken dürfen weit reichen, auch über die Forschung hinaus; eingegrenzt wird über das Interview.

In der App entscheidet das aktuelle Profil, welcher Ring gilt: Trifft eine Anzeige ein Kernthema, ist sie Kern, auch wenn sie über eine Brücke kam. Trifft sie kein Kernthema, aber eine aktive Brücke, ist sie Horizont, auch wenn der breite Grobfilter sie schon durchgelassen hatte (etwa „UX Researcher“ ohne Psychologie im Text). Im Stapel kommt **etwa jede 3. bis 5. Karte aus dem Horizont**, zufällig verteilt, aber beim Wischen stabil (einstellbar: aus, selten, normal, oft). Die Karte trägt ein lavendelfarbenes Etikett mit der Brücke und zeigt statt der Kurzfassung den Satz „Warum das passen könnte“. In jeder Horizont-Anzeige lässt sich die Brücke bearbeiten oder pausieren. Gelernt wird nichts aus dem Wischen.

Brücken kommen aus dem Steckbrief, aus KI-Vorschlägen (*Ich → Horizont → Brücken vorschlagen lassen*, übernommen wird nur, was du annimmst) oder von dir. Bis das Interview sie festlegt, gilt ein breiter Start-Horizont mit zehn Brücken (Mensch & KI, IT-Sicherheit, Arbeit & Organisation, Gesundheit & Prävention, Bildung & Lernen, Mobilität & Verkehr, Umwelt & Nachhaltigkeit, Daten & Methoden, Gesellschaft & Politik, Gestaltung & UX).

## Blinde Flecken: Erkundung neuer Websites

Das Register ist die Liste aller Websites, die die App kennt: Quellen, Websites der Einrichtungen und bereits bearbeitete Funde. Jeder Lauf (täglich gegen 12 Uhr oder per Knopf) endet mit der **Erkundung**: Mit täglich wechselnden Suchwörtern aus dem Kernbereich und aus den Brücken fragt sie bei der Jobsuche der Arbeitsagentur (optional zusätzlich in einer Websuche) und liest nur Anzeigen, deren Website und Arbeitgeber nicht im Register stehen. Sie liest so lange, bis mindestens **drei neue Anzeigen** dabei sind (höchstens 40 Versuche); schafft sie das nicht, steht eine Warnung im Lauf.

Solche Anzeigen tragen in der App die Markierung „neue Website“, die Websites selbst stehen unter *Quellen → Neu*. Von dort startet ein Klick den Probelauf, und die Website kommt ins Register. Bei Jobbörsen zählt der Arbeitgeber statt der Börse, bei Bewerbermanagement-Systemen die eigene Unterdomain des Arbeitgebers.

## Neue Quellen mit Probelauf

Eine Website kommt erst nach einem **Probelauf** ins Register (*Ich → Quellen → Website hinzufügen*, oder „Als Quelle prüfen“ bei einem Fund): Die Pipeline sammelt die Seite einmal komplett ein, ohne zu speichern, liest bis zu fünf Anzeigen vollständig (notfalls mit dem Browser-Agenten) und prüft Frist, Entgelt und Umfang. Ist die Adresse nur die Startseite, sucht sie die Stellenseite selbst. Die KI beurteilt dann, ob es eine Stellenliste ist, wer ausschreibt, ob es ein Fachbereich ist, ob die Proben echte, vollständige Anzeigen sind und ob ein Linkmuster oder der Browser nötig ist. Ein Linkmuster der KI wird nur übernommen, wenn es alle bestätigten Anzeigen trifft und den Rest ausschließt.

Das Ergebnis zeigt die App mit Urteil („gut geeignet“, „mit Einschränkungen“, „ungeeignet“), Proben und vorausgefüllter Einrichtung. Übernommen wird mit den geprüften Einstellungen; die Quelle gilt dann als geprüft. Für bestehende Quellen gibt es „Probelauf wiederholen“.

## Einsammeln: die Kaskade

Für jede Quelle probiert die Pipeline nacheinander, bis Anzeigen gefunden sind:

1. **Feed** (RSS, Atom, JSON Feed), wenn die Seite einen anbietet
2. **Bewerbungsportal-Schnittstellen**: Personio, Workday, Softgarden, BITE (die Liste vieler Hochschulen, gelesen über die Schnittstelle hinter dem eingebundenen Skript, ohne Browser), Hidden Professionals (Karriereseiten u. a. von TU Darmstadt, Goethe-Uni und JGU), für Unternehmen Greenhouse, Lever, SmartRecruiters, Recruitee und Ashby; weitere über Linkmuster (Umantis, SuccessFactors, HelixJobs, Teamtailor, Stellenticket, Prescreen)
3. **Listenseite** mit strukturierten Daten (JSON-LD `JobPosting`) und bewerteten Links, inklusive Seitenblättern; ist die Adresse eine JSON-Schnittstelle (etwa beim LMU Klinikum), liest die Pipeline Titel und Adressen direkt daraus
4. **Browser**, wenn die Liste erst per JavaScript erscheint
5. **Sitemap** der Website
6. **KI** wählt aus den Links der Seite die Anzeigen aus (wenn ein Schlüssel hinterlegt ist)

Jede einzelne Anzeige wird dann gelesen: strukturierte Daten zuerst, sonst der Hauptinhalt der Seite als Text, PDFs werden ausgelesen, ein verlinktes PDF wird angehängt. Eine Anzeige gilt als vollständig, wenn typische Abschnitte (Aufgaben, Profil, Angebot, Bewerbung) und genug Text da sind. Wenn nicht, übernimmt der **Browser-Agent**: Er öffnet die Seite in Chromium, schließt Cookie-Banner, klappt „mehr anzeigen“ auf, sucht im richtigen Frame und klickt sich notfalls mit KI-Hilfe bis zum Anzeigentext durch (höchstens sechs Schritte, keine Formulare, keine Logins).

**Portale als Sicherheitsnetz:** Die Jobsuche der Bundesagentur für Arbeit, PsychJob, die Stellenmärkte von Max-Planck, Leibniz und Fraunhofer, Academic Positions, APS und Berlin University Alliance laufen zusätzlich. Taucht dort eine Anzeige einer Einrichtung auf, deren eigene Quelle sie nicht gefunden hat, wird die Quelle mit einer Warnung markiert: ein Zeichen, dass dort etwas klemmt.

**Höflichkeit:** Die App liest nur öffentliche Stellenanzeigen für eine Person. Sperren aus der robots.txt gelten deshalb nicht (Entscheidung vom 23. Oktober 2026; mit `ROBOTS=1` wieder einschaltbar). Was die Websites schont, bleibt: pro Website mindestens 1,5 Sekunden Abstand, ein in der robots.txt verlangter Crawl-delay (bis 15 Sekunden), höchstens 80 neue Anzeigen pro Quelle und Lauf, bekannte Anzeigen erst nach sechs Tagen erneut, ein ehrlicher User-Agent mit Kontaktangabe.

## Aus der Anzeige gelesen

Regelbasiert, bei Bedarf von der KI ergänzt: Frist (mit Kontextregeln, damit ein Einstellungsdatum nicht als Frist gilt), Entgeltgruppe (E/EG/TV-L/TVöD, W- und A-Besoldung), Umfang in Prozent oder Stunden, Befristung, Beginn, Kennziffer, Kontakt, Sprache und die Stellenart (Promotion, Postdoc, Wiss. Mitarbeit, Professur, Projekt, Lehre, Klinik, Hilfskraft, Verwaltung). Fehlt eine Angabe, bleibt die Anzeige trotzdem sichtbar.

**Dubletten:** gleiche Adresse (bereinigt), sonst gleiche Einrichtung mit gleichem Titel und gleicher Frist oder Kennziffer, sonst sehr ähnlicher Titel bei derselben Einrichtung. Eine zusammengeführte Anzeige zeigt alle Fundorte („Gefunden über“).

**Ablauf:** Eine Anzeige gilt als abgelaufen, wenn die Frist vorbei ist oder sie seit drei Tagen nicht mehr gelistet war (nur wenn ihre Quellen in der Zeit fehlerfrei liefen). Über die Erkundung gefundene Anzeigen werden nicht täglich wieder gelistet; sie laufen über ihre Frist ab, ohne Frist nach 45 Tagen. Abgelaufene verschwinden aus „Alle“ und aus dem Stapel und werden nach 14 Tagen gelöscht. Gemerkte, Herzensjobs und beworbene bleiben dauerhaft.

## Fristen absichern

Eine Anzeige gilt nur als offen, solange ihre Frist heute oder später ist; Stapel, „Alle“ und Karte zeigen nichts Abgelaufenes. Damit die Frist selbst stimmt, wird jede gefundene Frist geprüft:

- **Ohne Jahr** („bis zum 30.11.“): Das Jahr wird vom Veröffentlichungsdatum (sonst vom Tag des Fundes) aus ergänzt. Liegt das Datum höchstens 45 Tage zurück, gilt dieses Jahr (die Anzeige ist dann abgelaufen), sonst das nächste, wenn es höchstens 150 Tage voraus ist. Alles andere ist mehrdeutig und wird als „Frist unklar“ gezeigt, nicht geraten.
- **Verlängert:** „Die Frist wurde verlängert bis …“ schlägt die ursprüngliche Frist.
- **Unplausibel:** vor dem Veröffentlichungsdatum (dann wird das Datum verworfen), mehr als acht Monate in der Zukunft, oder beim ersten Fund schon vorbei (ein vermuteter Tippfehler im Jahr wird als unsicher markiert).
- **KI-Nachprüfung:** In diesen Fällen, und wenn ein Fristhinweis ohne lesbares Datum dasteht, sucht die KI die Frist im Text. Ihre Antwort zählt nur mit einem wörtlichen Zitat, das Tag und Monat der genannten Frist enthält; so kann sie keine Frist erfinden.

In der App steht bei jeder Frist, wie sicher sie ist: ohne Vermerk (aus dem Text), „Jahr ergänzt“, „von der KI nachgeprüft“ mit Zitat, oder gelb hinterlegt „Frist unsicher, bitte im Original prüfen“.

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

Das Interview führt ein starkes Modell extern, das Ergebnis ist ein Steckbrief im JSON-Format. Format und Interview-Prompt sind ein eigener Arbeitsschritt. Bis dahin liest die App einen **Entwurf (Version 0)**, beschrieben in [STECKBRIEF-ENTWURF.md](STECKBRIEF-ENTWURF.md); in der App unter *Ich → Steckbrief importieren → Beispiel einfügen*. Der Import setzt das Suchprofil samt Horizont (Brücken, Interessen, Fähigkeiten) und schlägt Lieblingsorte vor, die man vor dem Übernehmen abhaken kann. Filter setzt er nie. Am Ende des Interviews sollte gefragt werden, welche Themen außerhalb der Psychologie die Person spannend findet und wo sie ihr Wissen und Können noch einsetzen könnte; daraus werden die Brücken.

## Erinnerungen

Herzensjobs (Stern) bekommen Erinnerungen vor der Frist, standardmäßig 1 Monat, 1 Woche und 1 Tag vorher (änderbar). Pro Anzeige kommt immer nur die nächstliegende fällige Stufe; wer einen Job erst eine Woche vor Fristende markiert, bekommt also keine verspätete „1 Monat“-Erinnerung. Benachrichtigungen verschickt der tägliche Einsammel-Lauf gegen 12 Uhr; in der App stehen fällige Fristen zusätzlich als Zettel oben unter „Gemerkt“.

Bringt ein Lauf neue Anzeigen, die zum Suchprofil sehr gut passen (Standard: ab 85 %, änderbar unter *Ich → Erinnerungen*), kommt eine einzige gebündelte Benachrichtigung mit den drei besten. Der Score dafür wird in der Pipeline mit demselben Suchprofil berechnet wie in der App.

## Dummy-Daten und Platzhalter

Solange der Server nicht eingerichtet ist, zeigt die App erfundene Anzeigen (`data/dummy/anzeigen.json`) bei echten Einrichtungen, mit dem Etikett „Dummy“. Fristen und Fundtage stehen dort relativ zum Tag und rücken mit, damit die App nie leer ist. Alles, was noch Dummy, Beispiel oder Standardwert ist, steht in der **Platzhalter-Checkliste** (`apps/web/src/lib/checklist.ts`), erreichbar über den Knopf oben und unter *Ich*. Was die App erkennen kann (echte Server-Verbindung, https, eigenes Profil, eigenes Zuhause), hakt sie selbst ab.

## Technik in Kürze

- **Offline zuerst:** Die App speichert alle Anzeigen im Browser (IndexedDB). Merken, Wegwerfen und Einstellungen landen sofort lokal und gehen über eine Warteschlange an den Server, sobald er erreichbar ist. Bei Konflikten gewinnt die neuere Änderung.
- **Abgleich:** seitenweise nach Änderungszeitpunkt, gelöschte Anzeigen über „Grabsteine“.
- **Score im Browser:** spart Rechenzeit im Worker (10 ms im kostenlosen Plan) und macht Profiländerungen sofort sichtbar.
- **Zugriff:** ein App-Schlüssel für die Oberfläche, ein zweiter nur für die Pipeline.
- **Gestaltung:** gezeichnetes Notizbuch mit festen Farbrollen: Weiß und Beige als Fläche, Rosa als Primärfarbe, Lavendel sparsam für Orientierung (Hinweise der App, Horizont, Zuhause und Umkreis), Hellgelb nur für Fristen und Herzensjobs. Handschrift (Shantell Sans) für die Oberfläche, Literata für Anzeigentexte. Regeln, Tokens und Kontraste in [GESTALTUNG.md](GESTALTUNG.md).
