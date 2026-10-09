// Baut die Daten für die Demo: echte Anzeigen (recherchiert am 09.10.2026, in eigenen Worten
// zusammengefasst) + Startdaten (Städte, Einrichtungen, Quellen).
//   npx tsx apps/web/scripts/build-demo-data.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jobIdForUrl, type Job, type JobKind } from '../../../packages/core/src';
import { loadSeed } from '../../ingest/src/seed';

const here = dirname(fileURLToPath(import.meta.url));
const research = resolve(here, '../../../data/research/beispielanzeigen-2026-10-09.json');
const out = resolve(here, '../src/data/demo-data.json');

interface Example {
  institution: string;
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
  summary: string;
  tasks: string[];
  requirements: string[];
  keywords: string[];
}

const examples = JSON.parse(readFileSync(research, 'utf8')) as Example[];
const seed = loadSeed();

const jobs: Job[] = examples.map((e, i) => {
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
  const seen = new Date(Date.UTC(2026, 9, 9, 6, 15 + i)).toISOString();
  const viaPortal = /psychjob\.eu/.test(e.url);
  return {
    id: jobIdForUrl(e.url),
    institutionId: e.institution,
    url: e.url,
    title: e.title,
    department: e.department,
    cityId: e.city,
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
    language: /^(PhD|Post-Doc|Postdoctoral|Doctoral)/.test(e.title) ? 'en' : 'de',
    firstSeenAt: seen,
    lastSeenAt: seen,
    updatedAt: seen,
    status: 'aktiv',
    completeness: 'ok',
    method: viaPortal ? 'portal' : 'html',
    psychTerms: [],
    sources: [viaPortal ? { sourceId: 'portal-psychjob', label: 'PsychJob (Hogrefe)', url: e.url } : { sourceId: `${e.institution}-z1`, label: 'Stellenseite der Einrichtung', url: e.url }],
  };
});

writeFileSync(
  out,
  JSON.stringify({
    generatedAt: '2026-10-09',
    cities: seed.cities,
    institutions: seed.institutions,
    sources: seed.sources,
    jobs,
  }),
);
console.log(`Demo-Daten: ${jobs.length} Anzeigen, ${seed.institutions.length} Einrichtungen, ${seed.sources.length} Quellen → ${out}`);
