// Benachrichtigungen per Web Push: Fristen-Erinnerungen für Herzensjobs (★), neue Treffer der gespeicherten
// Filter mit Push (Einstellung „savedFilters“, einzeln und auffällig, unabhängig vom Filter, der in der App gerade
// gilt; löst die Wunschstädte aus „highlight“ ab) und, gebündelt, die übrigen neuen Anzeigen dieses Laufs, die
// besonders gut zum Suchprofil passen (Einstellung „notifyHighScore“).

import webpush from 'web-push';
import {
  DEFAULT_HOME,
  DEFAULT_REMINDER_DAYS,
  dueReminders,
  filterAlertMessages,
  highScoreDigest,
  horizontOf,
  isThematic,
  laneOf,
  parseHighScoreAlert,
  parseProfile,
  parseSavedFilters,
  passesFilter,
  placeOf,
  reminderText,
  scoreJob,
  searchTextOf,
  starterProfile,
  todayBerlin,
  type FilterAlertHit,
  type GeoContext,
  type HomeLocation,
  type SavedFilter,
  type UiLang,
} from '@stellen/core';
import {
  filterAlertSentStmt,
  filterAlertsSent,
  getSetting,
  listCities,
  listInstitutions,
  listMarks,
  listPushSubscriptions,
  listRecentOpenJobs,
  pruneFilterAlertsStmt,
  reminderSentStmt,
  remindersSent,
  removePushSubscription,
  type Db,
  type Stmt,
} from '@stellen/db';
import type { IngestConfig } from './config';
import type { RunLog } from './log';

export interface ReminderSettings {
  days: number[];
  push: boolean;
}

interface Payload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** Treffer eines gespeicherten Filters: bleibt stehen, bis sie angetippt wird, und meldet sich erneut. */
  highlight?: boolean;
  /** Dieselbe Nachricht auf Englisch und Serbisch; der Service Worker zeigt die Sprache des Geräts. */
  i18n?: Partial<Record<UiLang, { title: string; body: string }>>;
}

/** Titel und Text in allen Sprachen der App (Deutsch oben, die anderen unter i18n). */
function localized(make: (lang: UiLang) => { title: string; body: string }): Pick<Payload, 'title' | 'body' | 'i18n'> {
  return { ...make('de'), i18n: { en: make('en'), sr: make('sr') } };
}

/** Zustellen an alle Geräte; true, wenn mindestens eines sie bekommen hat. Abgelaufene Abos werden entfernt. */
async function deliver(db: Db, cfg: IngestConfig, log: RunLog, payload: Payload): Promise<boolean> {
  if (!cfg.vapid) return false;
  const subs = await listPushSubscriptions(db);
  if (subs.length === 0) return false;
  webpush.setVapidDetails(cfg.vapid.subject, cfg.vapid.publicKey, cfg.vapid.privateKey);
  let delivered = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 24 * 3600 });
      delivered = true;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await removePushSubscription(db, s.endpoint);
        log.info('Abgelaufenes Push-Abo entfernt.');
      } else {
        log.warn(`Push fehlgeschlagen (${code ?? 'unbekannt'}).`);
      }
    }
  }
  return delivered;
}

export async function sendReminders(db: Db, cfg: IngestConfig, log: RunLog, today = todayBerlin()): Promise<number> {
  const settings = await getSetting<ReminderSettings>(db, 'reminders', { days: DEFAULT_REMINDER_DAYS, push: true });
  const marks = (await listMarks(db)).filter((m) => m.star);
  if (marks.length === 0) return 0;
  const rows = await db.all<{ id: string; title: string; deadline: string | null }>(
    'SELECT id, title, deadline FROM jobs WHERE id IN (SELECT value FROM json_each(?))',
    [JSON.stringify(marks.map((m) => m.jobId))],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const due = dueReminders(
    marks.map((m) => ({ jobId: m.jobId, deadline: byId.get(m.jobId)?.deadline ?? null, star: true })),
    settings.days?.length ? settings.days : DEFAULT_REMINDER_DAYS,
    await remindersSent(db),
    today,
  );
  if (due.length === 0) return 0;
  if (!cfg.vapid || settings.push === false) {
    log.info(`${due.length} Erinnerung(en) fällig – Push ist nicht eingerichtet, sie erscheinen nur in der App.`);
    return 0;
  }
  if ((await listPushSubscriptions(db)).length === 0) {
    log.info(`${due.length} Erinnerung(en) fällig – kein Gerät hat Benachrichtigungen erlaubt.`);
    return 0;
  }
  const stmts: Stmt[] = [];
  let sent = 0;
  for (const d of due) {
    const job = byId.get(d.jobId);
    if (!job) continue;
    const texts = localized((lang) => ({ title: reminderText(d.daysLeft, lang), body: job.title }));
    const ok = await deliver(db, cfg, log, { ...texts, url: `/#/stelle/${encodeURIComponent(d.jobId)}`, tag: `frist-${d.jobId}` });
    if (ok) {
      sent++;
      for (const t of d.covers) stmts.push(reminderSentStmt(d.jobId, t));
    }
  }
  await db.batch(stmts);
  log.info(`${sent} Erinnerung(en) verschickt.`);
  return sent;
}

type NewJob = { id: string; title: string; score: number };

const DAY_MS = 86_400_000;
/** Höchstens so weit zurück gilt ein Treffer als neu, auch wenn Push schon länger an ist. */
const FILTER_ALERT_DAYS = 14;
/** Gemeldete Treffer werden so lange gemerkt; ältere können nicht mehr neu genug sein. */
const FILTER_ALERT_KEEP_DAYS = 30;

/** Wohnort aus den Einstellungen wie in der App: nur mit Koordinaten, sonst der Standard. */
function homeOf(raw: unknown): HomeLocation {
  return raw && typeof raw === 'object' && typeof (raw as HomeLocation).lat === 'number' ? (raw as HomeLocation) : DEFAULT_HOME;
}

/** Ab wann ein Treffer für den Filter neu ist: seit pushSince (ohne: nur aus diesem Lauf), höchstens zwei Wochen zurück. */
function cutoffOf(f: SavedFilter, runStartedAt: string, earliest: string): string {
  const t = f.pushSince ? Date.parse(f.pushSince) : NaN;
  const since = Number.isFinite(t) ? new Date(t).toISOString() : runStartedAt;
  return since > earliest ? since : earliest;
}

/** Welche Anzeigen eine Meldung abdeckt: einzeln (Tag „filter-<Filter>-<Anzeige>“) eine, gebündelt alle Treffer. */
function coveredBy(tag: string, filterId: string, hits: readonly FilterAlertHit[]): string[] {
  const prefix = `filter-${filterId}-`;
  if (tag.startsWith(prefix)) {
    const id = tag.slice(prefix.length);
    if (hits.some((h) => h.id === id)) return [id];
  }
  return hits.map((h) => h.id);
}

/**
 * Neue Treffer der gespeicherten Filter mit Push – unabhängig davon, welcher Filter in der App gerade gilt.
 * Kandidaten sind offene Anzeigen, über die noch nicht entschieden ist und die seit dem Einschalten (pushSince)
 * zum ersten Mal gefunden wurden, höchstens zwei Wochen zurück; Filter ohne Zeitpunkt (die früheren Wunschstädte)
 * melden nur Anzeigen aus diesem Lauf. Passung und Ring rechnen mit dem aktuellen Profil wie in der App.
 * Je Filter bis zu drei Treffer einzeln, sonst gebündelt; jeder Treffer wird je Filter nur einmal gemeldet
 * (festgehalten erst, wenn die Meldung auf mindestens einem Gerät ankam).
 * Gibt die IDs der gemeldeten Anzeigen zurück, damit die Sammelmeldung sie nicht noch einmal nennt.
 */
async function sendFilterAlerts(db: Db, cfg: IngestConfig, log: RunLog, runStartedAt: string): Promise<Set<string>> {
  const notified = new Set<string>();
  const [raw, legacy] = await Promise.all([getSetting<unknown>(db, 'savedFilters', null), getSetting<unknown>(db, 'highlight', null)]);
  const filters = parseSavedFilters(raw, legacy).filter((f) => f.push);
  if (filters.length === 0) return notified;

  const start = Date.parse(runStartedAt);
  const today = todayBerlin(new Date(start));
  const earliest = new Date(start - FILTER_ALERT_DAYS * DAY_MS).toISOString();
  const cutoffs = new Map(filters.map((f) => [f.id, cutoffOf(f, runStartedAt, earliest)]));
  const since = [...cutoffs.values()].reduce((a, b) => (a < b ? a : b));
  // Zuerst die schon gemeldeten: Fehlt die Tabelle noch (Migration 0005), bricht es hier ab, bevor etwas verschickt ist.
  const sentBefore = await filterAlertsSent(db, filters.map((f) => f.id));
  const [jobs, marks, insts, cities, profileRaw, homeRaw] = await Promise.all([
    listRecentOpenJobs(db, since, today),
    listMarks(db),
    listInstitutions(db),
    listCities(db),
    getSetting<unknown>(db, 'profile', null),
    getSetting<unknown>(db, 'home', null),
  ]);
  const decided = new Set(marks.filter((m) => m.decision).map((m) => m.jobId));
  const open = jobs.filter((j) => !decided.has(j.id));
  if (open.length === 0) return notified;

  const profile = parseProfile(profileRaw) ?? starterProfile();
  const horizon = horizontOf(profile);
  const geo: GeoContext = { home: homeOf(homeRaw), institutions: new Map(insts.map((i) => [i.id, i])), cities: new Map(cities.map((c) => [c.id, c])) };
  // Ort, Passung und Ring einmal je Anzeige, wie in der App (useViews)
  const views = open.map((job) => {
    const norm = searchTextOf(job);
    return { job, norm, place: placeOf(job, geo), score: scoreJob(job, norm, profile).score, lane: laneOf(job, norm, horizon, isThematic(job, norm, profile)).lane };
  });

  const found: { filter: SavedFilter; hits: FilterAlertHit[] }[] = [];
  for (const f of filters) {
    const cutoff = cutoffs.get(f.id)!;
    const hits = views
      .filter((v) => v.job.firstSeenAt >= cutoff && !sentBefore.has(`${f.id}:${v.job.id}`))
      .filter((v) => passesFilter(v.job, f.filter, v.place, geo, v.norm, today, v.lane, v.score))
      .map((v) => ({ id: v.job.id, title: v.job.title, score: v.score }));
    if (hits.length) found.push({ filter: f, hits });
  }
  if (found.length === 0) return notified;

  const total = new Set(found.flatMap((x) => x.hits.map((h) => h.id))).size;
  const which = found.map((x) => `„${x.filter.name}“: ${x.hits.length}`).join(', ');
  if (!cfg.vapid) {
    log.info(`${total} neue Treffer für gespeicherte Filter (${which}) – Push ist nicht eingerichtet.`);
    return notified;
  }
  if ((await listPushSubscriptions(db)).length === 0) {
    log.info(`${total} neue Treffer für gespeicherte Filter (${which}) – kein Gerät hat Benachrichtigungen erlaubt.`);
    return notified;
  }

  const stmts: Stmt[] = [pruneFilterAlertsStmt(new Date(start - FILTER_ALERT_KEEP_DAYS * DAY_MS).toISOString())];
  let messages = 0;
  for (const { filter, hits } of found) {
    // Gleiche Treffer, gleiche Reihenfolge: die Meldungen der drei Sprachen gehören über den Index zusammen
    const de = filterAlertMessages(filter, hits, 'de');
    const en = filterAlertMessages(filter, hits, 'en');
    const sr = filterAlertMessages(filter, hits, 'sr');
    for (let i = 0; i < de.length; i++) {
      const ok = await deliver(db, cfg, log, { ...de[i], highlight: true, i18n: { en: { title: en[i].title, body: en[i].body }, sr: { title: sr[i].title, body: sr[i].body } } });
      if (!ok) continue;
      messages++;
      for (const id of coveredBy(de[i].tag, filter.id, hits)) {
        stmts.push(filterAlertSentStmt(filter.id, id, runStartedAt));
        notified.add(id);
      }
    }
  }
  await db.batch(stmts);
  log.info(
    messages
      ? `Gespeicherte Filter: ${notified.size} neue Treffer in ${messages} Benachrichtigung(en) gemeldet (${which}).`
      : `${total} neue Treffer für gespeicherte Filter (${which}) – keine Benachrichtigung kam an.`,
  );
  return notified;
}

/**
 * Benachrichtigungen über neue Anzeigen: zuerst die Treffer der gespeicherten Filter mit Push (hervorgehoben),
 * dann eine Sammelmeldung für die übrigen neuen Anzeigen dieses Laufs ab der allgemeinen Schwelle.
 * runStartedAt ist der Start des Laufs; so ist auch first_seen_at der Anzeigen dieses Laufs gesetzt.
 */
export async function sendHighScoreAlert(db: Db, cfg: IngestConfig, log: RunLog, jobs: readonly NewJob[], runStartedAt: string): Promise<number> {
  const notified = await sendFilterAlerts(db, cfg, log, runStartedAt).catch((e) => {
    log.warn(`Gespeicherte Filter: ${e instanceof Error ? e.message : String(e)}`);
    return new Set<string>();
  });
  return notified.size + (await sendDigest(db, cfg, log, notified.size ? jobs.filter((j) => !notified.has(j.id)) : jobs));
}

/** Eine Benachrichtigung für alle neuen Anzeigen dieses Laufs ab der eingestellten Schwelle. */
async function sendDigest(db: Db, cfg: IngestConfig, log: RunLog, jobs: readonly NewJob[]): Promise<number> {
  const setting = parseHighScoreAlert(await getSetting<unknown>(db, 'notifyHighScore', null));
  if (!setting.on) return 0;
  const digest = highScoreDigest(jobs, setting.min);
  if (!digest) return 0;
  const n = jobs.filter((j) => j.score >= setting.min).length;
  if (!cfg.vapid) {
    log.info(`${n} neue Anzeige(n) ab ${setting.min} % – Push ist nicht eingerichtet.`);
    return 0;
  }
  const texts = localized((lang) => {
    const d = highScoreDigest(jobs, setting.min, lang)!;
    return { title: d.title, body: d.body };
  });
  const ok = await deliver(db, cfg, log, { ...digest, ...texts });
  log.info(ok ? `Benachrichtigung über ${n} neue Anzeige(n) ab ${setting.min} % verschickt.` : `${n} neue Anzeige(n) ab ${setting.min} % – kein Gerät hat Benachrichtigungen erlaubt.`);
  return ok ? n : 0;
}
