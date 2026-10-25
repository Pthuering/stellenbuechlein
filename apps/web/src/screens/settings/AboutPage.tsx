// Über die App: wie sie arbeitet, woher Karte, Bilder und Schriften kommen.

import { useAppState } from '../../data/hooks';
import { SubPage } from './Settings';

export function AboutPage() {
  const s = useAppState();
  return (
    <SubPage title="Über das Stellenbüchlein" sub={`Version ${__APP_VERSION__}${s.demo ? ', Demo' : ''}`}>
      <h2 className="section-title">Wie es arbeitet</h2>
      <p>
        Einmal am Tag gegen 12 Uhr (und auf Knopfdruck) sammelt eine Pipeline Stellenanzeigen mit Psychologie-Bezug ein: von Hochschulen, Kliniken, Forschungsinstituten und Unternehmen. Sie probiert dabei nacheinander strukturierte Daten, Feeds, Bewerbungsportale, Sitemaps, eine KI-Auswertung und zuletzt einen Browser-Agenten. Portale wie die Jobsuche der Bundesagentur für Arbeit dienen als Sicherheitsnetz.
      </p>
      <p>Aussortiert wird nur bei breiten Quellen, und nur, wenn kein Begriff aus dem Grobfilter vorkommt. Alles Aussortierte ist unter „Quellen“ einsehbar. Dein Suchprofil sortiert ausschließlich die Reihenfolge.</p>
      <p>Wischen ist nur Anzeige: Die App lernt daraus nichts und verändert den Score nicht.</p>

      <h2 className="section-title">Quellen und Lizenzen</h2>
      <ul className="about-list">
        <li>
          Karte: Ländergrenzen aus <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a> (gemeinfrei), handgezeichnet nachgezogen.
        </li>
        <li>Fotos: aus der Anzeige selbst oder aus Wikipedia/Wikimedia Commons. Urheber und Lizenz stehen jeweils unter dem Bild. Fehlt ein Foto, zeichnet die App eine Postkarte.</li>
        <li>
          Schriften: <a href="https://shantellsans.com/" target="_blank" rel="noopener noreferrer">Shantell Sans</a> und <a href="https://github.com/googlefonts/literata" target="_blank" rel="noopener noreferrer">Literata</a>, beide unter der SIL Open Font License.
        </li>
        <li>Anzeigentexte gehören den ausschreibenden Einrichtungen. Maßgeblich ist immer die Original-Anzeige.</li>
      </ul>

      {s.demo && (
        <>
          <h2 className="section-title">Zu den Dummy-Daten</h2>
          <p>
            Alle Anzeigen sind erfunden und tragen das Etikett „Dummy“. Einrichtungen, Städte und Quellen sind dagegen echt: Der Knopf in einer Dummy-Anzeige führt zur echten Stellenliste der Einrichtung. Fristen und Fundtage rücken jeden Tag mit, damit immer etwas zu sehen ist. Was du merkst oder einstellst, bleibt nur in diesem Browser.
          </p>
          <p>
            Was noch zu ersetzen ist, steht in der{' '}
            <a href="#/ich/checkliste">Platzhalter-Checkliste</a>.
          </p>
        </>
      )}
    </SubPage>
  );
}
