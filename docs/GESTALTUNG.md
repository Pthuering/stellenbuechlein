# Gestaltung: Farbsystem und Regeln

Das Stellenbüchlein sieht aus wie ein gezeichnetes Notizbuch. Damit es dabei ruhig bleibt, hat jede Farbe eine feste Aufgabe. Wer eine Farbe sieht, soll wissen, was sie bedeutet.

## Farbrollen

| Rolle | Farbe | Wofür | Beispiele | Anteil |
|---|---|---|---|---|
| **Fläche** | Weiß, warmes Papier, Beige | Hintergrund und Träger | Papier, Karteikarten, Reiter, neutrale Chips (auch „neue Website“), Länder ohne Anzeigen | etwa 60 % |
| **Primär** | Rosa in Abstufungen | Marke und alles, was du tust oder auswählst | Merken, Hauptknöpfe, gewählte Filter, Score, Lieblingsorte, Zähler auf der Karte, Klebeband | etwa 30 % |
| **Sekundär** | Lavendel | Orientierung: was die App dir erklärt oder wo du stehst | KI-Kurzfassung, Horizont-Etikett und „Warum das passen könnte“, KI-Urteil im Probelauf, Vorschau im Profil, „Ausprobieren“, Demo-Hinweis, Zuhause und Umkreis auf der Karte, Status „beworben“, Quellen-Status „neu“ | sparsam |
| **Akzent** | Hellgelb, Gold für Symbole | Fristen und Herzensjobs | Textmarker bei Fristen unter 14 Tagen, „Frist unsicher“, Herzensjob-Knopf und -Stern, Fristen-Zettel | sparsam |
| **Schrift** | Pflaumenbraune Tinte | Text und Linien | Überschriften, Fließtext, Konturen | |

Fehler- und Warnhinweise sind keine Gestaltungsfarben: Warnungen nutzen den hellen Akzentton, Fehler ein kräftiges Rosa mit dunkler Schrift.

## Regeln

1. **Eine Rolle pro Bauteil.** Ein Kasten ist entweder lavendel (Hinweis) oder gelb (Frist), nie beides.
2. **Hauptaktionen sind rosa.** Lavendel und Gelb tragen nie den wichtigsten Knopf eines Bildschirms.
3. **Helle Töne für Flächen, kräftige nur für Schrift und Symbole.** Rosa-, Lavendel- und Gelbflächen sind immer die hellen Stufen; die kräftigen Stufen (`-strong`) erscheinen nur als Schrift, Kontur oder Symbol.
4. **Dekoration nur in Primärfarbe.** Klebeband, Randlinie und Unterstreichungen sind rosa, nie lavendel oder gelb.
5. **Weniger ist Standard.** Neutral ist die Ausgangslage. Eine Farbe kommt nur dazu, wenn sie eine der Aufgaben oben erfüllt. Fristen ohne Eile bekommen deshalb keinen Marker, Eckdaten-Chips sind neutral, nur die Stellenart ist rosa.

**Horizont-Karten** unterscheiden sich nur durch ein lavendelfarbenes Etikett mit kleinem Ring-Symbol und den Satz „Warum das passen könnte“ mit lavendelfarbener Randlinie. Score-Kreis, Knöpfe und Klebeband bleiben wie bei jeder Karte, damit der Stapel ruhig bleibt. Eine unsichere Frist ist hellgelb hinterlegt und gestrichelt umrandet (Akzentrolle), in Listen wellig unterstrichen.

## Aufbau der Tokens

`apps/web/src/styles/tokens.css` hat zwei Stufen, wie in einem modernen Designsystem:

- **Palette** (`--pal-…`): die einzigen Farbwerte, zum Beispiel `--pal-rosa-300` oder `--pal-lavendel-700`. Komponenten benutzen sie nie direkt.
- **Rollen**: `--surface`, `--surface-raised`, `--text`, `--text-muted`, `--primary`, `--primary-strong`, `--primary-soft`, `--secondary`, `--secondary-strong`, `--secondary-soft`, `--accent`, `--accent-soft`, `--accent-strong`, `--neutral`, `--neutral-soft`. Nur diese stehen in den Komponenten.

Das dunkle Notizbuch hängt nur die Rollen auf die Nachtpalette um (Pflaume, Altrosa, gedämpftes Lavendel und Gold). Eine neue Farbe kommt also zuerst in die Palette und bekommt dann eine Rolle, nie umgekehrt.

## Lesbarkeit

Alle Schriftfarben erfüllen WCAG AA (mindestens 4,5 : 1):

| Paar | Kontrast |
|---|---|
| Text auf Papier | 11,9 : 1 |
| Gedämpfter Text auf Papier | 5,2 : 1 |
| Kräftiges Rosa (Links) auf Weiß | 5,0 : 1 |
| Kräftiges Lavendel auf hellem Lavendel | 5,2 : 1 |
| Dunkle Schrift auf Rosa-Knopf | 7,7 : 1 |
| Nacht: Text auf Papier | 13,6 : 1 |
| Nacht: kräftiges Rosa auf Papier | 7,6 : 1 |

## Bilder

- Reihenfolge: Foto aus der Anzeige, sonst von der Einrichtung, sonst von der Stadt (Wikipedia/Wikimedia mit Lizenzangabe unter dem Bild).
- Fehlt ein Foto, zeigt die Karte eine **ruhige Skizze**: eine Linie in Altrosa auf hellem Grund, ohne Farbflächen, damit sie hinter dem Text zurücktritt.
- Unter *Ich → Aussehen* lassen sich Bilder auf den Karten im Stapel ausschalten. Ort und Score stehen dann in einer Kopfzeile, der Text bekommt mehr Platz.
- In der Demo können unter *Ich → Aussehen* eigene **Testfotos** gewählt werden. Sie werden auf alle Einrichtungen verteilt und bleiben nur im Browser.

## Schrift und Formen

- **Shantell Sans** (Handschrift) für die Oberfläche, mit leicht hüpfender Grundlinie in Überschriften.
- **Literata** für Anzeigentexte im „Zeitungsausschnitt“.
- Knöpfe mit handgezeichneter Kontur und hartem Schatten, Karteikarten leicht schräg, Polaroids mit Klebeband. Diese Formen bleiben in allen Rollen gleich; nur die Farbe wechselt.
