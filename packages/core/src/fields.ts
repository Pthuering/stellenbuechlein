// Extraktion strukturierter Felder aus dem Anzeigentext (Regeln für deutsche und englische Anzeigen).
// Bewusst regelbasiert: nachvollziehbar, kostenlos, schnell. Die LLM-Stufe der Pipeline greift nur,
// wenn hier etwas Wichtiges (Titel, Frist) fehlt.

import { addDays, findDates, findYearlessDates, formatDateDe, todayBerlin } from './dates';
import { inferYear } from './deadline';

export interface ExtractedFields {
  deadline: string | null;
  deadlineText: string | null;
  /** Die Frist stand ohne Jahr im Text, das Jahr wurde ergänzt. */
  deadlineYearInferred: boolean;
  /** Ein Fristhinweis ohne verwertbares Datum (z. B. Datum ohne Jahr, das nicht eindeutig ist). */
  deadlineUnclear: string | null;
  payGrade: string | null;
  payLevel: number | null;
  workloadPct: number | null;
  workloadText: string | null;
  isPermanent: boolean | null;
  fixedTerm: string | null;
  startText: string | null;
  referenceNo: string | null;
  contact: string | null;
}

export interface ExtractOptions {
  title?: string;
  today?: string;
  /** Bezugsdatum für Fristen ohne Jahr: Veröffentlichung der Anzeige, sonst der Tag des Fundes. */
  reference?: string;
}

// ---------------------------------------------------------------- Frist

interface DeadlineKey {
  re: RegExp;
  weight: number;
  /** Kontext vor dem Treffer muss nach Bewerbung klingen (für generische "bis zum"). */
  needsApplyContext?: boolean;
}

const DEADLINE_KEYS: DeadlineKey[] = [
  {
    // Verlängerte Frist schlägt die ursprüngliche
    re: /(?:bewerbungs)?frist[^.\n]{0,80}?verl[äa]ngert[^.\n\d]{0,30}?|(?:deadline|closing date)[^.\n]{0,60}?(?:has been |was )?extended[^.\n\d]{0,20}?/gi,
    weight: 4,
  },
  {
    re: /bewerbungs(?:frist|schluss|ende|eingang)|ende der bewerbungsfrist|einsendeschluss|ausschreibungsfrist|ausschreibungsende|frist f[üu]r (?:die )?bewerbung(?:en)?|application deadline|closing date|deadline for applications?|applications? deadline|\bdeadline\b|\bbewerbungsfrist\b/gi,
    weight: 3,
  },
  {
    re: /bewerbung(?:en|sunterlagen)?\b[^.\n]{0,160}?\b(?:bis(?: zum| spätestens| sp[äa]testens zum)?|sp[äa]testens(?: am| zum| bis)?|until|by|before|no later than|prior to)\b/gi,
    weight: 2,
  },
  {
    re: /applications?\b[^.\n]{0,160}?\b(?:until|by|before|no later than|prior to)\b/gi,
    weight: 2,
  },
  {
    re: /\b(?:bis zum|bis sp[äa]testens|sp[äa]testens zum|sp[äa]testens am|no later than)\b/gi,
    weight: 1,
    needsApplyContext: true,
  },
];

const NOT_A_DEADLINE_CONTEXT =
  /befrist|laufzeit|vertrag|elternzeit|mutterschutz|vertretung|besch[äa]ftigung(?:sdauer)? bis|zun[äa]chst bis|projektende|ende des projekts|f[öo]rderzeitraum|employment|contract|until the end of|fixed[- ]term/i;
const APPLY_CONTEXT = /bewerb|application|apply|einreich|senden|schicken|richten|[üu]bermitteln|online|portal|e-?mail/i;

interface DeadlineFound {
  iso: string | null;
  raw: string;
  yearInferred: boolean;
}

function extractDeadline(text: string, today: string, reference: string): DeadlineFound | null {
  const dates = findDates(text);
  const yearless = findYearlessDates(text);
  if (dates.length === 0 && yearless.length === 0) return null;
  const minDate = addDays(today, -400);
  const maxDate = addDays(today, 730);

  let best: (DeadlineFound & { weight: number; pos: number }) | null = null;
  const consider = (c: DeadlineFound, weight: number, pos: number) => {
    if (!best || weight > best.weight || (weight === best.weight && pos < best.pos)) best = { ...c, weight, pos };
  };
  for (const key of DEADLINE_KEYS) {
    key.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = key.re.exec(text))) {
      const keyEnd = m.index + m[0].length;
      const before = text.slice(Math.max(0, m.index - 90), m.index + m[0].length);
      if (key.weight < 3 && NOT_A_DEADLINE_CONTEXT.test(before) && !/bewerb|application/i.test(m[0])) continue;
      if (key.needsApplyContext) {
        const ctx = text.slice(Math.max(0, m.index - 140), keyEnd);
        if (!APPLY_CONTEXT.test(ctx)) continue;
        if (NOT_A_DEADLINE_CONTEXT.test(text.slice(Math.max(0, m.index - 60), m.index))) continue;
      }
      const d = dates.find((x) => x.index >= keyEnd - 2 && x.index <= keyEnd + 140);
      const y = yearless.find((x) => x.index >= keyEnd - 2 && x.index <= keyEnd + 60);
      // Ein vollständiges Datum hat Vorrang, außer das Datum ohne Jahr steht deutlich näher am Schlüsselwort.
      if (d && (!y || d.index <= y.index + 4)) {
        if (d.iso < minDate || d.iso > maxDate) continue;
        consider({ iso: d.iso, raw: d.raw, yearInferred: false }, key.weight, m.index);
      } else if (y) {
        const inferred = inferYear(y.day, y.month, reference);
        // Nicht eindeutig: als Hinweis behalten (Datum leer), etwas schwächer gewichtet
        consider({ iso: inferred, raw: y.raw, yearInferred: true }, key.weight - (inferred ? 0.25 : 0.5), m.index);
      }
    }
  }
  if (!best) return null;
  const b = best as DeadlineFound;
  return { iso: b.iso, raw: b.raw, yearInferred: b.yearInferred };
}

// ---------------------------------------------------------------- Entgelt

const TARIFF_RE =
  /\b(TV-?L|TV-?H|TV\s?-?\s?[öÖo]D(?:[-\s](?:Bund|VKA))?|TV[öÖ]D(?:[-\s](?:Bund|VKA))?|TV-?TgDRV|TV-?[ÄA]rzte|TV-?UK[A-Z]*|TV-?Charit[ée]|TV-?Stud|AVR|BAT)\b/i;

function normalizeTariff(t: string): string {
  const u = t.toUpperCase().replace(/\s+/g, '');
  if (u.startsWith('TV-L') || u === 'TVL') return 'TV-L';
  if (u.startsWith('TV-H') || u === 'TVH') return 'TV-H';
  if (/^TV-?[ÖO]D/.test(u)) return u.includes('BUND') ? 'TVöD-Bund' : u.includes('VKA') ? 'TVöD-VKA' : 'TVöD';
  if (u.includes('TGDRV')) return 'TV-TgDRV';
  if (u.includes('RZTE')) return 'TV-Ärzte';
  if (u.includes('CHARIT')) return 'TV-Charité';
  if (u.startsWith('TV-UK') || u.startsWith('TVUK')) return t.replace(/\s+/g, '');
  return t.trim();
}

const PAY_CONTEXT = /verg[üu]t|entgelt|eingruppier|bezahl|besold|tarif|salary|pay|remunerat|grade|tv-?l|tv[öo]d|tv-?h|stelle|position/i;

function extractPay(text: string, title: string): { grade: string; level: number | null } | null {
  const hay = `${title}\n${text}`;

  // 1) Tarif vor Zahl: "TV-L 13", "TV-L E 13", "TVöD-Bund EG 13"
  const tariffFirst = new RegExp(`${TARIFF_RE.source}\\s*,?\\s*(?:E|EG|Entgeltgruppe)?\\s?(\\d{1,2})(?:\\s?(?:Ü|Ue))?(?![\\d%])`, 'i');
  // 2) Entgeltgruppe/EG/E + Zahl, optional Tarif danach
  const gradeRe = /(bis(?: zur| zu)?\s+)?(?:\b(?:Entgeltgruppe|Entgeltgr\.|Verg[üu]tungsgruppe|EG)\s*|(?<![A-Za-zÄÖÜäöü\d])E\s?)(\d{1,2})(?:\s?(?:Ü|Ue))?(?![\d.,%])/gi;

  let m: RegExpExecArray | null;
  const tf = tariffFirst.exec(hay);
  if (tf) {
    const level = Number(tf[2]);
    if (level >= 1 && level <= 15) {
      const before = hay.slice(Math.max(0, tf.index - 8), tf.index);
      const bis = /bis\s*$/i.test(before) ? 'bis ' : '';
      return { grade: `${bis}E ${level} ${normalizeTariff(tf[1])}`, level };
    }
  }
  gradeRe.lastIndex = 0;
  while ((m = gradeRe.exec(hay))) {
    const level = Number(m[2]);
    if (level < 1 || level > 15) continue;
    const ctx = hay.slice(Math.max(0, m.index - 80), m.index + m[0].length + 40);
    const explicit = /entgeltgr|eg\s?\d|verg[üu]tungsgr/i.test(m[0]);
    if (!explicit && !PAY_CONTEXT.test(ctx)) continue;
    if (!explicit && level < 5) continue;
    const after = hay.slice(m.index + m[0].length, m.index + m[0].length + 25);
    const t = TARIFF_RE.exec(after) ?? TARIFF_RE.exec(hay.slice(Math.max(0, m.index - 25), m.index));
    const bis = m[1] ? 'bis ' : '';
    return { grade: `${bis}E ${level}${t ? ` ${normalizeTariff(t[1])}` : ''}`, level };
  }

  // 3) W-Besoldung
  const w = /\b(?:Besoldungsgruppe\s*)?W\s?([123])\b(?:\s*(?:LBesG|BBesO|BayBesG|[A-ZÄÖÜ][a-zäöü]*BesG))?/g;
  while ((m = w.exec(hay))) {
    const ctx = hay.slice(Math.max(0, m.index - 100), m.index + 60);
    if (/profess|besold|lehrstuhl|chair|tenure/i.test(ctx)) {
      const n = Number(m[1]);
      return { grade: `W${n}`, level: n === 1 ? 14 : 15 };
    }
  }

  // 4) A-Besoldung (Beamte)
  const a = /\bBesoldungsgruppe\s*A\s?(\d{1,2})\b/i.exec(hay);
  if (a) {
    const n = Number(a[1]);
    return { grade: `A ${n}`, level: Math.min(15, n) };
  }
  return null;
}

// ---------------------------------------------------------------- Umfang

const WORKLOAD_CONTEXT =
  /stelle|teilzeit|vollzeit|umfang|arbeitszeit|besch[äa]ftig|wochenarbeitszeit|regelm[äa][ßs]ig|tv-?l|tv[öo]d|tv-?h|\be\s?1\d|position|fte|full[- ]time|part[- ]time|employment|appointment|working time|of the regular|der regul/i;

function extractWorkload(text: string, title: string): { pct: number | null; text: string | null } {
  const pctRe = /(\d{2,3})(?:[.,]\d+)?\s?(?:%|Prozent|v\.\s?H\.|percent)/gi;
  // Titel zuerst: "(75 %)"
  let m = pctRe.exec(title);
  if (m) {
    const v = Number(m[1]);
    if (v >= 10 && v <= 100) return { pct: v, text: `${v} %` };
  }
  pctRe.lastIndex = 0;
  while ((m = pctRe.exec(text))) {
    const v = Number(m[1]);
    if (v < 10 || v > 100) continue;
    const ctx = text.slice(Math.max(0, m.index - 90), m.index + m[0].length + 60);
    if (!WORKLOAD_CONTEXT.test(ctx)) continue;
    if (/rabatt|zuschlag|nachlass|ermäßig|discount|frauenanteil|quote|anteil/i.test(ctx)) continue;
    return { pct: v, text: `${v} %` };
  }
  // Wochenstunden
  const hours = /(\d{1,2}(?:[.,]\d{1,2})?)\s?(?:Std\.?|Stunden|Wochenstunden|h|hours)(?:\s*(?:\/|pro|je|per|in der|a)\s*(?:Woche|week)|\s+w[öo]chentlich|\s+per week|\b)/i.exec(text);
  if (hours) {
    const ctx = text.slice(Math.max(0, hours.index - 60), hours.index + hours[0].length + 40);
    if (/woche|w[öo]chentlich|week|arbeitszeit|teilzeit|vollzeit/i.test(ctx)) {
      const h = Number(hours[1].replace(',', '.'));
      if (h >= 5 && h <= 42) {
        const pct = Math.min(100, Math.round((h / 40) * 100));
        return { pct, text: `${String(h).replace('.', ',')} Std./Woche` };
      }
    }
  }
  if (/\bvollzeit|\bfull[- ]time\b|\bvollbesch[äa]ftig/i.test(`${title}\n${text}`)) {
    return { pct: 100, text: /teilzeit|part[- ]time/i.test(text) ? 'Vollzeit (Teilzeit möglich)' : 'Vollzeit' };
  }
  if (/\bteilzeit|\bpart[- ]time\b/i.test(`${title}\n${text}`)) return { pct: null, text: 'Teilzeit' };
  return { pct: null, text: null };
}

// ---------------------------------------------------------------- Befristung

const NUM_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einem: 1, einen: 1, one: 1,
  zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, fuenf: 5, fünf: 5, five: 5, sechs: 6, six: 6,
};

function extractTerm(text: string): { permanent: boolean | null; label: string | null } {
  const permanentRe = /\bunbefristet(?:e[nrsm]?)?\b|\bpermanent (?:position|contract|employment|post)\b|\bopen[- ]ended\b|\bauf Dauer\b|\bDauerstelle\b|\btenured\b/i;
  const fixedRe = /(?<!un)\bbefristet(?:e[nrsm]?)?\b|\bfixed[- ]term\b|\btemporary\b|\blimited (?:to|until|for)\b|WissZeitVG|Wissenschaftszeitvertragsgesetz|\bZeitvertrag\b|(?:Elternzeit|Mutterschutz|Krankheits)vertretung/i;
  const p = permanentRe.exec(text);
  const f = fixedRe.exec(text);
  if (p && (!f || p.index < f.index)) return { permanent: true, label: 'unbefristet' };
  if (!f) return { permanent: null, label: null };

  const window = text.slice(f.index, f.index + 220);
  const dur = /(?:f[üu]r|auf|zun[äa]chst|bis zu|von|for|up to|initially|of)?\s*(\d+(?:[.,]\d)?|ein(?:em|en|e)?|zwei|drei|vier|f[üu]nf|sechs|one|two|three|four|five|six)\s*(Jahre?n?|Monate?n?|years?|months?)\b/i.exec(window);
  if (dur) {
    const raw = dur[1].toLowerCase().replace('ü', 'ue');
    const n = /\d/.test(raw) ? Number(raw.replace(',', '.')) : (NUM_WORDS[raw] ?? NUM_WORDS[dur[1].toLowerCase()] ?? null);
    const unitYears = /^(jahr|year)/i.test(dur[2]);
    if (n) {
      const unit = unitYears ? (n === 1 ? 'Jahr' : 'Jahre') : n === 1 ? 'Monat' : 'Monate';
      return { permanent: false, label: `befristet, ${String(n).replace('.', ',')} ${unit}` };
    }
  }
  const until = /(?:bis|until)\s*(?:zum|zum Ende|the end of|end of)?\s*/i.exec(window);
  if (until) {
    const dates = findDates(window.slice(until.index, until.index + 60));
    if (dates.length) return { permanent: false, label: `befristet bis ${formatDateDe(dates[0].iso)}` };
  }
  return { permanent: false, label: 'befristet' };
}

// ---------------------------------------------------------------- Beginn

function extractStart(text: string): string | null {
  const phrase =
    /(?:zum|ab dem|ab|zu Beginn|Beginn:?|Einstellung(?:stermin|sdatum)?:?|Dienstantritt:?|Dienstbeginn:?|Arbeitsbeginn:?|Eintrittsdatum:?|Eintritt:?|Starttermin:?|Stellenantritt:?|Start(?:ing)? date:?|starting(?: on| from| in)?|to start(?: on| in)?|commencing(?: on)?)\s*(?:dem\s+|the\s+)?(n[äa]chstm[öo]glichen (?:Zeitpunkt|Termin)|fr[üu]hestm[öo]glichen (?:Zeitpunkt|Termin)|fr[üu]hestm[öo]glich|sofort|baldm[öo]glichst|as soon as possible|earliest possible date|\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}|\d{1,2}\.?\s+[A-ZÄÖÜa-zäöü]{3,9}\.?\s+\d{4}|(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|January|February|March|May|June|July|October|December)\s+\d{4}|(?:Winter|Sommer)semester\s+\d{4}(?:\/\d{2,4})?)/i;
  const m = phrase.exec(text);
  if (m) {
    const v = m[1].trim();
    if (/^n[äa]chstm|^fr[üu]hestm|^bald|^as soon|^earliest/i.test(v)) return 'zum nächstmöglichen Zeitpunkt';
    if (/^sofort/i.test(v)) return 'ab sofort';
    return v;
  }
  if (/\bab sofort\b/i.test(text)) return 'ab sofort';
  return null;
}

// ---------------------------------------------------------------- Kennziffer, Kontakt

/**
 * Taugt ein Wert als Kennziffer? Nicht: Web-Adressen (softgarden liefert die eigene Adresse als „identifier“),
 * eine bloße Jahreszahl, sehr kurze Kürzel wie „PS1“ oder Werte ohne Ziffer.
 */
export function plausibleReference(v: string | null | undefined): string | null {
  const t = v?.trim().replace(/[.,;:]+$/, '') ?? '';
  if (t.length < 4 || t.length > 40 || !/\d/.test(t)) return null;
  if (/:\/\/|^www\.|\.(?:de|com|io|org|net|eu)(?:\/|$)|@/i.test(t)) return null;
  if (/^(?:19|20)\d{2}$/.test(t)) return null;
  return t;
}

function extractReference(text: string): string | null {
  const re =
    /(?:Kennziffer|Kennzahl|Kenn-?Nr\.?|Kennnummer|Ausschreibungs-?(?:nummer|kennziffer|kennzahl|-?nr\.?)|Referenz(?:nummer|-?nr\.?)?|Ref\.?-?\s?Nr\.?|Reg\.?-?\s?Nr\.?|Registriernummer|Stellen-?(?:nummer|ID|kennziffer)|Job-?ID|Job-?Nr\.?|Ausschreibung\s+Nr\.?|reference(?: number| no\.?| code)?)\s*[:#.]?\s*([A-Za-z0-9][A-Za-z0-9\-\/_.]{0,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const token = plausibleReference(m[1]);
    if (token) return token;
  }
  return null;
}

function extractContact(text: string): string | null {
  const emails = [...text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)];
  if (emails.length === 0) return null;
  for (const e of emails) {
    const ctx = text.slice(Math.max(0, (e.index ?? 0) - 160), e.index ?? 0);
    if (/bewerb|apply|application|kontakt|contact|fragen|r[üu]ckfragen|questions|auskunft|inquir/i.test(ctx)) return e[0];
  }
  return emails[0][0];
}

// ---------------------------------------------------------------- Gesamt

export function extractFields(text: string, opts: ExtractOptions = {}): ExtractedFields {
  const today = opts.today ?? todayBerlin();
  const title = opts.title ?? '';
  const clean = text.replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
  const deadline = extractDeadline(clean, today, opts.reference ?? today);
  const pay = extractPay(clean, title);
  const work = extractWorkload(clean, title);
  const term = extractTerm(clean);
  return {
    deadline: deadline?.iso ?? null,
    deadlineText: deadline?.raw ?? null,
    deadlineYearInferred: !!deadline?.yearInferred && !!deadline.iso,
    deadlineUnclear: deadline && !deadline.iso ? deadline.raw : null,
    payGrade: pay?.grade ?? null,
    payLevel: pay?.level ?? null,
    workloadPct: work.pct,
    workloadText: work.text,
    isPermanent: term.permanent,
    fixedTerm: term.label,
    startText: extractStart(clean),
    referenceNo: extractReference(clean),
    contact: extractContact(clean),
  };
}

/** Kurzform für Karten: "E 13 TV-L · 65 % · befristet, 3 Jahre" – als Liste, das UI setzt Trenner. */
export function factList(f: {
  payGrade?: string | null;
  workloadPct?: number | null;
  workloadText?: string | null;
  fixedTerm?: string | null;
}): string[] {
  const out: string[] = [];
  if (f.payGrade) out.push(f.payGrade);
  if (f.workloadPct) out.push(`${f.workloadPct} %`);
  else if (f.workloadText) out.push(f.workloadText);
  if (f.fixedTerm) out.push(f.fixedTerm);
  return out;
}
