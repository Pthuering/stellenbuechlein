// Gemeinsame Typen für App, API und Einsammel-Pipeline.

export type StateCode =
  | 'BW' | 'BY' | 'BE' | 'BB' | 'HB' | 'HH' | 'HE' | 'MV'
  | 'NI' | 'NW' | 'RP' | 'SL' | 'SN' | 'ST' | 'SH' | 'TH';

export const STATES: Record<StateCode, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

export const STATE_CODES = Object.keys(STATES) as StateCode[];

export type JobKind =
  | 'promotion'
  | 'postdoc'
  | 'wiss_ma'
  | 'professur'
  | 'projekt'
  | 'lehre'
  | 'shk'
  | 'klinik'
  | 'verwaltung'
  | 'sonstige';

export const JOB_KINDS: JobKind[] = [
  'promotion', 'postdoc', 'wiss_ma', 'professur', 'projekt', 'lehre', 'shk', 'klinik', 'verwaltung', 'sonstige',
];

export const JOB_KIND_LABELS: Record<JobKind, string> = {
  promotion: 'Promotion',
  postdoc: 'Postdoc',
  wiss_ma: 'Wiss. Mitarbeit',
  professur: 'Professur',
  projekt: 'Projekt & Koordination',
  lehre: 'Lehre',
  shk: 'Hilfskraft',
  klinik: 'Klinik & Therapie',
  verwaltung: 'Verwaltung & Technik',
  sonstige: 'Sonstiges',
};

export const INSTITUTION_KINDS = [
  'universitaet',
  'ph',
  'hochschule',
  'privat',
  'mpg',
  'leibniz',
  'helmholtz',
  'fraunhofer',
  'klinik',
  'ressort',
  'sonstige',
  'unternehmen',
] as const;

export type InstitutionKind = (typeof INSTITUTION_KINDS)[number];

export const INSTITUTION_KIND_LABELS: Record<InstitutionKind, string> = {
  universitaet: 'Universität',
  ph: 'Pädagogische Hochschule',
  hochschule: 'Hochschule',
  privat: 'Private Hochschule',
  mpg: 'Max-Planck-Institut',
  leibniz: 'Leibniz-Institut',
  helmholtz: 'Helmholtz-Zentrum',
  fraunhofer: 'Fraunhofer-Institut',
  klinik: 'Klinikum',
  ressort: 'Bundes-/Landesinstitut',
  sonstige: 'Forschung, Stiftung, Verband',
  unternehmen: 'Unternehmen',
};

export interface City {
  id: string;
  name: string;
  state: StateCode;
  lat: number;
  lon: number;
  wikiDe?: string | null;
  imageUrl?: string | null;
  imageCredit?: string | null;
}

export interface Institution {
  id: string;
  name: string;
  shortName?: string | null;
  kind: InstitutionKind;
  cityId: string | null;
  lat?: number | null;
  lon?: number | null;
  website?: string | null;
  wikiDe?: string | null;
  imageUrl?: string | null;
  imageCredit?: string | null;
  active: boolean;
  origin: 'seed' | 'user' | 'portal';
}

export type SourceKind = 'zentral' | 'fachbereich' | 'portal';
export type SourceStatus = 'neu' | 'ok' | 'leer' | 'warnung' | 'fehler' | 'blockiert' | 'url-fehlt';
export type Gate = 'none' | 'psych';

export interface SourceConfig {
  /** Explizite Feed-URL (RSS/Atom/JSON Feed), falls bekannt. */
  feedUrl?: string;
  /** Vorgegebener Adapter-Typ, z. B. "personio", "workday", "psychjob", "ba-jobsuche". */
  ats?: string;
  /** Seiten per Browser rendern (JS-nachgeladene Listen). */
  render?: boolean;
  /** CSS-Selektor für Links zu Anzeigen auf der Listenseite. */
  linkSelector?: string;
  /** Regex (als String), dem Anzeigen-URLs entsprechen müssen. */
  linkPattern?: string;
  /** Maximal zu verfolgende Listenseiten (Paginierung). */
  maxPages?: number;
  /** Suchbegriffe (für Portale mit Suche). */
  queries?: string[];
  /** robots.txt bewusst ignorieren (nur für private Nutzung, per Quelle). */
  ignoreRobots?: boolean;
  /** Freitext-Notiz aus der Recherche. */
  note?: string;
  [key: string]: unknown;
}

export interface Source {
  id: string;
  institutionId: string | null;
  kind: SourceKind;
  label: string | null;
  url: string | null;
  adapter: string;
  config: SourceConfig;
  gate: Gate;
  enabled: boolean;
  verified: boolean;
  status: SourceStatus;
  statusNote?: string | null;
  lastRunAt?: string | null;
  lastOkAt?: string | null;
  lastCount?: number | null;
  consecutiveFailures: number;
  methodsUsed?: string[];
}

export interface JobSourceRef {
  sourceId: string;
  label: string | null;
  url: string;
}

/**
 * Wie sicher eine Frist ist:
 *  ok       – mit Jahr aus dem Anzeigentext oder den strukturierten Daten
 *  jahr     – im Text ohne Jahr, Jahr ergänzt
 *  ki       – von der KI im Text nachgeprüft (Zitat in deadlineNote)
 *  unsicher – unplausibel oder mehrdeutig, bitte im Original prüfen
 */
export type DeadlineCheck = 'ok' | 'jahr' | 'ki' | 'unsicher';

/**
 * Ring, über den eine Anzeige hereinkam:
 *  kern     – Psychologie-Bezug (Grobfilter) oder Fachbereichs-Quelle
 *  horizont – kein Psychologie-Bezug, aber eine Brücke aus dem Suchprofil passt
 *  weite    – keine Brücke, aber die KI hält die Stelle für übertragbar
 */
export type Lane = 'kern' | 'horizont' | 'weite';

export const LANE_LABELS: Record<Lane, string> = { kern: 'Kern', horizont: 'Horizont', weite: 'Weite' };

/** KI-Einschätzung für Horizont- und Weite-Anzeigen. */
export interface JobHorizon {
  /** Ein Satz: warum die Stelle passen könnte. */
  reason?: string | null;
  /** KI-Urteil; „nein“ nur bei Anzeigen, die der Grobfilter ohnehin durchgelassen hat (werden nicht eingestreut). */
  verdict?: 'passt' | 'eher' | 'nein' | null;
  /** Kurzes Etikett der Verbindung, z. B. „IT-Sicherheit × Verhalten“. */
  label?: string | null;
  /** IDs der Brücken, die beim Einsammeln gepasst haben. */
  bridges?: string[];
}

export type FoundVia = 'quelle' | 'portal' | 'erkundung';

export interface Job {
  id: string;
  institutionId: string | null;
  url: string;
  title: string;
  department?: string | null;
  locationText?: string | null;
  cityId?: string | null;
  lat?: number | null;
  lon?: number | null;
  descriptionMd: string;
  summary?: string | null;
  summaryByAi?: boolean;
  kind: JobKind | null;
  payGrade?: string | null;
  payLevel?: number | null;
  workloadPct?: number | null;
  workloadText?: string | null;
  fixedTerm?: string | null;
  isPermanent?: boolean | null;
  startText?: string | null;
  deadline?: string | null;
  deadlineText?: string | null;
  deadlineCheck?: DeadlineCheck | null;
  /** Begründung zur Frist (z. B. „im Text ohne Jahr“, KI-Zitat, warum unsicher). */
  deadlineNote?: string | null;
  referenceNo?: string | null;
  contact?: string | null;
  language?: 'de' | 'en' | null;
  imageUrl?: string | null;
  imageKind?: 'posting' | 'institution' | 'city' | null;
  imageCredit?: string | null;
  pdfUrl?: string | null;
  postedAt?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
  /** pruefung: noch nicht sicher eine Anzeige, die App zeigt sie erst nach Claudes Auswertung */
  status: 'aktiv' | 'abgelaufen' | 'pruefung';
  completeness: 'ok' | 'teilweise';
  method?: string | null;
  psychTerms?: string[];
  sources?: JobSourceRef[];
  lane?: Lane | null;
  horizon?: JobHorizon | null;
  /** Von einer Website bzw. einem Arbeitgeber, die beim Fund noch nicht im Quellen-Register standen. */
  newSite?: boolean;
  foundVia?: FoundVia | null;
  /** Arbeitgeber, wie er in der Anzeige steht (für Einrichtungen außerhalb des Registers). */
  employer?: string | null;
  /** Erfundene Anzeige aus den Dummy-Daten (Demo). */
  dummy?: boolean;
}

export type Decision = 'gemerkt' | 'abgelehnt';

export interface Mark {
  jobId: string;
  decision: Decision | null;
  decidedAt?: string | null;
  star: boolean;
  appliedAt?: string | null;
  note?: string | null;
  updatedAt: string;
}

export type FavoriteKind = 'state' | 'city' | 'institution';

export interface Favorite {
  kind: FavoriteKind;
  ref: string;
}

export interface HomeLocation {
  label: string;
  lat: number;
  lon: number;
}

/** Halle (Saale) – Standard-Mittelpunkt für Radius und Entfernungen. */
export const DEFAULT_HOME: HomeLocation = {
  label: 'Halle (Saale)',
  lat: 51.4825,
  lon: 11.9697,
};

export interface RunInfo {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean;
  stats: Record<string, number>;
}
