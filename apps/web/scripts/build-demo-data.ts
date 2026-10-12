// Baut die Daten für die Demo: echte Anzeigen (recherchiert am 09. und 12.10.2026, in eigenen Worten
// zusammengefasst) + Startdaten (Städte, Einrichtungen, Quellen).
// Ring (Kern/Horizont), Brücken und „neue Website“ werden mit derselben Logik bestimmt wie in der Pipeline.
//   npx tsx apps/web/scripts/build-demo-data.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkGate,
  isThematic,
  jobIdForUrl,
  matchBridges,
  searchTextOf,
  siteKeyOf,
  starterProfile,
  type Job,
  type JobKind,
} from '../../../packages/core/src';
import { loadSeed } from '../../ingest/src/seed';

const here = dirname(fileURLToPath(import.meta.url));
const research = (f: string) => resolve(here, '../../../data/research', f);
const out = resolve(here, '../src/data/demo-data.json');

interface Example {
  institution: string | null;
  employer?: string;
  title: string;
  department: string | null;
  city: string;
  url: string;
  deadline: string | null;
  pay_grade: string | null;
  pay_level: number | null;
  workload_pct: number | null;
  fixed_term: string | null;
  is_permanent: boolean | null;
  start: string | null;
  kind: JobKind;
  language?: 'de' | 'en';
  summary: string;
  tasks: string[];
  requirements: string[];
  keywords: string[];
  /** nur in der Recherche vom 12.10.: Brücke und KI-Begründung */
  bridge?: string | null;
  why_de?: string | null;
  verdict?: 'passt' | 'eher' | null;
}

const batches: { date: string; file: string }[] = [
  { date: '2026-10-09', file: 'beispielanzeigen-2026-10-09.json' },
  { date: '2026-10-12', file: 'beispielanzeigen-2026-10-12.json' },
];

const seed = loadSeed();
const profile = starterProfile();
const horizon = profile.horizont!;
const registeredInstitutions = new Set(seed.institutions.map((i) => i.id));

const jobs: Job[] = [];
for (const batch of batches) {
  const examples = JSON.parse(readFileSync(research(batch.file), 'utf8')) as Example[];
  examples.forEach((e, i) => {
    const md = [
      '> Kurzfassung für die Demo, in eigenen Worten. Der vollständige Text steht in der Original-Anzeige (Knopf weiter oben). In der eingerichteten App steht hier die ganze Anzeige.',
      '',
      e.summary,
      '',
      '## Aufgaben',
      ...e.tasks.map((t) => `- ${t}`),
      '',
      '## Profil',
      ...e.requirements.map((t) => `- ${t}`),
      '',
      `**Schlagwörter:** ${e.keywords.join(', ')}`,
    ].join('\n');
    const [y, m, d] = batch.date.split('-').map(Number);
    const seen = new Date(Date.UTC(y, m - 1, d, 10, 5 + i)).toISOString();
    const viaPortal = /psychjob\.eu/.test(e.url);
    const registered = !!e.institution && registeredInstitutions.has(e.institution);
    const norm = searchTextOf({ title: e.title, department: e.department, descriptionMd: md });
    const gate = checkGate(norm);
    const hits = matchBridges(norm, horizon);
    // Wie in der Pipeline: ohne Psychologie-Bezug kommt eine Anzeige nur über eine Brücke herein (Horizont).
    const lane = gate.pass ? 'kern' : hits.length ? 'horizont' : 'kern';
    const thematic = isThematic({ kind: e.kind }, norm, profile);
    // KI-Begründung nur dort, wo die App sie zeigt: ohne Kernthema, aber mit Brücke
    const horizonInfo = !thematic && hits.length && e.why_de ? { reason: e.why_de, verdict: e.verdict ?? null, label: hits[0].bridge.name, bridges: hits.map((h) => h.bridge.id) } : null;
    const sourceRef = !registered
      ? { sourceId: 'erkundung', label: 'Erkundung (neue Websites)', url: e.url }
      : viaPortal
        ? { sourceId: 'portal-psychjob', label: 'PsychJob (Hogrefe)', url: e.url }
        : { sourceId: `${e.institution}-z1`, label: 'Stellenseite der Einrichtung', url: e.url };
    jobs.push({
      id: jobIdForUrl(e.url),
      institutionId: registered ? e.institution : null,
      employer: e.employer ?? null,
      url: e.url,
      title: e.title,
      department: e.department,
      cityId: e.city,
      locationText: registered ? null : seed.cities.find((c) => c.id === e.city)?.name ?? null,
      descriptionMd: md,
      summary: e.summary.split(/(?<=[.!?])\s+/).slice(0, 2).join(' '),
      summaryByAi: true,
      kind: e.kind,
      payGrade: e.pay_grade,
      payLevel: e.pay_level,
      workloadPct: e.workload_pct,
      fixedTerm: e.fixed_term,
      isPermanent: e.is_permanent,
      startText: e.start,
      deadline: e.deadline,
      deadlineCheck: e.deadline ? 'ok' : null,
      language: e.language ?? (/^(PhD|Post-Doc|Postdoctoral|Doctoral)/.test(e.title) ? 'en' : 'de'),
      firstSeenAt: seen,
      lastSeenAt: seen,
      updatedAt: seen,
      status: 'aktiv',
      completeness: 'ok',
      method: viaPortal ? 'portal' : 'html',
      psychTerms: gate.matched,
      lane,
      horizon: horizonInfo,
      newSite: !registered,
      foundVia: !registered ? 'erkundung' : viaPortal ? 'portal' : 'quelle',
      sources: [sourceRef],
    });
  });
}

const newSites = new Set(jobs.filter((j) => j.newSite).map((j) => siteKeyOf(j.url, j.employer)));
writeFileSync(
  out,
  JSON.stringify({
    generatedAt: batches[batches.length - 1].date,
    dates: batches.map((b) => b.date),
    cities: seed.cities,
    institutions: seed.institutions,
    sources: seed.sources,
    jobs,
  }),
);
console.log(
  `Demo-Daten: ${jobs.length} Anzeigen (${jobs.filter((j) => j.horizon).length} mit Horizont-Begründung, ${jobs.filter((j) => j.newSite).length} von ${newSites.size} neuen Websites), ` +
    `${seed.institutions.length} Einrichtungen, ${seed.sources.length} Quellen → ${out}`,
);
for (const j of jobs.filter((x) => x.newSite || x.horizon)) console.log(`  ${j.lane}${j.horizon ? ` / ${j.horizon.label}` : ''}${j.newSite ? ' / neue Website' : ''}: ${j.title.slice(0, 70)}`);
