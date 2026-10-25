// Erster Start: App-Schlüssel eingeben (steht als APP_KEY im Cloudflare-Worker).

import { useState } from 'react';
import { HttpBackend } from '../data/api';
import { AuthError, OfflineError } from '../data/backend';
import { useAppState, useStore } from '../data/hooks';
import { lsSet } from '../data/local';
import { apiBase } from '../lib/config';
import { Doodle } from '../ui/bits';

export function Login() {
  const s = useAppState();
  const store = useStore();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(s.sync.error);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const k = key.trim();
    if (!k) return setError('Bitte den App-Schlüssel eingeben.');
    setBusy(true);
    setError(null);
    const backend = new HttpBackend(k, apiBase());
    try {
      await backend.bootstrap();
      lsSet('sb.key', k);
      store.setBackend(backend);
    } catch (err) {
      setError(err instanceof AuthError ? 'Der Schlüssel passt nicht. Er steht als APP_KEY in den Einstellungen des Workers.' : err instanceof OfflineError ? 'Der Server ist gerade nicht erreichbar. Bitte die Verbindung prüfen.' : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <section className="screen paper login">
        <form onSubmit={(e) => void submit(e)}>
          <div style={{ display: 'grid', justifyItems: 'center' }}>
            <Doodle kind="heart" />
          </div>
          <h1 className="page-title" style={{ textAlign: 'center' }}>
            Stellenbüchlein
          </h1>
          <p className="page-sub" style={{ textAlign: 'center', marginTop: 0 }}>
            Forschungsstellen mit Psychologie-Bezug, gesammelt und sortiert
          </p>
          <label className="field">
            <span>App-Schlüssel</span>
            <input className="input" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
          </label>
          {error && (
            <p className="notice notice--warn" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Prüfe …' : 'Büchlein öffnen'}
          </button>
          <p className="hint">Der Schlüssel bleibt auf diesem Gerät gespeichert, bis du dich unter „Ich“ abmeldest.</p>
        </form>
      </section>
    </div>
  );
}
