// Datumshilfen. Alle Fristen sind Kalendertage (YYYY-MM-DD) in deutscher Zeit.

const MONTHS: Record<string, number> = {
  januar: 1, jan: 1, january: 1, jaenner: 1, jänner: 1,
  februar: 2, feb: 2, february: 2,
  maerz: 3, märz: 3, mrz: 3, mar: 3, march: 3, mär: 3, maer: 3,
  april: 4, apr: 4,
  mai: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, october: 10, oct: 10,
  november: 11, nov: 11,
  dezember: 12, dez: 12, december: 12, dec: 12,
};

const MONTH_NAMES =
  'Januar|Jänner|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|' +
  'Jan|Feb|Mrz|Mär|Apr|Jun|Jul|Aug|Sept|Sep|Okt|Nov|Dez|' +
  'January|February|March|May|June|July|October|December|Oct|Dec';

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isoDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Heutiges Datum in Europe/Berlin als YYYY-MM-DD. */
export function todayBerlin(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Tage von a bis b (b - a), beide YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86_400_000);
}

export function daysUntil(deadline: string | null | undefined, today: string = todayBerlin()): number | null {
  if (!deadline) return null;
  return daysBetween(today, deadline);
}

export interface FoundDate {
  index: number;
  end: number;
  iso: string;
  raw: string;
}

/** Findet Datumsangaben in deutschem und englischem Text. */
export function findDates(text: string): FoundDate[] {
  const out: FoundDate[] = [];
  const push = (m: RegExpExecArray, iso: string | null) => {
    if (iso) out.push({ index: m.index, end: m.index + m[0].length, iso, raw: m[0] });
  };
  let m: RegExpExecArray | null;

  // 15.11.2026 / 15.11.26 / 15. 11. 2026
  const numeric = /(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})(?![\d])/g;
  while ((m = numeric.exec(text))) push(m, isoDate(+m[3], +m[2], +m[1]));

  // 15. November 2026 / 15 Nov. 2026 / 1st December 2026
  const dmy = new RegExp(`(?<!\\d)(\\d{1,2})(?:\\.|st|nd|rd|th)?\\s+(${MONTH_NAMES})\\.?,?\\s+(\\d{4})`, 'gi');
  while ((m = dmy.exec(text))) {
    const mo = MONTHS[m[2].toLowerCase().replace('ä', 'ae')] ?? MONTHS[m[2].toLowerCase()];
    if (mo) push(m, isoDate(+m[3], mo, +m[1]));
  }

  // November 15, 2026 / December 1st 2026
  const mdy = new RegExp(`(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'gi');
  while ((m = mdy.exec(text))) {
    const mo = MONTHS[m[1].toLowerCase().replace('ä', 'ae')] ?? MONTHS[m[1].toLowerCase()];
    if (mo) push(m, isoDate(+m[3], mo, +m[2]));
  }

  // 2026-11-15
  const iso = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
  while ((m = iso.exec(text))) push(m, isoDate(+m[1], +m[2], +m[3]));

  out.sort((a, b) => a.index - b.index);
  // Überlappungen entfernen (z. B. "15. November 2026" und "2026")
  const dedup: FoundDate[] = [];
  for (const d of out) {
    const last = dedup[dedup.length - 1];
    if (last && d.index < last.end) continue;
    dedup.push(d);
  }
  return dedup;
}

/** Datum für die Anzeige: "15.11.2026". */
export function formatDateDe(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** "noch 12 Tage", "heute", "morgen", "seit 3 Tagen vorbei" */
export function deadlineLabel(deadline: string | null | undefined, today: string = todayBerlin()): string {
  const d = daysUntil(deadline, today);
  if (d === null) return 'ohne Frist';
  if (d < -1) return `seit ${-d} Tagen vorbei`;
  if (d === -1) return 'seit gestern vorbei';
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d < 7) return `noch ${d} Tage`;
  if (d < 60) return `noch ${d} Tage`;
  const months = Math.round(d / 30);
  return `noch ca. ${months} Monate`;
}
