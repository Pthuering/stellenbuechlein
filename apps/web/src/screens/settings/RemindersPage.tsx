// Fristen-Erinnerungen für Herzensjobs: Stufen wählen, Benachrichtigungen einschalten.

import { useEffect, useMemo, useState } from 'react';
import { addDays, DEFAULT_REMINDER_DAYS, daysUntil, formatDateDe, todayBerlin } from '@stellen/core';
import { useAppState, useStore, useViews } from '../../data/hooks';
import { openJob } from '../../lib/router';
import { pushState, subscribePush, unsubscribePush, type PushState } from '../../lib/push';
import { SubPage } from './Settings';

const OPTIONS = [60, 30, 14, 7, 3, 1, 0];

function dayLabel(d: number): string {
  if (d === 0) return 'am Tag selbst';
  if (d === 1) return '1 Tag';
  if (d === 7) return '1 Woche';
  if (d === 14) return '2 Wochen';
  if (d === 30) return '1 Monat';
  if (d === 60) return '2 Monate';
  return `${d} Tage`;
}

const PUSH_TEXT: Record<PushState, string> = {
  unsupported: 'Dieser Browser kann keine Benachrichtigungen empfangen. Die Erinnerungen stehen trotzdem oben unter „Gemerkt“.',
  'ios-needs-install': 'Auf iPhone und iPad kommen Benachrichtigungen nur in der installierten App an: in Safari auf „Teilen“ und dann „Zum Home-Bildschirm“ tippen, die App von dort öffnen und hier einschalten.',
  denied: 'Benachrichtigungen sind für diese Seite blockiert. Sie lassen sich in den Browser- oder Systemeinstellungen wieder erlauben.',
  off: 'Auf diesem Gerät sind Benachrichtigungen noch aus.',
  on: 'Dieses Gerät bekommt Benachrichtigungen.',
};

export function RemindersPage() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const r = s.settings.reminders;
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (s.demo) return;
    void pushState().then(setPush);
  }, [s.demo]);

  const toggleDay = (d: number) => {
    const days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d];
    store.updateSettings('reminders', { ...r, days: days.sort((a, b) => b - a) });
  };

  const upcoming = useMemo(() => {
    const today = todayBerlin();
    const levels = [...r.days].sort((a, b) => b - a);
    return [...views.values()]
      .filter((v) => v.mark?.star && v.job.deadline && v.job.deadline >= today)
      .map((v) => {
        const left = daysUntil(v.job.deadline, today)!;
        const next = levels.find((d) => d < left);
        return { v, left, next, date: next != null ? addDays(v.job.deadline!, -next) : null };
      })
      .sort((a, b) => a.left - b.left);
  }, [views, r.days]);

  const enable = async () => {
    if (!s.vapidPublicKey) return setMsg('Auf dem Server fehlt noch der Push-Schlüssel (VAPID). Die Betriebsanleitung beschreibt, wie er angelegt wird.');
    setBusy(true);
    setMsg(null);
    try {
      const sub = await subscribePush(s.vapidPublicKey);
      await store.api.pushSubscribe(sub);
      if (!r.push) store.updateSettings('reminders', { ...r, push: true });
      setPush('on');
      store.toast('Benachrichtigungen sind an.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      setPush(await pushState());
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) await store.api.pushUnsubscribe(endpoint).catch(() => undefined);
      setPush('off');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SubPage title="Fristen-Erinnerungen" sub="für Herzensjobs (Stern)">
      <p className="notice">Markierst du eine gemerkte Anzeige mit dem Stern als Herzensjob, erinnert dich das Büchlein vor der Frist. Fällige Erinnerungen stehen immer oben unter „Gemerkt“, auf Wunsch zusätzlich als Benachrichtigung.</p>

      <h2 className="section-title">Wann erinnern?</h2>
      <div className="chips">
        {OPTIONS.map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={r.days.includes(d)} onClick={() => toggleDay(d)}>
            {d === 0 ? dayLabel(d) : `${dayLabel(d)} vorher`}
          </button>
        ))}
      </div>
      {r.days.join() !== DEFAULT_REMINDER_DAYS.join() && (
        <button type="button" className="btn btn--quiet btn--small" onClick={() => store.updateSettings('reminders', { ...r, days: DEFAULT_REMINDER_DAYS })}>
          Zurück auf 1 Monat, 1 Woche und 1 Tag
        </button>
      )}
      {r.days.length === 0 && <p className="hint">Keine Stufe gewählt: Es gibt keine Erinnerungen.</p>}

      <h2 className="section-title">Benachrichtigungen</h2>
      {s.demo ? (
        <p className="hint">In der Demo gibt es keine Benachrichtigungen. In der eingerichteten App kommen sie zweimal am Tag mit dem Einsammel-Lauf.</p>
      ) : (
        <>
          <label className="toggle">
            <span>
              Erinnerungen auch als Benachrichtigung
              <br />
              <small className="hint">gilt für alle Geräte, die unten eingeschaltet sind</small>
            </span>
            <input type="checkbox" checked={r.push} onChange={(e) => store.updateSettings('reminders', { ...r, push: e.target.checked })} />
          </label>
          {push && <p className="hint">{PUSH_TEXT[push]}</p>}
          {push === 'off' && r.push && (
            <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => void enable()} style={{ marginTop: 8 }}>
              Auf diesem Gerät einschalten
            </button>
          )}
          {push === 'on' && (
            <button type="button" className="btn btn--small" disabled={busy} onClick={() => void disable()} style={{ marginTop: 8 }}>
              Auf diesem Gerät ausschalten
            </button>
          )}
          {msg && (
            <p className="notice notice--warn" role="alert" style={{ marginTop: 10 }}>
              {msg}
            </p>
          )}
        </>
      )}

      <h2 className="section-title">Als Nächstes</h2>
      {upcoming.length === 0 ? (
        <p className="hint">Noch kein Herzensjob mit Frist. In einer Anzeige auf „Herzensjob“ tippen oder im Stapel den Stern nehmen.</p>
      ) : (
        <ul className="list">
          {upcoming.map(({ v, left, date }) => (
            <li key={v.job.id} className="row" onClick={() => openJob(v.job.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openJob(v.job.id)}>
              <span className="row__mark" aria-hidden="true">
                ★
              </span>
              <div className="row__main">
                <p className="row__title">{v.job.title}</p>
                <p className="row__sub">
                  Frist {formatDateDe(v.job.deadline!)}, {left === 0 ? 'heute' : left === 1 ? 'morgen' : `in ${left} Tagen`}
                </p>
                <p className="row__sub">{date ? `Nächste Erinnerung am ${formatDateDe(date)}` : 'Keine weitere Erinnerung vor der Frist'}</p>
              </div>
              <div className="row__meta" />
            </li>
          ))}
        </ul>
      )}
    </SubPage>
  );
}
