import { beforeEach, describe, expect, it } from 'vitest';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { getAiLock, lockForIngest, setAiLock, unlockAfterIngest } from '../src/sperre';

let db: SqliteDb;
beforeEach(() => {
  db = new SqliteDb(':memory:');
  migrateSqlite(db);
});

describe('KI-Sperre während des Einsammelns', () => {
  it('sperrt die Warteschlange für den Lauf und gibt sie danach wieder frei', async () => {
    const now = new Date('2026-11-25T11:00:00Z');
    expect(await lockForIngest(db, now)).toBe(true);
    const l = await getAiLock(db, now.toISOString());
    expect(l?.von).toBe('einsammeln');
    expect(l?.grund).toMatch(/Einsammel-Lauf läuft \(seit 12:00 Uhr\)/);
    await unlockAfterIngest(db);
    expect(await getAiLock(db, now.toISOString())).toBeNull();
  });

  it('lässt eine längere Sperre einer anderen Sitzung stehen', async () => {
    const now = new Date('2026-11-25T11:00:00Z');
    await setAiLock(db, 12 * 60, 'Vorab bearbeitete Ergebnisse werden eingespielt.', now);
    expect(await lockForIngest(db, now)).toBe(false);
    await unlockAfterIngest(db);
    expect((await getAiLock(db, now.toISOString()))?.grund).toMatch(/Vorab/);
  });

  it('gibt eine Sperre nicht frei, die inzwischen jemand anderes gesetzt hat', async () => {
    const now = new Date('2026-11-25T11:00:00Z');
    await lockForIngest(db, now);
    await setAiLock(db, 30, 'Lokale Sitzung arbeitet gerade.', now);
    await unlockAfterIngest(db);
    expect((await getAiLock(db, now.toISOString()))?.grund).toMatch(/Lokale Sitzung/);
  });
});
