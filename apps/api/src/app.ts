// HTTP-API der App (Hono). Läuft als Cloudflare Worker (worker.ts) oder als Node-Server (node.ts).

import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  addPushSubscription,
  countOpenAiTasks,
  createSourceCheck,
  deletedSince,
  getSetting,
  getSourceCheck,
  listDiscoveries,
  listSourceChecks,
  setDiscoveryStatus,
  setSourceCheckStatus,
  getJob,
  getRunLog,
  getSettings,
  listCities,
  listFavorites,
  listGateSkips,
  listInstitutions,
  listMarks,
  listRuns,
  listSources,
  listSuggestions,
  patchSource,
  removePushSubscription,
  reportNotPosting,
  resolveSuggestion,
  setFavorite,
  setSetting,
  syncJobs,
  upsertInstitutionStmt,
  upsertMarkStmt,
  upsertSourceStmt,
  browserQueueStats,
  type Db,
} from '@stellen/db';
import {
  addUsage,
  ASSISTANT_TOOLS,
  bigModel,
  bridgeSuggestionMessages,
  canonicalUrl,
  FINAL_STEP_NOTE,
  INSTITUTION_KINDS,
  llmCostUsd,
  parseBridgeSuggestions,
  parseProfile,
  siteKeyOf,
  starterProfile,
  todayBerlin,
  toSuggestedBridges,
  withoutThinking,
  withThinking,
  type AssistantStepResult,
  type Institution,
  type InstitutionKind,
  type KiUsageReport,
  type KiVerbrauch,
  type LlmUsage,
  type Source,
  type SourceConfig,
} from '@stellen/core';

export interface ApiEnv {
  APP_KEY?: string;
  INGEST_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_WORKFLOW?: string;
  /** Workflow für Probeläufe neuer Quellen (Standard: quelle-pruefen.yml) */
  GITHUB_CHECK_WORKFLOW?: string;
  /** Workflow für den großen Durchlauf nach einer Profil-Freigabe (Standard: grosser-lauf.yml) */
  GITHUB_GROSS_WORKFLOW?: string;
  /** Optional: KI im Worker (für Brücken-Vorschläge im Horizont), OpenAI-kompatibel */
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  ALLOWED_ORIGIN?: string;
}

export interface AppDeps {
  db: (c: Context) => Db;
  env: (c: Context) => ApiEnv;
}

/** Vergleich in konstanter Zeit, damit Schlüssel nicht über Antwortzeiten erratbar sind. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bearer(c: Context): string {
  const h = c.req.header('authorization') ?? '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}

const markSchema = z.object({
  decision: z.enum(['gemerkt', 'abgelehnt']).nullable().optional(),
  decidedAt: z.string().nullable().optional(),
  star: z.boolean().optional(),
  appliedAt: z.string().nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  updatedAt: z.string().optional(),
});

const SETTINGS_KEYS = new Set(['profile', 'filter', 'home', 'reminders', 'gateTerms', 'sort', 'deck', 'ui', 'notifyHighScore', 'checklist', 'umfrage', 'freigabe']);

const assistantStepSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.string().max(400_000).nullable(),
        reasoning_content: z.string().max(400_000).optional(),
        tool_calls: z
          .array(z.object({ id: z.string().max(200), type: z.literal('function'), function: z.object({ name: z.string().max(64), arguments: z.string().max(100_000) }) }))
          .max(30)
          .optional(),
        tool_call_id: z.string().max(200).optional(),
      }),
    )
    .min(2)
    .max(400),
  final: z.boolean().optional(),
});

/** Verständliche Meldung für Fehler der KI-Schnittstelle. */
function llmErrorText(status: number): string {
  if (status === 401 || status === 403) return 'Der KI-Schlüssel im Worker stimmt nicht (LLM_API_KEY).';
  if (status === 402) return 'Das Guthaben bei DeepSeek ist aufgebraucht.';
  if (status === 429) return 'Die KI ist gerade ausgelastet. Bitte gleich noch einmal versuchen.';
  if (status === 400 || status === 422) return 'Die KI hat die Anfrage abgelehnt. Ein neues Gespräch hilft meistens.';
  return `Die KI hat mit Fehler ${status} geantwortet. Bitte später noch einmal versuchen.`;
}

/** KI-Kosten der Einsammel-Läufe pro Tag (deutsche Zeit) in US-Dollar. */
async function pipelineUsdByDay(db: Db, runs = 120): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const r of await listRuns(db, runs)) {
    const usd = r.stats?.kiKostenUsd;
    if (!usd) continue;
    const day = todayBerlin(new Date(r.startedAt));
    out.set(day, (out.get(day) ?? 0) + usd);
  }
  return out;
}

/** Zählt die Kosten eines KI-Aufrufs im Worker und gibt den Verbrauch des Tages zurück (Worker und Läufe). */
async function recordUsage(db: Db, usd: number): Promise<number> {
  const today = todayBerlin();
  const v = addUsage(await getSetting<KiVerbrauch | null>(db, 'ki_verbrauch', null), today, usd);
  await setSetting(db, 'ki_verbrauch', v);
  return (v.tage[today]?.usd ?? 0) + ((await pipelineUsdByDay(db, 10)).get(today) ?? 0);
}

const newInstitutionSchema = z.object({
  name: z.string().min(2).max(200),
  cityId: z.string().min(1).max(80),
  kind: z.enum(INSTITUTION_KINDS),
  website: z.string().url().max(500).optional(),
});

/** Startet einen GitHub-Actions-Workflow (Einsammeln oder Probelauf). */
async function dispatchWorkflow(env: ApiEnv, workflow: string, inputs?: Record<string, string>): Promise<{ ok: boolean; status: number }> {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return { ok: false, status: 501 };
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'stellenbuechlein',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', ...(inputs ? { inputs } : {}) }),
  });
  return { ok: res.ok, status: res.status };
}

function institutionIdFor(name: string): string {
  return `u-${name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36)}`;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.use('/api/*', async (c, next) => {
    const env = deps.env(c);
    // Läuft die App unter einer anderen Adresse als der Worker, erlaubt ALLOWED_ORIGIN deren Adresse(n),
    // mehrere mit Komma getrennt, z. B. "https://meine-seite.de, https://www.meine-seite.de".
    if (env.ALLOWED_ORIGIN) {
      const allowed = env.ALLOWED_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
      const origin = c.req.header('origin');
      const match = allowed.includes('*') ? '*' : origin && allowed.includes(origin) ? origin : null;
      if (match) {
        c.header('Access-Control-Allow-Origin', match);
        c.header('Access-Control-Allow-Headers', 'authorization, content-type');
        c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        c.header('Access-Control-Max-Age', '86400');
      }
      c.header('Vary', 'Origin');
      if (c.req.method === 'OPTIONS') return c.body(null, match ? 204 : 403);
    }
    c.header('Cache-Control', 'no-store');
    const path = new URL(c.req.url).pathname;
    if (path === '/api/health' || path === '/api/push/vapid') return next();
    const token = bearer(c);
    if (path.startsWith('/api/ingest/sql')) {
      if (!env.INGEST_KEY || !token || !safeEqual(token, env.INGEST_KEY)) return c.json({ error: 'Kein Zugriff.' }, 401);
      return next();
    }
    if (!env.APP_KEY) return c.json({ error: 'APP_KEY ist auf dem Server nicht gesetzt.' }, 500);
    if (!token || !safeEqual(token, env.APP_KEY)) return c.json({ error: 'Der App-Schlüssel stimmt nicht.' }, 401);
    return next();
  });

  app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

  app.get('/api/push/vapid', (c) => c.json({ publicKey: deps.env(c).VAPID_PUBLIC_KEY ?? null }));

  // Alles, was die App beim Start braucht (außer den Anzeigen selbst).
  app.get('/api/bootstrap', async (c) => {
    const db = deps.db(c);
    const [institutions, cities, marks, favorites, settings, runs, sources, kiOffen] = await Promise.all([
      listInstitutions(db),
      listCities(db),
      listMarks(db),
      listFavorites(db),
      getSettings(db),
      listRuns(db, 3),
      listSources(db),
      countOpenAiTasks(db),
    ]);
    const enabled = sources.filter((s) => s.enabled);
    return c.json({
      institutions,
      cities,
      marks,
      favorites,
      settings,
      runs,
      sourceSummary: {
        total: enabled.length,
        ok: enabled.filter((s) => s.status === 'ok' || s.status === 'leer').length,
        problems: enabled.filter((s) => ['warnung', 'fehler', 'blockiert'].includes(s.status)).length,
        missingUrl: enabled.filter((s) => s.status === 'url-fehlt').length,
      },
      serverTime: new Date().toISOString(),
      vapidPublicKey: deps.env(c).VAPID_PUBLIC_KEY ?? null,
      ingestTrigger: !!(deps.env(c).GITHUB_TOKEN && deps.env(c).GITHUB_REPO),
      aiSuggest: !!deps.env(c).LLM_API_KEY,
      kiWarteschlange: Object.values(kiOffen).reduce((a, b) => a + b, 0),
    });
  });

  app.get('/api/sync', async (c) => {
    const db = deps.db(c);
    const cursor = c.req.query('cursor') ?? '';
    const since = c.req.query('deletedSince') ?? '';
    const limit = Math.min(200, Math.max(10, Number(c.req.query('limit') ?? 80) || 80));
    const serverTime = new Date().toISOString();
    const page = await syncJobs(db, cursor, limit);
    const deleted = await deletedSince(db, since);
    return c.json({ ...page, deleted, serverTime });
  });

  app.get('/api/jobs/:id', async (c) => {
    const job = await getJob(deps.db(c), c.req.param('id'));
    return job ? c.json(job) : c.json({ error: 'Anzeige nicht gefunden.' }, 404);
  });

  // Von Hand gemeldet: keine einzelne Stellenanzeige. Wird gelöscht, die Adresse kommt nicht wieder.
  app.post('/api/jobs/:id/keine-anzeige', async (c) => {
    const ok = await reportNotPosting(deps.db(c), c.req.param('id'));
    return ok ? c.json({ ok: true }) : c.json({ error: 'Anzeige nicht gefunden.' }, 404);
  });

  app.put('/api/marks/:jobId', async (c) => {
    const parsed = markSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Ungültige Markierung.' }, 400);
    const m = parsed.data;
    const mark = {
      jobId: c.req.param('jobId'),
      decision: m.decision ?? null,
      decidedAt: m.decidedAt ?? null,
      star: m.star ?? false,
      appliedAt: m.appliedAt ?? null,
      note: m.note ?? null,
      updatedAt: m.updatedAt ?? new Date().toISOString(),
    };
    await deps.db(c).batch([upsertMarkStmt(mark)]);
    return c.json(mark);
  });

  app.post('/api/marks/batch', async (c) => {
    const body = await c.req.json().catch(() => null);
    const list = z.array(markSchema.extend({ jobId: z.string().min(1) })).max(500).safeParse(body?.marks);
    if (!list.success) return c.json({ error: 'Ungültige Markierungen.' }, 400);
    const stmts = list.data.map((m) =>
      upsertMarkStmt({
        jobId: m.jobId,
        decision: m.decision ?? null,
        decidedAt: m.decidedAt ?? null,
        star: m.star ?? false,
        appliedAt: m.appliedAt ?? null,
        note: m.note ?? null,
        updatedAt: m.updatedAt ?? new Date().toISOString(),
      }),
    );
    await deps.db(c).batch(stmts);
    return c.json({ ok: true, count: stmts.length });
  });

  app.put('/api/favorites', async (c) => {
    const p = z
      .object({ kind: z.enum(['state', 'city', 'institution']), ref: z.string().min(1).max(80), on: z.boolean() })
      .safeParse(await c.req.json().catch(() => null));
    if (!p.success) return c.json({ error: 'Ungültiger Lieblingsort.' }, 400);
    await setFavorite(deps.db(c), p.data.kind, p.data.ref, p.data.on);
    return c.json({ ok: true, favorites: await listFavorites(deps.db(c)) });
  });

  app.put('/api/settings/:key', async (c) => {
    const key = c.req.param('key');
    if (!SETTINGS_KEYS.has(key)) return c.json({ error: 'Unbekannte Einstellung.' }, 400);
    const body = await c.req.json().catch(() => null);
    if (!body || !('value' in body)) return c.json({ error: 'Wert fehlt.' }, 400);
    const raw = JSON.stringify(body.value);
    if (raw.length > 200_000) return c.json({ error: 'Einstellung ist zu groß.' }, 413);
    // Umfrage: einen älteren Zwischenstand (etwa nachgereicht von einem Gerät, das offline war) nicht über einen neueren schreiben
    if (key === 'umfrage' && body.value && typeof body.value === 'object') {
      const prev = await getSetting<{ geaendert?: unknown } | null>(deps.db(c), 'umfrage', null);
      const next = (body.value as { geaendert?: unknown }).geaendert;
      if (typeof prev?.geaendert === 'string' && typeof next === 'string' && next < prev.geaendert) return c.json({ ok: true, veraltet: true });
    }
    await setSetting(deps.db(c), key, body.value);
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------------- Quellen

  app.get('/api/sources', async (c) => {
    const db = deps.db(c);
    const [sources, suggestions, queue, checks, discoveries] = await Promise.all([
      listSources(db),
      listSuggestions(db),
      browserQueueStats(db),
      listSourceChecks(db, 12),
      listDiscoveries(db, 'offen', 100),
    ]);
    return c.json({ sources, suggestions, browserQueue: queue, checks, discoveries });
  });

  app.patch('/api/sources/:id', async (c) => {
    const p = z
      .object({
        url: z.string().url().max(2000).nullable().optional(),
        enabled: z.boolean().optional(),
        gate: z.enum(['none', 'psych']).optional(),
        label: z.string().max(200).nullable().optional(),
        verified: z.boolean().optional(),
        config: z.record(z.unknown()).optional(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!p.success) return c.json({ error: 'Ungültige Änderung (ist die Adresse vollständig, mit https://?).' }, 400);
    await patchSource(deps.db(c), c.req.param('id'), p.data);
    return c.json({ ok: true });
  });

  app.post('/api/sources', async (c) => {
    const p = z
      .object({
        institutionId: z.string().min(1).max(80).optional(),
        institution: newInstitutionSchema.optional(),
        url: z.string().url().max(2000),
        kind: z.enum(['zentral', 'fachbereich', 'portal']).default('zentral'),
        label: z.string().max(200).optional(),
        gate: z.enum(['none', 'psych']).optional(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!p.success) return c.json({ error: 'Bitte Einrichtung und vollständige Adresse (mit https://) angeben.' }, 400);
    const db = deps.db(c);
    const now = new Date().toISOString();
    let institutionId = p.data.institutionId ?? null;
    const stmts = [];
    if (!institutionId && p.data.institution) {
      institutionId = institutionIdFor(p.data.institution.name);
      const inst: Institution = {
        id: institutionId,
        name: p.data.institution.name,
        shortName: null,
        kind: p.data.institution.kind,
        cityId: p.data.institution.cityId,
        website: p.data.institution.website ?? null,
        active: true,
        origin: 'user',
      };
      stmts.push(upsertInstitutionStmt(inst, now));
    }
    if (!institutionId && p.data.kind !== 'portal') return c.json({ error: 'Einrichtung fehlt.' }, 400);
    const source: Source = {
      id: `${institutionId ?? 'portal'}-u${Date.now().toString(36)}`,
      institutionId,
      kind: p.data.kind,
      label: p.data.label ?? null,
      url: p.data.url,
      adapter: 'auto',
      config: {},
      gate: p.data.gate ?? (p.data.kind === 'fachbereich' ? 'none' : 'psych'),
      enabled: true,
      verified: true,
      status: 'neu',
      consecutiveFailures: 0,
    };
    stmts.push(upsertSourceStmt(source, now));
    await db.batch(stmts);
    return c.json({ ok: true, source });
  });

  app.post('/api/suggestions/:id', async (c) => {
    const body = await c.req.json().catch(() => null);
    const r = await resolveSuggestion(deps.db(c), Number(c.req.param('id')), !!body?.accept);
    return r ? c.json({ ok: true, suggestion: r }) : c.json({ error: 'Vorschlag nicht gefunden.' }, 404);
  });

  // ---------------------------------------------------------------- Probelauf für neue Quellen

  app.post('/api/sources/checks', async (c) => {
    const p = z
      .object({ url: z.string().url().max(2000), sourceId: z.string().min(1).max(120).optional() })
      .safeParse(await c.req.json().catch(() => null));
    if (!p.success || !/^https?:\/\//i.test(p.data.url)) return c.json({ error: 'Bitte eine vollständige Adresse mit https:// angeben.' }, 400);
    const db = deps.db(c);
    const check = await createSourceCheck(db, p.data.url.trim(), p.data.sourceId ?? null);
    const env = deps.env(c);
    const d = await dispatchWorkflow(env, env.GITHUB_CHECK_WORKFLOW ?? 'quelle-pruefen.yml', { check_id: String(check.id) }).catch(() => ({ ok: false, status: 0 }));
    return c.json({ check, started: d.ok });
  });

  app.get('/api/sources/checks', async (c) => c.json({ checks: await listSourceChecks(deps.db(c), 20) }));

  app.get('/api/sources/checks/:id', async (c) => {
    const check = await getSourceCheck(deps.db(c), Number(c.req.param('id')));
    return check ? c.json({ check }) : c.json({ error: 'Probelauf nicht gefunden.' }, 404);
  });

  /** Ergebnis übernehmen: legt die Quelle mit den geprüften Einstellungen an (oder aktualisiert die vorhandene). */
  app.post('/api/sources/checks/:id/accept', async (c) => {
    const p = z
      .object({
        institutionId: z.string().min(1).max(80).optional(),
        institution: newInstitutionSchema.optional(),
        kind: z.enum(['zentral', 'fachbereich', 'portal']),
        gate: z.enum(['none', 'psych']),
        label: z.string().max(200).optional(),
        url: z.string().url().max(2000).optional(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!p.success) return c.json({ error: 'Bitte Einrichtung, Art und Grobfilter angeben.' }, 400);
    const db = deps.db(c);
    const check = await getSourceCheck<{ listUrl?: string; config?: SourceConfig; verdict?: string; ai?: { verdict: string } | null; checkedAt?: string }>(db, Number(c.req.param('id')));
    if (!check) return c.json({ error: 'Probelauf nicht gefunden.' }, 404);
    if (check.status !== 'fertig') return c.json({ error: 'Der Probelauf ist noch nicht fertig.' }, 409);
    const r = check.result ?? {};
    const url = p.data.url ?? r.listUrl ?? check.url;
    const now = new Date().toISOString();
    const note = `Per Probelauf geprüft am ${now.slice(8, 10)}.${now.slice(5, 7)}.${now.slice(0, 4)}: ${r.verdict ?? '–'}${r.ai ? ` (KI: ${r.ai.verdict})` : ''}`;
    const config: SourceConfig = { ...(r.config ?? {}), note };
    const stmts = [];

    let sourceId: string;
    if (check.sourceId) {
      // Erneuter Probelauf einer vorhandenen Quelle: Adresse und Einstellungen aktualisieren
      const old = (await listSources(db)).find((x) => x.id === check.sourceId);
      if (!old) return c.json({ error: 'Die Quelle gibt es nicht mehr.' }, 404);
      await patchSource(db, old.id, { url, config: { ...old.config, ...config }, gate: p.data.gate, verified: true, enabled: true, ...(p.data.label ? { label: p.data.label } : {}) });
      sourceId = old.id;
    } else {
      let institutionId = p.data.institutionId ?? null;
      if (!institutionId && p.data.institution) {
        institutionId = institutionIdFor(p.data.institution.name);
        const inst: Institution = {
          id: institutionId,
          name: p.data.institution.name,
          shortName: null,
          kind: p.data.institution.kind as InstitutionKind,
          cityId: p.data.institution.cityId,
          website: p.data.institution.website ?? new URL(url).origin,
          active: true,
          origin: 'user',
        };
        stmts.push(upsertInstitutionStmt(inst, now));
      }
      if (!institutionId && p.data.kind !== 'portal') return c.json({ error: 'Einrichtung fehlt.' }, 400);
      const source: Source = {
        id: `${institutionId ?? 'portal'}-u${Date.now().toString(36)}`,
        institutionId,
        kind: p.data.kind,
        label: p.data.label ?? null,
        url,
        adapter: 'auto',
        config,
        gate: p.data.gate,
        enabled: true,
        verified: true,
        status: 'neu',
        consecutiveFailures: 0,
      };
      stmts.push(upsertSourceStmt(source, now));
      sourceId = source.id;
    }
    await db.batch(stmts);
    await setSourceCheckStatus(db, check.id, 'uebernommen');
    // Ein entsprechender Fund der Erkundung ist damit erledigt
    for (const key of [siteKeyOf(url), siteKeyOf(check.url)]) if (key) await setDiscoveryStatus(db, key, 'uebernommen');
    return c.json({ ok: true, sourceId, url: canonicalUrl(url) });
  });

  app.post('/api/sources/checks/:id/discard', async (c) => {
    const db = deps.db(c);
    const check = await getSourceCheck(db, Number(c.req.param('id')));
    if (!check) return c.json({ error: 'Probelauf nicht gefunden.' }, 404);
    await setSourceCheckStatus(db, check.id, 'verworfen');
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------------- Neu entdeckte Websites

  app.get('/api/discoveries', async (c) => {
    const status = c.req.query('status');
    const allowed = ['offen', 'geprueft', 'uebernommen', 'ignoriert', 'alle'] as const;
    const st = (allowed as readonly string[]).includes(status ?? '') ? (status as (typeof allowed)[number]) : 'offen';
    return c.json({ discoveries: await listDiscoveries(deps.db(c), st, 200) });
  });

  app.post('/api/discoveries/status', async (c) => {
    const p = z
      .object({ siteKey: z.string().min(3).max(200), status: z.enum(['offen', 'geprueft', 'uebernommen', 'ignoriert']) })
      .safeParse(await c.req.json().catch(() => null));
    if (!p.success) return c.json({ error: 'Ungültige Angabe.' }, 400);
    const ok = await setDiscoveryStatus(deps.db(c), p.data.siteKey, p.data.status);
    return ok ? c.json({ ok: true }) : c.json({ error: 'Fund nicht gefunden.' }, 404);
  });

  // ---------------------------------------------------------------- Horizont: Brücken-Vorschläge der KI

  app.post('/api/horizont/vorschlaege', async (c) => {
    const env = deps.env(c);
    if (!env.LLM_API_KEY) return c.json({ error: 'Für Vorschläge braucht der Worker einen KI-Schlüssel (LLM_API_KEY).' }, 501);
    const body = (await c.req.json().catch(() => null)) as { profile?: unknown } | null;
    const profile = parseProfile(body?.profile) ?? parseProfile(await getSetting<unknown>(deps.db(c), 'profile', null)) ?? starterProfile();
    const baseUrl = (env.LLM_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '');
    const model = bigModel(env.LLM_MODEL);
    // Zwei Versuche: DeepSeek liefert im JSON-Modus gelegentlich eine leere Antwort.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.LLM_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          ...withoutThinking(baseUrl),
          messages: bridgeSuggestionMessages(profile),
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        }),
      }).catch(() => null);
      if (!res?.ok) {
        console.warn(`Brücken-Vorschläge: KI antwortet mit ${res?.status ?? 'keiner Verbindung'}`);
        return c.json({ error: 'Die KI hat gerade nicht geantwortet. Bitte später noch einmal versuchen.' }, 502);
      }
      const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: LlmUsage } | null;
      await recordUsage(deps.db(c), llmCostUsd(data?.usage, model));
      const choice = data?.choices?.[0];
      const content = (choice?.message?.content ?? '').replace(/^```(?:json)?\s*|```\s*$/g, '').trim();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        console.warn(`Brücken-Vorschläge, Versuch ${attempt}: kein JSON (${content.length} Zeichen, Ende: ${choice?.finish_reason ?? '?'})`);
        continue;
      }
      const { bruecken, problems } = parseBridgeSuggestions(parsed);
      if (problems.length) console.warn(`Brücken-Vorschläge, Versuch ${attempt} (Ende: ${choice?.finish_reason ?? '?'}): ${problems.join(' | ')}`);
      if (bruecken.length) return c.json({ bruecken: toSuggestedBridges(bruecken, profile) });
    }
    return c.json({ error: 'Die Antwort der KI war unbrauchbar. Bitte noch einmal versuchen.' }, 502);
  });

  // ---------------------------------------------------------------- KI-Gespräch (Mini-Harness)

  /**
   * Ein Schritt im Gespräch. Die Schleife und die Werkzeuge laufen in der App; hier werden Modell (immer das
   * große), Denkmodus (höchste Stufe) und Werkzeuge festgelegt und die Kosten gezählt.
   */
  app.post('/api/ki/schritt', async (c) => {
    const env = deps.env(c);
    if (!env.LLM_API_KEY) return c.json({ error: 'Für Gespräche braucht der Worker einen KI-Schlüssel (LLM_API_KEY).' }, 501);
    const raw = await c.req.text();
    if (raw.length > 3_000_000) return c.json({ error: 'Das Gespräch ist zu lang geworden. Bitte ein neues beginnen.' }, 413);
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
    const p = assistantStepSchema.safeParse(body);
    if (!p.success) return c.json({ error: 'Ungültige Anfrage an die KI.' }, 400);
    const baseUrl = (env.LLM_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '');
    const model = bigModel(env.LLM_MODEL);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.LLM_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        // Im letzten Schritt muss die KI antworten; der Hinweis hält sie dabei an die Belege.
        messages: p.data.final ? [...p.data.messages, { role: 'user', content: FINAL_STEP_NOTE }] : p.data.messages,
        tools: ASSISTANT_TOOLS,
        ...(p.data.final ? { tool_choice: 'none' } : {}),
        ...withThinking(baseUrl, 'max'),
      }),
    }).catch(() => null);
    if (!res) return c.json({ error: 'Die KI ist gerade nicht erreichbar.' }, 502);
    if (!res.ok) {
      console.warn(`KI-Schritt: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
      return c.json({ error: llmErrorText(res.status) }, 502);
    }
    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string | null; reasoning_content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
      usage?: LlmUsage;
    } | null;
    const choice = data?.choices?.[0];
    const usd = llmCostUsd(data?.usage, model);
    const heuteUsd = await recordUsage(deps.db(c), usd);
    if (!choice?.message) return c.json({ error: 'Die Antwort der KI war leer. Bitte noch einmal versuchen.' }, 502);
    const m = choice.message;
    const out: AssistantStepResult = {
      message: {
        role: 'assistant',
        content: m.content ?? null,
        ...(m.reasoning_content ? { reasoning_content: m.reasoning_content } : {}),
        ...(m.tool_calls?.length ? { tool_calls: m.tool_calls.map((t) => ({ id: t.id, type: 'function' as const, function: { name: t.function.name, arguments: t.function.arguments } })) } : {}),
      },
      finishReason: choice.finish_reason ?? null,
      usd,
      heuteUsd,
    };
    return c.json(out);
  });

  /** Verbrauch der KI (Gespräche, Brücken-Vorschläge, Einsammeln) und das Guthaben bei DeepSeek. */
  app.get('/api/ki/verbrauch', async (c) => {
    const env = deps.env(c);
    const db = deps.db(c);
    const [v, runs] = await Promise.all([getSetting<KiVerbrauch | null>(db, 'ki_verbrauch', null), pipelineUsdByDay(db)]);
    const days = new Set([...Object.keys(v?.tage ?? {}), ...runs.keys()]);
    const tage = [...days]
      .sort()
      .reverse()
      .slice(0, 62)
      .map((tag) => ({ tag, appUsd: v?.tage[tag]?.usd ?? 0, einsammelnUsd: runs.get(tag) ?? 0 }));
    const today = todayBerlin();
    const sum = (list: typeof tage) => list.reduce((s, t) => s + t.appUsd + t.einsammelnUsd, 0);
    let guthaben: KiUsageReport['guthaben'] = null;
    const baseUrl = (env.LLM_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '');
    if (env.LLM_API_KEY && /deepseek\.com/i.test(baseUrl)) {
      const r = await fetch(`${baseUrl}/user/balance`, { headers: { authorization: `Bearer ${env.LLM_API_KEY}` } }).catch(() => null);
      const b = r?.ok ? ((await r.json().catch(() => null)) as { is_available?: boolean; balance_infos?: { currency: string; total_balance: string }[] } | null) : null;
      const info = b?.balance_infos?.find((i) => i.currency === 'USD') ?? b?.balance_infos?.[0];
      if (info) guthaben = { waehrung: info.currency, betrag: Number(info.total_balance), verfuegbar: b?.is_available !== false };
    }
    const out: KiUsageReport = { tage, heuteUsd: sum(tage.filter((t) => t.tag === today)), monatUsd: sum(tage.filter((t) => t.tag.startsWith(today.slice(0, 7)))), guthaben };
    return c.json(out);
  });

  app.get('/api/runs', async (c) => c.json({ runs: await listRuns(deps.db(c), 20) }));

  app.get('/api/runs/:id/log', async (c) => {
    const log = await getRunLog(deps.db(c), Number(c.req.param('id')));
    return log == null ? c.json({ error: 'Lauf nicht gefunden.' }, 404) : c.text(log);
  });

  app.get('/api/skips', async (c) => c.json({ skips: await listGateSkips(deps.db(c), 300) }));

  // ---------------------------------------------------------------- Push

  app.post('/api/push/subscribe', async (c) => {
    const p = z
      .object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(4) }) })
      .safeParse(await c.req.json().catch(() => null));
    if (!p.success) return c.json({ error: 'Ungültiges Push-Abo.' }, 400);
    await addPushSubscription(deps.db(c), { endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth });
    return c.json({ ok: true });
  });

  app.post('/api/push/unsubscribe', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (typeof body?.endpoint === 'string') await removePushSubscription(deps.db(c), body.endpoint);
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------------- Einsammeln

  /** "Jetzt einsammeln" (oder mit { gross: true } den großen Durchlauf ohne Grenzen): startet den GitHub-Workflow. */
  app.post('/api/ingest/trigger', async (c) => {
    const env = deps.env(c);
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return c.json({ error: 'Nicht eingerichtet: GITHUB_TOKEN und GITHUB_REPO fehlen im Worker.' }, 501);
    }
    const body = (await c.req.json().catch(() => null)) as { gross?: boolean } | null;
    const d = await dispatchWorkflow(env, body?.gross ? (env.GITHUB_GROSS_WORKFLOW ?? 'grosser-lauf.yml') : (env.GITHUB_WORKFLOW ?? 'einsammeln.yml'));
    if (!d.ok) return c.json({ error: `GitHub hat den Start abgelehnt (${d.status}).` }, 502);
    return c.json({ ok: true });
  });

  /** Fernzugriff der Pipeline auf die Datenbank (nur mit INGEST_KEY). */
  app.post('/api/ingest/sql', async (c) => {
    const body = (await c.req.json().catch(() => null)) as
      | { op: 'all' | 'first' | 'run'; sql: string; params?: unknown[] }
      | { op: 'batch'; stmts: { sql: string; params?: unknown[] }[] }
      | null;
    if (!body) return c.json({ error: 'Leere Anfrage.' }, 400);
    const db = deps.db(c);
    try {
      switch (body.op) {
        case 'all':
          return c.json({ rows: await db.all(body.sql, body.params) });
        case 'first':
          return c.json({ row: await db.first(body.sql, body.params) });
        case 'run':
          return c.json(await db.run(body.sql, body.params));
        case 'batch':
          await db.batch(body.stmts);
          return c.json({ ok: true });
        default:
          return c.json({ error: 'Unbekannte Operation.' }, 400);
      }
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  app.notFound((c) => (new URL(c.req.url).pathname.startsWith('/api/') ? c.json({ error: 'Unbekannter Pfad.' }, 404) : c.text('Nicht gefunden', 404)));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Serverfehler. Bitte später erneut versuchen.' }, 500);
  });

  return app;
}
