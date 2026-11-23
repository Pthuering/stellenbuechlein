import { describe, expect, it } from 'vitest';
import { RemoteDb } from '../src/remote';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

function fakeFetch(steps: (() => Response)[]) {
  let calls = 0;
  const impl = (async () => {
    const step = steps[Math.min(calls, steps.length - 1)];
    calls++;
    return step();
  }) as unknown as typeof fetch;
  return { impl, calls: () => calls };
}

const netError = () => {
  throw new TypeError('fetch failed');
};

describe('RemoteDb', () => {
  it('wiederholt nach einem Netzwerkfehler und liefert dann das Ergebnis', async () => {
    const f = fakeFetch([netError, netError, () => ok({ rows: [{ n: 1 }] })]);
    const db = new RemoteDb('https://x.example', 'k', f.impl, { netRetryDelaysMs: [0, 0, 0] });
    expect(await db.all('SELECT 1 AS n')).toEqual([{ n: 1 }]);
    expect(f.calls()).toBe(3);
  });

  it('gibt nach den Wiederholungen mit verständlicher Meldung auf', async () => {
    const f = fakeFetch([netError]);
    const db = new RemoteDb('https://x.example', 'k', f.impl, { netRetryDelaysMs: [0, 0] });
    await expect(db.batch([{ sql: 'UPDATE x SET y = 1', params: [] }])).rejects.toThrow(/nicht erreichbar \(3 Versuche\): fetch failed/);
    expect(f.calls()).toBe(3);
  });

  it('wiederholt Serverfehler nur wenige Male (500 kommt auch bei SQL-Fehlern)', async () => {
    const f = fakeFetch([() => new Response('kaputt', { status: 500 })]);
    const db = new RemoteDb('https://x.example', 'k', f.impl, { netRetryDelaysMs: [] });
    await expect(db.run('UPDATE x SET y = 1')).rejects.toThrow(/\(500\)/);
    expect(f.calls()).toBe(4);
  }, 15_000);
});
