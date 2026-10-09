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
import { JobDetail } from './screens/JobDetail';
import { Login } from './screens/Login';
import { Toasts, Doodle } from './ui/bits';
import { IconHeart, IconList, IconMap, IconMe, IconStack, SvgDefs } from './ui/icons';

const TAB_LABEL: Record<Tab, string> = { stapel: 'Stapel', karte: 'Karte', gemerkt: 'Gemerkt', alle: 'Alle', ich: 'Ich' };
const TAB_ICON: Record<Tab, (p: { width: number; height: number }) => React.ReactElement> = {
  stapel: (p) => <IconStack {...p} />,
  karte: (p) => <IconMap {...p} />,
  gemerkt: (p) => <IconHeart {...p} />,
  alle: (p) => <IconList {...p} />,
  ich: (p) => <IconMe {...p} />,
};

function Loading() {
  return (
    <div className="app">
      <div className="screen paper" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="empty">
          <Doodle kind="teacup" />
          <h2>Büchlein wird aufgeschlagen …</h2>
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
      {s.demo && (
        <p className="demo-banner">
          Demo mit echten Anzeigen vom 9. Oktober 2026. Was du merkst, bleibt nur in diesem Browser.
        </p>
      )}
      <main className="main" key={`${route.tab}/${route.sub ?? ''}`}>
        {screen}
      </main>
      <nav className="tabs" aria-label="Bereiche">
        {TABS.map((t) => (
          <button key={t} type="button" className="tab" aria-current={route.tab === t ? 'page' : undefined} onClick={() => navigate(`/${t}`)}>
            {TAB_ICON[t]({ width: 24, height: 24 })}
            <span>{TAB_LABEL[t]}</span>
            {t === 'gemerkt' && urgent > 0 && (
              <span className="badge" aria-label={`${urgent} Fristen in den nächsten 7 Tagen`}>
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
