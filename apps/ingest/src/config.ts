// Einstellungen der Einsammel-Pipeline aus Umgebungsvariablen (siehe docs/BETRIEB.md).

import { bigModel } from '@stellen/core';

export interface IngestConfig {
  userAgent: string;
  uaToken: string;
  /**
   * Sperren aus der robots.txt beachten (ROBOTS=1). Standard: nein – die App liest nur öffentliche
   * Stellenanzeigen für eine Person. Abstand pro Website und Crawl-delay gelten trotzdem immer.
   */
  respectRobots: boolean;
  minHostIntervalMs: number;
  maxCrawlDelayMs: number;
  requestTimeoutMs: number;
  maxPagesPerList: number;
  maxNewDetailsPerSource: number;
  refetchAfterDays: number;
  goneAfterDays: number;
  purgeAfterDays: number;
  sourceConcurrency: number;
  /** Nach so vielen Millisekunden ab Laufbeginn werden keine neuen Quellen mehr begonnen (Workflow-Grenze 120 Minuten). */
  sourceBudgetMs: number;
  /** Nach so vielen Millisekunden ab Laufbeginn beginnt der Browser-Agent keine Seite mehr (Uhrzeit, nicht nur Browserzeit). */
  runBudgetMs: number;
  /** So viele abgerufene Seiten hält der Zwischenspeicher eines Laufs höchstens. */
  httpCacheMax: number;
  llm: {
    baseUrl: string;
    apiKey: string | null;
    model: string;
    maxCalls: number;
    summaries: boolean;
  };
  browser: {
    enabled: boolean;
    executablePath?: string;
    maxQueueItemsPerRun: number;
    /** Seiten gleichzeitig (Standard 1, im großen Durchlauf mehr) */
    concurrency: number;
    timeBudgetMs: number;
  };
  discovery: { maxInstitutionsPerRun: number };
  images: { maxPerRun: number };
  /** Suche nach blinden Flecken: Anzeigen von Websites, die noch nicht im Register stehen. */
  explore: {
    enabled: boolean;
    /** So viele neue Anzeigen von neuen Websites soll jeder Lauf mindestens bringen. */
    minNew: number;
    /** Höchstens so viele Anzeigen werden dafür gelesen. */
    maxReads: number;
    /** Suchanfragen pro Lauf (rotieren täglich), bei Bedarf mehr bis maxQueries. */
    queriesPerRun: number;
    maxQueries: number;
  };
  /** Horizont und Weite: KI-Urteil für Anzeigen außerhalb des Kernbereichs. */
  horizon: {
    /** Höchstens so viele KI-Prüfungen für die Weite pro Lauf. */
    maxWeiteChecks: number;
  };
  /** Optionale Websuche für die Erkundung. */
  search: {
    braveKey: string | null;
  };
  /** Schnittstelle der Arbeitsagentur (für Tests austauschbar). */
  baApiBase: string;
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? n : d;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): IngestConfig {
  // `||` statt `??`: GitHub Actions setzt fehlende Secrets als leeren Text.
  const contact = env.CRAWLER_CONTACT || 'privates Jobsuche-Werkzeug';
  const uaToken = 'Stellenbuechlein';
  return {
    uaToken,
    userAgent: env.CRAWLER_UA ?? `Mozilla/5.0 (compatible; ${uaToken}/0.1; ${contact})`,
    respectRobots: (env.ROBOTS ?? '0') === '1',
    minHostIntervalMs: num(env.HOST_INTERVAL_MS, 1500),
    maxCrawlDelayMs: num(env.MAX_CRAWL_DELAY_MS, 15_000),
    requestTimeoutMs: num(env.REQUEST_TIMEOUT_MS, 25_000),
    maxPagesPerList: num(env.MAX_LIST_PAGES, 6),
    maxNewDetailsPerSource: num(env.MAX_NEW_PER_SOURCE, 80),
    refetchAfterDays: num(env.REFETCH_AFTER_DAYS, 6),
    goneAfterDays: num(env.GONE_AFTER_DAYS, 3),
    purgeAfterDays: num(env.PURGE_AFTER_DAYS, 14),
    sourceConcurrency: num(env.SOURCE_CONCURRENCY, 6),
    sourceBudgetMs: num(env.SOURCE_BUDGET_MIN, 90) * 60_000,
    runBudgetMs: num(env.RUN_BUDGET_MIN, 105) * 60_000,
    httpCacheMax: num(env.HTTP_CACHE_MAX, 200),
    llm: {
      baseUrl: env.LLM_BASE_URL ?? 'https://api.deepseek.com',
      apiKey: env.LLM_API_KEY || env.DEEPSEEK_API_KEY || null,
      model: bigModel(env.LLM_MODEL),
      maxCalls: num(env.LLM_MAX_CALLS, 900),
      summaries: (env.LLM_SUMMARIES ?? '1') !== '0',
    },
    browser: {
      enabled: (env.BROWSER ?? '1') !== '0',
      executablePath: env.CHROMIUM_PATH || undefined,
      maxQueueItemsPerRun: num(env.BROWSER_MAX_ITEMS, 30),
      concurrency: num(env.BROWSER_CONCURRENCY, 1),
      timeBudgetMs: num(env.BROWSER_BUDGET_MS, 12 * 60_000),
    },
    discovery: { maxInstitutionsPerRun: num(env.DISCOVERY_MAX, 20) },
    images: { maxPerRun: num(env.IMAGES_MAX, 60) },
    explore: {
      enabled: (env.EXPLORE ?? '1') !== '0',
      minNew: num(env.EXPLORE_MIN, 3),
      maxReads: num(env.EXPLORE_MAX_READS, 40),
      queriesPerRun: num(env.EXPLORE_QUERIES, 6),
      maxQueries: num(env.EXPLORE_MAX_QUERIES, 18),
    },
    horizon: {
      maxWeiteChecks: num(env.WEITE_MAX_CHECKS, 60),
    },
    search: {
      braveKey: env.BRAVE_API_KEY || null,
    },
    baApiBase: env.BA_API_BASE ?? 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service',
    vapid:
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:stellenbuechlein@example.org' }
        : null,
  };
}

/**
 * Großer Durchlauf nach einer Profil-Freigabe: keine Mengengrenzen, mehr gleichzeitig, Zeitgrenzen passend
 * zum 6-Stunden-Workflow (was dann noch offen ist, übernimmt eine Fortsetzung).
 */
export function bigRunConfig(c: IngestConfig, env: NodeJS.ProcessEnv = process.env): IngestConfig {
  const lots = 1_000_000;
  return {
    ...c,
    maxPagesPerList: Math.max(c.maxPagesPerList, 30),
    maxNewDetailsPerSource: lots,
    sourceConcurrency: num(env.SOURCE_CONCURRENCY, 12),
    sourceBudgetMs: num(env.SOURCE_BUDGET_MIN, 270) * 60_000,
    runBudgetMs: num(env.RUN_BUDGET_MIN, 330) * 60_000,
    llm: { ...c.llm, maxCalls: lots },
    browser: { ...c.browser, maxQueueItemsPerRun: lots, timeBudgetMs: lots * 60_000, concurrency: num(env.BROWSER_CONCURRENCY, 4) },
    discovery: { maxInstitutionsPerRun: lots },
    explore: { ...c.explore, maxReads: Math.max(c.explore.maxReads, 200), queriesPerRun: Math.max(c.explore.queriesPerRun, 30), maxQueries: Math.max(c.explore.maxQueries, 60) },
    horizon: { maxWeiteChecks: lots },
  };
}
