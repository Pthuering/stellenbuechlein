// Horizont: Stellen außerhalb des Kernbereichs, die über eine Brücke zu dir passen könnten.
// Brücken bearbeiten, KI-Vorschläge annehmen, Weite und Dosis im Stapel einstellen.

import { useMemo, useState } from 'react';
import {
  cleanTerms,
  DOSIS_LABELS,
  horizontOf,
  isOpen,
  matchBridges,
  newItemId,
  STANDARD_ANKER,
  starterHorizont,
  todayBerlin,
  type Bruecke,
  type Horizont,
  type HorizontDosis,
} from '@stellen/core';
import { useAppState, useStore, useViews } from '../../data/hooks';
import { navigate, openJob } from '../../lib/router';
import { setIntent, takeIntent } from '../../lib/intent';
import { Sheet } from '../../ui/Sheet';
import { IconPencil, IconPlus, IconTrash } from '../../ui/icons';
import { SubPage } from './Settings';

function parseList(raw: string, max = 40): string[] {
  return cleanTerms(raw.split(/[\n,;]+/), max);
}

const HERKUNFT: Record<Bruecke['herkunft'], string> = { start: 'Start-Brücke', steckbrief: 'aus dem Steckbrief', ki: 'KI-Vorschlag', manuell: 'selbst angelegt' };
const DOSIS_BUTTON: Record<HorizontDosis, string> = { aus: 'aus', selten: 'selten', normal: 'normal', oft: 'oft' };

/** Drei Ringe als kleine Skizze: Kern, Horizont, Weite. */
function Rings() {
  return (
    <svg className="rings" viewBox="0 0 320 140" role="img" aria-label="Drei Ringe: Kern in der Mitte, darum Horizont, außen Weite">
      <ellipse cx="160" cy="70" rx="152" ry="64" fill="none" stroke="var(--secondary)" strokeWidth="1.6" strokeDasharray="5 6" />
      <ellipse cx="160" cy="72" rx="110" ry="44" fill="var(--secondary-soft)" stroke="var(--secondary-strong)" strokeWidth="1.6" />
      <ellipse cx="160" cy="76" rx="56" ry="20" fill="var(--primary-soft)" stroke="var(--primary-strong)" strokeWidth="1.8" />
      <text x="160" y="81" textAnchor="middle" className="rings__label">Kern</text>
      <text x="160" y="47" textAnchor="middle" className="rings__label rings__label--h">Horizont</text>
      <text x="160" y="20" textAnchor="middle" className="rings__label rings__label--w">Weite</text>
    </svg>
  );
}

function BridgeEditor({ bridge, onSave, onDelete, onClose }: { bridge: Bruecke | null; onSave: (b: Bruecke) => void; onDelete?: () => void; onClose: () => void }) {
  const views = useViews();
  const [name, setName] = useState(bridge?.name ?? '');
  const [feld, setFeld] = useState((bridge?.feld ?? []).join('\n'));
  const [anker, setAnker] = useState((bridge?.anker ?? []).join('\n'));
  const [suche, setSuche] = useState((bridge?.suche ?? []).join('\n'));
  const [warum, setWarum] = useState(bridge?.warum ?? '');
  const [aktiv, setAktiv] = useState(bridge?.aktiv ?? true);
  const [error, setError] = useState<string | null>(null);

  const draft: Bruecke = useMemo(
    () => ({
      id: bridge?.id ?? newItemId('h'),
      name: name.trim() || 'Neue Brücke',
      feld: parseList(feld),
      anker: parseList(anker),
      suche: parseList(suche, 8).filter((q) => q.length >= 2),
      warum: warum.trim() || null,
      aktiv,
      herkunft: bridge?.herkunft ?? 'manuell',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, feld, anker, suche, warum, aktiv],
  );

  // Ausprobieren an allen offenen Anzeigen
  const test = useMemo(() => {
    if (draft.feld.length === 0) return null;
    const today = todayBerlin();
    const h: Horizont = { ...starterHorizont(), bruecken: [{ ...draft, aktiv: true }] };
    let n = 0;
    let outside = 0;
    const examples: { id: string; title: string; terms: string }[] = [];
    for (const v of views.values()) {
      if (!isOpen(v.job, today)) continue;
      const hit = matchBridges(v.norm, h)[0];
      if (!hit) continue;
      n++;
      if (v.lane.lane !== 'kern') outside++;
      if (examples.length < 4) examples.push({ id: v.job.id, title: v.job.title, terms: [...hit.feld.slice(0, 2), ...hit.anker.slice(0, 2)].join(', ') });
    }
    return { n, outside, examples };
  }, [draft, views]);

  const save = () => {
    if (!name.trim()) return setError('Bitte einen Namen eingeben.');
    if (draft.feld.length === 0) return setError('Bitte mindestens einen Begriff für das Feld eintragen.');
    onSave({ ...draft, name: name.trim() });
  };

  return (
    <Sheet title={bridge ? 'Brücke bearbeiten' : 'Neue Brücke'} onClose={onClose} full>
      <p className="hint" style={{ marginTop: 0 }}>
        Eine Anzeige passt, wenn sie einen Begriff aus dem <b>Feld</b> und einen aus der <b>Anknüpfung</b> enthält. Schreibweise wie im Suchprofil: Wortanfänge reichen, * passt überall im Wort.
      </p>
      <label className="field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. IT-Sicherheit" maxLength={80} />
      </label>
      <label className="field">
        <span>Feld (einer reicht, je Zeile einer)</span>
        <textarea className="input" style={{ minHeight: 100 }} value={feld} onChange={(e) => setFeld(e.target.value)} placeholder={'cybersecurity\nit sicherheit\nphishing'} spellCheck={false} />
      </label>
      <label className="field">
        <span>Anknüpfung an dich (leer = Standard)</span>
        <textarea className="input" style={{ minHeight: 80 }} value={anker} onChange={(e) => setAnker(e.target.value)} placeholder={'verhalten\nnutzerstud\nbefragung'} spellCheck={false} />
      </label>
      {!parseList(anker).length && (
        <p className="hint" style={{ marginTop: -4 }}>
          Standard: Begriffe für Menschen, Verhalten und empirische Arbeit, etwa {STANDARD_ANKER.slice(1, 9).map((t) => t.replace(/^\*/, '')).join(', ')} und {STANDARD_ANKER.length - 9} weitere.
        </p>
      )}
      <label className="field">
        <span>Suchwörter für die Erkundung (optional)</span>
        <textarea className="input" style={{ minHeight: 64 }} value={suche} onChange={(e) => setSuche(e.target.value)} placeholder={'Usable Security\nSecurity Awareness'} />
      </label>
      <label className="field">
        <span>Warum diese Brücke? (optional)</span>
        <textarea className="input" style={{ minHeight: 64 }} value={warum} onChange={(e) => setWarum(e.target.value)} placeholder="z. B. Verhalten von Menschen ist oft die größte Sicherheitslücke" maxLength={400} />
      </label>
      <label className="toggle">
        <span>Brücke aktiv</span>
        <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} />
      </label>

      {test && (
        <div className="notice notice--info" style={{ marginTop: 14 }} aria-live="polite">
          <b>Ausprobieren:</b> passt auf {test.n} offene Anzeige{test.n === 1 ? '' : 'n'}
          {test.n ? `, davon ${test.outside} außerhalb des Kerns` : ''}. Neue Treffer sammelt der nächste Lauf ein.
          {test.examples.length > 0 && (
            <ul className="test-list">
              {test.examples.map((e) => (
                <li key={e.id}>
                  <button type="button" className="linkish" onClick={() => openJob(e.id)}>
                    {e.title}
                  </button>
                  <small> über {e.terms}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" className="btn btn--primary" onClick={save}>
          Speichern
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Abbrechen
        </button>
        {onDelete && (
          <button type="button" className="btn btn--quiet" onClick={onDelete}>
            <IconTrash width={18} height={18} /> Löschen
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function HorizontPage() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const p = s.settings.profile;
  const h = horizontOf(p);
  const [editing, setEditing] = useState<{ bridge: Bruecke | null } | null>(() => {
    const id = takeIntent('editBridge');
    const b = id ? h.bruecken.find((x) => x.id === id) : undefined;
    return b ? { bridge: b } : null;
  });
  const [suggested, setSuggested] = useState<Bruecke[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [skills, setSkills] = useState(h.faehigkeiten.join(', '));
  const [interests, setInterests] = useState(h.interessen.join(', '));

  const save = (next: Horizont, toast?: string) => {
    const prev = p;
    store.updateSettings('profile', {
      ...p,
      origin: p.origin === 'start' ? 'manuell' : p.origin,
      name: p.origin === 'start' ? 'Eigenes Profil' : p.name,
      horizont: next,
      updatedAt: new Date().toISOString(),
    });
    if (toast) store.toast(toast, { label: 'Rückgängig', run: () => store.updateSettings('profile', prev) });
  };

  const counts = useMemo(() => {
    const today = todayBerlin();
    let horizont = 0;
    let weite = 0;
    const perBridge = new Map<string, number>();
    for (const v of views.values()) {
      if (!isOpen(v.job, today)) continue;
      if (v.lane.promoted && v.lane.lane === 'horizont') horizont++;
      if (v.lane.promoted && v.lane.lane === 'weite') weite++;
      if (v.lane.lane !== 'kern' && v.lane.bridge) perBridge.set(v.lane.bridge.bridge.id, (perBridge.get(v.lane.bridge.bridge.id) ?? 0) + 1);
    }
    return { horizont, weite, perBridge };
  }, [views]);

  const ask = async () => {
    setAsking(true);
    try {
      const list = await store.api.suggestBridges(p);
      setSuggested(list);
      if (list.length === 0) store.toast('Die KI hat gerade keine neuen Brücken gefunden.');
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  };

  return (
    <SubPage title="Horizont" sub="Stellen außerhalb deines Kernbereichs">
      <Rings />
      <p className="notice">
        Der <b>Kern</b> sind Stellen, die deine Kernthemen aus dem Suchprofil treffen. Der <b>Horizont</b> holt Stellen aus anderen Feldern dazu, wenn eine Brücke passt: ein Feld-Begriff und eine Anknüpfung an dich. In der{' '}
        <b>Weite</b> prüft die KI auch Stellen ohne Brücke, ob deine Fähigkeiten dort tragen. Völlig Fremdes sortiert sie aus. Ausgeblendet wird nichts: Was hier landet, steht immer auch unter „Alle“.
      </p>

      <div className="group">
        <h2 className="section-title">Im Stapel</h2>
        <div className="segmented segmented--wrap" role="group" aria-label="Wie oft eine Horizont-Karte kommt">
          {(Object.keys(DOSIS_LABELS) as HorizontDosis[]).map((d) => (
            <button key={d} type="button" aria-pressed={h.dosis === d} onClick={() => save({ ...h, dosis: d })}>
              {DOSIS_BUTTON[d]}
            </button>
          ))}
        </div>
        <p className="hint">
          {h.dosis === 'aus'
            ? 'Horizont-Anzeigen werden nicht eingestreut, sie stehen nach Score sortiert im Stapel und unter „Alle“.'
            : `Zwischen den Kern-Karten kommt ${DOSIS_LABELS[h.dosis]} Karte aus dem Horizont, zufällig verteilt.`}{' '}
          Gerade offen: {counts.horizont} aus dem Horizont, {counts.weite} aus der Weite.
        </p>
      </div>

      <div className="group">
        <h2 className="section-title">Brücken</h2>
        {h.bruecken.length === 0 && <p className="hint">Noch keine Brücken. Der Steckbrief aus dem Interview legt sie an, oder du fügst selbst welche hinzu.</p>}
        <ul className="bridge-list">
          {h.bruecken.map((b) => (
            <li key={b.id} className={`bridge ${b.aktiv ? '' : 'bridge--off'}`}>
              <div className="bridge__head">
                <button type="button" className="bridge__name linkish" onClick={() => setEditing({ bridge: b })}>
                  {b.name}
                </button>
                <label className="switch" title={b.aktiv ? 'aktiv' : 'pausiert'}>
                  <span className="visually-hidden">{b.name} aktiv</span>
                  <input
                    type="checkbox"
                    checked={b.aktiv}
                    onChange={(e) => save({ ...h, bruecken: h.bruecken.map((x) => (x.id === b.id ? { ...x, aktiv: e.target.checked } : x)) })}
                  />
                </label>
                <button type="button" className="icon-btn" onClick={() => setEditing({ bridge: b })} aria-label={`${b.name} bearbeiten`}>
                  <IconPencil width={20} height={20} />
                </button>
              </div>
              <p className="bridge__terms">
                Feld: {b.feld.slice(0, 6).map((t) => t.replace(/^\*|"/g, '')).join(', ')}
                {b.feld.length > 6 ? ` und ${b.feld.length - 6} weitere` : ''}
                {b.anker.length ? `; Anknüpfung: ${b.anker.slice(0, 4).join(', ')}${b.anker.length > 4 ? ' …' : ''}` : ''}
              </p>
              {b.warum && <p className="bridge__why">{b.warum}</p>}
              <p className="bridge__meta">
                {HERKUNFT[b.herkunft]}
                {b.aktiv ? `, ${counts.perBridge.get(b.id) ?? 0} offene Anzeige${(counts.perBridge.get(b.id) ?? 0) === 1 ? '' : 'n'} im Horizont` : ', pausiert'}
              </p>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" className="btn btn--small" onClick={() => setEditing({ bridge: null })}>
            <IconPlus width={18} height={18} /> Brücke hinzufügen
          </button>
          <button type="button" className="btn btn--small" disabled={asking || !s.aiSuggest} onClick={() => void ask()}>
            {asking ? 'KI denkt nach …' : 'Brücken vorschlagen lassen'}
          </button>
          {s.aiSuggest && !s.demo && (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setIntent('kiThema', 'horizont');
                navigate('/ich/ki');
              }}
            >
              Mit der KI besprechen
            </button>
          )}
        </div>
        {!s.aiSuggest && <p className="hint">Für Vorschläge braucht der Worker einen KI-Schlüssel (siehe Betriebsanleitung).</p>}

        {suggested && suggested.length > 0 && (
          <div className="ai-note" style={{ marginTop: 14 }}>
            <b>Vorschläge der KI</b>
            <p style={{ margin: '0 0 6px' }}>Übernommen wird nur, was du annimmst. Danach lässt sich jede Brücke bearbeiten.</p>
            <ul className="bridge-list">
              {suggested.map((b) => (
                <li key={b.id} className="bridge bridge--suggested">
                  <p className="bridge__name">{b.name}</p>
                  <p className="bridge__terms">Feld: {b.feld.slice(0, 6).join(', ')}</p>
                  {b.warum && <p className="bridge__why">{b.warum}</p>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn btn--small btn--primary"
                      onClick={() => {
                        save({ ...h, bruecken: [...h.bruecken, b] }, `Brücke „${b.name}“ übernommen.`);
                        setSuggested(suggested.filter((x) => x.id !== b.id));
                      }}
                    >
                      Übernehmen
                    </button>
                    <button type="button" className="btn btn--small btn--quiet" onClick={() => setSuggested(suggested.filter((x) => x.id !== b.id))}>
                      Nein danke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="group">
        <h2 className="section-title">Weite</h2>
        <label className="toggle">
          <span>
            KI prüft auch Stellen ohne Brücke
            <br />
            <small className="hint">Nur Stellen, in denen eine deiner Fähigkeiten und ein Bezug zu Menschen oder Empirie vorkommt. Die KI sagt „passt“, „eher“ oder „nein“; „nein“ steht unter Quellen → Aussortiert.</small>
          </span>
          <input type="checkbox" checked={h.weite} onChange={(e) => save({ ...h, weite: e.target.checked })} />
        </label>
        <label className="field">
          <span>Fähigkeiten, die in andere Felder tragen</span>
          <textarea className="input" style={{ minHeight: 80 }} value={skills} onChange={(e) => setSkills(e.target.value)} onBlur={() => {
              const next = parseList(skills, 60);
              if (next.join('|') !== h.faehigkeiten.join('|')) save({ ...h, faehigkeiten: next });
            }} spellCheck={false} />
        </label>
        <p className="hint" style={{ marginTop: -4 }}>Zusätzlich zählen die Begriffe aus „Methoden & Können“ im Suchprofil.</p>
        <label className="field">
          <span>Interessen außerhalb der Psychologie</span>
          <input className="input" value={interests} onChange={(e) => setInterests(e.target.value)} onBlur={() => {
              const next = parseList(interests, 30);
              if (next.join('|') !== h.interessen.join('|')) save({ ...h, interessen: next });
            }} placeholder="z. B. KI, Nachhaltigkeit, Stadtentwicklung" />
        </label>
        <p className="hint" style={{ marginTop: -4 }}>Die KI nutzt die Interessen für Brücken-Vorschläge und ihr Urteil.</p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0 8px' }}>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const start = starterHorizont();
            setSkills(start.faehigkeiten.join(', '));
            setInterests('');
            save(start, 'Start-Horizont wiederhergestellt.');
          }}
        >
          Auf Start-Horizont zurücksetzen
        </button>
      </div>

      {editing && (
        <BridgeEditor
          bridge={editing.bridge}
          onClose={() => setEditing(null)}
          onSave={(b) => {
            const exists = h.bruecken.some((x) => x.id === b.id);
            save({ ...h, bruecken: exists ? h.bruecken.map((x) => (x.id === b.id ? b : x)) : [...h.bruecken, b] });
            setEditing(null);
          }}
          onDelete={
            editing.bridge
              ? () => {
                  const id = editing.bridge!.id;
                  save({ ...h, bruecken: h.bruecken.filter((x) => x.id !== id) }, `Brücke „${editing.bridge!.name}“ gelöscht.`);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </SubPage>
  );
}
