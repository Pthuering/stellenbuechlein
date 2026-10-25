// Kosten der KI und der Verbrauchszähler. DeepSeek rechnet in US-Dollar ab; die App zeigt ungefähre Euro.

/** Preise pro Million Tokens außerhalb der Spitzenzeit, Stand Oktober 2026 (api-docs.deepseek.com/quick_start/pricing). */
export const DEEPSEEK_PRICES: Record<string, { hit: number; miss: number; out: number }> = {
  'deepseek-v4-pro': { hit: 0.022, miss: 0.66, out: 1.98 },
  'deepseek-flash': { hit: 0.003, miss: 0.15, out: 0.6 },
};

/** Ungefährer Kurs für die Anzeige (Sommer 2026: 1 € ≈ 1,15 $). */
export const EUR_PER_USD = 0.87;

/** Ab diesem Verbrauch an einem Tag zeigt die App einen kleinen Hinweis (gesperrt wird nichts). */
export const DAILY_HINT_EUR = 1;

/** Spitzenzeit bei DeepSeek: werktags 01–04 und 06–10 Uhr UTC, dann kostet alles das Doppelte. */
export function isDeepseekPeak(at: Date): boolean {
  const day = at.getUTCDay();
  const h = at.getUTCHours();
  if (day === 0 || day === 6) return false;
  return (h >= 1 && h < 4) || (h >= 6 && h < 10);
}

export interface LlmUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
}

/** Kosten eines Aufrufs in US-Dollar. Unbekannte Modelle werden wie das große Modell gerechnet. */
export function llmCostUsd(usage: LlmUsage | null | undefined, model: string, at = new Date()): number {
  if (!usage) return 0;
  const p = DEEPSEEK_PRICES[model] ?? DEEPSEEK_PRICES['deepseek-v4-pro'];
  const hit = usage.prompt_cache_hit_tokens ?? 0;
  const miss = usage.prompt_cache_miss_tokens ?? Math.max(0, (usage.prompt_tokens ?? 0) - hit);
  const out = usage.completion_tokens ?? 0;
  return ((hit * p.hit + miss * p.miss + out * p.out) / 1_000_000) * (isDeepseekPeak(at) ? 2 : 1);
}

/** Verbrauch der KI im Worker (Gespräche, Brücken-Vorschläge) pro Tag (deutsche Zeit). */
export interface KiVerbrauch {
  tage: Record<string, { usd: number; anfragen: number }>;
}

export function addUsage(v: KiVerbrauch | null | undefined, day: string, usd: number, keepDays = 62): KiVerbrauch {
  const tage = { ...(v?.tage ?? {}) };
  const t = tage[day] ?? { usd: 0, anfragen: 0 };
  tage[day] = { usd: t.usd + usd, anfragen: t.anfragen + 1 };
  const keep = Object.keys(tage).sort().slice(-keepDays);
  return { tage: Object.fromEntries(keep.map((k) => [k, tage[k]])) };
}

/** Übersicht für die App: Worker und Einsammel-Läufe zusammen. */
export interface KiUsageReport {
  /** Neueste zuerst, nur Tage mit Verbrauch. */
  tage: { tag: string; appUsd: number; einsammelnUsd: number }[];
  heuteUsd: number;
  monatUsd: number;
  /** Guthaben bei DeepSeek, falls abrufbar. */
  guthaben: { waehrung: string; betrag: number; verfuegbar: boolean } | null;
}
