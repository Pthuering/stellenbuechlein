// "Ich": Suchprofil, Lieblingsorte, Zuhause, Erinnerungen, Quellen, Aussehen.

import { useState, type ReactNode } from 'react';
import { CATEGORY_LABELS, CATEGORY_ORDER, formatDateDe } from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { lsDel } from '../../data/local';
import { navigate } from '../../lib/router';
import { plural, relativeTime } from '../../lib/format';
import { getTheme, setTheme, type ThemeChoice } from '../../lib/theme';
import { Hearts } from '../../ui/bits';
import { PageHead } from '../../ui/PageHead';
import { IconChevron } from '../../ui/icons';
import { ProfileEditor } from './ProfileEditor';
import { SteckbriefImport } from './SteckbriefImport';
import { PlacesPage } from './PlacesPage';
import { HomePage } from './HomePage';
import { RemindersPage } from './RemindersPage';
import { SourcesPage } from './SourcesPage';
import { AboutPage } from './AboutPage';

export function SubPage({ title, sub, children, labelId }: { title: string; sub?: ReactNode; children: ReactNode; labelId?: string }) {
  const id = labelId ?? `sub-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className="screen paper" aria-labelledby={id}>
      <button type="button" className="back-link" onClick={() => navigate('/ich')}>
        <IconChevron width={18} height={18} style={{ transform: 'rotate(180deg)' }} /> Ich
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

const ORIGIN_TEXT = {
  start: 'Startprofil: breit gehalten, bis dein Steckbrief da ist',
  steckbrief: 'aus deinem Steckbrief',
  manuell: 'selbst zusammengestellt',
} as const;

function ProfileCard() {
  const s = useAppState();
  const p = s.settings.profile;
  const active = p.categories.filter((c) => c.items.length && c.weight > 0);
  const sum = active.reduce((a, c) => a + c.weight, 0) || 1;
  return (
    <div className="index-card">
      <span className="tape tape--tl" aria-hidden="true" />
      <p className="index-card__kicker">Suchprofil</p>
      <h2 className="index-card__title">{p.name}</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        {ORIGIN_TEXT[p.origin]}, geändert am {formatDateDe(p.updatedAt.slice(0, 10))}
      </p>
      <ul className="index-card__cats">
        {CATEGORY_ORDER.map((id) => {
          const c = p.categories.find((x) => x.id === id)!;
          const share = c.items.length && c.weight > 0 ? Math.round((c.weight / sum) * 100) : 0;
          const top = [...c.items].sort((a, b) => b.hearts - a.hearts).slice(0, 3);
          return (
            <li key={id}>
              <span className="index-card__cat">
                {CATEGORY_LABELS[id]} <small>{share} %</small>
              </span>
              <span className="index-card__items">
                {top.length === 0 ? (
                  <em>leer, zählt nicht</em>
                ) : (
                  top.map((it) => (
                    <span key={it.id} className="index-card__item">
                      {it.label} <Hearts value={it.hearts} />
                    </span>
                  ))
                )}
                {c.items.length > 3 && <small> und {c.items.length - 3} weitere</small>}
              </span>
            </li>
          );
        })}
        {p.avoid.length > 0 && (
          <li>
            <span className="index-card__cat">Lieber nicht</span>
            <span className="index-card__items">{p.avoid.map((a) => a.label).join(', ')}</span>
          </li>
        )}
      </ul>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="btn btn--primary btn--small" onClick={() => navigate('/ich/profil')}>
          Profil anpassen
        </button>
        <button type="button" className="btn btn--small" onClick={() => navigate('/ich/steckbrief')}>
          Steckbrief importieren
        </button>
      </div>
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

  return (
    <section className="screen paper" aria-labelledby="me-title">
      <PageHead id="me-title" title="Ich" sub="Suchprofil, Orte und Einstellungen" />
      <ProfileCard />

      <div className="group">
        <h2 className="section-title">Suche</h2>
        <div className="group__card">
          <Row label="Lieblingsorte" sub="Bundesländer, Städte, Einrichtungen: stehen immer oben" value={favs ? String(favs) : 'keine'} onClick={() => navigate('/ich/orte')} />
          <Row label="Zuhause & Umkreis" sub={s.settings.home.label} value={s.settings.filter.radiusKm ? `${s.settings.filter.radiusKm} km` : 'ganz DE'} onClick={() => navigate('/ich/zuhause')} />
          <Row
            label="Fristen-Erinnerungen"
            sub={days.length ? `${days.map((d) => (d === 1 ? '1 Tag' : d === 0 ? 'am Tag' : `${d} Tage`)).join(', ')} vorher` : 'aus'}
            value={s.settings.reminders.push ? 'mit Push' : 'nur in der App'}
            onClick={() => navigate('/ich/erinnerungen')}
          />
        </div>
      </div>

      <div className="group">
        <h2 className="section-title">Einsammeln</h2>
        <div className="group__card">
          <Row
            label="Quellen & Läufe"
            sub={sum ? `${plural(sum.total, 'Quelle', 'Quellen')}, ${sum.problems ? `${sum.problems} mit Problemen` : 'keine Probleme'}${sum.missingUrl ? `, ${sum.missingUrl} ohne Adresse` : ''}` : 'noch nicht geladen'}
            value={lastRun ? relativeTime(lastRun.finishedAt ?? lastRun.startedAt) : s.demo ? 'Demo' : 'noch kein Lauf'}
            onClick={() => navigate('/ich/quellen')}
          />
          <div className="setting setting--static">
            <span className="setting__label">
              Abgleich mit dem Server
              <small>
                {s.demo
                  ? 'Demo: alles bleibt in diesem Browser'
                  : s.sync.error
                    ? s.sync.error
                    : `zuletzt ${relativeTime(s.sync.lastSyncAt)}${s.pending ? `, ${s.pending} Änderung${s.pending === 1 ? '' : 'en'} warten` : ''}`}
              </small>
            </span>
            {!s.demo && (
              <button type="button" className="btn btn--small" disabled={s.sync.busy} onClick={() => void store.refresh()}>
                {s.sync.busy ? 'läuft …' : 'Jetzt'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="group">
        <h2 className="section-title">Aussehen</h2>
        <div className="segmented" role="group" aria-label="Farbschema">
          {(['auto', 'hell', 'dunkel'] as ThemeChoice[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={theme === t}
              onClick={() => {
                setTheme(t);
                setThemeState(t);
              }}
            >
              {t === 'auto' ? 'wie das Gerät' : t === 'hell' ? 'hell' : 'dunkel'}
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <h2 className="section-title">App</h2>
        <div className="group__card">
          <Row label="Über das Stellenbüchlein" sub={`Version ${__APP_VERSION__}, Quellen der Karten und Bilder`} onClick={() => navigate('/ich/ueber')} />
          {s.demo ? (
            <button
              type="button"
              className="setting"
              onClick={() => {
                lsDel('sb.demo.v1');
                lsDel('sb.queue');
                location.reload();
              }}
            >
              <span className="setting__label">
                Demo zurücksetzen
                <small>Gemerkte, Weggelegte und Einstellungen löschen</small>
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
                Abmelden
                <small>App-Schlüssel auf diesem Gerät vergessen</small>
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
    case 'orte':
      return <PlacesPage />;
    case 'zuhause':
      return <HomePage />;
    case 'erinnerungen':
      return <RemindersPage />;
    case 'quellen':
      return <SourcesPage />;
    case 'ueber':
      return <AboutPage />;
    default:
      return <SettingsHome />;
  }
}
