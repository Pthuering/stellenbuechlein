// "Ich": Suchprofil (mit Umfrage), Lieblingsorte, Zuhause, Erinnerungen, Quellen, Aussehen.

import { useRef, useState, type ReactNode } from 'react';
import { CATEGORY_ORDER, freigabeZustand, freigeben, horizontOf } from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { lsDel } from '../../data/local';
import { addTestPhotos, clearTestPhotos, useTestPhotos } from '../../data/testPhotos';
import { navigate } from '../../lib/router';
import { relativeTime } from '../../lib/format';
import { getTheme, setTheme, type ThemeChoice } from '../../lib/theme';
import { Hearts } from '../../ui/bits';
import { PageHead } from '../../ui/PageHead';
import { IconChevron } from '../../ui/icons';
import { LangSwitch } from '../../ui/LangSwitch';
import { fmtDate, fmtPct, srForm, texts } from '../../i18n';
import { categoryLabel, dosisCards } from '../../i18n/labels';
import { profileLabel, profileName } from '../../i18n/katalog';
import { ProfileEditor } from './ProfileEditor';
import { SteckbriefImport } from './SteckbriefImport';
import { PlacesPage } from './PlacesPage';
import { HomePage } from './HomePage';
import { RemindersPage } from './RemindersPage';
import { SourcesPage } from './SourcesPage';
import { AboutPage } from './AboutPage';
import { HorizontPage } from './HorizontPage';
import { ChecklistPage, useChecklist } from './ChecklistPage';
import { AssistantPage } from './AssistantPage';
import { UmfragePage } from './UmfragePage';

const t = texts({
  de: {
    me: 'Ich',
    origin: {
      start: 'Startprofil: breit gehalten, bis dein Steckbrief da ist',
      steckbrief: 'aus deinem Steckbrief',
      manuell: 'selbst zusammengestellt',
    } as Record<'start' | 'steckbrief' | 'manuell', string>,
    surveyContinue: 'Umfrage fortsetzen',
    surveyView: 'Umfrage ansehen',
    surveyStart: 'Umfrage für Profil starten',
    profileKicker: 'Suchprofil',
    emptyRunning: (page: number) => `Noch leer. Die Umfrage ist angefangen (Seite ${page}), dein Zwischenstand ist gespeichert.`,
    emptyStart: 'Noch leer. Die Umfrage fragt Schritt für Schritt alles ab, was das Profil braucht, mit Vorschlägen zum Antippen. Etwa 15 Minuten.',
    changed: (origin: string, date: string) => `${origin}, geändert am ${date}`,
    emptyCategory: 'leer, zählt nicht',
    more: (n: number) => ` und ${n} weitere`,
    avoid: 'Lieber nicht',
    horizon: 'Horizont',
    bridges: (n: number, names: string) => `${n} Brücken (${names})`,
    noBridges: 'keine Brücken',
    adjustProfile: 'Profil anpassen',
    importSheet: 'Steckbrief importieren',
    bigRunStarted: 'Großer Durchlauf gestartet. Er liest alle Quellen ohne Grenzen neu und kann einige Stunden dauern; neue Anzeigen erscheinen nach und nach.',
    approvedOn: (date: string) => `Profil freigegeben am ${date}. `,
    bigRunRequested: (when: string) => `Großer Durchlauf ${when} angestoßen. `,
    starting: 'startet …',
    bigRunAgain: 'Großen Durchlauf erneut starten',
    reviewTitle: 'Profil prüfen und freigeben',
    changedTitle: 'Profil geändert',
    reviewText: 'Schau dir dein Profil an und pass an, was nicht stimmt. Mit der Freigabe startet der große Durchlauf: Er liest alle Quellen ohne Grenzen neu und ordnet alles nach diesem Profil ein. Das kann einige Stunden dauern.',
    changedText: 'Seit der letzten Freigabe hat sich dein Profil geändert. Ein neuer großer Durchlauf liest alles nach dem neuen Profil ein.',
    approveAndRun: 'Freigeben und großen Durchlauf starten',
    bigRun: 'Großen Durchlauf starten',
    later: 'Später',
    needsToken: 'Für den Start braucht der Worker ein GitHub-Token (docs/SCHLUESSEL.md).',
    testPhotosTitle: 'Testfotos für die Demo',
    testPhotosText: 'Die Dummy-Anzeigen haben keine Fotos. Wähl ein paar Bilder aus deiner Galerie, die Demo verteilt sie auf alle Einrichtungen. Sie bleiben nur in diesem Browser.',
    testPhotosCount: (n: number) => `${n} Testfotos`,
    loading: 'wird geladen …',
    morePhotos: 'Weitere Fotos wählen',
    choosePhotos: 'Fotos wählen',
    removePhotos: 'Testfotos entfernen',
    photosRemoved: 'Testfotos entfernt.',
    photosAddedFailed: (added: number, failed: number) => `${added} Fotos übernommen, ${failed} ließen sich nicht lesen.`,
    photosAdded: (added: number) => `${added} Fotos übernommen. Schau in den Stapel.`,
    ingestStarted: 'Einsammeln gestartet. Neue Anzeigen sind in etwa 15 bis 30 Minuten da.',
    meSub: 'Suchprofil, Orte und Einstellungen',
    checklist: 'Platzhalter-Checkliste',
    checklistSubDemo: 'Was noch Dummy, Beispiel oder Standardwert ist',
    checklistSub: 'Was vor dem echten Betrieb noch zu ersetzen ist',
    open: (n: number) => `${n} offen`,
    allDone: 'alles erledigt',
    search: 'Suche',
    horizonSub: 'Stellen außerhalb des Kernbereichs über Brücken, im Stapel eingestreut',
    favorites: 'Lieblingsorte',
    favoritesSub: 'Bundesländer, Städte, Einrichtungen: stehen immer oben',
    none: 'keine',
    home: 'Zuhause & Umkreis',
    allGermany: 'ganz DE',
    reminders: 'Erinnerungen',
    reminderDays: (days: number[]) => (days.length ? `${days.map((d) => (d === 1 ? '1 Tag' : d === 0 ? 'am Tag' : `${d} Tage`)).join(', ')} vorher` : 'aus'),
    remindersSub: (deadlines: string, newJobs: string) => `Fristen: ${deadlines}; neue Anzeigen: ${newJobs}`,
    fromPct: (pct: string) => `ab ${pct}`,
    off: 'aus',
    withPush: 'mit Push',
    appOnly: 'nur in der App',
    ai: 'KI',
    assistant: 'KI-Assistent',
    assistantSub: 'Fragen zu Anzeigen, Profil und Brücken; recherchiert in allen Anzeigen, schlägt Änderungen vor; mit Verbrauch',
    demo: 'Demo',
    notSetUp: 'nicht eingerichtet',
    collecting: 'Einsammeln',
    sources: 'Quellen & Läufe',
    sourcesSub: (total: number, problems: number, missingUrl: number) =>
      `${total} ${total === 1 ? 'Quelle' : 'Quellen'}, ${problems ? `${problems} mit Problemen` : 'keine Probleme'}${missingUrl ? `, ${missingUrl} ohne Adresse` : ''}`,
    notLoaded: 'noch nicht geladen',
    noRun: 'noch kein Lauf',
    dailyDemo: 'Täglich gegen 12 Uhr, in der Demo nicht',
    dailyTrigger: 'Täglich gegen 12 Uhr, mit mindestens drei Anzeigen von neuen Websites. Oder jetzt sofort.',
    dailyNoTrigger: 'Täglich gegen 12 Uhr. Für „Jetzt“ braucht der Worker ein GitHub-Token.',
    now: 'Jetzt',
    sync: 'Abgleich mit dem Server',
    syncDemo: 'Demo: alles bleibt in diesem Browser',
    lastSync: (when: string, pending: number) => `zuletzt ${when}${pending ? `, ${pending} Änderung${pending === 1 ? '' : 'en'} warten` : ''}`,
    syncing: 'läuft …',
    appearance: 'Aussehen',
    cardImages: 'Bilder auf den Karten im Stapel',
    cardImagesHint: 'Foto aus der Anzeige, von der Einrichtung oder der Stadt, sonst eine Skizze. Aus: mehr Platz für den Text.',
    colorScheme: 'Farbschema',
    themes: { auto: 'wie das Gerät', hell: 'hell', dunkel: 'dunkel' } as Record<ThemeChoice, string>,
    language: 'Sprache',
    app: 'App',
    about: 'Über die App',
    aboutSub: (version: string) => `Taras Cutesy Jobsearch App, Version ${version}, Quellen der Karten und Bilder`,
    resetDemo: 'Demo zurücksetzen',
    resetDemoSub: 'Gemerkte, Weggelegte, Einstellungen und Haken der Checkliste auf den Anfang',
    logout: 'Abmelden',
    logoutSub: 'App-Schlüssel auf diesem Gerät vergessen',
  },
  en: {
    me: 'Me',
    origin: {
      start: 'Starter profile: kept broad until your profile sheet is in',
      steckbrief: 'from your profile sheet',
      manuell: 'put together by you',
    },
    surveyContinue: 'Continue questionnaire',
    surveyView: 'View questionnaire',
    surveyStart: 'Start profile questionnaire',
    profileKicker: 'Search profile',
    emptyRunning: (page) => `Still empty. The questionnaire is under way (page ${page}) and your progress is saved.`,
    emptyStart: 'Still empty. The questionnaire asks step by step for everything the profile needs, with suggestions you just tap. About 15 minutes.',
    changed: (origin, date) => `${origin}, last changed ${date}`,
    emptyCategory: 'empty, doesn’t count',
    more: (n) => ` and ${n} more`,
    avoid: 'Rather not',
    horizon: 'Horizon',
    bridges: (n, names) => `${n} ${n === 1 ? 'bridge' : 'bridges'} (${names})`,
    noBridges: 'no bridges',
    adjustProfile: 'Adjust profile',
    importSheet: 'Import profile sheet',
    bigRunStarted: 'Full run started. It rereads all sources without limits and can take a few hours; new postings will show up gradually.',
    approvedOn: (date) => `Profile approved on ${date}. `,
    bigRunRequested: (when) => `Full run started ${when}. `,
    starting: 'starting…',
    bigRunAgain: 'Start full run again',
    reviewTitle: 'Review and approve your profile',
    changedTitle: 'Profile changed',
    reviewText: 'Look through your profile and fix whatever isn’t right. Approving it starts the full run: it rereads all sources without limits and sorts everything by this profile. That can take a few hours.',
    changedText: 'Your profile has changed since you last approved it. A new full run reads everything in again based on the new profile.',
    approveAndRun: 'Approve and start full run',
    bigRun: 'Start full run',
    later: 'Later',
    needsToken: 'To start it, the Worker needs a GitHub token (docs/SCHLUESSEL.md).',
    testPhotosTitle: 'Test photos for the demo',
    testPhotosText: 'The demo postings have no photos. Pick a few pictures from your gallery and the demo spreads them across all institutions. They stay in this browser only.',
    testPhotosCount: (n) => `${n} test ${n === 1 ? 'photo' : 'photos'}`,
    loading: 'loading…',
    morePhotos: 'Choose more photos',
    choosePhotos: 'Choose photos',
    removePhotos: 'Remove test photos',
    photosRemoved: 'Test photos removed.',
    photosAddedFailed: (added, failed) => `${added} ${added === 1 ? 'photo' : 'photos'} added, ${failed} couldn’t be read.`,
    photosAdded: (added) => `${added} ${added === 1 ? 'photo' : 'photos'} added. Take a look at the stack.`,
    ingestStarted: 'Collecting started. New postings will arrive in about 15 to 30 minutes.',
    meSub: 'Search profile, places and settings',
    checklist: 'Placeholder checklist',
    checklistSubDemo: 'What is still demo data, an example or a default',
    checklistSub: 'What still needs replacing before real use',
    open: (n) => `${n} open`,
    allDone: 'all done',
    search: 'Search',
    horizonSub: 'Jobs beyond the core field via bridges, mixed into the stack',
    favorites: 'Favorite places',
    favoritesSub: 'Federal states, cities, institutions: always on top',
    none: 'none',
    home: 'Home & radius',
    allGermany: 'all of Germany',
    reminders: 'Reminders',
    reminderDays: (days) => (days.length ? days.map((d) => (d === 0 ? 'on the day' : `${d} ${d === 1 ? 'day' : 'days'} before`)).join(', ') : 'off'),
    remindersSub: (deadlines, newJobs) => `Deadlines: ${deadlines}; new postings: ${newJobs}`,
    fromPct: (pct) => `from ${pct}`,
    off: 'off',
    withPush: 'with push',
    appOnly: 'in the app only',
    ai: 'AI',
    assistant: 'AI assistant',
    assistantSub: 'Questions about postings, profile and bridges; searches all postings, suggests changes; shows usage',
    demo: 'Demo',
    notSetUp: 'not set up',
    collecting: 'Collecting',
    sources: 'Sources & runs',
    sourcesSub: (total, problems, missingUrl) =>
      `${total} ${total === 1 ? 'source' : 'sources'}, ${problems ? `${problems} with problems` : 'no problems'}${missingUrl ? `, ${missingUrl} without a URL` : ''}`,
    notLoaded: 'not loaded yet',
    noRun: 'no run yet',
    dailyDemo: 'Daily around noon; not in the demo',
    dailyTrigger: 'Daily around noon, with at least three postings from new websites. Or right now.',
    dailyNoTrigger: 'Daily around noon. For “Now”, the Worker needs a GitHub token.',
    now: 'Now',
    sync: 'Sync with the server',
    syncDemo: 'Demo: everything stays in this browser',
    lastSync: (when, pending) => `last synced ${when}${pending ? `, ${pending} ${pending === 1 ? 'change' : 'changes'} waiting` : ''}`,
    syncing: 'syncing…',
    appearance: 'Appearance',
    cardImages: 'Pictures on the cards in the stack',
    cardImagesHint: 'A photo from the posting, the institution or the city, otherwise a sketch. Off: more room for the text.',
    colorScheme: 'Color scheme',
    themes: { auto: 'match device', hell: 'light', dunkel: 'dark' },
    language: 'Language',
    app: 'App',
    about: 'About the app',
    aboutSub: (version) => `Taras Cutesy Jobsearch App, version ${version}, credits for maps and pictures`,
    resetDemo: 'Reset demo',
    resetDemoSub: 'Saved and passed postings, settings and checklist ticks back to the start',
    logout: 'Log out',
    logoutSub: 'Forget the app key on this device',
  },
  sr: {
    me: 'Ja',
    origin: {
      start: 'Početni profil: namerno širok dok ne stigne tvoj lični karton',
      steckbrief: 'iz tvog ličnog kartona',
      manuell: 'samostalno sastavljen',
    },
    surveyContinue: 'Nastavi upitnik',
    surveyView: 'Pogledaj upitnik',
    surveyStart: 'Pokreni upitnik za profil',
    profileKicker: 'Profil pretrage',
    emptyRunning: (page) => `Još je prazan. Upitnik je započet (stranica ${page}), a dosadašnji odgovori su sačuvani.`,
    emptyStart: 'Još je prazan. Upitnik korak po korak pita sve što je profilu potrebno, uz predloge koje samo dodirneš. Traje oko 15 minuta.',
    changed: (origin, date) => `${origin}, poslednja izmena: ${date}`,
    emptyCategory: 'prazno, ne računa se',
    more: (n) => ` i još ${n}`,
    avoid: 'Radije ne',
    horizon: 'Horizont',
    bridges: (n, names) => `${n} ${srForm(n, 'most', 'mosta', 'mostova')} (${names})`,
    noBridges: 'nema mostova',
    adjustProfile: 'Prilagodi profil',
    importSheet: 'Uvezi lični karton',
    bigRunStarted: 'Veliki prolaz je pokrenut. Ponovo čita sve izvore bez ograničenja i može da potraje nekoliko sati; novi oglasi stižu postepeno.',
    approvedOn: (date) => `Profil je odobren ${date} `,
    bigRunRequested: (when) => `Veliki prolaz pokrenut ${when}. `,
    starting: 'pokreće se…',
    bigRunAgain: 'Ponovo pokreni veliki prolaz',
    reviewTitle: 'Proveri i odobri profil',
    changedTitle: 'Profil je izmenjen',
    reviewText: 'Pogledaj svoj profil i ispravi ono što ne odgovara. Odobravanjem se pokreće veliki prolaz: ponovo čita sve izvore bez ograničenja i sve razvrstava prema ovom profilu. To može da potraje nekoliko sati.',
    changedText: 'Profil se promenio od poslednjeg odobravanja. Novi veliki prolaz ponovo učitava sve prema novom profilu.',
    approveAndRun: 'Odobri i pokreni veliki prolaz',
    bigRun: 'Pokreni veliki prolaz',
    later: 'Kasnije',
    needsToken: 'Za pokretanje je Workeru potreban GitHub token (docs/SCHLUESSEL.md).',
    testPhotosTitle: 'Probne fotografije za demo',
    testPhotosText: 'Probni oglasi nemaju fotografije. Izaberi nekoliko slika iz galerije, a demo će ih rasporediti na sve ustanove. Ostaju samo u ovom pregledaču.',
    testPhotosCount: (n) => `${n} ${srForm(n, 'probna fotografija', 'probne fotografije', 'probnih fotografija')}`,
    loading: 'učitava se…',
    morePhotos: 'Izaberi još fotografija',
    choosePhotos: 'Izaberi fotografije',
    removePhotos: 'Ukloni probne fotografije',
    photosRemoved: 'Probne fotografije su uklonjene.',
    photosAddedFailed: (added, failed) => `Dodate fotografije: ${added}. Nije moglo da se pročita: ${failed}.`,
    photosAdded: (added) => `Dodate fotografije: ${added}. Pogledaj špil.`,
    ingestStarted: 'Prikupljanje je pokrenuto. Novi oglasi stižu za otprilike 15 do 30 minuta.',
    meSub: 'Profil pretrage, mesta i podešavanja',
    checklist: 'Kontrolna lista privremenih vrednosti',
    checklistSubDemo: 'Šta je još probno, primer ili podrazumevana vrednost',
    checklistSub: 'Šta još treba zameniti pre prave upotrebe',
    open: (n) => `još ${n}`,
    allDone: 'sve je gotovo',
    search: 'Pretraga',
    horizonSub: 'Poslovi van osnovne oblasti preko mostova, ubačeni u špil',
    favorites: 'Omiljena mesta',
    favoritesSub: 'Pokrajine, gradovi, ustanove: uvek na vrhu',
    none: 'nema',
    home: 'Dom i radijus',
    allGermany: 'cela Nemačka',
    reminders: 'Podsetnici',
    reminderDays: (days) => (days.length ? days.map((d) => (d === 0 ? 'na dan roka' : `${d} ${srForm(d, 'dan', 'dana', 'dana')} ranije`)).join(', ') : 'isključeno'),
    remindersSub: (deadlines, newJobs) => `Rokovi: ${deadlines}; novi oglasi: ${newJobs}`,
    fromPct: (pct) => `od ${pct}`,
    off: 'isključeno',
    withPush: 'sa push obaveštenjima',
    appOnly: 'samo u aplikaciji',
    ai: 'AI',
    assistant: 'AI asistent',
    assistantSub: 'Pitanja o oglasima, profilu i mostovima; pretražuje sve oglase, predlaže izmene; prikazuje potrošnju',
    demo: 'Demo',
    notSetUp: 'nije podešen',
    collecting: 'Prikupljanje',
    sources: 'Izvori i prolazi',
    sourcesSub: (total, problems, missingUrl) =>
      `${total} ${srForm(total, 'izvor', 'izvora', 'izvora')}, ${problems ? `${problems} sa problemima` : 'bez problema'}${missingUrl ? `, ${missingUrl} bez adrese` : ''}`,
    notLoaded: 'još nije učitano',
    noRun: 'još nema prolaza',
    dailyDemo: 'Svaki dan oko podneva, u demu ne',
    dailyTrigger: 'Svaki dan oko podneva, sa najmanje tri oglasa sa novih sajtova. Ili odmah.',
    dailyNoTrigger: 'Svaki dan oko podneva. Za „Sada“ je Workeru potreban GitHub token.',
    now: 'Sada',
    sync: 'Sinhronizacija sa serverom',
    syncDemo: 'Demo: sve ostaje u ovom pregledaču',
    lastSync: (when, pending) => `poslednji put ${when}${pending ? `, ${pending} ${srForm(pending, 'izmena čeka', 'izmene čekaju', 'izmena čeka')}` : ''}`,
    syncing: 'u toku…',
    appearance: 'Izgled',
    cardImages: 'Slike na karticama u špilu',
    cardImagesHint: 'Fotografija iz oglasa, ustanove ili grada, inače skica. Isključeno: više mesta za tekst.',
    colorScheme: 'Šema boja',
    themes: { auto: 'kao na uređaju', hell: 'svetlo', dunkel: 'tamno' },
    language: 'Jezik',
    app: 'Aplikacija',
    about: 'O aplikaciji',
    aboutSub: (version) => `Taras Cutesy Jobsearch App, verzija ${version}, izvori mapa i slika`,
    resetDemo: 'Resetuj demo',
    resetDemoSub: 'Sačuvani i preskočeni oglasi, podešavanja i štiklirane stavke kontrolne liste vraćaju se na početak',
    logout: 'Odjavi se',
    logoutSub: 'Zaboravi ključ aplikacije na ovom uređaju',
  },
});

export function SubPage({ title, sub, children, labelId }: { title: string; sub?: ReactNode; children: ReactNode; labelId?: string }) {
  const id = labelId ?? `sub-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className="screen paper" aria-labelledby={id}>
      <button type="button" className="back-link" onClick={() => navigate('/ich')}>
        <IconChevron width={18} height={18} style={{ transform: 'rotate(180deg)' }} /> {t.me}
      </button>
      <PageHead id={id} title={title} sub={sub} />
      {children}
    </section>
  );
}

function Row({ label, sub, value, onClick }: { label: string; sub?: ReactNode; value?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="setting" onClick={onClick}>
      <span className="setting__label">
        {label}
        {sub && <small>{sub}</small>}
      </span>
      <span className="setting__value">
        {value}
        <IconChevron width={18} height={18} aria-hidden="true" />
      </span>
    </button>
  );
}

function ProfileCard() {
  const s = useAppState();
  const p = s.settings.profile;
  const u = s.settings.umfrage;
  const empty = p.categories.every((c) => c.items.length === 0) && p.avoid.length === 0;
  const active = p.categories.filter((c) => c.items.length && c.weight > 0);
  const sum = active.reduce((a, c) => a + c.weight, 0) || 1;
  const surveyRunning = !!u && !u.uebernommen && u.seite > 0;
  const surveyFirst = empty || p.origin === 'start' || surveyRunning;
  const surveyLabel = surveyRunning ? t.surveyContinue : u?.uebernommen ? t.surveyView : t.surveyStart;
  const surveyButton = (
    <button type="button" className={`btn ${surveyFirst ? 'btn--primary' : ''} btn--small`} onClick={() => navigate('/ich/umfrage')}>
      {surveyLabel}
    </button>
  );
  return (
    <div className="index-card">
      <span className="tape tape--tl" aria-hidden="true" />
      <p className="index-card__kicker">{t.profileKicker}</p>
      <h2 className="index-card__title">{profileName(p.name)}</h2>
      {empty ? (
        <p style={{ margin: '4px 0 0' }}>
          {surveyRunning
            ? t.emptyRunning(u!.seite)
            : t.emptyStart}
        </p>
      ) : (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            {t.changed(t.origin[p.origin], fmtDate(p.updatedAt.slice(0, 10)))}
          </p>
          <ul className="index-card__cats">
            {CATEGORY_ORDER.map((id) => {
              const c = p.categories.find((x) => x.id === id)!;
              const share = c.items.length && c.weight > 0 ? Math.round((c.weight / sum) * 100) : 0;
              const top = [...c.items].sort((a, b) => b.hearts - a.hearts).slice(0, 3);
              return (
                <li key={id}>
                  <span className="index-card__cat">
                    {categoryLabel(id)} <small>{fmtPct(share)}</small>
                  </span>
                  <span className="index-card__items">
                    {top.length === 0 ? (
                      <em>{t.emptyCategory}</em>
                    ) : (
                      top.map((it) => (
                        <span key={it.id} className="index-card__item">
                          {profileLabel(it.label)} <Hearts value={it.hearts} />
                        </span>
                      ))
                    )}
                    {c.items.length > 3 && <small>{t.more(c.items.length - 3)}</small>}
                  </span>
                </li>
              );
            })}
            {p.avoid.length > 0 && (
              <li>
                <span className="index-card__cat">{t.avoid}</span>
                <span className="index-card__items">{p.avoid.map((a) => profileLabel(a.label)).join(', ')}</span>
              </li>
            )}
            <li>
              <span className="index-card__cat">{t.horizon}</span>
              <span className="index-card__items">
                {(() => {
                  const h = horizontOf(p);
                  const on = h.bruecken.filter((b) => b.aktiv);
                  return on.length ? t.bridges(on.length, `${on.slice(0, 3).map((b) => profileLabel(b.name)).join(', ')}${on.length > 3 ? ' …' : ''}`) : t.noBridges;
                })()}
              </span>
            </li>
          </ul>
        </>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        {surveyFirst && surveyButton}
        <button type="button" className={`btn ${surveyFirst ? '' : 'btn--primary'} btn--small`} onClick={() => navigate('/ich/profil')}>
          {t.adjustProfile}
        </button>
        <button type="button" className="btn btn--small" onClick={() => navigate('/ich/horizont')}>
          {t.horizon}
        </button>
        {!surveyFirst && surveyButton}
        <button type="button" className="btn btn--small" onClick={() => navigate('/ich/steckbrief')}>
          {t.importSheet}
        </button>
      </div>
    </div>
  );
}

/**
 * Freigabe des Suchprofils: Ein neues Profil erst anschauen und anpassen, dann freigeben – damit startet der
 * große Durchlauf ohne Grenzen. Nach späteren Änderungen wird ein neuer großer Durchlauf angeboten.
 */
function FreigabeBox() {
  const s = useAppState();
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const p = s.settings.profile;
  const f = s.settings.freigabe;
  const zustand = freigabeZustand(p, f);
  if (s.demo || zustand === 'leer') return null;
  const start = async () => {
    setBusy(true);
    try {
      await store.api.triggerIngest(true);
      store.updateSettings('freigabe', freigeben(p, f));
      store.toast(t.bigRunStarted, undefined, 9000);
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  if (zustand === 'aktuell') {
    const g = f.grosserLauf;
    return (
      <p className="hint" style={{ margin: '-2px 4px 12px' }}>
        {f.freigegebenAm ? t.approvedOn(fmtDate(f.freigegebenAm.slice(0, 10))) : ''}
        {g ? t.bigRunRequested(relativeTime(g.angefordertAm)) : ''}
        {s.ingestTrigger && (
          <button type="button" className="linkish" disabled={busy} onClick={() => void start()}>
            {busy ? t.starting : t.bigRunAgain}
          </button>
        )}
      </p>
    );
  }
  return (
    <div className="notice notice--info" style={{ margin: '0 2px 14px' }}>
      <b>{zustand === 'pruefen' ? t.reviewTitle : t.changedTitle}</b>
      <p style={{ margin: '4px 0 0' }}>
        {zustand === 'pruefen' ? t.reviewText : t.changedText}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" className="btn btn--primary btn--small" disabled={busy || !s.ingestTrigger} onClick={() => void start()}>
          {busy ? t.starting : zustand === 'pruefen' ? t.approveAndRun : t.bigRun}
        </button>
        {zustand === 'pruefen' ? (
          <button type="button" className="btn btn--small" onClick={() => navigate('/ich/profil')}>
            {t.adjustProfile}
          </button>
        ) : (
          <button type="button" className="btn btn--small btn--quiet" onClick={() => store.updateSettings('freigabe', { ...f, spaeterFuer: p.updatedAt })}>
            {t.later}
          </button>
        )}
      </div>
      {!s.ingestTrigger && <p className="hint" style={{ marginBottom: 0 }}>{t.needsToken}</p>}
    </div>
  );
}

/** Nur in der Demo: eigene Fotos auf die Beispielanzeigen legen. */
function TestPhotos() {
  const store = useStore();
  const photos = useTestPhotos();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="notice notice--info" style={{ margin: '8px 0 4px' }}>
      <b>{t.testPhotosTitle}</b>
      <p style={{ margin: '4px 0 0' }}>{t.testPhotosText}</p>
      {photos.length > 0 && (
        <div className="photo-strip" aria-label={t.testPhotosCount(photos.length)}>
          {photos.map((p, i) => (
            <img key={i} src={p} alt="" />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="btn btn--small" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? t.loading : photos.length ? t.morePhotos : t.choosePhotos}
        </button>
        {photos.length > 0 && (
          <button type="button" className="btn btn--quiet btn--small" onClick={() => void clearTestPhotos().then(() => store.toast(t.photosRemoved))}>
            {t.removePhotos}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length === 0) return;
          setBusy(true);
          const r = await addTestPhotos(files);
          setBusy(false);
          store.toast(r.failed ? t.photosAddedFailed(r.added, r.failed) : t.photosAdded(r.added));
        }}
      />
    </div>
  );
}

function SettingsHome() {
  const s = useAppState();
  const store = useStore();
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme());
  const favs = s.favorites.length;
  const days = [...s.settings.reminders.days].sort((a, b) => b - a);
  const sum = s.sourceSummary;
  const lastRun = s.runs[0];
  const h = horizontOf(s.settings.profile);
  const [triggering, setTriggering] = useState(false);
  const checklist = useChecklist();
  const trigger = async () => {
    setTriggering(true);
    try {
      await store.api.triggerIngest();
      store.toast(t.ingestStarted);
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e));
    } finally {
      setTriggering(false);
    }
  };

  return (
    <section className="screen paper" aria-labelledby="me-title">
      <PageHead id="me-title" title={t.me} sub={t.meSub} />
      <div className="group__card" style={{ marginBottom: 14 }}>
        <Row
          label={t.checklist}
          sub={s.demo ? t.checklistSubDemo : t.checklistSub}
          value={checklist.open ? t.open(checklist.open) : t.allDone}
          onClick={() => navigate('/ich/checkliste')}
        />
      </div>
      <ProfileCard />
      <FreigabeBox />

      <div className="group">
        <h2 className="section-title">{t.search}</h2>
        <div className="group__card">
          <Row
            label={t.horizon}
            sub={t.horizonSub}
            value={dosisCards(h.dosis)}
            onClick={() => navigate('/ich/horizont')}
          />
          <Row label={t.favorites} sub={t.favoritesSub} value={favs ? String(favs) : t.none} onClick={() => navigate('/ich/orte')} />
          <Row label={t.home} sub={s.settings.home.label} value={s.settings.filter.radiusKm ? `${s.settings.filter.radiusKm} km` : t.allGermany} onClick={() => navigate('/ich/zuhause')} />
          <Row
            label={t.reminders}
            sub={t.remindersSub(t.reminderDays(days), s.settings.notifyHighScore.on ? t.fromPct(fmtPct(s.settings.notifyHighScore.min)) : t.off)}
            value={s.settings.reminders.push ? t.withPush : t.appOnly}
            onClick={() => navigate('/ich/erinnerungen')}
          />
        </div>
      </div>

      <div className="group">
        <h2 className="section-title">{t.ai}</h2>
        <div className="group__card">
          <Row
            label={t.assistant}
            sub={t.assistantSub}
            value={s.demo ? t.demo : s.aiSuggest ? undefined : t.notSetUp}
            onClick={() => navigate('/ich/ki')}
          />
        </div>
      </div>

      <div className="group">
        <h2 className="section-title">{t.collecting}</h2>
        <div className="group__card">
          <Row
            label={t.sources}
            sub={sum ? t.sourcesSub(sum.total, sum.problems, sum.missingUrl) : t.notLoaded}
            value={lastRun ? relativeTime(lastRun.finishedAt ?? lastRun.startedAt) : s.demo ? t.demo : t.noRun}
            onClick={() => navigate('/ich/quellen')}
          />
          <div className="setting setting--static">
            <span className="setting__label">
              {t.collecting}
              <small>{s.demo ? t.dailyDemo : s.ingestTrigger ? t.dailyTrigger : t.dailyNoTrigger}</small>
            </span>
            {!s.demo && s.ingestTrigger && (
              <button type="button" className="btn btn--small" disabled={triggering} onClick={() => void trigger()}>
                {triggering ? t.starting : t.now}
              </button>
            )}
          </div>
          <div className="setting setting--static">
            <span className="setting__label">
              {t.sync}
              <small>{s.demo ? t.syncDemo : s.sync.error ? s.sync.error : t.lastSync(relativeTime(s.sync.lastSyncAt), s.pending)}</small>
            </span>
            {!s.demo && (
              <button type="button" className="btn btn--small" disabled={s.sync.busy} onClick={() => void store.refresh()}>
                {s.sync.busy ? t.syncing : t.now}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="group">
        <h2 className="section-title">{t.appearance}</h2>
        <label className="toggle">
          <span>
            {t.cardImages}
            <br />
            <small className="hint">{t.cardImagesHint}</small>
          </span>
          <input type="checkbox" checked={s.settings.ui.cardImages !== false} onChange={(e) => store.updateSettings('ui', { ...s.settings.ui, cardImages: e.target.checked })} />
        </label>
        {s.demo && <TestPhotos />}
        <div className="segmented" role="group" aria-label={t.colorScheme} style={{ marginTop: 10 }}>
          {(['auto', 'hell', 'dunkel'] as ThemeChoice[]).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={theme === choice}
              onClick={() => {
                setTheme(choice);
                setThemeState(choice);
              }}
            >
              {t.themes[choice]}
            </button>
          ))}
        </div>
        <p className="hint" style={{ margin: '14px 0 6px' }}>
          {t.language}
        </p>
        <LangSwitch />
      </div>

      <div className="group">
        <h2 className="section-title">{t.app}</h2>
        <div className="group__card">
          <Row label={t.about} sub={t.aboutSub(__APP_VERSION__)} onClick={() => navigate('/ich/ueber')} />
          {s.demo ? (
            <button
              type="button"
              className="setting"
              onClick={() => {
                lsDel('sb.demo.v1');
                lsDel('sb.demo.v2');
                lsDel('sb.queue');
                location.reload();
              }}
            >
              <span className="setting__label">
                {t.resetDemo}
                <small>{t.resetDemoSub}</small>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="setting"
              onClick={() => {
                lsDel('sb.key');
                location.reload();
              }}
            >
              <span className="setting__label">
                {t.logout}
                <small>{t.logoutSub}</small>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function SettingsScreen({ sub }: { sub: string | null }) {
  switch (sub) {
    case 'profil':
      return <ProfileEditor />;
    case 'steckbrief':
      return <SteckbriefImport />;
    case 'umfrage':
      return <UmfragePage />;
    case 'orte':
      return <PlacesPage />;
    case 'zuhause':
      return <HomePage />;
    case 'erinnerungen':
      return <RemindersPage />;
    case 'quellen':
      return <SourcesPage />;
    case 'horizont':
      return <HorizontPage />;
    case 'ueber':
      return <AboutPage />;
    case 'checkliste':
      return <ChecklistPage />;
    case 'ki':
      return <AssistantPage />;
    default:
      return <SettingsHome />;
  }
}
