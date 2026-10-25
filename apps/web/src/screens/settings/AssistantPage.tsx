// KI-Assistent: Gespräch mit der KI über Anzeigen, Profil und Brücken (Mini-Harness).
// Die KI recherchiert mit Werkzeugen in den Daten der App; Änderungen schlägt sie nur vor.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  applyFilterProposal,
  ASSISTANT_PRESETS,
  assistantSystemPrompt,
  buildUserContent,
  DAILY_HINT_EUR,
  DEFAULT_FILTER,
  EUR_PER_USD,
  formatDateDe,
  runAssistantLoop,
  toWire,
  type AssistantPreset,
  type KiUsageReport,
} from '@stellen/core';
import { useAppState, useGeo, useStore, useViews } from '../../data/hooks';
import {
  applyProposal,
  createToolbox,
  describeProfileChanges,
  filterText,
  homeForAi,
  loadConversation,
  newConversation,
  proposalTitle,
  saveConversation,
  testBridge,
  turnContext,
  type ChatEntry,
  type Conversation,
  type Snapshot,
} from '../../lib/assistant';
import { takeIntent } from '../../lib/intent';
import { renderMarkdown } from '../../lib/markdown';
import { openJob } from '../../lib/router';
import { IconSpark } from '../../ui/icons';
import { SubPage } from './Settings';

const MONTH = new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'Europe/Berlin' });

function eur(usd: number): string {
  const e = usd * EUR_PER_USD;
  if (e > 0 && e < 0.01) return '< 0,01 €';
  return `≈ ${e.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function UsageBox({ usage, heuteUsd }: { usage: KiUsageReport | null; heuteUsd: number | null }) {
  const [open, setOpen] = useState(false);
  const heute = Math.max(heuteUsd ?? 0, usage?.heuteUsd ?? 0);
  if (!usage && heuteUsd == null) return null;
  const g = usage?.guthaben;
  return (
    <div className="ki-usage">
      <p className="ki-usage__line">
        <span>Heute {eur(heute)}</span>
        {usage && (
          <span>
            {MONTH.format(new Date())} {eur(Math.max(usage.monatUsd, heute))}
          </span>
        )}
        {g && (
          <span>
            Guthaben bei DeepSeek {g.betrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {g.waehrung === 'USD' ? '$' : g.waehrung}
          </span>
        )}
        {usage && usage.tage.length > 0 && (
          <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
            {open ? 'weniger' : 'pro Tag'}
          </button>
        )}
      </p>
      {open && usage && (
        <ul className="ki-usage__days">
          {usage.tage.slice(0, 21).map((t) => (
            <li key={t.tag}>
              <span>{formatDateDe(t.tag)}</span>
              <span>{eur(t.appUsd + t.einsammelnUsd)}</span>
              <small>
                App {eur(t.appUsd)}, Einsammeln {eur(t.einsammelnUsd)}
              </small>
            </li>
          ))}
        </ul>
      )}
      {heute * EUR_PER_USD > DAILY_HINT_EUR && (
        <p className="notice notice--warn">
          Heute schon {eur(heute)} für die KI (Gespräche und Einsammeln). Nur ein Hinweis, gesperrt wird nichts.
        </p>
      )}
      {g && !g.verfuegbar && <p className="notice notice--warn">Das Guthaben bei DeepSeek reicht nicht mehr für Anfragen. Aufladen unter platform.deepseek.com.</p>}
    </div>
  );
}

function Answer({ entry }: { entry: ChatEntry }) {
  const html = useMemo(() => renderMarkdown(entry.content ?? ''), [entry.content]);
  return (
    <div className="ki-a">
      <p className="ki-a__head">
        <IconSpark width={16} height={16} /> KI{entry.sekunden ? <small> · {entry.sekunden} s</small> : null}
      </p>
      <div className="ki-a__body" dangerouslySetInnerHTML={{ __html: html }} />
      {entry.reasoning_content && (
        <details className="ki-a__thoughts">
          <summary>Gedankengang</summary>
          <p>{entry.reasoning_content}</p>
        </details>
      )}
    </div>
  );
}

function JobLink({ id, snap }: { id: string; snap: Snapshot }) {
  const v = snap.views.get(id);
  if (!v) return <span>Anzeige gibt es nicht mehr</span>;
  return (
    <button type="button" className="linkish" onClick={() => openJob(id)}>
      {v.job.title}
    </button>
  );
}

function ProposalCard({ entry, status, snap, onDecide }: { entry: ChatEntry; status: string; snap: Snapshot; onDecide: (accept: boolean) => void }) {
  const d = entry.vorschlag!.daten;
  const bridgeTest = useMemo(() => (d.art === 'bruecke' ? testBridge(d.feld, d.anker ?? [], snap) : null), [d, snap]);
  let body: ReactNode = null;
  switch (d.art) {
    case 'markierung':
      body = (
        <p className="ki-card__line">
          <JobLink id={d.id} snap={snap} />
        </p>
      );
      break;
    case 'notiz':
      body = (
        <>
          <p className="ki-card__line">
            <JobLink id={d.id} snap={snap} />
          </p>
          <p className="ki-card__note">{d.text}</p>
        </>
      );
      break;
    case 'bruecke':
      body = (
        <>
          <p className="bridge__terms">Feld: {d.feld.join(', ')}</p>
          <p className="bridge__terms">Anknüpfung: {d.anker?.length ? d.anker.join(', ') : 'Standard (Menschen, Verhalten, Empirie)'}</p>
          {d.suche?.length ? <p className="bridge__terms">Suche: {d.suche.join(', ')}</p> : null}
          <p className="bridge__why">{d.warum}</p>
          {bridgeTest && (
            <p className="bridge__meta">
              passt gerade auf {bridgeTest.treffer} offene Anzeige{bridgeTest.treffer === 1 ? '' : 'n'}, davon {bridgeTest.ausserhalb_kern} außerhalb des Kerns
            </p>
          )}
        </>
      );
      break;
    case 'profil':
      body = (
        <ul className="ki-card__changes">
          {describeProfileChanges(d, snap.s.settings.profile).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      );
      break;
    case 'filter':
      body = <p className="ki-card__line">Danach: {filterText(applyFilterProposal(snap.s.settings.filter, DEFAULT_FILTER, d))}</p>;
      break;
  }
  return (
    <div className={`ki-card ki-card--${status}`}>
      <p className="ki-card__kicker">Vorschlag der KI</p>
      <p className="ki-card__title">{proposalTitle(d, snap)}</p>
      {body}
      {d.begruendung && <p className="ki-card__why">{d.begruendung}</p>}
      {status === 'offen' ? (
        <div className="ki-card__actions">
          <button type="button" className="btn btn--small btn--primary" onClick={() => onDecide(true)}>
            Übernehmen
          </button>
          <button type="button" className="btn btn--small btn--quiet" onClick={() => onDecide(false)}>
            Nein danke
          </button>
        </div>
      ) : (
        <p className="ki-card__status">{status === 'uebernommen' ? '✓ übernommen' : 'abgelehnt'}</p>
      )}
    </div>
  );
}

/** Nachrichten in Lesefolge: Fragen, Arbeitsschritte (zusammengefasst), Vorschläge, Antworten. */
function Entries({ conv, snap, onDecide }: { conv: Conversation; snap: Snapshot; onDecide: (id: string, accept: boolean) => void }) {
  const out: ReactNode[] = [];
  let steps: string[] = [];
  const flush = (key: string) => {
    if (!steps.length) return;
    out.push(
      <ul className="ki-steps" key={`s${key}`} aria-label="Arbeitsschritte der KI">
        {steps.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>,
    );
    steps = [];
  };
  conv.entries.forEach((e, i) => {
    if (e.role === 'user') {
      flush(String(i));
      out.push(
        <div className="ki-q" key={i}>
          {e.frage ?? e.content}
        </div>,
      );
    } else if (e.role === 'assistant') {
      if (e.tool_calls?.length) {
        if (e.content?.trim()) steps.push(e.content.trim());
      } else if (e.content?.trim()) {
        flush(String(i));
        out.push(<Answer key={i} entry={e} />);
      }
    } else if (e.role === 'tool') {
      if (e.vorschlag) {
        flush(String(i));
        const id = e.vorschlag.id;
        out.push(<ProposalCard key={i} entry={e} status={conv.status[id] ?? 'offen'} snap={snap} onDecide={(accept) => onDecide(id, accept)} />);
      } else if (e.info) steps.push(e.info);
    }
  });
  flush('end');
  return <>{out}</>;
}

function Busy({ since, onStop }: { since: number; onStop: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const sec = Math.round((Date.now() - since) / 1000);
  return (
    <div className="ki-busy" role="status">
      <IconSpark className="ki-busy__icon" width={20} height={20} />
      <span>
        Die KI recherchiert und denkt gründlich nach … {sec} s
        {sec > 20 && <small className="hint"> Das dauert oft ein bis drei Minuten, bei großen Recherchen länger.</small>}
      </span>
      <button type="button" className="btn btn--small btn--quiet" onClick={onStop}>
        Stopp
      </button>
    </div>
  );
}

export function AssistantPage() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const geo = useGeo();
  const snap: Snapshot = useMemo(() => ({ s, views, geo }), [s, views, geo]);
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const convRef = useRef<Conversation | null>(null);
  const [conv, setConvState] = useState<Conversation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const setConv = (fn: (c: Conversation | null) => Conversation | null) => {
    convRef.current = fn(convRef.current);
    setConvState(convRef.current);
    saveConversation(convRef.current);
  };

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<{ since: number; ctrl: AbortController } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<KiUsageReport | null>(null);
  const [heuteUsd, setHeuteUsd] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const available = !s.demo && s.aiSuggest;

  useEffect(() => {
    const jobId = takeIntent('kiAnzeige');
    const thema = takeIntent('kiThema');
    void loadConversation().then((saved) => {
      // Aus einer Anzeige oder dem Horizont: neues Gespräch (das alte bleibt gespeichert, bis die erste Frage gestellt ist)
      convRef.current = jobId || thema ? newConversation(jobId, thema === 'horizont' ? 'horizont' : null) : saved;
      setConvState(convRef.current);
      setLoaded(true);
    });
    if (available) void store.api.kiUsage().then(setUsage).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = conv?.entries.length ?? 0;
  useEffect(() => {
    if (busy) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [count, busy]);

  const run = async () => {
    const start = convRef.current;
    if (!start || running.current) return;
    running.current = true;
    const ctrl = new AbortController();
    setBusy({ since: Date.now(), ctrl });
    setError(null);
    const tools = createToolbox(() => snapRef.current, start.entries);
    let stepStart = Date.now();
    try {
      await runAssistantLoop<ChatEntry>({
        messages: start.entries,
        maxSteps: 12,
        signal: ctrl.signal,
        step: async (msgs, final) => {
          stepStart = Date.now();
          const { s: st } = snapRef.current;
          const system = { role: 'system' as const, content: assistantSystemPrompt(st.settings.profile, homeForAi(st)) };
          const r = await store.api.assistantStep([system, ...msgs.map(toWire)], final, ctrl.signal);
          setHeuteUsd(r.heuteUsd);
          return r.message;
        },
        wrap: (m) => ({ ...m, sekunden: Math.round((Date.now() - stepStart) / 1000) }),
        execute: (call) => tools.execute(call),
        onUpdate: (msgs) => setConv((c) => (c ? { ...c, entries: msgs } : c)),
      });
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      running.current = false;
      setBusy(null);
      void store.api
        .kiUsage()
        .then(setUsage)
        .catch(() => undefined);
    }
  };

  const ask = (frage: string, preset?: AssistantPreset) => {
    const q = frage.trim();
    if (!q || running.current) return;
    const base = convRef.current ?? newConversation();
    const first = !base.entries.some((e) => e.role === 'user');
    const content = buildUserContent(q, turnContext(snapRef.current, base, first), preset?.anweisung);
    setConv(() => ({ ...base, entries: [...base.entries, { role: 'user', content, frage: q }], entscheidungen: [] }));
    setInput('');
    void run();
  };

  const decide = (id: string, accept: boolean) => {
    const c = convRef.current;
    const e = c?.entries.find((x) => x.vorschlag?.id === id);
    if (!c || !e?.vorschlag || (c.status[id] ?? 'offen') !== 'offen') return;
    let what = proposalTitle(e.vorschlag.daten, snapRef.current);
    if (accept) {
      try {
        what = applyProposal(store, e.vorschlag.daten);
      } catch (err) {
        store.toast(`Ging nicht: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }
    setConv((x) => (x ? { ...x, status: { ...x.status, [id]: accept ? 'uebernommen' : 'abgelehnt' }, entscheidungen: [...x.entscheidungen, `${id} ${accept ? 'übernommen' : 'abgelehnt'} (${what})`] } : x));
  };

  const asked = !!conv?.entries.some((e) => e.role === 'user');
  const last = conv?.entries[conv.entries.length - 1];
  const canRetry = !!error && !!last && !(last.role === 'assistant' && !last.tool_calls?.length);
  const fuer = conv?.jobId ? 'anzeige' : conv?.thema === 'horizont' ? 'horizont' : 'allgemein';
  const presets = ASSISTANT_PRESETS.filter((p) => p.fuer === fuer);
  const job = conv?.jobId ? views.get(conv.jobId) : undefined;

  return (
    <SubPage title="KI-Assistent" sub="Fragen zu Anzeigen, deinem Profil und deinen Brücken">
      {!available ? (
        <p className="notice notice--info">
          {s.demo ? 'In der Demo gibt es die KI nicht. In der eingerichteten App recherchiert sie hier in deinen Anzeigen.' : 'Für die KI braucht der Worker einen KI-Schlüssel (LLM_API_KEY), siehe docs/SCHLUESSEL.md.'}
        </p>
      ) : (
        <>
          <UsageBox usage={usage} heuteUsd={heuteUsd} />
          {(job || conv?.thema === 'horizont') && (
            <p className="ki-topic">
              {job ? (
                <>
                  Gespräch zur Anzeige <JobLink id={job.job.id} snap={snap} />
                </>
              ) : (
                'Gespräch über deinen Horizont und deine Brücken'
              )}
            </p>
          )}
          {!asked && loaded && (
            <>
              <p className="hint">
                Die KI recherchiert in allen Anzeigen der App, liest Volltexte und kennt dein Suchprofil. Sie nutzt das große Modell mit gründlichem Nachdenken, deshalb dauert eine Antwort meist ein bis drei Minuten. Ändern kann sie nichts: Was sie vorschlägt, übernimmst du selbst.
              </p>
              <div className="ki-presets">
                {presets.map((p) => (
                  <button key={p.id} type="button" className="btn btn--small" onClick={() => ask(p.frage, p)}>
                    {p.frage}
                  </button>
                ))}
              </div>
            </>
          )}

          {conv && (
            <div className="ki-chat">
              <Entries conv={conv} snap={snap} onDecide={decide} />
            </div>
          )}
          {busy && <Busy since={busy.since} onStop={() => busy.ctrl.abort()} />}
          {error && (
            <div className="notice notice--warn" role="alert" style={{ marginTop: 10 }}>
              {error}
              {canRetry && (
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn--small" onClick={() => void run()}>
                    Nochmal versuchen
                  </button>
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />

          <form
            className="ki-composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <label className="visually-hidden" htmlFor="ki-input">
              Frage an die KI
            </label>
            <textarea
              id="ki-input"
              className="input"
              rows={3}
              value={input}
              disabled={!!busy}
              placeholder={asked ? 'Nachfragen …' : 'Frag etwas zu Anzeigen, deinem Profil oder deinen Brücken …'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  ask(input);
                }
              }}
            />
            <div className="ki-composer__actions">
              <button type="submit" className="btn btn--primary" disabled={!!busy || !input.trim()}>
                <IconSpark width={18} height={18} /> Fragen
              </button>
              {asked && !busy && (
                <button
                  type="button"
                  className="btn btn--small btn--quiet"
                  onClick={() => {
                    setConv(() => null);
                    convRef.current = newConversation();
                    setConvState(convRef.current);
                    setError(null);
                  }}
                >
                  Neues Gespräch
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </SubPage>
  );
}
