import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { finishRun, startRun } from '@stellen/db';
import { ASSISTANT_TOOLS, FINAL_STEP_NOTE, todayBerlin, type AssistantStepResult, type KiUsageReport } from '@stellen/core';
import { createApp } from '../src/app';

// Nachgebaute KI-Schnittstelle: merkt sich die Anfragen, antwortet je nach Kopfzeile x-status.
let server: Server;
let base = '';
const requests: Record<string, unknown>[] = [];
let nextStatus = 200;

const env = () => ({ APP_KEY: 'k', LLM_API_KEY: 'llm', LLM_BASE_URL: base, LLM_MODEL: 'deepseek-chat' });
let db: SqliteDb;
let app: ReturnType<typeof createApp>;
const auth = { authorization: 'Bearer k', 'content-type': 'application/json' };
const messages = [
  { role: 'system', content: 'Anweisung' },
  { role: 'user', content: 'Welche Stellen gibt es in Leipzig?' },
];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests.push(JSON.parse(body || '{}'));
      if (nextStatus !== 200) {
        res.writeHead(nextStatus, { 'content-type': 'application/json' }).end('{"error":{"message":"Insufficient Balance"}}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          choices: [
            {
              message: { role: 'assistant', content: null, reasoning_content: 'Ich suche zuerst.', tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'anzeigen_suchen', arguments: '{"staedte":["Leipzig"]}' } }] },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 20_000, prompt_cache_hit_tokens: 15_000, prompt_cache_miss_tokens: 5_000, completion_tokens: 2_000 },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  db = new SqliteDb(':memory:');
  migrateSqlite(db);
  // Ein Einsammel-Lauf von heute mit KI-Kosten
  const run = await startRun(db);
  await finishRun(db, run, true, { ki: 120, kiKostenUsd: 0.5 }, 'Protokoll');
  app = createApp({ db: () => db, env });
});

afterAll(() => server.close());

describe('KI-Gespräch im Worker', () => {
  it('fragt immer das große Modell mit allen Werkzeugen und gibt Antwort und Kosten zurück', async () => {
    const r = await app.request('/api/ki/schritt', { method: 'POST', headers: auth, body: JSON.stringify({ messages }) });
    expect(r.status).toBe(200);
    const b = (await r.json()) as AssistantStepResult;
    const sent = requests[requests.length - 1];
    expect(sent.model).toBe('deepseek-v4-pro');
    expect((sent.tools as unknown[]).length).toBe(ASSISTANT_TOOLS.length);
    expect(sent.tool_choice).toBeUndefined();
    expect(sent.messages).toEqual(messages);
    expect(b.message.tool_calls?.[0]).toEqual({ id: 'call_1', type: 'function', function: { name: 'anzeigen_suchen', arguments: '{"staedte":["Leipzig"]}' } });
    expect(b.message.reasoning_content).toBe('Ich suche zuerst.');
    expect(b.usd).toBeGreaterThan(0);
    expect(b.heuteUsd).toBeCloseTo(b.usd + 0.5);
  });

  it('erzwingt im letzten Schritt eine Antwort', async () => {
    await app.request('/api/ki/schritt', { method: 'POST', headers: auth, body: JSON.stringify({ messages, final: true }) });
    expect(requests[requests.length - 1].tool_choice).toBe('none');
    const sent = requests[requests.length - 1].messages as { role: string; content: string }[];
    expect(sent[sent.length - 1]).toEqual({ role: 'user', content: FINAL_STEP_NOTE });
  });

  it('lehnt ungültige Gespräche ab und gibt nur bekannte Felder weiter', async () => {
    expect((await app.request('/api/ki/schritt', { method: 'POST', headers: auth, body: '{"messages":[]}' })).status).toBe(400);
    expect((await app.request('/api/ki/schritt', { method: 'POST', headers: auth, body: 'kein json' })).status).toBe(400);
    await app.request('/api/ki/schritt', { method: 'POST', headers: auth, body: JSON.stringify({ messages: [...messages, { role: 'user', content: 'x', geheim: 'nicht weitergeben' }], model: 'deepseek-flash' }) });
    const sent = requests[requests.length - 1];
    expect(JSON.stringify(sent.messages)).not.toContain('geheim');
    expect(sent.model).toBe('deepseek-v4-pro');
  });

  it('meldet leeres Guthaben verständlich', async () => {
    nextStatus = 402;
    const r = await app.request('/api/ki/schritt', { method: 'POST', headers: auth, body: JSON.stringify({ messages }) });
    nextStatus = 200;
    expect(r.status).toBe(502);
    expect(((await r.json()) as { error: string }).error).toMatch(/Guthaben bei DeepSeek ist aufgebraucht/);
  });

  it('zeigt den Verbrauch pro Tag: Gespräche und Einsammeln', async () => {
    const r = await app.request('/api/ki/verbrauch', { headers: auth });
    const b = (await r.json()) as KiUsageReport;
    const heute = b.tage.find((t) => t.tag === todayBerlin())!;
    expect(heute.einsammelnUsd).toBeCloseTo(0.5);
    expect(heute.appUsd).toBeGreaterThan(0);
    expect(b.heuteUsd).toBeCloseTo(heute.appUsd + heute.einsammelnUsd);
    expect(b.monatUsd).toBeGreaterThanOrEqual(b.heuteUsd);
    // Guthaben nur bei DeepSeek abrufbar
    expect(b.guthaben).toBeNull();
  });

  it('braucht einen KI-Schlüssel', async () => {
    const without = createApp({ db: () => db, env: () => ({ APP_KEY: 'k' }) });
    expect((await without.request('/api/ki/schritt', { method: 'POST', headers: auth, body: JSON.stringify({ messages }) })).status).toBe(501);
  });
});
