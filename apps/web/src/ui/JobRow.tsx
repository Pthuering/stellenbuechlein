// Eine Zeile in den Listen (Gemerkt, Alle, Karte). Tippen öffnet die ganze Anzeige,
// das Herz links merkt oder entmerkt direkt.

import { useAppState, useStore, type JobView } from '../data/hooks';
import { openJob } from '../lib/router';
import { deadlineOf, employerName, shortDate } from '../lib/format';
import { IconHeart, IconStar } from './icons';
import { fmtKm, texts } from '../i18n';
import { laneName } from '../i18n/labels';

const t = texts({
  de: {
    unsave: 'Nicht mehr merken',
    save: 'Merken',
    saved: 'Gemerkt.',
    favorite: 'Lieblingsort',
    newSite: 'neue Website',
    applied: 'beworben',
    passed: 'weggelegt',
    demo: 'Dummy',
    until: (date: string) => `bis ${date}`,
    deadlineUnclear: 'Frist unklar',
    expired: 'abgelaufen',
    noDeadline: 'ohne Frist',
  },
  en: {
    unsave: 'Remove from saved',
    save: 'Save',
    saved: 'Saved.',
    favorite: 'Favorite place',
    newSite: 'new website',
    applied: 'applied',
    passed: 'passed',
    demo: 'Demo',
    until: (date) => `by ${date}`,
    deadlineUnclear: 'Deadline unclear',
    expired: 'expired',
    noDeadline: 'no deadline',
  },
  sr: {
    unsave: 'Ukloni iz sačuvanih',
    save: 'Sačuvaj',
    saved: 'Sačuvano.',
    favorite: 'Omiljeno mesto',
    newSite: 'novi sajt',
    applied: 'prijava poslata',
    passed: 'preskočeno',
    demo: 'Demo',
    until: (date) => `do ${date}`,
    deadlineUnclear: 'Rok nejasan',
    expired: 'isteklo',
    noDeadline: 'bez roka',
  },
});

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
  const where = [employerName(job, inst, true), city?.name ?? job.locationText, v.place.distanceKm != null ? fmtKm(v.place.distanceKm) : null].filter(Boolean).join(', ');
  const lane = v.lane.lane === 'horizont' || v.lane.lane === 'weite' ? laneName(v.lane.lane) : null;

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
        aria-label={saved ? t.unsave : t.save}
        onClick={(e) => {
          e.stopPropagation();
          store.decide(job.id, saved ? null : 'gemerkt');
          if (!saved) store.toast(t.saved);
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
        {(showDecision && rejected) || mark?.appliedAt || v.favorite || lane || job.newSite || job.dummy ? (
          <p className="row__tags">
            {v.favorite && <span className="chip chip--primary chip--tiny">{t.favorite}</span>}
            {lane && <span className="lane-tag lane-tag--tiny">{lane}</span>}
            {job.newSite && <span className="chip chip--neutral chip--tiny">{t.newSite}</span>}
            {mark?.appliedAt && <span className="chip chip--secondary chip--tiny">{t.applied}</span>}
            {showDecision && rejected && <span className="chip chip--tiny">{t.passed}</span>}
            {job.dummy && <span className="chip chip--neutral chip--tiny chip--dummy">{t.demo}</span>}
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
              {dl.date ? `${t.until(shortDate(job.deadline))}?` : t.deadlineUnclear}
            </span>
          ) : (
            <span className={dl.urgent ? 'marker' : ''}>{expired ? t.expired : t.until(shortDate(job.deadline))}</span>
          )
        ) : (
          <span style={{ color: 'var(--text-subtle)' }}>{t.noDeadline}</span>
        )}
      </div>
    </li>
  );
}
