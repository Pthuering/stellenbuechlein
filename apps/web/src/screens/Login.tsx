// Erster Start: App-Schlüssel eingeben (steht als APP_KEY im Cloudflare-Worker).

import { useState } from 'react';
import { HttpBackend } from '../data/api';
import { AuthError, OfflineError } from '../data/backend';
import { useAppState, useStore } from '../data/hooks';
import { lsSet } from '../data/local';
import { apiBase } from '../lib/config';
import { Doodle } from '../ui/bits';
import { LangSwitch } from '../ui/LangSwitch';
import { texts } from '../i18n';

const t = texts({
  de: {
    enterKey: 'Bitte den App-Schlüssel eingeben.',
    wrongKey: 'Der Schlüssel passt nicht. Er steht als APP_KEY in den Einstellungen des Workers.',
    offline: 'Der Server ist gerade nicht erreichbar. Bitte die Verbindung prüfen.',
    tagline: 'Forschungsstellen mit Psychologie-Bezug, gesammelt und sortiert',
    keyLabel: 'App-Schlüssel',
    checking: 'Prüfe …',
    open: 'Büchlein öffnen',
    keyHint: 'Der Schlüssel bleibt auf diesem Gerät gespeichert, bis du dich unter „Ich“ abmeldest.',
  },
  en: {
    enterKey: 'Please enter the app key.',
    wrongKey: 'That key doesn’t work. You’ll find it as APP_KEY in the Worker’s settings.',
    offline: 'The server can’t be reached right now. Please check your connection.',
    tagline: 'Research jobs related to psychology, collected and sorted',
    keyLabel: 'App key',
    checking: 'Checking…',
    open: 'Open the little book',
    keyHint: 'The key stays saved on this device until you sign out under “Me”.',
  },
  sr: {
    enterKey: 'Unesi ključ aplikacije.',
    wrongKey: 'Ključ nije ispravan. Nalazi se pod imenom APP_KEY u podešavanjima za Worker.',
    offline: 'Server trenutno nije dostupan. Proveri internet vezu.',
    tagline: 'Istraživačke pozicije vezane za psihologiju, prikupljene i sortirane',
    keyLabel: 'Ključ aplikacije',
    checking: 'Proveravam…',
    open: 'Otvori knjižicu',
    keyHint: 'Ključ ostaje sačuvan na ovom uređaju dok se ne odjaviš u odeljku „Ja“.',
  },
});

// Beim Umschalten der Sprache wird die App neu aufgebaut; ein schon eingetippter Schlüssel bleibt erhalten.
let draftKey = '';

export function Login() {
  const s = useAppState();
  const store = useStore();
  const [key, setKeyState] = useState(draftKey);
  const setKey = (k: string) => {
    draftKey = k;
    setKeyState(k);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(s.sync.error);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const k = key.trim();
    if (!k) return setError(t.enterKey);
    setBusy(true);
    setError(null);
    const backend = new HttpBackend(k, apiBase());
    try {
      await backend.bootstrap();
      lsSet('sb.key', k);
      draftKey = '';
      store.setBackend(backend);
    } catch (err) {
      setError(err instanceof AuthError ? t.wrongKey : err instanceof OfflineError ? t.offline : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <section className="screen paper login">
        <form onSubmit={(e) => void submit(e)}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <LangSwitch />
          </div>
          <div style={{ display: 'grid', justifyItems: 'center' }}>
            <Doodle kind="heart" />
          </div>
          <h1 className="page-title" style={{ textAlign: 'center' }}>
            Taras Cutesy Jobsearch App
          </h1>
          <p className="page-sub" style={{ textAlign: 'center', marginTop: 0 }}>
            {t.tagline}
          </p>
          <label className="field">
            <span>{t.keyLabel}</span>
            <input className="input" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          </label>
          {error && (
            <p className="notice notice--warn" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? t.checking : t.open}
          </button>
          <p className="hint">{t.keyHint}</p>
        </form>
      </section>
    </div>
  );
}
