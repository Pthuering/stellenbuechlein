// Stichprobe über die Startliste: Wie viele Quellen liefern ohne Browser und ohne KI auf Anhieb Anzeigen?
// Speichert nichts. Nützlich nach einer neuen Recherche oder um Quellen gezielt nachzuschärfen.
//   npm run cli -w @stellen/ingest -- probe [--n 60] [--kind unternehmen] [--only id,id] [--json datei.json]

import { writeFileSync } from 'node:fs';
import type { Source } from '@stellen/core';
import type { IngestConfig } from './config';
import { discover } from './discover';
import { Http } from './http';
import { Llm } from './llm';
import { RunLog } from './log';
import { loadSeed } from './seed';

export interface ProbeOptions {
  n: number;
  kind?: string;
  only?: string[];
  json?: string;
  concurrency?: number;
}

export interface ProbeRow {
  id: string;
  institution: string;
  url: string;
  status: string;
  found: number;
  methods: string[];
  note: string | null;
  ms: number;
}

/** Zufällige, aber reproduzierbare Auswahl (fester Startwert), damit Läufe vergleichbar sind. */
function sample<T>(list: T[], n: number): T[] {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  return [...list].map((x) => ({ x, r: rnd() })).sort((a, b) => a.r - b.r).slice(0, n).map((y) => y.x);
}

export async function probeSources(cfg: IngestConfig, opts: ProbeOptions): Promise<ProbeRow[]> {
  const seed = loadSeed();
  const kindOf = new Map(seed.institutions.map((i) => [i.id, i]));
  let pool = seed.sources.filter((s) => s.url && s.kind !== 'portal');
  if (opts.only?.length) pool = pool.filter((s) => opts.only!.includes(s.institutionId ?? '') || opts.only!.includes(s.id));
  else if (opts.kind) pool = pool.filter((s) => kindOf.get(s.institutionId ?? '')?.kind === opts.kind);
  const picked = opts.only?.length ? pool : sample(pool, opts.n);
  const log = new RunLog(false);
  const http = new Http(cfg, log);
  const llm = new Llm({ ...cfg.llm, apiKey: null }, log);
  const rows: ProbeRow[] = [];
  let next = 0;
  const worker = async () => {
    while (next < picked.length) {
      const s: Source = picked[next++];
      const t = Date.now();
      try {
        const res = await Promise.race([
          discover(s, { http, llm, browser: null, cfg, log }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung (90 s)')), 90_000)),
        ]);
        rows.push({ id: s.id, institution: kindOf.get(s.institutionId ?? '')?.name ?? '', url: s.url!, status: res.status, found: res.candidates.length, methods: res.methods, note: res.note, ms: Date.now() - t });
      } catch (e) {
        rows.push({ id: s.id, institution: kindOf.get(s.institutionId ?? '')?.name ?? '', url: s.url!, status: 'fehler', found: 0, methods: [], note: e instanceof Error ? e.message : String(e), ms: Date.now() - t });
      }
      const r = rows[rows.length - 1];
      console.log(`${r.status.padEnd(9)} ${String(r.found).padStart(4)}  ${r.id.padEnd(34)} ${r.methods.join(', ') || '–'}${r.note ? `  (${r.note.slice(0, 90)})` : ''}`);
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 8 }, worker));
  const by = (st: string) => rows.filter((r) => r.status === st).length;
  console.log(`\n${rows.length} Quellen: ${by('ok')} ok, ${by('leer')} leer, ${by('blockiert')} blockiert, ${by('fehler')} Fehler. Ohne Browser und ohne KI; im echten Lauf übernehmen beide einen Teil der leeren.`);
  if (opts.json) writeFileSync(opts.json, JSON.stringify(rows, null, 1));
  return rows;
}
