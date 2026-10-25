// Baut die Daten für die Demo: erfundene Dummy-Anzeigen (data/dummy/anzeigen.json)
// + Startdaten (Städte, Einrichtungen, Quellen aus data/seed).
// Ring (Kern/Horizont), Brücken und „neue Website“ werden mit derselben Logik bestimmt wie in der Pipeline.
// Fristen und Fundtage stehen relativ zum Tag (rel), die App rechnet sie beim Laden auf heute um,
// damit die Dummy-Daten nie veralten.
//   npm run demo-data -w @stellen/web

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
  type JobSourceRef,
} from '../../../packages/core/src';
import { loadSeed } from '../../ingest/src/seed';

const here = dirname(fileURLToPath(import.meta.url));
const dummyFile = resolve(here, '../../../data/dummy/anzeigen.json');
const out = resolve(here, '../src/data/demo-data.json');

interface DummyExample {
  n: number;
  institution: string | null;
  employer?: string;
  city: string;
  kind: JobKind;
  title: string;
  department: string | null;
  pay_grade: string | null;
  pay_level: number | null;
  workload_pct: number | null;
  workload_text?: string | null;
  fixed_term: string | null;
  is_permanent: boolean | null;
  start: string | null;
  /** Tage ab heute; null = ohne Frist */
  deadline_in: number | null;
  deadline_check?: 'ok' | 'jahr' | 'ki' | 'unsicher';
  /** {frist} wird beim Laden durch das Datum ersetzt */
  deadline_note?: string;
  seen_days_ago: number;
  language?: 'de' | 'en';
  via?: 'quelle' | 'portal' | 'erkundung';
  also_portal?: boolean;
  lane?: 'weite';
  completeness?: 'teilweise';
  reference_no?: string;
  contact?: string;
  summary: string;
  tasks: string[];
  requirements: string[];
  offer?: string[];
  keywords: string[];
  why?: string;
  verdict?: 'passt' | 'eher';
  /** Beispiel für „Aussortiert“ statt einer Anzeige */
  skip?: boolean;
}

/** Relative Angaben, die DemoBackend beim Laden in echte Daten umrechnet. */
export interface DummyRel {
  deadline: number | null;
  seen: number;
}

const examples = JSON.parse(readFileSync(dummyFile, 'utf8')) as DummyExample[];
const seed = loadSeed();
const profile = starterProfile();
const horizon = profile.horizont!;
const institutions = new Map(seed.institutions.map((i) => [i.id, i]));

/** Erfundene Arbeitgeber bekommen eine Adresse unter .example (reservierte Endung, gehört niemandem). */
const slug = (s: string) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\(dummy\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function listUrlOf(instId: string): { url: string; sourceId: string; label: string } {
  const src = seed.sources.find((s) => s.institutionId === instId && s.url && s.kind === 'fachbereich') ?? seed.sources.find((s) => s.institutionId === instId && s.url);
  const inst = institutions.get(instId)!;
  if (src?.url) return { url: src.url, sourceId: src.id, label: src.kind === 'fachbereich' ? 'Stellenseite des Fachbereichs' : 'Stellenseite der Einrichtung' };
  return { url: inst.website ?? `https://${slug(inst.name)}.example/`, sourceId: `${instId}-z1`, label: 'Website der Einrichtung' };
}

const jobs: (Job & { rel: DummyRel })[] = [];
const skips: { title: string; institutionId: string | null; url: string; reason: string; note: string | null; seen: number }[] = [];

for (const e of examples) {
  if (e.institution && !institutions.has(e.institution)) throw new Error(`Dummy ${e.n}: Einrichtung ${e.institution} gibt es nicht in data/seed`);
  if (!seed.cities.some((c) => c.id === e.city)) throw new Error(`Dummy ${e.n}: Stadt ${e.city} gibt es nicht in data/seed`);
  const own = e.institution ? listUrlOf(e.institution) : null;
  const url = own?.url ?? `https://${slug(e.employer ?? `arbeitgeber-${e.n}`)}.example/karriere/${e.n}`;

  if (e.skip) {
    skips.push({ title: e.title, institutionId: e.institution, url, reason: 'grobfilter', note: null, seen: e.seen_days_ago });
    continue;
  }

  const md = [
    '> **Dummy-Anzeige.** Erfunden, damit sich die App ausprobieren lässt. ' +
      (own ? 'Der Link führt zur echten Stellenliste der Einrichtung; diese Stelle gibt es dort nicht.' : 'Den Arbeitgeber gibt es nicht.'),
    '',
    e.summary,
    '',
    '## Ihre Aufgaben',
    ...e.tasks.map((t) => `- ${t}`),
    '',
    '## Ihr Profil',
    ...e.requirements.map((t) => `- ${t}`),
    ...(e.offer?.length ? ['', '## Wir bieten', ...e.offer.map((t) => `- ${t}`)] : []),
    '',
    '## Bewerbung',
    e.deadline_in == null ? 'Bewerbungen sind laufend möglich.' : 'Bitte bewerben Sie sich bis zum {frist} über das Bewerbungsportal.',
    '',
    `**Schlagwörter:** ${e.keywords.join(', ')}`,
  ].join('\n');

  const norm = searchTextOf({ title: e.title, department: e.department, descriptionMd: md });
  const gate = checkGate(norm);
  const hits = matchBridges(norm, horizon);
  // Wie in der Pipeline: ohne Psychologie-Bezug kommt eine Anzeige nur über eine Brücke herein (Horizont).
  const lane = e.lane ?? (gate.pass ? 'kern' : hits.length ? 'horizont' : 'kern');
  const thematic = isThematic({ kind: e.kind }, norm, profile);
  const horizonInfo =
    lane === 'weite'
      ? { reason: e.why ?? null, verdict: e.verdict ?? 'eher', label: null, bridges: [] }
      : !thematic && hits.length && e.why
        ? { reason: e.why, verdict: e.verdict ?? null, label: hits[0].bridge.name, bridges: hits.map((h) => h.bridge.id) }
        : null;
  if (e.why && !horizonInfo) console.warn(`  Hinweis: Dummy ${e.n} hat eine Begründung, landet aber im Kern (${e.title.slice(0, 50)})`);

  const via = e.via ?? (e.institution ? 'quelle' : 'erkundung');
  const sources: JobSourceRef[] =
    via === 'erkundung'
      ? [{ sourceId: 'erkundung', label: 'Erkundung (neue Websites)', url }]
      : via === 'portal'
        ? [{ sourceId: 'portal-ba-jobsuche', label: 'Jobsuche der Arbeitsagentur', url }]
        : [{ sourceId: own!.sourceId, label: own!.label, url }];
  if (e.also_portal) sources.push({ sourceId: 'portal-psychjob', label: 'PsychJob (Hogrefe)', url: 'https://www.psychjob.eu/de/jobs/lehre-forschung' });

  const placeholderDate = '2000-01-01T12:00:00.000Z';
  jobs.push({
    id: jobIdForUrl(`https://dummy.stellenbuechlein.invalid/anzeige/${e.n}`),
    dummy: true,
    institutionId: e.institution,
    employer: e.employer ?? null,
    url,
    title: e.title,
    department: e.department,
    cityId: e.city,
    locationText: e.institution ? null : seed.cities.find((c) => c.id === e.city)?.name ?? null,
    descriptionMd: md,
    summary: e.summary.split(/(?<=[.!?])\s+/).slice(0, 2).join(' '),
    summaryByAi: true,
    kind: e.kind,
    payGrade: e.pay_grade,
    payLevel: e.pay_level,
    workloadPct: e.workload_pct,
    workloadText: e.workload_text ?? null,
    fixedTerm: e.fixed_term,
    isPermanent: e.is_permanent,
    startText: e.start,
    deadline: null,
    deadlineCheck: e.deadline_in == null ? null : (e.deadline_check ?? 'ok'),
    deadlineNote: e.deadline_note ?? null,
    referenceNo: e.reference_no ?? null,
    contact: e.contact ?? null,
    language: e.language ?? 'de',
    firstSeenAt: placeholderDate,
    lastSeenAt: placeholderDate,
    updatedAt: placeholderDate,
    status: 'aktiv',
    completeness: e.completeness ?? 'ok',
    method: via === 'portal' ? 'portal' : 'html',
    psychTerms: gate.matched,
    lane,
    horizon: horizonInfo,
    newSite: !e.institution,
    foundVia: via,
    sources,
    rel: { deadline: e.deadline_in, seen: e.seen_days_ago },
  });
}

/** Beispiel-Markierungen und Lieblingsorte, damit „Gemerkt“, Erinnerungen und Sortierung etwas zeigen. */
const byN = (n: number) => jobIdForUrl(`https://dummy.stellenbuechlein.invalid/anzeige/${n}`);
const marks = [
  { jobId: byN(13), decision: 'gemerkt', star: true, decidedDaysAgo: 2, note: 'Dummy-Notiz: Anschreiben bis Freitag fertig machen.' },
  { jobId: byN(2), decision: 'gemerkt', star: false, decidedDaysAgo: 3, appliedDaysAgo: 1 },
  { jobId: byN(8), decision: 'gemerkt', star: false, decidedDaysAgo: 0 },
  { jobId: byN(34), decision: 'gemerkt', star: true, decidedDaysAgo: 5 },
  { jobId: byN(10), decision: 'abgelehnt', star: false, decidedDaysAgo: 1 },
];
const favorites = [
  { kind: 'state', ref: 'ST' },
  { kind: 'city', ref: 'leipzig' },
];

// Auch die Läufe sind nachgestellt: ein Lauf von heute 12 Uhr mit plausiblen Zahlen
const newSites = new Set(jobs.filter((j) => j.newSite).map((j) => siteKeyOf(j.url, j.employer)));
const run = {
  stats: {
    neu: jobs.filter((j) => j.rel.seen === 0).length,
    neueWebsites: jobs.filter((j) => j.newSite && j.rel.seen === 0).length,
    erkundet: newSites.size,
    neuHorizont: jobs.filter((j) => j.lane === 'horizont').length,
    neuWeite: jobs.filter((j) => j.lane === 'weite').length,
    aktualisiert: 12,
    abgelaufen: 3,
    grobfilter: skips.length,
    fristUnsicher: jobs.filter((j) => j.deadlineCheck === 'unsicher').length,
    ki: 41,
  },
};

writeFileSync(
  out,
  JSON.stringify({
    dummy: true,
    cities: seed.cities,
    institutions: seed.institutions,
    sources: seed.sources,
    jobs,
    marks,
    favorites,
    skips,
    run,
  }),
);
console.log(
  `Dummy-Daten: ${jobs.length} Anzeigen (${jobs.filter((j) => j.lane === 'horizont').length} Horizont, ${jobs.filter((j) => j.lane === 'weite').length} Weite, ` +
    `${jobs.filter((j) => j.newSite).length} von ${newSites.size} neuen Websites), ${seed.institutions.length} Einrichtungen, ${seed.sources.length} Quellen → ${out}`,
);
for (const j of jobs.filter((x) => x.newSite || x.horizon)) console.log(`  ${j.lane}${j.horizon?.label ? ` / ${j.horizon.label}` : ''}${j.newSite ? ' / neue Website' : ''}: ${j.title.slice(0, 70)}`);
