// Ausland: erkennt aus den Angaben einer Anzeige, in welchem Land die Stelle liegt, und regelt,
// wie viele Auslandsanzeigen aufgenommen und im Stapel gezeigt werden.
//
// Gespeichert wird das Land als Kürzel (ISO 3166-1, zwei Buchstaben) nur für Stellen außerhalb
// Deutschlands; ohne Kürzel gilt eine Anzeige als deutsch oder unbekannt.

import { normalizeText } from './text';

/** Länder, die im Stapel und beim Einsammeln Vorrang haben. */
export const EUROPE = new Set([
  'AT', 'CH', 'LI', 'LU', 'NL', 'BE', 'FR', 'GB', 'IE', 'DK', 'SE', 'NO', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'SI', 'HR', 'RS', 'BA',
  'ME', 'MK', 'AL', 'XK', 'BG', 'RO', 'GR', 'IT', 'ES', 'PT', 'EE', 'LV', 'LT', 'MT', 'CY', 'UA', 'MD',
]);

export function isEurope(code: string | null | undefined): boolean {
  return !!code && EUROPE.has(code);
}

/** Liegt die Stelle (soweit bekannt) außerhalb Deutschlands? */
export function isAbroad(job: { country?: string | null }): boolean {
  return !!job.country && job.country !== 'DE';
}

/** Ländernamen (deutsch, englisch, Landessprache), normalisiert wie normalizeText. */
const COUNTRY_NAMES: Record<string, string[]> = {
  DE: ['deutschland', 'germany', 'bundesrepublik deutschland', 'allemagne'],
  AT: ['oesterreich', 'austria'],
  CH: ['schweiz', 'switzerland', 'suisse', 'svizzera'],
  LI: ['liechtenstein'],
  LU: ['luxemburg', 'luxembourg'],
  NL: ['niederlande', 'netherlands', 'the netherlands', 'nederland', 'holland'],
  BE: ['belgien', 'belgium', 'belgique', 'belgie'],
  FR: ['frankreich', 'france'],
  GB: ['grossbritannien', 'vereinigtes koenigreich', 'united kingdom', 'great britain', 'england', 'scotland', 'schottland', 'wales', 'northern ireland'],
  IE: ['irland', 'ireland'],
  DK: ['daenemark', 'denmark', 'danmark'],
  SE: ['schweden', 'sweden', 'sverige'],
  NO: ['norwegen', 'norway', 'norge'],
  FI: ['finnland', 'finland', 'suomi'],
  IS: ['iceland'],
  PL: ['polen', 'poland', 'polska'],
  CZ: ['tschechien', 'tschechische republik', 'czech republic', 'czechia'],
  SK: ['slowakei', 'slovakia'],
  HU: ['ungarn', 'hungary'],
  SI: ['slowenien', 'slovenia', 'slovenija'],
  HR: ['kroatien', 'croatia', 'hrvatska'],
  RS: ['serbien', 'serbia', 'srbija'],
  BA: ['bosnien', 'bosnien und herzegowina', 'bosnia', 'bosnia and herzegovina'],
  ME: ['montenegro'],
  MK: ['nordmazedonien', 'north macedonia'],
  AL: ['albanien', 'albania'],
  BG: ['bulgarien', 'bulgaria'],
  RO: ['rumaenien', 'romania'],
  GR: ['griechenland', 'greece'],
  IT: ['italien', 'italy', 'italia'],
  ES: ['spanien', 'spain', 'espana'],
  PT: ['portugal'],
  EE: ['estland', 'estonia'],
  LV: ['lettland', 'latvia'],
  LT: ['litauen', 'lithuania'],
  MT: ['malta'],
  CY: ['zypern', 'cyprus'],
  UA: ['ukraine'],
  US: ['usa', 'vereinigte staaten', 'united states', 'united states of america'],
  CA: ['kanada', 'canada'],
  AU: ['australien', 'australia'],
  NZ: ['neuseeland', 'new zealand'],
  CN: ['china', 'volksrepublik china'],
  JP: ['japan'],
  KR: ['suedkorea', 'south korea', 'korea'],
  SG: ['singapur', 'singapore'],
  HK: ['hongkong', 'hong kong'],
  IN: ['indien', 'india'],
  IL: ['israel'],
  AE: ['vereinigte arabische emirate', 'united arab emirates'],
  QA: ['katar', 'qatar'],
  SA: ['saudi arabien', 'saudi arabia'],
  TR: ['tuerkei', 'turkey', 'tuerkiye'],
  BR: ['brasilien', 'brazil', 'brasil'],
  MX: ['mexiko', 'mexico'],
  ZA: ['suedafrika', 'south africa'],
};

/** Dreibuchstabige Kürzel, wie sie manche Portale liefern. */
const ISO3: Record<string, string> = {
  DEU: 'DE', AUT: 'AT', CHE: 'CH', LIE: 'LI', LUX: 'LU', NLD: 'NL', BEL: 'BE', FRA: 'FR', GBR: 'GB', IRL: 'IE', DNK: 'DK', SWE: 'SE', NOR: 'NO',
  FIN: 'FI', ISL: 'IS', POL: 'PL', CZE: 'CZ', SVK: 'SK', HUN: 'HU', SVN: 'SI', HRV: 'HR', SRB: 'RS', ITA: 'IT', ESP: 'ES', PRT: 'PT', GRC: 'GR',
  USA: 'US', CAN: 'CA', AUS: 'AU', CHN: 'CN', JPN: 'JP', SGP: 'SG', ISR: 'IL', IND: 'IN',
};

/**
 * Große Städte außerhalb Deutschlands. Bewusst ohne Namen, die auch deutsche Orte oder gewöhnliche Wörter sind
 * (Bergen, Rom, Linz, Halle …): Im Zweifel bleibt das Land unbekannt.
 */
const CITIES: Record<string, string[]> = {
  CH: ['zuerich', 'zurich', 'basel', 'bern', 'genf', 'geneva', 'geneve', 'lausanne', 'luzern', 'lucerne', 'st gallen', 'winterthur', 'lugano', 'fribourg', 'uster'],
  AT: ['wien', 'vienna', 'graz', 'innsbruck', 'salzburg', 'klagenfurt'],
  NL: ['amsterdam', 'utrecht', 'rotterdam', 'den haag', 'the hague', 'leiden', 'groningen', 'nijmegen', 'maastricht', 'eindhoven', 'tilburg', 'delft'],
  BE: ['bruessel', 'brussels', 'bruxelles', 'leuven', 'gent', 'ghent', 'antwerpen', 'antwerp'],
  FR: ['paris', 'lyon', 'toulouse', 'marseille', 'strasbourg', 'strassburg', 'grenoble'],
  GB: ['london', 'oxford', 'edinburgh', 'manchester', 'glasgow', 'bristol', 'leeds'],
  IE: ['dublin'],
  DK: ['kopenhagen', 'copenhagen', 'kobenhavn', 'aarhus'],
  SE: ['stockholm', 'goeteborg', 'gothenburg', 'uppsala', 'lund', 'umea'],
  NO: ['oslo', 'trondheim'],
  FI: ['helsinki', 'turku', 'tampere'],
  PL: ['warschau', 'warsaw', 'warszawa', 'krakau', 'krakow'],
  CZ: ['prag', 'prague', 'praha', 'brno'],
  HU: ['budapest'],
  RS: ['belgrad', 'belgrade', 'beograd', 'novi sad'],
  HR: ['zagreb'],
  SI: ['ljubljana'],
  IT: ['mailand', 'milan', 'milano', 'rome', 'roma', 'turin', 'torino', 'bologna', 'padua', 'padova', 'trieste', 'triest', 'florenz', 'florence'],
  ES: ['madrid', 'barcelona', 'valencia', 'sevilla'],
  PT: ['lissabon', 'lisbon', 'lisboa', 'porto', 'coimbra'],
  GR: ['athen', 'athens', 'thessaloniki'],
  EE: ['tallinn', 'tartu'],
  LV: ['riga'],
  LT: ['vilnius'],
  LU: ['esch sur alzette', 'belval'],
  US: ['new york', 'boston', 'san francisco', 'los angeles', 'chicago', 'seattle', 'philadelphia', 'pittsburgh'],
  CA: ['toronto', 'montreal', 'vancouver', 'kitchener', 'ottawa'],
  CN: ['peking', 'beijing', 'shanghai', 'shenzhen'],
  JP: ['tokio', 'tokyo', 'kyoto'],
  AU: ['sydney', 'melbourne', 'brisbane'],
  IL: ['tel aviv', 'jerusalem', 'haifa'],
  AE: ['dubai', 'abu dhabi'],
  QA: ['doha'],
};

interface Entry {
  code: string;
  re: RegExp;
}

function entries(table: Record<string, string[]>): Entry[] {
  return Object.entries(table)
    .flatMap(([code, names]) => names.map((n) => ({ code, len: n.length, re: new RegExp(`(?:^| )${n}(?: |$)`) })))
    .sort((a, b) => b.len - a.len);
}

const NAME_ENTRIES = entries(COUNTRY_NAMES);
const CITY_ENTRIES = entries(CITIES);
const NAME_TO_CODE = new Map(Object.entries(COUNTRY_NAMES).flatMap(([code, names]) => names.map((n) => [n, code] as const)));

/** Länderangabe eines Portals („CH“, „CHE“, „Switzerland“, „Schweiz“) → Kürzel; unbekannt: null. */
export function countryCode(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const up = v.toUpperCase();
  if (/^[A-Z]{2}$/.test(up)) return up === 'UK' ? 'GB' : up;
  if (/^[A-Z]{3}$/.test(up) && ISO3[up]) return ISO3[up];
  return NAME_TO_CODE.get(normalizeText(v)) ?? null;
}

function find(text: string, list: Entry[]): string | null {
  const n = normalizeText(text);
  return n ? (list.find((e) => e.re.test(n))?.code ?? null) : null;
}

/** Teile eines Titels, in denen üblicherweise der Ort steht: in Klammern, nach Gedankenstrich, Schrägstrich oder Komma. */
function titlePlaces(title: string): string {
  const parts = [...title.matchAll(/\(([^)]{2,60})\)/g)].map((m) => m[1]);
  const tail = title.split(/\s[-–—|/]\s|,\s/).slice(1);
  return [...parts, ...tail].join(' | ');
}

/**
 * Ausdrückliches Feld „Country“ im Anzeigentext, wie es Portale als Tabelle ausgeben
 * („Country“, Leerzeile, „Sweden“ oder „Country: Sweden“). Ein Bundesland unter „Land“ ergibt kein Kürzel.
 */
function countryField(text: string): string | null {
  for (const m of text.slice(0, 30_000).matchAll(/(?:^|\n)[ \t>*|-]*(?:Country|Countries|Land|Pays)[ \t*]*(?::[ \t]*|[ \t]*\|[ \t]*|\n\s*)([^\n|]{2,40})/g)) {
    const code = countryCode(m[1].replace(/[*_]/g, '').trim());
    if (code) return code;
  }
  return null;
}

/** US-Bundesstaaten als Kürzel (ohne „DE“: Delaware wäre sonst nicht von Deutschland zu unterscheiden). */
const US_STATES = new Set(
  'AL AK AZ AR CA CO CT FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '),
);
/** Ländernamen, längste zuerst (damit „united states of america“ vor „united states“ geprüft wird). */
const HEAD_NAMES = [...NAME_TO_CODE.entries()].sort((a, b) => b[0].length - a[0].length);

/**
 * Ort am Anfang des Anzeigentexts, wie ihn manche Portale vor die Anzeige setzen: „Zug, Switzerland University of
 * Lucerne“, „Rome, Italy John Cabot University“, „Orlando, FL The University of Central Florida“. Geprüft wird nur
 * die erste Textzeile und nur die Form „Ort, Land …“ (Land am Anfang des Teils nach dem Komma) bzw. „Ort, US-Kürzel …“.
 * Ein Land irgendwo im Fließtext zählt nicht („Kooperation mit Partnern in der Schweiz“).
 */
export function headPlace(text: string | null | undefined): { place: string; code: string } | null {
  if (!text) return null;
  const line = text
    .slice(0, 600)
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[#*_>|]/g, ' ').replace(/\s+/g, ' ').trim())
    .find((l) => l.length > 0);
  if (!line) return null;
  const m = /^([^\d,()]{2,40}),\s*(.{2,})$/.exec(line.slice(0, 160));
  if (!m) return null;
  const city = m[1].trim();
  const rest = m[2].trim();
  const n = normalizeText(rest);
  for (const [name, code] of HEAD_NAMES) {
    if (n === name || n.startsWith(`${name} `)) {
      const words = name.split(' ').length;
      return { place: `${city}, ${rest.split(/\s+/).slice(0, words).join(' ')}`, code };
    }
  }
  const st = /^([A-Z]{2})(?:\s|$)/.exec(rest);
  if (st && US_STATES.has(st[1])) return { place: `${city}, ${st[1]}`, code: 'US' };
  return null;
}

/**
 * Land einer Stelle. Reihenfolge: Länderangabe des Portals, dann Ortsangabe (Land oder große Stadt), dann ein Ort
 * am Textanfang („Zug, Switzerland …“, siehe headPlace), dann ein ausdrückliches Feld „Country“ im Text, dann die
 * Ortsteile des Titels („Psychotherapeut:in – Region Zürich“, „Developer (Lisboa, PT)“).
 * germanCity: Die Ortsangabe nennt eine deutsche Stadt aus dem Register (dann zählt der Titel nicht mehr).
 * „DE“ heißt: sicher in Deutschland. null heißt: unbekannt (wird wie eine deutsche Stelle behandelt).
 */
export function countryOf(p: { country?: string | null; locationText?: string | null; title?: string | null; text?: string | null; germanCity?: boolean }): string | null {
  const given = countryCode(p.country);
  if (given) return given;
  if (p.locationText) {
    const byPlace = find(p.locationText, NAME_ENTRIES) ?? find(p.locationText, CITY_ENTRIES);
    if (byPlace) return byPlace;
  }
  if (p.text) {
    const byHead = headPlace(p.text)?.code;
    if (byHead) return byHead;
    const byField = countryField(p.text);
    if (byField) return byField;
  }
  if (p.germanCity) return 'DE';
  if (p.title) {
    const places = titlePlaces(p.title);
    const byTitle = find(places, NAME_ENTRIES) ?? find(places, CITY_ENTRIES);
    if (byTitle) return byTitle;
  }
  return null;
}

// ---------------------------------------------------------------- Regeln und Deckel

/**
 * Einstellung „ausland“: ob Auslandsanzeigen aufgenommen werden und wie viele. Entschieden wird beim Einsammeln
 * nach Regeln, also bevor eine KI die Anzeige sieht: Nur was fachlich einschlägig ist (siehe fach.ts) und die
 * Mindest-Passung erreicht, und je Lauf höchstens proLauf Anzeigen, davon höchstens weltweitProLauf außerhalb Europas.
 */
export interface AuslandSetting {
  an: boolean;
  proLauf: number;
  weltweitProLauf: number;
  minPassung: number;
}

export const DEFAULT_AUSLAND: AuslandSetting = { an: false, proLauf: 40, weltweitProLauf: 10, minPassung: 65 };

export function parseAusland(raw: unknown, fallbackOn = false): AuslandSetting {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AUSLAND, an: fallbackOn };
  const r = raw as Partial<AuslandSetting>;
  const num = (v: unknown, d: number, max: number) => (typeof v === 'number' && v >= 0 && v <= max ? Math.round(v) : d);
  return {
    an: r.an === true,
    proLauf: num(r.proLauf, DEFAULT_AUSLAND.proLauf, 500),
    weltweitProLauf: num(r.weltweitProLauf, DEFAULT_AUSLAND.weltweitProLauf, 500),
    minPassung: num(r.minPassung, DEFAULT_AUSLAND.minPassung, 100),
  };
}

/**
 * Abstand der Auslandskarten im Stapel: nach jeweils 2 bis 5 anderen Karten eine. Damit ist höchstens jede dritte
 * Karte eine Auslandsstelle (höchstens 33 %), im Mittel etwa jede vierte bis fünfte.
 */
export const ABROAD_GAPS: [number, number] = [2, 5];

/**
 * Unter dieser Passung wird eine Auslandsstelle gar nicht angezeigt, weder im Stapel noch in den Listen
 * (Gemerktes bleibt sichtbar); außerdem muss sie fachlich einschlägig sein (fach.ts). Dieselben Regeln gelten beim
 * Einsammeln, damit nichts aufbereitet wird, was nie erscheint.
 */
export const ABROAD_MIN_SCORE = DEFAULT_AUSLAND.minPassung;

/** So viele Punkte Vorsprung bekommt Europa bei der Reihenfolge der Auslandskarten. */
export const EUROPE_BONUS = 10;
