// Benachrichtigungen per Web Push: Fristen-Erinnerungen für Herzensjobs (★) und, gebündelt, neue
// Anzeigen, die besonders gut zum Suchprofil passen (Einstellung „notifyHighScore“).

import webpush from 'web-push';
import { DEFAULT_REMINDER_DAYS, dueReminders, highScoreDigest, parseHighScoreAlert, reminderText, todayBerlin, type UiLang } from '@stellen/core';
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

/** Eine Benachrichtigung für alle neuen Anzeigen dieses Laufs ab der eingestellten Schwelle. */
export async function sendHighScoreAlert(db: Db, cfg: IngestConfig, log: RunLog, jobs: readonly { id: string; title: string; score: number }[]): Promise<number> {
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
