// Hinweis im Reiter „Ich“: Solange kein Profil aus der Umfrage da ist oder der große Durchlauf danach
// noch nicht angestoßen wurde, bittet beim Öffnen ein Blatt darum. Auch eine angefangene Umfrage wird
// angemahnt. „Später“ schließt das Blatt für eine Weile; beim nächsten Öffnen kommt es wieder.

import { useState } from 'react';
import { freigeben } from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import type { State } from '../../data/store';
import { navigate } from '../../lib/router';
import { Sheet } from '../../ui/Sheet';
import { texts } from '../../i18n';

const t = texts({
  de: {
    title: { start: 'Erst dein Profil', weiter: 'Umfrage weitermachen', durchlauf: 'Großer Durchlauf fehlt noch' } as Record<Stufe, string>,
    start: 'Damit die App weiß, was zu dir passt, füll bitte zuerst die Umfrage aus. Sie dauert etwa 15 Minuten, du kannst jederzeit unterbrechen. Danach sucht die App automatisch alle Stellen für dich.',
    weiter: (seite: number) => `Deine Umfrage ist angefangen (Seite ${seite}) und gespeichert. Mach sie fertig, dann kann die App richtig für dich suchen.`,
    durchlauf: 'Dein Profil ist da. Jetzt fehlt noch der große Durchlauf, der alle Quellen nach deinem Profil liest.',
    startSurvey: 'Umfrage starten',
    continueSurvey: 'Weitermachen',
    startRun: 'Großen Durchlauf starten',
    starting: 'startet …',
    later: 'Später',
    needsToken: 'Für den Start braucht der Worker ein GitHub-Token (docs/SCHLUESSEL.md).',
    bigRunStarted: 'Großer Durchlauf gestartet. Er liest alle Quellen ohne Grenzen neu und kann einige Stunden dauern; neue Anzeigen erscheinen nach und nach.',
  },
  en: {
    title: { start: 'Your profile first', weiter: 'Continue the questionnaire', durchlauf: 'Full run still missing' },
    start: 'So the app knows what suits you, please fill in the questionnaire first. It takes about 15 minutes, and you can pause anytime. Afterwards the app automatically searches all postings for you.',
    weiter: (page) => `Your questionnaire is under way (page ${page}) and saved. Finish it so the app can really search for you.`,
    durchlauf: 'Your profile is in place. What’s still missing is the full run that reads all sources by your profile.',
    startSurvey: 'Start questionnaire',
    continueSurvey: 'Continue',
    startRun: 'Start full run',
    starting: 'Starting…',
    later: 'Later',
    needsToken: 'To start it, the Worker needs a GitHub token (docs/SCHLUESSEL.md).',
    bigRunStarted: 'Full run started. It rereads all sources without limits and can take a few hours; new postings will show up gradually.',
  },
  sr: {
    title: { start: 'Prvo tvoj profil', weiter: 'Nastavi upitnik', durchlauf: 'Veliki prolaz još nedostaje' },
    start: 'Da bi aplikacija znala šta ti odgovara, prvo popuni upitnik. Traje oko 15 minuta, a možeš da prekineš kad god hoćeš. Posle toga aplikacija sama pretražuje sve oglase za tebe.',
    weiter: (stranica) => `Tvoj upitnik je započet (stranica ${stranica}) i sačuvan. Završi ga da bi aplikacija mogla da traži baš za tebe.`,
    durchlauf: 'Tvoj profil je spreman. Nedostaje još veliki prolaz, koji čita sve izvore prema tvom profilu.',
    startSurvey: 'Pokreni upitnik',
    continueSurvey: 'Nastavi',
    startRun: 'Pokreni veliki prolaz',
    starting: 'Pokrećem…',
    later: 'Kasnije',
    needsToken: 'Za pokretanje je Workeru potreban GitHub token (docs/SCHLUESSEL.md).',
    bigRunStarted: 'Veliki prolaz je pokrenut. Ponovo čita sve izvore bez ograničenja i može da potraje nekoliko sati; novi oglasi stižu postepeno.',
  },
});

type Stufe = 'start' | 'weiter' | 'durchlauf';

/** Nach „Später“ bleibt das Blatt so lange weg (innerhalb der laufenden App). */
const RUHE_MS = 10 * 60_000;
let spaeterAb = 0;

/** Welche Bitte ansteht; null = Profil und großer Durchlauf sind da (oder Demo). */
export function profilStufe(s: Pick<State, 'demo' | 'settings'>): Stufe | null {
  if (s.demo) return null;
  const p = s.settings.profile;
  const u = s.settings.umfrage;
  const profilDa = p.origin !== 'start' && p.categories.some((c) => c.items.length > 0);
  if (!profilDa) return u && !u.uebernommen && u.seite > 0 ? 'weiter' : 'start';
  return s.settings.freigabe.grosserLauf ? null : 'durchlauf';
}

export function ProfilHinweis() {
  const s = useAppState();
  const store = useStore();
  const [weg, setWeg] = useState(() => Date.now() - spaeterAb < RUHE_MS);
  const [busy, setBusy] = useState(false);
  const stufe = profilStufe(s);
  if (!stufe || weg) return null;
  const close = () => {
    spaeterAb = Date.now();
    setWeg(true);
  };
  const toSurvey = () => {
    close();
    navigate('/ich/umfrage');
  };
  const startRun = async () => {
    setBusy(true);
    try {
      await store.api.triggerIngest(true);
      store.updateSettings('freigabe', freigeben(s.settings.profile, s.settings.freigabe));
      store.toast(t.bigRunStarted, undefined, 9000);
      close();
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t.title[stufe]} onClose={close}>
      <p style={{ marginTop: 0 }}>{stufe === 'weiter' ? t.weiter(s.settings.umfrage?.seite ?? 1) : stufe === 'start' ? t.start : t.durchlauf}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        {stufe === 'durchlauf' ? (
          <button type="button" className="btn btn--primary" disabled={busy || !s.ingestTrigger} onClick={() => void startRun()}>
            {busy ? t.starting : t.startRun}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={toSurvey}>
            {stufe === 'weiter' ? t.continueSurvey : t.startSurvey}
          </button>
        )}
        <button type="button" className="btn" onClick={close}>
          {t.later}
        </button>
      </div>
      {stufe === 'durchlauf' && !s.ingestTrigger && <p className="hint">{t.needsToken}</p>}
    </Sheet>
  );
}
