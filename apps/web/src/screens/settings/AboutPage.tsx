// Über die App: wie sie arbeitet, woher Karte, Bilder und Schriften kommen.

import { useAppState } from '../../data/hooks';
import { texts } from '../../i18n';
import { SubPage } from './Settings';

const t = texts({
  de: {
    title: 'Über die App',
    version: (v: string, demo: boolean) => `Version ${v}${demo ? ', Demo' : ''}`,
    howTitle: 'Wie es arbeitet',
    how1: 'Einmal am Tag gegen 12 Uhr (und auf Knopfdruck) sammelt eine Pipeline Stellenanzeigen mit Psychologie-Bezug ein: von Hochschulen, Kliniken, Forschungsinstituten und Unternehmen. Sie probiert dabei nacheinander strukturierte Daten, Feeds, Bewerbungsportale, Sitemaps, eine KI-Auswertung und zuletzt einen Browser-Agenten. Portale wie die Jobsuche der Bundesagentur für Arbeit dienen als Sicherheitsnetz.',
    how2: 'Aussortiert wird nur bei breiten Quellen, und nur, wenn kein Begriff aus dem Grobfilter vorkommt. Alles Aussortierte ist unter „Quellen“ einsehbar. Dein Suchprofil sortiert ausschließlich die Reihenfolge.',
    how3: 'Wischen ist nur Anzeige: Die App lernt daraus nichts und verändert den Score nicht.',
    creditsTitle: 'Quellen und Lizenzen',
    mapBefore: 'Karte: Ländergrenzen aus ',
    mapAfter: ' (gemeinfrei), handgezeichnet nachgezogen.',
    photos: 'Fotos: aus der Anzeige selbst oder aus Wikipedia/Wikimedia Commons. Urheber und Lizenz stehen jeweils unter dem Bild. Fehlt ein Foto, zeichnet die App eine Postkarte.',
    fontsBefore: 'Schriften: ',
    fontsAnd: ' und ',
    fontsAfter: ', beide unter der SIL Open Font License.',
    postings: 'Anzeigentexte gehören den ausschreibenden Einrichtungen. Maßgeblich ist immer die Original-Anzeige.',
    demoTitle: 'Zu den Dummy-Daten',
    demoText: 'Alle Anzeigen sind erfunden und tragen das Etikett „Dummy“. Einrichtungen, Städte und Quellen sind dagegen echt: Der Knopf in einer Dummy-Anzeige führt zur echten Stellenliste der Einrichtung. Fristen und Fundtage rücken jeden Tag mit, damit immer etwas zu sehen ist. Was du merkst oder einstellst, bleibt nur in diesem Browser.',
    checklistBefore: 'Was noch zu ersetzen ist, steht in der ',
    checklistLink: 'Platzhalter-Checkliste',
    checklistAfter: '.',
  },
  en: {
    title: 'About the app',
    version: (v, demo) => `Version ${v}${demo ? ', demo' : ''}`,
    howTitle: 'How it works',
    how1: 'Once a day around noon (and at the push of a button), a pipeline collects job postings related to psychology: from universities, hospitals, research institutes and companies. It tries structured data, feeds, applicant systems, sitemaps, an AI analysis and finally a browser agent, one after the other. Portals like the Federal Employment Agency job search serve as a safety net.',
    how2: 'Postings are only filtered out from broad sources, and only if none of the pre-filter terms appear. Everything filtered out can be viewed under “Sources”. Your search profile only changes the order.',
    how3: 'Swiping only affects what you see: the app doesn’t learn from it and doesn’t change the match.',
    creditsTitle: 'Sources and licenses',
    mapBefore: 'Map: state borders from ',
    mapAfter: ' (public domain), traced by hand.',
    photos: 'Photos: from the posting itself or from Wikipedia/Wikimedia Commons. The author and license are shown under each image. If there’s no photo, the app draws a postcard.',
    fontsBefore: 'Fonts: ',
    fontsAnd: ' and ',
    fontsAfter: ', both under the SIL Open Font License.',
    postings: 'Posting texts belong to the institutions that published them. The original posting is always what counts.',
    demoTitle: 'About the demo data',
    demoText: 'All postings are made up and carry the “Demo” label. Institutions, cities and sources, on the other hand, are real: the button in a demo posting takes you to the institution’s real job list. Deadlines and found dates move along every day, so there’s always something to see. Whatever you save or set stays in this browser only.',
    checklistBefore: 'What still needs replacing is listed in the ',
    checklistLink: 'placeholder checklist',
    checklistAfter: '.',
  },
  sr: {
    title: 'O aplikaciji',
    version: (v, demo) => `Verzija ${v}${demo ? ', demo' : ''}`,
    howTitle: 'Kako radi',
    how1: 'Jednom dnevno oko podneva (i kad pritisneš dugme) sistem za prikupljanje sakuplja oglase za posao vezane za psihologiju: sa univerziteta i visokih škola, iz klinika, istraživačkih instituta i kompanija. Pri tom redom isprobava strukturirane podatke, fidove, sisteme za prijave, mape sajta, AI analizu i na kraju agenta u pregledaču. Portali poput pretrage poslova Savezne agencije za zapošljavanje služe kao sigurnosna mreža.',
    how2: 'Oglasi se odbacuju samo kod širokih izvora, i to samo ako se ne pojavljuje nijedan pojam iz grubog filtera. Sve odbačeno možeš da pogledaš u odeljku „Izvori“. Tvoj profil pretrage menja isključivo redosled.',
    how3: 'Prevlačenje utiče samo na prikaz: aplikacija iz njega ništa ne uči i ne menja poklapanje.',
    creditsTitle: 'Izvori i licence',
    mapBefore: 'Mapa: granice pokrajina iz baze ',
    mapAfter: ' (javno dobro), ručno precrtane.',
    photos: 'Fotografije: iz samog oglasa ili sa sajtova Wikipedia i Wikimedia Commons. Autor i licenca stoje ispod svake slike. Ako fotografije nema, aplikacija nacrta razglednicu.',
    fontsBefore: 'Fontovi: ',
    fontsAnd: ' i ',
    fontsAfter: ', oba pod licencom SIL Open Font License.',
    postings: 'Tekstovi oglasa pripadaju ustanovama koje su ih objavile. Merodavan je uvek originalni oglas.',
    demoTitle: 'O probnim podacima',
    demoText: 'Svi oglasi su izmišljeni i nose oznaku „Demo“. Ustanove, gradovi i izvori su, naprotiv, stvarni: dugme u probnom oglasu vodi na pravu listu oglasa te ustanove. Rokovi i datumi pronalaska pomeraju se svakog dana, da bi uvek bilo nešto da se vidi. Ono što sačuvaš ili podesiš ostaje samo u ovom pregledaču.',
    checklistBefore: 'Šta još treba zameniti, piše u ',
    checklistLink: 'kontrolnoj listi privremenih vrednosti',
    checklistAfter: '.',
  },
});

export function AboutPage() {
  const s = useAppState();
  return (
    <SubPage title={t.title} sub={t.version(__APP_VERSION__, s.demo)}>
      <h2 className="section-title">{t.howTitle}</h2>
      <p>{t.how1}</p>
      <p>{t.how2}</p>
      <p>{t.how3}</p>

      <h2 className="section-title">{t.creditsTitle}</h2>
      <ul className="about-list">
        <li>
          {t.mapBefore}
          <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">
            Natural Earth
          </a>
          {t.mapAfter}
        </li>
        <li>{t.photos}</li>
        <li>
          {t.fontsBefore}
          <a href="https://shantellsans.com/" target="_blank" rel="noopener noreferrer">
            Shantell Sans
          </a>
          {t.fontsAnd}
          <a href="https://github.com/googlefonts/literata" target="_blank" rel="noopener noreferrer">
            Literata
          </a>
          {t.fontsAfter}
        </li>
        <li>{t.postings}</li>
      </ul>

      {s.demo && (
        <>
          <h2 className="section-title">{t.demoTitle}</h2>
          <p>{t.demoText}</p>
          <p>
            {t.checklistBefore}
            <a href="#/ich/checkliste">{t.checklistLink}</a>
            {t.checklistAfter}
          </p>
        </>
      )}
    </SubPage>
  );
}
