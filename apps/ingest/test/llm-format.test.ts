import { describe, expect, it } from 'vitest';
import { RunLog } from '../src/log';
import { Llm } from '../src/llm';
import { configFromEnv } from '../src/config';

const llmCfg = { baseUrl: 'https://ki.test', apiKey: 'test', model: 'test', maxCalls: 50, summaries: true };

/** Antwortet wie eine OpenAI-kompatible Schnittstelle mit festem Inhalt. */
function fakeFetch(content: unknown, opts: { status?: number; finish?: string } = {}) {
  let calls = 0;
  const impl = (async () => {
    calls++;
    if (opts.status && opts.status !== 200) return new Response('{}', { status: opts.status });
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return Response.json({ choices: [{ message: { content: text }, finish_reason: opts.finish ?? 'stop' }] });
  }) as typeof fetch;
  return { impl, calls: () => calls };
}

describe('KI-Antworten mit kleinen Abweichungen', () => {
  it('nimmt eine Anzeige trotz fehlender Felder und Zahl als Text', async () => {
    const f = fakeFetch({ is_job_posting: true, title: 'Wissenschaftliche Mitarbeiterin', workload_pct: '50', summary_de: 'Forschung zu Lernen im Alter. Mitarbeit in einer Längsschnittstudie.' });
    const r = await new Llm(llmCfg, new RunLog(false), f.impl).extractPosting('Text', 'https://x.de');
    expect(r?.title).toBe('Wissenschaftliche Mitarbeiterin');
    expect(r?.workload_pct).toBe(50);
    expect(r?.deadline).toBeNull();
    expect(r?.summary_de).toMatch(/Längsschnittstudie/);
  });

  it('setzt einen unbekannten Einrichtungstyp auf null statt das Urteil zu verwerfen', async () => {
    const f = fakeFetch({ is_job_list: true, institution_type: 'hochschule-xy', verdict: 'gut', summary_de: 'Gute Liste.' });
    const r = await new Llm(llmCfg, new RunLog(false), f.impl).reviewSource({ url: 'https://x.de', pageTitle: 'Stellen', pageText: '', links: [], samples: [] });
    expect(r?.verdict).toBe('gut');
    expect(r?.institution_type).toBeNull();
    expect(r?.sample_checks).toEqual([]);
  });

  it('bleibt bei den tragenden Feldern streng und schreibt den Grund ins Protokoll', async () => {
    const log = new RunLog(false);
    const f = fakeFetch({ verdict: 'vielleicht', reason_de: 'unklar' });
    const llm = new Llm(llmCfg, log, f.impl);
    expect(await llm.horizonVerdict('Profil', { title: 'Stelle', org: null, text: 'Text' }, null)).toBeNull();
    expect(llm.failures).toBe(1);
    expect(log.text()).toMatch(/passt nicht zum Format \(verdict/);
  });

  it('meldet abgeschnittene Antworten', async () => {
    const log = new RunLog(false);
    const f = fakeFetch('{"is_job_posting": true, "summary_de": "Forschung zu', { finish: 'length' });
    expect(await new Llm(llmCfg, log, f.impl).extractPosting('Text', 'https://x.de')).toBeNull();
    expect(log.text()).toMatch(/abgeschnitten/);
  });

  it('fragt nach ungültigem Schlüssel oder leerem Guthaben nicht weiter', async () => {
    const log = new RunLog(false);
    const f = fakeFetch({}, { status: 402 });
    const llm = new Llm(llmCfg, log, f.impl);
    expect(await llm.extractPosting('a', 'b')).toBeNull();
    expect(llm.available).toBe(false);
    expect(await llm.extractPosting('a', 'b')).toBeNull();
    expect(f.calls()).toBe(1);
    expect(log.text()).toMatch(/KI abgeschaltet/);
  });

  it('fragt das große Modell ohne Denkmodus', async () => {
    let body: Record<string, unknown> = {};
    const impl = (async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { content: '{"is_job_posting": true}' }, finish_reason: 'stop' }] });
    }) as typeof fetch;
    const cfg = configFromEnv({ LLM_API_KEY: 'test', LLM_MODEL: 'deepseek-chat' }).llm;
    await new Llm(cfg, new RunLog(false), impl).extractPosting('Text', 'https://x.de');
    expect(body.model).toBe('deepseek-v4-pro');
    expect(body.thinking).toEqual({ type: 'disabled' });
  });

  it('schreibt höchstens zehn Fehler einzeln ins Protokoll', async () => {
    const log = new RunLog(false);
    const llm = new Llm(llmCfg, log, fakeFetch({}, { status: 500 }).impl);
    for (let i = 0; i < 15; i++) await llm.extractPosting('a', 'b');
    expect(llm.failures).toBe(15);
    expect(log.lines.filter((l) => /KI: Anfrage fehlgeschlagen/.test(l))).toHaveLength(10);
    expect(log.text()).toMatch(/nur noch gezählt/);
  });
});
