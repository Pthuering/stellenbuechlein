// Steckbrief aus dem externen Interview importieren.
// Das Format ist ein Entwurf (v0) – der Import ist die einzige Stelle, die es kennt.

import { useMemo, useRef, useState } from 'react';
import {
  CATEGORY_ORDER,
  importSteckbrief,
  normalizeText,
  STECKBRIEF_EXAMPLE,
  type City,
  type Institution,
  type StateCode,
  type SteckbriefImport as Imported,
  type Suchprofil,
} from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { navigate } from '../../lib/router';
import { Hearts } from '../../ui/bits';
import { SubPage } from './Settings';
import { srForm, texts } from '../../i18n';
import { categoryLabel, stateName } from '../../i18n/labels';
import { profileLabel, profileName } from '../../i18n/katalog';

const t = texts({
  de: {
    previewTitle: 'So sähe dein Suchprofil aus',
    previewHint: (name: string) => `${name}. Alles lässt sich danach unter „Suchprofil“ anpassen.`,
    weight: (w: number) => `Gewicht ${w}`,
    emptyCat: 'leer, zählt nicht',
    avoid: 'Lieber nicht',
    horizon: 'Horizont',
    withBeyond: 'mit Weite',
    withoutBeyond: 'ohne Weite',
    noBridges: 'keine Brücken',
    more: (n: number) => `und ${n} weitere`,
    interests: (list: string) => `Interessen: ${list}`,
    // Meldungen aus importSteckbrief (packages/core/src/steckbrief.ts)
    warnNoTopics: (cat: string) => `Keine Themen im Steckbrief – die Kategorie „${cat}“ bleibt leer und zählt nicht.`,
    warnNoKinds: (cat: string) => `Keine Stellenarten im Steckbrief – „${cat}“ zählt nicht.`,
    warnStates: 'Einige Bundesländer wurden nicht erkannt (bitte Kürzel wie SN, ST, TH verwenden).',
    warnNoBridges: 'Im Horizont stehen keine Brücken – es gelten die breiten Start-Brücken.',
    errJson: 'Das ist kein gültiges JSON. Bitte den Steckbrief vollständig einfügen.',
    errFormat: (detail: string) => `Steckbrief passt nicht zum erwarteten Format (${detail}).`,
    root: 'Wurzel',
    errEmpty: 'Bitte zuerst den Steckbrief einfügen oder eine Datei wählen.',
    title: 'Steckbrief importieren',
    sub: 'aus dem Interview mit einem starken KI-Modell',
    noticeA: 'Das Antwortformat ist noch ein ',
    noticeDraft: 'Entwurf (Version 0)',
    noticeB: '. Interview-Prompt und endgültiges Format kommen in einem eigenen Schritt, dann wird nur dieser Import angepasst. Der Steckbrief setzt dein Suchprofil und schlägt Lieblingsorte vor. Filter ändert er nicht, aussortiert wird also nichts.',
    field: 'Steckbrief (JSON)',
    check: 'Prüfen',
    chooseFile: 'Datei wählen',
    example: 'Beispiel einfügen',
    suggested: 'Vorgeschlagene Lieblingsorte',
    suggestedHint: 'Lieblingsorte rücken nach oben. Was du abhakst, wird nicht übernommen.',
    kind: { state: 'Bundesland', city: 'Stadt', institution: 'Einrichtung' } as Record<'state' | 'city' | 'institution', string>,
    missing: (list: string) => `Nicht gefunden und darum nicht übernommen: ${list}`,
    apply: 'Steckbrief übernehmen',
    discard: 'Verwerfen',
    replaceHint: 'Dein bisheriges Profil wird ersetzt. Direkt danach lässt es sich mit „Profil zurück“ wiederherstellen.',
    restore: 'Profil zurück',
    applied: (n: number) => `Steckbrief übernommen${n ? `, ${n} Lieblingsort${n === 1 ? '' : 'e'} dazu` : ''}.`,
  },
  en: {
    previewTitle: 'Here’s what your search profile would look like',
    previewHint: (name) => `${name}. You can adjust everything afterwards under “Search profile”.`,
    weight: (w) => `Weight ${w}`,
    emptyCat: 'empty, doesn’t count',
    avoid: 'Rather not',
    horizon: 'Horizon',
    withBeyond: 'Beyond on',
    withoutBeyond: 'Beyond off',
    noBridges: 'no bridges',
    more: (n) => `and ${n} more`,
    interests: (list) => `Interests: ${list}`,
    warnNoTopics: (cat) => `No topics in the profile sheet, so the “${cat}” category stays empty and doesn’t count.`,
    warnNoKinds: (cat) => `No position types in the profile sheet, so “${cat}” doesn’t count.`,
    warnStates: 'Some federal states weren’t recognized (please use codes like SN, ST, TH).',
    warnNoBridges: 'There are no bridges in Horizon, so the broad starter bridges apply.',
    errJson: 'That’s not valid JSON. Please paste the complete profile sheet.',
    errFormat: (detail) => `The profile sheet doesn’t match the expected format (${detail}).`,
    root: 'root',
    errEmpty: 'Paste the profile sheet first, or choose a file.',
    title: 'Import profile sheet',
    sub: 'from the interview with a powerful AI model',
    noticeA: 'The answer format is still a ',
    noticeDraft: 'draft (version 0)',
    noticeB: '. The interview prompt and the final format come in a separate step, and then only this import gets updated. The profile sheet sets your search profile and suggests favorite places. It doesn’t change any filters, so nothing gets filtered out.',
    field: 'Profile sheet (JSON)',
    check: 'Check',
    chooseFile: 'Choose file',
    example: 'Insert example',
    suggested: 'Suggested favorite places',
    suggestedHint: 'Favorite places move up. Anything you uncheck won’t be added.',
    kind: { state: 'federal state', city: 'city', institution: 'institution' },
    missing: (list) => `Not found, so not added: ${list}`,
    apply: 'Apply profile sheet',
    discard: 'Discard',
    replaceHint: 'Your current profile will be replaced. Right afterwards, you can bring it back with “Restore profile”.',
    restore: 'Restore profile',
    applied: (n) => `Profile sheet applied${n ? `, ${n} favorite ${n === 1 ? 'place' : 'places'} added` : ''}.`,
  },
  sr: {
    previewTitle: 'Ovako bi izgledao tvoj profil pretrage',
    previewHint: (name) => `${name}. Sve možeš kasnije da prilagodiš pod „Profil pretrage“.`,
    weight: (w) => `Težina ${w}`,
    emptyCat: 'prazno, ne računa se',
    avoid: 'Radije ne',
    horizon: 'Horizont',
    withBeyond: 'Daljina uključena',
    withoutBeyond: 'Daljina isključena',
    noBridges: 'nema mostova',
    more: (n) => `i još ${n}`,
    interests: (list) => `Interesovanja: ${list}`,
    warnNoTopics: (cat) => `U ličnom kartonu nema tema – kategorija „${cat}“ ostaje prazna i ne računa se.`,
    warnNoKinds: (cat) => `U ličnom kartonu nema vrsta pozicija – „${cat}“ se ne računa.`,
    warnStates: 'Neke savezne pokrajine nisu prepoznate (koristi skraćenice kao što su SN, ST, TH).',
    warnNoBridges: 'U Horizontu nema mostova – važe široki početni mostovi.',
    errJson: 'Ovo nije ispravan JSON. Nalepi ceo lični karton.',
    errFormat: (detail) => `Lični karton ne odgovara očekivanom formatu (${detail}).`,
    root: 'koren',
    errEmpty: 'Prvo nalepi lični karton ili izaberi datoteku.',
    title: 'Uvezi lični karton',
    sub: 'iz intervjua sa moćnim AI modelom',
    noticeA: 'Format odgovora je još uvek ',
    noticeDraft: 'nacrt (verzija 0)',
    noticeB: '. Prompt za intervju i konačan format dolaze u posebnom koraku, a onda se prilagođava samo ovaj uvoz. Lični karton postavlja tvoj profil pretrage i predlaže omiljena mesta. Filtere ne menja, pa se ništa ne izbacuje.',
    field: 'Lični karton (JSON)',
    check: 'Proveri',
    chooseFile: 'Izaberi datoteku',
    example: 'Ubaci primer',
    suggested: 'Predložena omiljena mesta',
    suggestedHint: 'Omiljena mesta se penju na listi. Ono sa čega skineš kvačicu neće biti dodato.',
    kind: { state: 'savezna pokrajina', city: 'grad', institution: 'ustanova' },
    missing: (list) => `Nije pronađeno, pa nije dodato: ${list}`,
    apply: 'Primeni lični karton',
    discard: 'Odbaci',
    replaceHint: 'Tvoj dosadašnji profil biće zamenjen. Odmah posle toga možeš da ga vratiš dugmetom „Vrati profil“.',
    restore: 'Vrati profil',
    applied: (n) => `Lični karton je primenjen${n ? `, ${srForm(n, 'dodato', 'dodata', 'dodato')} ${n} ${srForm(n, 'omiljeno mesto', 'omiljena mesta', 'omiljenih mesta')}` : ''}.`,
  },
});

/**
 * Meldung aus importSteckbrief (Warnung oder Fehler) in der Sprache der Oberfläche.
 * Bekannte deutsche Texte aus dem Kern werden übersetzt; die technische Angabe von zod bleibt, wie sie ist.
 * Unbekanntes kommt unverändert zurück.
 */
export function steckbriefMessage(msg: string): string {
  switch (msg) {
    case 'Keine Themen im Steckbrief – die Kategorie „Thema“ bleibt leer und zählt nicht.':
      return t.warnNoTopics(categoryLabel('thema'));
    case 'Keine Stellenarten im Steckbrief – „Stellenart“ zählt nicht.':
      return t.warnNoKinds(categoryLabel('stelle'));
    case 'Einige Bundesländer wurden nicht erkannt (bitte Kürzel wie SN, ST, TH verwenden).':
      return t.warnStates;
    case 'Im Horizont stehen keine Brücken – es gelten die breiten Start-Brücken.':
      return t.warnNoBridges;
    case 'Das ist kein gültiges JSON. Bitte den Steckbrief vollständig einfügen.':
      return t.errJson;
  }
  const m = /^Steckbrief passt nicht zum erwarteten Format \((.*)\)\.$/s.exec(msg);
  if (m) return t.errFormat(m[1].replace(/^Wurzel:/, `${t.root}:`));
  return msg;
}

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

/** Vorschau eines Suchprofils vor dem Übernehmen (Steckbrief-Import und Umfrage). */
export function ProfilePreview({ profile: p, warnings }: { profile: Suchprofil; warnings: string[] }) {
  return (
    <>
      <h2 className="section-title">{t.previewTitle}</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        {t.previewHint(profileName(p.name))}
      </p>
      {CATEGORY_ORDER.map((id) => {
        const c = p.categories.find((x) => x.id === id)!;
        return (
          <div key={id} className="import-preview__cat">
            <b>
              {categoryLabel(id)} <small>{t.weight(c.weight)}</small>
            </b>
            {c.items.length === 0 ? (
              <span className="hint">{t.emptyCat}</span>
            ) : (
              <ul>
                {c.items.map((it) => (
                  <li key={it.id}>
                    {profileLabel(it.label)} <Hearts value={it.hearts} />
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
          <b>{t.avoid}</b>
          <ul>
            {p.avoid.map((it) => (
              <li key={it.id}>
                {profileLabel(it.label)} <Hearts value={it.hearts} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.horizont && (
        <div className="import-preview__cat">
          <b>
            {t.horizon} <small>{p.horizont.weite ? t.withBeyond : t.withoutBeyond}</small>
          </b>
          {p.horizont.bruecken.length === 0 ? (
            <span className="hint">{t.noBridges}</span>
          ) : (
            <ul>
              {p.horizont.bruecken.slice(0, 8).map((b) => (
                <li key={b.id}>
                  {profileLabel(b.name)} <small>({b.feld.slice(0, 4).join(', ')}{b.feld.length > 4 ? ' …' : ''})</small>
                </li>
              ))}
              {p.horizont.bruecken.length > 8 && <li>{t.more(p.horizont.bruecken.length - 8)}</li>}
            </ul>
          )}
          {p.horizont.interessen.length > 0 && <span className="hint">{t.interests(p.horizont.interessen.map(profileLabel).join(', '))}</span>}
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="notice notice--warn" style={{ paddingLeft: 30 }}>
          {warnings.map((w) => (
            <li key={w}>{steckbriefMessage(w)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Fehler beim Prüfen: eigener Hinweis oder Meldung aus dem Kern (wird beim Zeichnen übersetzt). */
type CheckError = { kind: 'empty' } | { kind: 'core'; msg: string };

export function SteckbriefImport() {
  const s = useAppState();
  const store = useStore();
  const [text, setText] = useState('');
  const [result, setResult] = useState<Imported | null>(null);
  const [error, setError] = useState<CheckError | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const check = (raw = text) => {
    setResult(null);
    setError(null);
    if (!raw.trim()) return setError({ kind: 'empty' });
    const r = importSteckbrief(raw);
    if ('error' in r) return setError({ kind: 'core', msg: r.error });
    setResult(r);
  };

  // Namen von Bundesländern werden beim Zeichnen geholt (Sprache), Städte und Einrichtungen bleiben, wie sie sind.
  const suggestions = useMemo(() => {
    if (!result) return null;
    const states = result.favorites.states.map((code: StateCode) => ({ key: `state:${code}`, kind: 'state' as const, ref: code, label: code as string }));
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
    store.toast(t.applied(n), { label: t.restore, run: () => store.updateSettings('profile', prev) }, 7000);
    navigate('/ich');
  };

  const p = result?.profile;
  const errorText = error ? (error.kind === 'empty' ? t.errEmpty : steckbriefMessage(error.msg)) : null;

  return (
    <SubPage title={t.title} sub={t.sub}>
      <p className="notice">
        {t.noticeA}
        <b>{t.noticeDraft}</b>
        {t.noticeB}
      </p>

      <label className="field">
        <span>{t.field}</span>
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
          {t.check}
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          {t.chooseFile}
        </button>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => {
            const json = JSON.stringify(STECKBRIEF_EXAMPLE, null, 2);
            setText(json);
            check(json);
          }}
        >
          {t.example}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const content = await f.text();
            setText(content);
            check(content);
            e.target.value = '';
          }}
        />
      </div>

      {errorText && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 14 }}>
          {errorText}
        </p>
      )}

      {p && suggestions && (
        <div className="import-preview" aria-live="polite">
          <ProfilePreview profile={p} warnings={result!.warnings} />

          {(suggestions.all.length > 0 || suggestions.missing.length > 0) && (
            <>
              <h3 className="section-title">{t.suggested}</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                {t.suggestedHint}
              </p>
              {suggestions.all.map((f) => (
                <label key={f.key} className="toggle">
                  <span>
                    {f.kind === 'state' ? stateName(f.ref as StateCode) : f.label} <small className="hint">{t.kind[f.kind]}</small>
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
              {suggestions.missing.length > 0 && <p className="hint">{t.missing(suggestions.missing.join(', '))}</p>}
            </>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="button" className="btn btn--primary" onClick={apply}>
              {t.apply}
            </button>
            <button type="button" className="btn" onClick={() => setResult(null)}>
              {t.discard}
            </button>
          </div>
          <p className="hint">{t.replaceHint}</p>
        </div>
      )}
    </SubPage>
  );
}
