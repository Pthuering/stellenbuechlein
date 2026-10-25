// KI-Anbindung über eine OpenAI-kompatible Schnittstelle (Standard: DeepSeek).
// Wird nur gebraucht, wenn die Regeln nicht reichen: Titel/Frist fehlen, Liste unklar,
// Browser-Agent braucht eine Entscheidung, Kurzfassung für die Karte.

import { z } from 'zod';
import { INSTITUTION_KINDS } from '@stellen/core';
import type { IngestConfig } from './config';
import type { RunLog } from './log';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class Llm {
  calls = 0;
  failures = 0;

  constructor(
    private readonly cfg: IngestConfig['llm'],
    private readonly log: RunLog,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get available(): boolean {
    return !!this.cfg.apiKey && this.calls < this.cfg.maxCalls;
  }

  /** Fragt JSON ab und prüft es gegen ein Schema. Gibt null zurück, wenn etwas schiefgeht. */
  async json<T>(schema: z.ZodType<T>, messages: ChatMessage[], maxTokens = 1200): Promise<T | null> {
    if (!this.available) return null;
    this.calls++;
    try {
      const res = await this.fetchImpl(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.cfg.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.cfg.model,
          messages,
          temperature: 0,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
      });
      if (!res.ok) {
        this.failures++;
        this.log.warn(`KI-Anfrage fehlgeschlagen (${res.status})`);
        return null;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? '';
      const parsed = schema.safeParse(JSON.parse(content.replace(/^```(?:json)?\s*|```\s*$/g, '')));
      if (!parsed.success) {
        this.failures++;
        return null;
      }
      return parsed.data;
    } catch (e) {
      this.failures++;
      this.log.warn(`KI-Anfrage fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  // ---------------------------------------------------------------- Aufgaben

  /** Strukturierte Felder + Kurzfassung aus dem Anzeigentext. */
  extractPosting(text: string, url: string) {
    const schema = z.object({
      is_job_posting: z.boolean(),
      title: z.string().nullable(),
      institution: z.string().nullable(),
      department: z.string().nullable(),
      location: z.string().nullable(),
      deadline: z.string().nullable(),
      pay_grade: z.string().nullable(),
      workload_pct: z.number().nullable(),
      fixed_term: z.string().nullable(),
      start: z.string().nullable(),
      summary_de: z.string().nullable(),
    });
    return this.json(schema, [
      {
        role: 'system',
        content:
          'Du liest Stellenausschreibungen deutscher Hochschulen und Forschungsinstitute. Antworte ausschließlich mit JSON. ' +
          'Erfinde nichts: Was nicht im Text steht, ist null. Datumsangaben als YYYY-MM-DD. ' +
          'summary_de: 2 kurze Sätze auf Deutsch, was die Stelle inhaltlich ist (Thema, Aufgaben), ohne Floskeln.',
      },
      {
        role: 'user',
        content:
          `URL: ${url}\n\nFelder: is_job_posting, title (Stellenbezeichnung wie in der Anzeige), institution, department, location (Ort), ` +
          `deadline (Bewerbungsfrist), pay_grade (z. B. "E 13 TV-L"), workload_pct (Zahl), fixed_term (z. B. "befristet, 3 Jahre"), start, summary_de.\n\n` +
          `Text:\n${text.slice(0, 14_000)}`,
      },
    ]);
  }

  /** Welche Links einer Listenseite führen zu einzelnen Anzeigen? */
  pickPostingLinks(pageText: string, links: { i: number; text: string; url: string }[]) {
    const schema = z.object({ posting_links: z.array(z.number().int()), no_jobs_listed: z.boolean() });
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
      index: z.number().int().nullable(),
      reason: z.string(),
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
    const schema = z.object({
      deadline: z.string().nullable(),
      quote: z.string().nullable(),
      still_open: z.boolean().nullable(),
    });
    return this.json(
      schema,
      [
        {
          role: 'system',
          content:
            `Du prüfst die Bewerbungsfrist einer Stellenausschreibung. Heute ist der ${today}. Antworte nur mit JSON {"deadline": "YYYY-MM-DD"|null, "quote": "…"|null, "still_open": bool|null}. ` +
            'deadline ist das Datum, bis zu dem Bewerbungen eingehen müssen. Wurde die Frist verlängert, gilt die neue. Steht im Text kein Jahr, ergänze das Jahr, das zur Anzeige passt. ' +
            'Ein Vertragsende, Eintrittsdatum, Beginn oder Veröffentlichungsdatum ist keine Frist. quote ist die Textstelle mit der Frist, wörtlich kopiert (höchstens 160 Zeichen). ' +
            'Steht keine Frist im Text, sind deadline und quote null. still_open: ist die Bewerbung laut Text heute noch möglich?',
        },
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
    const schema = z.object({
      verdict: z.enum(['passt', 'eher', 'nein']),
      reason_de: z.string(),
      label: z.string().nullable(),
    });
    return this.json(
      schema,
      [
        {
          role: 'system',
          content:
            'Du hilfst einer Person mit Psychologie-Hintergrund, Stellen außerhalb ihres engeren Suchbereichs zu entdecken, auf die sie sich trotzdem realistisch bewerben könnte. ' +
            'Sei offen: Auch Stellen außerhalb der Forschung und außerhalb der Psychologie zählen, wenn ihr Wissen über Menschen, Verhalten, Lernen oder Gesundheit oder ihre Methoden dort gebraucht werden. ' +
            'Nicht passend sind Stellen, für die eine ganz andere Ausbildung nötig ist (zum Beispiel Hotelfach, Handwerk, Pflegefachkraft, Steuerrecht, Elektrotechnik) oder in denen nichts von ihrem Wissen gebraucht wird. ' +
            'verdict: "passt" (gute Chancen, inhaltlich naheliegend), "eher" (möglich, mit Lücken), "nein" (fremd). ' +
            'reason_de: ein konkreter Satz auf Deutsch, warum die Stelle passen könnte (bei "nein": warum nicht), mit Bezug auf die Anzeige und das Profil, ohne Floskeln. ' +
            'label: 2 bis 4 Wörter für die Verbindung, z. B. "IT-Sicherheit × Verhalten". Antworte nur mit JSON.',
        },
        {
          role: 'user',
          content:
            `Profil:\n${profile}\n\n${bridge ? `Brücke: ${bridge.name}${bridge.warum ? ` (${bridge.warum})` : ''}\n\n` : ''}` +
            `Anzeige: ${posting.title}${posting.org ? `, ${posting.org}` : ''}\n${posting.text.slice(0, 6000)}`,
        },
      ],
      250,
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
      institution_name: z.string().nullable(),
      city: z.string().nullable(),
      institution_type: z.enum(INSTITUTION_KINDS).nullable(),
      is_department_page: z.boolean(),
      sample_checks: z.array(z.object({ index: z.number().int(), is_posting: z.boolean(), problems: z.array(z.string()) })),
      link_pattern: z.string().nullable(),
      needs_browser: z.boolean(),
      verdict: z.enum(['gut', 'mit_einschraenkungen', 'ungeeignet']),
      summary_de: z.string(),
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
      900,
    );
  }

  /** Welche Seite ist die Stellenbörse einer Einrichtung? */
  pickJobsPage(institution: string, links: { i: number; text: string; url: string }[]) {
    const schema = z.object({ index: z.number().int().nullable(), confidence: z.enum(['hoch', 'mittel', 'niedrig']) });
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
