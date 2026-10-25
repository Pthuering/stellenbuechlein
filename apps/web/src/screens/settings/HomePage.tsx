// Zuhause & Umkreis: von hier aus werden Entfernungen und der Radius-Filter gemessen.

import { useMemo, useState } from 'react';
import { DEFAULT_HOME, distanceKm, normalizeText } from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { IconHome, IconSearch } from '../../ui/icons';
import { fmtKm, fmtNum, texts } from '../../i18n';
import { stateName } from '../../i18n/labels';
import { SubPage } from './Settings';

const RADII: (number | null)[] = [null, 25, 50, 100, 150, 200, 300];

/** Koordinate mit vier Nachkommastellen in der Schreibweise der Sprache. */
const coord = (x: number) => fmtNum(x, 4);

const t = texts({
  de: {
    title: 'Zuhause & Umkreis',
    sub: 'Ausgangspunkt für Entfernungen und Radius',
    homeIsNow: (label: string) => `Zuhause ist jetzt ${label}.`,
    notInGermany: (lat: string, lon: string) => `Die Koordinaten liegen nicht in Deutschland. Beispiel: Breite ${lat} und Länge ${lon}.`,
    customPlace: 'Eigener Ort',
    addressTooShort: 'Bitte Straße und Ort eingeben, z. B. „Marktplatz, Halle“.',
    addressNothing: 'Nichts gefunden. Mit Ort versuchen, z. B. „Marktplatz, Halle (Saale)“.',
    addressOffline: 'Die Adresssuche ist gerade nicht erreichbar (offline?). Koordinaten lassen sich weiter unten eintragen.',
    noGeolocation: 'Dieses Gerät gibt keinen Standort heraus.',
    locating: 'Standort wird abgefragt …',
    myLocation: 'Mein Standort',
    locationFailed: 'Standort nicht verfügbar oder nicht erlaubt.',
    home: 'Zuhause',
    coords: (lat: string, lon: string) => `${lat}° N, ${lon}° O`,
    fromDefault: (km: string, label: string) => `, ${km} von ${label}`,
    backToDefault: (label: string) => `Zurück zum Standard: ${label}`,
    radius: 'Umkreis',
    allGermany: 'ganz Deutschland',
    radiusHint: 'Gilt für Stapel, Liste und Karte. Anzeigen ohne erkannten Ort fallen bei gesetztem Umkreis heraus. Gemerkte bleiben immer unter „Gemerkt“.',
    otherPlace: 'Anderen Ort wählen',
    citySearchLabel: 'Stadt suchen',
    citySearchPlaceholder: 'Stadt suchen, z. B. Leipzig',
    useLocation: 'Aktuellen Standort verwenden',
    addressTitle: 'Adresse suchen',
    addressLabel: 'Adresse',
    addressPlaceholder: 'Straße und Ort',
    searching: 'sucht …',
    search: 'Suchen',
    addressHint: 'Die Eingabe geht an die Adresssuche von OpenStreetMap (Nominatim, Daten © OpenStreetMap-Mitwirkende, ODbL). Gespeichert wird der Ort auf etwa 100 m gerundet.',
    coordsSummary: 'Genaue Adresse als Koordinaten eintragen',
    coordsHint: 'Koordinaten lassen sich z. B. in einer Karten-App per langem Tippen kopieren.',
    name: 'Name',
    namePlaceholder: 'z. B. Wohnung',
    lat: 'Breite',
    lon: 'Länge',
    apply: 'Übernehmen',
  },
  en: {
    title: 'Home & radius',
    sub: 'Starting point for distances and the radius',
    homeIsNow: (label) => `Home is now ${label}.`,
    notInGermany: (lat, lon) => `These coordinates aren’t in Germany. Example: latitude ${lat} and longitude ${lon}.`,
    customPlace: 'Custom location',
    addressTooShort: 'Please enter a street and town, e.g. “Marktplatz, Halle”.',
    addressNothing: 'Nothing found. Try adding the town, e.g. “Marktplatz, Halle (Saale)”.',
    addressOffline: 'Address search isn’t reachable right now (offline?). You can enter coordinates further down.',
    noGeolocation: 'This device doesn’t share its location.',
    locating: 'Getting your location…',
    myLocation: 'My location',
    locationFailed: 'Location unavailable or not allowed.',
    home: 'Home',
    coords: (lat, lon) => `${lat}° N, ${lon}° E`,
    fromDefault: (km, label) => `, ${km} from ${label}`,
    backToDefault: (label) => `Back to default: ${label}`,
    radius: 'Radius',
    allGermany: 'all of Germany',
    radiusHint: 'Applies to the stack, list and map. With a radius set, postings without a recognized location drop out. Saved ones always stay under “Saved”.',
    otherPlace: 'Choose another place',
    citySearchLabel: 'Search for a city',
    citySearchPlaceholder: 'Search for a city, e.g. Leipzig',
    useLocation: 'Use current location',
    addressTitle: 'Search for an address',
    addressLabel: 'Address',
    addressPlaceholder: 'Street and town',
    searching: 'Searching…',
    search: 'Search',
    addressHint: 'What you type goes to the OpenStreetMap address search (Nominatim, data © OpenStreetMap contributors, ODbL). The place is saved rounded to about 100 m.',
    coordsSummary: 'Enter an exact address as coordinates',
    coordsHint: 'You can copy coordinates in a maps app, for example, with a long press.',
    name: 'Name',
    namePlaceholder: 'e.g. Apartment',
    lat: 'Latitude',
    lon: 'Longitude',
    apply: 'Apply',
  },
  sr: {
    title: 'Dom i radijus',
    sub: 'Polazna tačka za udaljenosti i radijus',
    homeIsNow: (label) => `Dom je sada: ${label}.`,
    notInGermany: (lat, lon) => `Ove koordinate nisu u Nemačkoj. Primer: širina ${lat} i dužina ${lon}.`,
    customPlace: 'Sopstvena lokacija',
    addressTooShort: 'Unesi ulicu i mesto, npr. „Marktplatz, Halle“.',
    addressNothing: 'Ništa nije pronađeno. Pokušaj i sa mestom, npr. „Marktplatz, Halle (Saale)“.',
    addressOffline: 'Pretraga adresa trenutno nije dostupna (van mreže?). Koordinate možeš da uneseš niže.',
    noGeolocation: 'Ovaj uređaj ne daje svoju lokaciju.',
    locating: 'Utvrđujem lokaciju…',
    myLocation: 'Moja lokacija',
    locationFailed: 'Lokacija nije dostupna ili nije dozvoljena.',
    home: 'Dom',
    coords: (lat, lon) => `${lat}° S, ${lon}° I`,
    fromDefault: (km, label) => `, ${km} od lokacije ${label}`,
    backToDefault: (label) => `Vrati na podrazumevano: ${label}`,
    radius: 'Radijus',
    allGermany: 'cela Nemačka',
    radiusHint: 'Važi za špil, listu i mapu. Kad je radijus podešen, oglasi bez prepoznatog mesta otpadaju. Sačuvani uvek ostaju u odeljku „Sačuvano“.',
    otherPlace: 'Izaberi drugo mesto',
    citySearchLabel: 'Potraži grad',
    citySearchPlaceholder: 'Potraži grad, npr. Leipzig',
    useLocation: 'Koristi trenutnu lokaciju',
    addressTitle: 'Potraži adresu',
    addressLabel: 'Adresa',
    addressPlaceholder: 'Ulica i mesto',
    searching: 'Tražim…',
    search: 'Traži',
    addressHint: 'Uneti tekst ide pretrazi adresa servisa OpenStreetMap (Nominatim, podaci © OpenStreetMap saradnici, ODbL). Mesto se čuva zaokruženo na oko 100 m.',
    coordsSummary: 'Unesi tačnu adresu kao koordinate',
    coordsHint: 'Koordinate možeš da kopiraš npr. u aplikaciji za mape, dugim pritiskom.',
    name: 'Naziv',
    namePlaceholder: 'npr. Stan',
    lat: 'Širina',
    lon: 'Dužina',
    apply: 'Primeni',
  },
});

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
    store.toast(t.homeIsNow(label));
    setQ('');
  };

  const saveCustom = () => {
    const lat = Number(custom.lat.replace(',', '.'));
    const lon = Number(custom.lon.replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 45 || lat > 57 || lon < 4 || lon > 17) {
      setMsg(t.notInGermany(coord(DEFAULT_HOME.lat), coord(DEFAULT_HOME.lon)));
      return;
    }
    setMsg(null);
    setHome(custom.label.trim() || t.customPlace, lat, lon);
  };

  // Adresssuche über OpenStreetMap (Nominatim): nur auf Knopfdruck, auf etwa 100 m gerundet
  const [addr, setAddr] = useState('');
  const [hits, setHits] = useState<{ label: string; lat: number; lon: number }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = addr.trim();
    if (query.length < 4) return setMsg(t.addressTooShort);
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
      if (list.length === 0) setMsg(t.addressNothing);
    } catch {
      setMsg(t.addressOffline);
    } finally {
      setSearching(false);
    }
  };

  const useLocation = () => {
    if (!navigator.geolocation) return setMsg(t.noGeolocation);
    setMsg(t.locating);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMsg(null);
        // auf ca. 1 km gerundet – genauer braucht es der Umkreis nicht
        setHome(t.myLocation, Math.round(pos.coords.latitude * 100) / 100, Math.round(pos.coords.longitude * 100) / 100);
      },
      () => setMsg(t.locationFailed),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  };

  return (
    <SubPage title={t.title} sub={t.sub}>
      <div className="index-card">
        <p className="index-card__kicker">
          <IconHome width={18} height={18} style={{ verticalAlign: '-3px' }} /> {t.home}
        </p>
        <h2 className="index-card__title">{home.label}</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          {t.coords(coord(home.lat), coord(home.lon))}
          {!isDefault && t.fromDefault(fmtKm(distanceKm(home.lat, home.lon, DEFAULT_HOME.lat, DEFAULT_HOME.lon)), DEFAULT_HOME.label)}
        </p>
        {!isDefault && (
          <button type="button" className="btn btn--small" onClick={() => setHome(DEFAULT_HOME.label, DEFAULT_HOME.lat, DEFAULT_HOME.lon)}>
            {t.backToDefault(DEFAULT_HOME.label)}
          </button>
        )}
      </div>

      <h2 className="section-title">{t.radius}</h2>
      <div className="chips">
        {RADII.map((r) => (
          <button key={String(r)} type="button" className="chip" aria-pressed={s.settings.filter.radiusKm === r} onClick={() => store.updateSettings('filter', { ...s.settings.filter, radiusKm: r })}>
            {r == null ? t.allGermany : `${r} km`}
          </button>
        ))}
      </div>
      <p className="hint">{t.radiusHint}</p>

      <h2 className="section-title">{t.otherPlace}</h2>
      <label className="search" style={{ display: 'block' }}>
        <span className="visually-hidden">{t.citySearchLabel}</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.citySearchPlaceholder} />
      </label>
      {cities.length > 0 && (
        <ul className="list">
          {cities.map((c) => (
            <li key={c.id} className="pick">
              <button type="button" className="pick__btn" onClick={() => setHome(c.name, c.lat, c.lon)}>
                <IconHome width={20} height={20} />
                <span>
                  {c.name} <small>{stateName(c.state)}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0' }}>
        <button type="button" className="btn btn--small" onClick={useLocation}>
          {t.useLocation}
        </button>
      </div>

      <h2 className="section-title">{t.addressTitle}</h2>
      <form onSubmit={(e) => void searchAddress(e)} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <label className="search" style={{ flex: 1 }}>
          <span className="visually-hidden">{t.addressLabel}</span>
          <IconSearch />
          <input className="input" type="search" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={t.addressPlaceholder} enterKeyHint="search" autoComplete="street-address" />
        </label>
        <button type="submit" className="btn btn--small" disabled={searching}>
          {searching ? t.searching : t.search}
        </button>
      </form>
      <p className="hint">{t.addressHint}</p>
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
        <summary>{t.coordsSummary}</summary>
        <p className="hint">{t.coordsHint}</p>
        <label className="field">
          <span>{t.name}</span>
          <input className="input" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder={t.namePlaceholder} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field">
            <span>{t.lat}</span>
            <input className="input" inputMode="decimal" value={custom.lat} onChange={(e) => setCustom({ ...custom, lat: e.target.value })} placeholder={coord(DEFAULT_HOME.lat)} />
          </label>
          <label className="field">
            <span>{t.lon}</span>
            <input className="input" inputMode="decimal" value={custom.lon} onChange={(e) => setCustom({ ...custom, lon: e.target.value })} placeholder={coord(DEFAULT_HOME.lon)} />
          </label>
        </div>
        <button type="button" className="btn btn--small btn--primary" onClick={saveCustom}>
          {t.apply}
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
