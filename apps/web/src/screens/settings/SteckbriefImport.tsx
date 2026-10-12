// Steckbrief aus dem externen Interview importieren.
// Das Format ist ein Entwurf (v0) – der Import ist die einzige Stelle, die es kennt.

import { useMemo, useRef, useState } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  importSteckbrief,
  normalizeText,
  STATES,
  STECKBRIEF_EXAMPLE,
  type City,
  type Institution,
  type StateCode,
  type SteckbriefImport as Imported,
} from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { navigate } from '../../lib/router';
import { Hearts } from '../../ui/bits';
import { SubPage } from './Settings';

function findCity(name: string, cities: Iterable<City>): City | undefined {
  const n = normalizeText(name);
  let prefix: City | undefined;
  for (const c of cities) {
    const cn = normalizeText(c.name);
    if (cn === n) return c;
    if (!prefix && (cn.startsWith(`${n} `) || n.startsWith(`${cn} `))) prefix = c;
  }
  return prefix;
}

function findInstitution(name: string, insts: Iterable<Institution>): Institution | undefined {
  const n = normalizeText(name);
  let partial: Institution | undefined;
  for (const i of insts) {
    const a = normalizeText(i.name);
    const b = i.shortName ? normalizeText(i.shortName) : '';
    if (a === n || b === n) return i;
    if (!partial && n.length >= 6 && (a.includes(n) || n.includes(a))) partial = i;
  }
  return partial;
}

export function SteckbriefImport() {
  const s = useAppState();
  const store = useStore();
  const [text, setText] = useState('');
  const [result, setResult] = useState<Imported | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const check = (raw = text) => {
    setResult(null);
    setError(null);
    if (!raw.trim()) return setError('Bitte zuerst den Steckbrief einfügen oder eine Datei wählen.');
    const r = importSteckbrief(raw);
    if ('error' in r) return setError(r.error);
    setResult(r);
  };

  const suggestions = useMemo(() => {
    if (!result) return null;
    const states = result.favorites.states.map((code: StateCode) => ({ key: `state:${code}`, kind: 'state' as const, ref: code, label: STATES[code] }));
    const cities: { key: string; kind: 'city'; ref: string; label: string }[] = [];
    const missing: string[] = [];
    for (const name of result.favorites.cityNames) {
      const c = findCity(name, s.cities.values());
      if (c) cities.push({ key: `city:${c.id}`, kind: 'city', ref: c.id, label: c.name });
      else missing.push(name);
    }
    const insts: { key: string; kind: 'institution'; ref: string; label: string }[] = [];
    for (const name of result.favorites.institutionNames) {
      const i = findInstitution(name, s.institutions.values());
      if (i) insts.push({ key: `institution:${i.id}`, kind: 'institution', ref: i.id, label: i.name });
      else missing.push(name);
    }
    const all = [...states, ...cities, ...insts];
    return { all, missing };
  }, [result, s.cities, s.institutions]);

  // Vorschläge sind anfangs alle angehakt
  const [lastResult, setLastResult] = useState<Imported | null>(null);
  if (result !== lastResult) {
    setLastResult(result);
    setPicked(new Set(suggestions?.all.map((x) => x.key) ?? []));
  }

  const apply = () => {
    if (!result || !suggestions) return;
    const prev = s.settings.profile;
    store.updateSettings('profile', result.profile);
    let n = 0;
    for (const f of suggestions.all) {
      if (picked.has(f.key) && !store.isFavorite(f.kind, f.ref)) {
        store.setFavorite(f.kind, f.ref, true);
        n++;
      }
    }
    store.toast(`Steckbrief übernommen${n ? `, ${n} Lieblingsort${n === 1 ? '' : 'e'} dazu` : ''}.`, { label: 'Profil zurück', run: () => store.updateSettings('profile', prev) }, 7000);
    navigate('/ich');
  };

  const p = result?.profile;

  return (
    <SubPage title="Steckbrief importieren" sub="aus dem Interview mit einem starken KI-Modell">
      <p className="notice">
        Das Antwortformat ist noch ein <b>Entwurf (Version 0)</b>. Interview-Prompt und endgültiges Format kommen in einem eigenen Schritt, dann wird nur dieser Import angepasst. Der Steckbrief setzt dein Suchprofil und schlägt Lieblingsorte vor. Filter ändert er nicht, aussortiert wird also nichts.
      </p>

      <label className="field">
        <span>Steckbrief (JSON)</span>
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
            setError(null);
          }}
          placeholder={'{ "format": "stellenbuechlein-steckbrief", "version": 0, … }'}
          spellCheck={false}
          rows={8}
        />
      </label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary" onClick={() => check()}>
          Prüfen
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Datei wählen
        </button>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => {
            const t = JSON.stringify(STECKBRIEF_EXAMPLE, null, 2);
            setText(t);
            check(t);
          }}
        >
          Beispiel einfügen
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const t = await f.text();
            setText(t);
            check(t);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}

      {p && suggestions && (
        <div className="import-preview" aria-live="polite">
          <h2 className="section-title">So sähe dein Suchprofil aus</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            {p.name}. Alles lässt sich danach unter „Suchprofil“ anpassen.
          </p>
          {CATEGORY_ORDER.map((id) => {
            const c = p.categories.find((x) => x.id === id)!;
            return (
              <div key={id} className="import-preview__cat">
                <b>
                  {CATEGORY_LABELS[id]} <small>Gewicht {c.weight}</small>
                </b>
                {c.items.length === 0 ? (
                  <span className="hint">leer, zählt nicht</span>
                ) : (
                  <ul>
                    {c.items.map((it) => (
                      <li key={it.id}>
                        {it.label} <Hearts value={it.hearts} />
                        {it.terms?.length ? <small> ({it.terms.slice(0, 4).join(', ')}{it.terms.length > 4 ? ' …' : ''})</small> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {p.avoid.length > 0 && (
            <div className="import-preview__cat">
              <b>Lieber nicht</b>
              <ul>
                {p.avoid.map((it) => (
                  <li key={it.id}>
                    {it.label} <Hearts value={it.hearts} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.horizont && (
            <div className="import-preview__cat">
              <b>
                Horizont <small>{p.horizont.weite ? 'mit Weite' : 'ohne Weite'}</small>
              </b>
              {p.horizont.bruecken.length === 0 ? (
                <span className="hint">keine Brücken</span>
              ) : (
                <ul>
                  {p.horizont.bruecken.slice(0, 8).map((b) => (
                    <li key={b.id}>
                      {b.name} <small>({b.feld.slice(0, 4).join(', ')}{b.feld.length > 4 ? ' …' : ''})</small>
                    </li>
                  ))}
                  {p.horizont.bruecken.length > 8 && <li>und {p.horizont.bruecken.length - 8} weitere</li>}
                </ul>
              )}
              {p.horizont.interessen.length > 0 && <span className="hint">Interessen: {p.horizont.interessen.join(', ')}</span>}
            </div>
          )}
          {result!.warnings.length > 0 && (
            <ul className="notice notice--warn" style={{ paddingLeft: 30 }}>
              {result!.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {(suggestions.all.length > 0 || suggestions.missing.length > 0) && (
            <>
              <h3 className="section-title">Vorgeschlagene Lieblingsorte</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                Lieblingsorte rücken nach oben. Was du abhakst, wird nicht übernommen.
              </p>
              {suggestions.all.map((f) => (
                <label key={f.key} className="toggle">
                  <span>
                    {f.label} <small className="hint">{f.kind === 'state' ? 'Bundesland' : f.kind === 'city' ? 'Stadt' : 'Einrichtung'}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={picked.has(f.key)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(f.key);
                      else next.delete(f.key);
                      setPicked(next);
                    }}
                  />
                </label>
              ))}
              {suggestions.missing.length > 0 && <p className="hint">Nicht gefunden und darum nicht übernommen: {suggestions.missing.join(', ')}</p>}
            </>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="button" className="btn btn--primary" onClick={apply}>
              Steckbrief übernehmen
            </button>
            <button type="button" className="btn" onClick={() => setResult(null)}>
              Verwerfen
            </button>
          </div>
          <p className="hint">Dein bisheriges Profil wird ersetzt. Direkt danach lässt es sich mit „Profil zurück“ wiederherstellen.</p>
        </div>
      )}
    </SubPage>
  );
}
