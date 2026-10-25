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
import { texts } from '../../i18n';

const t = texts({
  de: {
    detected: 'erkannt',
    ticked: 'abgehakt',
    optional: 'optional',
    replace: 'Ersetzen:',
    goThere: 'Hinspringen',
    title: 'Platzhalter-Checkliste',
    progress: (done: number, total: number, optionalOpen: number) => `${done} von ${total} erledigt${optionalOpen ? `, ${optionalOpen} offene davon optional` : ''}`,
    progressLabel: 'Fortschritt',
    intro: 'Alles, was noch Dummy, Beispiel oder Standardwert ist. Was die App selbst erkennen kann, hakt sie ab („erkannt“); den Rest hakst du ab, wenn er ersetzt ist oder so bleiben soll.',
    ticksLocal: ' Die Haken bleiben in diesem Browser.',
    ticksSynced: ' Die Haken werden mit dem Server abgeglichen.',
    open: (n: number) => `${n} offen`,
    allDone: 'alles erledigt',
    showBanner: 'Leiste „Checkliste“ oben zeigen',
    showBannerHint: 'Solange noch Punkte offen sind. Die Liste selbst bleibt unter „Ich“.',
  },
  en: {
    detected: 'detected',
    ticked: 'ticked',
    optional: 'optional',
    replace: 'Replace:',
    goThere: 'Go there',
    title: 'Placeholder checklist',
    progress: (done, total, optionalOpen) => `${done} of ${total} done${optionalOpen ? `, ${optionalOpen} of the open ones optional` : ''}`,
    progressLabel: 'Progress',
    intro: 'Everything that is still demo data, an example or a default. Whatever the app can detect itself, it ticks off (“detected”); you tick off the rest once it’s replaced or is meant to stay as it is.',
    ticksLocal: ' The ticks stay in this browser.',
    ticksSynced: ' The ticks are synced with the server.',
    open: (n) => `${n} open`,
    allDone: 'all done',
    showBanner: 'Show the “Checklist” bar at the top',
    showBannerHint: 'As long as items are still open. The list itself stays under “Me”.',
  },
  sr: {
    detected: 'prepoznato',
    ticked: 'štiklirano',
    optional: 'opciono',
    replace: 'Zamena:',
    goThere: 'Idi tamo',
    title: 'Kontrolna lista privremenih vrednosti',
    progress: (done, total, optionalOpen) => `Gotovo ${done} od ${total}${optionalOpen ? `, od preostalih ${optionalOpen} opciono` : ''}`,
    progressLabel: 'Napredak',
    intro: 'Sve što je još probno, primer ili podrazumevana vrednost. Ono što aplikacija sama prepozna, sama i štiklira („prepoznato“); ostalo štikliraš ti, kad je zamenjeno ili treba da ostane takvo.',
    ticksLocal: ' Oznake ostaju u ovom pregledaču.',
    ticksSynced: ' Oznake se sinhronizuju sa serverom.',
    open: (n) => `još ${n}`,
    allDone: 'sve je gotovo',
    showBanner: 'Prikaži traku „Kontrolna lista“ na vrhu',
    showBannerHint: 'Dok god ima otvorenih stavki. Sama lista ostaje pod „Ja“.',
  },
});

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
          {st.autoDone && <span className="chip chip--secondary chip--tiny">{t.detected}</span>}
          {!st.autoDone && st.manualDone && <span className="chip chip--primary chip--tiny">{t.ticked}</span>}
          {item.optional && <span className="chip chip--neutral chip--tiny">{t.optional}</span>}
        </p>
        <p className="check-item__what" id={`${id}-what`}>
          {item.what}
        </p>
        <p className="check-item__where">
          <b>{t.replace}</b> {item.where}
        </p>
        {item.route && !st.done && (
          <button type="button" className="btn btn--small btn--quiet check-item__go" onClick={() => navigate(item.route!)}>
            {t.goThere} <IconChevron width={16} height={16} aria-hidden="true" />
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
    <SubPage title={t.title} labelId="sub-checkliste" sub={t.progress(done, c.total, c.open - c.openRequired)}>
      <div className="check-progress" role="progressbar" aria-valuemin={0} aria-valuemax={c.total} aria-valuenow={done} aria-label={t.progressLabel}>
        <span style={{ width: `${Math.round((done / c.total) * 100)}%` }} />
      </div>
      <p className="hint">
        {t.intro}
        {s.demo ? t.ticksLocal : t.ticksSynced}
      </p>

      {CHECK_GROUPS.map((g) => {
        const items = c.list.filter((x) => x.item.group === g.id);
        const open = items.filter((x) => !x.done).length;
        return (
          <section key={g.id} className="group" aria-labelledby={`cg-${g.id}`}>
            <h2 className="section-title" id={`cg-${g.id}`}>
              {g.title} <small className="hint">{open ? t.open(open) : t.allDone}</small>
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
            {t.showBanner}
            <br />
            <small className="hint">{t.showBannerHint}</small>
          </span>
          <input type="checkbox" checked={!cl.hideBanner} onChange={(e) => store.updateSettings('checklist', { ...cl, hideBanner: !e.target.checked })} />
        </label>
      )}
    </SubPage>
  );
}
