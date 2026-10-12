// HTTP-API der App (Hono). Läuft als Cloudflare Worker (worker.ts) oder als Node-Server (node.ts).

import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  addPushSubscription,
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
  bridgeSuggestionMessages,
  BridgeSuggestionSchema,
  canonicalUrl,
  parseProfile,
  siteKeyOf,
  starterProfile,
  toSuggestedBridges,
  type Institution,
  type InstitutionKind,
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

const SETTINGS_KEYS = new Set(['profile', 'filter', 'home', 'reminders', 'gateTerms', 'sort', 'ui', 'notifyHighScore']);

const INSTITUTION_KINDS = ['universitaet', 'ph', 'hochschule', 'privat', 'mpg', 'leibniz', 'helmholtz', 'fraunhofer', 'klinik', 'ressort', 'sonstige'] as const;

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
    if (env.ALLOWED_ORIGIN) {
      c.header('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN);
      c.header('Access-Control-Allow-Headers', 'authorization, content-type');
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (c.req.method === 'OPTIONS') return c.body(null, 204);
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
    const [institutions, cities, marks, favorites, settings, runs, sources] = await Promise.all([
      listInstitutions(db),
      listCities(db),
      listMarks(db),
      listFavorites(db),
      getSettings(db),
      listRuns(db, 3),
      listSources(db),
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
    const res = await fetch(`${(env.LLM_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.LLM_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env.LLM_MODEL ?? 'deepseek-chat',
        messages: bridgeSuggestionMessages(profile),
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    }).catch(() => null);
    if (!res?.ok) return c.json({ error: 'Die KI hat gerade nicht geantwortet. Bitte später noch einmal versuchen.' }, 502);
    const data = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const content = data?.choices?.[0]?.message?.content ?? '';
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(content.replace(/^```(?:json)?\s*|```\s*$/g, ''));
    } catch {
      parsed = null;
    }
    const r = BridgeSuggestionSchema.safeParse(parsed);
    if (!r.success) return c.json({ error: 'Die Antwort der KI war unbrauchbar. Bitte noch einmal versuchen.' }, 502);
    return c.json({ bruecken: toSuggestedBridges(r.data, profile) });
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

  /** "Jetzt einsammeln": startet den GitHub-Actions-Workflow (falls Token hinterlegt). */
  app.post('/api/ingest/trigger', async (c) => {
    const env = deps.env(c);
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return c.json({ error: 'Nicht eingerichtet: GITHUB_TOKEN und GITHUB_REPO fehlen im Worker.' }, 501);
    }
    const d = await dispatchWorkflow(env, env.GITHUB_WORKFLOW ?? 'einsammeln.yml');
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
