// Einstieg: Schriften laden, Backend wählen (echte API oder Dummy-Daten), App starten.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import shantellUrl from '@fontsource-variable/shantell-sans/files/shantell-sans-latin-full-normal.woff2';
import shantellExtUrl from '@fontsource-variable/shantell-sans/files/shantell-sans-latin-ext-full-normal.woff2';
import literataUrl from '@fontsource-variable/literata/files/literata-latin-wght-normal.woff2';
import literataExtUrl from '@fontsource-variable/literata/files/literata-latin-ext-wght-normal.woff2';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { HttpBackend } from './data/api';
import type { Backend } from './data/backend';
import { StoreContext } from './data/hooks';
import { lsGet, lsSet } from './data/local';
import { Store } from './data/store';
import { loadTestPhotos } from './data/testPhotos';
import { apiBase, loadConfig } from './lib/config';
import { applyTheme } from './lib/theme';
import { applyLang, useLang } from './i18n';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

// Zeichenbereiche wie bei Fontsource: "latin" für Deutsch und Englisch, "latin-ext" u. a. für č ć š ž đ
// im Serbischen (wird nur geladen, wenn solche Zeichen vorkommen).
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

function loadFonts(): void {
  if (typeof FontFace === 'undefined') return;
  // "full" enthält die Achsen INFM (informell) und BNCE (hüpfend) für die Handschrift
  const shantell = { weight: '300 800', style: 'normal', display: 'swap' } as const;
  const literata = { weight: '200 900', style: 'normal', display: 'swap' } as const;
  const latin = [
    new FontFace('Shantell', `url(${shantellUrl}) format('woff2')`, { ...shantell, unicodeRange: LATIN }),
    new FontFace('Literata', `url(${literataUrl}) format('woff2')`, { ...literata, unicodeRange: LATIN }),
  ];
  const ext = [
    new FontFace('Shantell', `url(${shantellExtUrl}) format('woff2')`, { ...shantell, unicodeRange: LATIN_EXT }),
    new FontFace('Literata', `url(${literataExtUrl}) format('woff2')`, { ...literata, unicodeRange: LATIN_EXT }),
  ];
  for (const f of latin) {
    document.fonts.add(f);
    f.load().catch(() => undefined);
  }
  for (const f of ext) document.fonts.add(f);
}

/** Beim Umschalten der Sprache wird die App neu aufgebaut (Zustand und Adresse bleiben). */
function Root() {
  return <App key={useLang()} />;
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
  applyLang();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
  loadFonts();

  // Dummy-Daten oder Server: steht in config.json neben index.html (siehe lib/config.ts)
  const dummy = (await loadConfig()).daten === 'dummy';
  let backend: Backend | null = null;
  if (dummy) {
    const { DemoBackend } = await import('./data/demo');
    backend = new DemoBackend();
    void loadTestPhotos();
  } else {
    const fromLink = keyFromLink();
    if (fromLink) lsSet('sb.key', fromLink);
    const key = fromLink ?? lsGet<string | null>('sb.key', null);
    if (key) backend = new HttpBackend(key, apiBase());
  }

  const store = new Store(backend, dummy);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreContext.Provider value={store}>
        <Root />
      </StoreContext.Provider>
    </StrictMode>,
  );
  if (backend) void store.init();
  if (!__DEMO__) registerSW({ immediate: true });
}

void start();
