// Aufräumen des Bestands: falsche Kennziffern entfernen und Dubletten zusammenführen.
// Dieselben Regeln wie beim Einsammeln (pipeline.ts findDuplicate), nur einmal über alles, was schon gespeichert ist.

import { fuzzyKey, isNoiseSegment, jobLikeUrl, plausibleReference, samePlace, textSimilarity, titleSimilarity, urlKey } from '@stellen/core';
import { jobAliasStmt, type Db, type Stmt } from '@stellen/db';
import { significantWords } from './pipeline';

interface Row {
  id: string;
  canonical_url: string;
  title: string;
  institution_id: string | null;
  content_hash: string;
  reference_no: string | null;
  deadline: string | null;
  first_seen_at: string;
  completeness: string;
  status: string;
  city_id: string | null;
  location_text: string | null;
  len: number;
  marked: number;
}

export interface DuplicateGroup {
  keep: Row;
  drop: Row[];
  /** text: derselbe Text; adresse: fast dieselbe Adresse und fast derselbe Text; quellen: gleicher Titel aus zwei Quellen */
  why: 'text' | 'adresse' | 'quellen';
}

export interface CleanupReport {
  kennziffern: number;
  gruppen: DuplicateGroup[];
  /** Gruppen, in denen mehrere Anzeigen markiert sind: bleiben, wie sie sind */
  uebersprungen: number;
}

async function chunked(db: Db, stmts: Stmt[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
}

/** Kennziffern, die keine sind (Web-Adresse, Jahreszahl, Kurzkürzel), löschen und den Dubletten-Schlüssel neu bilden. */
async function fixReferences(db: Db, apply: boolean): Promise<number> {
  const rows = await db.all<{ id: string; title: string; institution_id: string | null; deadline: string | null; reference_no: string }>(
    'SELECT id, title, institution_id, deadline, reference_no FROM jobs WHERE reference_no IS NOT NULL',
  );
  const bad = rows.filter((r) => plausibleReference(r.reference_no) == null);
  if (apply) {
    await chunked(
      db,
      bad.map((r) => ({
        sql: 'UPDATE jobs SET reference_no = NULL, fuzzy_key = ? WHERE id = ?',
        params: [fuzzyKey({ institutionId: r.institution_id, title: r.title, deadline: r.deadline, referenceNo: null }), r.id],
      })),
    );
  }
  return bad.length;
}

async function descriptions(db: Db, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const rows = await db.all<{ id: string; d: string }>(`SELECT id, description_md AS d FROM jobs WHERE id IN (${part.map(() => '?').join(', ')})`, part);
    for (const r of rows) out.set(r.id, r.d);
  }
  return out;
}

/** Findet Gruppen derselben Anzeige unter den sichtbaren und geprüften Anzeigen. */
export async function findDuplicateGroups(db: Db): Promise<{ gruppen: DuplicateGroup[]; uebersprungen: number }> {
  const rows = await db.all<Row>(
    `SELECT id, canonical_url, title, institution_id, content_hash, reference_no, deadline, first_seen_at, completeness, status, city_id, location_text, length(description_md) AS len,
            (SELECT COUNT(*) FROM marks m WHERE m.job_id = jobs.id AND (m.decision = 'gemerkt' OR m.star = 1 OR m.applied_at IS NOT NULL)) AS marked
     FROM jobs WHERE status IN ('aktiv', 'pruefung')`,
  );
  const parent = new Map<string, string>();
  const why = new Map<string, DuplicateGroup['why']>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const place = (r: Row) => ({ cityId: r.city_id, locationText: r.location_text });
  const union = (a: Row, b: Row, w: DuplicateGroup['why']) => {
    if (!samePlace(place(a), place(b))) return;
    const ra = find(a.id);
    const rb = find(b.id);
    if (ra === rb) return;
    parent.set(rb, ra);
    if (!why.has(ra)) why.set(ra, w);
  };

  const byHash = new Map<string, Row>();
  for (const r of rows) {
    if (r.completeness !== 'ok' || r.len < 300) continue;
    const e = byHash.get(r.content_hash);
    if (e) union(e, r, 'text');
    else byHash.set(r.content_hash, r);
  }
  // Fast dieselbe Adresse (Sprachversion, Sitzungs-Parameter, „-1“) mit fast gleichem Text
  const byKey = new Map<string, Row[]>();
  for (const r of rows) if (r.completeness === 'ok' && r.len >= 300) byKey.set(urlKey(r.canonical_url), [...(byKey.get(urlKey(r.canonical_url)) ?? []), r]);
  const near = [...byKey.values()].filter((l) => l.length > 1);
  const texts = await descriptions(db, near.flat().map((r) => r.id));
  for (const list of near) {
    for (let i = 1; i < list.length; i++) {
      if (textSimilarity(texts.get(list[0].id) ?? '', texts.get(list[i].id) ?? '') >= 0.9) union(list[0], list[i], 'adresse');
    }
  }
  // Gleicher Titel bei derselben Einrichtung, aber aus verschiedenen Quellen (Institutsseite und Portal)
  const src = new Map<string, Set<string>>();
  for (const r of await db.all<{ job_id: string; source_id: string }>('SELECT job_id, source_id FROM job_sources')) {
    src.set(r.job_id, (src.get(r.job_id) ?? new Set()).add(r.source_id));
  }
  const shareSource = (a: Row, b: Row) => [...(src.get(a.id) ?? [])].some((x) => src.get(b.id)?.has(x));
  const byInst = new Map<string, Row[]>();
  for (const r of rows) if (r.institution_id && significantWords(r.title) >= 2) byInst.set(r.institution_id, [...(byInst.get(r.institution_id) ?? []), r]);
  for (const list of byInst.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.deadline && b.deadline && a.deadline !== b.deadline) continue;
        if (titleSimilarity(a.title, b.title) >= 0.85 && !shareSource(a, b)) union(a, b, 'quellen');
      }
    }
  }

  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(find(r.id), [...(groups.get(find(r.id)) ?? []), r]);
  const gruppen: DuplicateGroup[] = [];
  let uebersprungen = 0;
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    const marked = members.filter((m) => m.marked > 0);
    if (marked.length > 1) {
      uebersprungen++;
      continue;
    }
    // Behalten: die markierte, sonst die zuerst gefundene sichtbare
    const keep = marked[0] ?? [...members].sort((a, b) => Number(a.status !== 'aktiv') - Number(b.status !== 'aktiv') || a.first_seen_at.localeCompare(b.first_seen_at))[0];
    gruppen.push({ keep, drop: members.filter((m) => m.id !== keep.id), why: why.get(root) ?? 'text' });
  }
  return { gruppen, uebersprungen };
}

/**
 * Führt Dubletten zusammen: Quellen und weitere Adressen gehen an die behaltene Anzeige, die übrigen werden gelöscht
 * (mit Grabstein, damit die App sie entfernt). Ihre Adressen bleiben als Dublette bekannt und kommen nicht wieder.
 */
async function mergeGroups(db: Db, gruppen: DuplicateGroup[], now: string): Promise<void> {
  const stmts: Stmt[] = [];
  for (const g of gruppen) {
    for (const d of g.drop) {
      stmts.push(
        {
          sql: `INSERT INTO job_sources (job_id, source_id, url, first_seen_at, last_seen_at)
                SELECT ?, source_id, url, first_seen_at, last_seen_at FROM job_sources WHERE job_id = ? ON CONFLICT(job_id, source_id) DO NOTHING`,
          params: [g.keep.id, d.id],
        },
        { sql: 'UPDATE job_aliases SET job_id = ? WHERE job_id = ?', params: [g.keep.id, d.id] },
        jobAliasStmt(d.canonical_url, g.keep.id, null, now),
        { sql: 'DELETE FROM ki_aufgaben WHERE job_id = ?', params: [d.id] },
        { sql: 'DELETE FROM jobs WHERE id = ?', params: [d.id] },
        { sql: 'DELETE FROM job_sources WHERE job_id = ?', params: [d.id] },
        { sql: 'DELETE FROM marks WHERE job_id = ?', params: [d.id] },
        { sql: 'INSERT OR REPLACE INTO deleted_jobs (id, deleted_at) VALUES (?, ?)', params: [d.id, now] },
      );
    }
    stmts.push({ sql: 'UPDATE jobs SET updated_at = ? WHERE id = ?', params: [now, g.keep.id] });
  }
  await chunked(db, stmts);
}

export async function cleanupJobs(db: Db, opts: { apply: boolean; now?: string }): Promise<CleanupReport> {
  const now = opts.now ?? new Date().toISOString();
  const kennziffern = await fixReferences(db, opts.apply);
  const { gruppen, uebersprungen } = await findDuplicateGroups(db);
  if (opts.apply) await mergeGroups(db, gruppen, now);
  return { kennziffern, gruppen, uebersprungen };
}

// ------------------------------------------------------------------ Adressmuster ohne Anzeigen

/** Ordner für Dateien: Dort liegen auch Ausschreibungen als PDF, also nie als Ganzes überspringen. */
const DOCUMENT_FOLDER = /^(?:fileadmin|user_upload|uploads?|files?|dokumente|documents|downloads?|media|medien|assets|wp-content|system)$/i;

export interface SkipPrefix {
  prefix: string;
  /** so viele als „keine Anzeige“ erkannte Seiten liegen darunter */
  weg: number;
  beispiele: string[];
}

/**
 * Lernt aus den Urteilen (Claude, Regeln, von Hand), unter welchen Adressanfängen nur Seiten liegen, die keine
 * Stellenanzeige sind: mindestens drei solche Seiten, keine einzige bekannte Anzeige, kein Stellenwort im Pfad, und
 * spezifisch genug (zwei Pfadebenen oder ein Ordner wie /blog/ oder /news/, nie nur /de/ oder /2026/), nie ein
 * Dokumentenordner (dort liegen auch Ausschreibungen als PDF). Steht auf der Website schon eine Anzeige, muss es ein
 * Nachrichten- oder Blogordner sein, außer alle bekannten Anzeigen dort haben eine Stellen-Adresse: Adressen, die nach
 * einer Stelle aussehen, überspringt der Lauf ohnehin nie (jobLikeUrl). Seiten, die nur der Grobfilter aussortiert hat,
 * zählen nicht mit (sie können echte Anzeigen sein).
 */
export async function learnSkipPrefixes(db: Db): Promise<{ vorschlaege: SkipPrefix[]; ohneAnzeigen: { host: string; weg: number }[] }> {
  const neg = await db.all<{ url: string; title: string | null }>("SELECT url, title FROM gate_skips WHERE reason IN ('keine-anzeige', 'regel-keine-anzeige')");
  const pos = [
    ...(await db.all<{ url: string }>('SELECT canonical_url AS url FROM jobs')).map((r) => r.url),
    ...(await db.all<{ url: string }>('SELECT url FROM job_aliases')).map((r) => r.url),
  ];
  const host = (u: string) => {
    try {
      return new URL(u).host;
    } catch {
      return '';
    }
  };
  const posByHost = new Map<string, string[]>();
  for (const u of pos) posByHost.set(host(u), [...(posByHost.get(host(u)) ?? []), u]);
  const candidates = new Map<string, { url: string; title: string | null }[]>();
  for (const n of neg) {
    let u: URL;
    try {
      u = new URL(n.url);
    } catch {
      continue;
    }
    if (jobLikeUrl(n.url)) continue;
    const known = posByHost.get(u.host) ?? [];
    const openHost = known.every((p) => jobLikeUrl(p));
    const segs = u.pathname.split('/').filter(Boolean).map((x) => decodeURIComponent(x));
    for (let k = 1; k < segs.length; k++) {
      if (DOCUMENT_FOLDER.test(segs[k - 1])) break;
      const noisy = segs.slice(0, k).some(isNoiseSegment);
      if (!noisy && (k === 1 || !openHost)) continue;
      const p = `${u.protocol}//${u.host}/${u.pathname.split('/').filter(Boolean).slice(0, k).join('/')}/`;
      candidates.set(p, [...(candidates.get(p) ?? []), n]);
    }
  }
  const valid = [...candidates]
    .filter(([p, list]) => list.length >= 3 && !(posByHost.get(host(p)) ?? []).some((u) => u.startsWith(p)))
    .sort((a, b) => b[1].length - a[1].length || a[0].length - b[0].length);
  const covered = new Set<string>();
  const vorschlaege: SkipPrefix[] = [];
  for (const [prefix, list] of valid) {
    const fresh = list.filter((n) => !covered.has(n.url));
    if (fresh.length < 3) continue;
    for (const n of list) covered.add(n.url);
    vorschlaege.push({ prefix, weg: list.length, beispiele: list.slice(0, 2).map((n) => n.title ?? n.url) });
  }
  // Websites, auf denen noch nie eine Anzeige stand: eher die Quelle prüfen oder pausieren als Muster lernen
  const negByHost = new Map<string, number>();
  for (const n of neg) negByHost.set(host(n.url), (negByHost.get(host(n.url)) ?? 0) + 1);
  const ohneAnzeigen = [...negByHost]
    .filter(([h, w]) => w >= 10 && !posByHost.has(h))
    .map(([h, w]) => ({ host: h, weg: w }))
    .sort((a, b) => b.weg - a.weg);
  return { vorschlaege, ohneAnzeigen };
}
