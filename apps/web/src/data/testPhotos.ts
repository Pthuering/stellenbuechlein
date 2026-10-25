// Nur für die Demo: eigene Fotos ausprobieren, um zu sehen, wie Karten mit echten Bildern wirken.
// Die Fotos werden verkleinert und bleiben nur in diesem Browser (IndexedDB, sonst nur bis zum Neuladen).
// Jede Einrichtung bekommt immer dasselbe Foto aus der Auswahl.

import { useSyncExternalStore } from 'react';
import { idbDel, idbGet, idbSet } from './local';
import { texts } from '../i18n';

const t = texts({
  de: { credit: 'Testfoto, nur auf diesem Gerät' },
  en: { credit: 'Test photo, only on this device' },
  sr: { credit: 'Probna fotografija, samo na ovom uređaju' },
});

const KEY = 'demo.testfotos.v1';
const MAX_EDGE = 960;
const MAX_PHOTOS = 24;

let photos: string[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export async function loadTestPhotos(): Promise<void> {
  const stored = await idbGet<string[]>(KEY);
  if (Array.isArray(stored)) {
    photos = stored.filter((p) => typeof p === 'string' && p.startsWith('data:image/'));
    emit();
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function snapshot(): string[] {
  return photos;
}

export function useTestPhotos(): string[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Foto für eine Einrichtung (oder Stadt): immer dasselbe, solange die Auswahl gleich bleibt. */
export function testPhotoFor(list: string[], key: string): string | null {
  if (list.length === 0) return null;
  return list[hashOf(key) % list.length];
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // weiter mit <img>, z. B. bei Formaten, die createImageBitmap nicht kennt
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function shrink(file: File): Promise<string> {
  const img = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Zeichenkontext');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/** Fügt Fotos hinzu. Gibt zurück, wie viele geklappt haben und wie viele nicht. */
export async function addTestPhotos(files: Iterable<File>): Promise<{ added: number; failed: number }> {
  let added = 0;
  let failed = 0;
  const next = [...photos];
  for (const f of files) {
    if (next.length >= MAX_PHOTOS) break;
    try {
      next.push(await shrink(f));
      added++;
    } catch {
      failed++;
    }
  }
  photos = next;
  emit();
  await idbSet(KEY, photos);
  return { added, failed };
}

export async function clearTestPhotos(): Promise<void> {
  photos = [];
  emit();
  await idbDel(KEY);
}

/** Bildnachweis für Testfotos in der aktuellen Sprache. */
export function testPhotoCredit(): string {
  return t.credit;
}
