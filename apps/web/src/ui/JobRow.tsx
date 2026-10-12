// Eine Zeile in den Listen (Gemerkt, Alle, Karte). Tippen öffnet die ganze Anzeige,
// das Herz links merkt oder entmerkt direkt.

import { formatKm } from '@stellen/core';
import { useAppState, useStore, type JobView } from '../data/hooks';
import { openJob } from '../lib/router';
import { deadlineOf, employerName, shortDate } from '../lib/format';
import { IconHeart, IconStar } from './icons';

export function scoreTone(score: number): string {
  return score >= 75 ? 'var(--primary-strong)' : score >= 50 ? 'var(--primary-muted-strong)' : 'var(--text-muted)';
}

export function JobRow({ v, showDecision = false, faded = false }: { v: JobView; showDecision?: boolean; faded?: boolean }) {
  const s = useAppState();
  const store = useStore();
  const { job, mark } = v;
  const inst = job.institutionId ? s.institutions.get(job.institutionId) : undefined;
  const city = v.place.cityId ? s.cities.get(v.place.cityId) : undefined;
  const dl = deadlineOf(job);
  const saved = mark?.decision === 'gemerkt';
  const rejected = mark?.decision === 'abgelehnt';
  const expired = job.status === 'abgelaufen' || !!dl?.past;
  const where = [employerName(job, inst, true), city?.name ?? job.locationText, v.place.distanceKm != null ? formatKm(v.place.distanceKm) : null].filter(Boolean).join(', ');
  const lane = v.lane.lane === 'horizont' ? 'Horizont' : v.lane.lane === 'weite' ? 'Weite' : null;

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
          <IconStar filled style={{ color: 'var(--accent-strong)' }} />
        ) : (
          <IconHeart filled={saved} style={{ color: saved ? 'var(--primary-strong)' : 'var(--text-subtle)' }} />
        )}
      </button>
      <div className="row__main">
        <p className="row__title">{job.title}</p>
        <p className="row__sub">{where}</p>
        {(showDecision && rejected) || mark?.appliedAt || v.favorite || lane || job.newSite ? (
          <p className="row__tags">
            {v.favorite && <span className="chip chip--primary chip--tiny">Lieblingsort</span>}
            {lane && <span className="lane-tag lane-tag--tiny">{lane}</span>}
            {job.newSite && <span className="chip chip--neutral chip--tiny">neue Website</span>}
            {mark?.appliedAt && <span className="chip chip--secondary chip--tiny">beworben</span>}
            {showDecision && rejected && <span className="chip chip--tiny">weggelegt</span>}
          </p>
        ) : null}
      </div>
      <div className="row__meta">
        <span className="mini-score" style={{ color: scoreTone(v.score.score) }}>
          {v.score.score}
          <small>%</small>
        </span>
        {dl ? (
          dl.unsure ? (
            <span className="deadline-unsure" title={dl.note ?? undefined}>
              {dl.date ? `bis ${shortDate(job.deadline)}?` : 'Frist unklar'}
            </span>
          ) : (
            <span className={dl.urgent ? 'marker' : ''}>{expired ? 'abgelaufen' : `bis ${shortDate(job.deadline)}`}</span>
          )
        ) : (
          <span style={{ color: 'var(--text-subtle)' }}>ohne Frist</span>
        )}
      </div>
    </li>
  );
}
