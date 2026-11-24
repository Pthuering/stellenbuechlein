// Sperre der KI-Warteschlange (Einstellung „kiSperre“): So stimmen sich Sitzungen ab, die dieselben Aufgaben
// bearbeiten könnten, etwa eine lokale Sitzung und die Cloud-Routine. Auch der Einsammel-Lauf sperrt die Warteschlange,
// solange er läuft: Die KI-Arbeiter fangen erst an, wenn alles Neue eingereiht ist. Solange die Sperre gilt, gibt
// ki-export keine Aufgaben aus, und ki-status meldet „Gesperrt bis …“. Sie läuft von selbst ab.

import { getSetting, setSetting, type Db } from '@stellen/db';

export interface AiLock {
  bis: string;
  grund: string;
  /** Wer gesperrt hat; „einsammeln“ gibt der Einsammel-Lauf am Ende selbst wieder frei. */
  von?: string;
}

export async function getAiLock(db: Db, now = new Date().toISOString()): Promise<AiLock | null> {
  const l = await getSetting<Partial<AiLock> | null>(db, 'kiSperre', null);
  return l && typeof l.bis === 'string' && l.bis > now
    ? { bis: l.bis, grund: typeof l.grund === 'string' ? l.grund : '', ...(typeof l.von === 'string' ? { von: l.von } : {}) }
    : null;
}

export async function setAiLock(db: Db, minutes: number, grund: string, now = new Date(), von?: string): Promise<AiLock> {
  const lock: AiLock = { bis: new Date(now.getTime() + Math.max(1, Math.min(minutes, 24 * 60)) * 60_000).toISOString(), grund, ...(von ? { von } : {}) };
  await setSetting(db, 'kiSperre', lock);
  return lock;
}

export async function clearAiLock(db: Db): Promise<void> {
  await setSetting(db, 'kiSperre', null);
}

/** So lange gilt die Sperre des Einsammel-Laufs höchstens (der Workflow bricht nach 355 Minuten ab). */
export const INGEST_LOCK_MINUTES = 360;

/**
 * Sperrt die Warteschlange für die Dauer eines Einsammel-Laufs. Eine längere Sperre einer anderen Sitzung bleibt
 * bestehen. Gibt zurück, ob der Lauf die Sperre am Ende selbst wieder aufheben soll.
 */
export async function lockForIngest(db: Db, now = new Date()): Promise<boolean> {
  const before = await getAiLock(db, now.toISOString());
  const bis = new Date(now.getTime() + INGEST_LOCK_MINUTES * 60_000).toISOString();
  if (before && before.von !== 'einsammeln' && before.bis >= bis) return false;
  const seit = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(now);
  await setAiLock(db, INGEST_LOCK_MINUTES, `Einsammel-Lauf läuft (seit ${seit} Uhr); die KI-Aufgaben kommen danach dran.`, now, 'einsammeln');
  return true;
}

/** Hebt die Sperre des Einsammel-Laufs auf, sofern sie inzwischen niemand anderes ersetzt hat. */
export async function unlockAfterIngest(db: Db): Promise<void> {
  const l = await getSetting<Partial<AiLock> | null>(db, 'kiSperre', null);
  if (l && l.von === 'einsammeln') await clearAiLock(db);
}
