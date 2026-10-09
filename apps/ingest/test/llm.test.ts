import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import { configFromEnv, type IngestConfig } from '../src/config';
import { RunLog } from '../src/log';
import { Http } from '../src/http';
import { Llm } from '../src/llm';
import { BrowserPool } from '../src/browser';
import { agentReadPosting } from '../src/agent';
import { startFixtureServer, type FixtureServer } from './fixtures/server';

// Nachgebauter OpenAI-kompatibler Endpunkt (wie DeepSeek), antwortet je nach Aufgabe.
let llmServer: Server;
let llmUrl = '';
const requests: { system: string; user: string }[] = [];
let srv: FixtureServer;
let cfg: IngestConfig;

beforeAll(async () => {
  srv = await startFixtureServer();
  llmServer = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const data = JSON.parse(body) as { messages: { role: string; content: string }[] };
      const system = data.messages.find((m) => m.role === 'system')?.content ?? '';
      const user = data.messages.find((m) => m.role === 'user')?.content ?? '';
      requests.push({ system, user });
      let answer: unknown = {};
      if (/steuerst einen Browser/.test(system)) {
        const m = /\[(\d+)\] a „Hier entlang zu allen Details“/.exec(user);
        answer = m ? { action: 'click', index: Number(m[1]), reason: 'Link zur vollständigen Anzeige' } : { action: 'done', index: null, reason: 'fertig' };
      } else if (/liest Stellenausschreibungen/.test(system)) {
        answer = { is_job_posting: true, title: 'Promotionsstelle Entwicklungspsychologie (Sprachentwicklung)', institution: null, department: 'Lehrstuhl für Entwicklungspsychologie', location: null, deadline: '2026-11-28', pay_grade: null, workload_pct: null, fixed_term: null, start: null, summary_de: 'Promotion zur Sprachentwicklung von Kleinkindern. Studien mit Eye-Tracking planen und auswerten.' };
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
    });
  });
  await new Promise<void>((r) => llmServer.listen(0, '127.0.0.1', r));
  llmUrl = `http://127.0.0.1:${(llmServer.address() as AddressInfo).port}`;
  cfg = configFromEnv({ ...process.env, LLM_API_KEY: 'test', LLM_BASE_URL: llmUrl });
  cfg.minHostIntervalMs = 5;
  cfg.browser.executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
});

afterAll(async () => {
  await srv.close();
  await new Promise<void>((r) => llmServer.close(() => r()));
});

describe('KI-Anbindung', () => {
  it('liefert strukturierte Felder (OpenAI-kompatibles JSON)', async () => {
    const llm = new Llm(cfg.llm, new RunLog(false));
    const r = await llm.extractPosting('Text', 'https://x.de');
    expect(r?.deadline).toBe('2026-11-28');
    expect(llm.calls).toBe(1);
  });

  it('hält das Aufruf-Limit ein', async () => {
    const llm = new Llm({ ...cfg.llm, maxCalls: 1 }, new RunLog(false));
    await llm.extractPosting('a', 'b');
    expect(await llm.extractPosting('a', 'b')).toBeNull();
    expect(llm.calls).toBe(1);
  });

  it.skipIf(!existsSync('/opt/pw-browsers/chromium'))('Browser-Agent folgt dem KI-Klick zur vollständigen Anzeige', async () => {
    const log = new RunLog(false);
    const pool = new BrowserPool(cfg, log);
    try {
      const r = await agentReadPosting(pool, new Http(cfg, log), new Llm(cfg.llm, log), log, `${srv.url}/stellen/teaser.html`);
      expect(r.steps.join(' ')).toMatch(/KI-Klick: a „Hier entlang zu allen Details“/);
      expect(r.data?.descriptionMd).toMatch(/episodischem Gedächtnis/);
      expect(r.data?.complete).toBe(true);
    } finally {
      await pool.close();
    }
  });
});
