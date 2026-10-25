// Zuhause & Umkreis: von hier aus werden Entfernungen und der Radius-Filter gemessen.

import { useMemo, useState } from 'react';
import { DEFAULT_HOME, formatKm, distanceKm, normalizeText, STATES } from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { IconHome, IconSearch } from '../../ui/icons';
import { SubPage } from './Settings';

const RADII: (number | null)[] = [null, 25, 50, 100, 150, 200, 300];

export function HomePage() {
  const s = useAppState();
  const store = useStore();
  const home = s.settings.home;
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState({ label: '', lat: '', lon: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const isDefault = home.lat === DEFAULT_HOME.lat && home.lon === DEFAULT_HOME.lon;

  const cities = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return [];
    return [...s.cities.values()].filter((c) => normalizeText(c.name).includes(n)).slice(0, 8);
  }, [q, s.cities]);

  const setHome = (label: string, lat: number, lon: number) => {
    store.updateSettings('home', { label, lat, lon });
    store.toast(`Zuhause ist jetzt ${label}.`);
    setQ('');
  };

  const saveCustom = () => {
    const lat = Number(custom.lat.replace(',', '.'));
    const lon = Number(custom.lon.replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 45 || lat > 57 || lon < 4 || lon > 17) {
      setMsg('Die Koordinaten liegen nicht in Deutschland. Beispiel: Breite 51,4911 und Länge 11,9758.');
      return;
    }
    setMsg(null);
    setHome(custom.label.trim() || 'Eigener Ort', lat, lon);
  };

  // Adresssuche über OpenStreetMap (Nominatim): nur auf Knopfdruck, auf etwa 100 m gerundet
  const [addr, setAddr] = useState('');
  const [hits, setHits] = useState<{ label: string; lat: number; lon: number }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = addr.trim();
    if (query.length < 4) return setMsg('Bitte Straße und Ort eingeben, z. B. „Marktplatz, Halle“.');
    setSearching(true);
    setMsg(null);
    try {
      const u = new URL('https://nominatim.openstreetmap.org/search');
      for (const [k, v] of Object.entries({ format: 'jsonv2', countrycodes: 'de', limit: '5', 'accept-language': 'de', q: query })) u.searchParams.set(k, v);
      // Die Nutzungsregeln von Nominatim verlangen eine erkennbare Herkunft: hier nur die Adresse der App, ohne Pfad
      const r = await fetch(u, { headers: { accept: 'application/json' }, referrerPolicy: 'origin' });
      if (!r.ok) throw new Error(String(r.status));
      const list = (await r.json()) as { display_name: string; lat: string; lon: string }[];
      const round = (x: string) => Math.round(Number(x) * 1000) / 1000;
      setHits(list.map((x) => ({ label: x.display_name.split(', ').slice(0, 3).join(', '), lat: round(x.lat), lon: round(x.lon) })));
      if (list.length === 0) setMsg('Nichts gefunden. Mit Ort versuchen, z. B. „Marktplatz, Halle (Saale)“.');
    } catch {
      setMsg('Die Adresssuche ist gerade nicht erreichbar (offline?). Koordinaten lassen sich weiter unten eintragen.');
    } finally {
      setSearching(false);
    }
  };

  const useLocation = () => {
    if (!navigator.geolocation) return setMsg('Dieses Gerät gibt keinen Standort heraus.');
    setMsg('Standort wird abgefragt …');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMsg(null);
        // auf ca. 1 km gerundet – genauer braucht es der Umkreis nicht
        setHome('Mein Standort', Math.round(pos.coords.latitude * 100) / 100, Math.round(pos.coords.longitude * 100) / 100);
      },
      () => setMsg('Standort nicht verfügbar oder nicht erlaubt.'),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  };

  return (
    <SubPage title="Zuhause & Umkreis" sub="Ausgangspunkt für Entfernungen und Radius">
      <div className="index-card">
        <p className="index-card__kicker">
          <IconHome width={18} height={18} style={{ verticalAlign: '-3px' }} /> Zuhause
        </p>
        <h2 className="index-card__title">{home.label}</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          {home.lat.toFixed(4).replace('.', ',')}° N, {home.lon.toFixed(4).replace('.', ',')}° O
          {!isDefault && `, ${formatKm(distanceKm(home.lat, home.lon, DEFAULT_HOME.lat, DEFAULT_HOME.lon))} von der Stadtmitte`}
        </p>
        {!isDefault && (
          <button type="button" className="btn btn--small" onClick={() => setHome(DEFAULT_HOME.label, DEFAULT_HOME.lat, DEFAULT_HOME.lon)}>
            Zurück zur Stadtmitte von Halle
          </button>
        )}
      </div>

      <h2 className="section-title">Umkreis</h2>
      <div className="chips">
        {RADII.map((r) => (
          <button key={String(r)} type="button" className="chip" aria-pressed={s.settings.filter.radiusKm === r} onClick={() => store.updateSettings('filter', { ...s.settings.filter, radiusKm: r })}>
            {r == null ? 'ganz Deutschland' : `${r} km`}
          </button>
        ))}
      </div>
      <p className="hint">Gilt für Stapel, Liste und Karte. Anzeigen ohne erkannten Ort fallen bei gesetztem Umkreis heraus. Gemerkte bleiben immer unter „Gemerkt“.</p>

      <h2 className="section-title">Anderen Ort wählen</h2>
      <label className="search" style={{ display: 'block' }}>
        <span className="visually-hidden">Stadt suchen</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Stadt suchen, z. B. Leipzig" />
      </label>
      {cities.length > 0 && (
        <ul className="list">
          {cities.map((c) => (
            <li key={c.id} className="pick">
              <button type="button" className="pick__btn" onClick={() => setHome(c.name, c.lat, c.lon)}>
                <IconHome width={20} height={20} />
                <span>
                  {c.name} <small>{STATES[c.state]}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
        <button type="button" className="btn btn--small" onClick={useLocation}>
          Aktuellen Standort verwenden
        </button>
      </div>

      <h2 className="section-title">Adresse suchen</h2>
      <form onSubmit={(e) => void searchAddress(e)} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <label className="search" style={{ flex: 1 }}>
          <span className="visually-hidden">Adresse</span>
          <IconSearch />
          <input className="input" type="search" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Straße und Ort" enterKeyHint="search" autoComplete="street-address" />
        </label>
        <button type="submit" className="btn btn--small" disabled={searching}>
          {searching ? 'sucht …' : 'Suchen'}
        </button>
      </form>
      <p className="hint">
        Die Eingabe geht an die Adresssuche von OpenStreetMap (Nominatim, Daten © OpenStreetMap-Mitwirkende, ODbL). Gespeichert wird der Ort auf etwa 100 m gerundet.
      </p>
      {hits && hits.length > 0 && (
        <ul className="list">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon},${h.label}`} className="pick">
              <button
                type="button"
                className="pick__btn"
                onClick={() => {
                  setHome(h.label, h.lat, h.lon);
                  setHits(null);
                  setAddr('');
                }}
              >
                <IconHome width={20} height={20} />
                <span>{h.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="help">
        <summary>Genaue Adresse als Koordinaten eintragen</summary>
        <p className="hint">Koordinaten lassen sich z. B. in einer Karten-App per langem Tippen kopieren.</p>
        <label className="field">
          <span>Name</span>
          <input className="input" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder="z. B. Wohnung" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field">
            <span>Breite</span>
            <input className="input" inputMode="decimal" value={custom.lat} onChange={(e) => setCustom({ ...custom, lat: e.target.value })} placeholder="51,4911" />
          </label>
          <label className="field">
            <span>Länge</span>
            <input className="input" inputMode="decimal" value={custom.lon} onChange={(e) => setCustom({ ...custom, lon: e.target.value })} placeholder="11,9758" />
          </label>
        </div>
        <button type="button" className="btn btn--small btn--primary" onClick={saveCustom}>
          Übernehmen
        </button>
      </details>
      {msg && (
        <p className="notice" role="status" style={{ marginTop: 12 }}>
          {msg}
        </p>
      )}
    </SubPage>
  );
}
