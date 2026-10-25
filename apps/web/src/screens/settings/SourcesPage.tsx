// Quellen & Läufe: wo eingesammelt wird, was schiefging, was der Grobfilter aussortiert hat.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GATE_TERMS,
  formatDateDe,
  INSTITUTION_KIND_LABELS,
  JOB_KIND_LABELS,
  normalizeText,
  siteLabel,
  type Gate,
  type Institution,
  type InstitutionKind,
  type RunInfo,
  type Source,
  type SourceKind,
  type SourceStatus,
} from '@stellen/core';
import type { CheckResult, CheckVerdict, Discovery, GateSkip, SourceCheck, SourcesData } from '../../data/backend';
import { useAppState, useStore } from '../../data/hooks';
import { methodLabel, plural, relativeTime } from '../../lib/format';
import { takeIntent } from '../../lib/intent';
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
  ['neueWebsites', 'davon von neuen Websites'],
  ['erkundet', 'über die Erkundung (Ziel: mindestens 3)'],
  ['neuHorizont', 'neu im Horizont'],
  ['neuWeite', 'neu in der Weite'],
  ['aktualisiert', 'aktualisiert'],
  ['abgelaufen', 'abgelaufen'],
  ['grobfilter', 'vom Grobfilter aussortiert'],
  ['kiNein', 'von der KI aussortiert (passt nicht)'],
  ['fristKiPruefung', 'Fristen von der KI nachgeprüft'],
  ['fristUnsicher', 'Fristen unsicher'],
  ['probelaeufe', 'Probeläufe für neue Quellen'],
  ['dubletten', 'Dubletten zusammengeführt'],
  ['browserNeu', 'per Browser gefunden'],
  ['browserVervollstaendigt', 'per Browser vervollständigt'],
  ['fehlerDetail', 'Anzeigen nicht lesbar'],
  ['quelle_fehler', 'Quellen mit Fehler'],
  ['robots', 'durch robots.txt gesperrt'],
  ['erinnerungen', 'Fristen-Erinnerungen verschickt'],
  ['benachrichtigtNeu', 'neue, sehr gut passende Anzeigen gemeldet'],
  ['ki', 'KI-Aufrufe'],
];

type Tab = 'quellen' | 'neu' | 'aussortiert' | 'laeufe';

const VERDICT_LABEL: Record<CheckVerdict, string> = { gut: 'gut geeignet', mit_einschraenkungen: 'mit Einschränkungen', ungeeignet: 'ungeeignet' };
const CHECK_STATUS: Record<SourceCheck['status'], string> = {
  wartet: 'wartet',
  laeuft: 'läuft',
  fertig: 'fertig',
  fehler: 'Fehler',
  uebernommen: 'übernommen',
  verworfen: 'verworfen',
};
type SourceFilter = 'probleme' | 'ohne' | 'alle';

function isProblem(src: Source): boolean {
  return src.enabled && (src.status === 'fehler' || src.status === 'blockiert' || src.status === 'warnung');
}

function runSummary(r: RunInfo): string {
  const st = r.stats ?? {};
  const parts = [`${st.neu ?? 0} neu`];
  if (st.neueWebsites) parts.push(`${st.neueWebsites} von neuen Websites`);
  if (st.neuHorizont || st.neuWeite) parts.push(`${(st.neuHorizont ?? 0) + (st.neuWeite ?? 0)} im Horizont`);
  parts.push(`${st.aktualisiert ?? 0} aktualisiert`);
  if (st.grobfilter || st.kiNein) parts.push(`${(st.grobfilter ?? 0) + (st.kiNein ?? 0)} aussortiert`);
  if (st.quelle_fehler) parts.push(`${st.quelle_fehler} Quellen mit Fehler`);
  return parts.join(', ');
}

function SourceSheet({ src, inst, onClose, onSaved, onRecheck }: { src: Source; inst?: Institution; onClose: () => void; onSaved: () => void; onRecheck: () => void }) {
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
            <span className="facts__v">{src.methodsUsed.map(methodLabel).join(', ')}</span>
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
            <small className="hint">Wirkt nur, wenn die Pipeline die robots.txt beachtet (ROBOTS=1). Standard ist: Sperren gelten nicht, Abstand und Crawl-delay schon.</small>
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
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          Speichern
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Abbrechen
        </button>
        {src.url && (
          <button type="button" className="btn btn--quiet" onClick={onRecheck}>
            Probelauf wiederholen
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Einrichtung wählen oder neu anlegen (vorausgefüllt aus dem Probelauf). */
function InstitutionPicker({
  chosenId,
  setChosenId,
  draft,
  setDraft,
}: {
  chosenId: string | null;
  setChosenId: (id: string | null) => void;
  draft: { name: string; cityId: string; kind: InstitutionKind; website: string };
  setDraft: (d: { name: string; cityId: string; kind: InstitutionKind; website: string }) => void;
}) {
  const s = useAppState();
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return [];
    return [...s.institutions.values()].filter((i) => normalizeText(`${i.name} ${i.shortName ?? ''}`).includes(n)).slice(0, 8);
  }, [q, s.institutions]);
  const cities = useMemo(() => [...s.cities.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')), [s.cities]);
  const chosen = chosenId ? s.institutions.get(chosenId) : undefined;
  if (chosen) {
    return (
      <div className="field">
        <span>Einrichtung</span>
        <p style={{ margin: 0 }}>
          <b>{chosen.name}</b>{' '}
          <button type="button" className="btn btn--quiet btn--small" onClick={() => setChosenId(null)}>
            ändern
          </button>
        </p>
      </div>
    );
  }
  return (
    <div className="field">
      <span>Einrichtung</span>
      <label className="search" style={{ display: 'block' }}>
        <span className="visually-hidden">Vorhandene Einrichtung suchen</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vorhandene Einrichtung suchen" />
      </label>
      {hits.length > 0 && (
        <ul className="list">
          {hits.map((i) => (
            <li key={i.id} className="pick">
              <button type="button" className="pick__btn" onClick={() => setChosenId(i.id)}>
                <span>
                  {i.name} <small>{s.cities.get(i.cityId ?? '')?.name}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint" style={{ margin: '8px 0 4px' }}>
        Oder neu anlegen:
      </p>
      <label className="field">
        <span>Name</span>
        <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Stadt</span>
        <select className="select" value={draft.cityId} onChange={(e) => setDraft({ ...draft, cityId: e.target.value })}>
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
        <select className="select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as InstitutionKind })}>
          {(Object.keys(INSTITUTION_KIND_LABELS) as InstitutionKind[]).map((k) => (
            <option key={k} value={k}>
              {INSTITUTION_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function CheckResultView({ r }: { r: CheckResult }) {
  const complete = r.samples.filter((x) => x.complete).length;
  return (
    <div className="check">
      <p className={`verdict verdict--${r.verdict}`}>Quelle {VERDICT_LABEL[r.verdict]}</p>
      {r.ai && (
        <div className="ai-note">
          <b>KI-Urteil: {VERDICT_LABEL[r.ai.verdict]}</b>
          {r.ai.summary}
        </div>
      )}
      <ul className="facts" style={{ marginTop: 12 }}>
        <li>
          <span className="facts__k">Gefunden</span>
          <span className="facts__v">
            {plural(r.candidates, 'Anzeige', 'Anzeigen')}
            {r.methods.length ? ` über ${r.methods.map(methodLabel).join(', ')}` : ''}
          </span>
        </li>
        {r.listUrl !== r.url && (
          <li>
            <span className="facts__k">Stellenliste</span>
            <a className="facts__v" href={r.listUrl} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>
              {r.listUrl.replace(/^https?:\/\//, '')}
            </a>
          </li>
        )}
        <li>
          <span className="facts__k">Probe</span>
          <span className="facts__v">
            {complete} von {r.samples.length} Anzeigen vollständig gelesen
          </span>
        </li>
        {(r.config.render || r.config.linkPattern) && (
          <li>
            <span className="facts__k">Einstellungen</span>
            <span className="facts__v">
              {[r.config.render ? 'im Browser öffnen' : null, r.config.linkPattern ? `Linkmuster ${r.config.linkPattern}` : null].filter(Boolean).join(', ')}
            </span>
          </li>
        )}
      </ul>
      {r.notes.length > 0 && (
        <ul className="check__notes">
          {r.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {r.samples.length > 0 && <h3 className="section-title">Probe-Anzeigen</h3>}
      <ul className="check__samples">
        {r.samples.map((x) => (
          <li key={x.url} className="check-sample">
            <a href={x.url} target="_blank" rel="noopener noreferrer" className="check-sample__title">
              {x.title}
            </a>
            <p className="check-sample__facts">
              {[x.kind && x.kind !== 'sonstige' ? JOB_KIND_LABELS[x.kind] : null, x.deadline ? `Frist ${formatDateDe(x.deadline)}${x.deadlineCheck === 'unsicher' ? ' (unsicher)' : ''}` : 'ohne Frist', x.payGrade, x.workload, `${x.chars} Zeichen`]
                .filter(Boolean)
                .join(', ')}
            </p>
            {x.excerpt && <p className="check-sample__excerpt print">{x.excerpt}</p>}
            {(!x.complete || x.aiOk === false || x.problems.length > 0) && (
              <p className="check-sample__problems">
                {x.aiOk === false ? 'Laut KI keine einzelne Anzeige. ' : ''}
                {x.problems.join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Website hinzufügen mit Probelauf: Adresse eingeben → die Pipeline liest die Seite und ein paar Anzeigen,
 * die KI beurteilt das Ergebnis → erst nach deiner Bestätigung kommt die Quelle ins Register.
 */
function CheckSheet({ initialUrl, sourceId, check: initialCheck, onClose, onChanged }: { initialUrl?: string; sourceId?: string; check?: SourceCheck; onClose: () => void; onChanged: () => void }) {
  const s = useAppState();
  const store = useStore();
  const [url, setUrl] = useState(initialCheck?.url ?? initialUrl ?? '');
  const [check, setCheck] = useState<SourceCheck | null>(initialCheck ?? null);
  const [started, setStarted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [instId, setInstId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', cityId: '', kind: 'sonstige' as InstitutionKind, website: '' });
  const [kind, setKind] = useState<SourceKind>('zentral');
  const [gate, setGate] = useState<Gate>('psych');
  const [label, setLabel] = useState('');
  const prefilled = useRef<number | null>(null);

  // Ergebnis abholen, solange der Probelauf läuft
  useEffect(() => {
    if (!check || !(check.status === 'wartet' || check.status === 'laeuft')) return;
    const t = window.setInterval(
      () => {
        if (document.visibilityState !== 'visible') return;
        void store.api.getCheck(check.id).then(setCheck, () => undefined);
      },
      s.demo ? 1000 : 5000,
    );
    return () => window.clearInterval(t);
  }, [check, store, s.demo]);

  // Formular einmal mit dem Ergebnis vorausfüllen
  useEffect(() => {
    const r = check?.result;
    if (!r || prefilled.current === check.id) return;
    prefilled.current = check.id;
    setInstId(r.institution.id && s.institutions.has(r.institution.id) ? r.institution.id : null);
    setDraft({ name: r.institution.name ?? '', cityId: r.institution.cityId ?? '', kind: r.institution.kind ?? 'sonstige', website: r.institution.website ?? '' });
    setKind(r.kindGuess);
    setGate(r.gateGuess);
  }, [check, s.institutions]);

  const start = async () => {
    const u = url.trim();
    if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(u)) return setMsg('Bitte die vollständige Adresse eingeben, mit https://.');
    setBusy(true);
    setMsg(null);
    try {
      const r = await store.api.checkSource(u, sourceId);
      setCheck(r.check);
      setStarted(r.started);
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!check?.result) return;
    if (kind !== 'portal' && !instId && (!draft.name.trim() || !draft.cityId)) return setMsg('Bitte eine Einrichtung wählen oder Name und Stadt angeben.');
    setBusy(true);
    setMsg(null);
    try {
      await store.api.acceptCheck(check.id, {
        kind,
        gate,
        label: label.trim() || undefined,
        ...(kind === 'portal' ? {} : instId ? { institutionId: instId } : { institution: { name: draft.name.trim(), cityId: draft.cityId, kind: draft.kind, website: draft.website || undefined } }),
      });
      store.toast(sourceId ? 'Quelle aktualisiert. Der nächste Lauf nutzt die geprüften Einstellungen.' : 'Quelle übernommen. Sie wird beim nächsten Lauf eingesammelt.');
      onChanged();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (check) await store.api.discardCheck(check.id).catch(() => undefined);
    onChanged();
    onClose();
  };

  const running = check && (check.status === 'wartet' || check.status === 'laeuft');
  const r = check?.status === 'fertig' ? check.result : null;

  return (
    <Sheet title={sourceId ? 'Probelauf wiederholen' : 'Website hinzufügen'} onClose={onClose} full>
      {!check && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Gib die Seite mit den Stellenanzeigen ein (oder einfach die Startseite). Ein Probelauf liest die Seite und ein paar Anzeigen, die KI prüft, ob alles sauber ankommt. Ins Register kommt die Quelle erst, wenn du das Ergebnis übernimmst.
          </p>
          <label className="field">
            <span>Adresse</span>
            <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/stellenangebote" autoFocus />
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void start()}>
              Probelauf starten
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Abbrechen
            </button>
          </div>
        </>
      )}

      {running && (
        <div className="check-wait" aria-live="polite">
          <span className="check-wait__dot" aria-hidden="true" />
          <div>
            <b>Probelauf {check.status === 'wartet' ? 'wartet' : 'läuft'}: </b>
            {check.url.replace(/^https?:\/\//, '')}
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {s.demo
                ? 'In der Demo ist das nur nachgestellt und gleich fertig.'
                : started
                  ? 'Das dauert meist zwei bis vier Minuten. Du kannst das Blatt schließen; das Ergebnis steht dann unter Quellen.'
                  : 'Ohne GitHub-Token im Worker startet der Probelauf mit dem nächsten Einsammeln (täglich gegen 12 Uhr). Das Ergebnis steht dann unter Quellen.'}
            </p>
          </div>
        </div>
      )}

      {check?.status === 'fehler' && (
        <p className="notice notice--warn" role="alert">
          Der Probelauf ist fehlgeschlagen: {check.error ?? 'unbekannter Fehler'}
        </p>
      )}

      {r && (
        <>
          <CheckResultView r={r} />
          {r.registered && (
            <p className="notice notice--info" style={{ marginTop: 12 }}>
              Diese Website steht schon im Register{r.registered.label ? ` („${r.registered.label}“)` : ''}
              {r.registered.url ? `: ${r.registered.url.replace(/^https?:\/\//, '')}` : ''}. Übernehmen legt trotzdem eine weitere Quelle an.
            </p>
          )}
          <h3 className="section-title">Übernehmen als</h3>
          {!sourceId && (
            <>
              <div className="field">
                <span>Art</span>
                <div className="segmented" role="group" aria-label="Art der Quelle">
                  {(['fachbereich', 'zentral', 'portal'] as SourceKind[]).map((k) => (
                    <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                      {k === 'fachbereich' ? 'Fachbereich' : k === 'zentral' ? 'Zentrale Börse' : 'Portal'}
                    </button>
                  ))}
                </div>
              </div>
              {kind !== 'portal' && <InstitutionPicker chosenId={instId} setChosenId={setInstId} draft={draft} setDraft={setDraft} />}
              <label className="field">
                <span>Bezeichnung (optional)</span>
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Institut für Psychologie" />
              </label>
            </>
          )}
          <div className="field">
            <span>Was übernehmen?</span>
            <div className="segmented" role="group" aria-label="Grobfilter für diese Quelle">
              <button type="button" aria-pressed={gate === 'none'} onClick={() => setGate('none')}>
                alle Anzeigen
              </button>
              <button type="button" aria-pressed={gate === 'psych'} onClick={() => setGate('psych')}>
                Psychologie-Bezug und Horizont
              </button>
            </div>
            <small className="hint">Fachbereichs-Seiten nehmen alles. Breite Seiten laufen durch Grobfilter, Brücken und Weite.</small>
          </div>
        </>
      )}

      {msg && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 12 }}>
          {msg}
        </p>
      )}

      {check && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {r && (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void accept()}>
              {sourceId ? 'Einstellungen übernehmen' : 'Als Quelle übernehmen'}
            </button>
          )}
          {(r || check.status === 'fehler') && (
            <button type="button" className="btn" disabled={busy} onClick={() => void discard()}>
              Verwerfen
            </button>
          )}
          {running && (
            <button type="button" className="btn" onClick={onClose}>
              Schließen
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function DiscoveryItem({ d, onCheck, onIgnore }: { d: Discovery; onCheck: () => void; onIgnore: () => void }) {
  const isSite = !d.siteKey.startsWith('arbeitgeber:');
  return (
    <li className="suggestion">
      <b>{d.name ?? siteLabel(d.siteKey)}</b>
      {isSite ? <span className="suggestion__url">{siteLabel(d.siteKey)}</span> : <span className="hint">Arbeitgeber aus einer Jobbörse, Website noch unbekannt</span>}
      <small className="hint">
        {plural(d.jobs, 'Anzeige', 'Anzeigen')} gefunden, zuletzt {relativeTime(d.lastSeenAt)}
      </small>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        {isSite && (
          <button type="button" className="btn btn--small btn--primary" onClick={onCheck}>
            Als Quelle prüfen
          </button>
        )}
        <button type="button" className="btn btn--small" onClick={onIgnore}>
          Nicht aufnehmen
        </button>
        {d.sampleUrl && (
          <a className="btn btn--small btn--quiet" href={d.sampleUrl} target="_blank" rel="noopener noreferrer">
            Anzeige ansehen
          </a>
        )}
      </div>
    </li>
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
  const [checkSheet, setCheckSheet] = useState<{ url?: string; sourceId?: string; check?: SourceCheck } | null>(() => {
    const url = takeIntent('checkUrl');
    return url ? { url } : null;
  });
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

  // Die Erkundung ist eine interne Quelle; sie steht oben im Lauf, nicht in der Liste.
  const sources = (data?.sources ?? []).filter((x) => x.adapter !== 'erkundung');
  const problems = sources.filter(isProblem);
  const openChecks = (data?.checks ?? []).filter((c) => c.status !== 'uebernommen' && c.status !== 'verworfen');
  const discoveries = data?.discoveries ?? [];
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
  const explore = lastRun?.stats ?? {};

  const trigger = async () => {
    setTriggering(true);
    try {
      await store.api.triggerIngest();
      store.toast('Einsammeln gestartet. Das dauert etwa 15 bis 30 Minuten.');
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
            {explore.erkundungZiel != null && (
              <p className={explore.erkundungFehlt ? 'notice notice--warn' : 'hint'} style={{ marginTop: 4 }}>
                Blinde Flecken: {plural(explore.erkundet ?? 0, 'Anzeige', 'Anzeigen')} von Websites außerhalb des Registers über die Erkundung
                {explore.erkundungFehlt ? `, ${explore.erkundungFehlt} weniger als das Ziel von ${explore.erkundungZiel}. Das Protokoll unter „Läufe“ zeigt, woran es lag.` : ` (Ziel: mindestens ${explore.erkundungZiel}).`}
              </p>
            )}
          </>
        ) : (
          <p className="hint">
            {s.demo
              ? 'In der Demo wird nicht eingesammelt. Die Quellenliste ist trotzdem die echte Startliste.'
              : 'Noch kein Lauf. Die Pipeline läuft täglich gegen 12 Uhr über GitHub Actions und bringt jedes Mal mindestens drei Anzeigen von Websites, die noch nicht im Register stehen.'}
          </p>
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
            ['neu', `Neu${data && discoveries.length + data.suggestions.length ? ` (${discoveries.length + data.suggestions.length})` : ''}`],
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0 4px' }}>
            <button type="button" className="btn btn--small btn--primary" onClick={() => setCheckSheet({})}>
              <IconPlus width={18} height={18} /> Website hinzufügen
            </button>
          </div>
          {openChecks.length > 0 && (
            <div className="checks">
              <h3 className="section-title" style={{ marginTop: 10 }}>
                Probeläufe
              </h3>
              <ul className="list">
                {openChecks.map((c) => (
                  <li key={c.id} className="row row--source" tabIndex={0} onClick={() => setCheckSheet({ check: c, sourceId: c.sourceId ?? undefined })} onKeyDown={(e) => e.key === 'Enter' && setCheckSheet({ check: c, sourceId: c.sourceId ?? undefined })}>
                    <div className="row__main">
                      <p className="row__title">{c.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
                      <p className="row__sub">
                        {c.result ? `${VERDICT_LABEL[c.result.verdict]}, ${plural(c.result.candidates, 'Anzeige', 'Anzeigen')}` : c.status === 'fehler' ? (c.error ?? 'Fehler') : `angefragt ${relativeTime(c.requestedAt)}`}
                      </p>
                    </div>
                    <div className="row__meta">
                      <span className={`status status--${c.status === 'fertig' ? 'ok' : c.status === 'fehler' ? 'fehler' : 'neu'}`}>{c.status === 'fertig' ? 'Ergebnis ansehen' : CHECK_STATUS[c.status]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          <GateEditor />
        </>
      )}

      {tab === 'neu' && (
        <>
          <h3 className="section-title" style={{ marginTop: 14 }}>
            Neue Websites
          </h3>
          <p className="hint">
            Jeder Lauf sucht gezielt nach Anzeigen von Websites und Arbeitgebern, die noch nicht im Register stehen, damit keine blinden Flecken bleiben. Was dabei auffällt, steht hier. „Als Quelle prüfen“ startet einen Probelauf mit KI.
          </p>
          {discoveries.length === 0 ? (
            <p className="hint">Gerade nichts Neues.</p>
          ) : (
            <ul className="list">
              {discoveries.map((d) => (
                <DiscoveryItem
                  key={d.siteKey}
                  d={d}
                  onCheck={() => setCheckSheet({ url: d.sampleUrl ? `${new URL(d.sampleUrl).origin}/` : `https://${siteLabel(d.siteKey)}/` })}
                  onIgnore={async () => {
                    await store.api.setDiscoveryStatus(d.siteKey, 'ignoriert');
                    store.toast('Wird nicht mehr vorgeschlagen.');
                    void load();
                  }}
                />
              ))}
            </ul>
          )}

          <h3 className="section-title">Gefundene Stellenseiten</h3>
          <p className="hint">Für Einrichtungen ohne Adresse sucht die Pipeline selbst nach der Stellenseite. Übernommen wird erst, was du bestätigst.</p>
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
            Diese Anzeigen stammen aus breiten Quellen: ohne Begriff aus dem Grobfilter und ohne passende Brücke, oder die KI hat sie als fremd eingeschätzt. Ist etwas Passendes dabei, den fehlenden Begriff im Grobfilter oder eine Brücke im Horizont ergänzen: Beim nächsten Lauf wird neu geprüft.
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
                    {k.reason === 'ki-nein' ? ', KI: passt nicht' : ''}
                  </small>
                  {k.reason === 'ki-nein' && k.note && <small className="skip__note">{k.note}</small>}
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

      {edit && (
        <SourceSheet
          src={edit}
          inst={edit.institutionId ? s.institutions.get(edit.institutionId) : undefined}
          onClose={() => setEdit(null)}
          onSaved={() => void load()}
          onRecheck={() => {
            setCheckSheet({ url: edit.url ?? undefined, sourceId: edit.id });
            setEdit(null);
          }}
        />
      )}
      {checkSheet && <CheckSheet initialUrl={checkSheet.url} sourceId={checkSheet.sourceId} check={checkSheet.check} onClose={() => setCheckSheet(null)} onChanged={() => void load()} />}
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
