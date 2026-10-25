// Umfrage für das Suchprofil: Seite für Seite, mit Vorschlägen zum Antippen und Fortschritt oben.
// Die Antworten werden laufend als Einstellung "umfrage" gespeichert (Weitermachen geht auch auf einem
// anderen Gerät). Am Ende entsteht daraus über den Steckbrief-Import das Suchprofil.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ABSCHLUSS_VORSCHLAEGE,
  ARBEITSWEISE,
  BRUECKEN_HINWEISE,
  DOSIS_OPTIONEN,
  EINRICHTUNG_OPTIONEN,
  ENTGELT_STUFEN,
  FACHGEBIETE,
  INSTITUTION_KIND_LABELS,
  INTERESSEN,
  LIEBER_NICHT,
  METHODEN_GRUPPEN,
  MOBIL_OPTIONEN,
  REISEN_OPTIONEN,
  START_OPTIONEN,
  STAND_OPTIONEN,
  STATE_CODES,
  STATES,
  STELLENART_OPTIONEN,
  THEMEN,
  UMFANG_STUFEN,
  eigeneAuswahl,
  formatDateDe,
  importSteckbrief,
  isOpen,
  neueUmfrage,
  normalizeText,
  scoreJob,
  starterHorizont,
  todayBerlin,
  umfrageAlsText,
  umfrageZuSteckbrief,
  type Auswahl,
  type Hearts as HeartCount,
  type KatalogEintrag,
  type StateCode,
  type Suchprofil,
  type UmfrageAntworten,
  type UmfrageOption,
  type UmfrageOrt,
  type UmfrageStand,
} from '@stellen/core';
import { useAppState, useStore, useViews } from '../../data/hooks';
import { navigate, openJob } from '../../lib/router';
import { Hearts } from '../../ui/bits';
import { IconChevron, IconHeart, IconPlus, IconSearch, IconX } from '../../ui/icons';
import { scoreTone } from '../../ui/JobRow';
import { ProfilePreview } from './SteckbriefImport';

type Set_ = (patch: Partial<UmfrageAntworten>) => void;

// ---------------------------------------------------------------- Bausteine

/** Eine Antwort aus mehreren (nochmal antippen hebt die Wahl auf). */
function Choice<T extends string | number>({ options, value, onChange, label }: { options: { id: T; label: string; hinweis?: string }[]; value: T | null; onChange: (v: T | null) => void; label: string }) {
  return (
    <div className="survey-options" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} className="survey-option" onClick={() => onChange(value === o.id ? null : o.id)}>
          <span className="survey-option__mark" aria-hidden="true" />
          <span>
            {o.label}
            {o.hinweis && <small>{o.hinweis}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Mehrere Antworten als große Zeilen. */
function MultiChoice({ options, values, onChange, label }: { options: UmfrageOption[]; values: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="survey-options" role="group" aria-label={label}>
      {options.map((o) => {
        const on = values.includes(o.id);
        return (
          <button key={o.id} type="button" role="checkbox" aria-checked={on} className="survey-option survey-option--multi" onClick={() => onChange(on ? values.filter((x) => x !== o.id) : [...values, o.id])}>
            <span className="survey-option__mark" aria-hidden="true" />
            <span>
              {o.label}
              {o.hinweis && <small>{o.hinweis}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Eingabefeld für eigene Einträge (Enter oder Knopf). */
function AddField({ placeholder, onAdd, label }: { placeholder: string; onAdd: (text: string) => boolean; label: string }) {
  const [text, setText] = useState('');
  const id = useId();
  return (
    <form
      className="survey-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && onAdd(text.trim())) setText('');
      }}
    >
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={120} enterKeyHint="done" />
      <button type="submit" className="btn btn--small" disabled={!text.trim()}>
        <IconPlus width={18} height={18} /> Dazu
      </button>
    </form>
  );
}

/** Vorschläge zum Antippen plus eigene Einträge. */
function ChipPicker({
  gruppen,
  value,
  onChange,
  eigenPlaceholder,
  eigenLabel,
}: {
  gruppen: { titel?: string; vorschlaege: KatalogEintrag[] }[];
  value: Auswahl[];
  onChange: (v: Auswahl[]) => void;
  eigenPlaceholder: string;
  eigenLabel: string;
}) {
  const ids = new Set(value.map((v) => v.id));
  const toggle = (k: KatalogEintrag) => onChange(ids.has(k.id) ? value.filter((v) => v.id !== k.id) : [...value, { id: k.id, label: k.label, herzen: 2 }]);
  const eigene = value.filter((v) => v.id.startsWith('eigen:'));
  return (
    <>
      {gruppen.map((g, i) => (
        <div key={g.titel ?? i}>
          {g.titel && <h3 className="survey-group">{g.titel}</h3>}
          <div className="chips survey-chips">
            {g.vorschlaege.map((k) => (
              <button key={k.id} type="button" className="chip" aria-pressed={ids.has(k.id)} onClick={() => toggle(k)}>
                <span>
                  {k.label}
                  {k.hinweis && <small> {k.hinweis}</small>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <h3 className="survey-group">{eigenLabel}</h3>
      {eigene.length > 0 && (
        <div className="chips survey-chips" style={{ marginBottom: 6 }}>
          {eigene.map((e) => (
            <span key={e.id} className="chip chip--primary chip--removable">
              {e.label}
              {e.begriffe && e.begriffe.length > 1 && <small> ({e.begriffe.slice(1).join(', ')})</small>}
              <button type="button" onClick={() => onChange(value.filter((v) => v.id !== e.id))} aria-label={`${e.label} entfernen`}>
                <IconX width={14} height={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <AddField
        label={eigenLabel}
        placeholder={eigenPlaceholder}
        onAdd={(text) => {
          const e = eigeneAuswahl(text);
          if (!e) return false;
          if (!ids.has(e.id)) onChange([...value, e]);
          return true;
        }}
      />
    </>
  );
}

/** Große Zeile zum Antippen; gewählt erscheinen darunter die Herzchen. */
function ToggleRow({ label, hinweis, herzen, onToggle, onHearts }: { label: string; hinweis?: string; herzen: HeartCount | null; onToggle: () => void; onHearts: (h: HeartCount) => void }) {
  return (
    <div className={`survey-kind${herzen ? ' survey-kind--on' : ''}`}>
      <button type="button" role="checkbox" aria-checked={!!herzen} className="survey-option survey-option--multi" onClick={onToggle}>
        <span className="survey-option__mark" aria-hidden="true" />
        <span>
          {label}
          {hinweis && <small>{hinweis}</small>}
        </span>
      </button>
      {herzen && (
        <div className="survey-kind__hearts">
          <span>Wie wichtig?</span>
          <Hearts value={herzen} onChange={onHearts} label={`Wichtigkeit von ${label}`} />
        </div>
      )}
    </div>
  );
}

/** Gewählte Einträge mit Herzchen. */
function RateList({ items, onHearts, onRemove, empty }: { items: Auswahl[]; onHearts: (id: string, h: HeartCount) => void; onRemove?: (id: string) => void; empty: string }) {
  if (items.length === 0) return <p className="notice">{empty}</p>;
  return (
    <ul className="survey-rate">
      {items.map((it) => (
        <li key={it.id}>
          <span className="survey-rate__label">{it.label}</span>
          <Hearts value={it.herzen} onChange={(h) => onHearts(it.id, h)} label={`Wichtigkeit von ${it.label}`} />
          {onRemove && (
            <button type="button" className="icon-btn" onClick={() => onRemove(it.id)} aria-label={`${it.label} entfernen`}>
              <IconX width={18} height={18} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

const HERZ_HILFE = '3 Herzen = zentral, 2 = wichtig, 1 = schön, wenn es passt.';

function Question({ children }: { children: ReactNode }) {
  return <h3 className="survey-q">{children}</h3>;
}

/** Freie Liste von Wörtern (Interessen): Vorschläge plus eigene. */
function WordPicker({ vorschlaege, value, onChange }: { vorschlaege: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const eigene = value.filter((v) => !vorschlaege.includes(v));
  return (
    <>
      <div className="chips survey-chips">
        {vorschlaege.map((w) => (
          <button key={w} type="button" className="chip" aria-pressed={value.includes(w)} onClick={() => onChange(value.includes(w) ? value.filter((x) => x !== w) : [...value, w])}>
            {w}
          </button>
        ))}
        {eigene.map((w) => (
          <span key={w} className="chip chip--primary chip--removable">
            {w}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== w))} aria-label={`${w} entfernen`}>
              <IconX width={14} height={14} />
            </button>
          </span>
        ))}
      </div>
      <h3 className="survey-group">Noch etwas anderes?</h3>
      <AddField
        label="Eigenes Interesse"
        placeholder="z. B. Astronomie"
        onAdd={(text) => {
          const w = text.trim().slice(0, 80);
          if (!w) return false;
          if (!value.some((x) => normalizeText(x) === normalizeText(w))) onChange([...value, w]);
          return true;
        }}
      />
    </>
  );
}

/** Städte und Einrichtungen aus dem Register suchen und antippen. */
function PlacePicker({ value, onChange }: { value: UmfrageOrt[]; onChange: (v: UmfrageOrt[]) => void }) {
  const s = useAppState();
  const [q, setQ] = useState('');
  const has = (kind: UmfrageOrt['kind'], ref: string) => value.some((o) => o.kind === kind && o.ref === ref);
  const toggle = (o: UmfrageOrt) => onChange(has(o.kind, o.ref) ? value.filter((x) => !(x.kind === o.kind && x.ref === o.ref)) : [...value, o]);
  const hits = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return { cities: [], insts: [] };
    const cities = [...s.cities.values()].filter((c) => normalizeText(c.name).includes(n)).slice(0, 6);
    const insts = [...s.institutions.values()].filter((i) => normalizeText(`${i.name} ${i.shortName ?? ''} ${s.cities.get(i.cityId ?? '')?.name ?? ''}`).includes(n)).slice(0, 10);
    return { cities, insts };
  }, [q, s.cities, s.institutions]);
  return (
    <>
      {value.length > 0 && (
        <div className="chips survey-chips" style={{ marginBottom: 10 }}>
          {value.map((o) => (
            <span key={`${o.kind}:${o.ref}`} className="chip chip--primary chip--removable">
              <IconHeart filled width={14} height={14} /> {o.label}
              <button type="button" onClick={() => toggle(o)} aria-label={`${o.label} entfernen`}>
                <IconX width={14} height={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <label className="search" style={{ display: 'block' }}>
        <span className="visually-hidden">Stadt oder Einrichtung suchen</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. Leipzig, Max-Planck, Charité" />
      </label>
      {q.trim().length >= 2 && hits.cities.length === 0 && hits.insts.length === 0 && <p className="hint">Nichts gefunden. Schreib sie einfach am Ende unter „Sonst noch etwas“ dazu.</p>}
      {(hits.cities.length > 0 || hits.insts.length > 0) && (
        <ul className="list">
          {hits.cities.map((c) => {
            const on = has('city', c.id);
            return (
              <li key={`c${c.id}`} className="pick">
                <button type="button" className="pick__btn" aria-pressed={on} onClick={() => toggle({ kind: 'city', ref: c.id, label: c.name })}>
                  <IconHeart filled={on} width={20} height={20} style={{ color: on ? 'var(--primary-strong)' : 'var(--text-subtle)' }} />
                  <span>
                    {c.name} <small>Stadt, {STATES[c.state]}</small>
                  </span>
                </button>
              </li>
            );
          })}
          {hits.insts.map((i) => {
            const on = has('institution', i.id);
            return (
              <li key={`i${i.id}`} className="pick">
                <button type="button" className="pick__btn" aria-pressed={on} onClick={() => toggle({ kind: 'institution', ref: i.id, label: i.name })}>
                  <IconHeart filled={on} width={20} height={20} style={{ color: on ? 'var(--primary-strong)' : 'var(--text-subtle)' }} />
                  <span>
                    {i.name}{' '}
                    <small>
                      {INSTITUTION_KIND_LABELS[i.kind]}
                      {i.cityId ? `, ${s.cities.get(i.cityId)?.name ?? ''}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Seiten

const TEILE = ['Über dich', 'Inhalte', 'Die Stelle', 'Rahmen', 'Können', 'Orte', 'Horizont', 'Zum Schluss'];

interface Seite {
  teil: number;
  titel: string;
  sub?: string;
  inhalt: (a: UmfrageAntworten, set: Set_) => ReactNode;
}

const mapHearts = (list: Auswahl[], id: string, h: HeartCount) => list.map((x) => (x.id === id ? { ...x, herzen: h } : x));
const BRUECKEN = starterHorizont().bruecken.map((b) => ({ id: b.id, label: b.name, hinweis: BRUECKEN_HINWEISE[b.id] }));
const UNBEFRISTET: { id: 0 | 1 | 2 | 3; label: string }[] = [
  { id: 0, label: 'Befristet ist völlig in Ordnung' },
  { id: 1, label: 'Wäre schön' },
  { id: 2, label: 'Wichtig' },
  { id: 3, label: 'Sehr wichtig' },
];
const SPRACHEN: { id: 'de' | 'en' | 'egal'; label: string }[] = [
  { id: 'de', label: 'Lieber auf Deutsch' },
  { id: 'en', label: 'Lieber auf Englisch' },
  { id: 'egal', label: 'Beides gleich gern' },
];
const GEWICHT_ZEILEN: { id: keyof UmfrageAntworten['gewichte']; label: string; hinweis: string }[] = [
  { id: 'thema', label: 'Thema', hinweis: 'worum es inhaltlich geht' },
  { id: 'stelle', label: 'Stellenart', hinweis: 'Promotion, Mitarbeit, Postdoc …' },
  { id: 'methoden', label: 'Methoden & Können', hinweis: 'was du einsetzen kannst' },
  { id: 'rahmen', label: 'Rahmen', hinweis: 'Bezahlung, Umfang, Befristung' },
];

const SEITEN: Seite[] = [
  {
    teil: 0,
    titel: 'Wie heißt du, und wo stehst du gerade?',
    sub: 'Der Name steht nur über deinem Profil.',
    inhalt: (a, set) => (
      <>
        <label className="field">
          <span>Vorname</span>
          <input className="input" value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="Vorname" maxLength={80} autoComplete="given-name" />
        </label>
        <Question>Wo stehst du gerade?</Question>
        <Choice label="Wo stehst du gerade?" options={STAND_OPTIONEN} value={a.stand} onChange={(v) => set({ stand: v })} />
      </>
    ),
  },
  {
    teil: 0,
    titel: 'Was hast du studiert?',
    sub: 'Schwerpunkte und Abschlussarbeit verraten viel darüber, was zu dir passt.',
    inhalt: (a, set) => (
      <>
        <label className="field">
          <span>Studiengang und Abschluss</span>
          <input className="input" value={a.abschluss} onChange={(e) => set({ abschluss: e.target.value })} placeholder="z. B. Psychologie (M.Sc.)" maxLength={160} />
        </label>
        <div className="chips survey-chips">
          {ABSCHLUSS_VORSCHLAEGE.map((v) => (
            <button key={v} type="button" className="chip" aria-pressed={a.abschluss === v} onClick={() => set({ abschluss: a.abschluss === v ? '' : v })}>
              {v}
            </button>
          ))}
        </div>
        <label className="field" style={{ marginTop: 18 }}>
          <span>Worum ging es in deiner Abschlussarbeit?</span>
          <textarea className="input survey-text" rows={3} value={a.abschlussarbeit} onChange={(e) => set({ abschlussarbeit: e.target.value })} placeholder="z. B. Emotionsregulation bei Jugendlichen, eine EEG-Studie" maxLength={400} />
        </label>
      </>
    ),
  },
  {
    teil: 0,
    titel: 'Ab wann suchst du?',
    inhalt: (a, set) => <Choice label="Ab wann suchst du?" options={START_OPTIONEN} value={a.start} onChange={(v) => set({ start: v })} />,
  },
  {
    teil: 1,
    titel: 'Welche Bereiche der Psychologie interessieren dich?',
    sub: 'Tipp alles an, was dich reizt. Wie wichtig dir was ist, kommt gleich.',
    inhalt: (a, set) => <ChipPicker gruppen={[{ vorschlaege: FACHGEBIETE }]} value={a.fachgebiete} onChange={(v) => set({ fachgebiete: v })} eigenLabel="Fehlt ein Bereich?" eigenPlaceholder="Eigener Bereich" />,
  },
  {
    teil: 1,
    titel: 'An welchen Themen würdest du gern arbeiten?',
    sub: 'Konkrete Forschungs- oder Arbeitsthemen. Andere Schreibweisen gehen mit Schrägstrich: Emotionsregulation / emotion regulation.',
    inhalt: (a, set) => <ChipPicker gruppen={[{ vorschlaege: THEMEN }]} value={a.themen} onChange={(v) => set({ themen: v })} eigenLabel="Eigene Themen" eigenPlaceholder="z. B. Interozeption / interoception" />,
  },
  {
    teil: 1,
    titel: 'Wie wichtig ist dir was?',
    sub: `${HERZ_HILFE} Je mehr Herzen, desto weiter oben landen passende Anzeigen.`,
    inhalt: (a, set) => (
      <RateList
        items={[...a.fachgebiete, ...a.themen]}
        empty="Noch nichts ausgewählt. Geh zwei Seiten zurück, oder lass es einfach leer."
        onHearts={(id, h) => set({ fachgebiete: mapHearts(a.fachgebiete, id, h), themen: mapHearts(a.themen, id, h) })}
        onRemove={(id) => set({ fachgebiete: a.fachgebiete.filter((x) => x.id !== id), themen: a.themen.filter((x) => x.id !== id) })}
      />
    ),
  },
  {
    teil: 2,
    titel: 'Welche Art von Stelle suchst du?',
    sub: `Antippen, dann gewichten. ${HERZ_HILFE}`,
    inhalt: (a, set) => (
      <div className="survey-options">
        {STELLENART_OPTIONEN.map((o) => {
          const sel = a.stellenarten.find((x) => x.art === o.art);
          return (
            <ToggleRow
              key={o.art}
              label={o.label}
              hinweis={o.hinweis}
              herzen={sel?.herzen ?? null}
              onToggle={() => set({ stellenarten: sel ? a.stellenarten.filter((x) => x.art !== o.art) : [...a.stellenarten, { art: o.art, herzen: 2 }] })}
              onHearts={(h) => set({ stellenarten: a.stellenarten.map((x) => (x.art === o.art ? { ...x, herzen: h } : x)) })}
            />
          );
        })}
      </div>
    ),
  },
  {
    teil: 2,
    titel: 'Wo würdest du gern arbeiten?',
    sub: 'Mehrere sind möglich. Das sortiert noch nichts, hilft aber, das Profil später nachzuschärfen.',
    inhalt: (a, set) => <MultiChoice label="Wo würdest du gern arbeiten?" options={EINRICHTUNG_OPTIONEN} values={a.einrichtungen} onChange={(v) => set({ einrichtungen: v })} />,
  },
  {
    teil: 2,
    titel: 'Gibt es etwas, das du lieber nicht möchtest?',
    sub: 'Solche Anzeigen rutschen nach unten. Ausgeblendet wird nichts.',
    inhalt: (a, set) => (
      <>
        <ChipPicker gruppen={[{ vorschlaege: LIEBER_NICHT }]} value={a.lieberNicht} onChange={(v) => set({ lieberNicht: v })} eigenLabel="Noch etwas?" eigenPlaceholder="z. B. Pflege" />
        {a.lieberNicht.length > 0 && (
          <>
            <Question>Wie weit nach unten?</Question>
            <p className="hint" style={{ marginTop: -2 }}>
              1 Herz = ein bisschen, 3 Herzen = deutlich.
            </p>
            <RateList items={a.lieberNicht} empty="" onHearts={(id, h) => set({ lieberNicht: mapHearts(a.lieberNicht, id, h) })} />
          </>
        )}
      </>
    ),
  },
  {
    teil: 3,
    titel: 'Bezahlung und Umfang',
    sub: 'Was mindestens drin sein sollte. Steht es nicht in der Anzeige, zählt es halb.',
    inhalt: (a, set) => (
      <>
        <Question>Bezahlung mindestens</Question>
        <div className="chips survey-chips" role="radiogroup" aria-label="Bezahlung mindestens">
          <button type="button" className="chip" role="radio" aria-checked={a.entgelt.min == null} aria-pressed={a.entgelt.min == null} onClick={() => set({ entgelt: { ...a.entgelt, min: null } })}>
            egal
          </button>
          {ENTGELT_STUFEN.map((e) => (
            <button key={e} type="button" className="chip" role="radio" aria-checked={a.entgelt.min === e} aria-pressed={a.entgelt.min === e} onClick={() => set({ entgelt: { ...a.entgelt, min: e } })}>
              E {e}
            </button>
          ))}
        </div>
        <p className="hint">Für Stellen mit Master ist E 13 üblich (Tarif im öffentlichen Dienst).</p>
        {a.entgelt.min != null && (
          <div className="survey-inline-hearts">
            <span>Wie wichtig?</span>
            <Hearts value={a.entgelt.herzen} onChange={(h) => set({ entgelt: { ...a.entgelt, herzen: h } })} label="Wichtigkeit der Bezahlung" />
          </div>
        )}
        <Question>Umfang mindestens</Question>
        <div className="chips survey-chips" role="radiogroup" aria-label="Umfang mindestens">
          <button type="button" className="chip" role="radio" aria-checked={a.umfang.min == null} aria-pressed={a.umfang.min == null} onClick={() => set({ umfang: { ...a.umfang, min: null } })}>
            egal
          </button>
          {UMFANG_STUFEN.map((u) => (
            <button key={u} type="button" className="chip" role="radio" aria-checked={a.umfang.min === u} aria-pressed={a.umfang.min === u} onClick={() => set({ umfang: { ...a.umfang, min: u } })}>
              {u === 100 ? 'Vollzeit' : `${u} %`}
            </button>
          ))}
        </div>
        <p className="hint">Promotionsstellen haben oft 50 bis 75 %.</p>
        {a.umfang.min != null && (
          <div className="survey-inline-hearts">
            <span>Wie wichtig?</span>
            <Hearts value={a.umfang.herzen} onChange={(h) => set({ umfang: { ...a.umfang, herzen: h } })} label="Wichtigkeit des Umfangs" />
          </div>
        )}
      </>
    ),
  },
  {
    teil: 3,
    titel: 'Befristung und Sprache',
    inhalt: (a, set) => (
      <>
        <Question>Wie wichtig ist dir eine unbefristete Stelle?</Question>
        <p className="hint" style={{ marginTop: -2, marginBottom: 8 }}>
          In der Wissenschaft sind die meisten Stellen befristet.
        </p>
        <Choice label="Wie wichtig ist dir eine unbefristete Stelle?" options={UNBEFRISTET} value={a.unbefristet} onChange={(v) => set({ unbefristet: v })} />
        <Question>In welcher Sprache arbeitest du lieber?</Question>
        <Choice label="In welcher Sprache arbeitest du lieber?" options={SPRACHEN} value={a.sprache} onChange={(v) => set({ sprache: v })} />
      </>
    ),
  },
  {
    teil: 3,
    titel: 'Wie möchtest du arbeiten?',
    sub: 'Anzeigen, die das erwähnen, rücken nach oben. Steht nichts dazu drin, gibt es einfach keinen Bonus.',
    inhalt: (a, set) => (
      <>
        <div className="survey-options">
          {ARBEITSWEISE.map((k) => {
            const sel = a.arbeitsweise.find((x) => x.id === k.id);
            return (
              <ToggleRow
                key={k.id}
                label={k.label}
                hinweis={k.hinweis}
                herzen={sel?.herzen ?? null}
                onToggle={() => set({ arbeitsweise: sel ? a.arbeitsweise.filter((x) => x.id !== k.id) : [...a.arbeitsweise, { id: k.id, label: k.label, herzen: 2 }] })}
                onHearts={(h) => set({ arbeitsweise: mapHearts(a.arbeitsweise, k.id, h) })}
              />
            );
          })}
        </div>
        <Question>Und Dienstreisen?</Question>
        <Choice label="Und Dienstreisen?" options={REISEN_OPTIONEN} value={a.reisen} onChange={(v) => set({ reisen: v })} />
      </>
    ),
  },
  {
    teil: 4,
    titel: 'Was kannst du, und was machst du gern?',
    sub: 'Methoden, Software, Erfahrungen. Anzeigen, die das verlangen, rücken nach oben.',
    inhalt: (a, set) => <ChipPicker gruppen={METHODEN_GRUPPEN} value={a.methoden} onChange={(v) => set({ methoden: v })} eigenLabel="Noch etwas?" eigenPlaceholder="z. B. Stata / jamovi" />,
  },
  {
    teil: 4,
    titel: 'Wie gern möchtest du das einsetzen?',
    sub: HERZ_HILFE,
    inhalt: (a, set) => (
      <RateList
        items={a.methoden}
        empty="Noch nichts ausgewählt. Geh eine Seite zurück, oder lass es einfach leer."
        onHearts={(id, h) => set({ methoden: mapHearts(a.methoden, id, h) })}
        onRemove={(id) => set({ methoden: a.methoden.filter((x) => x.id !== id) })}
      />
    ),
  },
  {
    teil: 5,
    titel: 'Wie weit würdest du für eine Stelle gehen?',
    inhalt: (a, set) => <Choice label="Wie weit würdest du für eine Stelle gehen?" options={MOBIL_OPTIONEN} value={a.mobil} onChange={(v) => set({ mobil: v })} />,
  },
  {
    teil: 5,
    titel: 'Welche Bundesländer sind dir am liebsten?',
    sub: 'Sie werden Lieblingsorte: Ihre Anzeigen stehen im Stapel und in den Listen oben. Alles andere bleibt sichtbar.',
    inhalt: (a, set) => (
      <div className="chips survey-chips">
        {STATE_CODES.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={a.bundeslaender.includes(c)} onClick={() => set({ bundeslaender: a.bundeslaender.includes(c) ? a.bundeslaender.filter((x) => x !== c) : [...a.bundeslaender, c as StateCode] })}>
            {STATES[c]}
          </button>
        ))}
      </div>
    ),
  },
  {
    teil: 5,
    titel: 'Lieblingsstädte oder Wunsch-Einrichtungen?',
    sub: 'Suchen und antippen. Auch sie stehen dann oben.',
    inhalt: (a, set) => <PlacePicker value={a.orte} onChange={(v) => set({ orte: v })} />,
  },
  {
    teil: 6,
    titel: 'Wo könntest du dein Wissen auch außerhalb der Psychologie einsetzen?',
    sub: 'Aus diesen Feldern kommen Stellen, die nicht nach Psychologie klingen, aber zu dir passen können. Sie werden im Stapel eingestreut. Wählst du keins, bleiben alle zehn als breite Startauswahl.',
    inhalt: (a, set) => <MultiChoice label="Felder außerhalb der Psychologie" options={BRUECKEN} values={a.bruecken} onChange={(v) => set({ bruecken: v })} />,
  },
  {
    teil: 6,
    titel: 'Was findest du außerhalb der Psychologie spannend?',
    sub: 'Daraus kann die KI später weitere Felder vorschlagen (Ich → Horizont).',
    inhalt: (a, set) => <WordPicker vorschlaege={INTERESSEN} value={a.interessen} onChange={(v) => set({ interessen: v })} />,
  },
  {
    teil: 6,
    titel: 'Wie oft sollen solche Stellen auftauchen?',
    inhalt: (a, set) => (
      <>
        <Choice label="Wie oft im Stapel" options={DOSIS_OPTIONEN} value={a.dosis} onChange={(v) => set({ dosis: v })} />
        <label className="toggle" style={{ marginTop: 16 }}>
          <span>
            Auch Stellen ohne passendes Feld
            <br />
            <small className="hint">Die KI darf Anzeigen vorschlagen, in denen deine Fähigkeiten tragen, auch wenn keins der Felder passt.</small>
          </span>
          <input type="checkbox" checked={a.weite} onChange={(e) => set({ weite: e.target.checked })} />
        </label>
      </>
    ),
  },
  {
    teil: 7,
    titel: 'Was zählt für dich am meisten?',
    sub: 'Wie stark jeder Bereich in die Prozentzahl einer Anzeige eingeht.',
    inhalt: (a, set) => (
      <ul className="survey-rate">
        {GEWICHT_ZEILEN.map((g) => (
          <li key={g.id}>
            <span className="survey-rate__label">
              {g.label}
              <small>{g.hinweis}</small>
            </span>
            <Hearts value={a.gewichte[g.id]} onChange={(h) => set({ gewichte: { ...a.gewichte, [g.id]: h } })} label={`Gewicht von ${g.label}`} />
          </li>
        ))}
      </ul>
    ),
  },
  {
    teil: 7,
    titel: 'Wie sähe deine Traumstelle aus?',
    sub: 'Ganz frei, in ein paar Sätzen. Geht (noch) nicht in die Prozentzahl ein, hilft aber sehr, das Profil später nachzuschärfen.',
    inhalt: (a, set) => (
      <>
        <label className="field">
          <span className="visually-hidden">Traumstelle</span>
          <textarea className="input survey-text" rows={5} value={a.traumstelle} onChange={(e) => set({ traumstelle: e.target.value })} placeholder="Was würdest du den Tag über machen, mit wem, wo?" maxLength={2000} />
        </label>
        <Question>Sonst noch etwas, das die App wissen sollte?</Question>
        <label className="field">
          <span className="visually-hidden">Sonst noch etwas</span>
          <textarea className="input survey-text" rows={4} value={a.sonstiges} onChange={(e) => set({ sonstiges: e.target.value })} placeholder="Wünsche, No-Gos, Orte, die fehlten …" maxLength={2000} />
        </label>
      </>
    ),
  },
];

const ERGEBNIS = SEITEN.length + 1;

// ---------------------------------------------------------------- Anfang und Ergebnis

function Intro({ stand, onStart, onReset }: { stand: UmfrageStand; onStart: (seite: number) => void; onReset: () => void }) {
  const weiter = stand.seite > 0 && !stand.uebernommen;
  return (
    <div className="index-card survey-intro">
      <span className="tape tape--tl" aria-hidden="true" />
      <p className="index-card__kicker">Steckbrief</p>
      <h2 className="index-card__title">{stand.uebernommen ? 'Deine Antworten' : weiter ? 'Schön, dass du weitermachst' : 'Erzähl, was du suchst'}</h2>
      {stand.uebernommen ? (
        <p>Am {formatDateDe(stand.uebernommen.slice(0, 10))} hast du daraus dein Profil gemacht. Du kannst alles durchgehen, ändern und das Profil neu übernehmen.</p>
      ) : (
        <ul className="survey-intro__list">
          <li>
            {SEITEN.length} kurze Seiten in {TEILE.length} Teilen, etwa 15 Minuten.
          </li>
          <li>Vorschläge zum Antippen, Eigenes geht immer. Nichts ist Pflicht.</li>
          <li>Alles wird gleich gespeichert. Du kannst jederzeit aufhören und später weitermachen, auch auf einem anderen Gerät.</li>
          <li>Am Ende siehst du dein Profil, bevor es übernommen wird. Aussortiert wird nie etwas, nur sortiert.</li>
        </ul>
      )}
      <p className="hint">
        Herzchen: <Hearts value={3} /> zentral, <Hearts value={2} /> wichtig, <Hearts value={1} /> schön, wenn es passt.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        {weiter ? (
          <>
            <button type="button" className="btn btn--primary" onClick={() => onStart(Math.min(stand.seite, ERGEBNIS))}>
              {stand.seite >= ERGEBNIS ? 'Weiter zum Ergebnis' : `Weiter bei Seite ${stand.seite}`}
            </button>
            <button type="button" className="btn" onClick={() => onStart(1)}>
              Von vorn durchgehen
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => onStart(1)}>
            {stand.uebernommen ? 'Antworten durchgehen' : 'Los geht’s'}
          </button>
        )}
        {stand.uebernommen && (
          <button type="button" className="btn" onClick={() => onStart(ERGEBNIS)}>
            Zum Ergebnis
          </button>
        )}
        {(weiter || stand.uebernommen) && (
          <button type="button" className="btn btn--quiet btn--small" onClick={onReset}>
            Antworten löschen
          </button>
        )}
      </div>
    </div>
  );
}

function profileName(a: UmfrageAntworten): string {
  return a.name.trim() ? `Profil von ${a.name.trim()}` : 'Aus der Umfrage';
}

function Ergebnis({ stand, onApply, onEdit }: { stand: UmfrageStand; onApply: (profile: Suchprofil, favs: { kind: 'state' | 'city' | 'institution'; ref: string }[]) => void; onEdit: () => void }) {
  const store = useStore();
  const views = useViews();
  const a = stand.antworten;
  const result = useMemo(() => {
    const r = importSteckbrief(umfrageZuSteckbrief(a));
    return 'error' in r ? r : { ...r, profile: { ...r.profile, name: profileName(a) } };
  }, [a]);
  const favs = useMemo(
    () => [
      ...a.bundeslaender.map((c) => ({ key: `state:${c}`, kind: 'state' as const, ref: c as string, label: STATES[c], art: 'Bundesland' })),
      ...a.orte.map((o) => ({ key: `${o.kind}:${o.ref}`, kind: o.kind, ref: o.ref, label: o.label, art: o.kind === 'city' ? 'Stadt' : 'Einrichtung' })),
    ],
    [a],
  );
  const [skip, setSkip] = useState<Set<string>>(new Set());

  // Wie die offenen Anzeigen mit dem neuen Profil aussähen
  const preview = useMemo(() => {
    if ('error' in result) return null;
    const today = todayBerlin();
    const scored: { id: string; title: string; score: number }[] = [];
    for (const v of views.values()) {
      if (!isOpen(v.job, today)) continue;
      scored.push({ id: v.job.id, title: v.job.title, score: scoreJob(v.job, v.norm, result.profile).score });
    }
    scored.sort((x, y) => y.score - x.score);
    return { top: scored.slice(0, 3), high: scored.filter((x) => x.score >= 75).length, total: scored.length };
  }, [result, views]);

  if ('error' in result) {
    return (
      <p className="notice notice--warn" role="alert">
        {result.error}
      </p>
    );
  }
  return (
    <div className="import-preview" aria-live="polite">
      <ProfilePreview profile={result.profile} warnings={result.warnings} />

      {preview && preview.total > 0 && (
        <div className="preview" style={{ marginTop: 14 }}>
          <p className="preview__head">
            Damit oben: <small>{preview.high} von {preview.total} offenen Anzeigen hätten 75 % oder mehr</small>
          </p>
          <ol>
            {preview.top.map((x) => (
              <li key={x.id}>
                <span className="mini-score" style={{ color: scoreTone(x.score) }}>
                  {x.score}
                  <small>%</small>
                </span>
                <button type="button" className="linkish" onClick={() => openJob(x.id)}>
                  {x.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {favs.length > 0 && (
        <>
          <h3 className="section-title">Lieblingsorte</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Was du abhakst, wird nicht übernommen.
          </p>
          {favs.map((f) => (
            <label key={f.key} className="toggle">
              <span>
                {f.label} <small className="hint">{f.art}</small>
              </span>
              <input
                type="checkbox"
                checked={!skip.has(f.key)}
                onChange={(e) => {
                  const next = new Set(skip);
                  if (e.target.checked) next.delete(f.key);
                  else next.add(f.key);
                  setSkip(next);
                }}
              />
            </label>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <button type="button" className="btn btn--primary" onClick={() => onApply(result.profile, favs.filter((f) => !skip.has(f.key)))}>
          {stand.uebernommen ? 'Profil neu übernehmen' : 'Profil übernehmen'}
        </button>
        <button type="button" className="btn" onClick={onEdit}>
          Antworten ändern
        </button>
        <button
          type="button"
          className="btn btn--quiet btn--small"
          onClick={() => {
            navigator.clipboard
              ?.writeText(umfrageAlsText(stand))
              .then(() => store.toast('Antworten kopiert.'))
              .catch(() => store.toast('Kopieren ging nicht. Die Antworten bleiben aber gespeichert.'));
          }}
        >
          Antworten kopieren
        </button>
      </div>
      <p className="hint">Das bisherige Profil wird ersetzt. Direkt danach lässt es sich mit „Profil zurück“ wiederherstellen. Feinheiten wie Suchbegriffe lassen sich jederzeit unter „Profil anpassen“ ändern.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Seite

export function UmfragePage() {
  const s = useAppState();
  const store = useStore();
  const [stand, setStand] = useState<UmfrageStand>(() => s.settings.umfrage ?? neueUmfrage());
  const seite = Math.min(Math.max(stand.seite, 0), ERGEBNIS);
  const screen = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Speichern: kurz nach der letzten Änderung, beim Verlassen sofort
  const dirty = useRef(false);
  const latest = useRef(stand);
  latest.current = stand;
  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(() => {
      dirty.current = false;
      store.updateSettings('umfrage', latest.current);
    }, 700);
    return () => window.clearTimeout(t);
  }, [stand, store]);
  useEffect(
    () => () => {
      if (dirty.current) store.updateSettings('umfrage', latest.current);
    },
    [store],
  );

  const update = (fn: (s: UmfrageStand) => UmfrageStand) => {
    dirty.current = true;
    setStand((prev) => ({ ...fn(prev), geaendert: new Date().toISOString() }));
  };
  const set: Set_ = (patch) => update((st) => ({ ...st, antworten: { ...st.antworten, ...patch } }));
  const goto = (n: number) => {
    update((st) => ({ ...st, seite: n }));
  };

  // Neue Seite: nach oben und Überschrift ansagen
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    screen.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [seite]);

  const apply = (profile: Suchprofil, favs: { kind: 'state' | 'city' | 'institution'; ref: string }[]) => {
    const prev = s.settings.profile;
    const now = new Date().toISOString();
    store.updateSettings('profile', { ...profile, updatedAt: now });
    let n = 0;
    for (const f of favs) {
      if (!store.isFavorite(f.kind, f.ref)) {
        store.setFavorite(f.kind, f.ref, true);
        n++;
      }
    }
    // Beim nächsten Öffnen wieder am Anfang („Deine Antworten“)
    const done = { ...latest.current, seite: 0, uebernommen: now, geaendert: now };
    dirty.current = false;
    setStand(done);
    store.updateSettings('umfrage', done);
    store.toast(`Profil übernommen${n ? `, ${n} Lieblingsort${n === 1 ? '' : 'e'} dazu` : ''}. Die Anzeigen sind neu sortiert.`, { label: 'Profil zurück', run: () => store.updateSettings('profile', prev) }, 8000);
    navigate('/ich');
  };

  const reset = () => {
    const prev = latest.current;
    dirty.current = false;
    const fresh = neueUmfrage();
    setStand(fresh);
    store.updateSettings('umfrage', null);
    store.toast('Antworten gelöscht.', {
      label: 'Rückgängig',
      run: () => {
        setStand(prev);
        store.updateSettings('umfrage', prev);
      },
    });
  };

  const page = seite >= 1 && seite <= SEITEN.length ? SEITEN[seite - 1] : null;
  const teil = page ? page.teil : seite === ERGEBNIS ? TEILE.length : -1;
  const pct = seite === 0 ? 0 : Math.round((Math.min(seite, SEITEN.length + 1) / (SEITEN.length + 1)) * 100);

  return (
    <section ref={screen} className="screen paper" aria-labelledby="survey-title">
      <button type="button" className="back-link" onClick={() => navigate('/ich')}>
        <IconChevron width={18} height={18} style={{ transform: 'rotate(180deg)' }} /> {seite > 0 && seite < ERGEBNIS ? 'Später weitermachen' : 'Ich'}
      </button>

      {seite > 0 && (
        <div className="survey-head">
          <div className="survey-head__meta">
            <span>{teil < TEILE.length ? `Teil ${teil + 1} von ${TEILE.length}: ${TEILE[teil]}` : 'Geschafft'}</span>
            <span>{seite <= SEITEN.length ? `Seite ${seite} von ${SEITEN.length}` : ''}</span>
          </div>
          <div className="check-progress" role="progressbar" aria-label="Fortschritt der Umfrage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {seite === 0 && (
        <>
          <div className="page-head">
            <div>
              <h1 id="survey-title" ref={heading} tabIndex={-1} className="page-title">
                Umfrage für dein Profil
              </h1>
              <p className="page-sub">Damit oben steht, was wirklich zu dir passt</p>
            </div>
          </div>
          <Intro stand={stand} onStart={goto} onReset={reset} />
        </>
      )}

      {page && (
        <>
          <h1 id="survey-title" ref={heading} tabIndex={-1} className="survey-title">
            {page.titel}
          </h1>
          {page.sub && <p className="survey-sub">{page.sub}</p>}
          <div className="survey-body">{page.inhalt(stand.antworten, set)}</div>
          <div className="survey-nav">
            <button type="button" className="btn" onClick={() => goto(seite - 1)} aria-label="Zurück">
              <IconChevron width={18} height={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button type="button" className="btn btn--primary survey-nav__next" onClick={() => goto(seite + 1)}>
              {seite === SEITEN.length ? 'Zum Ergebnis' : 'Weiter'} <IconChevron width={18} height={18} />
            </button>
          </div>
        </>
      )}

      {seite === ERGEBNIS && (
        <>
          <h1 id="survey-title" ref={heading} tabIndex={-1} className="survey-title">
            Geschafft!
          </h1>
          <p className="survey-sub">Aus deinen Antworten ist dieses Profil entstanden. Schau es dir an und übernimm es, wenn es passt.</p>
          <Ergebnis stand={stand} onApply={apply} onEdit={() => goto(1)} />
        </>
      )}
    </section>
  );
}
