// Die ganze Anzeige: Foto, Eckdaten, warum sie passt, Merken/Herzensjob/beworben, Notiz, vollständiger Text.

import { useEffect, useMemo, useState } from 'react';
import { CATEGORY_LABELS, formatDateDe, formatKm, INSTITUTION_KIND_LABELS, JOB_KIND_LABELS, type ScoreResult } from '@stellen/core';
import { useAppState, useStore, useViews } from '../data/hooks';
import { closeOverlay } from '../lib/router';
import { deadlineInfo, imageFor, institutionName } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';
import { Sheet } from '../ui/Sheet';
import { Polaroid } from '../ui/Polaroid';
import { Hearts, ScoreRing } from '../ui/bits';
import { IconCheck, IconDoc, IconExternal, IconHeart, IconMail, IconPin, IconStar, IconX } from '../ui/icons';

function Why({ score }: { score: ScoreResult }) {
  const cats = score.categories.filter((c) => c.max > 0);
  if (cats.length === 0) return <p className="hint">Im Suchprofil ist noch nichts eingetragen.</p>;
  return (
    <div className="why">
      {cats.map((c) => (
        <div className="why__cat" key={c.id}>
          <div className="why__head">
            <span>
              {CATEGORY_LABELS[c.id]} <Hearts value={c.hearts} label={`${String(c.hearts).replace('.', ',')} von 3 Herzen`} />
            </span>
            <span className="why__pts">
              {Math.round(c.points)} von {Math.round(c.max)} Punkten
            </span>
          </div>
          <div className="why__bar" aria-hidden="true">
            <span style={{ width: `${(c.points / (c.max || 1)) * 100}%` }} />
          </div>
          {c.hits.map((h) => (
            <div key={h.item.id} className={`why__item why__item--${h.state}`}>
              <span aria-hidden="true">{h.state === 'ja' ? '✓' : h.state === 'unbekannt' ? '?' : '–'}</span>
              <span>
                {h.item.label}
                {h.state === 'ja' && h.via ? <span style={{ color: 'var(--pencil)' }}> ({h.via})</span> : null}
                {h.state === 'unbekannt' ? <span style={{ color: 'var(--pencil)' }}> (steht nicht in der Anzeige, zählt halb)</span> : null}
              </span>
            </div>
          ))}
        </div>
      ))}
      {score.penalties.length > 0 && (
        <div className="why__cat">
          <div className="why__head">
            <span>Lieber nicht</span>
            <span className="why__pts">−{score.penalty} Punkte</span>
          </div>
          {score.penalties.map((h) => (
            <div key={h.item.id} className="why__item">
              <span aria-hidden="true">✗</span>
              <span>{h.item.label}</span>
            </div>
          ))}
        </div>
      )}
      <p className="hint">Jede Kategorie ist voll, sobald drei Herzchen getroffen sind. Der Score sortiert nur, aussortiert wird nie.</p>
    </div>
  );
}

export function JobDetail({ id }: { id: string }) {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const v = views.get(id);
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState(v?.mark?.note ?? '');
  useEffect(() => setNote(v?.mark?.note ?? ''), [id, v?.mark?.note]);
  const html = useMemo(() => (v ? renderMarkdown(v.job.descriptionMd) : ''), [v?.job.descriptionMd]);

  if (!v) {
    return (
      <Sheet title="Anzeige" onClose={closeOverlay}>
        <p>Diese Anzeige gibt es nicht mehr. Abgelaufene Anzeigen werden nach zwei Wochen aufgeräumt, gemerkte bleiben.</p>
      </Sheet>
    );
  }
  const { job, mark } = v;
  const inst = job.institutionId ? s.institutions.get(job.institutionId) : undefined;
  const city = v.place.cityId ? s.cities.get(v.place.cityId) : undefined;
  const img = imageFor(job, inst, city);
  const dl = deadlineInfo(job.deadline);
  const saved = mark?.decision === 'gemerkt';
  const rejected = mark?.decision === 'abgelehnt';
  const instFav = inst ? store.isFavorite('institution', inst.id) : false;

  const facts: [string, React.ReactNode][] = [];
  if (dl) facts.push(['Frist', <><span className={dl.urgent ? 'marker' : ''}>{dl.date}</span> <span style={{ color: 'var(--pencil)' }}>{dl.left}</span></>]);
  else facts.push(['Frist', <span style={{ color: 'var(--pencil)' }}>keine angegeben</span>]);
  if (job.kind) facts.push(['Stellenart', JOB_KIND_LABELS[job.kind]]);
  if (job.payGrade) facts.push(['Entgelt', job.payGrade]);
  if (job.workloadPct || job.workloadText) facts.push(['Umfang', job.workloadPct ? `${job.workloadPct} %${job.workloadText && !job.workloadText.includes('%') ? ` (${job.workloadText})` : ''}` : job.workloadText]);
  if (job.fixedTerm || job.isPermanent != null) facts.push(['Befristung', job.isPermanent ? 'unbefristet' : job.fixedTerm ?? 'befristet']);
  if (job.startText) facts.push(['Beginn', job.startText]);
  if (job.referenceNo) facts.push(['Kennziffer', job.referenceNo]);
  if (job.language) facts.push(['Sprache', job.language === 'en' ? 'Englisch' : 'Deutsch']);
  if (job.contact)
    facts.push([
      'Kontakt',
      <a href={`mailto:${job.contact}`}>
        <IconMail width={16} height={16} style={{ verticalAlign: '-3px' }} /> {job.contact}
      </a>,
    ]);

  return (
    <Sheet onClose={closeOverlay} full labelledBy="detail-title">
      <div className="detail-photo">
        <Polaroid src={img.src} credit={img.credit} seed={v.place.cityId ?? job.institutionId ?? job.id} caption={city?.name ?? 'Ort unbekannt'} sub={v.place.distanceKm != null ? `${formatKm(v.place.distanceKm)} von zu Hause` : undefined} tilt={-0.8} />
        <div style={{ position: 'absolute', right: 0, bottom: 22 }}>
          <ScoreRing value={v.score.score} size={76} />
        </div>
      </div>
      {img.credit && <p className="hint" style={{ margin: '-6px 0 8px' }}>{img.credit}</p>}

      <p className="detail-inst">{institutionName(inst)}</p>
      {job.department && <p className="detail-dept">{job.department}</p>}
      <h1 className="detail-title" id="detail-title">
        {job.title}
      </h1>
      <p className="detail-place">
        <IconPin width={16} height={16} /> {city?.name ?? job.locationText ?? 'Ort unbekannt'}
        {inst && <span className="chip">{INSTITUTION_KIND_LABELS[inst.kind]}</span>}
        {job.status === 'abgelaufen' && <span className="chip chip--beige">abgelaufen</span>}
      </p>

      <div className="detail-actions">
        <button type="button" className={`btn ${saved ? 'btn--primary' : ''}`} aria-pressed={saved} onClick={() => store.decide(job.id, saved ? null : 'gemerkt')}>
          <IconHeart filled={saved} width={20} height={20} /> {saved ? 'Gemerkt' : 'Merken'}
        </button>
        <button type="button" className={`btn ${mark?.star ? 'btn--yellow' : ''}`} aria-pressed={!!mark?.star} onClick={() => store.setStar(job.id, !mark?.star)}>
          <IconStar filled={!!mark?.star} width={20} height={20} style={mark?.star ? { color: 'var(--gold)' } : undefined} /> Herzensjob
        </button>
        <button type="button" className={`btn ${mark?.appliedAt ? 'btn--beige' : ''}`} aria-pressed={!!mark?.appliedAt} onClick={() => store.setApplied(job.id, !mark?.appliedAt)}>
          <IconCheck width={20} height={20} /> {mark?.appliedAt ? `Beworben am ${formatDateDe(mark.appliedAt.slice(0, 10))}` : 'Beworben'}
        </button>
        <button type="button" className="btn" aria-pressed={rejected} onClick={() => store.decide(job.id, rejected ? null : 'abgelehnt')}>
          <IconX width={20} height={20} /> {rejected ? 'Weggelegt' : 'Weglegen'}
        </button>
      </div>
      {mark?.star && dl && !dl.past && <p className="hint">Erinnerung {s.settings.reminders.days.map((d) => (d === 1 ? '1 Tag' : `${d} Tage`)).join(', ')} vor der Frist.</p>}

      <h2 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>Passt zu {v.score.score} %</span>
        <button type="button" className="btn btn--quiet btn--small" onClick={() => setShowWhy((x) => !x)} aria-expanded={showWhy}>
          {showWhy ? 'weniger' : 'warum?'}
        </button>
      </h2>
      {showWhy && <Why score={v.score} />}

      <h2 className="section-title">Eckdaten</h2>
      <ul className="facts">
        {facts.map(([k, val]) => (
          <li key={k}>
            <span className="facts__k">{k}</span>
            <span className="facts__v">{val}</span>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0 4px' }}>
        <a className="btn btn--primary" href={job.url} target="_blank" rel="noopener noreferrer">
          <IconExternal width={20} height={20} /> Original-Anzeige
        </a>
        {job.pdfUrl && (
          <a className="btn" href={job.pdfUrl} target="_blank" rel="noopener noreferrer">
            <IconDoc width={20} height={20} /> PDF
          </a>
        )}
        {inst && (
          <button type="button" className="btn" aria-pressed={instFav} onClick={() => store.setFavorite('institution', inst.id, !instFav)}>
            <IconHeart filled={instFav} width={20} height={20} /> {instFav ? 'Lieblingsort' : 'Einrichtung als Lieblingsort'}
          </button>
        )}
      </div>

      {job.summary && job.summaryByAi && (
        <div className="ai-note">
          <b>KI-Kurzfassung</b>
          {job.summary}
        </div>
      )}
      {job.completeness === 'teilweise' && (
        <p className="notice notice--warn" style={{ marginTop: 14 }}>
          Der Text ist vielleicht unvollständig. Der Browser-Agent versucht es beim nächsten Lauf noch einmal. Bis dahin lieber im Original nachlesen.
        </p>
      )}

      <article className="clipping" aria-label="Anzeigentext">
        <span className="tape tape--tr" aria-hidden="true" />
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      <h2 className="section-title">Notiz</h2>
      <textarea
        className="input"
        style={{ minHeight: 90, fontFamily: 'var(--hand)', fontSize: 16 }}
        value={note}
        placeholder="z. B. Ansprechperson, offene Fragen, Ideen fürs Anschreiben"
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (mark?.note ?? '') && store.setNote(job.id, note)}
      />

      <h2 className="section-title">Gefunden über</h2>
      <ul className="facts">
        {(job.sources ?? []).map((src) => (
          <li key={src.sourceId}>
            <span className="facts__k">{src.label ?? 'Quelle'}</span>
            <a className="facts__v" href={src.url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere', fontSize: 14 }}>
              {src.url.replace(/^https?:\/\//, '').slice(0, 70)}
            </a>
          </li>
        ))}
        <li>
          <span className="facts__k">Entdeckt</span>
          <span className="facts__v">{formatDateDe(job.firstSeenAt.slice(0, 10))}</span>
        </li>
      </ul>
    </Sheet>
  );
}
