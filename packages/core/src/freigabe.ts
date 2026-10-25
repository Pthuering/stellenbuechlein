// Freigabe des Suchprofils und großer Durchlauf: Ein neues oder geändertes Profil wird erst angeschaut,
// angepasst und freigegeben; dann liest ein großer Durchlauf ohne Grenzen alles nach diesem Profil.

import type { Suchprofil } from './profile';

export interface ProfilFreigabe {
  /** updatedAt des zuletzt freigegebenen Profils */
  profilStand: string | null;
  freigegebenAm: string | null;
  /** Zuletzt angestoßener großer Durchlauf */
  grosserLauf: { angefordertAm: string; profilStand: string } | null;
  /** „Später“: für diesen Profilstand keinen großen Durchlauf mehr anbieten */
  spaeterFuer: string | null;
}

export const DEFAULT_FREIGABE: ProfilFreigabe = { profilStand: null, freigegebenAm: null, grosserLauf: null, spaeterFuer: null };

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function parseFreigabe(v: unknown): ProfilFreigabe {
  if (!v || typeof v !== 'object') return DEFAULT_FREIGABE;
  const r = v as Record<string, unknown>;
  const g = r.grosserLauf as Record<string, unknown> | null | undefined;
  return {
    profilStand: str(r.profilStand),
    freigegebenAm: str(r.freigegebenAm),
    grosserLauf: g && str(g.angefordertAm) && str(g.profilStand) ? { angefordertAm: g.angefordertAm as string, profilStand: g.profilStand as string } : null,
    spaeterFuer: str(r.spaeterFuer),
  };
}

/**
 *  leer       – im Profil steht noch nichts (erst Umfrage oder Steckbrief)
 *  pruefen    – Profil nie freigegeben: anschauen, anpassen, freigeben, dann großer Durchlauf
 *  geaendert  – seit der Freigabe geändert: neuen großen Durchlauf anbieten
 *  aktuell    – freigegeben (oder „später“ für diesen Stand)
 */
export type FreigabeZustand = 'leer' | 'pruefen' | 'geaendert' | 'aktuell';

export function freigabeZustand(p: Suchprofil, f: ProfilFreigabe): FreigabeZustand {
  if (!p.categories.some((c) => c.items.length > 0)) return 'leer';
  if (!f.profilStand) return 'pruefen';
  if (f.profilStand === p.updatedAt || f.spaeterFuer === p.updatedAt) return 'aktuell';
  return 'geaendert';
}

/** Freigabe für den aktuellen Profilstand, mit angefordertem großem Durchlauf. */
export function freigeben(p: Suchprofil, f: ProfilFreigabe, now = new Date().toISOString()): ProfilFreigabe {
  return { ...f, profilStand: p.updatedAt, freigegebenAm: now, grosserLauf: { angefordertAm: now, profilStand: p.updatedAt }, spaeterFuer: null };
}
