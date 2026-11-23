import { describe, expect, it } from 'vitest';
import { inParallel } from '../src/pipeline';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('inParallel', () => {
  it('arbeitet alle Aufgaben ab', async () => {
    const done: number[] = [];
    let next = 0;
    await inParallel(3, () => {
      if (next >= 10) return null;
      const i = next++;
      return async () => {
        await sleep(1);
        done.push(i);
      };
    });
    expect(done.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('nimmt nach einem Fehler keine neuen Aufgaben, lässt laufende fertig werden und meldet den Fehler', async () => {
    const started: number[] = [];
    const finished: number[] = [];
    let next = 0;
    const run = inParallel(2, () => {
      if (next >= 20) return null;
      const i = next++;
      return async () => {
        started.push(i);
        if (i === 2) throw new Error('fetch failed');
        await sleep(i === 1 ? 30 : 1);
        finished.push(i);
      };
    });
    await expect(run).rejects.toThrow('fetch failed');
    // Aufgabe 1 lief beim Fehler noch und ist zu Ende gekommen, danach wurde nichts Neues begonnen
    expect(finished).toContain(1);
    const afterwards = started.length;
    await sleep(50);
    expect(started.length).toBe(afterwards);
    expect(started.length).toBeLessThan(6);
  });
});
