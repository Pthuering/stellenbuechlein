// Text aus PDF-Ausschreibungen holen (viele Hochschulen veröffentlichen nur PDFs).

import { extractText, getDocumentProxy } from 'unpdf';

export async function pdfToText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  try {
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    return pages.join('\n\n');
  } finally {
    // Sonst behält pdf.js Dokument und Schriften bis zum Ende des Laufs
    await pdf.loadingTask.destroy().catch(() => undefined);
  }
}

/** Bereinigt PDF-Text zu lesbarem Markdown: Silbentrennung, Aufzählungen, Absätze. */
export function pdfTextToMarkdown(raw: string): string {
  const lines = raw
    .replace(/\r/g, '')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2') // Silbentrennung am Zeilenende
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim());
  const out: string[] = [];
  let para = '';
  const flush = () => {
    if (para) out.push(para);
    para = '';
  };
  for (const l of lines) {
    if (!l) {
      flush();
      continue;
    }
    if (/^(?:[•●▪■◦\-–*]|\d+[.)]|[a-z][.)])\s+/.test(l)) {
      flush();
      out.push(`- ${l.replace(/^(?:[•●▪■◦\-–*]|\d+[.)]|[a-z][.)])\s+/, '')}`);
      continue;
    }
    // Kurze Zeilen ohne Satzende, die wie Überschriften aussehen
    if (l.length < 60 && /[:]$|^[A-ZÄÖÜ][\p{L} &/-]{2,40}$/u.test(l) && !/[.,;]$/.test(l) && para === '') {
      out.push(`**${l.replace(/:$/, '')}**`);
      continue;
    }
    if (out.length && out[out.length - 1].startsWith('- ') && !para && /^\p{Ll}/u.test(l)) {
      out[out.length - 1] += ` ${l}`; // Fortsetzung eines Aufzählungspunkts
      continue;
    }
    para = para ? `${para} ${l}` : l;
    if (/[.!?:]$/.test(l) && para.length > 200) flush();
  }
  flush();
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Titel aus PDF-Text raten: Zeile mit (m/w/d), Stellenbezeichnung o. Ä. */
export function guessPdfTitle(text: string): string | null {
  const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 60);
  const strong = lines.find((l) => /\((?:[mwdfx]\s*\/\s*){1,3}[mwdfx]\)/i.test(l) && l.length < 220);
  if (strong) return strong;
  const role = lines.find((l) =>
    /wissenschaftliche|mitarbeiter|doktorand|promotion|postdoc|professur|referent|koordinat|hilfskraft|phd|research (?:associate|assistant|fellow)/i.test(l) && l.length < 220,
  );
  return role ?? null;
}
