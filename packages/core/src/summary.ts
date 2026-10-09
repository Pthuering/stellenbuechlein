// Kurzfassung für die Swipe-Karte, ohne KI: Aufgaben-Abschnitt bevorzugt, sonst erster Inhaltsabsatz.

import { stripMarkdown, truncate } from './text';

const TASK_HEADING =
  /^(?:#{1,6}\s*)?(?:\*\*)?\s*(?:ihre|deine|die|unsere|zu ihren)?\s*(?:aufgaben(?:gebiet|bereich|schwerpunkte)?|t[äa]tigkeit(?:en|sbereich|sfeld)?|arbeitsgebiet|das erwartet (?:sie|dich)|was sie erwartet|projektbeschreibung|zum projekt|das projekt|ihr aufgabengebiet|your (?:tasks|responsibilities|role|duties)|what you will do|job description|the project|about the project|position description|role)\b.*$/i;

const BOILERPLATE =
  /ist eine der|geh[öo]rt zu den|gr[üu]ndung|gegr[üu]ndet|exzellenz|studierende|besch[äa]ftigte|mitarbeitende(?:n)? in|traditionsreich|one of the (?:largest|leading|oldest)|founded in|employees|students|familiengerecht|chancengleichheit|schwerbehindert|bewerbungen von frauen|equal opportunit|datenschutz|privacy/i;

export function heuristicSummary(md: string, maxLen = 280): string | null {
  if (!md) return null;
  const lines = md.split('\n').map((l) => l.trim());
  // 1) Aufgaben-Abschnitt
  for (let i = 0; i < lines.length; i++) {
    if (!TASK_HEADING.test(lines[i]) || lines[i].length > 90) continue;
    const bullets: string[] = [];
    let para = '';
    for (let j = i + 1; j < Math.min(lines.length, i + 25); j++) {
      const l = lines[j];
      if (!l) {
        if (bullets.length || para) break;
        continue;
      }
      if (/^#{1,6}\s/.test(l) || (/^\*\*[^*]+\*\*:?$/.test(l) && (bullets.length || para))) break;
      if (/^[-*+•]\s+/.test(l) || /^\d+[.)]\s+/.test(l)) {
        bullets.push(stripMarkdown(l.replace(/^[-*+•]\s+|^\d+[.)]\s+/, '')));
        if (bullets.length >= 3) break;
      } else if (!bullets.length) {
        para += (para ? ' ' : '') + stripMarkdown(l);
        if (para.length > maxLen) break;
      }
    }
    const text = bullets.length ? bullets.join('; ') : para;
    if (text.length >= 40) return truncate(text, maxLen);
  }
  // 2) Erster inhaltlicher Absatz
  const paras = md.split(/\n\s*\n/).map((p) => stripMarkdown(p).replace(/\s+/g, ' ').trim());
  for (const p of paras) {
    if (p.length < 80 || BOILERPLATE.test(p)) continue;
    return truncate(p, maxLen);
  }
  const first = paras.find((p) => p.length >= 40);
  return first ? truncate(first, maxLen) : null;
}
