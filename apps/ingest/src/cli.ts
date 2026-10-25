// Kommandozeile der Einsammel-Pipeline.
//
//   npm run cli -w @stellen/ingest -- seed                 Startdaten laden
//   npm run cli -w @stellen/ingest -- ingest               kompletter Lauf
//   npm run cli -w @stellen/ingest -- ingest --only uni-leipzig-z1 --no-browser
//   npm run cli -w @stellen/ingest -- test-source <url> [--render]
//   npm run cli -w @stellen/ingest -- probe [--n 60] [--kind unternehmen]   Stichprobe über die Startliste
//   npm run cli -w @stellen/ingest -- check-source <url>       KI-Probelauf einer Website (ohne Speichern)
//   npm run cli -w @stellen/ingest -- check-sources            wartende Probeläufe aus der App abarbeiten
//   npm run cli -w @stellen/ingest -- agent <url>
//   npm run cli -w @stellen/ingest -- reminders
//
// Datenbank: lokal eine SQLite-Datei (--db, Standard ./stellen.sqlite im Repo),
// in Produktion der Worker (Umgebungsvariablen API_URL und INGEST_KEY).

import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RemoteDb, type Db } from '@stellen/db';
import { openSqlite } from '@stellen/db/sqlite';
import { bigRunConfig, configFromEnv } from './config';
import { RunLog } from './log';
import { Http } from './http';
import { Llm } from './llm';
import { BrowserPool } from './browser';
import { discover } from './discover';
import { extractPosting } from './extract';
import { atsDetail } from './ats';
import { probeSources } from './probe';
import { agentReadPosting } from './agent';
import { applySeed } from './seed';
import { runPipeline } from './pipeline';
import { sendReminders } from './push';
import { processPendingChecks, runSourceCheck } from './sourceCheck';
import { backfillAiTasks, countOpenAiTasks, listCities, listInstitutions, listSources, openBrowserItemCount, type AiTaskKind } from '@stellen/db';
import { exportAiTasks, importAiResults, splitAiPackage, type AiPackage } from './aiTasks';
import { extractFields, classifyKind, stripMarkdown } from '@stellen/core';
import type { Source } from '@stellen/core';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const cmd = args[0];

function flag(name: string): boolean {
  return args.includes(`--${name}`);
}
function option(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function openDb(): Db {
  if (process.env.API_URL && process.env.INGEST_KEY && !option('db')) {
    // INGEST_KEY=proxy: Der Schlüssel kommt vom Proxy der Claude-Cloud-Umgebung (Netzwerk-Secret)
    const viaProxy = process.env.INGEST_KEY === 'proxy';
    console.log(`Datenbank: Worker ${process.env.API_URL}${viaProxy ? ' (Schlüssel über Proxy)' : ''}`);
    return new RemoteDb(process.env.API_URL, viaProxy ? '' : process.env.INGEST_KEY);
  }
  const path = resolve(option('db') ?? resolve(here, '../../../stellen.sqlite'));
  console.log(`Datenbank: ${path}`);
  return openSqlite(path);
}

async function main(): Promise<void> {
  const cfg = configFromEnv();
  switch (cmd) {
    case 'seed': {
      const db = openDb();
      const r = await applySeed(db);
      console.log(`Startdaten geladen: ${r.cities} Städte, ${r.institutions} Einrichtungen, ${r.sources} Quellen.`);
      break;
    }
    case 'ingest': {
      const db = openDb();
      const only = option('only')?.split(',');
      // --nur-browser: nur die Warteschlange des Browser-Agenten (Workflow „Browser-Warteschlange“)
      const onlyBrowser = flag('nur-browser');
      // --gross: großer Durchlauf ohne Mengengrenzen (Workflow „Großer Durchlauf“); GROSS_SEIT = Beginn bei Fortsetzungen
      const gross = flag('gross');
      const seit = process.env.GROSS_SEIT || new Date().toISOString();
      const stats = await runPipeline(db, gross ? bigRunConfig(cfg) : cfg, {
        only,
        skipSourcesSince: gross ? seit : undefined,
        sources: onlyBrowser ? false : undefined,
        checks: onlyBrowser ? false : undefined,
        browser: flag('no-browser') ? false : undefined,
        images: !flag('no-images'),
        discovery: !flag('no-discovery'),
        reminders: !flag('no-reminders') && !onlyBrowser,
        explore: flag('no-explore') ? false : undefined,
        maxSources: option('max') ? Number(option('max')) : undefined,
      });
      console.log(stats);
      if (gross) {
        const offen = await openBrowserItemCount(db);
        const weiter = (stats.quellenVertagt ?? 0) > 0 || offen > 0;
        console.log(`Großer Durchlauf: ${stats.quellenVertagt ?? 0} Quellen vertagt, ${offen} Seiten für den Browser offen → ${weiter ? 'Fortsetzung' : 'fertig'}.`);
        // Für den Workflow: Fortsetzung starten, Beginn weitergeben
        if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `weiter=${weiter ? 1 : 0}\nseit=${seit}\n`);
      }
      break;
    }
    case 'check-sources': {
      // Wartende Probeläufe aus der App (Workflow „Quelle prüfen“)
      const db = openDb();
      const log = new RunLog();
      const http = new Http(cfg, log);
      const llm = new Llm(cfg.llm, log);
      const browser = flag('no-browser') ? null : new BrowserPool(cfg, log);
      try {
        const n = await processPendingChecks(db, { http, llm, browser, cfg, log }, Number(option('max') ?? 5));
        console.log(`${n} Probelauf/Probeläufe erledigt.`);
      } finally {
        await browser?.close();
      }
      break;
    }
    case 'check-source': {
      // KI-Probelauf direkt auf der Kommandozeile; Register aus der Datenbank, falls vorhanden
      const url = args[1];
      if (!url) throw new Error('Bitte eine Adresse angeben.');
      const db = openDb();
      const log = new RunLog();
      const http = new Http(cfg, log);
      const llm = new Llm(cfg.llm, log);
      const browser = flag('no-browser') ? null : new BrowserPool(cfg, log);
      try {
        const [institutions, cities, sources] = await Promise.all([listInstitutions(db), listCities(db), listSources(db)]);
        const r = await runSourceCheck(url, null, { ctx: { http, llm, browser, cfg, log }, institutions, cities, sources });
        console.log(`\nUrteil: ${r.verdict}${r.ai ? ` (KI: ${r.ai.verdict})` : ' (ohne KI)'} – ${r.candidates} Anzeigen über ${r.methods.join(', ') || '–'}`);
        if (r.ai) console.log(`KI: ${r.ai.summary}`);
        for (const n of r.notes) console.log(`Hinweis: ${n}`);
        console.log(`Einrichtung: ${r.institution.name ?? '?'} (${r.institution.id ?? 'neu'}), Stadt: ${r.institution.cityId ?? '?'}, Art: ${r.kindGuess}`);
        if (r.registered) console.log(`Schon im Register: ${r.registered.sourceId} ${r.registered.url ?? ''}`);
        for (const s of r.samples) console.log(`  ${s.complete ? '✓' : '✗'} ${s.title}\n    Frist ${s.deadline ?? '–'} · ${s.payGrade ?? '–'} · ${s.workload ?? '–'} · ${s.chars} Zeichen${s.problems.length ? ` · ${s.problems.join(', ')}` : ''}`);
        console.log(`Empfohlene Einstellungen: ${JSON.stringify(r.config)}`);
      } finally {
        await browser?.close();
      }
      break;
    }
    case 'probe': {
      // Stichprobe über die Startliste, ohne Browser, ohne KI, ohne zu speichern
      await probeSources(cfg, { n: Number(option('n') ?? 60), kind: option('kind'), only: option('only')?.split(','), json: option('json') });
      break;
    }
    // KI-Warteschlange für Claude (Skill .claude/skills/ki-aufgaben): Stand, Paket ausgeben, Ergebnisse einspielen
    case 'ki-status': {
      const db = openDb();
      const n = await countOpenAiTasks(db);
      const sum = Object.values(n).reduce((a, b) => a + b, 0);
      console.log(`KI-Aufgaben offen: ${sum} (auswerten ${n.auswerten}, frist ${n.frist}, horizont ${n.horizont}, weite ${n.weite})`);
      break;
    }
    case 'ki-nachholen': {
      const db = openDb();
      const r = await backfillAiTasks(db);
      console.log(`Neu in der Warteschlange: auswerten ${r.auswerten}, frist ${r.frist}`);
      break;
    }
    case 'ki-export': {
      const db = openDb();
      const arten = option('art')?.split(',') as AiTaskKind[] | undefined;
      const pkg = await exportAiTasks(db, { max: Number(option('max') ?? 40), arten });
      const describe = (p: AiPackage) => {
        const by = p.aufgaben.reduce<Record<string, number>>((m, t) => ({ ...m, [t.art]: (m[t.art] ?? 0) + 1 }), {});
        return `${p.aufgaben.length} Aufgaben (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ') || 'keine'})`;
      };
      const size = Number(option('teile') ?? 0);
      if (size > 0) {
        // Ein Teil pro Haiku-Subagent: Ordner mit teil-01.json, teil-02.json, …; ausgegeben werden nur die Pfade
        const dir = resolve(option('out') ?? '.ki/runde');
        mkdirSync(dir, { recursive: true });
        for (const f of readdirSync(dir)) if (/^(teil|ergebnis)-\d+\.json$/.test(f)) rmSync(join(dir, f));
        const parts = splitAiPackage(pkg, size);
        parts.forEach((p, i) => {
          const file = join(dir, `teil-${String(i + 1).padStart(2, '0')}.json`);
          writeFileSync(file, JSON.stringify(p, null, 1));
          console.log(`${relative(process.cwd(), file).replace(/\\/g, '/')}: ${describe(p)}`);
        });
        if (!parts.length) console.log('Keine offenen KI-Aufgaben.');
        break;
      }
      const out = resolve(option('out') ?? '.ki/paket.json');
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(pkg, null, 1));
      console.log(`${describe(pkg)} nach ${out}`);
      break;
    }
    case 'ki-import': {
      const db = openDb();
      // --teil <datei>: Aufgaben dieses Teils ohne Ergebnis zählen als Versuch (nach drei Versuchen: fehler)
      const teil = option('teil');
      const files = args.slice(1).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--teil');
      if (!files.length) throw new Error('Bitte eine oder mehrere Ergebnis-Dateien angeben.');
      const results = files.flatMap((f) => {
        let data: unknown;
        try {
          data = JSON.parse(readFileSync(resolve(f), 'utf8'));
        } catch (e) {
          throw new Error(`${f} ist kein gültiges JSON (${(e as Error).message}). Bitte die Datei korrigieren und noch einmal einspielen.`);
        }
        // Auch {"ergebnisse": [ … ]} statt der nackten Liste annehmen
        const list = Array.isArray(data) ? data : Object.values((data ?? {}) as Record<string, unknown>).find(Array.isArray);
        return (list ?? []) as { id: number; ergebnis: unknown }[];
      });
      const erwartet = teil ? (JSON.parse(readFileSync(resolve(teil), 'utf8')) as AiPackage).aufgaben.map((t) => t.id) : undefined;
      const r = await importAiResults(db, results, undefined, { erwartet });
      console.log(
        `Eingespielt: ${r.erledigt}, entfernt (keine Anzeige oder KI: nein): ${r.entfernt}, Weite gespeichert: ${r.weiteGespeichert}, ohne Ergebnis: ${r.unbeantwortet}, Fehler: ${r.fehler.length}, noch offen: ${r.offen}`,
      );
      for (const e of r.fehler) console.log(`  Fehler: ${e}`);
      break;
    }
    case 'reminders': {
      const db = openDb();
      const n = await sendReminders(db, cfg, new RunLog());
      console.log(`${n} Erinnerung(en) verschickt.`);
      break;
    }
    case 'test-source': {
      // Probelauf ohne Datenbank: Was findet die Pipeline auf dieser Seite?
      const url = args[1];
      if (!url) throw new Error('Bitte eine Adresse angeben.');
      const log = new RunLog();
      const http = new Http(cfg, log);
      const llm = new Llm(cfg.llm, log);
      const browser = flag('no-browser') ? null : new BrowserPool(cfg, log);
      const source: Source = {
        id: 'test',
        institutionId: null,
        kind: 'zentral',
        label: 'Test',
        url,
        adapter: option('adapter') ?? 'auto',
        config: { render: flag('render'), ignoreRobots: flag('ignore-robots'), linkPattern: option('pattern') },
        gate: 'none',
        enabled: true,
        verified: false,
        status: 'neu',
        consecutiveFailures: 0,
      };
      try {
        const res = await discover(source, { http, llm, browser, cfg, log });
        console.log(`\nStatus: ${res.status} – ${res.candidates.length} Kandidaten über ${res.methods.join(', ') || '–'}${res.note ? ` (${res.note})` : ''}`);
        for (const c of res.candidates.slice(0, 40)) console.log(`  • ${c.title ?? '(ohne Titel)'}\n    ${c.url}  [${c.via}${c.prefilled ? ', Text vollständig' : ''}]`);
        const n = Number(option('details') ?? 3);
        for (const c of res.candidates.slice(0, n)) {
          const viaApi = c.prefilled ? null : await atsDetail(http, c);
          const r = c.prefilled ? { data: c.prefilled } : viaApi ? { data: viaApi } : await extractPosting(http, c.url, { titleHint: c.title });
          if (!r.data) {
            console.log(`\n✗ ${c.url}: nicht lesbar`);
            continue;
          }
          const f = extractFields(stripMarkdown(r.data.descriptionMd), { title: r.data.title });
          console.log(`\n✓ ${r.data.title}\n  ${r.data.method}, ${r.data.descriptionMd.length} Zeichen, ${r.data.complete ? 'vollständig' : `unvollständig (${r.data.incompleteReason})`}`);
          console.log(`  Art: ${classifyKind(r.data.title, r.data.descriptionMd)} · Frist: ${f.deadline ?? '–'} · Entgelt: ${f.payGrade ?? '–'} · Umfang: ${f.workloadPct ?? f.workloadText ?? '–'} · ${f.fixedTerm ?? ''}`);
        }
      } finally {
        await browser?.close();
      }
      break;
    }
    case 'agent': {
      const url = args[1];
      if (!url) throw new Error('Bitte eine Adresse angeben.');
      const log = new RunLog();
      const http = new Http(cfg, log);
      const llm = new Llm(cfg.llm, log);
      const pool = new BrowserPool(cfg, log);
      try {
        const r = await agentReadPosting(pool, http, llm, log, url);
        console.log(`Schritte: ${r.steps.join(' → ') || '–'}`);
        if (r.data) {
          console.log(`\n${r.data.title}\n${r.data.complete ? 'vollständig' : `unvollständig: ${r.data.incompleteReason}`}\n\n${r.data.descriptionMd.slice(0, 3000)}`);
        } else console.log('Kein Text gefunden.');
      } finally {
        await pool.close();
      }
      break;
    }
    default:
      console.log('Befehle: seed | ingest [--only id,id] [--gross] [--nur-browser] [--no-browser] [--no-images] [--no-discovery] [--no-explore] [--max N] | test-source <url> [--render] | check-source <url> | check-sources | probe [--n 60] [--kind art] [--only id,id] | agent <url> | reminders | ki-status | ki-nachholen | ki-export [--max 40] [--art auswerten,frist] [--teile 10] [--out .ki/paket.json bzw. Ordner] | ki-import <ergebnis.json …> [--teil teil.json]');
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
