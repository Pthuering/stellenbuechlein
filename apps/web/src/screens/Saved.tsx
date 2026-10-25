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
import { lang, srForm, texts } from '../i18n';

const SORTS: SavedSort[] = ['frist', 'score', 'neu', 'ort'];

const t = texts({
  de: {
    sorts: { frist: 'Frist', score: 'Score', neu: 'Neu', ort: 'Nähe' } as Record<SavedSort, string>,
    title: 'Gemerkt',
    emptyTitle: 'Noch nichts gemerkt',
    emptyText: 'Im Stapel nach rechts wischen oder in einer Anzeige auf „Merken“ tippen. Mit dem Stern wird sie zum Herzensjob mit Fristen-Erinnerung.',
    toDeck: 'Zum Stapel',
    open: (n: number) => (n === 1 ? '1 offene Anzeige' : `${n} offene Anzeigen`),
    stars: (n: number) => `, ${n} Herzensjob${n === 1 ? '' : 's'}`,
    applied: (n: number) => `, ${n} beworben`,
    remindersLabel: 'Nächste Fristen deiner Herzensjobs',
    sortBy: 'Sortieren nach',
    onlyStars: 'nur Herzensjobs',
    noStars: 'Keine Herzensjobs mit offener Frist.',
    allExpired: 'Alle gemerkten Anzeigen sind abgelaufen.',
    hideExpired: 'Abgelaufene ausblenden',
    showExpired: (n: number) => `${n} abgelaufene anzeigen`,
    expiredHint: 'Gemerkte Anzeigen bleiben auch nach der Frist hier, damit du nachsehen kannst, worauf du dich beworben hast.',
  },
  en: {
    sorts: { frist: 'Deadline', score: 'Match', neu: 'New', ort: 'Nearby' },
    title: 'Saved',
    emptyTitle: 'Nothing saved yet',
    emptyText: 'Swipe right in the stack or tap “Save” on a posting. The star turns it into a dream job with deadline reminders.',
    toDeck: 'Go to the stack',
    open: (n) => (n === 1 ? '1 open posting' : `${n} open postings`),
    stars: (n) => `, ${n} dream ${n === 1 ? 'job' : 'jobs'}`,
    applied: (n) => `, ${n} applied`,
    remindersLabel: 'Upcoming deadlines of your dream jobs',
    sortBy: 'Sort by',
    onlyStars: 'dream jobs only',
    noStars: 'No dream jobs with an open deadline.',
    allExpired: 'All saved postings have expired.',
    hideExpired: 'Hide expired',
    showExpired: (n) => `Show ${n} expired`,
    expiredHint: 'Saved postings stay here after the deadline, so you can look up what you applied for.',
  },
  sr: {
    sorts: { frist: 'Rok', score: 'Poklapanje', neu: 'Novo', ort: 'Blizina' },
    title: 'Sačuvano',
    emptyTitle: 'Još ništa nije sačuvano',
    emptyText: 'U špilu prevuci karticu udesno ili u oglasu dodirni „Sačuvaj“. Zvezdica ga pretvara u posao iz snova sa podsetnikom za rok.',
    toDeck: 'Na špil',
    open: (n) => `${n} ${srForm(n, 'otvoren oglas', 'otvorena oglasa', 'otvorenih oglasa')}`,
    stars: (n) => `, ${n} ${srForm(n, 'posao iz snova', 'posla iz snova', 'poslova iz snova')}`,
    applied: (n) => `, ${n} ${srForm(n, 'prijava', 'prijave', 'prijava')}`,
    remindersLabel: 'Naredni rokovi tvojih poslova iz snova',
    sortBy: 'Sortiraj po',
    onlyStars: 'samo poslovi iz snova',
    noStars: 'Nema poslova iz snova sa otvorenim rokom.',
    allExpired: 'Svim sačuvanim oglasima je istekao rok.',
    hideExpired: 'Sakrij istekle',
    showExpired: (n) => `Prikaži istekle (${n})`,
    expiredHint: 'Sačuvani oglasi ostaju ovde i posle roka, da uvek možeš da proveriš gde su poslate prijave.',
  },
});

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
        <PageHead title={t.title} id="saved-title" />
        <Empty art="heart" title={t.emptyTitle} text={t.emptyText}>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/stapel')}>
            {t.toDeck}
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
            {t.title}
          </h1>
          <p className="page-sub">
            {t.open(open.length)}
            {stars ? t.stars(stars) : ''}
            {applied ? t.applied(applied) : ''}
          </p>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="reminders" aria-label={t.remindersLabel}>
          {notes.map(({ v, left }) => {
            const inst = v.job.institutionId ? s.institutions.get(v.job.institutionId) : undefined;
            return (
              <button type="button" key={v.job.id} className="reminder" onClick={() => openJob(v.job.id)}>
                <b>
                  <IconBell width={16} height={16} style={{ verticalAlign: '-2px' }} /> {reminderText(left, lang())} <span className="reminder__date">({shortDate(v.job.deadline)})</span>
                </b>
                <span>{v.job.title}</span>
                <small>{institutionName(inst, true)}</small>
              </button>
            );
          })}
        </div>
      )}

      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="segmented" role="group" aria-label={t.sortBy}>
          {SORTS.map((key) => (
            <button key={key} type="button" aria-pressed={s.settings.sort.saved === key} onClick={() => store.updateSettings('sort', { ...s.settings.sort, saved: key })}>
              {t.sorts[key]}
            </button>
          ))}
        </div>
        {stars > 0 && (
          <button type="button" className="chip" aria-pressed={onlyStar} onClick={() => setOnlyStar((x) => !x)}>
            {t.onlyStars}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="hint" style={{ margin: '14px 0' }}>
          {onlyStar ? t.noStars : t.allExpired}
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
            {showExpired ? t.hideExpired : t.showExpired(expired.length)}
          </button>
          {showExpired && (
            <>
              <p className="hint">{t.expiredHint}</p>
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
