// Suchprofil bearbeiten: Gewichte der Kategorien, Einträge mit Herzchen und Begriffen, "Lieber nicht".
// Jede Änderung wirkt sofort auf Score und Reihenfolge – die Vorschau oben zeigt es.

import { useMemo, useState } from 'react';
import {
  CATEGORY_HINTS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  JOB_KIND_LABELS,
  JOB_KINDS,
  matchItem,
  newItemId,
  starterProfile,
  todayBerlin,
  type CategoryId,
  type Condition,
  type Hearts as HeartCount,
  type ProfileItem,
  type Suchprofil,
} from '@stellen/core';
import { useAppState, useStore, useViews } from '../../data/hooks';
import { openJob } from '../../lib/router';
import { Hearts } from '../../ui/bits';
import { Sheet } from '../../ui/Sheet';
import { IconPencil, IconPlus, IconTrash } from '../../ui/icons';
import { scoreTone } from '../../ui/JobRow';
import { SubPage } from './Settings';

type Target = CategoryId | 'avoid';

const CONDITION_LABELS: Record<Condition['type'] | 'none', string> = {
  none: 'keine, nur Begriffe',
  kind: 'Stellenart',
  payMin: 'Entgelt mindestens',
  workloadMin: 'Umfang mindestens',
  permanent: 'unbefristet',
  language: 'Sprache der Anzeige',
};

function conditionText(c: Condition | undefined): string | null {
  if (!c) return null;
  switch (c.type) {
    case 'kind':
      return `Stellenart: ${c.kinds.map((k) => JOB_KIND_LABELS[k]).join(', ')}`;
    case 'payMin':
      return `Entgelt ab E ${c.level}`;
    case 'workloadMin':
      return `Umfang ab ${c.pct} %`;
    case 'permanent':
      return 'unbefristet';
    case 'language':
      return c.lang === 'de' ? 'deutschsprachig' : 'englischsprachig';
  }
}

function parseTerms(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function ItemEditor({ item, target, onSave, onDelete, onClose }: { item: ProfileItem | null; target: Target; onSave: (it: ProfileItem) => void; onDelete?: () => void; onClose: () => void }) {
  const views = useViews();
  const [label, setLabel] = useState(item?.label ?? '');
  const [hearts, setHearts] = useState<HeartCount>(item?.hearts ?? 2);
  const [terms, setTerms] = useState((item?.terms ?? []).join('\n'));
  const [condType, setCondType] = useState<Condition['type'] | 'none'>(item?.condition?.type ?? (target === 'stelle' ? 'kind' : target === 'rahmen' ? 'payMin' : 'none'));
  const [kinds, setKinds] = useState(item?.condition?.type === 'kind' ? item.condition.kinds : []);
  const [level, setLevel] = useState(item?.condition?.type === 'payMin' ? item.condition.level : 13);
  const [pct, setPct] = useState(item?.condition?.type === 'workloadMin' ? item.condition.pct : 65);
  const [lang, setLang] = useState<'de' | 'en'>(item?.condition?.type === 'language' ? item.condition.lang : 'de');
  const [error, setError] = useState<string | null>(null);

  const condition: Condition | undefined =
    condType === 'none'
      ? undefined
      : condType === 'kind'
        ? kinds.length
          ? { type: 'kind', kinds }
          : undefined
        : condType === 'payMin'
          ? { type: 'payMin', level }
          : condType === 'workloadMin'
            ? { type: 'workloadMin', pct }
            : condType === 'permanent'
              ? { type: 'permanent' }
              : { type: 'language', lang };
  const termList = parseTerms(terms);

  const draft = useMemo<ProfileItem>(
    () => ({ id: item?.id ?? newItemId(target === 'avoid' ? 'a' : target[0]), label: label.trim() || 'Neuer Eintrag', hearts, terms: termList.length ? termList : undefined, condition }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, hearts, terms, condType, kinds, level, pct, lang],
  );

  // Ausprobieren an den offenen Anzeigen
  const test = useMemo(() => {
    const today = todayBerlin();
    let yes = 0;
    let unknown = 0;
    const examples: { id: string; title: string; via: string | null }[] = [];
    let total = 0;
    for (const v of views.values()) {
      if (v.job.status !== 'aktiv' || (v.job.deadline && v.job.deadline < today)) continue;
      total++;
      const hit = matchItem(draft, v.job, v.norm);
      if (hit.state === 'ja') {
        yes++;
        if (examples.length < 4) examples.push({ id: v.job.id, title: v.job.title, via: hit.via });
      } else if (hit.state === 'unbekannt') unknown++;
    }
    return { yes, unknown, total, examples };
  }, [draft, views]);

  const save = () => {
    if (!label.trim()) return setError('Bitte eine Bezeichnung eingeben.');
    if (!termList.length && !condition) return setError(condType === 'kind' ? 'Bitte mindestens eine Stellenart wählen oder Begriffe eintragen.' : 'Bitte Begriffe eintragen oder eine Bedingung wählen.');
    onSave({ ...draft, label: label.trim() });
  };

  const condOptions: (Condition['type'] | 'none')[] = ['none', 'kind', 'payMin', 'workloadMin', 'permanent', 'language'];

  return (
    <Sheet title={item ? 'Eintrag bearbeiten' : 'Neuer Eintrag'} onClose={onClose} full>
      <p className="hint" style={{ marginTop: 0 }}>
        {target === 'avoid' ? 'Lieber nicht: zieht 5 Punkte je Herz ab, sortiert aber nie aus.' : `Kategorie ${CATEGORY_LABELS[target]}`}
      </p>
      <label className="field">
        <span>Bezeichnung</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Emotionsregulation" maxLength={120} />
      </label>
      <div className="field">
        <span>Wie wichtig?</span>
        <Hearts value={hearts} onChange={setHearts} label="Wichtigkeit" />
      </div>
      <label className="field">
        <span>Begriffe (einer reicht, je Zeile einer)</span>
        <textarea className="input" style={{ minHeight: 110 }} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={'emotionsregulation\nemotion regulation\n*affekt'} spellCheck={false} />
      </label>
      <details className="help">
        <summary>Wie Begriffe passen</summary>
        <ul>
          <li>
            <b>kognit</b> passt auf Wortanfänge: kognitiv, Kognition, cognitive nicht (andere Schreibung extra eintragen).
          </li>
          <li>
            <b>*psych</b> mit Stern passt überall im Wort, auch in Neuropsychologie.
          </li>
          <li>
            <b>"R"</b> in Anführungszeichen passt nur auf das ganze Wort.
          </li>
          <li>Groß- und Kleinschreibung und Umlaute sind egal (ä = ae).</li>
        </ul>
      </details>
      <label className="field">
        <span>Bedingung (optional)</span>
        <select className="select" value={condType} onChange={(e) => setCondType(e.target.value as Condition['type'] | 'none')}>
          {condOptions.map((c) => (
            <option key={c} value={c}>
              {CONDITION_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      {condType === 'kind' && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {JOB_KINDS.filter((k) => k !== 'sonstige').map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kinds.includes(k)} onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
              {JOB_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      )}
      {condType === 'payMin' && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {[9, 10, 11, 12, 13, 14, 15].map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={level === l} onClick={() => setLevel(l)}>
              E {l}
            </button>
          ))}
        </div>
      )}
      {condType === 'workloadMin' && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {[50, 65, 75, 80, 100].map((p) => (
            <button key={p} type="button" className="chip" aria-pressed={pct === p} onClick={() => setPct(p)}>
              {p} %
            </button>
          ))}
        </div>
      )}
      {condType === 'language' && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {(['de', 'en'] as const).map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l === 'de' ? 'Deutsch' : 'Englisch'}
            </button>
          ))}
        </div>
      )}
      {condition && <p className="hint">Steht die Angabe nicht in der Anzeige, zählt der Eintrag halb.</p>}

      <div className="notice notice--info" style={{ marginTop: 14 }} aria-live="polite">
        <b>Ausprobieren:</b> passt auf {test.yes} von {test.total} offenen Anzeigen
        {test.unknown ? `, bei ${test.unknown} unklar (zählt halb)` : ''}.
        {test.examples.length > 0 && (
          <ul className="test-list">
            {test.examples.map((e) => (
              <li key={e.id}>
                <button type="button" className="linkish" onClick={() => openJob(e.id)}>
                  {e.title}
                </button>
                {e.via && <small> über {e.via}</small>}
              </li>
            ))}
          </ul>
        )}
      </div>

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

function ItemLine({ item, onHearts, onEdit }: { item: ProfileItem; onHearts: (h: HeartCount) => void; onEdit: () => void }) {
  const cond = conditionText(item.condition);
  const terms = item.terms ?? [];
  return (
    <div className="profile-item">
      <button type="button" className="profile-item__label linkish" onClick={onEdit}>
        {item.label}
      </button>
      <Hearts value={item.hearts} onChange={onHearts} label={`Wichtigkeit von ${item.label}`} />
      <button type="button" className="icon-btn" onClick={onEdit} aria-label={`${item.label} bearbeiten`}>
        <IconPencil width={20} height={20} />
      </button>
      {(cond || terms.length > 0) && (
        <p className="profile-item__terms">
          {cond}
          {cond && terms.length ? '; ' : ''}
          {terms.length > 0 && `Begriffe: ${terms.slice(0, 6).join(', ')}${terms.length > 6 ? ` und ${terms.length - 6} weitere` : ''}`}
        </p>
      )}
    </div>
  );
}

export function ProfileEditor() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const p = s.settings.profile;
  const [editing, setEditing] = useState<{ target: Target; item: ProfileItem | null } | null>(null);

  const save = (next: Suchprofil, toastText?: string) => {
    const prev = p;
    store.updateSettings('profile', { ...next, origin: next.origin === 'start' ? 'manuell' : next.origin, name: next.origin === 'start' ? 'Eigenes Profil' : next.name, updatedAt: new Date().toISOString() });
    if (toastText) store.toast(toastText, { label: 'Rückgängig', run: () => store.updateSettings('profile', prev) });
  };

  const updateItems = (target: Target, fn: (items: ProfileItem[]) => ProfileItem[]) => {
    if (target === 'avoid') return { ...p, avoid: fn(p.avoid) };
    return { ...p, categories: p.categories.map((c) => (c.id === target ? { ...c, items: fn(c.items) } : c)) };
  };

  const active = p.categories.filter((c) => c.items.length && c.weight > 0);
  const weightSum = active.reduce((a, c) => a + c.weight, 0) || 1;

  const preview = useMemo(() => {
    const today = todayBerlin();
    const open = [...views.values()].filter((v) => v.job.status === 'aktiv' && !(v.job.deadline && v.job.deadline < today));
    const sorted = open.sort((a, b) => b.score.score - a.score.score);
    const high = open.filter((v) => v.score.score >= 75).length;
    return { top: sorted.slice(0, 3), high, total: open.length };
  }, [views]);

  return (
    <SubPage title="Suchprofil" sub={p.name}>
      <p className="notice">
        Jede Kategorie ist voll, sobald Einträge mit zusammen <b>drei Herzchen</b> in einer Anzeige vorkommen. Steht eine Angabe gar nicht in der Anzeige (zum Beispiel kein Entgelt), zählt der Eintrag halb. Der Score sortiert nur, aussortiert wird nie.
      </p>

      {preview.total > 0 && (
        <div className="preview">
          <p className="preview__head">
            Mit diesem Profil oben: <small>{preview.high} von {preview.total} offenen Anzeigen haben 75 % oder mehr</small>
          </p>
          <ol>
            {preview.top.map((v) => (
              <li key={v.job.id}>
                <span className="mini-score" style={{ color: scoreTone(v.score.score) }}>
                  {v.score.score}
                  <small>%</small>
                </span>
                <button type="button" className="linkish" onClick={() => openJob(v.job.id)}>
                  {v.job.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {CATEGORY_ORDER.map((id) => {
        const c = p.categories.find((x) => x.id === id)!;
        const isActive = c.items.length > 0 && c.weight > 0;
        const share = isActive ? Math.round((c.weight / weightSum) * 100) : 0;
        return (
          <section key={id} className="cat-card" aria-labelledby={`cat-${id}`}>
            <div className="cat-card__head">
              <h2 id={`cat-${id}`} className="section-title" style={{ margin: 0 }}>
                {CATEGORY_LABELS[id]}
              </h2>
              <span className="cat-card__share">{isActive ? `${share} % vom Score` : 'zählt nicht'}</span>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              {CATEGORY_HINTS[id]}
            </p>
            <label className="weight">
              <span>Gewicht</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={c.weight}
                onChange={(e) => save({ ...p, categories: p.categories.map((x) => (x.id === id ? { ...x, weight: Number(e.target.value) } : x)) })}
                aria-valuetext={`${c.weight}, das sind ${share} Prozent vom Score`}
              />
              <span style={{ minWidth: 30, textAlign: 'right' }}>{c.weight}</span>
            </label>
            {c.items.length === 0 && <p className="hint">Noch keine Einträge. Leere Kategorien zählen nicht mit.</p>}
            {c.items.map((it) => (
              <ItemLine
                key={it.id}
                item={it}
                onHearts={(h) => save(updateItems(id, (items) => items.map((x) => (x.id === it.id ? { ...x, hearts: h } : x))))}
                onEdit={() => setEditing({ target: id, item: it })}
              />
            ))}
            <button type="button" className="btn btn--quiet btn--small" onClick={() => setEditing({ target: id, item: null })}>
              <IconPlus width={18} height={18} /> Eintrag hinzufügen
            </button>
          </section>
        );
      })}

      <section className="cat-card cat-card--avoid" aria-labelledby="cat-avoid">
        <div className="cat-card__head">
          <h2 id="cat-avoid" className="section-title" style={{ margin: 0 }}>
            Lieber nicht
          </h2>
          <span className="cat-card__share">−5 Punkte je Herz</span>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          Rückt Anzeigen nach unten, blendet aber nichts aus.
        </p>
        {p.avoid.map((it) => (
          <ItemLine
            key={it.id}
            item={it}
            onHearts={(h) => save(updateItems('avoid', (items) => items.map((x) => (x.id === it.id ? { ...x, hearts: h } : x))))}
            onEdit={() => setEditing({ target: 'avoid', item: it })}
          />
        ))}
        <button type="button" className="btn btn--quiet btn--small" onClick={() => setEditing({ target: 'avoid', item: null })}>
          <IconPlus width={18} height={18} /> Eintrag hinzufügen
        </button>
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0 8px' }}>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const prev = p;
            store.updateSettings('profile', starterProfile());
            store.toast('Startprofil wiederhergestellt.', { label: 'Rückgängig', run: () => store.updateSettings('profile', prev) });
          }}
        >
          Auf Startprofil zurücksetzen
        </button>
      </div>

      {editing && (
        <ItemEditor
          item={editing.item}
          target={editing.target}
          onClose={() => setEditing(null)}
          onSave={(it) => {
            const exists = editing.item != null;
            save(updateItems(editing.target, (items) => (exists ? items.map((x) => (x.id === it.id ? it : x)) : [...items, it])));
            setEditing(null);
          }}
          onDelete={
            editing.item
              ? () => {
                  const id = editing.item!.id;
                  save(
                    updateItems(editing.target, (items) => items.filter((x) => x.id !== id)),
                    `„${editing.item!.label}“ gelöscht.`,
                  );
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </SubPage>
  );
}
