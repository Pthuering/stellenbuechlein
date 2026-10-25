// Platzhalter-Checkliste: was noch Dummy, Beispiel oder Standardwert ist und vor dem echten Betrieb
// ersetzt werden muss. Die Punkte stehen in lib/checklist.ts.

import { useMemo } from 'react';
import { useAppState, useStore } from '../../data/hooks';
import { useTestPhotos } from '../../data/testPhotos';
import { CHECK_GROUPS, evaluateChecklist, type CheckStatus } from '../../lib/checklist';
import { appConfig } from '../../lib/config';
import { navigate } from '../../lib/router';
import { IconCheck, IconChevron } from '../../ui/icons';
import { SubPage } from './Settings';

/** Stand der Checkliste für Seite und Leiste oben. */
export function useChecklist() {
  const s = useAppState();
  const photos = useTestPhotos();
  return useMemo(
    () =>
      evaluateChecklist(
        {
          demo: s.demo,
          config: appConfig(),
          profile: s.settings.profile,
          home: s.settings.home,
          testPhotos: photos.length,
          runs: s.demo ? 0 : s.runs.length,
          aiSuggest: s.aiSuggest,
          ingestTrigger: s.ingestTrigger,
          vapid: !!s.vapidPublicKey,
          sourceSummary: s.sourceSummary,
          location: { protocol: location.protocol, hostname: location.hostname },
        },
        s.settings.checklist.done,
      ),
    [s.demo, s.settings.profile, s.settings.home, s.settings.checklist.done, photos.length, s.runs.length, s.aiSuggest, s.ingestTrigger, s.vapidPublicKey, s.sourceSummary],
  );
}

function Item({ st, onToggle }: { st: CheckStatus; onToggle: (on: boolean) => void }) {
  const { item } = st;
  const id = `check-${item.id}`;
  return (
    <li className={`check-item ${st.done ? 'check-item--done' : ''}`}>
      <label className="check-item__box" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={st.done}
          disabled={st.autoDone}
          onChange={(e) => onToggle(e.target.checked)}
          aria-describedby={`${id}-what`}
        />
        <span className="check-item__mark" aria-hidden="true">
          {st.done && <IconCheck width={18} height={18} />}
        </span>
      </label>
      <div className="check-item__body">
        <p className="check-item__title">
          <label htmlFor={id}>{item.title}</label>
          {st.autoDone && <span className="chip chip--secondary chip--tiny">erkannt</span>}
          {!st.autoDone && st.manualDone && <span className="chip chip--primary chip--tiny">abgehakt</span>}
          {item.optional && <span className="chip chip--neutral chip--tiny">optional</span>}
        </p>
        <p className="check-item__what" id={`${id}-what`}>
          {item.what}
        </p>
        <p className="check-item__where">
          <b>Ersetzen:</b> {item.where}
        </p>
        {item.route && !st.done && (
          <button type="button" className="btn btn--small btn--quiet check-item__go" onClick={() => navigate(item.route!)}>
            Hinspringen <IconChevron width={16} height={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

export function ChecklistPage() {
  const s = useAppState();
  const store = useStore();
  const c = useChecklist();
  const done = c.total - c.open;
  const cl = s.settings.checklist;
  const toggle = (id: string, on: boolean) => {
    const set = new Set(cl.done);
    if (on) set.add(id);
    else set.delete(id);
    store.updateSettings('checklist', { ...cl, done: [...set] });
  };

  return (
    <SubPage title="Platzhalter-Checkliste" sub={`${done} von ${c.total} erledigt${c.openRequired < c.open ? `, ${c.open - c.openRequired} offene davon optional` : ''}`}>
      <div className="check-progress" role="progressbar" aria-valuemin={0} aria-valuemax={c.total} aria-valuenow={done} aria-label="Fortschritt">
        <span style={{ width: `${Math.round((done / c.total) * 100)}%` }} />
      </div>
      <p className="hint">
        Alles, was noch Dummy, Beispiel oder Standardwert ist. Was die App selbst erkennen kann, hakt sie ab („erkannt“); den Rest hakst du ab, wenn er ersetzt ist oder so bleiben soll.
        {s.demo ? ' Die Haken bleiben in diesem Browser.' : ' Die Haken werden mit dem Server abgeglichen.'}
      </p>

      {CHECK_GROUPS.map((g) => {
        const items = c.list.filter((x) => x.item.group === g.id);
        const open = items.filter((x) => !x.done).length;
        return (
          <section key={g.id} className="group" aria-labelledby={`cg-${g.id}`}>
            <h2 className="section-title" id={`cg-${g.id}`}>
              {g.title} <small className="hint">{open ? `${open} offen` : 'alles erledigt'}</small>
            </h2>
            <p className="hint" style={{ marginTop: -4 }}>
              {g.sub}
            </p>
            <ul className="check-list">
              {items.map((st) => (
                <Item key={st.item.id} st={st} onToggle={(on) => toggle(st.item.id, on)} />
              ))}
            </ul>
          </section>
        );
      })}

      {!s.demo && (
        <label className="toggle" style={{ marginTop: 8 }}>
          <span>
            Leiste „Checkliste“ oben zeigen
            <br />
            <small className="hint">Solange noch Punkte offen sind. Die Liste selbst bleibt unter „Ich“.</small>
          </span>
          <input type="checkbox" checked={!cl.hideBanner} onChange={(e) => store.updateSettings('checklist', { ...cl, hideBanner: !e.target.checked })} />
        </label>
      )}
    </SubPage>
  );
}
