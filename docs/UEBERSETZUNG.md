# Sprachen der App

Die Oberfläche gibt es auf **Deutsch**, **Englisch** und **Serbisch** (lateinische Schrift, ekavisch). Umgeschaltet wird oben im rosa Rand auf jeder Seite (DE / EN / SR), unter *Ich → Aussehen → Sprache* oder beim Anmelden. Die Wahl gilt pro Gerät; ohne Wahl startet die App auf Serbisch. Entwickelt und dokumentiert wird die App weiter auf Deutsch; gespeichert werden Katalog-Einträge immer deutsch.

Übersetzt werden nur die **festen Texte** der App. Unverändert bleiben:

- alles aus den Anzeigen: Titel, Text, Arbeitgeber, Entgeltgruppe („E 13“, „TV-L“), Befristung und Umfang im Wortlaut, Fristnotizen, KI-Zusammenfassungen
- Namen von Einrichtungen, Städten und Quellen, Adressen
- eigene Einträge (eigene Profil-Einträge, Notizen, Freitext in der Umfrage)
- Meldungen von Server und Pipeline (Status der Quellen, Lauf-Protokoll)
- Texte, die an die KI gehen (Anweisungen bleiben Deutsch; der Assistent antwortet in der Sprache der Oberfläche)

Push-Benachrichtigungen schickt der Einsammel-Lauf in allen drei Sprachen mit; der Service Worker zeigt die Sprache, die auf dem Gerät eingestellt ist.

## Technik

- `apps/web/src/i18n/index.ts`: aktuelle Sprache, `texts()`, `tr()`, `srForm()`, Formate für Datum, Zahl, Prozent und km
- `apps/web/src/i18n/labels.ts`: Stellenarten, Einrichtungsarten, Bundesländer, Kategorien, Sortierung, Ringe, Dosis
- `apps/web/src/i18n/katalog.ts`: Vorschläge der Umfrage, Startprofil und Start-Brücken; `profileLabel()` übersetzt Einträge im Suchprofil, die aus diesen Listen stammen. Gespeichert wird immer die deutsche Bezeichnung.
- `packages/core/src/reminders.ts`: Texte der Benachrichtigungen (`reminderText`, `highScoreDigest` mit Sprache)

Jede Datei legt ihre Texte selbst an, alle drei Sprachen mit denselben Schlüsseln (TypeScript prüft das):

```ts
const t = texts({
  de: { title: 'Gemerkt', open: (n: number) => (n === 1 ? '1 offene Anzeige' : `${n} offene Anzeigen`) },
  en: { title: 'Saved', open: (n) => (n === 1 ? '1 open posting' : `${n} open postings`) },
  sr: { title: 'Sačuvano', open: (n) => `${n} ${srForm(n, 'otvoren oglas', 'otvorena oglasa', 'otvorenih oglasa')}` },
});
```

`t.title` liest immer die aktuelle Sprache. Beim Umschalten wird die App neu aufgebaut. Texte deshalb nie in Konstanten außerhalb von Funktionen ablegen (etwa `const OPTIONS = [{ label: t.foo }]` auf oberster Ebene); dort nur Schlüssel speichern und den Text beim Zeichnen holen.

Neuer Text: in allen drei Sprachen eintragen. Wer kein Serbisch kann, schreibt den deutschen Text vorläufig auch bei `sr` hin und vermerkt es in [OFFEN.md](OFFEN.md).

## Schreibweise

| | Deutsch | Englisch | Serbisch |
|---|---|---|---|
| Anrede | du | you, freundlich, Kurzformen erlaubt | ti (Imperativ 2. Person: *dodaj, prevuci, dodirni*) |
| Geschlecht | – | – | neutral: keine Partizipien auf die Person bezogen (*nicht* „sačuvala si“). Präsens, Imperativ, unpersönlich („sačuvano“, „prijava poslata“) |
| Anführungszeichen | „…“ | “…” | „…“ |
| Auslassung | „lädt …“ | “Loading…” | „Učitavam…“ |
| Prozent | 65 % | 65% | 65% |
| Datum | 15.11.2026 | 15 Nov 2026 | 15. 11. 2026. |
| Dezimal | 4,5 km | 4.5 km | 4,5 km |
| Zahlformen | 1 / viele | 1 / viele | 1 / 2–4 / viele, mit `srForm` (1 dan, 3 dana, 5 dana, 21 dan) |
| Großschreibung | wie üblich | Satzanfang groß, sonst klein (*Search profile*, nicht *Search Profile*) | wie üblich |

## Glossar

| Deutsch | Englisch | Serbisch |
|---|---|---|
| Anzeige, Stellenanzeige | posting, job posting | oglas |
| Stelle | job, position | posao, pozicija |
| Stapel (Reiter) | Stack | Špil |
| Karte im Stapel | card | kartica |
| Karte (Reiter, Landkarte) | Map | Mapa |
| Gemerkt (Reiter), merken | Saved, save | Sačuvano, sačuvaj |
| weglegen, weggelegt | pass, passed | preskoči, preskočeno |
| Alle (Reiter) | All | Sve |
| Ich (Reiter) | Me | Ja |
| Herzensjob (★) | dream job | posao iz snova |
| Traumstelle (Umfrage) | ideal job | idealan posao |
| Frist, Bewerbungsfrist | deadline, application deadline | rok, rok za prijavu |
| beworben, Bewerbung | applied, application | prijava poslata, prijava |
| Erinnerung | reminder | podsetnik |
| Benachrichtigung | notification | obaveštenje |
| Score, „passt zu 85 %“ | match, “85% match” | poklapanje, „poklapanje 85%“ |
| Herzchen, Herzen | hearts | srca (1 srce, 2 srca) |
| Suchprofil | search profile | profil pretrage |
| Steckbrief | profile sheet | lični karton |
| Umfrage | questionnaire | upitnik |
| Startprofil | starter profile | početni profil |
| Lieber nicht | Rather not | Radije ne |
| Thema, Stellenart, Methoden & Können, Rahmen | Topic, Position type, Methods & skills, Conditions | Tema, Vrsta pozicije, Metode i veštine, Uslovi |
| Kern, Horizont, Weite | Core, Horizon, Beyond | Jezgro, Horizont, Daljina |
| Brücke | bridge | most |
| Feld (einer Brücke) | field | oblast |
| Anknüpfung (an dich) | link (to you) | veza (sa tobom) |
| einstreuen (in den Stapel) | mix in | ubacivati |
| Lieblingsorte | favorite places | omiljena mesta |
| Zuhause, Umkreis | home, radius | dom, radijus |
| ganz Deutschland | all of Germany | cela Nemačka |
| Bundesland | federal state | savezna pokrajina |
| Einrichtung | institution | ustanova |
| Arbeitgeber | employer | poslodavac |
| Quelle | source | izvor |
| Lauf, Einsammeln | run, collecting | prolaz, prikupljanje |
| großer Durchlauf | full run | veliki prolaz |
| Probelauf | test run | probni prolaz |
| Grobfilter, aussortiert | pre-filter, filtered out | grubi filter, odbačeno |
| Erkundung (neuer Websites) | exploration | izviđanje |
| Register (der Quellen) | registry | registar |
| Linkmuster | link pattern | obrazac linkova |
| Pipeline | pipeline | sistem za prikupljanje |
| Protokoll | log | zapisnik |
| Fachbereich | department | odsek |
| Adresse (einer Seite) | URL | adresa |
| freigeben (Profil) | approve | odobri |
| Jobbörse, Portal | job board, portal | berza poslova, portal |
| Website | website | sajt |
| Platzhalter, Checkliste | placeholder, checklist | privremena vrednost, kontrolna lista |
| Dummy-Daten, Demo | demo data, demo | probni podaci, demo |
| App-Schlüssel | app key | ključ aplikacije |
| Abgleich mit dem Server | sync with the server | sinhronizacija sa serverom |
| KI, KI-Assistent | AI, AI assistant | AI, AI asistent |
| Verbrauch | usage | potrošnja |
| Entgelt, Entgeltgruppe | pay, pay grade | plata, platni razred |
| Umfang | hours | obim zaposlenja |
| befristet, unbefristet | fixed-term, permanent | na određeno, na neodređeno |
| Promotion (Stellenart) | PhD | doktorat |
| Wiss. Mitarbeit | research associate | istraživač saradnik |
| Hilfskraft | student assistant | studentski asistent |
| Rückgängig | Undo | Opozovi |
| Abbrechen | Cancel | Otkaži |
| Speichern | Save | Sačuvaj |
| Übernehmen | Apply | Primeni |
| Entfernen, Löschen | Remove, Delete | Ukloni, Obriši |
| Hinzufügen | Add | Dodaj |
| Bearbeiten | Edit | Izmeni |
| Zurück, Weiter, Fertig | Back, Next, Done | Nazad, Dalje, Gotovo |
| im Original prüfen | check the original | proveri u originalu |
