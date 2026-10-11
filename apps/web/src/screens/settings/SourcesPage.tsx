// Quellen & Läufe: wo eingesammelt wird, was schiefging, was der Grobfilter aussortiert hat.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_GATE_TERMS, INSTITUTION_KIND_LABELS, normalizeText, type Gate, type Institution, type InstitutionKind, type RunInfo, type Source, type SourceKind, type SourceStatus } from '@stellen/core';
import type { GateSkip, SourcesData } from '../../data/backend';
import { useAppState, useStore } from '../../data/hooks';
import { plural, relativeTime } from '../../lib/format';
import { Sheet } from '../../ui/Sheet';
import { IconExternal, IconPlus, IconRefresh, IconSearch } from '../../ui/icons';
import { SubPage } from './Settings';

const STATUS_LABEL: Record<SourceStatus, string> = {
  neu: 'noch nicht gelaufen',
  ok: 'läuft',
  leer: 'gerade keine Stellen',
  warnung: 'Warnung',
  fehler: 'Fehler',
  blockiert: 'blockiert',
  'url-fehlt': 'Adresse fehlt',
};

const STAT_LABELS: [string, string][] = [
  ['neu', 'neu'],
  ['aktualisiert', 'aktualisiert'],
  ['abgelaufen', 'abgelaufen'],
  ['grobfilter', 'vom Grobfilter aussortiert'],
  ['dubletten', 'Dubletten zusammengeführt'],
  ['browserNeu', 'per Browser gefunden'],
  ['browserVervollstaendigt', 'per Browser vervollständigt'],
  ['fehlerDetail', 'Anzeigen nicht lesbar'],
  ['quelle_fehler', 'Quellen mit Fehler'],
  ['robots', 'durch robots.txt gesperrt'],
  ['ki', 'KI-Aufrufe'],
];

type Tab = 'quellen' | 'vorschlaege' | 'aussortiert' | 'laeufe';
type SourceFilter = 'probleme' | 'ohne' | 'alle';

function isProblem(src: Source): boolean {
  return src.enabled && (src.status === 'fehler' || src.status === 'blockiert' || src.status === 'warnung');
}

function runSummary(r: RunInfo): string {
  const st = r.stats ?? {};
  const parts = [`${st.neu ?? 0} neu`, `${st.aktualisiert ?? 0} aktualisiert`];
  if (st.grobfilter) parts.push(`${st.grobfilter} aussortiert`);
  if (st.quelle_fehler) parts.push(`${st.quelle_fehler} Quellen mit Fehler`);
  return parts.join(', ');
}

function SourceSheet({ src, inst, onClose, onSaved }: { src: Source; inst?: Institution; onClose: () => void; onSaved: () => void }) {
  const store = useStore();
  const [url, setUrl] = useState(src.url ?? '');
  const [label, setLabel] = useState(src.label ?? '');
  const [enabled, setEnabled] = useState(src.enabled);
  const [gate, setGate] = useState<Gate>(src.gate);
  const [verified, setVerified] = useState(src.verified);
  const [render, setRender] = useState(!!src.config.render);
  const [ignoreRobots, setIgnoreRobots] = useState(!!src.config.ignoreRobots);
  const [pattern, setPattern] = useState(src.config.linkPattern ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    if (url && !/^https?:\/\//i.test(url.trim())) return setMsg('Die Adresse muss mit https:// beginnen.');
    if (pattern) {
      try {
        new RegExp(pattern);
      } catch {
        return setMsg('Das Linkmuster ist kein gültiger regulärer Ausdruck.');
      }
    }
    setBusy(true);
    setMsg(null);
    try {
      const config = { ...src.config, render: render || undefined, ignoreRobots: ignoreRobots || undefined, linkPattern: pattern.trim() || undefined };
      await store.api.patchSource(src.id, { url: url.trim() || null, label: label.trim() || null, enabled, gate, verified, config });
      store.toast('Quelle gespeichert. Beim nächsten Lauf gilt die neue Einstellung.');
      onSaved();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={inst?.shortName ?? inst?.name ?? src.label ?? 'Quelle'} onClose={onClose} full>
      <p className="hint" style={{ marginTop: 0 }}>
        {src.kind === 'portal' ? 'Portal (Sicherheitsnetz)' : src.kind === 'zentral' ? 'Zentrale Stellenbörse der Einrichtung' : 'Stellenseite eines Fachbereichs'}
        {inst ? `, ${INSTITUTION_KIND_LABELS[inst.kind]}` : ''}
      </p>
      <ul className="facts">
        <li>
          <span className="facts__k">Zustand</span>
          <span className="facts__v">
            <span className={`status status--${src.status}`}>{STATUS_LABEL[src.status]}</span>
            {src.consecutiveFailures > 1 ? ` seit ${src.consecutiveFailures} Läufen` : ''}
          </span>
        </li>
        {src.statusNote && (
          <li>
            <span className="facts__k">Hinweis</span>
            <span className="facts__v">{src.statusNote}</span>
          </li>
        )}
        <li>
          <span className="facts__k">Zuletzt</span>
          <span className="facts__v">
            {src.lastRunAt ? `${relativeTime(src.lastRunAt)}, ${plural(src.lastCount ?? 0, 'Anzeige', 'Anzeigen')}` : 'noch nicht gelaufen'}
            {src.lastOkAt && src.lastOkAt !== src.lastRunAt ? `, zuletzt erfolgreich ${relativeTime(src.lastOkAt)}` : ''}
          </span>
        </li>
        {src.methodsUsed && src.methodsUsed.length > 0 && (
          <li>
            <span className="facts__k">Gefunden über</span>
            <span className="facts__v">{src.methodsUsed.join(', ')}</span>
          </li>
        )}
        {typeof src.config.note === 'string' && (
          <li>
            <span className="facts__k">Recherche</span>
            <span className="facts__v">{src.config.note}</span>
          </li>
        )}
      </ul>

      <label className="field">
        <span>Adresse der Stellenseite</span>
        <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </label>
      {url && /^https?:\/\//.test(url) && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="hint" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <IconExternal width={14} height={14} /> Seite öffnen und prüfen
        </a>
      )}
      <label className="field">
        <span>Bezeichnung (optional)</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Institut für Psychologie" />
      </label>
      <label className="toggle">
        <span>Quelle einsammeln</span>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </label>
      <label className="toggle">
        <span>
          Adresse geprüft
          <br />
          <small className="hint">schützt sie vor automatischen Änderungen</small>
        </span>
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
      </label>
      <div className="field">
        <span>Was übernehmen?</span>
        <div className="segmented" role="group" aria-label="Grobfilter für diese Quelle">
          <button type="button" aria-pressed={gate === 'none'} onClick={() => setGate('none')}>
            alle Anzeigen
          </button>
          <button type="button" aria-pressed={gate === 'psych'} onClick={() => setGate('psych')}>
            nur mit Psychologie-Bezug
          </button>
        </div>
        <small className="hint">Fachbereichs-Seiten nehmen alles. Zentrale Börsen laufen durch den Grobfilter, Aussortiertes steht unter „Aussortiert“.</small>
      </div>

      <details className="help">
        <summary>Für Fortgeschrittene</summary>
        <label className="toggle">
          <span>
            Seite im Browser öffnen
            <br />
            <small className="hint">für Listen, die erst per JavaScript erscheinen</small>
          </span>
          <input type="checkbox" checked={render} onChange={(e) => setRender(e.target.checked)} />
        </label>
        <label className="toggle">
          <span>
            robots.txt übergehen
            <br />
            <small className="hint">nur, wenn du das für diese Seite verantworten willst</small>
          </span>
          <input type="checkbox" checked={ignoreRobots} onChange={(e) => setIgnoreRobots(e.target.checked)} />
        </label>
        <label className="field">
          <span>Linkmuster für Anzeigen (regulärer Ausdruck)</span>
          <input className="input" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="z. B. /stellenangebote/\d+" spellCheck={false} />
        </label>
        <p className="hint">Adapter: {src.config.ats ?? src.adapter}</p>
      </details>

      {msg && (
        <p className="notice notice--warn" role="alert">
          {msg}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          Speichern
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Sheet>
  );
}

function AddSourceSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const s = useAppState();
  const store = useStore();
  const [q, setQ] = useState('');
  const [instId, setInstId] = useState<string | null>(null);
  const [newInst, setNewInst] = useState({ name: '', cityId: '', kind: 'universitaet' as InstitutionKind, website: '' });
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<SourceKind>('fachbereich');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hits = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return [];
    return [...s.institutions.values()].filter((i) => normalizeText(`${i.name} ${i.shortName ?? ''}`).includes(n)).slice(0, 8);
  }, [q, s.institutions]);
  const cities = useMemo(() => [...s.cities.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')), [s.cities]);
  const chosen = instId ? s.institutions.get(instId) : undefined;

  const save = async () => {
    if (!/^https?:\/\//i.test(url.trim())) return setMsg('Bitte die Adresse der Stellenseite mit https:// eingeben.');
    if (kind !== 'portal' && !chosen && (!newInst.name.trim() || !newInst.cityId)) return setMsg('Bitte eine Einrichtung wählen oder Name und Stadt der neuen Einrichtung angeben.');
    setBusy(true);
    setMsg(null);
    try {
      await store.api.addSource({
        url: url.trim(),
        kind,
        label: label.trim() || undefined,
        gate: kind === 'fachbereich' ? 'none' : 'psych',
        ...(kind === 'portal' ? {} : chosen ? { institutionId: chosen.id } : { institution: { name: newInst.name.trim(), cityId: newInst.cityId, kind: newInst.kind, website: newInst.website.trim() || undefined } }),
      });
      store.toast('Quelle angelegt. Sie wird beim nächsten Lauf eingesammelt.');
      onSaved();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Quelle hinzufügen" onClose={onClose} full>
      <div className="field">
        <span>Art</span>
        <div className="segmented" role="group" aria-label="Art der Quelle">
          {(['fachbereich', 'zentral', 'portal'] as SourceKind[]).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'fachbereich' ? 'Fachbereich' : k === 'zentral' ? 'Zentrale Börse' : 'Portal'}
            </button>
          ))}
        </div>
        <small className="hint">{kind === 'fachbereich' ? 'Alle Anzeigen dieser Seite werden übernommen.' : 'Anzeigen laufen durch den Psychologie-Grobfilter.'}</small>
      </div>

      {kind !== 'portal' && (
        <>
          <div className="field">
            <span>Einrichtung</span>
            {chosen ? (
              <p style={{ margin: 0 }}>
                <b>{chosen.name}</b>{' '}
                <button type="button" className="btn btn--quiet btn--small" onClick={() => setInstId(null)}>
                  ändern
                </button>
              </p>
            ) : (
              <>
                <label className="search" style={{ display: 'block' }}>
                  <span className="visually-hidden">Einrichtung suchen</span>
                  <IconSearch />
                  <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Einrichtung suchen" />
                </label>
                {hits.length > 0 && (
                  <ul className="list">
                    {hits.map((i) => (
                      <li key={i.id} className="pick">
                        <button type="button" className="pick__btn" onClick={() => setInstId(i.id)}>
                          <span>
                            {i.name} <small>{s.cities.get(i.cityId ?? '')?.name}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          {!chosen && (
            <details className="help" open={q.length >= 2 && hits.length === 0}>
              <summary>Neue Einrichtung anlegen</summary>
              <label className="field">
                <span>Name</span>
                <input className="input" value={newInst.name} onChange={(e) => setNewInst({ ...newInst, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Stadt</span>
                <select className="select" value={newInst.cityId} onChange={(e) => setNewInst({ ...newInst, cityId: e.target.value })}>
                  <option value="">bitte wählen</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Art</span>
                <select className="select" value={newInst.kind} onChange={(e) => setNewInst({ ...newInst, kind: e.target.value as InstitutionKind })}>
                  {(Object.keys(INSTITUTION_KIND_LABELS) as InstitutionKind[]).map((k) => (
                    <option key={k} value={k}>
                      {INSTITUTION_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Website (optional)</span>
                <input className="input" type="url" value={newInst.website} onChange={(e) => setNewInst({ ...newInst, website: e.target.value })} placeholder="https://…" />
              </label>
            </details>
          )}
        </>
      )}

      <label className="field">
        <span>Adresse der Stellenseite</span>
        <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/stellenangebote" />
      </label>
      <label className="field">
        <span>Bezeichnung (optional)</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Lehrstuhl für Klinische Psychologie" />
      </label>
      {msg && (
        <p className="notice notice--warn" role="alert">
          {msg}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          Anlegen
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </Sheet>
  );
}

function GateEditor() {
  const s = useAppState();
  const store = useStore();
  const [text, setText] = useState(s.settings.gateTerms.join('\n'));
  const changed = text.trim() !== s.settings.gateTerms.join('\n').trim();
  return (
    <details className="help">
      <summary>Grobfilter-Begriffe ({s.settings.gateTerms.length})</summary>
      <p className="hint">
        Gilt nur für breite Quellen (zentrale Stellenbörsen, Portale). Eine Anzeige kommt durch, wenn <b>einer</b> dieser Begriffe vorkommt. Im Zweifel lieber mehr Begriffe: Der Score sortiert danach ohnehin. Schreibweise wie im Suchprofil (* = überall im Wort).
      </p>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--small btn--primary"
          disabled={!changed}
          onClick={() => {
            const terms = [...new Set(text.split('\n').map((t) => t.trim()).filter(Boolean))];
            if (terms.length === 0) return;
            store.updateSettings('gateTerms', terms);
            store.toast('Grobfilter gespeichert. Aussortiertes wird beim nächsten Lauf neu geprüft.');
          }}
        >
          Speichern
        </button>
        <button type="button" className="btn btn--small" onClick={() => setText(DEFAULT_GATE_TERMS.join('\n'))}>
          Standardliste
        </button>
      </div>
    </details>
  );
}

export function SourcesPage() {
  const s = useAppState();
  const store = useStore();
  const [tab, setTab] = useState<Tab>('quellen');
  const [data, setData] = useState<SourcesData | null>(null);
  const [skips, setSkips] = useState<GateSkip[] | null>(null);
  const [runs, setRuns] = useState<RunInfo[]>(s.runs);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SourceFilter>('probleme');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Source | null>(null);
  const [adding, setAdding] = useState(false);
  const [log, setLog] = useState<{ run: RunInfo; text: string | null } | null>(null);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await store.api.sources());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'aussortiert' && !skips) void store.api.skips().then(setSkips, () => setSkips([]));
    if (tab === 'laeufe') void store.api.runs().then(setRuns, () => undefined);
  }, [tab, skips, store]);

  const sources = data?.sources ?? [];
  const problems = sources.filter(isProblem);
  const missing = sources.filter((x) => x.enabled && !x.url);
  useEffect(() => {
    if (data && filter === 'probleme' && problems.length === 0) setFilter(missing.length ? 'ohne' : 'alle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const nameOf = (src: Source) => {
    const inst = src.institutionId ? s.institutions.get(src.institutionId) : undefined;
    return { inst, name: inst ? (inst.shortName ?? inst.name) : (src.label ?? src.id), sub: inst && src.label ? src.label : src.kind === 'portal' ? 'Portal' : src.kind === 'zentral' ? 'zentrale Börse' : 'Fachbereich' };
  };

  const list = useMemo(() => {
    const n = normalizeText(q);
    const base = filter === 'probleme' ? problems : filter === 'ohne' ? missing : sources;
    const filtered = n ? base.filter((src) => normalizeText(`${nameOf(src).name} ${src.label ?? ''} ${src.url ?? ''}`).includes(n)) : base;
    return [...filtered].sort((a, b) => nameOf(a).name.localeCompare(nameOf(b).name, 'de'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, filter, q, s.institutions]);

  const lastRun = runs[0];
  const queue = data ? Object.values(data.browserQueue).reduce((a, b) => a + b, 0) : 0;

  const trigger = async () => {
    setTriggering(true);
    try {
      await store.api.triggerIngest();
      store.toast('Einsammeln gestartet. Das dauert etwa 10 bis 20 Minuten.');
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e));
    } finally {
      setTriggering(false);
    }
  };

  return (
    <SubPage title="Quellen & Läufe" sub={data ? `${plural(sources.filter((x) => x.enabled).length, 'aktive Quelle', 'aktive Quellen')}` : 'wird geladen …'}>
      <div className="index-card">
        <p className="index-card__kicker">Letzter Lauf</p>
        {lastRun ? (
          <>
            <h2 className="index-card__title" style={{ fontSize: 20 }}>
              {relativeTime(lastRun.finishedAt ?? lastRun.startedAt)} {lastRun.finishedAt ? (lastRun.ok ? '' : '(mit Fehler beendet)') : '(läuft noch)'}
            </h2>
            <p className="hint" style={{ marginTop: 0 }}>
              {runSummary(lastRun)}
            </p>
          </>
        ) : (
          <p className="hint">{s.demo ? 'In der Demo wird nicht eingesammelt. Die Quellenliste ist trotzdem die echte Startliste.' : 'Noch kein Lauf. Die Pipeline läuft zweimal täglich über GitHub Actions.'}</p>
        )}
        {queue > 0 && <p className="hint">{plural(queue, 'Anzeige wartet', 'Anzeigen warten')} auf den Browser-Agenten.</p>}
        {!s.demo && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {s.ingestTrigger ? (
              <button type="button" className="btn btn--small btn--primary" disabled={triggering} onClick={() => void trigger()}>
                <IconRefresh width={18} height={18} /> Jetzt einsammeln
              </button>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                „Jetzt einsammeln“ braucht ein GitHub-Token im Worker (siehe Betriebsanleitung).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="segmented segmented--wrap" role="tablist" aria-label="Bereich">
        {(
          [
            ['quellen', 'Quellen'],
            ['vorschlaege', `Vorschläge${data?.suggestions.length ? ` (${data.suggestions.length})` : ''}`],
            ['aussortiert', 'Aussortiert'],
            ['laeufe', 'Läufe'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {error && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 12 }}>
          {error}{' '}
          <button type="button" className="btn btn--quiet btn--small" onClick={() => void load()}>
            nochmal
          </button>
        </p>
      )}

      {tab === 'quellen' && (
        <>
          <div className="toolbar">
            <div className="chips">
              <button type="button" className="chip" aria-pressed={filter === 'probleme'} onClick={() => setFilter('probleme')}>
                Probleme ({problems.length})
              </button>
              <button type="button" className="chip" aria-pressed={filter === 'ohne'} onClick={() => setFilter('ohne')}>
                ohne Adresse ({missing.length})
              </button>
              <button type="button" className="chip" aria-pressed={filter === 'alle'} onClick={() => setFilter('alle')}>
                alle ({sources.length})
              </button>
            </div>
          </div>
          <label className="search" style={{ display: 'block' }}>
            <span className="visually-hidden">Quellen durchsuchen</span>
            <IconSearch />
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Einrichtung oder Adresse" />
          </label>
          {filter === 'ohne' && missing.length > 0 && <p className="hint">Für diese Einrichtungen sucht die Pipeline selbst nach der Stellenseite und legt Vorschläge an. Bis dahin decken die Portale sie ab.</p>}
          {data && list.length === 0 && <p className="hint">{filter === 'probleme' ? 'Keine Probleme.' : 'Keine passenden Quellen.'}</p>}
          <ul className="list">
            {list.map((src) => {
              const n = nameOf(src);
              return (
                <li key={src.id} className={`row row--source ${src.enabled ? '' : 'row--faded'}`} onClick={() => setEdit(src)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEdit(src)}>
                  <div className="row__main">
                    <p className="row__title">{n.name}</p>
                    <p className="row__sub">
                      {n.sub}
                      {src.lastRunAt ? `, ${relativeTime(src.lastRunAt)} ${plural(src.lastCount ?? 0, 'Anzeige', 'Anzeigen')}` : ''}
                    </p>
                  </div>
                  <div className="row__meta">
                    <span className={`status status--${src.enabled ? src.status : 'leer'}`}>{src.enabled ? STATUS_LABEL[src.status] : 'aus'}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          {!s.demo && (
            <button type="button" className="btn btn--small" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
              <IconPlus width={18} height={18} /> Quelle hinzufügen
            </button>
          )}
          <GateEditor />
        </>
      )}

      {tab === 'vorschlaege' && (
        <>
          <p className="hint">Die Pipeline sucht für Einrichtungen ohne Adresse selbst nach der Stellenseite. Übernommen wird erst, was du bestätigst.</p>
          {!data?.suggestions.length ? (
            <p className="hint">Gerade keine Vorschläge.</p>
          ) : (
            <ul className="list">
              {data.suggestions.map((sg) => {
                const inst = s.institutions.get(sg.institutionId);
                return (
                  <li key={sg.id} className="suggestion">
                    <b>{inst?.name ?? sg.institutionId}</b>
                    <a href={sg.url} target="_blank" rel="noopener noreferrer" className="suggestion__url">
                      {sg.url.replace(/^https?:\/\//, '')}
                    </a>
                    {sg.reason && <small className="hint">{sg.reason}</small>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        type="button"
                        className="btn btn--small btn--primary"
                        onClick={async () => {
                          await store.api.resolveSuggestion(sg.id, true);
                          store.toast('Übernommen.');
                          void load();
                        }}
                      >
                        Übernehmen
                      </button>
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={async () => {
                          await store.api.resolveSuggestion(sg.id, false);
                          void load();
                        }}
                      >
                        Verwerfen
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'aussortiert' && (
        <>
          <p className="hint">
            Diese Anzeigen stammen aus breiten Quellen und enthielten keinen Begriff aus dem Grobfilter. Ist etwas Passendes dabei, den fehlenden Begriff im Grobfilter ergänzen (unter „Quellen“): Beim nächsten Lauf wird neu geprüft.
          </p>
          {skips == null ? (
            <p className="hint">wird geladen …</p>
          ) : skips.length === 0 ? (
            <p className="hint">{s.demo ? 'In der Demo wird nichts aussortiert.' : 'Nichts aussortiert.'}</p>
          ) : (
            <ul className="list">
              {skips.map((k) => (
                <li key={k.url} className="skip">
                  <a href={k.url} target="_blank" rel="noopener noreferrer">
                    {k.title ?? k.url.replace(/^https?:\/\//, '')}
                  </a>
                  <small className="hint">
                    {k.institutionId ? (s.institutions.get(k.institutionId)?.shortName ?? s.institutions.get(k.institutionId)?.name) : k.sourceId}, {relativeTime(k.seenAt)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'laeufe' && (
        <>
          {runs.length === 0 ? (
            <p className="hint">{s.demo ? 'In der Demo gibt es keine Läufe.' : 'Noch keine Läufe.'}</p>
          ) : (
            <ul className="list">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="row row--source"
                  tabIndex={0}
                  onClick={() => {
                    setLog({ run: r, text: null });
                    void store.api.runLog(r.id).then(
                      (text) => setLog({ run: r, text }),
                      () => setLog({ run: r, text: 'Protokoll nicht verfügbar.' }),
                    );
                  }}
                >
                  <div className="row__main">
                    <p className="row__title">{new Date(r.startedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <p className="row__sub">{runSummary(r)}</p>
                  </div>
                  <div className="row__meta">
                    <span className={`status status--${r.finishedAt ? (r.ok ? 'ok' : 'fehler') : 'neu'}`}>{r.finishedAt ? (r.ok ? 'fertig' : 'Fehler') : 'läuft'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {edit && <SourceSheet src={edit} inst={edit.institutionId ? s.institutions.get(edit.institutionId) : undefined} onClose={() => setEdit(null)} onSaved={() => void load()} />}
      {adding && <AddSourceSheet onClose={() => setAdding(false)} onSaved={() => void load()} />}
      {log && (
        <Sheet title={`Lauf vom ${new Date(log.run.startedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`} onClose={() => setLog(null)} full>
          <ul className="facts">
            {STAT_LABELS.filter(([k]) => log.run.stats?.[k]).map(([k, l]) => (
              <li key={k}>
                <span className="facts__k">{l}</span>
                <span className="facts__v">{log.run.stats[k]}</span>
              </li>
            ))}
          </ul>
          <h3 className="section-title">Protokoll</h3>
          <pre className="log">{log.text ?? 'wird geladen …'}</pre>
        </Sheet>
      )}
    </SubPage>
  );
}
