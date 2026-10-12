// KI-Aufgaben, die sowohl der Worker (sofort in der App) als auch die Pipeline nutzen können.
// Hier stehen nur Anweisungen und Antwortformat; der Aufruf selbst (OpenAI-kompatibel) liegt beim Nutzer.

import { z } from 'zod';
import { profileSummary } from './horizont';
import { horizontOf, newItemId, type Bruecke, type Suchprofil } from './profile';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const BridgeSuggestionSchema = z.object({
  bruecken: z
    .array(
      z.object({
        name: z.string().min(2).max(60),
        feld: z.array(z.string().min(2).max(60)).min(2).max(14),
        anker: z.array(z.string().min(2).max(60)).max(14).default([]),
        suche: z.array(z.string().min(2).max(60)).max(4).default([]),
        warum: z.string().max(300),
      }),
    )
    .max(8),
});

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
        'Antworte nur mit JSON {"bruecken": [{"name", "feld", "anker", "suche", "warum"}]}.',
    },
    { role: 'user', content: `Profil:\n${profileSummary(p)}\n\nVorhandene Brücken: ${existing.join(', ') || 'keine'}` },
  ];
}

/** Macht aus der KI-Antwort Brücken (zunächst nur als Vorschlag, nicht aktiv im Profil). */
export function toSuggestedBridges(raw: z.infer<typeof BridgeSuggestionSchema>, p: Suchprofil): Bruecke[] {
  const have = new Set(horizontOf(p).bruecken.map((b) => b.name.toLowerCase()));
  return raw.bruecken
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
