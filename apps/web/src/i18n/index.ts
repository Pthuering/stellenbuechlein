// Sprache der Oberfläche: Deutsch, Englisch oder Serbisch (lateinische Schrift).
// Übersetzt werden nur die festen Texte der App. Anzeigen, Namen von Einrichtungen und Orten sowie
// eigene Einträge bleiben, wie sie sind. Die Wahl gilt nur auf diesem Gerät (wie Hell/Dunkel);
// ohne Wahl startet die App auf Serbisch.
//
// Jede Datei legt ihre Texte selbst an, in allen drei Sprachen mit denselben Schlüsseln:
//   const t = texts({
//     de: { title: 'Gemerkt', open: (n: number) => (n === 1 ? '1 offene Anzeige' : `${n} offene Anzeigen`) },
//     en: { title: 'Saved', open: (n) => (n === 1 ? '1 open posting' : `${n} open postings`) },
//     sr: { title: 'Sačuvano', open: (n) => `${n} ${srForm(n, 'otvoren oglas', 'otvorena oglasa', 'otvorenih oglasa')}` },
//   });
//   … <h1>{t.title}</h1> <p>{t.open(3)}</p>
// Der Zugriff liest immer die aktuelle Sprache. Beim Umschalten wird die App neu aufgebaut, deshalb
// Texte nie in Konstanten außerhalb von Funktionen zwischenspeichern.
// Glossar und Hinweise: docs/UEBERSETZUNG.md

import { useSyncExternalStore } from 'react';
import { idbSet, lsGet, lsSet } from '../data/local';

export type Lang = 'de' | 'en' | 'sr';
export const LANGS: Lang[] = ['de', 'en', 'sr'];
/** Name jeder Sprache in ihr selbst. */
export const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English', sr: 'Srpski' };
/** Für <html lang> und Intl. */
export const LANG_TAGS: Record<Lang, string> = { de: 'de', en: 'en', sr: 'sr-Latn' };

const KEY = 'sb.lang';

function isLang(x: unknown): x is Lang {
  return x === 'de' || x === 'en' || x === 'sr';
}

/** Ohne gespeicherte Wahl startet die App auf Serbisch; umschalten geht jederzeit oben im Rand. */
export const DEFAULT_LANG: Lang = 'sr';

let current: Lang = (() => {
  const saved = lsGet<unknown>(KEY, null);
  return isLang(saved) ? saved : DEFAULT_LANG;
})();
const listeners = new Set<() => void>();

export function lang(): Lang {
  return current;
}

/** Setzt <html lang> und legt die Sprache für Benachrichtigungen ab (der Service Worker liest sie). */
export function applyLang(): void {
  document.documentElement.lang = LANG_TAGS[current];
  void idbSet('lang', current);
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  lsSet(KEY, l);
  applyLang();
  for (const f of listeners) f();
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, lang, lang);
}

/** Texte einer Datei; `t.key` liefert immer die aktuelle Sprache. */
export function texts<M extends object>(m: { de: M; en: NoInfer<M>; sr: NoInfer<M> }): M {
  return new Proxy(m.de, { get: (_, key) => (m[current] as Record<string | symbol, unknown>)[key] });
}

/** Ein Text in allen drei Sprachen, für einzelne Stellen ohne eigenes Wörterbuch. */
export function tr(de: string, en: string, sr: string): string {
  return current === 'en' ? en : current === 'sr' ? sr : de;
}

/** Serbische Zahlform (ohne die Zahl): srForm(n, 'oglas', 'oglasa', 'oglasa') → 1 oglas, 3 oglasa, 5 oglasa, 21 oglas. */
export { srForm } from '@stellen/core';

// ---------------------------------------------------------------- Zahlen und Daten

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Datum: „15.11.2026“, „15 Nov 2026“, „15. 11. 2026.“ */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (current === 'en') return `${+d} ${EN_MONTHS[+m - 1]} ${y}`;
  if (current === 'sr') return `${+d}. ${+m}. ${y}.`;
  return `${d}.${m}.${y}`;
}

/** Tag und Monat: „15.11.“, „15 Nov“, „15. 11.“ */
export function fmtDayMonth(iso: string | null | undefined): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  if (current === 'en') return `${+d} ${EN_MONTHS[+m - 1]}`;
  if (current === 'sr') return `${+d}. ${+m}.`;
  return `${d}.${m}.`;
}

/** Dezimalzahl: Komma auf Deutsch und Serbisch, Punkt auf Englisch; ganze Zahlen ohne Nachkommastelle. */
export function fmtNum(x: number, digits = 1): string {
  const s = Number.isInteger(x) ? String(x) : x.toFixed(digits);
  return current === 'en' ? s : s.replace('.', ',');
}

/** Prozent: „65 %“ auf Deutsch, „65%“ auf Englisch und Serbisch. */
export function fmtPct(n: number): string {
  return current === 'de' ? `${n} %` : `${n}%`;
}

/** Entfernung: „unter 1 km“, „4,5 km“, „120 km“. */
export function fmtKm(km: number | null | undefined): string {
  if (km == null) return '';
  if (km < 1) return tr('unter 1 km', 'under 1 km', 'manje od 1 km');
  if (km < 10) return `${fmtNum(Math.round(km * 10) / 10)} km`;
  return `${Math.round(km)} km`;
}
