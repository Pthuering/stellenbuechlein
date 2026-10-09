// Cloudflare-Worker-Einstieg: API unter /api/*, alles andere liefert die PWA aus (Workers Static Assets).

import { D1Db, type D1Like } from '@stellen/db';
import { createApp, type ApiEnv } from './app';

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
};
