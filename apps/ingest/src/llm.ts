// KI-Anbindung über eine OpenAI-kompatible Schnittstelle (Standard: DeepSeek).
// Wird nur gebraucht, wenn die Regeln nicht reichen: Titel/Frist fehlen, Liste unklar,
// Browser-Agent braucht eine Entscheidung, Kurzfassung für die Karte.

import { z } from 'zod';
import { INSTITUTION_KINDS, llmCostUsd, withoutThinking, type LlmUsage } from '@stellen/core';
import type { IngestConfig } from './config';
import type { RunLog } from './log';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Die KI weicht gern im Detail ab (Feld fehlt, Zahl als Text, Wert außerhalb der Liste). Nebenfelder
// werden dann null, statt die ganze Antwort zu verwerfen; nur die tragenden Felder bleiben streng.
const optText = z.string().nullable().catch(null);
const toNum = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v);
const optNum = z.preprocess(toNum, z.number().nullable()).catch(null);
const optInt = z.preprocess(toNum, z.number().int().nullable()).catch(null);

// ---------------------------------------------------------------- Anweisungen und Antwortformate
// Dieselben für die KI im Lauf und für Claude (KI-Warteschlange, aiTasks.ts), damit beide gleich urteilen.

export const EXTRACT_SCHEMA = z.object({
  is_job_posting: z.boolean(),
  title: optText,
  institution: optText,
  department: optText,
  location: optText,
  deadline: optText,
  pay_grade: optText,
  workload_pct: optNum,
  fixed_term: optText,
  start: optText,
  summary_de: optText,
});

export const EXTRACT_PROMPT =
  'Du liest Stellenausschreibungen deutscher Hochschulen und Forschungsinstitute. Antworte ausschließlich mit JSON. ' +
  'Erfinde nichts: Was nicht im Text steht, ist null. Datumsangaben als YYYY-MM-DD. ' +
  'summary_de: 2 kurze Sätze auf Deutsch, was die Stelle inhaltlich ist (Thema, Aufgaben), ohne Floskeln.';

export const EXTRACT_FIELDS =
  'is_job_posting, title (Stellenbezeichnung wie in der Anzeige), institution, department, location (Ort), ' +
  'deadline (Bewerbungsfrist), pay_grade (z. B. "E 13 TV-L"), ' +
  'workload_pct (Zahl, Prozent einer Vollzeitstelle; steht nur die Wochenstundenzahl da, umrechnen: Vollzeit sind im TV-L 39,8 Stunden, im TVöD 39, sonst 40), ' +
  'fixed_term (z. B. "befristet, 3 Jahre"), start (Beginn als kurzer Text wie in der Anzeige, z. B. "zum nächstmöglichen Zeitpunkt" oder "01.04.2027"; kein Datumsformat nötig), summary_de.';

export const DEADLINE_SCHEMA = z.object({
  deadline: optText,
  quote: optText,
  still_open: z.boolean().nullable().catch(null),
});

export function deadlinePrompt(today: string): string {
  return (
    `Du prüfst die Bewerbungsfrist einer Stellenausschreibung. Heute ist der ${today}. Antworte nur mit JSON {"deadline": "YYYY-MM-DD"|null, "quote": "…"|null, "still_open": bool|null}. ` +
    'deadline ist das Datum, bis zu dem Bewerbungen eingehen müssen. Wurde die Frist verlängert, gilt die neue. Steht im Text kein Jahr, ergänze das Jahr, das zur Anzeige passt. ' +
    'Ein Vertragsende, Eintrittsdatum, Beginn oder Veröffentlichungsdatum ist keine Frist. quote ist die Textstelle mit der Frist, wörtlich kopiert (höchstens 160 Zeichen). ' +
    'Steht keine Frist im Text, sind deadline und quote null. still_open: ist die Bewerbung laut Text heute noch möglich?'
  );
}

export const HORIZON_SCHEMA = z.object({
  verdict: z.enum(['passt', 'eher', 'nein']),
  reason_de: z.string().catch(''),
  label: optText,
});

export const HORIZON_PROMPT =
  'Du hilfst einer Person mit Psychologie-Hintergrund, Stellen außerhalb ihres engeren Suchbereichs zu entdecken, auf die sie sich trotzdem realistisch bewerben könnte. ' +
  'Sei offen: Auch Stellen außerhalb der Forschung und außerhalb der Psychologie zählen, wenn ihr Wissen über Menschen, Verhalten, Lernen oder Gesundheit oder ihre Methoden dort gebraucht werden. ' +
  'Nicht passend sind Stellen, für die eine ganz andere Ausbildung nötig ist (zum Beispiel Hotelfach, Handwerk, Pflegefachkraft, Steuerrecht, Elektrotechnik) oder in denen nichts von ihrem Wissen gebraucht wird. ' +
  'verdict: "passt" (gute Chancen, inhaltlich naheliegend), "eher" (möglich, mit Lücken), "nein" (fremd). ' +
  'reason_de: ein konkreter Satz auf Deutsch, warum die Stelle passen könnte (bei "nein": warum nicht), mit Bezug auf die Anzeige und das Profil, ohne Floskeln. ' +
  'label: 2 bis 4 Wörter für die Verbindung, z. B. "IT-Sicherheit × Verhalten". Antworte nur mit JSON.';

/** So viele unbrauchbare Antworten stehen einzeln im Protokoll, danach wird nur gezählt. */
const MAX_LOGGED_FAILURES = 10;

export class Llm {
  calls = 0;
  failures = 0;
  /** Kosten aller Aufrufe dieses Laufs in US-Dollar (landet in der Laufstatistik). */
  costUsd = 0;
  /** Schlüssel ungültig oder Guthaben leer: dann für den Rest des Laufs nicht mehr fragen. */
  private disabled = false;

  constructor(
    private readonly cfg: IngestConfig['llm'],
    private readonly log: RunLog,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get available(): boolean {
    return !!this.cfg.apiKey && !this.disabled && this.calls < this.cfg.maxCalls;
  }

  private fail(msg: string): null {
    this.failures++;
    if (this.failures <= MAX_LOGGED_FAILURES) this.log.warn(`KI: ${msg}`);
    else if (this.failures === MAX_LOGGED_FAILURES + 1) this.log.warn('KI: weitere Fehler werden nur noch gezählt.');
    return null;
  }

  /** Fragt JSON ab und prüft es gegen ein Schema. Gibt null zurück, wenn etwas schiefgeht. */
  async json<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, messages: ChatMessage[], maxTokens = 1200): Promise<T | null> {
    if (!this.available) return null;
    this.calls++;
    try {
      const res = await this.fetchImpl(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.cfg.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.cfg.model,
          ...withoutThinking(this.cfg.baseUrl),
          messages,
          temperature: 0,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 402 || res.status === 403) {
          this.disabled = true;
          this.log.error(`KI abgeschaltet für diesen Lauf (${res.status}): Schlüssel ungültig oder Guthaben aufgebraucht.`);
          this.failures++;
          return null;
        }
        return this.fail(`Anfrage fehlgeschlagen (${res.status})`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: LlmUsage };
      this.costUsd += llmCostUsd(data.usage, this.cfg.model);
      const choice = data.choices?.[0];
      if (choice?.finish_reason === 'length') return this.fail(`Antwort nach ${maxTokens} Tokens abgeschnitten`);
      const parsed = schema.safeParse(JSON.parse((choice?.message?.content ?? '').replace(/^```(?:json)?\s*|```\s*$/g, '')));
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'Antwort'}: ${i.message}`);
        return this.fail(`Antwort passt nicht zum Format (${issues.join('; ')})`);
      }
      return parsed.data;
    } catch (e) {
      return this.fail(`Anfrage fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ---------------------------------------------------------------- Aufgaben

  /** Strukturierte Felder + Kurzfassung aus dem Anzeigentext. */
  extractPosting(text: string, url: string) {
    return this.json(EXTRACT_SCHEMA, [
      { role: 'system', content: EXTRACT_PROMPT },
      { role: 'user', content: `URL: ${url}\n\nFelder: ${EXTRACT_FIELDS}\n\nText:\n${text.slice(0, 14_000)}` },
    ]);
  }

  /** Welche Links einer Listenseite führen zu einzelnen Anzeigen? */
  pickPostingLinks(pageText: string, links: { i: number; text: string; url: string }[]) {
    const schema = z.object({ posting_links: z.array(z.preprocess(toNum, z.number().int())), no_jobs_listed: z.boolean().catch(false) });
    const list = links
      .slice(0, 250)
      .map((l) => `[${l.i}] ${l.text.slice(0, 120)} -> ${l.url}`)
      .join('\n');
    return this.json(schema, [
      {
        role: 'system',
        content:
          'Du bekommst eine Seite mit offenen Stellen (Text + nummerierte Links). Nenne die Nummern der Links, die jeweils zu EINER einzelnen Stellenausschreibung führen (Detailseite oder PDF). ' +
          'Keine Navigations-, Filter-, Kategorie- oder Infolinks. Antworte nur mit JSON {"posting_links": [...], "no_jobs_listed": bool}.',
      },
      { role: 'user', content: `Seitentext (gekürzt):\n${pageText.slice(0, 6000)}\n\nLinks:\n${list}` },
    ]);
  }

  /** Ein Schritt des Browser-Agenten. */
  agentStep(goal: string, pageText: string, elements: { i: number; label: string }[], history: string[]) {
    const schema = z.object({
      action: z.enum(['click', 'done', 'give_up']),
      index: optInt,
      reason: z.string().catch(''),
    });
    return this.json(
      schema,
      [
        {
          role: 'system',
          content:
            'Du steuerst einen Browser, um eine Stellenausschreibung VOLLSTÄNDIG lesbar zu machen (Aufgaben, Profil, Bewerbung, Frist). ' +
            'Mögliche Aktionen: "click" auf ein nummeriertes Element (z. B. Cookie-Hinweis schließen, "mehr anzeigen", Link zur eigentlichen Anzeige oder zum PDF), ' +
            '"done" wenn der vollständige Text sichtbar ist, "give_up" wenn es keine Anzeige gibt. Klicke nie auf Bewerben, Login, Absenden oder Teilen. Antworte nur mit JSON.',
        },
        {
          role: 'user',
          content:
            `Ziel: ${goal}\nBisher: ${history.join(' | ') || '–'}\n\nSichtbarer Text (gekürzt):\n${pageText.slice(0, 5000)}\n\n` +
            `Klickbare Elemente:\n${elements.map((e) => `[${e.i}] ${e.label}`).join('\n').slice(0, 5000)}`,
        },
      ],
      300,
    );
  }

  /**
   * Bewerbungsfrist nachprüfen, wenn die Regeln etwas Unplausibles gefunden haben.
   * Das Zitat wird danach gegen den Text geprüft (verifyDeadlineQuote), damit nichts erfunden ist.
   */
  checkDeadline(text: string, today: string, found: string | null) {
    return this.json(
      DEADLINE_SCHEMA,
      [
        { role: 'system', content: deadlinePrompt(today) },
        { role: 'user', content: `Bisher erkannt: ${found ?? 'keine Frist'}\n\nText der Anzeige:\n${text.slice(0, 12_000)}` },
      ],
      300,
    );
  }

  /**
   * Horizont und Weite: Könnte die Person sich hier realistisch bewerben, auch wenn die Stelle
   * außerhalb ihres Kernbereichs liegt? Offen urteilen, aber völlig Fremdes ausschließen.
   */
  horizonVerdict(profile: string, posting: { title: string; org: string | null; text: string }, bridge: { name: string; warum?: string | null } | null) {
    return this.json(
      HORIZON_SCHEMA,
      [
        { role: 'system', content: HORIZON_PROMPT },
        {
          role: 'user',
          content:
            `Profil:\n${profile}\n\n${bridge ? `Brücke: ${bridge.name}${bridge.warum ? ` (${bridge.warum})` : ''}\n\n` : ''}` +
            `Anzeige: ${posting.title}${posting.org ? `, ${posting.org}` : ''}\n${posting.text.slice(0, 6000)}`,
        },
      ],
      400,
    );
  }

  /** Probelauf einer neuen Quelle: Ist das eine Stellenliste, wer schreibt aus, was ist zu beachten? */
  reviewSource(input: {
    url: string;
    pageTitle: string;
    pageText: string;
    links: { i: number; text: string; url: string }[];
    samples: { i: number; title: string; url: string; text: string; fields: string }[];
  }) {
    const schema = z.object({
      is_job_list: z.boolean(),
      institution_name: optText,
      city: optText,
      institution_type: z.enum(INSTITUTION_KINDS).nullable().catch(null),
      is_department_page: z.boolean().catch(false),
      sample_checks: z
        .array(z.object({ index: z.preprocess(toNum, z.number().int()), is_posting: z.boolean(), problems: z.array(z.string()).catch([]) }))
        .catch([]),
      link_pattern: optText,
      needs_browser: z.boolean().catch(false),
      verdict: z.enum(['gut', 'mit_einschraenkungen', 'ungeeignet']),
      summary_de: z.string().catch(''),
    });
    return this.json(
      schema,
      [
        {
          role: 'system',
          content:
            'Du prüfst, ob eine Webseite als Quelle für Stellenanzeigen taugt, die ein Programm täglich einsammelt. Antworte nur mit JSON. ' +
            'is_job_list: Listet die Seite aktuelle Stellenausschreibungen? institution_name, city, institution_type: wer schreibt aus (Typ aus der vorgegebenen Liste)? ' +
            'is_department_page: Gehört die Liste zu einem Fachbereich, Institut oder Lehrstuhl (statt zur zentralen Stellenbörse einer ganzen Einrichtung)? ' +
            'sample_checks: Ist jede Probe-Anzeige wirklich eine einzelne, vollständig gelesene Stellenausschreibung (Titel, Aufgaben, Profil, Bewerbung)? problems: kurze deutsche Stichworte. ' +
            'link_pattern: ein regulärer Ausdruck, der auf die Adressen der Anzeigen passt und Navigation ausschließt, oder null, wenn nicht nötig. ' +
            'needs_browser: erscheinen die Anzeigen erst per JavaScript? verdict: "gut", "mit_einschraenkungen" oder "ungeeignet". ' +
            'summary_de: 2 bis 3 Sätze in einfachem Deutsch: was gefunden wurde und worauf zu achten ist.',
        },
        {
          role: 'user',
          content:
            `Adresse: ${input.url}\nSeitentitel: ${input.pageTitle}\n\nSeitentext (gekürzt):\n${input.pageText.slice(0, 2500)}\n\n` +
            `Gefundene Anzeigen-Links:\n${input.links.map((l) => `[${l.i}] ${l.text.slice(0, 100)} -> ${l.url}`).join('\n').slice(0, 5000)}\n\n` +
            `Probe-Anzeigen:\n${input.samples.map((s) => `[${s.i}] ${s.title}\n${s.url}\nErkannt: ${s.fields}\n${s.text.slice(0, 1200)}`).join('\n\n---\n\n')}`,
        },
      ],
      1500,
    );
  }

  /** Welche Seite ist die Stellenbörse einer Einrichtung? */
  pickJobsPage(institution: string, links: { i: number; text: string; url: string }[]) {
    const schema = z.object({ index: optInt, confidence: z.enum(['hoch', 'mittel', 'niedrig']).catch('niedrig') });
    return this.json(
      schema,
      [
        {
          role: 'system',
          content:
            'Wähle den Link, der am wahrscheinlichsten zur Liste der aktuellen Stellenausschreibungen (wissenschaftliches Personal) dieser Einrichtung führt. Antworte nur mit JSON {"index": n|null, "confidence": "hoch"|"mittel"|"niedrig"}.',
        },
        { role: 'user', content: `Einrichtung: ${institution}\n\nLinks:\n${links.map((l) => `[${l.i}] ${l.text} -> ${l.url}`).join('\n').slice(0, 8000)}` },
      ],
      100,
    );
  }
}
