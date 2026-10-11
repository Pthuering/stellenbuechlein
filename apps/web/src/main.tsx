// Einstieg: Schriften laden, Backend wählen (echte API oder Demo), App starten.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import shantellUrl from '@fontsource-variable/shantell-sans/files/shantell-sans-latin-full-normal.woff2';
import literataUrl from '@fontsource-variable/literata/files/literata-latin-wght-normal.woff2';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { HttpBackend } from './data/api';
import type { Backend } from './data/backend';
import { StoreContext } from './data/hooks';
import { lsGet, lsSet } from './data/local';
import { Store } from './data/store';
import { loadTestPhotos } from './data/testPhotos';
import { applyTheme } from './lib/theme';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

function loadFonts(): void {
  if (typeof FontFace === 'undefined') return;
  const faces = [
    // "full" enthält die Achsen INFM (informell) und BNCE (hüpfend) für die Handschrift
    new FontFace('Shantell', `url(${shantellUrl}) format('woff2')`, { weight: '300 800', style: 'normal', display: 'swap' }),
    new FontFace('Literata', `url(${literataUrl}) format('woff2')`, { weight: '200 900', style: 'normal', display: 'swap' }),
  ];
  for (const f of faces) {
    document.fonts.add(f);
    f.load().catch(() => undefined);
  }
}

/** Schlüssel kann einmalig per Link übergeben werden: https://…/#key=GEHEIM (wird sofort aus der Adresse entfernt). */
function keyFromLink(): string | null {
  const m = location.hash.match(/^#key=([^&]+)/);
  if (!m) return null;
  const key = decodeURIComponent(m[1]);
  history.replaceState(null, '', `${location.pathname}#/stapel`);
  return key;
}

async function start(): Promise<void> {
  applyTheme();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
  loadFonts();

  let backend: Backend | null = null;
  if (__DEMO__) {
    const { DemoBackend } = await import('./data/demo');
    backend = new DemoBackend();
    void loadTestPhotos();
  } else {
    const fromLink = keyFromLink();
    if (fromLink) lsSet('sb.key', fromLink);
    const key = fromLink ?? lsGet<string | null>('sb.key', null);
    if (key) backend = new HttpBackend(key);
  }

  const store = new Store(backend, __DEMO__);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreContext.Provider value={store}>
        <App />
      </StoreContext.Provider>
    </StrictMode>,
  );
  if (backend) void store.init();
  if (!__DEMO__) registerSW({ immediate: true });
}

void start();
