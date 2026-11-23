// Benachrichtigungen per Web Push: Fristen-Erinnerungen für Herzensjobs (★), neue Treffer in den
// ausgewählten Städten (Einstellung „highlight“, einzeln und auffällig) und, gebündelt, die übrigen neuen
// Anzeigen, die besonders gut zum Suchprofil passen (Einstellung „notifyHighScore“).

import webpush from 'web-push';
import {
  DEFAULT_REMINDER_DAYS,
  dueReminders,
  highlightCity,
  highlightNotifications,
  highScoreDigest,
  parseHighlight,
  parseHighScoreAlert,
  reminderText,
  todayBerlin,
  type HighlightHit,
  type UiLang,
} from '@stellen/core';
import { getSetting, listMarks, listPushSubscriptions, reminderSentStmt, remindersSent, removePushSubscription, type Db, type Stmt } from '@stellen/db';
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
  /** Treffer in einer ausgewählten Stadt: bleibt stehen, bis sie angetippt wird, und meldet sich erneut. */
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

/**
 * Neue Anzeigen in den ausgewählten Städten ab der dort eingestellten Schwelle: einzeln (bis zu drei),
 * sonst gebündelt. Gibt die IDs der Treffer zurück, damit die Sammelmeldung sie nicht noch einmal nennt.
 */
async function sendHighlightAlerts(db: Db, cfg: IngestConfig, log: RunLog, jobs: readonly NewJob[]): Promise<{ ids: Set<string>; sent: number }> {
  const none = { ids: new Set<string>(), sent: 0 };
  const setting = parseHighlight(await getSetting<unknown>(db, 'highlight', null));
  if (!setting.push || setting.cities.length === 0) return none;
  const candidates = jobs.filter((j) => j.score >= setting.min);
  if (candidates.length === 0) return none;
  const rows = await db.all<{ id: string; city_id: string | null; location_text: string | null }>(
    `SELECT j.id, COALESCE(j.city_id, i.city_id) AS city_id, j.location_text
       FROM jobs j LEFT JOIN institutions i ON i.id = j.institution_id
      WHERE j.id IN (SELECT value FROM json_each(?))`,
    [JSON.stringify(candidates.map((j) => j.id))],
  );
  const cityRows = await db.all<{ id: string; name: string }>('SELECT id, name FROM cities WHERE id IN (SELECT value FROM json_each(?))', [JSON.stringify(setting.cities)]);
  const cities = new Map(cityRows.map((c) => [c.id, { name: c.name }]));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const hits: HighlightHit[] = [];
  for (const j of candidates) {
    const r = byId.get(j.id);
    const city = r ? highlightCity({ cityId: r.city_id, locationText: r.location_text, score: j.score }, setting, cities) : null;
    if (city) hits.push({ ...j, city: cities.get(city)?.name ?? city });
  }
  if (hits.length === 0) return none;
  const ids = new Set(hits.map((h) => h.id));
  if (!cfg.vapid) {
    log.info(`${hits.length} neue Anzeige(n) in ausgewählten Städten ab ${setting.min} % – Push ist nicht eingerichtet.`);
    return { ids, sent: 0 };
  }
  const de = highlightNotifications(hits, 'de');
  const en = highlightNotifications(hits, 'en');
  const sr = highlightNotifications(hits, 'sr');
  let delivered = 0;
  for (let i = 0; i < de.length; i++) {
    const ok = await deliver(db, cfg, log, { ...de[i], highlight: true, i18n: { en: { title: en[i].title, body: en[i].body }, sr: { title: sr[i].title, body: sr[i].body } } });
    if (ok) delivered++;
  }
  log.info(
    delivered
      ? `Hervorgehoben: ${hits.length} neue Anzeige(n) in ausgewählten Städten ab ${setting.min} % gemeldet.`
      : `${hits.length} neue Anzeige(n) in ausgewählten Städten ab ${setting.min} % – kein Gerät hat Benachrichtigungen erlaubt.`,
  );
  return { ids, sent: delivered ? hits.length : 0 };
}

/**
 * Benachrichtigungen über neue Anzeigen dieses Laufs: zuerst die Treffer in den ausgewählten Städten
 * (hervorgehoben), dann eine Sammelmeldung für die übrigen ab der allgemeinen Schwelle.
 */
export async function sendHighScoreAlert(db: Db, cfg: IngestConfig, log: RunLog, jobs: readonly NewJob[]): Promise<number> {
  const highlighted = await sendHighlightAlerts(db, cfg, log, jobs).catch((e) => {
    log.warn(`Hervorhebung: ${e instanceof Error ? e.message : String(e)}`);
    return { ids: new Set<string>(), sent: 0 };
  });
  return highlighted.sent + (await sendDigest(db, cfg, log, highlighted.ids.size ? jobs.filter((j) => !highlighted.ids.has(j.id)) : jobs));
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
