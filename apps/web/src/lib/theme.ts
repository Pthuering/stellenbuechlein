// Hell/Dunkel: "auto" folgt dem Gerät. Gespeichert nur auf diesem Gerät.

import { lsGet, lsSet } from '../data/local';

export type ThemeChoice = 'auto' | 'hell' | 'dunkel';
const KEY = 'sb.theme';

export function getTheme(): ThemeChoice {
  const t = lsGet<string>(KEY, 'auto');
  return t === 'hell' || t === 'dunkel' ? t : 'auto';
}

// Nur ein selbst gesetztes data-theme wieder entfernen – eine einbettende Seite (z. B. die Demo-Ansicht)
// darf ihr eigenes setzen, und "wie das Gerät" soll das respektieren.
let ownsAttribute = false;
let hostValue: string | null = null;

export function applyTheme(choice: ThemeChoice = getTheme()): void {
  const root = document.documentElement;
  if (choice === 'auto') {
    if (ownsAttribute) {
      if (hostValue) root.setAttribute('data-theme', hostValue);
      else root.removeAttribute('data-theme');
    }
    ownsAttribute = false;
  } else {
    if (!ownsAttribute) hostValue = root.getAttribute('data-theme');
    root.setAttribute('data-theme', choice === 'hell' ? 'light' : 'dark');
    ownsAttribute = true;
  }
  const attr = root.getAttribute('data-theme');
  const dark = attr ? attr === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#241B2B' : '#F28DB2'));
}

export function setTheme(choice: ThemeChoice): void {
  lsSet(KEY, choice);
  applyTheme(choice);
}
