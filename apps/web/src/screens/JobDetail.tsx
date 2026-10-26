// Die ganze Anzeige: Foto, Eckdaten, warum sie passt, Merken/Herzensjob/beworben, Notiz, vollständiger Text.

import { useEffect, useMemo, useState } from 'react';
import { horizontOf, isAggregatorUrl, type BridgeHit, type FoundVia, type ScoreResult } from '@stellen/core';
import { useAppState, useStore, useViews, type JobView } from '../data/hooks';
import { closeOverlay, leaveOverlayTo } from '../lib/router';
import { deadlineCheckText, deadlineOf, employerName, jobImage, laneLabel, shortDate, unknownPlace } from '../lib/format';
import { setIntent } from '../lib/intent';
import { useTestPhotos } from '../data/testPhotos';
import { renderMarkdown } from '../lib/markdown';
import { Sheet } from '../ui/Sheet';
import { Polaroid } from '../ui/Polaroid';
import { Hearts, ScoreRing } from '../ui/bits';
import { IconCheck, IconDoc, IconExternal, IconHeart, IconMail, IconPin, IconSpark, IconStar, IconX } from '../ui/icons';
import { fmtDate, fmtKm, fmtPct, srForm, texts } from '../i18n';
import { categoryLabel, institutionKindLabel, jobKindLabel } from '../i18n/labels';
import { profileLabel } from '../i18n/katalog';

const t = texts({
  de: {
    profileEmpty: 'Im Suchprofil ist noch nichts eingetragen.',
    pointsOf: (points: number, max: number) => `${points} von ${max} Punkten`,
    halfUnknown: ' (steht nicht in der Anzeige, zählt halb)',
    ratherNot: 'Lieber nicht',
    minusPoints: (n: number) => `−${n} Punkte`,
    whyHint: 'Jede Kategorie ist voll, sobald drei Herzchen getroffen sind. Der Score sortiert nur, aussortiert wird nie.',
    via: { Stellenart: 'Stellenart', Entgelt: 'Entgelt', Umfang: 'Umfang', Befristung: 'Befristung', Sprache: 'Sprache' } as Record<string, string>,
    quote: (term: string) => `„${term}“`,
    field: 'Feld',
    link: 'Anknüpfung',
    verdictFits: 'Die KI hält die Stelle für gut machbar.',
    verdictMaybe: 'Die KI hält die Stelle für möglich, mit Lücken.',
    bridgePaused: (name: string) => `Brücke „${name}“ pausiert. Solche Anzeigen kommen nicht mehr in den Stapel.`,
    undo: 'Rückgängig',
    weiteIntro: 'Außerhalb deiner Kernthemen und ohne Brücke, aber deine Fähigkeiten könnten hier tragen.',
    horizonIntro: 'Außerhalb deiner Kernthemen, aber eine deiner Brücken passt.',
    whyFit: 'Warum das passen könnte:',
    pausedHint: 'Die Brücke ist pausiert, darum kommt die Anzeige nicht mehr in den Stapel.',
    editBridge: 'Brücke bearbeiten',
    pauseBridge: 'Brücke passt nicht, pausieren',
    posting: 'Anzeige',
    gone: 'Diese Anzeige gibt es nicht mehr. Abgelaufene Anzeigen werden nach zwei Wochen aufgeräumt, gemerkte bleiben.',
    fDeadline: 'Frist',
    fKind: 'Stellenart',
    fPay: 'Entgelt',
    fWorkload: 'Umfang',
    fTerm: 'Befristung',
    fStart: 'Beginn',
    fRef: 'Kennziffer',
    fLanguage: 'Sprache',
    fContact: 'Kontakt',
    unclear: 'unklar',
    noneGiven: 'keine angegeben',
    permanent: 'unbefristet',
    fixedTerm: 'befristet',
    langEn: 'Englisch',
    langDe: 'Deutsch',
    fromHome: (km: string) => `${km} von zu Hause`,
    expired: 'abgelaufen',
    saved: 'Gemerkt',
    save: 'Merken',
    dreamJob: 'Herzensjob',
    applied: 'Beworben',
    appliedOn: (date: string) => `Beworben ${date}`,
    passed: 'Weggelegt',
    pass: 'Weglegen',
    reminderHint: (days: number[]) => `Erinnerung ${days.map((d) => (d === 1 ? '1 Tag' : `${d} Tage`)).join(', ')} vor der Frist.`,
    newSiteHead: 'Von einer neuen Website.',
    newSiteText: (employer: string | null, via: FoundVia | null | undefined) =>
      `${employer ? `${employer} steht` : 'Diese Website steht'} noch nicht im Quellen-Register${via === 'erkundung' ? ' (gefunden bei der Suche nach blinden Flecken)' : via === 'portal' ? ' (gefunden über ein Portal)' : ''}.`,
    checkSite: 'Website als Quelle prüfen',
    demoSiteHint: 'In der eingerichteten App lässt sich die Website hier direkt per KI-Probelauf ins Register aufnehmen.',
    aggregatorHint: 'Die Anzeige liegt bei einer Jobbörse; die Website des Arbeitgebers ist noch nicht bekannt.',
    match: (n: number) => `Passt zu ${fmtPct(n)}`,
    less: 'weniger',
    why: 'warum?',
    askAi: 'KI fragen',
    keyFacts: 'Eckdaten',
    demoHead: 'Dummy-Anzeige.',
    demoText: 'Erfunden, damit sich die App ausprobieren lässt.',
    demoInst: 'Der Knopf führt zur echten Stellenliste der Einrichtung; diese Stelle gibt es dort nicht.',
    demoNoEmployer: 'Den Arbeitgeber gibt es nicht.',
    original: 'Original-Anzeige',
    instList: 'Stellenliste der Einrichtung',
    favorite: 'Lieblingsort',
    makeFavorite: 'Einrichtung als Lieblingsort',
    aiSummary: 'KI-Kurzfassung',
    incomplete: 'Der Text ist vielleicht unvollständig. Der Browser-Agent versucht es beim nächsten Lauf noch einmal. Bis dahin lieber im Original nachlesen.',
    postingText: 'Anzeigentext',
    note: 'Notiz',
    notePlaceholder: 'z. B. Ansprechperson, offene Fragen, Ideen fürs Anschreiben',
    foundVia: 'Gefunden über',
    source: 'Quelle',
    discovered: 'Entdeckt',
    notPosting: 'Keine Stellenanzeige',
    notPostingAsk: 'Ist das gar keine einzelne Anzeige, sondern eine Übersicht, Nachricht oder ein Formular? Dann verschwindet die Seite und wird nicht wieder eingesammelt.',
    notPostingYes: 'Ja, keine Stellenanzeige',
    notPostingDone: 'Gemeldet. Die Seite kommt nicht wieder.',
    notPostingFailed: 'Das hat nicht geklappt. Bist du online?',
    cancel: 'Abbrechen',
  },
  en: {
    profileEmpty: 'Your search profile is still empty.',
    pointsOf: (points, max) => `${points} of ${max} points`,
    halfUnknown: ' (not in the posting, counts half)',
    ratherNot: 'Rather not',
    minusPoints: (n) => `−${n} ${n === 1 ? 'point' : 'points'}`,
    whyHint: 'Each category is full once three hearts are matched. The match score only sorts; nothing is ever filtered out.',
    via: { Stellenart: 'position type', Entgelt: 'pay grade', Umfang: 'hours', Befristung: 'permanent contract', Sprache: 'language' },
    quote: (term) => `“${term}”`,
    field: 'Field',
    link: 'link',
    verdictFits: 'The AI thinks this job is very doable.',
    verdictMaybe: 'The AI thinks this job is possible, with some gaps.',
    bridgePaused: (name) => `Bridge “${name}” paused. Postings like this won’t go into the stack anymore.`,
    undo: 'Undo',
    weiteIntro: 'Outside your core topics and without a bridge, but your skills could carry over here.',
    horizonIntro: 'Outside your core topics, but one of your bridges fits.',
    whyFit: 'Why this could fit:',
    pausedHint: 'This bridge is paused, so the posting no longer goes into the stack.',
    editBridge: 'Edit bridge',
    pauseBridge: 'Bridge doesn’t fit, pause it',
    posting: 'Posting',
    gone: 'This posting no longer exists. Expired postings are cleared out after two weeks; saved ones stay.',
    fDeadline: 'Deadline',
    fKind: 'Position type',
    fPay: 'Pay',
    fWorkload: 'Hours',
    fTerm: 'Contract',
    fStart: 'Start',
    fRef: 'Reference no.',
    fLanguage: 'Language',
    fContact: 'Contact',
    unclear: 'unclear',
    noneGiven: 'none given',
    permanent: 'permanent',
    fixedTerm: 'fixed-term',
    langEn: 'English',
    langDe: 'German',
    fromHome: (km) => `${km} from home`,
    expired: 'expired',
    saved: 'Saved',
    save: 'Save',
    dreamJob: 'Dream job',
    applied: 'Applied',
    appliedOn: (date) => `Applied ${date}`,
    passed: 'Passed',
    pass: 'Pass',
    reminderHint: (days) => `Reminder${days.length > 1 ? 's' : ''} ${days.map((d) => (d === 1 ? '1 day' : `${d} days`)).join(', ')} before the deadline.`,
    newSiteHead: 'From a new website.',
    newSiteText: (employer, via) =>
      `${employer ? `${employer} isn’t` : 'This website isn’t'} in the registry yet${via === 'erkundung' ? ' (found while looking for blind spots)' : via === 'portal' ? ' (found via a portal)' : ''}.`,
    checkSite: 'Check website as a source',
    demoSiteHint: 'In the fully set-up app, you can add the website to the registry right here with an AI test run.',
    aggregatorHint: 'The posting is on a job board; the employer’s website isn’t known yet.',
    match: (n) => `${fmtPct(n)} match`,
    less: 'less',
    why: 'why?',
    askAi: 'Ask AI',
    keyFacts: 'Key facts',
    demoHead: 'Demo posting.',
    demoText: 'Made up so you can try out the app.',
    demoInst: 'The button leads to the institution’s real job list; this job isn’t on it.',
    demoNoEmployer: 'The employer doesn’t exist.',
    original: 'Original posting',
    instList: 'Institution’s job list',
    favorite: 'Favorite place',
    makeFavorite: 'Set institution as favorite place',
    aiSummary: 'AI summary',
    incomplete: 'The text may be incomplete. The browser agent will try again on the next run. Until then, better check the original.',
    postingText: 'Posting text',
    note: 'Note',
    notePlaceholder: 'e.g. contact person, open questions, ideas for the cover letter',
    foundVia: 'Found via',
    source: 'Source',
    discovered: 'Discovered',
    notPosting: 'Not a job posting',
    notPostingAsk: 'Is this not a single posting at all, but an overview page, a news item or a form? Then the page disappears and won’t be collected again.',
    notPostingYes: 'Yes, not a job posting',
    notPostingDone: 'Reported. This page won’t come back.',
    notPostingFailed: 'That didn’t work. Are you online?',
    cancel: 'Cancel',
  },
  sr: {
    profileEmpty: 'U profilu pretrage još ništa nije uneto.',
    pointsOf: (points, max) => `${points} od ${max} ${srForm(max, 'poena', 'poena', 'poena')}`,
    halfUnknown: ' (nije navedeno u oglasu, računa se upola)',
    ratherNot: 'Radije ne',
    minusPoints: (n) => `−${n} ${srForm(n, 'poen', 'poena', 'poena')}`,
    whyHint: 'Svaka kategorija je puna čim se pogode tri srca. Poklapanje samo određuje redosled, ništa se ne izbacuje.',
    via: { Stellenart: 'vrsta pozicije', Entgelt: 'platni razred', Umfang: 'obim zaposlenja', Befristung: 'ugovor na neodređeno', Sprache: 'jezik' },
    quote: (term) => `„${term}“`,
    field: 'Oblast',
    link: 'veza',
    verdictFits: 'AI procenjuje da je ovaj posao sasvim izvodljiv.',
    verdictMaybe: 'AI procenjuje da je ovaj posao moguć, ali uz neke praznine.',
    bridgePaused: (name) => `Most „${name}“ je pauziran. Takvi oglasi više neće ulaziti u špil.`,
    undo: 'Opozovi',
    weiteIntro: 'Van tvojih ključnih tema i bez mosta, ali bi tvoje veštine ovde mogle da dođu do izražaja.',
    horizonIntro: 'Van tvojih ključnih tema, ali odgovara jedan od tvojih mostova.',
    whyFit: 'Zašto bi ovo moglo da odgovara:',
    pausedHint: 'Most je pauziran, pa oglas više ne ulazi u špil.',
    editBridge: 'Izmeni most',
    pauseBridge: 'Most ne odgovara, pauziraj ga',
    posting: 'Oglas',
    gone: 'Ovaj oglas više ne postoji. Istekli oglasi se uklanjaju posle dve nedelje, sačuvani ostaju.',
    fDeadline: 'Rok',
    fKind: 'Vrsta pozicije',
    fPay: 'Plata',
    fWorkload: 'Obim zaposlenja',
    fTerm: 'Trajanje ugovora',
    fStart: 'Početak',
    fRef: 'Šifra oglasa',
    fLanguage: 'Jezik',
    fContact: 'Kontakt',
    unclear: 'nejasan',
    noneGiven: 'nije naveden',
    permanent: 'na neodređeno',
    fixedTerm: 'na određeno',
    langEn: 'engleski',
    langDe: 'nemački',
    fromHome: (km) => `${km} od kuće`,
    expired: 'isteklo',
    saved: 'Sačuvano',
    save: 'Sačuvaj',
    dreamJob: 'Posao iz snova',
    applied: 'Prijava poslata',
    appliedOn: (date) => `Prijava poslata ${date}`,
    passed: 'Preskočeno',
    pass: 'Preskoči',
    reminderHint: (days) => `${days.length > 1 ? 'Podsetnici' : 'Podsetnik'} ${days.map((d) => `${d} ${srForm(d, 'dan', 'dana', 'dana')}`).join(', ')} pre roka.`,
    newSiteHead: 'Sa novog sajta.',
    newSiteText: (employer, via) =>
      `${employer ? `${employer} još nije` : 'Ovaj sajt još nije'} u registru${via === 'erkundung' ? ' (oglas je pronađen u potrazi za slepim mrljama)' : via === 'portal' ? ' (oglas je pronađen preko portala)' : ''}.`,
    checkSite: 'Proveri sajt kao izvor',
    demoSiteHint: 'U potpuno podešenoj aplikaciji sajt se ovde odmah može dodati u registar, uz probni prolaz sa AI.',
    aggregatorHint: 'Oglas je objavljen na berzi poslova; sajt poslodavca još nije poznat.',
    match: (n) => `Poklapanje ${fmtPct(n)}`,
    less: 'manje',
    why: 'zašto?',
    askAi: 'Pitaj AI',
    keyFacts: 'Osnovni podaci',
    demoHead: 'Probni oglas.',
    demoText: 'Izmišljen je da bi se aplikacija mogla isprobati.',
    demoInst: 'Dugme vodi na pravu listu oglasa ove ustanove; ovog posla tamo nema.',
    demoNoEmployer: 'Ovaj poslodavac ne postoji.',
    original: 'Originalni oglas',
    instList: 'Lista oglasa ustanove',
    favorite: 'Omiljeno mesto',
    makeFavorite: 'Dodaj ustanovu u omiljena mesta',
    aiSummary: 'AI rezime',
    incomplete: 'Tekst je možda nepotpun. Agent u pregledaču pokušaće ponovo u sledećem prolazu. Do tada je bolje proveriti u originalu.',
    postingText: 'Tekst oglasa',
    note: 'Beleška',
    notePlaceholder: 'npr. osoba za kontakt, otvorena pitanja, ideje za propratno pismo',
    foundVia: 'Pronađeno preko',
    source: 'Izvor',
    discovered: 'Otkriveno',
    notPosting: 'Nije oglas za posao',
    notPostingAsk: 'Da li je ovo zapravo pregled, vest ili formular, a ne pojedinačan oglas? Onda stranica nestaje i više se neće prikupljati.',
    notPostingYes: 'Da, nije oglas za posao',
    notPostingDone: 'Prijavljeno. Ova stranica se više neće pojaviti.',
    notPostingFailed: 'Nije uspelo. Da li si na mreži?',
    cancel: 'Otkaži',
  },
});

/**
 * Kurze Begründung einer Brücke ohne KI, in der Sprache der App: Feld: „a“; Anknüpfung: „b“.
 * Die Begriffe selbst stammen aus dem Suchprofil und bleiben, wie sie sind.
 */
export function bridgeText(hit: BridgeHit): string {
  const quoted = (terms: string[], n: number) =>
    terms
      .slice(0, n)
      .map((x) => t.quote(x))
      .join(', ');
  return `${t.field}: ${quoted(hit.feld, 2)}; ${t.link}: ${quoted(hit.anker, 3)}`;
}

/** Wodurch ein Eintrag getroffen hat: ein Begriff aus der Anzeige („…“) oder eine Angabe (Stellenart, Entgelt …). */
function viaText(via: string): string {
  const m = /^„(.*)“$/.exec(via);
  if (m) return t.quote(m[1]);
  return t.via[via] ?? via;
}

function Why({ score }: { score: ScoreResult }) {
  const cats = score.categories.filter((c) => c.max > 0);
  if (cats.length === 0) return <p className="hint">{t.profileEmpty}</p>;
  return (
    <div className="why">
      {cats.map((c) => (
        <div className="why__cat" key={c.id}>
          <div className="why__head">
            <span>
              {categoryLabel(c.id)} <Hearts value={c.hearts} />
            </span>
            <span className="why__pts">
              {t.pointsOf(Math.round(c.points), Math.round(c.max))}
            </span>
          </div>
          <div className="why__bar" aria-hidden="true">
            <span style={{ width: `${(c.points / (c.max || 1)) * 100}%` }} />
          </div>
          {c.hits.map((h) => (
            <div key={h.item.id} className={`why__item why__item--${h.state}`}>
              <span aria-hidden="true">{h.state === 'ja' ? '✓' : h.state === 'unbekannt' ? '?' : '–'}</span>
              <span>
                {profileLabel(h.item.label)}
                {h.state === 'ja' && h.via ? <span style={{ color: 'var(--text-muted)' }}> ({viaText(h.via)})</span> : null}
                {h.state === 'unbekannt' ? <span style={{ color: 'var(--text-muted)' }}>{t.halfUnknown}</span> : null}
              </span>
            </div>
          ))}
        </div>
      ))}
      {score.penalties.length > 0 && (
        <div className="why__cat">
          <div className="why__head">
            <span>{t.ratherNot}</span>
            <span className="why__pts">{t.minusPoints(score.penalty)}</span>
          </div>
          {score.penalties.map((h) => (
            <div key={h.item.id} className="why__item">
              <span aria-hidden="true">✗</span>
              <span>{profileLabel(h.item.label)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="hint">{t.whyHint}</p>
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
  const verdict = l.verdict === 'passt' ? t.verdictFits : l.verdict === 'eher' ? t.verdictMaybe : null;
  const pause = () => {
    if (!bridge) return;
    const prev = s.settings.profile;
    const h = horizontOf(prev);
    store.updateSettings('profile', { ...prev, horizont: { ...h, bruecken: h.bruecken.map((b) => (b.id === bridge.id ? { ...b, aktiv: false } : b)) }, updatedAt: new Date().toISOString() });
    store.toast(t.bridgePaused(profileLabel(bridge.name)), { label: t.undo, run: () => store.updateSettings('profile', prev) }, 7000);
  };
  return (
    <div className="horizon-note">
      <p className="horizon-note__head">{laneLabel(l)}</p>
      <p>
        {l.lane === 'weite' ? t.weiteIntro : t.horizonIntro}{' '}
        {verdict}
      </p>
      {l.reason && (
        <p>
          <b>{t.whyFit}</b> {l.reason}
        </p>
      )}
      {l.bridge && <p className="hint">{bridgeText(l.bridge)}</p>}
      {!l.promoted && l.lane === 'horizont' && <p className="hint">{t.pausedHint}</p>}
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
            {t.editBridge}
          </button>
        )}
        {bridge && bridge.aktiv && (
          <button type="button" className="btn btn--small btn--quiet" onClick={pause}>
            {t.pauseBridge}
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
  const [askNotPosting, setAskNotPosting] = useState(false);
  const [note, setNote] = useState(v?.mark?.note ?? '');
  useEffect(() => setNote(v?.mark?.note ?? ''), [id, v?.mark?.note]);
  const html = useMemo(() => (v ? renderMarkdown(v.job.descriptionMd) : ''), [v?.job.descriptionMd]);

  if (!v) {
    return (
      <Sheet title={t.posting} onClose={closeOverlay}>
        <p>{t.gone}</p>
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
      t.fDeadline,
      <>
        <span className={dl.unsure ? 'deadline-unsure' : dl.urgent ? 'marker' : ''}>{dl.date}</span> <span style={{ color: 'var(--text-muted)' }}>{dl.left}</span>
        {dlText && <small className={`facts__note ${dl.unsure ? 'facts__note--warn' : ''}`}>{dlText}</small>}
      </>,
    ]);
  else if (dl)
    facts.push([
      t.fDeadline,
      <>
        <span className="deadline-unsure">{t.unclear}</span>
        {dlText && <small className="facts__note facts__note--warn">{dlText}</small>}
      </>,
    ]);
  else facts.push([t.fDeadline, <span style={{ color: 'var(--text-muted)' }}>{t.noneGiven}</span>]);
  if (job.kind) facts.push([t.fKind, jobKindLabel(job.kind)]);
  if (job.payGrade) facts.push([t.fPay, job.payGrade]);
  if (job.workloadPct || job.workloadText) facts.push([t.fWorkload, job.workloadPct ? `${fmtPct(job.workloadPct)}${job.workloadText && !job.workloadText.includes('%') ? ` (${job.workloadText})` : ''}` : job.workloadText]);
  if (job.fixedTerm || job.isPermanent != null) facts.push([t.fTerm, job.isPermanent ? t.permanent : job.fixedTerm ?? t.fixedTerm]);
  if (job.startText) facts.push([t.fStart, job.startText]);
  if (job.referenceNo) facts.push([t.fRef, job.referenceNo]);
  if (job.language) facts.push([t.fLanguage, job.language === 'en' ? t.langEn : t.langDe]);
  if (job.contact)
    facts.push([
      t.fContact,
      <a href={`mailto:${job.contact}`}>
        <IconMail width={16} height={16} style={{ verticalAlign: '-3px' }} /> {job.contact}
      </a>,
    ]);

  return (
    <Sheet onClose={closeOverlay} full labelledBy="detail-title">
      <div className="detail-photo">
        <Polaroid src={img.src} credit={img.credit} seed={v.place.cityId ?? job.institutionId ?? job.id} caption={city?.name ?? unknownPlace()} sub={v.place.distanceKm != null ? t.fromHome(fmtKm(v.place.distanceKm)) : undefined} tilt={-0.8} />
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
        <IconPin width={16} height={16} /> {city?.name ?? job.locationText ?? unknownPlace()}
        {inst && <span className="chip">{institutionKindLabel(inst.kind)}</span>}
        {job.status === 'abgelaufen' && <span className="chip chip--neutral">{t.expired}</span>}
      </p>

      <div className="detail-actions">
        <button type="button" className={`btn ${saved ? 'btn--primary' : ''}`} aria-pressed={saved} onClick={() => store.decide(job.id, saved ? null : 'gemerkt')}>
          <IconHeart filled={saved} width={20} height={20} /> {saved ? t.saved : t.save}
        </button>
        <button type="button" className={`btn ${mark?.star ? 'btn--accent' : ''}`} aria-pressed={!!mark?.star} onClick={() => store.setStar(job.id, !mark?.star)}>
          <IconStar filled={!!mark?.star} width={20} height={20} style={mark?.star ? { color: 'var(--accent-strong)' } : undefined} /> {t.dreamJob}
        </button>
        <button type="button" className={`btn ${mark?.appliedAt ? 'btn--secondary' : ''}`} aria-pressed={!!mark?.appliedAt} onClick={() => store.setApplied(job.id, !mark?.appliedAt)}>
          <IconCheck width={20} height={20} /> {mark?.appliedAt ? t.appliedOn(shortDate(mark.appliedAt)) : t.applied}
        </button>
        <button type="button" className="btn" aria-pressed={rejected} onClick={() => store.decide(job.id, rejected ? null : 'abgelehnt')}>
          <IconX width={20} height={20} /> {rejected ? t.passed : t.pass}
        </button>
      </div>
      {mark?.star && dl && dl.date && !dl.past && <p className="hint">{t.reminderHint(s.settings.reminders.days)}</p>}

      <HorizonNote v={v} />
      {job.newSite && (
        <div className="notice" style={{ marginTop: 12 }}>
          <b>{t.newSiteHead}</b> {t.newSiteText(job.employer ?? null, job.foundVia)}
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
                {t.checkSite}
              </button>
            </div>
          ) : !isAggregatorUrl(job.url) ? (
            <p className="hint" style={{ margin: '6px 0 0' }}>{t.demoSiteHint}</p>
          ) : (
            <p className="hint" style={{ margin: '6px 0 0' }}>{t.aggregatorHint}</p>
          )}
        </div>
      )}

      <h2 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>{t.match(v.score.score)}</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn--quiet btn--small" onClick={() => setShowWhy((x) => !x)} aria-expanded={showWhy}>
            {showWhy ? t.less : t.why}
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
              <IconSpark width={18} height={18} /> {t.askAi}
            </button>
          )}
        </span>
      </h2>
      {showWhy && <Why score={v.score} />}

      <h2 className="section-title">{t.keyFacts}</h2>
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
          <b>{t.demoHead}</b> {t.demoText} {job.institutionId ? t.demoInst : t.demoNoEmployer}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0 4px' }}>
        {!job.dummy ? (
          <a className="btn btn--primary" href={job.url} target="_blank" rel="noopener noreferrer">
            <IconExternal width={20} height={20} /> {t.original}
          </a>
        ) : job.institutionId ? (
          <a className="btn btn--primary" href={job.url} target="_blank" rel="noopener noreferrer">
            <IconExternal width={20} height={20} /> {t.instList}
          </a>
        ) : null}
        {job.pdfUrl && (
          <a className="btn" href={job.pdfUrl} target="_blank" rel="noopener noreferrer">
            <IconDoc width={20} height={20} /> PDF
          </a>
        )}
        {inst && (
          <button type="button" className="btn" aria-pressed={instFav} onClick={() => store.setFavorite('institution', inst.id, !instFav)}>
            <IconHeart filled={instFav} width={20} height={20} /> {instFav ? t.favorite : t.makeFavorite}
          </button>
        )}
      </div>

      {job.summary && job.summaryByAi && (
        <div className="ai-note">
          <b>{t.aiSummary}</b>
          {job.summary}
        </div>
      )}
      {job.completeness === 'teilweise' && (
        <p className="notice notice--warn" style={{ marginTop: 14 }}>
          {t.incomplete}
        </p>
      )}

      <article className="clipping" aria-label={t.postingText}>
        <span className="tape tape--tr" aria-hidden="true" />
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>

      <h2 className="section-title">{t.note}</h2>
      <textarea
        className="input"
        style={{ minHeight: 90, fontFamily: 'var(--hand)', fontSize: 16 }}
        value={note}
        placeholder={t.notePlaceholder}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (mark?.note ?? '') && store.setNote(job.id, note)}
      />

      <h2 className="section-title">{t.foundVia}</h2>
      <ul className="facts">
        {(job.sources ?? []).map((src) => (
          <li key={src.sourceId}>
            <span className="facts__k">{src.label ?? t.source}</span>
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
          <span className="facts__k">{t.discovered}</span>
          <span className="facts__v">{fmtDate(job.firstSeenAt)}</span>
        </li>
      </ul>
      {!job.dummy && !s.demo && (
        <div style={{ margin: '14px 0 4px' }}>
          {!askNotPosting ? (
            <button type="button" className="btn btn--quiet btn--small" onClick={() => setAskNotPosting(true)}>
              <IconX width={16} height={16} /> {t.notPosting}
            </button>
          ) : (
            <div className="notice">
              <p style={{ margin: '0 0 8px' }}>{t.notPostingAsk}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={async () => {
                    try {
                      await store.reportNotPosting(job.id);
                      store.toast(t.notPostingDone);
                      closeOverlay();
                    } catch {
                      store.toast(t.notPostingFailed);
                    }
                  }}
                >
                  {t.notPostingYes}
                </button>
                <button type="button" className="btn btn--quiet btn--small" onClick={() => setAskNotPosting(false)}>
                  {t.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
