// "Ich": Suchprofil, Lieblingsorte, Zuhause, Erinnerungen, Quellen, Aussehen.

import { useRef, useState, type ReactNode } from 'react';
import { CATEGORY_LABELS, CATEGORY_ORDER, DOSIS_LABELS, formatDateDe, horizontOf } from '@stellen/core';
import { useAppState, useStore } from '../../data/hooks';
import { lsDel } from '../../data/local';
import { addTestPhotos, clearTestPhotos, useTestPhotos } from '../../data/testPhotos';
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
import { HorizontPage } from './HorizontPage';
import { ChecklistPage, useChecklist } from './ChecklistPage';

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
        <li>
          <span className="index-card__cat">Horizont</span>
          <span className="index-card__items">
            {(() => {
              const h = horizontOf(p);
              const on = h.bruecken.filter((b) => b.aktiv);
              return on.length ? `${on.length} Brücken (${on.slice(0, 3).map((b) => b.name).join(', ')}${on.length > 3 ? ' …' : ''})` : 'keine Brücken';
            })()}
          </span>
        </li>
      </ul>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="btn btn--primary btn--small" onClick={() => navigate('/ich/profil')}>
          Profil anpassen
        </button>
        <button type="button" className="btn btn--small" onClick={() => navigate('/ich/horizont')}>
          Horizont
        </button>
        <button type="button" className="btn btn--small" onClick={() => navigate('/ich/steckbrief')}>
          Steckbrief importieren
        </button>
      </div>
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
      <b>Testfotos für die Demo</b>
      <p style={{ margin: '4px 0 0' }}>
        Die Dummy-Anzeigen haben keine Fotos. Wähl ein paar Bilder aus deiner Galerie, die Demo verteilt sie auf alle Einrichtungen. Sie bleiben nur in diesem Browser.
      </p>
      {photos.length > 0 && (
        <div className="photo-strip" aria-label={`${photos.length} Testfotos`}>
          {photos.map((p, i) => (
            <img key={i} src={p} alt="" />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="btn btn--small" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'wird geladen …' : photos.length ? 'Weitere Fotos wählen' : 'Fotos wählen'}
        </button>
        {photos.length > 0 && (
          <button type="button" className="btn btn--quiet btn--small" onClick={() => void clearTestPhotos().then(() => store.toast('Testfotos entfernt.'))}>
            Testfotos entfernen
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
          store.toast(r.failed ? `${r.added} Fotos übernommen, ${r.failed} ließen sich nicht lesen.` : `${r.added} Fotos übernommen. Schau in den Stapel.`);
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
      store.toast('Einsammeln gestartet. Neue Anzeigen sind in etwa 15 bis 30 Minuten da.');
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e));
    } finally {
      setTriggering(false);
    }
  };

  return (
    <section className="screen paper" aria-labelledby="me-title">
      <PageHead id="me-title" title="Ich" sub="Suchprofil, Orte und Einstellungen" />
      <div className="group__card" style={{ marginBottom: 14 }}>
        <Row
          label="Platzhalter-Checkliste"
          sub={s.demo ? 'Was noch Dummy, Beispiel oder Standardwert ist' : 'Was vor dem echten Betrieb noch zu ersetzen ist'}
          value={checklist.open ? `${checklist.open} offen` : 'alles erledigt'}
          onClick={() => navigate('/ich/checkliste')}
        />
      </div>
      <ProfileCard />

      <div className="group">
        <h2 className="section-title">Suche</h2>
        <div className="group__card">
          <Row
            label="Horizont"
            sub="Stellen außerhalb des Kernbereichs über Brücken, im Stapel eingestreut"
            value={h.dosis === 'aus' ? 'aus' : `${DOSIS_LABELS[h.dosis]} Karte`}
            onClick={() => navigate('/ich/horizont')}
          />
          <Row label="Lieblingsorte" sub="Bundesländer, Städte, Einrichtungen: stehen immer oben" value={favs ? String(favs) : 'keine'} onClick={() => navigate('/ich/orte')} />
          <Row label="Zuhause & Umkreis" sub={s.settings.home.label} value={s.settings.filter.radiusKm ? `${s.settings.filter.radiusKm} km` : 'ganz DE'} onClick={() => navigate('/ich/zuhause')} />
          <Row
            label="Erinnerungen"
            sub={`Fristen: ${days.length ? `${days.map((d) => (d === 1 ? '1 Tag' : d === 0 ? 'am Tag' : `${d} Tage`)).join(', ')} vorher` : 'aus'}; neue Anzeigen: ${s.settings.notifyHighScore.on ? `ab ${s.settings.notifyHighScore.min} %` : 'aus'}`}
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
              Einsammeln
              <small>
                {s.demo
                  ? 'Täglich gegen 12 Uhr, in der Demo nicht'
                  : s.ingestTrigger
                    ? 'Täglich gegen 12 Uhr, mit mindestens drei Anzeigen von neuen Websites. Oder jetzt sofort.'
                    : 'Täglich gegen 12 Uhr. Für „Jetzt“ braucht der Worker ein GitHub-Token.'}
              </small>
            </span>
            {!s.demo && s.ingestTrigger && (
              <button type="button" className="btn btn--small" disabled={triggering} onClick={() => void trigger()}>
                {triggering ? 'startet …' : 'Jetzt'}
              </button>
            )}
          </div>
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
        <label className="toggle">
          <span>
            Bilder auf den Karten im Stapel
            <br />
            <small className="hint">Foto aus der Anzeige, von der Einrichtung oder der Stadt, sonst eine Skizze. Aus: mehr Platz für den Text.</small>
          </span>
          <input type="checkbox" checked={s.settings.ui.cardImages !== false} onChange={(e) => store.updateSettings('ui', { ...s.settings.ui, cardImages: e.target.checked })} />
        </label>
        {s.demo && <TestPhotos />}
        <div className="segmented" role="group" aria-label="Farbschema" style={{ marginTop: 10 }}>
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
                lsDel('sb.demo.v2');
                lsDel('sb.queue');
                location.reload();
              }}
            >
              <span className="setting__label">
                Demo zurücksetzen
                <small>Gemerkte, Weggelegte, Einstellungen und Haken der Checkliste auf den Anfang</small>
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
    case 'horizont':
      return <HorizontPage />;
    case 'ueber':
      return <AboutPage />;
    case 'checkliste':
      return <ChecklistPage />;
    default:
      return <SettingsHome />;
  }
}
