// Verlauf im Stapel: alle gemerkten und weggelegten Anzeigen, Entscheidung jederzeit änderbar.

import { useMemo, useState } from 'react';
import { useAppState, useStore, useViews } from '../data/hooks';
import { openJob } from '../lib/router';
import { deadlineInfo, institutionName } from '../lib/format';
import { Sheet } from '../ui/Sheet';
import { Empty } from '../ui/bits';
import { IconHeart, IconStar, IconX } from '../ui/icons';

export function HistorySheet({ onClose, onUndo }: { onClose: () => void; onUndo: (id: string) => void }) {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const [tab, setTab] = useState<'gemerkt' | 'abgelehnt'>('gemerkt');

  const list = useMemo(
    () =>
      [...s.marks.values()]
        .filter((m) => m.decision === tab)
        .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))
        .map((m) => views.get(m.jobId))
        .filter((v): v is NonNullable<typeof v> => !!v),
    [s.marks, tab, views],
  );
  const counts = useMemo(() => {
    let g = 0;
    let a = 0;
    for (const m of s.marks.values()) {
      if (m.decision === 'gemerkt') g++;
      else if (m.decision === 'abgelehnt') a++;
    }
    return { g, a };
  }, [s.marks]);

  return (
    <Sheet title="Verlauf" onClose={onClose} full>
      <div className="segmented" role="group" aria-label="Welche Entscheidungen">
        <button type="button" aria-pressed={tab === 'gemerkt'} onClick={() => setTab('gemerkt')}>
          Gemerkt ({counts.g})
        </button>
        <button type="button" aria-pressed={tab === 'abgelehnt'} onClick={() => setTab('abgelehnt')}>
          Weggelegt ({counts.a})
        </button>
      </div>
      {list.length === 0 ? (
        <Empty
          art={tab === 'gemerkt' ? 'heart' : 'teacup'}
          title={tab === 'gemerkt' ? 'Noch nichts gemerkt' : 'Noch nichts weggelegt'}
          text={tab === 'gemerkt' ? 'Im Stapel nach rechts wischen, um eine Anzeige zu merken.' : 'Was du nach links wischst, landet hier und bleibt unter „Alle“ sichtbar.'}
        />
      ) : (
        <ul className="list">
          {list.map((v) => {
            const inst = v.job.institutionId ? s.institutions.get(v.job.institutionId) : undefined;
            const dl = deadlineInfo(v.job.deadline);
            return (
              <li key={v.job.id} className={`row ${tab === 'abgelehnt' ? 'row--faded' : ''}`} onClick={() => openJob(v.job.id)}>
                <span className="row__mark" aria-hidden="true">
                  {v.mark?.star ? <IconStar filled style={{ color: 'var(--gold)' }} /> : tab === 'gemerkt' ? <IconHeart filled style={{ color: 'var(--rosa-deep)' }} /> : <IconX />}
                </span>
                <div className="row__main">
                  <p className="row__title">{v.job.title}</p>
                  <p className="row__sub">{institutionName(inst, true)}{dl ? `, Frist ${dl.date}` : ''}</p>
                </div>
                <div className="row__meta" onClick={(e) => e.stopPropagation()}>
                  {tab === 'gemerkt' ? (
                    <button type="button" className="btn btn--quiet btn--small" onClick={() => store.decide(v.job.id, 'abgelehnt')}>
                      weglegen
                    </button>
                  ) : (
                    <>
                      <button type="button" className="btn btn--quiet btn--small" onClick={() => store.decide(v.job.id, 'gemerkt')}>
                        doch merken
                      </button>
                      <button
                        type="button"
                        className="btn btn--quiet btn--small"
                        onClick={() => {
                          store.decide(v.job.id, null);
                          onUndo(v.job.id);
                          store.toast('Liegt wieder oben auf dem Stapel.');
                        }}
                      >
                        zurück in den Stapel
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
