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
  runAssistantLoop,
  todayBerlin,
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
import { fmtDate, lang, srForm, texts } from '../../i18n';
import { SubPage } from './Settings';

const t = texts({
  de: {
    title: 'KI-Assistent',
    sub: 'Fragen zu Anzeigen, deinem Profil und deinen Brücken',
    months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    today: 'Heute',
    balance: 'Guthaben bei DeepSeek',
    less: 'weniger',
    perDay: 'pro Tag',
    dayParts: (app: string, collecting: string) => `App ${app}, Einsammeln ${collecting}`,
    dailyHint: (sum: string) => `Heute schon ${sum} für die KI (Gespräche und Einsammeln). Nur ein Hinweis, gesperrt wird nichts.`,
    balanceLow: 'Das Guthaben bei DeepSeek reicht nicht mehr für Anfragen. Aufladen unter platform.deepseek.com.',
    ai: 'KI',
    reasoning: 'Gedankengang',
    jobGone: 'Anzeige gibt es nicht mehr',
    field: (terms: string) => `Feld: ${terms}`,
    link: (terms: string) => `Anknüpfung: ${terms}`,
    linkDefault: 'Standard (Menschen, Verhalten, Empirie)',
    search: (queries: string) => `Suche: ${queries}`,
    bridgeTest: (n: number, outside: number) => `passt gerade auf ${n} offene Anzeige${n === 1 ? '' : 'n'}, davon ${outside} außerhalb des Kerns`,
    filterAfter: (filter: string) => `Danach: ${filter}`,
    kicker: 'Vorschlag der KI',
    apply: 'Übernehmen',
    noThanks: 'Nein danke',
    applied: '✓ übernommen',
    declined: 'abgelehnt',
    stepsLabel: 'Arbeitsschritte der KI',
    busy: (sec: number) => `Die KI recherchiert und denkt gründlich nach … ${sec} s`,
    busyLong: ' Das dauert oft ein bis drei Minuten, bei großen Recherchen länger.',
    stop: 'Stopp',
    noDemo: 'In der Demo gibt es die KI nicht. In der eingerichteten App recherchiert sie hier in deinen Anzeigen.',
    noKey: 'Für die KI braucht der Worker einen KI-Schlüssel (LLM_API_KEY), siehe docs/SCHLUESSEL.md.',
    aboutJob: 'Gespräch zur Anzeige',
    aboutHorizon: 'Gespräch über deinen Horizont und deine Brücken',
    intro:
      'Die KI recherchiert in allen Anzeigen der App, liest Volltexte und kennt dein Suchprofil. Sie nutzt das große Modell mit gründlichem Nachdenken, deshalb dauert eine Antwort meist ein bis drei Minuten. Ändern kann sie nichts: Was sie vorschlägt, übernimmst du selbst.',
    retry: 'Nochmal versuchen',
    inputLabel: 'Frage an die KI',
    followUp: 'Nachfragen …',
    askPlaceholder: 'Frag etwas zu Anzeigen, deinem Profil oder deinen Brücken …',
    ask: 'Fragen',
    newChat: 'Neues Gespräch',
    failed: (msg: string) => `Ging nicht: ${msg}`,
    /** Vorgefertigte Fragen nach id; auf Deutsch gilt der Text aus dem Kern (ASSISTANT_PRESETS). */
    presets: {} as Record<string, string>,
  },
  en: {
    title: 'AI assistant',
    sub: 'Questions about postings, your profile and your bridges',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    today: 'Today',
    balance: 'DeepSeek balance',
    less: 'less',
    perDay: 'per day',
    dayParts: (app, collecting) => `App ${app}, collecting ${collecting}`,
    dailyHint: (sum) => `Already ${sum} on AI today (chats and collecting). Just a heads-up, nothing gets blocked.`,
    balanceLow: 'Your DeepSeek balance is too low for requests. Top it up at platform.deepseek.com.',
    ai: 'AI',
    reasoning: 'Reasoning',
    jobGone: 'This posting no longer exists',
    field: (terms) => `Field: ${terms}`,
    link: (terms) => `Link: ${terms}`,
    linkDefault: 'Default (people, behavior, empirical work)',
    search: (queries) => `Search: ${queries}`,
    bridgeTest: (n, outside) => `currently matches ${n} open ${n === 1 ? 'posting' : 'postings'}, ${outside} of them outside the core`,
    filterAfter: (filter) => `After applying: ${filter}`,
    kicker: 'AI suggestion',
    apply: 'Apply',
    noThanks: 'No thanks',
    applied: '✓ applied',
    declined: 'declined',
    stepsLabel: 'Steps the AI took',
    busy: (sec) => `The AI is researching and thinking it through… ${sec} s`,
    busyLong: ' This often takes one to three minutes, longer for bigger searches.',
    stop: 'Stop',
    noDemo: 'The AI isn’t available in the demo. In the full app, it searches your postings right here.',
    noKey: 'The AI needs an AI key (LLM_API_KEY) on the Worker, see docs/SCHLUESSEL.md.',
    aboutJob: 'Chat about the posting',
    aboutHorizon: 'Chat about your Horizon and your bridges',
    intro:
      'The AI searches all postings in the app, reads full texts and knows your search profile. It uses the large model with thorough reasoning, so an answer usually takes one to three minutes. It can’t change anything: you apply its suggestions yourself.',
    retry: 'Try again',
    inputLabel: 'Question for the AI',
    followUp: 'Ask a follow-up…',
    askPlaceholder: 'Ask something about postings, your profile or your bridges…',
    ask: 'Ask',
    newChat: 'New chat',
    failed: (msg) => `Didn’t work: ${msg}`,
    presets: {
      passt: 'Is this job a good fit for me?',
      dagegen: 'What are the downsides of this job?',
      bewerbung: 'What should I highlight in my application?',
      aehnlich: 'Are there similar jobs?',
      'bruecken-fehlen': 'Which bridges am I still missing?',
      'bruecken-schaerfen': 'Which of my bridges pull in the wrong postings?',
      woche: 'Any good new postings this week?',
      fristen: 'Which saved jobs have deadlines coming up?',
      vergleich: 'Compare my saved jobs.',
    },
  },
  sr: {
    title: 'AI asistent',
    sub: 'Pitanja o oglasima, tvom profilu i tvojim mostovima',
    months: ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'],
    today: 'Danas',
    balance: 'Stanje na DeepSeek nalogu',
    less: 'manje',
    perDay: 'po danu',
    dayParts: (app, collecting) => `Aplikacija ${app}, prikupljanje ${collecting}`,
    dailyHint: (sum) => `Danas je već potrošeno ${sum} na AI (razgovori i prikupljanje). Samo napomena, ništa se ne blokira.`,
    balanceLow: 'Stanje na DeepSeek nalogu više nije dovoljno za zahteve. Dopuni ga na platform.deepseek.com.',
    ai: 'AI',
    reasoning: 'Tok razmišljanja',
    jobGone: 'Oglas više ne postoji',
    field: (terms) => `Oblast: ${terms}`,
    link: (terms) => `Veza: ${terms}`,
    linkDefault: 'Podrazumevano (ljudi, ponašanje, empirija)',
    search: (queries) => `Pretraga: ${queries}`,
    bridgeTest: (n, outside) => `trenutno obuhvata ${n} ${srForm(n, 'otvoren oglas', 'otvorena oglasa', 'otvorenih oglasa')}, od toga ${outside} van jezgra`,
    filterAfter: (filter) => `Nakon primene: ${filter}`,
    kicker: 'AI predlog',
    apply: 'Primeni',
    noThanks: 'Ne, hvala',
    applied: '✓ primenjeno',
    declined: 'odbijeno',
    stepsLabel: 'Koraci AI asistenta',
    busy: (sec) => `AI istražuje i temeljno razmišlja… ${sec} s`,
    busyLong: ' To često traje jedan do tri minuta, kod većih pretraga i duže.',
    stop: 'Zaustavi',
    noDemo: 'U demo verziji AI nije dostupan. U podešenoj aplikaciji ovde pretražuje tvoje oglase.',
    noKey: 'Za AI je Workeru potreban AI ključ (LLM_API_KEY), pogledaj docs/SCHLUESSEL.md.',
    aboutJob: 'Razgovor o oglasu',
    aboutHorizon: 'Razgovor o tvom Horizontu i tvojim mostovima',
    intro:
      'AI pretražuje sve oglase u aplikaciji, čita cele tekstove i poznaje tvoj profil pretrage. Koristi veliki model sa temeljnim razmišljanjem, pa odgovor obično stiže za jedan do tri minuta. Ne može ništa da promeni: njegove predloge primenjuješ ti.',
    retry: 'Pokušaj ponovo',
    inputLabel: 'Pitanje za AI',
    followUp: 'Postavi dodatno pitanje…',
    askPlaceholder: 'Pitaj nešto o oglasima, tvom profilu ili tvojim mostovima…',
    ask: 'Pitaj',
    newChat: 'Novi razgovor',
    failed: (msg) => `Nije uspelo: ${msg}`,
    presets: {
      passt: 'Da li mi ova pozicija odgovara?',
      dagegen: 'Šta govori protiv ove pozicije?',
      bewerbung: 'Šta da istaknem u prijavi?',
      aehnlich: 'Ima li sličnih pozicija?',
      'bruecken-fehlen': 'Koji mi mostovi još nedostaju?',
      'bruecken-schaerfen': 'Koji od mojih mostova hvataju pogrešne oglase?',
      woche: 'Ima li ove nedelje dobrih novih oglasa?',
      fristen: 'Kojim sačuvanim pozicijama uskoro ističe rok?',
      vergleich: 'Uporedi moje sačuvane pozicije.',
    },
  },
});

/** Text einer vorgefertigten Frage (Knopf und Frage im Gespräch); die Arbeitsanweisung dazu bleibt deutsch. */
const presetQuestion = (p: AssistantPreset): string => t.presets[p.id] ?? p.frage;

/** Betrag mit zwei Nachkommastellen: „1,23 €“ (Deutsch, Serbisch), „€1.23“ (Englisch). */
function money(x: number, unit = '€'): string {
  const s = x.toFixed(2);
  if (lang() === 'en') return unit.length === 1 ? `${unit}${s}` : `${unit} ${s}`;
  return `${s.replace('.', ',')} ${unit}`;
}

function eur(usd: number): string {
  const e = usd * EUR_PER_USD;
  if (e > 0 && e < 0.01) return `< ${money(0.01)}`;
  return `≈ ${money(e)}`;
}

function UsageBox({ usage, heuteUsd }: { usage: KiUsageReport | null; heuteUsd: number | null }) {
  const [open, setOpen] = useState(false);
  const heute = Math.max(heuteUsd ?? 0, usage?.heuteUsd ?? 0);
  if (!usage && heuteUsd == null) return null;
  const g = usage?.guthaben;
  return (
    <div className="ki-usage">
      <p className="ki-usage__line">
        <span>
          {t.today} {eur(heute)}
        </span>
        {usage && (
          <span>
            {t.months[+todayBerlin().slice(5, 7) - 1]} {eur(Math.max(usage.monatUsd, heute))}
          </span>
        )}
        {g && (
          <span>
            {t.balance} {money(g.betrag, g.waehrung === 'USD' ? '$' : g.waehrung)}
          </span>
        )}
        {usage && usage.tage.length > 0 && (
          <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
            {open ? t.less : t.perDay}
          </button>
        )}
      </p>
      {open && usage && (
        <ul className="ki-usage__days">
          {usage.tage.slice(0, 21).map((day) => (
            <li key={day.tag}>
              <span>{fmtDate(day.tag)}</span>
              <span>{eur(day.appUsd + day.einsammelnUsd)}</span>
              <small>{t.dayParts(eur(day.appUsd), eur(day.einsammelnUsd))}</small>
            </li>
          ))}
        </ul>
      )}
      {heute * EUR_PER_USD > DAILY_HINT_EUR && <p className="notice notice--warn">{t.dailyHint(eur(heute))}</p>}
      {g && !g.verfuegbar && <p className="notice notice--warn">{t.balanceLow}</p>}
    </div>
  );
}

function Answer({ entry }: { entry: ChatEntry }) {
  const html = useMemo(() => renderMarkdown(entry.content ?? ''), [entry.content]);
  return (
    <div className="ki-a">
      <p className="ki-a__head">
        <IconSpark width={16} height={16} /> {t.ai}
        {entry.sekunden ? <small> · {entry.sekunden} s</small> : null}
      </p>
      <div className="ki-a__body" dangerouslySetInnerHTML={{ __html: html }} />
      {entry.reasoning_content && (
        <details className="ki-a__thoughts">
          <summary>{t.reasoning}</summary>
          <p>{entry.reasoning_content}</p>
        </details>
      )}
    </div>
  );
}

function JobLink({ id, snap }: { id: string; snap: Snapshot }) {
  const v = snap.views.get(id);
  if (!v) return <span>{t.jobGone}</span>;
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
          <p className="bridge__terms">{t.field(d.feld.join(', '))}</p>
          <p className="bridge__terms">{t.link(d.anker?.length ? d.anker.join(', ') : t.linkDefault)}</p>
          {d.suche?.length ? <p className="bridge__terms">{t.search(d.suche.join(', '))}</p> : null}
          <p className="bridge__why">{d.warum}</p>
          {bridgeTest && <p className="bridge__meta">{t.bridgeTest(bridgeTest.treffer, bridgeTest.ausserhalb_kern)}</p>}
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
      body = <p className="ki-card__line">{t.filterAfter(filterText(applyFilterProposal(snap.s.settings.filter, DEFAULT_FILTER, d)))}</p>;
      break;
  }
  return (
    <div className={`ki-card ki-card--${status}`}>
      <p className="ki-card__kicker">{t.kicker}</p>
      <p className="ki-card__title">{proposalTitle(d, snap)}</p>
      {body}
      {d.begruendung && <p className="ki-card__why">{d.begruendung}</p>}
      {status === 'offen' ? (
        <div className="ki-card__actions">
          <button type="button" className="btn btn--small btn--primary" onClick={() => onDecide(true)}>
            {t.apply}
          </button>
          <button type="button" className="btn btn--small btn--quiet" onClick={() => onDecide(false)}>
            {t.noThanks}
          </button>
        </div>
      ) : (
        <p className="ki-card__status">{status === 'uebernommen' ? t.applied : t.declined}</p>
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
      <ul className="ki-steps" key={`s${key}`} aria-label={t.stepsLabel}>
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
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
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const sec = Math.round((Date.now() - since) / 1000);
  return (
    <div className="ki-busy" role="status">
      <IconSpark className="ki-busy__icon" width={20} height={20} />
      <span>
        {t.busy(sec)}
        {sec > 20 && <small className="hint">{t.busyLong}</small>}
      </span>
      <button type="button" className="btn btn--small btn--quiet" onClick={onStop}>
        {t.stop}
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
    // Was die KI über die Entscheidung erfährt, bleibt deutsch
    let what = proposalTitle(e.vorschlag.daten, snapRef.current, true);
    if (accept) {
      try {
        what = applyProposal(store, e.vorschlag.daten);
      } catch (err) {
        store.toast(t.failed(err instanceof Error ? err.message : String(err)));
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
    <SubPage title={t.title} sub={t.sub}>
      {!available ? (
        <p className="notice notice--info">{s.demo ? t.noDemo : t.noKey}</p>
      ) : (
        <>
          <UsageBox usage={usage} heuteUsd={heuteUsd} />
          {(job || conv?.thema === 'horizont') && (
            <p className="ki-topic">
              {job ? (
                <>
                  {t.aboutJob} <JobLink id={job.job.id} snap={snap} />
                </>
              ) : (
                t.aboutHorizon
              )}
            </p>
          )}
          {!asked && loaded && (
            <>
              <p className="hint">{t.intro}</p>
              <div className="ki-presets">
                {presets.map((p) => (
                  <button key={p.id} type="button" className="btn btn--small" onClick={() => ask(presetQuestion(p), p)}>
                    {presetQuestion(p)}
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
                    {t.retry}
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
              {t.inputLabel}
            </label>
            <textarea
              id="ki-input"
              className="input"
              rows={3}
              value={input}
              disabled={!!busy}
              placeholder={asked ? t.followUp : t.askPlaceholder}
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
                <IconSpark width={18} height={18} /> {t.ask}
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
                  {t.newChat}
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </SubPage>
  );
}
