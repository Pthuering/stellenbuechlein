// Gemerkt: geordnete Liste aller gemerkten Anzeigen, Herzensjobs mit Fristen-Zetteln obenauf.
// Abgelaufene gemerkte Anzeigen bleiben – unten in einem eigenen Abschnitt.

import { useMemo, useState } from 'react';
import { daysUntil, reminderText, todayBerlin } from '@stellen/core';
import { useAppState, useSaved, useStore } from '../data/hooks';
import type { SavedSort } from '../data/store';
import { navigate, openJob } from '../lib/router';
import { institutionName, shortDate } from '../lib/format';
import { Empty } from '../ui/bits';
import { JobRow } from '../ui/JobRow';
import { IconBell } from '../ui/icons';
import { PageHead } from '../ui/PageHead';

const SORTS: { key: SavedSort; label: string }[] = [
  { key: 'frist', label: 'Frist' },
  { key: 'score', label: 'Score' },
  { key: 'neu', label: 'Neu' },
  { key: 'ort', label: 'Nähe' },
];

export function SavedScreen() {
  const s = useAppState();
  const store = useStore();
  const saved = useSaved();
  const [showExpired, setShowExpired] = useState(false);
  const [onlyStar, setOnlyStar] = useState(false);
  const today = todayBerlin();

  const { open, expired, notes } = useMemo(() => {
    const open = [];
    const expired = [];
    for (const v of saved) {
      const past = v.job.deadline != null && v.job.deadline < today;
      if (past || v.job.status === 'abgelaufen') expired.push(v);
      else open.push(v);
    }
    const notes = open
      .filter((v) => v.mark?.star && v.job.deadline)
      .map((v) => ({ v, left: daysUntil(v.job.deadline, today)! }))
      .sort((a, b) => a.left - b.left)
      .slice(0, 4);
    return { open, expired, notes };
  }, [saved, today]);

  const shown = onlyStar ? open.filter((v) => v.mark?.star) : open;
  const stars = open.filter((v) => v.mark?.star).length;
  const applied = saved.filter((v) => v.mark?.appliedAt).length;

  if (saved.length === 0) {
    return (
      <section className="screen paper" aria-labelledby="saved-title">
        <PageHead title="Gemerkt" id="saved-title" />
        <Empty art="heart" title="Noch nichts gemerkt" text="Im Stapel nach rechts wischen oder in einer Anzeige auf „Merken“ tippen. Mit dem Stern wird sie zum Herzensjob mit Fristen-Erinnerung.">
          <button type="button" className="btn btn--primary" onClick={() => navigate('/stapel')}>
            Zum Stapel
          </button>
        </Empty>
      </section>
    );
  }

  return (
    <section className="screen paper" aria-labelledby="saved-title">
      <div className="page-head">
        <div>
          <h1 className="page-title" id="saved-title">
            Gemerkt
          </h1>
          <p className="page-sub">
            {open.length === 1 ? '1 offene Anzeige' : `${open.length} offene Anzeigen`}
            {stars ? `, ${stars} Herzensjob${stars === 1 ? '' : 's'}` : ''}
            {applied ? `, ${applied} beworben` : ''}
          </p>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="reminders" aria-label="Nächste Fristen deiner Herzensjobs">
          {notes.map(({ v, left }) => {
            const inst = v.job.institutionId ? s.institutions.get(v.job.institutionId) : undefined;
            return (
              <button type="button" key={v.job.id} className="reminder" onClick={() => openJob(v.job.id)}>
                <b>
                  <IconBell width={16} height={16} style={{ verticalAlign: '-2px' }} /> {reminderText(left)} <span className="reminder__date">({shortDate(v.job.deadline)})</span>
                </b>
                <span>{v.job.title}</span>
                <small>{institutionName(inst, true)}</small>
              </button>
            );
          })}
        </div>
      )}

      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="segmented" role="group" aria-label="Sortieren nach">
          {SORTS.map((o) => (
            <button key={o.key} type="button" aria-pressed={s.settings.sort.saved === o.key} onClick={() => store.updateSettings('sort', { ...s.settings.sort, saved: o.key })}>
              {o.label}
            </button>
          ))}
        </div>
        {stars > 0 && (
          <button type="button" className="chip" aria-pressed={onlyStar} onClick={() => setOnlyStar((x) => !x)}>
            nur Herzensjobs
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="hint" style={{ margin: '14px 0' }}>
          {onlyStar ? 'Keine Herzensjobs mit offener Frist.' : 'Alle gemerkten Anzeigen sind abgelaufen.'}
        </p>
      ) : (
        <ul className="list">
          {shown.map((v) => (
            <JobRow key={v.job.id} v={v} />
          ))}
        </ul>
      )}

      {expired.length > 0 && (
        <>
          <button type="button" className="btn btn--quiet" style={{ marginTop: 12 }} aria-expanded={showExpired} onClick={() => setShowExpired((x) => !x)}>
            {showExpired ? 'Abgelaufene ausblenden' : `${expired.length} abgelaufene anzeigen`}
          </button>
          {showExpired && (
            <>
              <p className="hint">Gemerkte Anzeigen bleiben auch nach der Frist hier, damit du nachsehen kannst, worauf du dich beworben hast.</p>
              <ul className="list">
                {expired.map((v) => (
                  <JobRow key={v.job.id} v={v} faded />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
