/// <reference lib="webworker" />
// Service Worker: App offline verfügbar machen, Fristen-Erinnerungen als Benachrichtigung zeigen.

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { createStore, get } from 'idb-keyval';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// Alle Seitenaufrufe bekommen die App-Hülle – außer die API. Auf einer eigenen Website zählt nur der
// Ordner der App (Geltungsbereich des Service Workers), andere Seiten der Website bleiben unberührt.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//, /\/(?!index\.html$)[^/]+\.[a-z0-9]+$/i] }));

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** Übersetzungen (en, sr); Deutsch steht in title/body. */
  i18n?: Record<string, { title?: string; body?: string } | undefined>;
}

/** Sprache der App auf diesem Gerät (legt die App in IndexedDB ab, siehe i18n/index.ts). */
async function deviceLang(): Promise<string> {
  try {
    return (await get<string>('lang', createStore('stellenbuechlein', 'kv'))) ?? 'sr';
  } catch {
    return 'sr';
  }
}

/** Adressen relativ zum Ort der App, damit sie auch in einem Unterordner der Website stimmen ("/#/…" → "<Ordner>/#/…"). */
const inScope = (path: string): string => new URL(path.replace(/^\//, ''), self.registration.scope).href;

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = { title: 'Taras Cutesy Jobsearch App', body: '', url: '/#/gemerkt' };
  try {
    data = { ...data, ...(event.data?.json() as Partial<PushPayload>) };
  } catch {
    data.body = event.data?.text() ?? '';
  }
  event.waitUntil(
    (async () => {
      const t = data.i18n?.[await deviceLang()];
      await self.registration.showNotification(t?.title ?? data.title, {
        body: t?.body ?? data.body,
        icon: inScope('icons/icon-192.png'),
        badge: inScope('icons/badge-96.png'),
        tag: data.tag,
        data: { url: inScope(data.url) },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        try {
          await w.navigate(url);
          return w.focus();
        } catch {
          // weiter mit dem nächsten Fenster
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
