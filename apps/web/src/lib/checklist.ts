// Platzhalter-Checkliste: alles, was noch Dummy, Standardwert oder Beispiel ist und vor dem echten
// Betrieb ersetzt werden muss. Was die App selbst erkennen kann, hakt sie ab; der Rest wird von Hand
// abgehakt (Ich → Platzhalter-Checkliste). Neue Platzhalter kommen hier dazu, nirgends sonst.

import { DEFAULT_HOME, horizontOf, type Suchprofil } from '@stellen/core';
import type { SourceSummary } from '../data/backend';
import type { AppConfig } from './config';
import { texts } from '../i18n';

export type CheckGroup = 'inhalte' | 'persoenlich' | 'website' | 'server' | 'quellen';

const t = texts({
  de: {
    groups: {
      inhalte: { title: 'Dummy-Daten in der App', sub: 'verschwinden, sobald die App mit dem Server verbunden ist' },
      persoenlich: { title: 'Persönliches', sub: 'Startwerte, die zu dir passen sollen' },
      website: { title: 'Website', sub: 'Sichere Verbindung' },
      server: { title: 'Server und Konten', sub: 'für echte Anzeigen, Anleitung in docs/BETRIEB.md' },
      quellen: { title: 'Quellen', sub: 'Feinschliff nach den ersten echten Läufen' },
    } as Record<CheckGroup, { title: string; sub: string }>,
    items: {
      'dummy-anzeigen': {
        title: 'Erfundene Anzeigen',
        what: 'Alle Anzeigen in Stapel, Liste und Karte sind erfunden und tragen das Etikett „Dummy“. Ihre Fristen rücken jeden Tag mit, damit immer etwas zu sehen ist.',
        where: 'Fallen weg, sobald die App mit dem Server läuft (docs/BETRIEB.md).',
      },
      'dummy-markierungen': {
        title: 'Beispiel-Markierungen und Lieblingsorte',
        what: 'Fünf Anzeigen sind schon gemerkt, weggelegt, beworben oder Herzensjob; Sachsen-Anhalt und Leipzig stehen als Lieblingsorte drin.',
        where: 'Fallen mit den echten Daten weg. Eigene Lieblingsorte unter Ich → Lieblingsorte.',
      },
      'dummy-laeufe': {
        title: 'Nachgestellte Läufe, Probeläufe und KI-Vorschläge',
        what: 'Lauf-Protokoll, Aussortiertes, der Probelauf neuer Quellen und die Brücken-Vorschläge der KI sind nur nachgestellt; es wird nichts abgerufen.',
        where: 'Echt, sobald Server, GitHub-Abläufe und KI-Schlüssel eingerichtet sind (siehe „Server und Konten“).',
      },
      testfotos: {
        title: 'Testfotos',
        what: 'Eigene Testfotos liegen auf den Einrichtungen. Im echten Betrieb kommen die Bilder aus der Anzeige oder von Wikimedia.',
        where: 'Ich → Aussehen → Testfotos entfernen.',
      },
      steckbrief: {
        title: 'Suchprofil ausfüllen',
        what: 'Solange das Profil leer ist oder noch das breite Startprofil gilt (Psychologie allgemein, Promotion vor Postdoc, ab E 13), sortiert der Score kaum: alles landet bei 0 % oder fast alles über 75 %.',
        where: 'Ich → Umfrage für Profil starten. Oder einen Steckbrief importieren (Format: docs/STECKBRIEF-ENTWURF.md) bzw. das Profil von Hand anpassen.',
      },
      horizont: {
        title: 'Horizont: Start-Brücken',
        what: 'Zehn breite Start-Brücken (Mensch & KI, IT-Sicherheit, UX …) holen Stellen außerhalb der Psychologie herein, bis der Steckbrief eigene festlegt.',
        where: 'Kommt mit dem Steckbrief, oder Ich → Horizont: Brücken bearbeiten, pausieren, vorschlagen lassen.',
      },
      zuhause: {
        title: `Zuhause: ${DEFAULT_HOME.label}`,
        what: 'Von hier aus misst die App Entfernungen und den Umkreis. Das ist der eingebaute Standardwert.',
        where: 'Ich → Zuhause & Umkreis. Stimmt Halle, einfach abhaken.',
      },
      https: {
        title: 'Sichere Verbindung (https)',
        what: 'Ohne https lässt sich die App nicht aufs Handy installieren, und es gibt keine Benachrichtigungen.',
        where: 'Beim Webhoster ein kostenloses Zertifikat (Let’s Encrypt) einschalten. Die .htaccess im Paket leitet dann automatisch auf https um.',
      },
      cloudflare: {
        title: 'Cloudflare-Worker und Datenbank',
        what: 'In apps/api/wrangler.toml steht als Datenbank-ID noch der Platzhalter 00000000-0000-0000-0000-000000000000.',
        where: 'npx wrangler d1 create stellenbuechlein, ID eintragen, npm run db:migrate:remote, npm run deploy (docs/BETRIEB.md, Schritt 2).',
      },
      schluessel: {
        title: 'App-Schlüssel und Pipeline-Schlüssel',
        what: 'APP_KEY (für die App) und INGEST_KEY (für die Pipeline) sind noch nicht gesetzt.',
        where: 'npx wrangler secret put APP_KEY und INGEST_KEY, je ein eigener Zufallswert (docs/BETRIEB.md, Schritt 2).',
      },
      github: {
        title: 'Einsammeln über GitHub (API_URL, INGEST_KEY)',
        what: 'Noch kein echter Lauf: Ohne Repository und Secrets sammelt niemand Anzeigen ein.',
        where: 'Code in ein GitHub-Repository, Secrets API_URL und INGEST_KEY, dann Actions → Einsammeln → Run workflow (docs/BETRIEB.md, Schritt 4).',
      },
      ki: {
        title: 'KI-Schlüssel (DeepSeek)',
        what: 'Ohne KI fehlen Kurzfassungen, die Weite, KI-Urteile im Horizont, die Nachprüfung unsicherer Fristen und das Urteil im Probelauf.',
        where: 'GitHub-Secret DEEPSEEK_API_KEY und Worker-Secret LLM_API_KEY (docs/BETRIEB.md, Schritte 4 und 5a). Erkannt wird nur der Worker-Teil.',
      },
      jetzt: {
        title: 'Knopf „Jetzt einsammeln“ und sofortige Probeläufe',
        what: 'Ohne GitHub-Token im Worker gibt es den Knopf nicht, und Probeläufe warten auf den nächsten Tageslauf.',
        where: 'Fine-grained Token mit „Actions: Read and write“, npx wrangler secret put GITHUB_TOKEN, GITHUB_REPO in wrangler.toml (docs/BETRIEB.md, Schritt 5).',
      },
      push: {
        title: 'Push-Schlüssel für Erinnerungen (VAPID)',
        what: 'Ohne Schlüssel erscheinen Fristen-Erinnerungen nur in der App unter „Gemerkt“.',
        where: 'npx web-push generate-vapid-keys; öffentlicher Schlüssel in wrangler.toml, beide als GitHub-Secrets (docs/BETRIEB.md, Schritt 3).',
      },
      websuche: {
        title: 'Websuche für die Erkundung (BRAVE_API_KEY)',
        what: 'Ohne zweite Quelle sucht die Erkundung neuer Websites nur bei der Arbeitsagentur.',
        where: 'GitHub-Secret BRAVE_API_KEY (Konditionen beim Anbieter prüfen).',
      },
      'quellen-adresse': {
        title: 'Einrichtungen ohne Stellenseite',
        what: 'Für einige Einrichtungen ist die Adresse der Stellenliste noch unbekannt. Bis dahin finden die Portale deren Anzeigen.',
        where: 'Die Pipeline sucht selbst und legt Vorschläge unter Ich → Quellen & Läufe → Neu an; Adressen lassen sich dort auch von Hand eintragen.',
      },
      'quellen-durchsicht': {
        title: 'Erster echter Lauf: Quellen durchsehen',
        what: 'Die Adressen stammen aus der Recherche; viele sind noch nicht gegen einen echten Lauf geprüft. Rechne mit einigen Runden in den ersten ein bis zwei Wochen.',
        where: 'Ich → Quellen & Läufe: Quellen mit „Fehler“, „leer“ oder „Warnung“ ansehen, Adresse oder Linkmuster nachschärfen, Probelauf wiederholen.',
      },
    } as Record<string, { title: string; what: string; where: string }>,
  },
  en: {
    groups: {
      inhalte: { title: 'Demo data in the app', sub: 'disappears as soon as the app is connected to the server' },
      persoenlich: { title: 'Personal', sub: 'starting values that should fit you' },
      website: { title: 'Website', sub: 'Secure connection' },
      server: { title: 'Server and accounts', sub: 'for real postings; guide in docs/BETRIEB.md' },
      quellen: { title: 'Sources', sub: 'fine-tuning after the first real runs' },
    },
    items: {
      'dummy-anzeigen': {
        title: 'Made-up postings',
        what: 'All postings in the stack, the list and the map are made up and carry a demo label. Their deadlines move forward every day so there is always something to see.',
        where: 'They disappear as soon as the app runs with the server (docs/BETRIEB.md).',
      },
      'dummy-markierungen': {
        title: 'Sample markings and favorite places',
        what: 'Five postings are already saved, passed, applied to or marked as dream jobs; Saxony-Anhalt and Leipzig are set as favorite places.',
        where: 'They disappear with the real data. Your own favorite places: Me → Favorite places.',
      },
      'dummy-laeufe': {
        title: 'Simulated runs, test runs and AI suggestions',
        what: 'The run log, the filtered-out postings, the test run of new sources and the AI’s bridge suggestions are only simulated; nothing is fetched.',
        where: 'Real as soon as the server, the GitHub workflows and the AI key are set up (see “Server and accounts”).',
      },
      testfotos: {
        title: 'Test photos',
        what: 'Your own test photos are placed on the institutions. In real use, pictures come from the posting or from Wikimedia.',
        where: 'Me → Appearance → Remove test photos.',
      },
      steckbrief: {
        title: 'Fill in the search profile',
        what: 'As long as the profile is empty or the broad starter profile still applies (psychology in general, PhD before postdoc, from E 13), the match hardly sorts anything: everything ends up at 0% or almost everything above 75%.',
        where: 'Me → Start profile questionnaire. Or import a profile sheet (format: docs/STECKBRIEF-ENTWURF.md), or adjust the profile by hand.',
      },
      horizont: {
        title: 'Horizon: starter bridges',
        what: 'Ten broad starter bridges (Humans & AI, IT security, UX …) bring in jobs outside psychology until the profile sheet sets your own.',
        where: 'Comes with the profile sheet, or Me → Horizon: edit bridges, pause them, ask for suggestions.',
      },
      zuhause: {
        title: `Home: ${DEFAULT_HOME.label}`,
        what: 'The app measures distances and the radius from here. This is the built-in default.',
        where: 'Me → Home & radius. If Halle is right, just tick it off.',
      },
      https: {
        title: 'Secure connection (https)',
        what: 'Without https, the app can’t be installed on a phone and there are no notifications.',
        where: 'Turn on a free certificate (Let’s Encrypt) at your web host. The .htaccess in the package then redirects to https automatically.',
      },
      cloudflare: {
        title: 'Cloudflare Worker and database',
        what: 'apps/api/wrangler.toml still has the placeholder 00000000-0000-0000-0000-000000000000 as the database ID.',
        where: 'npx wrangler d1 create stellenbuechlein, enter the ID, npm run db:migrate:remote, npm run deploy (docs/BETRIEB.md, step 2).',
      },
      schluessel: {
        title: 'App key and pipeline key',
        what: 'APP_KEY (for the app) and INGEST_KEY (for the pipeline) are not set yet.',
        where: 'npx wrangler secret put APP_KEY and INGEST_KEY, each with its own random value (docs/BETRIEB.md, step 2).',
      },
      github: {
        title: 'Collecting via GitHub (API_URL, INGEST_KEY)',
        what: 'No real run yet: without a repository and secrets, nobody collects postings.',
        where: 'Put the code in a GitHub repository, add the secrets API_URL and INGEST_KEY, then Actions → Einsammeln → Run workflow (docs/BETRIEB.md, step 4).',
      },
      ki: {
        title: 'AI key (DeepSeek)',
        what: 'Without AI there are no summaries, no Beyond, no AI verdicts in the Horizon, no double-check of uncertain deadlines and no verdict in the test run.',
        where: 'GitHub secret DEEPSEEK_API_KEY and Worker secret LLM_API_KEY (docs/BETRIEB.md, steps 4 and 5a). Only the Worker part is detected.',
      },
      jetzt: {
        title: '“Collect now” button and instant test runs',
        what: 'Without a GitHub token in the Worker there is no such button, and test runs wait for the next daily run.',
        where: 'Fine-grained token with “Actions: Read and write”, npx wrangler secret put GITHUB_TOKEN, GITHUB_REPO in wrangler.toml (docs/BETRIEB.md, step 5).',
      },
      push: {
        title: 'Push keys for reminders (VAPID)',
        what: 'Without keys, deadline reminders only appear in the app under “Saved”.',
        where: 'npx web-push generate-vapid-keys; the public key goes in wrangler.toml, both as GitHub secrets (docs/BETRIEB.md, step 3).',
      },
      websuche: {
        title: 'Web search for exploration (BRAVE_API_KEY)',
        what: 'Without a second source, the exploration of new websites only searches the Federal Employment Agency.',
        where: 'GitHub secret BRAVE_API_KEY (check the provider’s terms).',
      },
      'quellen-adresse': {
        title: 'Institutions without a jobs page',
        what: 'For some institutions, the address of the job list is still unknown. Until then, the portals find their postings.',
        where: 'The pipeline searches on its own and adds suggestions under Me → Sources & runs → New; you can also enter addresses there by hand.',
      },
      'quellen-durchsicht': {
        title: 'First real run: review the sources',
        what: 'The addresses come from research; many haven’t been checked against a real run yet. Expect a few rounds in the first one or two weeks.',
        where: 'Me → Sources & runs: look at sources marked “error”, “no jobs right now” or “warning”, sharpen the URL or link pattern, repeat the test run.',
      },
    },
  },
  sr: {
    groups: {
      inhalte: { title: 'Probni podaci u aplikaciji', sub: 'nestaju čim se aplikacija poveže sa serverom' },
      persoenlich: { title: 'Lično', sub: 'početne vrednosti koje treba da ti odgovaraju' },
      website: { title: 'Sajt', sub: 'Bezbedna veza' },
      server: { title: 'Server i nalozi', sub: 'za prave oglase, uputstvo u docs/BETRIEB.md' },
      quellen: { title: 'Izvori', sub: 'fino podešavanje posle prvih pravih prolaza' },
    },
    items: {
      'dummy-anzeigen': {
        title: 'Izmišljeni oglasi',
        what: 'Svi oglasi u špilu, listi i na mapi su izmišljeni i nose oznaku probnog oglasa. Rokovi im se svakog dana pomeraju, da uvek bude nešto za gledanje.',
        where: 'Nestaju čim aplikacija proradi sa serverom (docs/BETRIEB.md).',
      },
      'dummy-markierungen': {
        title: 'Primeri oznaka i omiljenih mesta',
        what: 'Pet oglasa je već sačuvano, preskočeno, sa poslatom prijavom ili označeno kao posao iz snova; Saksonija-Anhalt i Leipzig su upisani kao omiljena mesta.',
        where: 'Nestaju sa pravim podacima. Sopstvena omiljena mesta: Ja → Omiljena mesta.',
      },
      'dummy-laeufe': {
        title: 'Simulirani prolazi, probni prolazi i AI predlozi',
        what: 'Dnevnik prolaza, izdvojeni oglasi, probni prolaz novih izvora i AI predlozi mostova samo su simulirani; ništa se ne preuzima.',
        where: 'Postaju pravi čim se podese server, GitHub tokovi i AI ključ (vidi „Server i nalozi“).',
      },
      testfotos: {
        title: 'Probne fotografije',
        what: 'Tvoje probne fotografije stoje na ustanovama. U pravoj upotrebi slike dolaze iz oglasa ili sa Wikimedije.',
        where: 'Ja → Izgled → Ukloni probne fotografije.',
      },
      steckbrief: {
        title: 'Popuni profil pretrage',
        what: 'Dok je profil prazan ili još važi široki početni profil (psihologija uopšte, doktorat pre postdoka, od E 13), poklapanje skoro ništa ne razvrstava: sve završi na 0% ili gotovo sve iznad 75%.',
        where: 'Ja → Pokreni upitnik za profil. Ili uvezi lični karton (format: docs/STECKBRIEF-ENTWURF.md), odnosno ručno prilagodi profil.',
      },
      horizont: {
        title: 'Horizont: početni mostovi',
        what: 'Deset širokih početnih mostova (Čovek i AI, IT bezbednost, UX…) donosi poslove van psihologije, dok lični karton ne odredi tvoje.',
        where: 'Stiže sa ličnim kartonom, ili Ja → Horizont: izmeni mostove, pauziraj ih, zatraži predloge.',
      },
      zuhause: {
        title: `Dom: ${DEFAULT_HOME.label}`,
        what: 'Odavde aplikacija meri udaljenosti i radijus. Ovo je ugrađena podrazumevana vrednost.',
        where: 'Ja → Dom i radijus. Ako Halle odgovara, samo štikliraj.',
      },
      https: {
        title: 'Bezbedna veza (https)',
        what: 'Bez https-a aplikacija ne može da se instalira na telefon i nema obaveštenja.',
        where: 'Kod hosting provajdera uključi besplatan sertifikat (Let’s Encrypt). Datoteka .htaccess iz paketa onda automatski preusmerava na https.',
      },
      cloudflare: {
        title: 'Cloudflare Worker i baza podataka',
        what: 'U apps/api/wrangler.toml kao ID baze još stoji privremena vrednost 00000000-0000-0000-0000-000000000000.',
        where: 'npx wrangler d1 create stellenbuechlein, upiši ID, npm run db:migrate:remote, npm run deploy (docs/BETRIEB.md, korak 2).',
      },
      schluessel: {
        title: 'Ključ aplikacije i ključ za prikupljanje',
        what: 'APP_KEY (za aplikaciju) i INGEST_KEY (za prikupljanje) još nisu postavljeni.',
        where: 'npx wrangler secret put APP_KEY i INGEST_KEY, svaki sa sopstvenom nasumičnom vrednošću (docs/BETRIEB.md, korak 2).',
      },
      github: {
        title: 'Prikupljanje preko GitHuba (API_URL, INGEST_KEY)',
        what: 'Još nema pravog prolaza: bez repozitorijuma i tajni (secrets) niko ne prikuplja oglase.',
        where: 'Kod u GitHub repozitorijum, tajne API_URL i INGEST_KEY, zatim Actions → Einsammeln → Run workflow (docs/BETRIEB.md, korak 4).',
      },
      ki: {
        title: 'AI ključ (DeepSeek)',
        what: 'Bez AI-ja nema sažetaka, Daljine, AI ocena u Horizontu, provere nesigurnih rokova ni ocene u probnom prolazu.',
        where: 'GitHub tajna DEEPSEEK_API_KEY i Worker tajna LLM_API_KEY (docs/BETRIEB.md, koraci 4 i 5a). Prepoznaje se samo deo u Workeru.',
      },
      jetzt: {
        title: 'Dugme „Prikupi odmah“ i trenutni probni prolazi',
        what: 'Bez GitHub tokena u Workeru tog dugmeta nema, a probni prolazi čekaju sledeći dnevni prolaz.',
        where: 'Fine-grained token sa „Actions: Read and write“, npx wrangler secret put GITHUB_TOKEN, GITHUB_REPO u wrangler.toml (docs/BETRIEB.md, korak 5).',
      },
      push: {
        title: 'Push ključevi za podsetnike (VAPID)',
        what: 'Bez ključeva se podsetnici za rokove pojavljuju samo u aplikaciji, pod „Sačuvano“.',
        where: 'npx web-push generate-vapid-keys; javni ključ ide u wrangler.toml, oba kao GitHub tajne (docs/BETRIEB.md, korak 3).',
      },
      websuche: {
        title: 'Pretraga veba za izviđanje (BRAVE_API_KEY)',
        what: 'Bez drugog izvora, izviđanje novih sajtova pretražuje samo Saveznu agenciju za zapošljavanje.',
        where: 'GitHub tajna BRAVE_API_KEY (proveri uslove kod provajdera).',
      },
      'quellen-adresse': {
        title: 'Ustanove bez stranice sa oglasima',
        what: 'Za neke ustanove adresa liste oglasa još nije poznata. Do tada njihove oglase pronalaze portali.',
        where: 'Prikupljanje samo traži i dodaje predloge pod Ja → Izvori i prolazi → Novo; adrese tamo možeš da upišeš i ručno.',
      },
      'quellen-durchsicht': {
        title: 'Prvi pravi prolaz: pregledaj izvore',
        what: 'Adrese potiču iz istraživanja; mnoge još nisu proverene pravim prolazom. Računaj na nekoliko krugova u prvih nedelju-dve.',
        where: 'Ja → Izvori i prolazi: pogledaj izvore sa statusom „greška“, „trenutno nema oglasa“ ili „upozorenje“, doteraj adresu ili obrazac linkova, ponovi probni prolaz.',
      },
    },
  },
});

/** Gruppen der Checkliste; Titel und Untertitel in der Sprache der App. */
export const CHECK_GROUPS: { id: CheckGroup; readonly title: string; readonly sub: string }[] = (['inhalte', 'persoenlich', 'website', 'server', 'quellen'] as CheckGroup[]).map((id) => ({
  id,
  get title() {
    return t.groups[id].title;
  },
  get sub() {
    return t.groups[id].sub;
  },
}));

export interface CheckContext {
  demo: boolean;
  config: AppConfig;
  profile: Suchprofil;
  home: { lat: number; lon: number; label: string };
  testPhotos: number;
  runs: number;
  aiSuggest: boolean;
  ingestTrigger: boolean;
  vapid: boolean;
  sourceSummary: SourceSummary | null;
  location: { protocol: string; hostname: string };
}

export interface CheckItem {
  id: string;
  group: CheckGroup;
  readonly title: string;
  /** Was ist noch Platzhalter? */
  readonly what: string;
  /** Wo bzw. wie ersetzen */
  readonly where: string;
  /** Unterseite der App, in der sich das ändern lässt */
  route?: string;
  optional?: boolean;
  /** true = die App erkennt, dass es erledigt ist; false = noch offen; null = nicht erkennbar (von Hand abhaken) */
  auto: (c: CheckContext) => boolean | null;
}

const live = (c: CheckContext) => !c.demo;

/** Punkt mit Texten aus dem Wörterbuch (Titel, was, wo – in der Sprache der App). */
function item(base: Omit<CheckItem, 'title' | 'what' | 'where'>): CheckItem {
  return {
    ...base,
    get title() {
      return t.items[base.id].title;
    },
    get what() {
      return t.items[base.id].what;
    },
    get where() {
      return t.items[base.id].where;
    },
  };
}

export const CHECK_ITEMS: CheckItem[] = [
  // ---------------------------------------------------------------- Dummy-Daten
  item({
    id: 'dummy-anzeigen',
    group: 'inhalte',
    auto: live,
  }),
  item({
    id: 'dummy-markierungen',
    group: 'inhalte',
    route: '/ich/orte',
    auto: live,
  }),
  item({
    id: 'dummy-laeufe',
    group: 'inhalte',
    auto: live,
  }),
  item({
    id: 'testfotos',
    group: 'inhalte',
    route: '/ich',
    optional: true,
    auto: (c) => c.testPhotos === 0,
  }),
  // ---------------------------------------------------------------- Persönliches
  item({
    id: 'steckbrief',
    group: 'persoenlich',
    route: '/ich/umfrage',
    auto: (c) => c.profile.origin !== 'start' && c.profile.categories.some((cat) => cat.items.length > 0),
  }),
  item({
    id: 'horizont',
    group: 'persoenlich',
    route: '/ich/horizont',
    auto: (c) => !horizontOf(c.profile).bruecken.some((b) => b.aktiv && b.herkunft === 'start'),
  }),
  item({
    id: 'zuhause',
    group: 'persoenlich',
    route: '/ich/zuhause',
    auto: (c) => !(c.home.lat === DEFAULT_HOME.lat && c.home.lon === DEFAULT_HOME.lon),
  }),
  // ---------------------------------------------------------------- Website
  item({
    id: 'https',
    group: 'website',
    auto: (c) => c.location.protocol === 'https:',
  }),
  // ---------------------------------------------------------------- Server und Konten
  item({
    id: 'cloudflare',
    group: 'server',
    auto: live,
  }),
  item({
    id: 'schluessel',
    group: 'server',
    auto: live,
  }),
  item({
    id: 'github',
    group: 'server',
    auto: (c) => !c.demo && c.runs > 0,
  }),
  item({
    id: 'ki',
    group: 'server',
    auto: (c) => !c.demo && c.aiSuggest,
  }),
  item({
    id: 'jetzt',
    group: 'server',
    optional: true,
    auto: (c) => !c.demo && c.ingestTrigger,
  }),
  item({
    id: 'push',
    group: 'server',
    optional: true,
    auto: (c) => !c.demo && c.vapid,
  }),
  item({
    id: 'websuche',
    group: 'server',
    optional: true,
    auto: () => null,
  }),
  // ---------------------------------------------------------------- Quellen
  item({
    id: 'quellen-adresse',
    group: 'quellen',
    route: '/ich/quellen',
    auto: (c) => (c.sourceSummary ? c.sourceSummary.missingUrl === 0 : null),
  }),
  item({
    id: 'quellen-durchsicht',
    group: 'quellen',
    route: '/ich/quellen',
    auto: (c) => (c.demo ? false : c.sourceSummary && c.runs > 0 ? c.sourceSummary.problems === 0 : null),
  }),
];

export interface CheckStatus {
  item: CheckItem;
  /** automatisch erkannt erledigt */
  autoDone: boolean;
  /** von Hand abgehakt */
  manualDone: boolean;
  done: boolean;
}

export function evaluateChecklist(c: CheckContext, manual: readonly string[]): { list: CheckStatus[]; open: number; openRequired: number; total: number } {
  const set = new Set(manual);
  const list = CHECK_ITEMS.map((item) => {
    const autoDone = item.auto(c) === true;
    const manualDone = set.has(item.id);
    return { item, autoDone, manualDone, done: autoDone || manualDone };
  });
  const open = list.filter((x) => !x.done);
  return { list, open: open.length, openRequired: open.filter((x) => !x.item.optional).length, total: list.length };
}
