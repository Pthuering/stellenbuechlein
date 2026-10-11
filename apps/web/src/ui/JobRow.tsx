// Eine Zeile in den Listen (Gemerkt, Alle, Karte). Tippen öffnet die ganze Anzeige,
// das Herz links merkt oder entmerkt direkt.

import { formatKm } from '@stellen/core';
import { useAppState, useStore, type JobView } from '../data/hooks';
import { openJob } from '../lib/router';
import { deadlineInfo, institutionName, shortDate } from '../lib/format';
import { IconHeart, IconStar } from './icons';

export function scoreTone(score: number): string {
  return score >= 75 ? 'var(--rosa-deep)' : score >= 50 ? 'var(--altrosa-ink)' : 'var(--pencil)';
}

export function JobRow({ v, showDecision = false, faded = false }: { v: JobView; showDecision?: boolean; faded?: boolean }) {
  const s = useAppState();
  const store = useStore();
  const { job, mark } = v;
  const inst = job.institutionId ? s.institutions.get(job.institutionId) : undefined;
  const city = v.place.cityId ? s.cities.get(v.place.cityId) : undefined;
  const dl = deadlineInfo(job.deadline);
  const saved = mark?.decision === 'gemerkt';
  const rejected = mark?.decision === 'abgelehnt';
  const expired = job.status === 'abgelaufen' || !!dl?.past;
  const where = [institutionName(inst, true), city?.name ?? job.locationText, v.place.distanceKm != null ? formatKm(v.place.distanceKm) : null].filter(Boolean).join(', ');

  return (
    <li
      className={`row ${faded ? 'row--faded' : ''} ${expired ? 'row--expired' : ''}`}
      onClick={() => openJob(job.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) openJob(job.id);
      }}
      tabIndex={0}
      aria-label={`${job.title}, ${where}`}
    >
      <button
        type="button"
        className="row__mark"
        aria-pressed={saved}
        aria-label={saved ? 'Nicht mehr merken' : 'Merken'}
        onClick={(e) => {
          e.stopPropagation();
          store.decide(job.id, saved ? null : 'gemerkt');
          if (!saved) store.toast('Gemerkt.');
        }}
      >
        {mark?.star ? (
          <IconStar filled style={{ color: 'var(--gold)' }} />
        ) : (
          <IconHeart filled={saved} style={{ color: saved ? 'var(--rosa-deep)' : 'var(--pencil-soft)' }} />
        )}
      </button>
      <div className="row__main">
        <p className="row__title">{job.title}</p>
        <p className="row__sub">{where}</p>
        {(showDecision && rejected) || mark?.appliedAt || v.favorite ? (
          <p className="row__tags">
            {v.favorite && <span className="chip chip--rosa chip--tiny">Lieblingsort</span>}
            {mark?.appliedAt && <span className="chip chip--butter chip--tiny">beworben</span>}
            {showDecision && rejected && <span className="chip chip--tiny">weggelegt</span>}
          </p>
        ) : null}
      </div>
      <div className="row__meta">
        <span className="mini-score" style={{ color: scoreTone(v.score.score) }}>
          {v.score.score}
          <small>%</small>
        </span>
        {dl ? <span className={dl.urgent ? 'marker' : ''}>{expired ? 'abgelaufen' : `bis ${shortDate(job.deadline)}`}</span> : <span style={{ color: 'var(--pencil-soft)' }}>ohne Frist</span>}
      </div>
    </li>
  );
}
