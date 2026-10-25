// Fristen-Erinnerungen für Herzensjobs und Meldung neuer, sehr gut passender Anzeigen; Benachrichtigungen einschalten.

import { useEffect, useMemo, useState } from 'react';
import { addDays, DEFAULT_REMINDER_DAYS, daysUntil, todayBerlin } from '@stellen/core';
import { useAppState, useStore, useViews } from '../../data/hooks';
import { openJob } from '../../lib/router';
import { pushState, subscribePush, unsubscribePush, type PushState } from '../../lib/push';
import { fmtDate, fmtPct, srForm, texts } from '../../i18n';
import { SubPage } from './Settings';

const OPTIONS = [60, 30, 14, 7, 3, 1, 0];
const HS_OPTIONS = [80, 85, 90, 95];

const t = texts({
  de: {
    /** Stufe der Erinnerung als Chip: „am Tag selbst“, „1 Woche vorher“ … */
    dayChip: (d: number) => {
      if (d === 0) return 'am Tag selbst';
      if (d === 1) return '1 Tag vorher';
      if (d === 7) return '1 Woche vorher';
      if (d === 14) return '2 Wochen vorher';
      if (d === 30) return '1 Monat vorher';
      if (d === 60) return '2 Monate vorher';
      return `${d} Tage vorher`;
    },
    pushText: {
      unsupported: 'Dieser Browser kann keine Benachrichtigungen empfangen. Die Erinnerungen stehen trotzdem oben unter „Gemerkt“.',
      'ios-needs-install': 'Auf iPhone und iPad kommen Benachrichtigungen nur in der installierten App an: in Safari auf „Teilen“ und dann „Zum Home-Bildschirm“ tippen, die App von dort öffnen und hier einschalten.',
      denied: 'Benachrichtigungen sind für diese Seite blockiert. Sie lassen sich in den Browser- oder Systemeinstellungen wieder erlauben.',
      off: 'Auf diesem Gerät sind Benachrichtigungen noch aus.',
      on: 'Dieses Gerät bekommt Benachrichtigungen.',
    } as Record<PushState, string>,
    noVapid: 'Auf dem Server fehlt noch der Push-Schlüssel (VAPID). Die Betriebsanleitung beschreibt, wie er angelegt wird.',
    pushOn: 'Benachrichtigungen sind an.',
    title: 'Erinnerungen',
    sub: 'Fristen von Herzensjobs und neue, sehr gut passende Anzeigen',
    intro: 'Markierst du eine gemerkte Anzeige mit dem Stern als Herzensjob, erinnert dich das Büchlein vor der Frist. Fällige Erinnerungen stehen immer oben unter „Gemerkt“, auf Wunsch zusätzlich als Benachrichtigung.',
    whenTitle: 'Wann erinnern?',
    resetDays: 'Zurück auf 1 Monat, 1 Woche und 1 Tag',
    noDays: 'Keine Stufe gewählt: Es gibt keine Erinnerungen.',
    highScoreTitle: 'Neue Anzeigen, die sehr gut passen',
    highScoreToggle: (pct: string) => `Melden, wenn ein Lauf neue Anzeigen ab ${pct} bringt`,
    highScoreSmall: 'eine gebündelte Benachrichtigung pro Lauf, mit den drei besten',
    threshold: 'Schwelle',
    fromPct: (pct: string) => `ab ${pct}`,
    starterHint: (pct: string) => `Mit dem Startprofil liegen fast alle Psychologie-Anzeigen über ${pct}. Trennscharf wird das erst mit deinem Steckbrief.`,
    notificationsTitle: 'Benachrichtigungen',
    demoHint: 'In der Demo gibt es keine Benachrichtigungen. In der eingerichteten App kommen sie mit dem täglichen Einsammel-Lauf gegen 12 Uhr.',
    pushToggle: 'Erinnerungen auch als Benachrichtigung',
    pushSmall: 'gilt für alle Geräte, die unten eingeschaltet sind',
    enableHere: 'Auf diesem Gerät einschalten',
    disableHere: 'Auf diesem Gerät ausschalten',
    nextTitle: 'Als Nächstes',
    nextEmpty: 'Noch kein Herzensjob mit Frist. In einer Anzeige auf „Herzensjob“ tippen oder im Stapel den Stern nehmen.',
    deadline: (date: string, left: number) => `Frist ${date}, ${left === 0 ? 'heute' : left === 1 ? 'morgen' : `in ${left} Tagen`}`,
    nextReminder: (date: string) => `Nächste Erinnerung am ${date}`,
    noMoreReminders: 'Keine weitere Erinnerung vor der Frist',
  },
  en: {
    dayChip: (d) => {
      if (d === 0) return 'on the day';
      if (d === 1) return '1 day before';
      if (d === 7) return '1 week before';
      if (d === 14) return '2 weeks before';
      if (d === 30) return '1 month before';
      if (d === 60) return '2 months before';
      return `${d} days before`;
    },
    pushText: {
      unsupported: 'This browser can’t receive notifications. Reminders still show up at the top of “Saved”.',
      'ios-needs-install': 'On iPhone and iPad, notifications only arrive in the installed app: in Safari, tap “Share”, then “Add to Home Screen”, open the app from there and turn them on here.',
      denied: 'Notifications are blocked for this site. You can allow them again in your browser or system settings.',
      off: 'Notifications are still off on this device.',
      on: 'This device receives notifications.',
    },
    noVapid: 'The server is still missing the push key (VAPID). The operating manual explains how to create it.',
    pushOn: 'Notifications are on.',
    title: 'Reminders',
    sub: 'Dream job deadlines and new postings that are a great match',
    intro: 'Mark a saved posting as a dream job with the star, and the little book reminds you before the deadline. Due reminders always appear at the top of “Saved”, and also as notifications if you like.',
    whenTitle: 'When to remind you?',
    resetDays: 'Reset to 1 month, 1 week and 1 day',
    noDays: 'No time selected: there won’t be any reminders.',
    highScoreTitle: 'New postings that are a great match',
    highScoreToggle: (pct) => `Notify me when a run brings new postings at ${pct} or more`,
    highScoreSmall: 'one combined notification per run, with the top three',
    threshold: 'Threshold',
    fromPct: (pct) => `${pct} or more`,
    starterHint: (pct) => `With the starter profile, almost all psychology postings score above ${pct}. It only becomes selective with your profile sheet.`,
    notificationsTitle: 'Notifications',
    demoHint: 'The demo doesn’t send notifications. In the configured app, they arrive with the daily collecting run around noon.',
    pushToggle: 'Reminders as notifications too',
    pushSmall: 'applies to every device turned on below',
    enableHere: 'Turn on for this device',
    disableHere: 'Turn off for this device',
    nextTitle: 'Coming up',
    nextEmpty: 'No dream job with a deadline yet. Tap “Dream job” on a posting, or use the star in the stack.',
    deadline: (date, left) => `Deadline ${date}, ${left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`}`,
    nextReminder: (date) => `Next reminder on ${date}`,
    noMoreReminders: 'No more reminders before the deadline',
  },
  sr: {
    dayChip: (d) => {
      if (d === 0) return 'na sam dan';
      if (d === 1) return '1 dan ranije';
      if (d === 7) return '1 nedelju ranije';
      if (d === 14) return '2 nedelje ranije';
      if (d === 30) return '1 mesec ranije';
      if (d === 60) return '2 meseca ranije';
      return `${d} ${srForm(d, 'dan', 'dana', 'dana')} ranije`;
    },
    pushText: {
      unsupported: 'Ovaj pregledač ne može da prima obaveštenja. Podsetnici se ipak prikazuju na vrhu u odeljku „Sačuvano“.',
      'ios-needs-install': 'Na iPhone-u i iPad-u obaveštenja stižu samo u instaliranoj aplikaciji: u Safariju dodirni „Deli“, pa „Dodaj na početni ekran“, otvori aplikaciju odatle i ovde uključi obaveštenja.',
      denied: 'Obaveštenja su blokirana za ovaj sajt. Možeš ponovo da ih dozvoliš u podešavanjima pregledača ili sistema.',
      off: 'Na ovom uređaju obaveštenja su još isključena.',
      on: 'Ovaj uređaj prima obaveštenja.',
    },
    noVapid: 'Na serveru još nedostaje push ključ (VAPID). U uputstvu za rad piše kako se pravi.',
    pushOn: 'Obaveštenja su uključena.',
    title: 'Podsetnici',
    sub: 'Rokovi poslova iz snova i novi oglasi sa odličnim poklapanjem',
    intro: 'Kada sačuvani oglas zvezdicom označiš kao posao iz snova, knjižica će te podsetiti pre roka. Podsetnici koji su na redu uvek stoje na vrhu u odeljku „Sačuvano“, a po želji stižu i kao obaveštenje.',
    whenTitle: 'Kada podsetiti?',
    resetDays: 'Vrati na 1 mesec, 1 nedelju i 1 dan',
    noDays: 'Nije izabran nijedan termin: podsetnika neće biti.',
    highScoreTitle: 'Novi oglasi sa odličnim poklapanjem',
    highScoreToggle: (pct) => `Javi mi kada prolaz donese nove oglase sa poklapanjem od ${pct} i više`,
    highScoreSmall: 'jedno zbirno obaveštenje po prolazu, sa tri najbolja oglasa',
    threshold: 'Prag',
    fromPct: (pct) => `od ${pct}`,
    starterHint: (pct) => `Sa početnim profilom skoro svi oglasi iz psihologije imaju poklapanje preko ${pct}. Pravu razliku ovo pravi tek uz tvoj lični karton.`,
    notificationsTitle: 'Obaveštenja',
    demoHint: 'U demu nema obaveštenja. U podešenoj aplikaciji stižu uz svakodnevni prolaz prikupljanja, oko podneva.',
    pushToggle: 'Podsetnici i kao obaveštenja',
    pushSmall: 'važi za sve uređaje na kojima ih ispod uključiš',
    enableHere: 'Uključi na ovom uređaju',
    disableHere: 'Isključi na ovom uređaju',
    nextTitle: 'Sledeće na redu',
    nextEmpty: 'Još nema posla iz snova sa rokom. U oglasu dodirni „Posao iz snova“ ili u špilu dodirni zvezdicu.',
    deadline: (date, left) => `Rok ${date}, ${left === 0 ? 'danas' : left === 1 ? 'sutra' : `za ${left} ${srForm(left, 'dan', 'dana', 'dana')}`}`,
    nextReminder: (date) => `Sledeći podsetnik: ${date}`,
    noMoreReminders: 'Nema više podsetnika pre roka',
  },
});

export function RemindersPage() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const r = s.settings.reminders;
  const hs = s.settings.notifyHighScore;
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
    if (!s.vapidPublicKey) return setMsg(t.noVapid);
    setBusy(true);
    setMsg(null);
    try {
      const sub = await subscribePush(s.vapidPublicKey);
      await store.api.pushSubscribe(sub);
      if (!r.push) store.updateSettings('reminders', { ...r, push: true });
      setPush('on');
      store.toast(t.pushOn);
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
    <SubPage title={t.title} sub={t.sub}>
      <p className="notice">{t.intro}</p>

      <h2 className="section-title">{t.whenTitle}</h2>
      <div className="chips">
        {OPTIONS.map((d) => (
          <button key={d} type="button" className="chip" aria-pressed={r.days.includes(d)} onClick={() => toggleDay(d)}>
            {t.dayChip(d)}
          </button>
        ))}
      </div>
      {r.days.join() !== DEFAULT_REMINDER_DAYS.join() && (
        <button type="button" className="btn btn--quiet btn--small" onClick={() => store.updateSettings('reminders', { ...r, days: DEFAULT_REMINDER_DAYS })}>
          {t.resetDays}
        </button>
      )}
      {r.days.length === 0 && <p className="hint">{t.noDays}</p>}

      <h2 className="section-title">{t.highScoreTitle}</h2>
      <label className="toggle">
        <span>
          {t.highScoreToggle(fmtPct(hs.min))}
          <br />
          <small className="hint">{t.highScoreSmall}</small>
        </span>
        <input type="checkbox" checked={hs.on} onChange={(e) => store.updateSettings('notifyHighScore', { ...hs, on: e.target.checked })} />
      </label>
      {hs.on && (
        <div className="chips" role="group" aria-label={t.threshold}>
          {HS_OPTIONS.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={hs.min === m} onClick={() => store.updateSettings('notifyHighScore', { ...hs, min: m })}>
              {t.fromPct(fmtPct(m))}
            </button>
          ))}
        </div>
      )}
      {hs.on && s.settings.profile.origin === 'start' && <p className="hint">{t.starterHint(fmtPct(75))}</p>}

      <h2 className="section-title">{t.notificationsTitle}</h2>
      {s.demo ? (
        <p className="hint">{t.demoHint}</p>
      ) : (
        <>
          <label className="toggle">
            <span>
              {t.pushToggle}
              <br />
              <small className="hint">{t.pushSmall}</small>
            </span>
            <input type="checkbox" checked={r.push} onChange={(e) => store.updateSettings('reminders', { ...r, push: e.target.checked })} />
          </label>
          {push && <p className="hint">{t.pushText[push]}</p>}
          {push === 'off' && r.push && (
            <button type="button" className="btn btn--primary btn--small" disabled={busy} onClick={() => void enable()} style={{ marginTop: 8 }}>
              {t.enableHere}
            </button>
          )}
          {push === 'on' && (
            <button type="button" className="btn btn--small" disabled={busy} onClick={() => void disable()} style={{ marginTop: 8 }}>
              {t.disableHere}
            </button>
          )}
          {msg && (
            <p className="notice notice--warn" role="alert" style={{ marginTop: 10 }}>
              {msg}
            </p>
          )}
        </>
      )}

      <h2 className="section-title">{t.nextTitle}</h2>
      {upcoming.length === 0 ? (
        <p className="hint">{t.nextEmpty}</p>
      ) : (
        <ul className="list">
          {upcoming.map(({ v, left, date }) => (
            <li key={v.job.id} className="row" onClick={() => openJob(v.job.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openJob(v.job.id)}>
              <span className="row__mark" aria-hidden="true">
                ★
              </span>
              <div className="row__main">
                <p className="row__title">{v.job.title}</p>
                <p className="row__sub">{t.deadline(fmtDate(v.job.deadline!), left)}</p>
                <p className="row__sub">{date ? t.nextReminder(fmtDate(date)) : t.noMoreReminders}</p>
              </div>
              <div className="row__meta" />
            </li>
          ))}
        </ul>
      )}
    </SubPage>
  );
}
