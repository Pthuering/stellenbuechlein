// Eine einzelne Anzeige vollständig einlesen: HTML (JSON-LD, Hauptinhalt) und/oder PDF.

import {
  absolutize,
  extractLinks,
  htmlToMarkdown,
  isLogoUrl,
  jobPostingsFrom,
  load,
  looksLikeJsShell,
  mainContent,
  pageImage,
  pageTitle,
} from './html';
import { guessPdfTitle, pdfTextToMarkdown, pdfToText } from './pdf';
import type { Http } from './http';

export interface PostingData {
  url: string;
  title: string;
  descriptionMd: string;
  department?: string | null;
  locationText?: string | null;
  lat?: number | null;
  lon?: number | null;
  postedAt?: string | null;
  validThrough?: string | null;
  hiringOrg?: string | null;
  hiringOrgUrl?: string | null;
  country?: string | null;
  imageUrl?: string | null;
  pdfUrl?: string | null;
  referenceNo?: string | null;
  method: string;
  complete: boolean;
  incompleteReason?: string | null;
  aiSummary?: string | null;
}

export interface Candidate {
  url: string;
  title?: string | null;
  via: string;
  /** Vollständige Daten (z. B. aus Feed/ATS) – dann ist kein Abruf der Detailseite nötig. */
  prefilled?: PostingData;
  hints?: {
    locality?: string | null;
    org?: string | null;
    orgUrl?: string | null;
    postedAt?: string | null;
    lat?: number | null;
    lon?: number | null;
    country?: string | null;
    /** Referenznummer bei der Bundesagentur (für den Text-Fallback). */
    baRef?: string | null;
    /** Suchbegriff, über den die Erkundung die Anzeige fand. */
    query?: string | null;
  };
}

const SECTION_TASKS = /aufgaben|t[äa]tigkeit|arbeitsgebiet|das erwartet|ihre rolle|your (?:tasks|responsibilities|role)|responsibilities|duties|what you will do|projekt|the project|job description/i;
const SECTION_PROFILE = /profil|anforderung|voraussetzung|qualifikation|erwarte[nt]|wir w[üu]nschen|sie bringen|mitbringen|einstellungsvoraussetzung|requirements|qualifications|your profile|we expect|you have|you bring/i;
const SECTION_APPLY = /bewerb|apply|application|ansprechpart|kontakt|contact|unterlagen|frist|deadline/i;

export function assessCompleteness(md: string): { complete: boolean; reason: string | null } {
  const text = md.trim();
  const len = text.length;
  if (len < 250) return { complete: false, reason: 'Sehr kurzer Text' };
  if (/(?:mehr anzeigen|weiterlesen|read more|show more|mehr erfahren|…|\.\.\.)\s*$/i.test(text) && len < 2500) {
    return { complete: false, reason: 'Text bricht ab („mehr anzeigen“)' };
  }
  if (/javascript (?:aktivieren|enable|required|is disabled)|bitte stimmen sie|cookies? (?:akzeptieren|zustimmen)|consent/i.test(text) && len < 1200) {
    return { complete: false, reason: 'Cookie- oder JavaScript-Hinweis statt Anzeige' };
  }
  const sections = [SECTION_TASKS, SECTION_PROFILE, SECTION_APPLY].filter((re) => re.test(text)).length;
  if (sections === 3 && len >= 300) return { complete: true, reason: null };
  if (sections >= 2 && len >= 500) return { complete: true, reason: null };
  if (len >= 1500) return { complete: true, reason: null };
  return { complete: false, reason: 'Aufgaben, Profil oder Bewerbungshinweise nicht erkennbar' };
}

const POSTING_PDF_HINT = /ausschreib|stelle|job|posting|vacanc|kennziffer|kennzahl|position|wiss|promotion|doktorand|postdoc|professur|m-w-d|w-m-d|mwd|stellenangebot/i;
const NON_POSTING_PDF = /datenschutz|privacy|impressum|satzung|ordnung|formular|merkblatt|leitfaden|brosch|flyer|antrag|richtlinie|hinweise[-_ ]?zur|gleichstellung|familie|agb|verordnung/i;

/** Text einer PDF-Datei als Markdown (oder null). */
export async function readPdf(http: Http, url: string, ignoreRobots = false): Promise<{ markdown: string; raw: string } | null> {
  const r = await http.get(url, { accept: 'application/pdf,*/*;q=0.5', ignoreRobots });
  if (!r.ok || !r.isPdf) return null;
  try {
    const raw = await pdfToText(r.body);
    if (raw.replace(/\s+/g, '').length < 80) return null; // gescanntes PDF ohne Text
    return { markdown: pdfTextToMarkdown(raw), raw };
  } catch {
    return null;
  }
}

/** Liest Felder aus bereits geladenem HTML (statisch oder vom Browser gerendert). */
export function fromHtml(html: string, url: string): { data: PostingData; pdfLinks: string[]; listLike: boolean; jsShell: boolean } {
  const $ = load(html);
  const ld = jobPostingsFrom($)[0];
  const main = mainContent(html, url);
  let description = main.markdown;
  let method = 'html';
  if (ld?.descriptionHtml) {
    const ldMd = /<[a-z][\s\S]*>/i.test(ld.descriptionHtml) ? htmlToMarkdown(ld.descriptionHtml) : ld.descriptionHtml.trim();
    if (ldMd.length >= 400 && main.markdown.length < ldMd.length * 1.6) {
      description = ldMd;
      method = 'jsonld';
    } else if (ldMd.length > main.markdown.length) {
      description = ldMd;
      method = 'jsonld';
    }
  }
  const links = extractLinks($, url);
  const pdfLinks = links
    .filter((l) => /\.pdf(?:$|\?)/i.test(l.url) && l.inMain && !NON_POSTING_PDF.test(`${l.text} ${l.url}`))
    .sort((a, b) => Number(POSTING_PDF_HINT.test(`${b.text} ${b.url}`)) - Number(POSTING_PDF_HINT.test(`${a.text} ${a.url}`)))
    .map((l) => l.url);
  const jobishLinks = links.filter(
    (l) => l.inMain && /\((?:[mwdfx]\s*\/\s*){1,3}[mwdfx]\)|wissenschaftliche|doktorand|postdoc|professur|stellenausschreibung/i.test(l.text),
  ).length;
  const listLike = jobishLinks >= 4 && !(SECTION_TASKS.test(description) && SECTION_PROFILE.test(description));
  const ldImage = ld?.image ? absolutize(ld.image, url) : null;
  const imageUrl = ldImage && !isLogoUrl(ldImage) ? ldImage : pageImage($, url);
  const title = ld?.title ?? pageTitle($) ?? main.title ?? '';
  const completeness = assessCompleteness(description);
  return {
    data: {
      url,
      title: title.replace(/\s+/g, ' ').trim(),
      descriptionMd: description,
      locationText: ld?.locality ?? null,
      lat: ld?.lat ?? null,
      lon: ld?.lon ?? null,
      postedAt: ld?.datePosted ?? null,
      validThrough: ld?.validThrough ?? null,
      hiringOrg: ld?.hiringOrganization ?? null,
      hiringOrgUrl: ld?.hiringOrganizationUrl ?? null,
      country: ld?.country ?? null,
      imageUrl,
      referenceNo: ld?.identifier ?? null,
      method,
      complete: completeness.complete,
      incompleteReason: completeness.reason,
    },
    pdfLinks: [...new Set(pdfLinks)].slice(0, 3),
    listLike,
    jsShell: looksLikeJsShell(html),
  };
}

export interface ExtractResult {
  data: PostingData | null;
  status: number;
  error?: string;
  blockedByRobots?: boolean;
  /** Seite ist eher eine Liste als eine Anzeige. */
  notAPosting?: boolean;
  /** Seite braucht vermutlich einen Browser (JavaScript, Cookie-Sperre). */
  needsBrowser?: boolean;
}

/** Ruft eine Anzeige ab (HTML oder PDF) und liefert möglichst vollständigen Text. */
const GENERIC_TITLE = /^(?:job ?offers?|jobs?|vacanc(?:y|ies)|stellenangebote?|stellenanzeigen?|stellenausschreibung(?:en)?|jobangebote?|karriere|careers?|details?)$/i;

export async function extractPosting(http: Http, url: string, opts: { titleHint?: string | null; ignoreRobots?: boolean } = {}): Promise<ExtractResult> {
  const r = await http.get(url, { ignoreRobots: opts.ignoreRobots });
  if (!r.ok) return { data: null, status: r.status, error: r.error, blockedByRobots: r.blockedByRobots, needsBrowser: r.status === 403 };

  if (r.isPdf) {
    try {
      const raw = await pdfToText(r.body);
      if (raw.replace(/\s+/g, '').length < 80) {
        return { data: null, status: r.status, error: 'PDF ohne Text (gescannt?)', needsBrowser: false };
      }
      const markdown = pdfTextToMarkdown(raw);
      const title = guessPdfTitle(raw) ?? opts.titleHint ?? '';
      const c = assessCompleteness(markdown);
      return {
        status: r.status,
        data: { url: r.url, title, descriptionMd: markdown, pdfUrl: r.url, method: 'pdf', complete: c.complete || markdown.length > 800, incompleteReason: c.reason },
      };
    } catch (e) {
      return { data: null, status: r.status, error: `PDF nicht lesbar: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const { data, pdfLinks, listLike, jsShell } = fromHtml(r.text, r.url);
  if (listLike && !data.complete) return { data: null, status: r.status, notAPosting: true };
  // Allgemeine Überschriften („Job offer“, „Stellenangebot“) durch den Titel aus der Liste ersetzen
  if ((!data.title || GENERIC_TITLE.test(data.title.trim())) && opts.titleHint) data.title = opts.titleHint;

  // Kurzer Text, aber PDF verlinkt → PDF anhängen ("nichts auslassen").
  const mentionsPdf = /pdf|ausschreibung als|download|herunterladen/i.test(data.descriptionMd);
  if (pdfLinks.length && (!data.complete || data.descriptionMd.length < 1500 || mentionsPdf)) {
    const pdf = await readPdf(http, pdfLinks[0], opts.ignoreRobots);
    if (pdf && pdf.markdown.length > 200) {
      const already = data.descriptionMd.length > 400 && pdf.markdown.slice(0, 200).split(' ').every((w) => data.descriptionMd.includes(w));
      if (!already) {
        data.descriptionMd = data.descriptionMd.length > 120
          ? `${data.descriptionMd}\n\n---\n\n**Ausschreibung (PDF)**\n\n${pdf.markdown}`
          : pdf.markdown;
      }
      data.pdfUrl = pdfLinks[0];
      if (!data.title || /^(stellenangebot|stellenausschreibung|jobs?|karriere)/i.test(data.title)) data.title = guessPdfTitle(pdf.raw) ?? data.title;
      const c = assessCompleteness(data.descriptionMd);
      data.complete = c.complete;
      data.incompleteReason = c.reason;
      data.method = `${data.method}+pdf`;
    }
  }
  return { data, status: r.status, needsBrowser: !data.complete && (jsShell || data.descriptionMd.length < 600) };
}
