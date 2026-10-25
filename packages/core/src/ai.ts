// KI-Aufgaben, die sowohl der Worker (sofort in der App) als auch die Pipeline nutzen können.
// Hier stehen nur Anweisungen und Antwortformat; der Aufruf selbst (OpenAI-kompatibel) liegt beim Nutzer.

import { z } from 'zod';
import { profileSummary } from './horizont';
import { horizontOf, newItemId, type Bruecke, type Suchprofil } from './profile';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Die App nutzt immer das große Modell, nie Flash. */
export const DEFAULT_LLM_MODEL = 'deepseek-v4-pro';

/**
 * Ersetzt Flash-Modelle und die alten Namen deepseek-chat und deepseek-reasoner (zeigen seit Juli 2026
 * auf Flash) durch das große Modell. Modelle anderer Anbieter bleiben, wie sie sind.
 */
export function bigModel(model: string | null | undefined): string {
  const m = (model ?? '').trim();
  return !m || /flash|^deepseek-(chat|reasoner)$/i.test(m) ? DEFAULT_LLM_MODEL : m;
}

/**
 * Bei DeepSeek ist der Denkmodus standardmäßig an. Für kurze, strukturierte Aufgaben wird er abgeschaltet;
 * andere OpenAI-kompatible Dienste bekommen den Parameter nicht (sie lehnen unbekannte Felder ab).
 */
export function withoutThinking(baseUrl: string): { thinking?: { type: 'disabled' } } {
  return /deepseek\.com/i.test(baseUrl) ? { thinking: { type: 'disabled' } } : {};
}

/** Suchbegriffe: Liste oder Text mit Kommas, zu kurze und zu lange fallen weg. */
const terms = (max: number) =>
  z
    .preprocess((v) => (typeof v === 'string' ? [v] : (v ?? [])), z.array(z.string()))
    .transform((a) => [...new Set(a.flatMap((t) => t.split(/[,;\n]/)).map((t) => t.trim()).filter((t) => t.length >= 2 && t.length <= 60))].slice(0, max));

const BridgeItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .transform((s) => s.slice(0, 60)),
  feld: terms(14).refine((a) => a.length >= 2, 'weniger als zwei Suchbegriffe'),
  anker: terms(14),
  suche: terms(4),
  warum: z
    .string()
    .nullish()
    .transform((s) => {
      const t = (s ?? '').trim();
      return t.length > 300 ? `${t.slice(0, 299).trimEnd()}…` : t;
    }),
});

export type BridgeSuggestion = z.infer<typeof BridgeItemSchema>;

/**
 * Liest die Brücken aus der KI-Antwort. Eine unbrauchbare Brücke fällt einzeln weg, statt die ganze
 * Antwort zu verwerfen; was wegfiel, steht in problems.
 */
export function parseBridgeSuggestions(raw: unknown): { bruecken: BridgeSuggestion[]; problems: string[] } {
  // Die KI schreibt den Schlüssel gern mit Umlaut („brücken“) oder schickt die Liste ohne Hülle.
  let list: unknown = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const entries = Object.entries(raw);
    list = (entries.find(([k]) => /^br(ue|ü)cken?$/i.test(k)) ?? (entries.length === 1 ? entries[0] : undefined))?.[1];
    if (!Array.isArray(list)) return { bruecken: [], problems: [`kein Feld "bruecken" (gefunden: ${entries.map(([k]) => k).join(', ') || 'nichts'})`] };
  }
  if (!Array.isArray(list)) return { bruecken: [], problems: ['kein Feld "bruecken"'] };
  const bruecken: BridgeSuggestion[] = [];
  const problems: string[] = [];
  list.forEach((item, i) => {
    const r = BridgeItemSchema.safeParse(item);
    if (r.success) bruecken.push(r.data);
    else {
      const keys = item && typeof item === 'object' ? ` (${Object.keys(item).join(', ')})` : '';
      problems.push(`Brücke ${i + 1}${keys}: ${r.error.issues.map((x) => `${x.path.join('.') || 'Eintrag'} ${x.message}`).join(', ')}`);
    }
  });
  return { bruecken: bruecken.slice(0, 8), problems };
}

/** Anweisungen für Brücken-Vorschläge aus Profil und Interessen. */
export function bridgeSuggestionMessages(p: Suchprofil): AiMessage[] {
  const existing = horizontOf(p).bruecken.map((b) => b.name);
  return [
    {
      role: 'system',
      content:
        'Du schlägst Brücken für eine Jobsuche vor. Die Person kommt aus der Psychologie und sucht vor allem Forschungsstellen, möchte aber auch Stellen außerhalb ihres Kernbereichs sehen, ' +
        'auf die sie sich realistisch bewerben könnte – in der Forschung oder außerhalb. Eine Brücke verbindet ein anderes Fachgebiet (feld) mit dem, was die Person mitbringt (anker). ' +
        'Schlage 3 bis 6 neue Brücken vor, die sich von den vorhandenen unterscheiden. Sei mutig und offen, aber plausibel: Ihr Wissen über Menschen, Verhalten, Lernen, Gesundheit oder ihre Methoden muss dort gebraucht werden. ' +
        'Keine Felder, die eine ganz andere Ausbildung voraussetzen. ' +
        'feld: 4 bis 10 deutsche oder englische Suchbegriffe für das Feld (Wortanfänge reichen, kleingeschrieben, keine Allerweltswörter wie "Weiterbildung" oder "Datenschutz", die in jeder Anzeige stehen). ' +
        'anker: leer lassen, außer es gibt sehr typische Anknüpfungsbegriffe für genau dieses Feld. suche: 2 bis 3 kurze Suchanfragen für Jobbörsen. warum: ein Satz, warum das zur Person passt. ' +
        'Antworte nur mit JSON in genau diesem Format, die Schlüssel ohne Umlaute: ' +
        '{"bruecken": [{"name": "…", "feld": ["begriff", "begriff", "begriff", "begriff"], "anker": [], "suche": ["suchanfrage", "suchanfrage"], "warum": "…"}]}',
    },
    { role: 'user', content: `Profil:\n${profileSummary(p)}\n\nVorhandene Brücken: ${existing.join(', ') || 'keine'}` },
  ];
}

/** Macht aus der KI-Antwort Brücken (zunächst nur als Vorschlag, nicht aktiv im Profil). */
export function toSuggestedBridges(suggestions: BridgeSuggestion[], p: Suchprofil): Bruecke[] {
  const have = new Set(horizontOf(p).bruecken.map((b) => b.name.toLowerCase()));
  return suggestions
    .filter((b) => !have.has(b.name.toLowerCase()))
    .map((b) => ({
      id: newItemId('h'),
      name: b.name,
      feld: [...new Set(b.feld.map((t) => t.trim().toLowerCase()))],
      anker: [...new Set(b.anker.map((t) => t.trim().toLowerCase()))],
      suche: b.suche,
      warum: b.warum,
      aktiv: true,
      herkunft: 'ki' as const,
    }));
}
