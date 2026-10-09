// Fristen-Erinnerungen für Herzensjobs (★) per Web Push.

import webpush from 'web-push';
import { DEFAULT_REMINDER_DAYS, dueReminders, reminderText, todayBerlin } from '@stellen/core';
import { getSetting, listMarks, listPushSubscriptions, reminderSentStmt, remindersSent, removePushSubscription, type Db, type Stmt } from '@stellen/db';
import type { IngestConfig } from './config';
import type { RunLog } from './log';

export interface ReminderSettings {
  days: number[];
  push: boolean;
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
  const subs = await listPushSubscriptions(db);
  if (subs.length === 0) {
    log.info(`${due.length} Erinnerung(en) fällig – kein Gerät hat Benachrichtigungen erlaubt.`);
    return 0;
  }
  webpush.setVapidDetails(cfg.vapid.subject, cfg.vapid.publicKey, cfg.vapid.privateKey);
  const stmts: Stmt[] = [];
  let sent = 0;
  for (const d of due) {
    const job = byId.get(d.jobId);
    if (!job) continue;
    const payload = JSON.stringify({
      title: reminderText(d.daysLeft),
      body: job.title,
      url: `/#/stelle/${encodeURIComponent(d.jobId)}`,
      tag: `frist-${d.jobId}`,
    });
    let delivered = false;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600 });
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
    if (delivered) {
      sent++;
      for (const t of d.covers) stmts.push(reminderSentStmt(d.jobId, t));
    }
  }
  await db.batch(stmts);
  log.info(`${sent} Erinnerung(en) verschickt.`);
  return sent;
}
