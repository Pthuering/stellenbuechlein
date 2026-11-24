// Statistik: Aufbau des Schnappschusses, den jeder Einsammel-Lauf am Ende ablegt (Tabelle statistik), und die
// Passungsstufen, nach denen Bestand und Wirkung gezählt werden.

export const PASSUNG_STUFEN = ['0-19', '20-39', '40-59', '60-79', '80+'] as const;
export type PassungStufe = (typeof PASSUNG_STUFEN)[number];

export function passungStufe(score: number): PassungStufe {
  if (score >= 80) return '80+';
  if (score >= 60) return '60-79';
  if (score >= 40) return '40-59';
  if (score >= 20) return '20-39';
  return '0-19';
}

/** Ringe, wie die App sie zeigt (normale Einträge ohne eigenen Namen), dazu Auslandsstellen. */
export const STAT_RINGE = ['normal', 'bruecke', 'horizont', 'ausland'] as const;
export type StatRing = (typeof STAT_RINGE)[number];

export interface GemerktWeggelegt {
  gemerkt: number;
  weggelegt: number;
}

export interface StatSchnappschuss {
  version: 1;
  /** Kennzahlen des Einsammel-Laufs (aus runs.stats, dauerhaft aufgehoben) */
  lauf: {
    start: string;
    ende: string;
    ok: boolean;
    minuten: number;
    /** Seiten in den Listen der Quellen (Kandidaten) */
    gefunden: number;
    /** davon schon als Anzeige bekannt */
    bekannt: number;
    /** davon früher schon aussortiert und nicht neu abgerufen */
    frueherAussortiert: number;
    /** am Titel aussortiert (Pflege, Arzt …), ohne Abruf */
    titel: number;
    /** am Grobfilter aussortiert (kein Fachbegriff, keine Brücke, kein Horizont) */
    grobfilter: number;
    /** nach Regeln keine einzelne Stellenanzeige */
    keineAnzeige: number;
    dubletten: number;
    /** wegen der Laufzeit auf den nächsten Lauf verschoben */
    verschoben: number;
    /** neu aufgenommen (alle Ringe) */
    neu: number;
    /** davon über eine Brücke */
    neuBruecke: number;
    /** ohne Brücke, wartet auf das Urteil der KI (wird erst bei „passt“ oder „eher“ gespeichert) */
    horizontWartet: number;
    neuAusland: number;
    /** Anzeigen, die der Lauf geschlossen hat (Frist vorbei oder nicht mehr gelistet) */
    abgelaufen: number;
    quellenOk: number;
    quellenFehler: number;
    abrufe: number;
    /** KI-Aufgaben, die der Lauf eingereiht hat */
    kiAufgaben: number;
  };
  /** Zustand des Bestands nach dem Lauf */
  bestand: {
    offen: number;
    normal: number;
    /** Brücken-Karten, von der KI geprüft (im Stapel) */
    bruecke: number;
    /** Horizont-Karten, von der KI geprüft (im Stapel) */
    horizont: number;
    /** Brücken- und Horizont-Karten ohne KI-Urteil */
    wartetAufKi: number;
    ausland: number;
    /** davon in der App sichtbar (Passung und Fachprüfung reichen) */
    auslandSichtbar: number;
    mitFrist: number;
    /** Frist in den nächsten 14 Tagen */
    fristBald: number;
    /** Passung der normalen Einträge nach Stufe */
    passung: Record<PassungStufe, number>;
    passungMedian: number | null;
    /** offene KI-Aufgaben nach dem Lauf */
    kiOffen: number;
  };
  /** Was Tara bisher entschieden hat (alle Entscheidungen zu Anzeigen, die es noch gibt), mit dem Profil von heute */
  wirkung: {
    nachRing: Record<StatRing, GemerktWeggelegt>;
    /** nur normale Einträge */
    nachPassung: Record<PassungStufe, GemerktWeggelegt>;
    herz: number;
    beworben: number;
  };
}

/** KI-Ergebnisse je Tag (aus ki_aufgaben): art, Ergebnis (Urteil, Anzeige ja/nein, Frist ja/nein, fehler), Wartezeit. */
export interface KiTag {
  tag: string;
  art: string;
  ergebnis: string;
  n: number;
  /** mittlere Wartezeit von „eingereiht“ bis „erledigt“ in Stunden */
  stunden: number | null;
}

/** Taras Entscheidungen je Tag (aus marks), nach dem Ring beim Einsammeln; gelöschte Anzeigen: „weg“. */
export interface EntscheidungTag {
  tag: string;
  entscheidung: string;
  ring: string;
  n: number;
}

/** Kennzahlen eines Laufs aus seinen Rohzahlen (runs.stats); gleich gerechnet im Lauf und in der App. */
export function laufKennzahlen(run: { start: string; ende: string | null; ok: boolean; stats: Record<string, number> }): StatSchnappschuss['lauf'] {
  const n = (k: string) => (typeof run.stats[k] === 'number' ? run.stats[k] : 0);
  const ende = run.ende ?? run.start;
  return {
    start: run.start,
    ende,
    ok: run.ok,
    minuten: Math.max(0, Math.round((Date.parse(ende) - Date.parse(run.start)) / 60_000)),
    gefunden: n('kandidaten'),
    bekannt: n('gesehen'),
    frueherAussortiert: n('grobfilterBekannt'),
    titel: n('titelAusschluss'),
    grobfilter: n('grobfilter') + n('kiNein'),
    keineAnzeige: n('keineAnzeigeRegel') + n('keineAnzeige'),
    dubletten: n('dubletten'),
    verschoben: n('verschoben') + n('auslandVertagt'),
    neu: n('neu') + n('browserNeu'),
    neuBruecke: n('neuHorizont'),
    horizontWartet: n('weiteWartet'),
    neuAusland: n('neuAusland'),
    abgelaufen: n('abgelaufen'),
    quellenOk: n('quelle_ok') + n('quelle_leer'),
    quellenFehler: n('quelle_fehler') + n('quelle_blockiert'),
    abrufe: n('http'),
    kiAufgaben: n('kiAufgaben'),
  };
}

export function leereStufen<T>(make: () => T): Record<PassungStufe, T> {
  return Object.fromEntries(PASSUNG_STUFEN.map((s) => [s, make()])) as Record<PassungStufe, T>;
}

export function leereRinge<T>(make: () => T): Record<StatRing, T> {
  return Object.fromEntries(STAT_RINGE.map((r) => [r, make()])) as Record<StatRing, T>;
}
