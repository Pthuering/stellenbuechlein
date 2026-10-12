// Einstellungen der Einsammel-Pipeline aus Umgebungsvariablen (siehe docs/BETRIEB.md).

export interface IngestConfig {
  userAgent: string;
  uaToken: string;
  minHostIntervalMs: number;
  maxCrawlDelayMs: number;
  requestTimeoutMs: number;
  maxPagesPerList: number;
  maxNewDetailsPerSource: number;
  refetchAfterDays: number;
  goneAfterDays: number;
  purgeAfterDays: number;
  sourceConcurrency: number;
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
  const contact = env.CRAWLER_CONTACT ?? 'privates Jobsuche-Werkzeug';
  const uaToken = 'Stellenbuechlein';
  return {
    uaToken,
    userAgent: env.CRAWLER_UA ?? `Mozilla/5.0 (compatible; ${uaToken}/0.1; ${contact})`,
    minHostIntervalMs: num(env.HOST_INTERVAL_MS, 1500),
    maxCrawlDelayMs: num(env.MAX_CRAWL_DELAY_MS, 15_000),
    requestTimeoutMs: num(env.REQUEST_TIMEOUT_MS, 25_000),
    maxPagesPerList: num(env.MAX_LIST_PAGES, 6),
    maxNewDetailsPerSource: num(env.MAX_NEW_PER_SOURCE, 80),
    refetchAfterDays: num(env.REFETCH_AFTER_DAYS, 6),
    goneAfterDays: num(env.GONE_AFTER_DAYS, 3),
    purgeAfterDays: num(env.PURGE_AFTER_DAYS, 14),
    sourceConcurrency: num(env.SOURCE_CONCURRENCY, 6),
    llm: {
      baseUrl: env.LLM_BASE_URL ?? 'https://api.deepseek.com',
      apiKey: env.LLM_API_KEY ?? env.DEEPSEEK_API_KEY ?? null,
      model: env.LLM_MODEL ?? 'deepseek-chat',
      maxCalls: num(env.LLM_MAX_CALLS, 900),
      summaries: (env.LLM_SUMMARIES ?? '1') !== '0',
    },
    browser: {
      enabled: (env.BROWSER ?? '1') !== '0',
      executablePath: env.CHROMIUM_PATH || undefined,
      maxQueueItemsPerRun: num(env.BROWSER_MAX_ITEMS, 30),
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
        ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT ?? 'mailto:stellenbuechlein@example.org' }
        : null,
  };
}
