// Rahmen der App: Seiten, Register-Reiter unten, Anzeigen-Detail als Blatt darüber.

import { useMemo } from 'react';
import { daysUntil, todayBerlin } from '@stellen/core';
import { useAppState } from './data/hooks';
import { navigate, TABS, useRoute, type Tab } from './lib/router';
import { DeckScreen } from './screens/Deck';
import { MapScreen } from './screens/MapScreen';
import { SavedScreen } from './screens/Saved';
import { AllJobsScreen } from './screens/AllJobs';
import { SettingsScreen } from './screens/settings/Settings';
import { useChecklist } from './screens/settings/ChecklistPage';
import { JobDetail } from './screens/JobDetail';
import { Login } from './screens/Login';
import { Toasts, Doodle } from './ui/bits';
import { LangMargin } from './ui/LangSwitch';
import { IconHeart, IconList, IconMap, IconMe, IconStack, SvgDefs } from './ui/icons';
import { srForm, texts } from './i18n';

const t = texts({
  de: {
    tabs: { stapel: 'Stapel', karte: 'Karte', gemerkt: 'Gemerkt', alle: 'Alle', ich: 'Ich' } as Record<Tab, string>,
    tabsLabel: 'Bereiche',
    urgent: (n: number) => `${n} ${n === 1 ? 'Frist' : 'Fristen'} in den nächsten 7 Tagen`,
    demoBanner: 'Dummy-Daten: erfundene Anzeigen, alles bleibt in diesem Browser.',
    openPlaceholders: (n: number) => `Noch ${n} Platzhalter offen.`,
    checklist: 'Checkliste',
    checklistOpen: (n: number) => ` · ${n} offen`,
    loading: 'Büchlein wird aufgeschlagen …',
  },
  en: {
    tabs: { stapel: 'Stack', karte: 'Map', gemerkt: 'Saved', alle: 'All', ich: 'Me' },
    tabsLabel: 'Sections',
    urgent: (n) => `${n} ${n === 1 ? 'deadline' : 'deadlines'} in the next 7 days`,
    demoBanner: 'Demo data: made-up postings, everything stays in this browser.',
    openPlaceholders: (n) => `${n} ${n === 1 ? 'placeholder' : 'placeholders'} still to replace.`,
    checklist: 'Checklist',
    checklistOpen: (n) => ` · ${n} open`,
    loading: 'Opening the little book…',
  },
  sr: {
    tabs: { stapel: 'Špil', karte: 'Mapa', gemerkt: 'Sačuvano', alle: 'Sve', ich: 'Ja' },
    tabsLabel: 'Odeljci',
    urgent: (n) => `${n} ${srForm(n, 'rok', 'roka', 'rokova')} u narednih 7 dana`,
    demoBanner: 'Probni podaci: izmišljeni oglasi, sve ostaje u ovom pregledaču.',
    openPlaceholders: (n) => `Još ${n} ${srForm(n, 'privremena vrednost', 'privremene vrednosti', 'privremenih vrednosti')} za zamenu.`,
    checklist: 'Kontrolna lista',
    checklistOpen: (n) => ` · još ${n}`,
    loading: 'Otvaram knjižicu…',
  },
});
const TAB_ICON: Record<Tab, (p: { width: number; height: number }) => React.ReactElement> = {
  stapel: (p) => <IconStack {...p} />,
  karte: (p) => <IconMap {...p} />,
  gemerkt: (p) => <IconHeart {...p} />,
  alle: (p) => <IconList {...p} />,
  ich: (p) => <IconMe {...p} />,
};

/** Leiste oben: mit Dummy-Daten immer, sonst solange Platzhalter offen sind (abschaltbar). */
function ChecklistBanner() {
  const s = useAppState();
  const c = useChecklist();
  const route = useRoute();
  if (!s.demo && (c.openRequired === 0 || s.settings.checklist.hideBanner)) return null;
  const onPage = route.tab === 'ich' && route.sub === 'checkliste';
  return (
    <div className="demo-banner" role="note">
      <span>{s.demo ? t.demoBanner : t.openPlaceholders(c.openRequired)}</span>
      {!onPage && (
        <button type="button" className="demo-banner__btn" onClick={() => navigate('/ich/checkliste')}>
          {t.checklist}
          {c.open ? t.checklistOpen(c.open) : ''}
        </button>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="app">
      <div className="screen paper" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="empty">
          <Doodle kind="teacup" />
          <h2>{t.loading}</h2>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const s = useAppState();
  const route = useRoute();

  // Badge am Reiter "Gemerkt": Herzensjobs, deren Frist in höchstens 7 Tagen endet
  const urgent = useMemo(() => {
    const today = todayBerlin();
    let n = 0;
    for (const m of s.marks.values()) {
      if (!m.star || m.decision !== 'gemerkt') continue;
      const d = daysUntil(s.jobs.get(m.jobId)?.deadline, today);
      if (d != null && d >= 0 && d <= 7) n++;
    }
    return n;
  }, [s.marks, s.jobs]);

  if (s.phase === 'login') return <Login />;
  if (s.phase === 'loading') return <Loading />;

  let screen: React.ReactNode;
  switch (route.tab) {
    case 'karte':
      screen = <MapScreen />;
      break;
    case 'gemerkt':
      screen = <SavedScreen />;
      break;
    case 'alle':
      screen = <AllJobsScreen />;
      break;
    case 'ich':
      screen = <SettingsScreen sub={route.sub} />;
      break;
    default:
      screen = <DeckScreen />;
  }

  return (
    <div className="app">
      <SvgDefs />
      <ChecklistBanner />

      <main className="main" key={`${route.tab}/${route.sub ?? ''}`}>
        {screen}
        <LangMargin />
      </main>
      <nav className="tabs" aria-label={t.tabsLabel}>
        {TABS.map((tab) => (
          <button key={tab} type="button" className="tab" aria-current={route.tab === tab ? 'page' : undefined} onClick={() => navigate(`/${tab}`)}>
            {TAB_ICON[tab]({ width: 24, height: 24 })}
            <span>{t.tabs[tab]}</span>
            {tab === 'gemerkt' && urgent > 0 && (
              <span className="badge" aria-label={t.urgent(urgent)}>
                {urgent}
              </span>
            )}
          </button>
        ))}
      </nav>
      {route.jobId && <JobDetail id={route.jobId} />}
      <Toasts />
    </div>
  );
}
