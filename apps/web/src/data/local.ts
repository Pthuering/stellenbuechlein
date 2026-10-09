// Speicher im Browser – immer mit try/catch, weil er in privaten Fenstern oder eingebetteten
// Ansichten fehlen kann. Die App funktioniert auch ohne.

import { createStore, get, set, del } from 'idb-keyval';

let idbStore: ReturnType<typeof createStore> | null = null;
function store() {
  if (!idbStore) idbStore = createStore('stellenbuechlein', 'kv');
  return idbStore;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    return await get<T>(key, store());
  } catch {
    return undefined;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    await set(key, value, store());
  } catch {
    // ignorieren – nur Zwischenspeicher
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    await del(key, store());
  } catch {
    // ignorieren
  }
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignorieren
  }
}

export function lsDel(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignorieren
  }
}
