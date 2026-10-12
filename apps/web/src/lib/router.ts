// Kleiner Hash-Router: #/stapel, #/karte, #/gemerkt, #/alle, #/ich[/unterseite], #/stelle/<id>

import { useEffect, useState } from 'react';

export type Tab = 'stapel' | 'karte' | 'gemerkt' | 'alle' | 'ich';
export const TABS: Tab[] = ['stapel', 'karte', 'gemerkt', 'alle', 'ich'];

export interface Route {
  tab: Tab;
  sub: string | null;
  jobId: string | null;
}

let lastTab: Tab = 'stapel';
let lastSub: string | null = null;
let inAppNavigations = 0;

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'stelle' && parts[1]) return { tab: lastTab, sub: lastSub, jobId: parts[1] };
  const tab = (TABS as string[]).includes(parts[0] ?? '') ? (parts[0] as Tab) : 'stapel';
  lastTab = tab;
  lastSub = parts[1] ?? null;
  return { tab, sub: lastSub, jobId: null };
}

export function navigate(to: string, replace = false): void {
  const hash = to.startsWith('#') ? to : `#${to}`;
  if (replace) {
    history.replaceState(history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    inAppNavigations++;
    location.hash = hash;
  }
}

export function openJob(id: string): void {
  navigate(`/stelle/${encodeURIComponent(id)}`);
}

/** Schließt ein Overlay: zurück, wenn wir es selbst geöffnet haben, sonst zum letzten Reiter. */
export function closeOverlay(): void {
  if (inAppNavigations > 0) {
    inAppNavigations--;
    history.back();
  } else {
    navigate(`/${lastTab}${lastSub ? `/${lastSub}` : ''}`, true);
  }
}

/** Verlässt eine geöffnete Anzeige direkt in Richtung einer anderen Seite (ersetzt den Verlaufseintrag). */
export function leaveOverlayTo(to: string): void {
  if (inAppNavigations > 0) inAppNavigations--;
  navigate(to, true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
