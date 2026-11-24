// Cloudflare-Worker-Einstieg: API unter /api/*, alles andere liefert die PWA aus (Workers Static Assets).
// Dazu der tägliche Startschuss fürs Einsammeln (Cron-Auslöser, siehe wrangler.toml und isDailyIngestTime).

import { D1Db, type D1Like } from '@stellen/db';
import { createApp, dispatchWorkflow, isDailyIngestTime, type ApiEnv } from './app';

interface Env extends ApiEnv {
  DB: D1Like;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const app = createApp({
  db: (c) => new D1Db((c.env as Env).DB),
  env: (c) => c.env as Env,
});

export default {
  async fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx as never);
    }
    return env.ASSETS.fetch(request);
  },

  /** Täglich um 12 Uhr deutscher Zeit den Einsammel-Workflow starten (wie der Knopf „Jetzt einsammeln“). */
  async scheduled(controller: { scheduledTime: number; cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    if (!isDailyIngestTime(controller.scheduledTime)) return;
    ctx.waitUntil(
      dispatchWorkflow(env, env.GITHUB_WORKFLOW ?? 'einsammeln.yml').then((r) => {
        if (!r.ok) console.error(`Einsammeln nicht gestartet: GitHub antwortete ${r.status}`);
      }),
    );
  },
};
