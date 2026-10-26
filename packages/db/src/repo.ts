// Alle Datenbank-Abfragen an einer Stelle – genutzt von API (Worker/Node) und Einsammel-Pipeline.

import type {
  City,
  Favorite,
  FavoriteKind,
  Institution,
  Job,
  JobSourceRef,
  Mark,
  RunInfo,
  Source,
  SourceConfig,
  SourceStatus,
} from '@stellen/core';
import { nowIso, parseJson, type Db, type Stmt } from './db';

// ------------------------------------------------------------------ Zeilen-Typen

export interface JobRow {
  id: string;
  institution_id: string | null;
  url: string;
  canonical_url: string;
  title: string;
  department: string | null;
  location_text: string | null;
  city_id: string | null;
  lat: number | null;
  lon: number | null;
  description_md: string;
  summary: string | null;
  summary_ai: number;
  kind: string | null;
  pay_grade: string | null;
  pay_level: number | null;
  workload_pct: number | null;
  workload_text: string | null;
  fixed_term: string | null;
  is_permanent: number | null;
  start_text: string | null;
  deadline: string | null;
  deadline_text: string | null;
  reference_no: string | null;
  contact: string | null;
  language: string | null;
  image_url: string | null;
  image_kind: string | null;
  image_credit: string | null;
  pdf_url: string | null;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
  content_hash: string;
  fuzzy_key: string | null;
  status: string;
  completeness: string;
  method: string | null;
  psych_terms: string | null;
  extra: string;
  deadline_check: string | null;
  deadline_note: string | null;
  lane: string | null;
  horizon: string | null;
  new_site: number | null;
  found_via: string | null;
  employer: string | null;
}

export const JOB_COLUMNS = [
  'id', 'institution_id', 'url', 'canonical_url', 'title', 'department', 'location_text', 'city_id', 'lat', 'lon',
  'description_md', 'summary', 'summary_ai', 'kind', 'pay_grade', 'pay_level', 'workload_pct', 'workload_text',
  'fixed_term', 'is_permanent', 'start_text', 'deadline', 'deadline_text', 'reference_no', 'contact', 'language',
  'image_url', 'image_kind', 'image_credit', 'pdf_url', 'posted_at', 'first_seen_at', 'last_seen_at', 'updated_at',
  'content_hash', 'fuzzy_key', 'status', 'completeness', 'method', 'psych_terms', 'extra',
  'deadline_check', 'deadline_note', 'lane', 'horizon', 'new_site', 'found_via', 'employer',
] as const;

export function rowToJob(r: JobRow, sources?: JobSourceRef[]): Job {
  return {
    id: r.id,
    institutionId: r.institution_id,
    url: r.url,
    title: r.title,
    department: r.department,
    locationText: r.location_text,
    cityId: r.city_id,
    lat: r.lat,
    lon: r.lon,
    descriptionMd: r.description_md,
    summary: r.summary,
    summaryByAi: !!r.summary_ai,
    kind: (r.kind as Job['kind']) ?? null,
    payGrade: r.pay_grade,
    payLevel: r.pay_level,
    workloadPct: r.workload_pct,
    workloadText: r.workload_text,
    fixedTerm: r.fixed_term,
    isPermanent: r.is_permanent == null ? null : !!r.is_permanent,
    startText: r.start_text,
    deadline: r.deadline,
    deadlineText: r.deadline_text,
    referenceNo: r.reference_no,
    contact: r.contact,
    language: (r.language as Job['language']) ?? null,
    imageUrl: r.image_url,
    imageKind: (r.image_kind as Job['imageKind']) ?? null,
    imageCredit: r.image_credit,
    pdfUrl: r.pdf_url,
    postedAt: r.posted_at,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    updatedAt: r.updated_at,
    status: r.status === 'abgelaufen' ? 'abgelaufen' : 'aktiv',
    completeness: r.completeness === 'teilweise' ? 'teilweise' : 'ok',
    method: r.method,
    psychTerms: parseJson<string[]>(r.psych_terms, []),
    sources,
    deadlineCheck: (r.deadline_check as Job['deadlineCheck']) ?? null,
    deadlineNote: r.deadline_note ?? null,
    lane: (r.lane as Job['lane']) ?? null,
    horizon: parseJson<Job['horizon']>(r.horizon, null),
    newSite: !!r.new_site,
    foundVia: (r.found_via as Job['foundVia']) ?? null,
    employer: r.employer ?? null,
  };
}

/** Datensatz, den die Pipeline schreibt. */
export interface JobWrite extends Job {
  canonicalUrl: string;
  contentHash: string;
  fuzzyKey: string | null;
  extra?: Record<string, unknown>;
}

export function jobToRowValues(j: JobWrite): unknown[] {
  const map: Record<(typeof JOB_COLUMNS)[number], unknown> = {
    id: j.id,
    institution_id: j.institutionId,
    url: j.url,
    canonical_url: j.canonicalUrl,
    title: j.title,
    department: j.department ?? null,
    location_text: j.locationText ?? null,
    city_id: j.cityId ?? null,
    lat: j.lat ?? null,
    lon: j.lon ?? null,
    description_md: j.descriptionMd,
    summary: j.summary ?? null,
    summary_ai: j.summaryByAi ? 1 : 0,
    kind: j.kind,
    pay_grade: j.payGrade ?? null,
    pay_level: j.payLevel ?? null,
    workload_pct: j.workloadPct ?? null,
    workload_text: j.workloadText ?? null,
    fixed_term: j.fixedTerm ?? null,
    is_permanent: j.isPermanent == null ? null : j.isPermanent ? 1 : 0,
    start_text: j.startText ?? null,
    deadline: j.deadline ?? null,
    deadline_text: j.deadlineText ?? null,
    reference_no: j.referenceNo ?? null,
    contact: j.contact ?? null,
    language: j.language ?? null,
    image_url: j.imageUrl ?? null,
    image_kind: j.imageKind ?? null,
    image_credit: j.imageCredit ?? null,
    pdf_url: j.pdfUrl ?? null,
    posted_at: j.postedAt ?? null,
    first_seen_at: j.firstSeenAt,
    last_seen_at: j.lastSeenAt,
    updated_at: j.updatedAt,
    content_hash: j.contentHash,
    fuzzy_key: j.fuzzyKey,
    status: j.status,
    completeness: j.completeness,
    method: j.method ?? null,
    psych_terms: JSON.stringify(j.psychTerms ?? []),
    extra: JSON.stringify(j.extra ?? {}),
    deadline_check: j.deadlineCheck ?? null,
    deadline_note: j.deadlineNote ?? null,
    lane: j.lane ?? null,
    horizon: j.horizon ? JSON.stringify(j.horizon) : null,
    new_site: j.newSite ? 1 : 0,
    found_via: j.foundVia ?? null,
    employer: j.employer ?? null,
  };
  return JOB_COLUMNS.map((c) => map[c]);
}

const UPSERT_JOB_SQL = `INSERT INTO jobs (${JOB_COLUMNS.join(', ')}) VALUES (${JOB_COLUMNS.map(() => '?').join(', ')})
ON CONFLICT(id) DO UPDATE SET ${JOB_COLUMNS.filter((c) => c !== 'id' && c !== 'first_seen_at')
  .map((c) => `${c} = excluded.${c}`)
  .join(', ')}`;

export function upsertJobStmt(j: JobWrite): Stmt {
  return { sql: UPSERT_JOB_SQL, params: jobToRowValues(j) };
}

// ------------------------------------------------------------------ Orte und Einrichtungen

interface CityRow {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  wiki_de: string | null;
  image_url: string | null;
  image_credit: string | null;
}

interface InstitutionRow {
  id: string;
  name: string;
  short_name: string | null;
  kind: string;
  city_id: string | null;
  lat: number | null;
  lon: number | null;
  website: string | null;
  wiki_de: string | null;
  image_url: string | null;
  image_credit: string | null;
  active: number;
  origin: string;
}

export async function listCities(db: Db): Promise<City[]> {
  const rows = await db.all<CityRow>('SELECT id, name, state, lat, lon, wiki_de, image_url, image_credit FROM cities ORDER BY name');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    state: r.state as City['state'],
    lat: r.lat,
    lon: r.lon,
    wikiDe: r.wiki_de,
    imageUrl: r.image_url,
    imageCredit: r.image_credit,
  }));
}

export async function listInstitutions(db: Db): Promise<Institution[]> {
  const rows = await db.all<InstitutionRow>(
    'SELECT id, name, short_name, kind, city_id, lat, lon, website, wiki_de, image_url, image_credit, active, origin FROM institutions ORDER BY name',
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.short_name,
    kind: r.kind as Institution['kind'],
    cityId: r.city_id,
    lat: r.lat,
    lon: r.lon,
    website: r.website,
    wikiDe: r.wiki_de,
    imageUrl: r.image_url,
    imageCredit: r.image_credit,
    active: !!r.active,
    origin: (r.origin as Institution['origin']) ?? 'seed',
  }));
}

export function upsertCityStmt(c: City): Stmt {
  return {
    sql: `INSERT INTO cities (id, name, state, lat, lon, wiki_de) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, state = excluded.state, lat = excluded.lat, lon = excluded.lon,
          wiki_de = COALESCE(excluded.wiki_de, cities.wiki_de)`,
    params: [c.id, c.name, c.state, c.lat, c.lon, c.wikiDe ?? null],
  };
}

export function upsertInstitutionStmt(i: Institution, now = nowIso()): Stmt {
  return {
    sql: `INSERT INTO institutions (id, name, short_name, kind, city_id, lat, lon, website, wiki_de, active, origin, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, short_name = excluded.short_name, kind = excluded.kind,
          city_id = excluded.city_id, lat = COALESCE(excluded.lat, institutions.lat), lon = COALESCE(excluded.lon, institutions.lon),
          website = COALESCE(excluded.website, institutions.website), wiki_de = COALESCE(excluded.wiki_de, institutions.wiki_de)`,
    params: [i.id, i.name, i.shortName ?? null, i.kind, i.cityId, i.lat ?? null, i.lon ?? null, i.website ?? null, i.wikiDe ?? null, i.active ? 1 : 0, i.origin, now],
  };
}

export async function setInstitutionImage(db: Db, id: string, url: string | null, credit: string | null): Promise<void> {
  await db.run('UPDATE institutions SET image_url = ?, image_credit = ?, image_checked_at = ? WHERE id = ?', [url, credit, nowIso(), id]);
}

export async function setCityImage(db: Db, id: string, url: string | null, credit: string | null): Promise<void> {
  await db.run('UPDATE cities SET image_url = ?, image_credit = ?, image_checked_at = ? WHERE id = ?', [url, credit, nowIso(), id]);
}

export async function imagesToCheck(db: Db, olderThanIso: string): Promise<{ kind: 'city' | 'institution'; id: string; wikiDe: string; website: string | null }[]> {
  const cities = await db.all<{ id: string; wiki_de: string }>(
    "SELECT id, COALESCE(wiki_de, name) AS wiki_de FROM cities WHERE image_url IS NULL AND (image_checked_at IS NULL OR image_checked_at < ?)",
    [olderThanIso],
  );
  const insts = await db.all<{ id: string; wiki_de: string; website: string | null }>(
    "SELECT id, wiki_de, website FROM institutions WHERE image_url IS NULL AND wiki_de IS NOT NULL AND (image_checked_at IS NULL OR image_checked_at < ?)",
    [olderThanIso],
  );
  return [
    ...insts.map((r) => ({ kind: 'institution' as const, id: r.id, wikiDe: r.wiki_de, website: r.website })),
    ...cities.map((r) => ({ kind: 'city' as const, id: r.id, wikiDe: r.wiki_de, website: null })),
  ];
}

// ------------------------------------------------------------------ Quellen

interface SourceRow {
  id: string;
  institution_id: string | null;
  kind: string;
  label: string | null;
  url: string | null;
  adapter: string;
  config: string;
  gate: string;
  enabled: number;
  verified: number;
  status: string;
  status_note: string | null;
  last_run_at: string | null;
  last_ok_at: string | null;
  last_count: number | null;
  consecutive_failures: number;
  methods_used: string | null;
}

function rowToSource(r: SourceRow): Source {
  return {
    id: r.id,
    institutionId: r.institution_id,
    kind: r.kind as Source['kind'],
    label: r.label,
    url: r.url,
    adapter: r.adapter,
    config: parseJson<SourceConfig>(r.config, {}),
    gate: r.gate === 'none' ? 'none' : 'psych',
    enabled: !!r.enabled,
    verified: !!r.verified,
    status: r.status as SourceStatus,
    statusNote: r.status_note,
    lastRunAt: r.last_run_at,
    lastOkAt: r.last_ok_at,
    lastCount: r.last_count,
    consecutiveFailures: r.consecutive_failures,
    methodsUsed: parseJson<string[]>(r.methods_used, []),
  };
}

export async function listSources(db: Db, onlyEnabled = false): Promise<Source[]> {
  const rows = await db.all<SourceRow>(
    `SELECT * FROM sources ${onlyEnabled ? 'WHERE enabled = 1' : ''} ORDER BY kind = 'portal' DESC, institution_id, id`,
  );
  return rows.map(rowToSource);
}

export async function getSource(db: Db, id: string): Promise<Source | null> {
  const r = await db.first<SourceRow>('SELECT * FROM sources WHERE id = ?', [id]);
  return r ? rowToSource(r) : null;
}

export function upsertSourceStmt(s: Source, now = nowIso()): Stmt {
  return {
    sql: `INSERT INTO sources (id, institution_id, kind, label, url, adapter, config, gate, enabled, verified, status, status_note, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET institution_id = excluded.institution_id, kind = excluded.kind, label = excluded.label,
          url = CASE WHEN sources.verified = 1 THEN sources.url ELSE excluded.url END,
          adapter = excluded.adapter, config = excluded.config, gate = excluded.gate, updated_at = excluded.updated_at`,
    params: [
      s.id, s.institutionId, s.kind, s.label, s.url, s.adapter, JSON.stringify(s.config ?? {}), s.gate,
      s.enabled ? 1 : 0, s.verified ? 1 : 0, s.url ? s.status : 'url-fehlt', s.statusNote ?? null, now,
    ],
  };
}

export interface SourcePatch {
  url?: string | null;
  enabled?: boolean;
  gate?: 'none' | 'psych';
  label?: string | null;
  config?: SourceConfig;
  verified?: boolean;
}

export async function patchSource(db: Db, id: string, p: SourcePatch): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (p.url !== undefined) {
    sets.push('url = ?', "status = CASE WHEN ? IS NULL THEN 'url-fehlt' ELSE 'neu' END", 'consecutive_failures = 0');
    params.push(p.url, p.url);
  }
  const add = (col: string, value: unknown) => {
    sets.push(`${col} = ?`);
    params.push(value);
  };
  if (p.enabled !== undefined) add('enabled', p.enabled ? 1 : 0);
  if (p.gate !== undefined) add('gate', p.gate);
  if (p.label !== undefined) add('label', p.label);
  if (p.config !== undefined) add('config', JSON.stringify(p.config));
  if (p.verified !== undefined) add('verified', p.verified ? 1 : 0);
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(nowIso(), id);
  await db.run(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`, params);
}

export interface SourceRunResult {
  status: SourceStatus;
  note: string | null;
  count: number | null;
  methods: string[];
  ok: boolean;
}

export function sourceRunStmt(id: string, r: SourceRunResult, now = nowIso()): Stmt {
  return {
    sql: `UPDATE sources SET status = ?, status_note = ?, last_run_at = ?, last_count = COALESCE(?, last_count),
          methods_used = ?, last_ok_at = CASE WHEN ? = 1 THEN ? ELSE last_ok_at END,
          consecutive_failures = CASE WHEN ? = 1 THEN 0 ELSE consecutive_failures + 1 END, updated_at = ? WHERE id = ?`,
    params: [r.status, r.note, now, r.count, JSON.stringify(r.methods), r.ok ? 1 : 0, now, r.ok ? 1 : 0, now, id],
  };
}

export interface Suggestion {
  id: number;
  institutionId: string;
  url: string;
  reason: string | null;
  foundAt: string;
  status: string;
}

export async function listSuggestions(db: Db, status = 'offen'): Promise<Suggestion[]> {
  const rows = await db.all<{ id: number; institution_id: string; url: string; reason: string | null; found_at: string; status: string }>(
    'SELECT * FROM source_suggestions WHERE status = ? ORDER BY found_at DESC LIMIT 200',
    [status],
  );
  return rows.map((r) => ({ id: r.id, institutionId: r.institution_id, url: r.url, reason: r.reason, foundAt: r.found_at, status: r.status }));
}

export function addSuggestionStmt(institutionId: string, url: string, reason: string, now = nowIso()): Stmt {
  return {
    sql: 'INSERT INTO source_suggestions (institution_id, url, reason, found_at) VALUES (?, ?, ?, ?) ON CONFLICT(institution_id, url) DO NOTHING',
    params: [institutionId, url, reason, now],
  };
}

export async function resolveSuggestion(db: Db, id: number, accept: boolean): Promise<Suggestion | null> {
  const s = await db.first<{ id: number; institution_id: string; url: string; reason: string | null; found_at: string; status: string }>(
    'SELECT * FROM source_suggestions WHERE id = ?',
    [id],
  );
  if (!s) return null;
  await db.run('UPDATE source_suggestions SET status = ? WHERE id = ?', [accept ? 'uebernommen' : 'verworfen', id]);
  if (accept) {
    const existing = await db.first<{ id: string }>(
      "SELECT id FROM sources WHERE institution_id = ? AND (url IS NULL OR status = 'url-fehlt') ORDER BY kind = 'zentral' DESC LIMIT 1",
      [s.institution_id],
    );
    const now = nowIso();
    if (existing) {
      await db.run("UPDATE sources SET url = ?, verified = 1, status = 'neu', consecutive_failures = 0, updated_at = ? WHERE id = ?", [s.url, now, existing.id]);
    } else {
      await db.run(
        `INSERT INTO sources (id, institution_id, kind, label, url, adapter, config, gate, enabled, verified, status, updated_at)
         VALUES (?, ?, 'zentral', 'Vorschlag übernommen', ?, 'auto', '{}', 'psych', 1, 1, 'neu', ?)`,
        [`${s.institution_id}-v${s.id}`, s.institution_id, s.url, now],
      );
    }
  }
  return { id: s.id, institutionId: s.institution_id, url: s.url, reason: s.reason, foundAt: s.found_at, status: accept ? 'uebernommen' : 'verworfen' };
}

// ------------------------------------------------------------------ Anzeigen

export interface SyncPage {
  jobs: Job[];
  next: string | null;
}

/** Cursor-Format: "<updated_at>|<id>". Leerer Cursor = alles. Anzeigen in Prüfung (Status „pruefung“) sieht die App noch nicht. */
export async function syncJobs(db: Db, cursor: string, limit = 100): Promise<SyncPage> {
  const [since, sinceId] = cursor ? [cursor.split('|')[0], cursor.split('|')[1] ?? ''] : ['', ''];
  const rows = await db.all<JobRow>(
    `SELECT * FROM jobs WHERE (updated_at > ? OR (updated_at = ? AND id > ?)) AND status <> 'pruefung' ORDER BY updated_at, id LIMIT ?`,
    [since, since, sinceId, limit],
  );
  const refs = await jobSourcesFor(db, rows.map((r) => r.id));
  const jobs = rows.map((r) => rowToJob(r, refs.get(r.id) ?? []));
  const last = rows[rows.length - 1];
  return { jobs, next: rows.length === limit && last ? `${last.updated_at}|${last.id}` : null };
}

export function cursorAfter(jobs: Job[], fallback: string): string {
  const last = jobs[jobs.length - 1];
  return last ? `${last.updatedAt}|${last.id}` : fallback;
}

export async function jobSourcesFor(db: Db, ids: string[]): Promise<Map<string, JobSourceRef[]>> {
  const out = new Map<string, JobSourceRef[]>();
  if (ids.length === 0) return out;
  const rows = await db.all<{ job_id: string; source_id: string; url: string; label: string | null; kind: string | null; inst: string | null }>(
    `SELECT js.job_id, js.source_id, js.url, s.label, s.kind, i.short_name AS inst
     FROM job_sources js LEFT JOIN sources s ON s.id = js.source_id LEFT JOIN institutions i ON i.id = s.institution_id
     WHERE js.job_id IN (SELECT value FROM json_each(?)) ORDER BY js.first_seen_at`,
    [JSON.stringify(ids)],
  );
  for (const r of rows) {
    const label = r.label ?? (r.kind === 'portal' ? r.source_id : r.inst ? `${r.inst}` : r.source_id);
    const list = out.get(r.job_id) ?? [];
    list.push({ sourceId: r.source_id, label, url: r.url });
    out.set(r.job_id, list);
  }
  return out;
}

export async function getJob(db: Db, id: string): Promise<Job | null> {
  const r = await db.first<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!r) return null;
  const refs = await jobSourcesFor(db, [id]);
  return rowToJob(r, refs.get(id) ?? []);
}

export async function deletedSince(db: Db, since: string): Promise<string[]> {
  if (!since) return [];
  const rows = await db.all<{ id: string }>('SELECT id FROM deleted_jobs WHERE deleted_at > ? LIMIT 5000', [since]);
  return rows.map((r) => r.id);
}

export interface JobIndexEntry {
  id: string;
  canonicalUrl: string;
  contentHash: string;
  fuzzyKey: string | null;
  status: string;
  completeness: string;
  institutionId: string | null;
  title: string;
  deadline: string | null;
  descriptionLength: number;
  cityId: string | null;
  locationText: string | null;
}

export async function loadJobIndex(db: Db): Promise<JobIndexEntry[]> {
  const rows = await db.all<{
    id: string;
    canonical_url: string;
    content_hash: string;
    fuzzy_key: string | null;
    status: string;
    completeness: string;
    institution_id: string | null;
    title: string;
    deadline: string | null;
    len: number;
    city_id: string | null;
    location_text: string | null;
  }>(
    'SELECT id, canonical_url, content_hash, fuzzy_key, status, completeness, institution_id, title, deadline, length(description_md) AS len, city_id, location_text FROM jobs',
  );
  return rows.map((r) => ({
    id: r.id,
    canonicalUrl: r.canonical_url,
    contentHash: r.content_hash,
    fuzzyKey: r.fuzzy_key,
    status: r.status,
    completeness: r.completeness,
    institutionId: r.institution_id,
    title: r.title,
    deadline: r.deadline,
    descriptionLength: r.len,
    cityId: r.city_id,
    locationText: r.location_text,
  }));
}

export function touchJobSourceStmt(jobId: string, sourceId: string, url: string, now = nowIso()): Stmt {
  return {
    sql: `INSERT INTO job_sources (job_id, source_id, url, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(job_id, source_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, url = excluded.url`,
    params: [jobId, sourceId, url, now, now],
  };
}

export function markSeenStmt(jobId: string, now = nowIso()): Stmt {
  return { sql: 'UPDATE jobs SET last_seen_at = ? WHERE id = ?', params: [now, jobId] };
}

/** Weitere Adresse derselben Anzeige (Dublette) merken; url ist die vereinheitlichte Adresse. */
export function jobAliasStmt(url: string, jobId: string, sourceId: string | null, now = nowIso()): Stmt {
  return {
    sql: `INSERT INTO job_aliases (url, job_id, source_id, seen_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET job_id = excluded.job_id, seen_at = excluded.seen_at`,
    params: [url, jobId, sourceId, now],
  };
}

export async function loadJobAliases(db: Db): Promise<{ url: string; jobId: string }[]> {
  const rows = await db.all<{ url: string; job_id: string }>('SELECT url, job_id FROM job_aliases');
  return rows.map((r) => ({ url: r.url, jobId: r.job_id }));
}

/**
 * Gibt Anzeigen in Prüfung frei, sobald keine Auswertung mehr offen ist: Claude hat sie als Anzeige bestätigt
 * (sonst wären sie gelöscht) oder konnte sie nach drei Versuchen nicht beurteilen – dann lieber zeigen als verlieren.
 */
export async function releaseCheckedJobs(db: Db, today: string, now = nowIso()): Promise<number> {
  const r = await db.run(
    `UPDATE jobs SET status = CASE WHEN deadline IS NOT NULL AND deadline < ? THEN 'abgelaufen' ELSE 'aktiv' END, updated_at = ?
     WHERE status = 'pruefung' AND NOT EXISTS (SELECT 1 FROM ki_aufgaben k WHERE k.job_id = jobs.id AND k.art = 'auswerten' AND k.status = 'offen')`,
    [today, now],
  );
  return r.changes;
}

/**
 * Setzt Anzeigen auf "abgelaufen": Frist vorbei, oder seit `goneDays` Tagen in keiner Quelle mehr gesehen
 * (aber nur, wenn ihre Quellen inzwischen erfolgreich gelaufen sind – sonst wäre ein Quellenausfall ein falscher Ablauf).
 */
export async function expireJobs(db: Db, today: string, goneBeforeIso: string, now = nowIso(), exploredGoneBeforeIso?: string): Promise<number> {
  const a = await db.run(
    "UPDATE jobs SET status = 'abgelaufen', updated_at = ? WHERE status = 'aktiv' AND deadline IS NOT NULL AND deadline < ?",
    [now, today],
  );
  const b = await db.run(
    `UPDATE jobs SET status = 'abgelaufen', updated_at = ? WHERE status = 'aktiv' AND last_seen_at < ?
     AND NOT EXISTS (
       SELECT 1 FROM job_sources js JOIN sources s ON s.id = js.source_id
       WHERE js.job_id = jobs.id AND (s.last_ok_at IS NULL OR s.last_ok_at < ?)
     )`,
    [now, goneBeforeIso, goneBeforeIso],
  );
  // Über die Erkundung gefundene Anzeigen ohne Frist werden nicht jeden Tag wieder gelistet:
  // Sie gelten nach längerer Zeit ohne neuen Fund als abgelaufen.
  let c = { changes: 0 };
  if (exploredGoneBeforeIso) {
    c = await db.run(
      `UPDATE jobs SET status = 'abgelaufen', updated_at = ? WHERE status = 'aktiv' AND deadline IS NULL AND found_via = 'erkundung'
       AND last_seen_at < ? AND NOT EXISTS (SELECT 1 FROM job_sources js WHERE js.job_id = jobs.id AND js.source_id <> 'erkundung')`,
      [now, exploredGoneBeforeIso],
    );
  }
  return a.changes + b.changes + c.changes;
}

/** Eine Anzeige, die zuerst ohne Einrichtung gefunden wurde, taucht jetzt in einer Quelle mit Einrichtung auf. */
export function linkJobInstitutionStmt(jobId: string, institutionId: string, now = nowIso()): Stmt {
  return {
    sql: 'UPDATE jobs SET institution_id = ?, new_site = 0, updated_at = ? WHERE id = ? AND institution_id IS NULL',
    params: [institutionId, now, jobId],
  };
}

/** Löscht abgelaufene Anzeigen nach einer Schonfrist – außer gemerkte/markierte. Legt Grabsteine für die App an. */
export async function purgeExpired(db: Db, olderThanIso: string, now = nowIso()): Promise<number> {
  const victims = await db.all<{ id: string }>(
    `SELECT id FROM jobs WHERE status = 'abgelaufen' AND updated_at < ?
     AND id NOT IN (SELECT job_id FROM marks WHERE decision = 'gemerkt' OR star = 1 OR applied_at IS NOT NULL)`,
    [olderThanIso],
  );
  if (victims.length === 0) return 0;
  const stmts: Stmt[] = [];
  for (const v of victims) {
    stmts.push({ sql: 'DELETE FROM jobs WHERE id = ?', params: [v.id] });
    stmts.push({ sql: 'DELETE FROM job_sources WHERE job_id = ?', params: [v.id] });
    stmts.push({ sql: 'DELETE FROM job_aliases WHERE job_id = ?', params: [v.id] });
    stmts.push({ sql: "DELETE FROM marks WHERE job_id = ? AND decision = 'abgelehnt'", params: [v.id] });
    stmts.push({ sql: 'INSERT OR REPLACE INTO deleted_jobs (id, deleted_at) VALUES (?, ?)', params: [v.id, now] });
  }
  await db.batch(stmts);
  return victims.length;
}

export interface GateSkipInput {
  url: string;
  sourceId: string;
  institutionId: string | null;
  title: string;
  textHash: string;
  /** grobfilter (kein Psychologie-Bezug, keine Brücke) | ki-nein (KI: passt nicht) | keine-anzeige (Claude, von Hand) | regel-keine-anzeige (Regeln) | ausland */
  reason?: string;
  note?: string | null;
}

export function gateSkipStmt(p: GateSkipInput, now = nowIso()): Stmt {
  return {
    sql: `INSERT INTO gate_skips (url, source_id, institution_id, title, text_hash, seen_at, reason, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET seen_at = excluded.seen_at, title = excluded.title, text_hash = excluded.text_hash,
          reason = excluded.reason, note = excluded.note`,
    params: [p.url, p.sourceId, p.institutionId, p.title, p.textHash, now, p.reason ?? 'grobfilter', p.note ?? null],
  };
}

export interface GateSkipRecord {
  url: string;
  title: string | null;
  sourceId: string | null;
  institutionId: string | null;
  seenAt: string;
  reason: string | null;
  note: string | null;
}

export async function listGateSkips(db: Db, limit = 300): Promise<GateSkipRecord[]> {
  const rows = await db.all<{ url: string; title: string | null; source_id: string | null; institution_id: string | null; seen_at: string; reason: string | null; note: string | null }>(
    'SELECT * FROM gate_skips ORDER BY seen_at DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({ url: r.url, title: r.title, sourceId: r.source_id, institutionId: r.institution_id, seenAt: r.seen_at, reason: r.reason ?? 'grobfilter', note: r.note }));
}

export async function loadGateSkipIndex(db: Db): Promise<Map<string, string>> {
  const rows = await db.all<{ url: string; text_hash: string | null }>('SELECT url, text_hash FROM gate_skips');
  return new Map(rows.map((r) => [r.url, r.text_hash ?? '']));
}

// ------------------------------------------------------------------ Neu entdeckte Websites

export interface Discovery {
  siteKey: string;
  name: string | null;
  sampleUrl: string | null;
  jobs: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: 'offen' | 'geprueft' | 'uebernommen' | 'ignoriert';
}

/** Merkt sich eine Website (oder einen Arbeitgeber), die nicht im Register steht. */
export function discoveryStmt(siteKey: string, name: string | null, sampleUrl: string | null, now = nowIso()): Stmt {
  return {
    sql: `INSERT INTO discoveries (site_key, name, sample_url, jobs, first_seen_at, last_seen_at) VALUES (?, ?, ?, 1, ?, ?)
          ON CONFLICT(site_key) DO UPDATE SET jobs = discoveries.jobs + 1, last_seen_at = excluded.last_seen_at,
          name = COALESCE(discoveries.name, excluded.name), sample_url = COALESCE(excluded.sample_url, discoveries.sample_url)`,
    params: [siteKey, name, sampleUrl, now, now],
  };
}

export async function listDiscoveries(db: Db, status: Discovery['status'] | 'alle' = 'offen', limit = 100): Promise<Discovery[]> {
  const rows = await db.all<{ site_key: string; name: string | null; sample_url: string | null; jobs: number; first_seen_at: string; last_seen_at: string; status: string }>(
    `SELECT * FROM discoveries ${status === 'alle' ? '' : 'WHERE status = ?'} ORDER BY last_seen_at DESC LIMIT ?`,
    status === 'alle' ? [limit] : [status, limit],
  );
  return rows.map((r) => ({
    siteKey: r.site_key,
    name: r.name,
    sampleUrl: r.sample_url,
    jobs: r.jobs,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    status: r.status as Discovery['status'],
  }));
}

export async function setDiscoveryStatus(db: Db, siteKey: string, status: Discovery['status']): Promise<boolean> {
  const r = await db.run('UPDATE discoveries SET status = ? WHERE site_key = ?', [status, siteKey]);
  return r.changes > 0;
}

// ------------------------------------------------------------------ Probeläufe für neue Quellen

export type SourceCheckStatus = 'wartet' | 'laeuft' | 'fertig' | 'fehler' | 'uebernommen' | 'verworfen';

export interface SourceCheckRecord<R = unknown> {
  id: number;
  url: string;
  sourceId: string | null;
  status: SourceCheckStatus;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  result: R | null;
  error: string | null;
}

interface SourceCheckRow {
  id: number;
  url: string;
  source_id: string | null;
  status: string;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  result: string | null;
  error: string | null;
}

function rowToCheck<R>(r: SourceCheckRow): SourceCheckRecord<R> {
  return {
    id: r.id,
    url: r.url,
    sourceId: r.source_id,
    status: r.status as SourceCheckStatus,
    requestedAt: r.requested_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    result: parseJson<R | null>(r.result, null),
    error: r.error,
  };
}

export async function createSourceCheck(db: Db, url: string, sourceId: string | null = null, now = nowIso()): Promise<SourceCheckRecord> {
  // Läuft für dieselbe Adresse schon ein Probelauf, wird kein zweiter angelegt.
  const open = await db.first<SourceCheckRow>("SELECT * FROM source_checks WHERE url = ? AND status IN ('wartet', 'laeuft') ORDER BY id DESC LIMIT 1", [url]);
  if (open) return rowToCheck(open);
  await db.run('INSERT INTO source_checks (url, source_id, status, requested_at) VALUES (?, ?, ?, ?)', [url, sourceId, 'wartet', now]);
  const r = await db.first<SourceCheckRow>('SELECT * FROM source_checks WHERE url = ? AND requested_at = ? ORDER BY id DESC LIMIT 1', [url, now]);
  return rowToCheck(r!);
}

export async function getSourceCheck<R = unknown>(db: Db, id: number): Promise<SourceCheckRecord<R> | null> {
  const r = await db.first<SourceCheckRow>('SELECT * FROM source_checks WHERE id = ?', [id]);
  return r ? rowToCheck<R>(r) : null;
}

export async function listSourceChecks<R = unknown>(db: Db, limit = 20): Promise<SourceCheckRecord<R>[]> {
  const rows = await db.all<SourceCheckRow>('SELECT * FROM source_checks ORDER BY id DESC LIMIT ?', [limit]);
  return rows.map((r) => rowToCheck<R>(r));
}

/** Wartende Probeläufe (und solche, die seit über einer Stunde „laufen“, also abgebrochen sind). */
export async function pendingSourceChecks(db: Db, staleBeforeIso: string, limit = 5): Promise<SourceCheckRecord[]> {
  const rows = await db.all<SourceCheckRow>(
    "SELECT * FROM source_checks WHERE status = 'wartet' OR (status = 'laeuft' AND started_at < ?) ORDER BY id LIMIT ?",
    [staleBeforeIso, limit],
  );
  return rows.map((r) => rowToCheck(r));
}

export async function startSourceCheck(db: Db, id: number, now = nowIso()): Promise<void> {
  await db.run("UPDATE source_checks SET status = 'laeuft', started_at = ? WHERE id = ?", [now, id]);
}

export async function finishSourceCheck(db: Db, id: number, result: unknown | null, error: string | null, now = nowIso()): Promise<void> {
  await db.run('UPDATE source_checks SET status = ?, finished_at = ?, result = ?, error = ? WHERE id = ?', [
    error ? 'fehler' : 'fertig',
    now,
    result == null ? null : JSON.stringify(result),
    error,
    id,
  ]);
}

export async function setSourceCheckStatus(db: Db, id: number, status: SourceCheckStatus): Promise<void> {
  await db.run('UPDATE source_checks SET status = ? WHERE id = ?', [status, id]);
}

// ------------------------------------------------------------------ Markierungen, Lieblingsorte, Einstellungen

interface MarkRow {
  job_id: string;
  decision: string | null;
  decided_at: string | null;
  star: number;
  applied_at: string | null;
  note: string | null;
  updated_at: string;
}

function rowToMark(r: MarkRow): Mark {
  return {
    jobId: r.job_id,
    decision: (r.decision as Mark['decision']) ?? null,
    decidedAt: r.decided_at,
    star: !!r.star,
    appliedAt: r.applied_at,
    note: r.note,
    updatedAt: r.updated_at,
  };
}

export async function listMarks(db: Db): Promise<Mark[]> {
  return (await db.all<MarkRow>('SELECT * FROM marks')).map(rowToMark);
}

/** Speichert eine Markierung. Bei Konflikten gewinnt der neuere Zeitstempel (offline geänderte Handys). */
export function upsertMarkStmt(m: Mark): Stmt {
  return {
    sql: `INSERT INTO marks (job_id, decision, decided_at, star, applied_at, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(job_id) DO UPDATE SET decision = excluded.decision, decided_at = excluded.decided_at, star = excluded.star,
          applied_at = excluded.applied_at, note = excluded.note, updated_at = excluded.updated_at
          WHERE excluded.updated_at >= marks.updated_at`,
    params: [m.jobId, m.decision, m.decidedAt ?? null, m.star ? 1 : 0, m.appliedAt ?? null, m.note ?? null, m.updatedAt],
  };
}

export async function listFavorites(db: Db): Promise<Favorite[]> {
  const rows = await db.all<{ kind: string; ref: string }>('SELECT kind, ref FROM favorites ORDER BY created_at');
  return rows.map((r) => ({ kind: r.kind as FavoriteKind, ref: r.ref }));
}

export async function setFavorite(db: Db, kind: FavoriteKind, ref: string, on: boolean): Promise<void> {
  if (on) {
    await db.run('INSERT OR IGNORE INTO favorites (kind, ref, created_at) VALUES (?, ?, ?)', [kind, ref, nowIso()]);
  } else {
    await db.run('DELETE FROM favorites WHERE kind = ? AND ref = ?', [kind, ref]);
  }
}

export async function getSettings(db: Db): Promise<Record<string, unknown>> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = parseJson<unknown>(r.value, null);
  return out;
}

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const r = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r ? parseJson<T>(r.value, fallback) : fallback;
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.run(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, JSON.stringify(value), nowIso()],
  );
}

// ------------------------------------------------------------------ Push und Erinnerungen

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function addPushSubscription(db: Db, s: PushSubscriptionRecord): Promise<void> {
  await db.run(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, failures = 0`,
    [s.endpoint, s.p256dh, s.auth, nowIso()],
  );
}

export async function removePushSubscription(db: Db, endpoint: string): Promise<void> {
  await db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
}

export async function listPushSubscriptions(db: Db): Promise<PushSubscriptionRecord[]> {
  return db.all<PushSubscriptionRecord>('SELECT endpoint, p256dh, auth FROM push_subscriptions');
}

export async function remindersSent(db: Db): Promise<Set<string>> {
  const rows = await db.all<{ job_id: string; days: number }>('SELECT job_id, days FROM reminders_sent');
  return new Set(rows.map((r) => `${r.job_id}:${r.days}`));
}

export function reminderSentStmt(jobId: string, days: number, now = nowIso()): Stmt {
  return { sql: 'INSERT OR IGNORE INTO reminders_sent (job_id, days, sent_at) VALUES (?, ?, ?)', params: [jobId, days, now] };
}

// ------------------------------------------------------------------ Läufe

export async function startRun(db: Db, now = nowIso()): Promise<number> {
  await db.run('INSERT INTO runs (started_at) VALUES (?)', [now]);
  const r = await db.first<{ id: number }>('SELECT id FROM runs WHERE started_at = ? ORDER BY id DESC LIMIT 1', [now]);
  return r?.id ?? 0;
}

export async function finishRun(db: Db, id: number, ok: boolean, stats: Record<string, number>, log: string, now = nowIso()): Promise<void> {
  await db.run('UPDATE runs SET finished_at = ?, ok = ?, stats = ?, log = ? WHERE id = ?', [now, ok ? 1 : 0, JSON.stringify(stats), log.slice(-60_000), id]);
  await db.run('DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY id DESC LIMIT 60)');
}

export async function listRuns(db: Db, limit = 10): Promise<RunInfo[]> {
  const rows = await db.all<{ id: number; started_at: string; finished_at: string | null; ok: number; stats: string }>(
    'SELECT id, started_at, finished_at, ok, stats FROM runs ORDER BY id DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({ id: r.id, startedAt: r.started_at, finishedAt: r.finished_at, ok: !!r.ok, stats: parseJson(r.stats, {}) }));
}

export async function getRunLog(db: Db, id: number): Promise<string | null> {
  const r = await db.first<{ log: string }>('SELECT log FROM runs WHERE id = ?', [id]);
  return r?.log ?? null;
}

// ------------------------------------------------------------------ Browser-Warteschlange

export interface QueueItem {
  url: string;
  sourceId: string | null;
  institutionId: string | null;
  reason: string | null;
  attempts: number;
}

export function enqueueBrowserStmt(url: string, sourceId: string | null, institutionId: string | null, reason: string, now = nowIso()): Stmt {
  return {
    sql: `INSERT INTO browser_queue (url, source_id, institution_id, reason, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET reason = excluded.reason, updated_at = excluded.updated_at,
          status = CASE WHEN browser_queue.status = 'erledigt' THEN 'offen' ELSE browser_queue.status END`,
    params: [url, sourceId, institutionId, reason, now],
  };
}

export async function nextBrowserItems(db: Db, limit: number): Promise<QueueItem[]> {
  const rows = await db.all<{ url: string; source_id: string | null; institution_id: string | null; reason: string | null; attempts: number }>(
    "SELECT url, source_id, institution_id, reason, attempts FROM browser_queue WHERE status = 'offen' AND attempts < 3 ORDER BY attempts, updated_at LIMIT ?",
    [limit],
  );
  return rows.map((r) => ({ url: r.url, sourceId: r.source_id, institutionId: r.institution_id, reason: r.reason, attempts: r.attempts }));
}

export function browserDoneStmt(url: string, ok: boolean, error: string | null, now = nowIso()): Stmt {
  return {
    sql: `UPDATE browser_queue SET status = CASE WHEN ? = 1 THEN 'erledigt' WHEN attempts + 1 >= 3 THEN 'aufgegeben' ELSE 'offen' END,
          attempts = attempts + 1, last_error = ?, updated_at = ? WHERE url = ?`,
    params: [ok ? 1 : 0, error, now, url],
  };
}

/** Seiten, die der Browser-Agent noch lesen soll (höchstens drei Versuche pro Seite). */
export async function openBrowserItemCount(db: Db): Promise<number> {
  const r = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM browser_queue WHERE status = 'offen' AND attempts < 3");
  return r?.n ?? 0;
}

export async function browserQueueStats(db: Db): Promise<Record<string, number>> {
  const rows = await db.all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM browser_queue GROUP BY status');
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

// ------------------------------------------------------------------ KI-Warteschlange (Claude)

export type AiTaskKind = 'auswerten' | 'frist' | 'horizont' | 'weite';

export interface AiTask {
  id: number;
  art: AiTaskKind;
  jobId: string;
  payload: unknown;
  versuche: number;
}

/** Gate-Skip, der unabhängig vom Profil gilt: Claude hat die Seite als „keine Stellenanzeige“ erkannt. */
export const NOT_A_POSTING = 'keine-anzeige';

/** Legt eine Aufgabe an; gibt es sie schon (auch erledigt), wird sie wieder geöffnet und der Inhalt erneuert. */
export function enqueueAiTaskStmt(art: AiTaskKind, jobId: string, payload: unknown, now = nowIso()): Stmt {
  return {
    sql: `INSERT INTO ki_aufgaben (art, job_id, payload, status, created_at) VALUES (?, ?, ?, 'offen', ?)
          ON CONFLICT(art, job_id) DO UPDATE SET payload = excluded.payload, status = 'offen', versuche = 0, ergebnis = NULL, done_at = NULL`,
    params: [art, jobId, payload == null ? null : JSON.stringify(payload), now],
  };
}

export async function listOpenAiTasks(db: Db, limit: number, arten?: AiTaskKind[]): Promise<AiTask[]> {
  const filter = arten?.length ? ` AND art IN (${arten.map(() => '?').join(', ')})` : '';
  const rows = await db.all<{ id: number; art: AiTaskKind; job_id: string; payload: string | null; versuche: number }>(
    `SELECT id, art, job_id, payload, versuche FROM ki_aufgaben WHERE status = 'offen'${filter} ORDER BY id LIMIT ?`,
    [...(arten ?? []), limit],
  );
  return rows.map((r) => ({ id: r.id, art: r.art, jobId: r.job_id, payload: parseJson(r.payload, null), versuche: r.versuche }));
}

export async function countOpenAiTasks(db: Db): Promise<Record<AiTaskKind, number>> {
  const rows = await db.all<{ art: AiTaskKind; n: number }>("SELECT art, COUNT(*) AS n FROM ki_aufgaben WHERE status = 'offen' GROUP BY art");
  const out: Record<AiTaskKind, number> = { auswerten: 0, frist: 0, horizont: 0, weite: 0 };
  for (const r of rows) out[r.art] = r.n;
  return out;
}

export function aiTaskDoneStmt(id: number, ergebnis: unknown, now = nowIso()): Stmt {
  return { sql: "UPDATE ki_aufgaben SET status = 'erledigt', ergebnis = ?, done_at = ?, payload = NULL WHERE id = ?", params: [JSON.stringify(ergebnis), now, id] };
}

/** Fehlgeschlagener Versuch; nach drei Versuchen bleibt die Aufgabe als „fehler“ liegen. */
export function aiTaskFailedStmt(id: number, fehler: string, now = nowIso()): Stmt {
  return {
    sql: "UPDATE ki_aufgaben SET versuche = versuche + 1, ergebnis = ?, status = CASE WHEN versuche + 1 >= 3 THEN 'fehler' ELSE 'offen' END, done_at = ? WHERE id = ?",
    params: [JSON.stringify({ fehler }), now, id],
  };
}

/**
 * Legt Aufgaben für Anzeigen an, die ohne KI erfasst wurden: auswerten für alle offenen ohne KI-Kurzfassung,
 * frist für unsichere Fristen. Vorhandene Aufgaben (auch erledigte) bleiben unberührt.
 */
export async function backfillAiTasks(db: Db, now = nowIso()): Promise<{ auswerten: number; frist: number }> {
  const a = await db.run(
    "INSERT INTO ki_aufgaben (art, job_id, status, created_at) SELECT 'auswerten', id, 'offen', ? FROM jobs WHERE status IN ('aktiv', 'pruefung') AND summary_ai = 0 ON CONFLICT(art, job_id) DO NOTHING",
    [now],
  );
  const f = await db.run(
    "INSERT INTO ki_aufgaben (art, job_id, status, created_at) SELECT 'frist', id, 'offen', ? FROM jobs WHERE status = 'aktiv' AND deadline_check = 'unsicher' ON CONFLICT(art, job_id) DO NOTHING",
    [now],
  );
  return { auswerten: a.changes, frist: f.changes };
}

/** Entfernt eine Anzeige samt Quellen-Verweisen; die App räumt sie über den Grabstein auf. Markierte bleiben. */
export async function removeJobIfUnmarked(db: Db, id: string, now = nowIso()): Promise<boolean> {
  const marked = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM marks WHERE job_id = ? AND (decision = 'gemerkt' OR star = 1 OR applied_at IS NOT NULL)", [id]);
  if ((marked?.n ?? 0) > 0) return false;
  await db.batch([
    { sql: 'DELETE FROM jobs WHERE id = ?', params: [id] },
    { sql: 'DELETE FROM job_sources WHERE job_id = ?', params: [id] },
    { sql: 'DELETE FROM job_aliases WHERE job_id = ?', params: [id] },
    { sql: "DELETE FROM marks WHERE job_id = ? AND decision = 'abgelehnt'", params: [id] },
    { sql: 'INSERT OR REPLACE INTO deleted_jobs (id, deleted_at) VALUES (?, ?)', params: [id, now] },
  ]);
  return true;
}

/**
 * Von Hand gemeldet: Die Seite ist keine einzelne Stellenanzeige. Sie wird gelöscht (auch wenn markiert, die Meldung
 * ist die Entscheidung), und ihre Adressen kommen beim Einsammeln nicht wieder. Gemerkt wird die Quelle, damit
 * Quellen mit vielen solchen Seiten auffallen.
 */
export async function reportNotPosting(db: Db, id: string, now = nowIso()): Promise<boolean> {
  const job = await db.first<{ canonical_url: string; title: string; institution_id: string | null; source_id: string | null }>(
    `SELECT canonical_url, title, institution_id, (SELECT source_id FROM job_sources WHERE job_id = jobs.id ORDER BY first_seen_at LIMIT 1) AS source_id
     FROM jobs WHERE id = ?`,
    [id],
  );
  if (!job) return false;
  const aliases = await db.all<{ url: string }>('SELECT url FROM job_aliases WHERE job_id = ?', [id]);
  const skip = (url: string) =>
    gateSkipStmt({ url, sourceId: job.source_id ?? 'hand', institutionId: job.institution_id, title: job.title.slice(0, 200), textHash: NOT_A_POSTING, reason: NOT_A_POSTING, note: 'von Hand gemeldet' }, now);
  await db.batch([
    skip(job.canonical_url),
    ...aliases.map((a) => skip(a.url)),
    { sql: 'DELETE FROM jobs WHERE id = ?', params: [id] },
    { sql: 'DELETE FROM job_sources WHERE job_id = ?', params: [id] },
    { sql: 'DELETE FROM job_aliases WHERE job_id = ?', params: [id] },
    { sql: 'DELETE FROM marks WHERE job_id = ?', params: [id] },
    { sql: 'DELETE FROM ki_aufgaben WHERE job_id = ?', params: [id] },
    { sql: 'INSERT OR REPLACE INTO deleted_jobs (id, deleted_at) VALUES (?, ?)', params: [id, now] },
  ]);
  return true;
}
