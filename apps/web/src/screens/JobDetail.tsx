// Die ganze Anzeige: Foto, Eckdaten, warum sie passt, Merken/Herzensjob/beworben, Notiz, vollständiger Text.

import { useEffect, useMemo, useState } from 'react';
import { bridgeExplanation, CATEGORY_LABELS, formatDateDe, formatKm, horizontOf, INSTITUTION_KIND_LABELS, isAggregatorUrl, JOB_KIND_LABELS, type ScoreResult } from '@stellen/core';
import { useAppState, useStore, useViews, type JobView } from '../data/hooks';
import { closeOverlay, leaveOverlayTo } from '../lib/router';
import { deadlineCheckText, deadlineOf, employerName, jobImage, laneLabel, shortDate } from '../lib/format';
import { setIntent } from '../lib/intent';
import { useTestPhotos } from '../data/testPhotos';
import { renderMarkdown } from '../lib/markdown';
import { Sheet } from '../ui/Sheet';
import { Polaroid } from '../ui/Polaroid';
import { Hearts, ScoreRing } from '../ui/bits';
import { IconCheck, IconDoc, IconExternal, IconHeart, IconMail, IconPin, IconSpark, IconStar, IconX } from '../ui/icons';

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
                {h.state === 'ja' && h.via ? <span style={{ color: 'var(--text-muted)' }}> ({h.via})</span> : null}
                {h.state === 'unbekannt' ? <span style={{ color: 'var(--text-muted)' }}> (steht nicht in der Anzeige, zählt halb)</span> : null}
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

/** Horizont und Weite: warum die Anzeige trotz fehlendem Psychologie-Bezug hier ist, und Knöpfe dafür. */
function HorizonNote({ v }: { v: JobView }) {
  const s = useAppState();
  const store = useStore();
  const l = v.lane;
  if (l.lane === 'kern') return null;
  const bridge = l.bridge?.bridge ?? null;
  const verdict = l.verdict === 'passt' ? 'Die KI hält die Stelle für gut machbar.' : l.verdict === 'eher' ? 'Die KI hält die Stelle für möglich, mit Lücken.' : null;
  const pause = () => {
    if (!bridge) return;
    const prev = s.settings.profile;
    const h = horizontOf(prev);
    store.updateSettings('profile', { ...prev, horizont: { ...h, bruecken: h.bruecken.map((b) => (b.id === bridge.id ? { ...b, aktiv: false } : b)) }, updatedAt: new Date().toISOString() });
    store.toast(`Brücke „${bridge.name}“ pausiert. Solche Anzeigen kommen nicht mehr in den Stapel.`, { label: 'Rückgängig', run: () => store.updateSettings('profile', prev) }, 7000);
  };
  return (
    <div className="horizon-note">
      <p className="horizon-note__head">{laneLabel(l)}</p>
      <p>
        {l.lane === 'weite'
          ? 'Außerhalb deiner Kernthemen und ohne Brücke, aber deine Fähigkeiten könnten hier tragen.'
          : 'Außerhalb deiner Kernthemen, aber eine deiner Brücken passt.'}{' '}
        {verdict}
      </p>
      {l.reason && (
        <p>
          <b>Warum das passen könnte:</b> {l.reason}
        </p>
      )}
      {l.bridge && <p className="hint">{bridgeExplanation(l.bridge)}</p>}
      {!l.promoted && l.lane === 'horizont' && <p className="hint">Die Brücke ist pausiert, darum kommt die Anzeige nicht mehr in den Stapel.</p>}
      <div className="horizon-note__actions">
        {bridge && (
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              setIntent('editBridge', bridge.id);
              leaveOverlayTo('/ich/horizont');
            }}
          >
            Brücke bearbeiten
          </button>
        )}
        {bridge && bridge.aktiv && (
          <button type="button" className="btn btn--small btn--quiet" onClick={pause}>
            Brücke passt nicht, pausieren
          </button>
        )}
      </div>
    </div>
  );
}

export function JobDetail({ id }: { id: string }) {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const testPhotos = useTestPhotos();
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
  const img = jobImage(job, inst, city, testPhotos);
  const dl = deadlineOf(job);
  const dlText = dl ? deadlineCheckText(dl) : null;
  const saved = mark?.decision === 'gemerkt';
  const rejected = mark?.decision === 'abgelehnt';
  const instFav = inst ? store.isFavorite('institution', inst.id) : false;

  const facts: [string, React.ReactNode][] = [];
  if (dl && dl.date)
    facts.push([
      'Frist',
      <>
        <span className={dl.unsure ? 'deadline-unsure' : dl.urgent ? 'marker' : ''}>{dl.date}</span> <span style={{ color: 'var(--text-muted)' }}>{dl.left}</span>
        {dlText && <small className={`facts__note ${dl.unsure ? 'facts__note--warn' : ''}`}>{dlText}</small>}
      </>,
    ]);
  else if (dl)
    facts.push([
      'Frist',
      <>
        <span className="deadline-unsure">unklar</span>
        {dlText && <small className="facts__note facts__note--warn">{dlText}</small>}
      </>,
    ]);
  else facts.push(['Frist', <span style={{ color: 'var(--text-muted)' }}>keine angegeben</span>]);
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

      <p className="detail-inst">{employerName(job, inst)}</p>
      {job.department && <p className="detail-dept">{job.department}</p>}
      <h1 className="detail-title" id="detail-title">
        {job.title}
      </h1>
      <p className="detail-place">
        <IconPin width={16} height={16} /> {city?.name ?? job.locationText ?? 'Ort unbekannt'}
        {inst && <span className="chip">{INSTITUTION_KIND_LABELS[inst.kind]}</span>}
        {job.status === 'abgelaufen' && <span className="chip chip--neutral">abgelaufen</span>}
      </p>

      <div className="detail-actions">
        <button type="button" className={`btn ${saved ? 'btn--primary' : ''}`} aria-pressed={saved} onClick={() => store.decide(job.id, saved ? null : 'gemerkt')}>
          <IconHeart filled={saved} width={20} height={20} /> {saved ? 'Gemerkt' : 'Merken'}
        </button>
        <button type="button" className={`btn ${mark?.star ? 'btn--accent' : ''}`} aria-pressed={!!mark?.star} onClick={() => store.setStar(job.id, !mark?.star)}>
          <IconStar filled={!!mark?.star} width={20} height={20} style={mark?.star ? { color: 'var(--accent-strong)' } : undefined} /> Herzensjob
        </button>
        <button type="button" className={`btn ${mark?.appliedAt ? 'btn--secondary' : ''}`} aria-pressed={!!mark?.appliedAt} onClick={() => store.setApplied(job.id, !mark?.appliedAt)}>
          <IconCheck width={20} height={20} /> {mark?.appliedAt ? `Beworben ${shortDate(mark.appliedAt)}` : 'Beworben'}
        </button>
        <button type="button" className="btn" aria-pressed={rejected} onClick={() => store.decide(job.id, rejected ? null : 'abgelehnt')}>
          <IconX width={20} height={20} /> {rejected ? 'Weggelegt' : 'Weglegen'}
        </button>
      </div>
      {mark?.star && dl && dl.date && !dl.past && <p className="hint">Erinnerung {s.settings.reminders.days.map((d) => (d === 1 ? '1 Tag' : `${d} Tage`)).join(', ')} vor der Frist.</p>}

      <HorizonNote v={v} />
      {job.newSite && (
        <div className="notice" style={{ marginTop: 12 }}>
          <b>Von einer neuen Website.</b> {job.employer ? `${job.employer} steht` : 'Diese Website steht'} noch nicht im Quellen-Register
          {job.foundVia === 'erkundung' ? ' (gefunden bei der Suche nach blinden Flecken)' : job.foundVia === 'portal' ? ' (gefunden über ein Portal)' : ''}.
          {!isAggregatorUrl(job.url) && !s.demo ? (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  setIntent('checkUrl', new URL(job.url).origin + '/');
                  leaveOverlayTo('/ich/quellen');
                }}
              >
                Website als Quelle prüfen
              </button>
            </div>
          ) : !isAggregatorUrl(job.url) ? (
            <p className="hint" style={{ margin: '6px 0 0' }}>In der eingerichteten App lässt sich die Website hier direkt per KI-Probelauf ins Register aufnehmen.</p>
          ) : (
            <p className="hint" style={{ margin: '6px 0 0' }}>Die Anzeige liegt bei einer Jobbörse; die Website des Arbeitgebers ist noch nicht bekannt.</p>
          )}
        </div>
      )}

      <h2 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>Passt zu {v.score.score} %</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn--quiet btn--small" onClick={() => setShowWhy((x) => !x)} aria-expanded={showWhy}>
            {showWhy ? 'weniger' : 'warum?'}
          </button>
          {s.aiSuggest && !s.demo && (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setIntent('kiAnzeige', job.id);
                leaveOverlayTo('/ich/ki');
              }}
            >
              <IconSpark width={18} height={18} /> KI fragen
            </button>
          )}
        </span>
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

      {job.dummy && (
        <p className="notice notice--info" style={{ marginTop: 14 }}>
          <b>Dummy-Anzeige.</b> Erfunden, damit sich die App ausprobieren lässt.{' '}
          {job.institutionId ? 'Der Knopf führt zur echten Stellenliste der Einrichtung; diese Stelle gibt es dort nicht.' : 'Den Arbeitgeber gibt es nicht.'}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0 4px' }}>
        {!job.dummy ? (
          <a className="btn btn--primary" href={job.url} target="_blank" rel="noopener noreferrer">
            <IconExternal width={20} height={20} /> Original-Anzeige
          </a>
        ) : job.institutionId ? (
          <a className="btn btn--primary" href={job.url} target="_blank" rel="noopener noreferrer">
            <IconExternal width={20} height={20} /> Stellenliste der Einrichtung
          </a>
        ) : null}
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
            {/\.example\//.test(src.url) ? (
              // erfundene Adresse der Dummy-Daten: kein Link
              <span className="facts__v" style={{ overflowWrap: 'anywhere', fontSize: 14 }}>
                {src.url.replace(/^https?:\/\//, '').slice(0, 70)}
              </span>
            ) : (
              <a className="facts__v" href={src.url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere', fontSize: 14 }}>
                {src.url.replace(/^https?:\/\//, '').slice(0, 70)}
              </a>
            )}
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
