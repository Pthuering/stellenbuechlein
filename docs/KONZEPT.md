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

- **Titel-Ausschluss** (alle Quellen, seit 24.11.2026): Pflege, Arzt, Therapieberufe, Erziehung und Soziale Arbeit, Verwaltung und Büro, Technik und Handwerk, Ausbildung und Freiwilligendienst fallen schon am Titel heraus, die Anzeige wird gar nicht erst abgerufen. Ausgenommen sind Titel mit einer Psychologen- oder Forschungsrolle („Psycholog*in“, „Psychotherapeut*in“, „wiss. Mitarbeiter*in“, „Postdoc“, „Professur“): Psychologenstellen in Kliniken bleiben als äußerer Rand der Suche drin. Listen in `packages/core/src/gate.ts`.
- **Fachbereichs-Seiten** (Institut für Psychologie, Lehrstühle): Sonst wird jede Anzeige übernommen.
- **Breite Quellen** (zentrale Stellenbörsen, Portale): Eine Anzeige muss mindestens einen **Fachbegriff** aus dem Grobfilter im Text enthalten, etwa `*psycholog`, kognitiv, Neurowissenschaft, Human Factors, Bildungsforschung, Suchtforschung (in der App änderbar). Allerweltswörter wie „Persönlichkeit“, „Wohlbefinden“, „psychisch“ oder „Psychiatrie“ zählen nur im Titel, weil sie in fast jeder Klinikanzeige als Floskel stehen. Bis November 2026 reichte jedes dieser Wörter irgendwo im Text; damals kamen 70 % fachfremde Anzeigen in den Bestand (Pflege, Ärzte, Therapieberufe), die Hälfte unter 20 % Passung. Alles, was aussortiert wird, steht unter *Quellen → Aussortiert*. Wird ein Begriff ergänzt, prüft der nächste Lauf die aussortierten Anzeigen erneut.

## Brücken und Horizont: über den Kern hinaus

Neben den normalen Einträgen (intern „Kern“: Stellen, die deine Kernthemen aus dem Suchprofil treffen; sie zeigen die Passung in Prozent und werden nicht eigens gekennzeichnet, „Kern“ steht nirgends in der App) gibt es zwei weitere Ringe. Seit 24.11.2026 heißen sie in der App **Brücke** (intern `horizont`) und **Horizont** (intern `weite`, früher „Weite“):

- **Brücke:** Stellen aus anderen Feldern, die über eine **Brücke** passen. Eine Brücke besteht aus Feld-Begriffen (z. B. `cybersecurity`, `phishing`) und Anknüpfungs-Begriffen (Menschen, Verhalten, Empirie; ohne eigene Angabe gilt eine Standardliste). Eine Anzeige passt, wenn sie aus beiden Gruppen mindestens einen Begriff enthält. Floskeln, die in fast jeder Anzeige stehen („Weiterbildung“, „Datenschutz“, „hohe Motivation“), sind bewusst keine Begriffe.
- **Horizont:** Stellen ohne Brücke, in denen eine deiner Fähigkeiten und ein Bezug zu Menschen oder Empirie vorkommt. Hier urteilt die KI, ob dein Können dort trägt.

Brücken- und Horizont-Karten haben **keine Passung in Prozent**, sondern ein lavendelfarbenes Symbol (Bogenbrücke bzw. halbe Sonne über dem Horizont) und einen lavendelfarbenen Rand. Im Stapel laufen sie an den Filtern vorbei; zurückhalten lassen sie sich nur ausdrücklich (Filter „Brücken und Horizont“, Rhythmus „aus“, Brücke pausiert, Horizont ohne Brücke aus). Gespeicherte Filter mit Push und die Meldung über sehr gut passende Anzeigen gelten nur für normale Einträge. In Listen, die nach Passung sortieren, stehen sie hinter den normalen Einträgen.

Beim Einsammeln aus breiten Quellen gilt: Was den Grobfilter nicht passiert, kommt über eine Brücke oder den Horizont trotzdem herein. Für jede solche Anzeige gibt die KI ein Urteil ab („passt“, „eher“, „nein“) und einen Satz, was die Person dort einbringen würde und was fehlt. Die Spanne ist bewusst weit (User-Vorgabe 24.11.2026): von „das Können passt, nur das Umfeld ist neu“ („passt“) bis „passt kaum, ist aber spannend, eine Bewerbung könnte sich lohnen“ („eher“). Geurteilt wird nach den Aufgaben, nicht nach formalen Anforderungen: ein anderer Abschluss oder Jahre an Erfahrung sind eine Lücke, kein Nein (Beispiel: Airbus-Stelle für Human-Factors-Versuche, die fünf Jahre Luftfahrt-Erfahrung verlangt). „Nein“ heißt: In den Aufgaben kommt nichts davon vor, die Verbindung ist nur ein Nebenpunkt, die Stelle verlangt eine Zulassung mit eigenem Studium (Ärztin) oder es ist keine einzelne Anzeige; solche Anzeigen stehen unter *Quellen → Aussortiert* mit der Begründung der KI. Die Anweisung (`HORIZON_PROMPT` in apps/ingest/src/llm.ts) ist an 60 echten Fällen kalibriert; bei Änderungen wieder an echten Fällen gegenrechnen, die KI befolgt Listen sehr wörtlich. Brücken dürfen weit reichen, auch über die Forschung hinaus; eingegrenzt wird über das Interview.

In der App entscheidet das aktuelle Profil, welcher Ring gilt: Trifft eine Anzeige ein Kernthema, ist sie Kern, auch wenn sie über eine Brücke kam. Trifft sie kein Kernthema, aber eine aktive Brücke, ist sie eine Brücken-Karte, auch wenn der breite Grobfilter sie schon durchgelassen hatte (etwa „UX Researcher“ ohne Psychologie im Text). Im Stapel ist **etwa jede 3. bis 6. Karte eine Brücken- oder Horizont-Karte**, zufällig verteilt, aber beim Wischen stabil (einstellbar: aus, selten, normal, oft). Eingestreut wird eine solche Karte erst, wenn die KI sie geprüft hat („passt“ oder „eher“); bis dahin bleibt sie aus dem Stapel; nach Änderungen an Profil oder Brücken reiht `npm run ki -- ki-nachholen --bruecken` die noch nicht geprüften ein. Eine Anzeige ohne Psychologie-Bezug gilt nicht als Kern, auch wenn ein Themenwort vorkommt. Die Karte trägt ein lavendelfarbenes Etikett mit der Brücke und zeigt statt der Kurzfassung den Satz „Warum das passen könnte“. In jeder Brücken-Karte lässt sich die Brücke bearbeiten oder pausieren. Gelernt wird nichts aus dem Wischen.

Brücken kommen aus dem Steckbrief, aus KI-Vorschlägen (*Ich → Brücken & Horizont → Brücken vorschlagen lassen*, übernommen wird nur, was du annimmst) oder von dir. Bis das Interview sie festlegt, gilt ein breiter Start-Horizont mit zehn Brücken (Mensch & KI, IT-Sicherheit, Arbeit & Organisation, Gesundheit & Prävention, Bildung & Lernen, Mobilität & Verkehr, Umwelt & Nachhaltigkeit, Daten & Methoden, Gesellschaft & Politik, Gestaltung & UX).

## Ausland

Stellen außerhalb Deutschlands kommen wie die Brücken- und Horizont-Karten zusätzlich in den Stapel. Ob überhaupt, bestimmt die Einstellung „ausland“; ohne sie gilt die Antwort aus der Umfrage („Auch ins Ausland“).

- **Land:** Jede Auslandsanzeige trägt ihr Land als Kürzel (`jobs.country`, z. B. „CH“). Erkannt wird es aus der Länderangabe des Portals, sonst aus der Ortsangabe oder den Ortsteilen des Titels („– Region Zürich“, „(Lisboa, PT)“). Ohne Kürzel gilt eine Anzeige als deutsch oder unbekannt; bei Quellen ohne Länderfilter zählt Unbekanntes als Ausland.
- **Vor der KI geregelt und gedeckelt:** Aufgenommen wird nur, was nach den Regeln zum Kern passt (Grobfilter, Themen-Treffer mit Psychologie-Bezug), fachlich einschlägig ist und mindestens 65 % Passung erreicht. Fachlich einschlägig heißt: Der Titel nennt die Psychologie oder eines der Profil-Themen, oder die Anzeige verlangt einen Abschluss in Psychologie; außerdem trifft mindestens ein Thema mit zwei oder drei Herzen (passende Wörter irgendwo im Text reichen nicht, sonst rutscht etwa Primatenforschung mit „working memory“ durch), und je Lauf höchstens 40 Anzeigen, davon höchstens 10 außerhalb Europas. Was nicht passt, steht unter *Quellen → Aussortiert* (Grund „ausland“) und wird nicht wieder gelesen; was dem Deckel zum Opfer fällt, kommt in einem späteren Lauf wieder dran. Brücken und Horizont gibt es für Auslandsanzeigen nicht. Erst danach bereitet die KI auf, der Aufwand bleibt also steuerbar.
- **Im Stapel:** nach jeweils 2 bis 5 anderen Karten eine Auslandskarte, also höchstens jede dritte (höchstens 33 %). Geordnet nach Passung, Europa mit zehn Punkten Vorsprung. Angezeigt wird eine Auslandsstelle überhaupt nur ab 65 % Passung und wenn sie fachlich einschlägig ist, im Stapel wie in den Listen (Gemerktes bleibt sichtbar). Am Ort steht das Land.
- **Quellen:** EURAXESS ohne Länderfilter (ganz Europa) und das Stellenportal der APS (weltweit); die Suche der Arbeitsagentur bleibt auf Deutschland beschränkt.

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
- **Stellenart:** Eine Anzeige hat genau eine Art. Ist sie nicht erkennbar, zählt nur der wichtigste Stellenart-Eintrag halb (nicht jeder, sonst wäre „unbekannt“ mehr wert als jede erkannte Art). Ist die Art erkannt, entscheidet sie allein; die Begriffe eines Stellenart-Eintrags helfen nur bei unbekannter Art und werden dann nur im Titel gesucht („Professor“ steht in vielen Anzeigen irgendwo im Text).
- **Thema zählt höchstens halb**, wenn in der ganzen Anzeige Psychologie nicht vorkommt (ein Themenwort wie „Gedächtnis“ oder „künstliche Intelligenz“ allein macht aus einer fachfremden Stelle keine passende; dafür ist der Horizont da) oder wenn der Titel einen anderen Beruf nennt und nicht die Psychologie (Ergotherapeut, Pflegefachkraft, Ärztin, Softwareentwickler …). Unter „warum?“ steht dann der Grund.
- Leere Kategorien zählen nicht, die Gewichte der übrigen werden auf 100 % umgerechnet.
- „Lieber nicht“-Einträge ziehen 5 Punkte je Herz ab.
- Begriffe passen auf Wortanfänge (`kognit` → kognitiv, Kognition), mit Stern überall im Wort (`*psych` → Neuropsychologie), in Anführungszeichen nur als ganzes Wort (`"R"`). Umlaute und Groß-/Kleinschreibung sind egal.
- Vor dem Abgleich fallen Genderendungen („Medizinische/r“, „Mitarbeiter*in“), „i. d. R.“ und die Anhängsel von Links und E-Mail-Adressen weg, damit kurze Begriffe wie `"R"` nicht darauf passen.

In jeder Anzeige zeigt „warum?“, welche Einträge gegriffen haben. Im Profil-Editor zeigt „Ausprobieren“ sofort, auf wie viele Anzeigen ein Eintrag passt.

**Reihenfolge:** Lieblingsorte zuerst (Bundesland, Stadt oder Einrichtung), dann Score, dann Frist. Im Stapel wird leicht gemischt: Jede Karte rutscht um bis zu fünf Punkte nach oben oder unten (pro Tag fest), damit ähnlich gut passende Anzeigen durcheinander kommen.

**Wortgruppen statt Einzelwörter:** Themen, Brücken und Suchwörter arbeiten mit Wortgruppen („kognitive Psychologie“, „visuelle Suche“, „Psychologie Künstliche Intelligenz“), nicht mit einzelnen Allerweltswörtern („kognitiv“, „Aufmerksamkeit“, „Gedächtnis“ stehen auch in Anzeigen für Ergotherapie und Verhaltenstherapie). In einer Wortgruppe darf jedes Wort ab vier Buchstaben gebeugt sein („der Kognitiven Psychologie“).

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
