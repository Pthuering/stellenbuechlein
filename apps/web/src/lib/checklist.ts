// Platzhalter-Checkliste: alles, was noch Dummy, Standardwert oder Beispiel ist und vor dem echten
// Betrieb ersetzt werden muss. Was die App selbst erkennen kann, hakt sie ab; der Rest wird von Hand
// abgehakt (Ich → Platzhalter-Checkliste). Neue Platzhalter kommen hier dazu, nirgends sonst.

import { DEFAULT_HOME, horizontOf, type Suchprofil } from '@stellen/core';
import type { SourceSummary } from '../data/backend';
import type { AppConfig } from './config';

export type CheckGroup = 'inhalte' | 'persoenlich' | 'website' | 'server' | 'quellen';

export const CHECK_GROUPS: { id: CheckGroup; title: string; sub: string }[] = [
  { id: 'inhalte', title: 'Dummy-Daten in der App', sub: 'verschwinden, sobald die App mit dem Server verbunden ist' },
  { id: 'persoenlich', title: 'Persönliches', sub: 'Startwerte, die zu dir passen sollen' },
  { id: 'website', title: 'Website', sub: 'Adresse, Verbindung, Rechtliches' },
  { id: 'server', title: 'Server und Konten', sub: 'für echte Anzeigen, Anleitung in docs/BETRIEB.md' },
  { id: 'quellen', title: 'Quellen', sub: 'Feinschliff nach den ersten echten Läufen' },
];

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
  title: string;
  /** Was ist noch Platzhalter? */
  what: string;
  /** Wo bzw. wie ersetzen */
  where: string;
  /** Unterseite der App, in der sich das ändern lässt */
  route?: string;
  optional?: boolean;
  /** true = die App erkennt, dass es erledigt ist; false = noch offen; null = nicht erkennbar (von Hand abhaken) */
  auto: (c: CheckContext) => boolean | null;
}

const live = (c: CheckContext) => !c.demo;

export const CHECK_ITEMS: CheckItem[] = [
  // ---------------------------------------------------------------- Dummy-Daten
  {
    id: 'dummy-anzeigen',
    group: 'inhalte',
    title: 'Erfundene Anzeigen',
    what: 'Alle Anzeigen in Stapel, Liste und Karte sind erfunden und tragen das Etikett „Dummy“. Ihre Fristen rücken jeden Tag mit, damit immer etwas zu sehen ist.',
    where: 'In config.json neben index.html "daten": "live" und "apiUrl" (Adresse des Servers) eintragen, sobald der Server läuft. Kein neuer Build nötig (docs/WEBSITE.md).',
    auto: live,
  },
  {
    id: 'dummy-markierungen',
    group: 'inhalte',
    title: 'Beispiel-Markierungen und Lieblingsorte',
    what: 'Fünf Anzeigen sind schon gemerkt, weggelegt, beworben oder Herzensjob; Sachsen-Anhalt und Leipzig stehen als Lieblingsorte drin.',
    where: 'Fallen mit den echten Daten weg. Eigene Lieblingsorte unter Ich → Lieblingsorte.',
    route: '/ich/orte',
    auto: live,
  },
  {
    id: 'dummy-laeufe',
    group: 'inhalte',
    title: 'Nachgestellte Läufe, Probeläufe und KI-Vorschläge',
    what: 'Lauf-Protokoll, Aussortiertes, der Probelauf neuer Quellen und die Brücken-Vorschläge der KI sind nur nachgestellt; es wird nichts abgerufen.',
    where: 'Echt, sobald Server, GitHub-Abläufe und KI-Schlüssel eingerichtet sind (siehe „Server und Konten“).',
    auto: live,
  },
  {
    id: 'testfotos',
    group: 'inhalte',
    title: 'Testfotos',
    what: 'Eigene Testfotos liegen auf den Einrichtungen. Im echten Betrieb kommen die Bilder aus der Anzeige oder von Wikimedia.',
    where: 'Ich → Aussehen → Testfotos entfernen.',
    route: '/ich',
    optional: true,
    auto: (c) => c.testPhotos === 0,
  },
  // ---------------------------------------------------------------- Persönliches
  {
    id: 'steckbrief',
    group: 'persoenlich',
    title: 'Suchprofil: noch das Startprofil',
    what: 'Der Score rechnet mit einem breit gehaltenen Startprofil (Psychologie allgemein, Promotion vor Postdoc, ab E 13). Fast alles landet deshalb über 75 %.',
    where: 'Nach dem Interview: Ich → Steckbrief importieren (Format: docs/STECKBRIEF-ENTWURF.md), oder das Profil von Hand anpassen.',
    route: '/ich/steckbrief',
    auto: (c) => c.profile.origin !== 'start',
  },
  {
    id: 'horizont',
    group: 'persoenlich',
    title: 'Horizont: Start-Brücken',
    what: 'Zehn breite Start-Brücken (Mensch & KI, IT-Sicherheit, UX …) holen Stellen außerhalb der Psychologie herein, bis der Steckbrief eigene festlegt.',
    where: 'Kommt mit dem Steckbrief, oder Ich → Horizont: Brücken bearbeiten, pausieren, vorschlagen lassen.',
    route: '/ich/horizont',
    auto: (c) => !horizontOf(c.profile).bruecken.some((b) => b.aktiv && b.herkunft === 'start'),
  },
  {
    id: 'zuhause',
    group: 'persoenlich',
    title: `Zuhause: ${DEFAULT_HOME.label}`,
    what: 'Von hier aus misst die App Entfernungen und den Umkreis. Das ist der eingebaute Standardwert.',
    where: 'Ich → Zuhause & Umkreis. Stimmt Halle, einfach abhaken.',
    route: '/ich/zuhause',
    auto: (c) => !(c.home.lat === DEFAULT_HOME.lat && c.home.lon === DEFAULT_HOME.lon),
  },
  {
    id: 'name',
    group: 'persoenlich',
    title: 'Name „Stellenbüchlein“ (Arbeitstitel)',
    what: 'Der Name steht im Manifest (Name auf dem Handy), im Seitentitel, auf der Anmeldeseite und in Benachrichtigungen.',
    where: 'apps/web/vite.config.ts (name, short_name), apps/web/index.html (title, apple-mobile-web-app-title), apps/web/src/screens/Login.tsx, apps/web/src/sw.ts; dann neu bauen.',
    auto: () => null,
  },
  {
    id: 'kontakt',
    group: 'persoenlich',
    title: 'Kontaktadresse für Seitenbetreiber und Push',
    what: 'Ohne eigene Angabe steht im User-Agent der Pipeline nur „privates Jobsuche-Werkzeug“ und als Absender der Benachrichtigungen mailto:stellenbuechlein@example.org.',
    where: 'GitHub-Secrets CRAWLER_CONTACT und VAPID_SUBJECT (docs/BETRIEB.md, Schritt 4).',
    auto: () => null,
  },
  // ---------------------------------------------------------------- Website
  {
    id: 'adresse',
    group: 'website',
    title: 'Adresse der App',
    what: 'Die App läuft noch lokal, als Datei oder unter einer workers.dev-Adresse.',
    where: 'Inhalt von apps/web/dist-site auf die eigene Website laden (docs/WEBSITE.md) oder eigene Domain im Worker eintragen (docs/BETRIEB.md, Schritt 2a).',
    auto: (c) => {
      const h = c.location.hostname;
      return !!h && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(h) && !h.endsWith('.workers.dev') && c.location.protocol !== 'file:';
    },
  },
  {
    id: 'https',
    group: 'website',
    title: 'Sichere Verbindung (https)',
    what: 'Ohne https lässt sich die App nicht aufs Handy installieren, und es gibt keine Benachrichtigungen.',
    where: 'Beim Webhoster ein kostenloses Zertifikat (Let’s Encrypt) einschalten. Die .htaccess im Paket leitet dann automatisch auf https um.',
    auto: (c) => c.location.protocol === 'https:',
  },
  {
    id: 'rechtliches',
    group: 'website',
    title: 'Impressum und Datenschutz klären',
    what: 'Mit Dummy-Daten ist die App für alle sichtbar, die die Adresse kennen; mit echten Daten nur mit Schlüssel. Sie setzt keine Cookies, lädt im echten Betrieb aber Fotos von Wikimedia und den Websites der Anzeigen.',
    where: 'Prüfen, ob die Website (oder dieser Ordner) einen Link auf Impressum und Datenschutzerklärung braucht. Suchmaschinen sind ausgesperrt.',
    auto: () => null,
  },
  // ---------------------------------------------------------------- Server und Konten
  {
    id: 'cloudflare',
    group: 'server',
    title: 'Cloudflare-Worker und Datenbank',
    what: 'In apps/api/wrangler.toml steht als Datenbank-ID noch der Platzhalter 00000000-0000-0000-0000-000000000000.',
    where: 'npx wrangler d1 create stellenbuechlein, ID eintragen, npm run db:migrate:remote, npm run deploy (docs/BETRIEB.md, Schritt 2).',
    auto: live,
  },
  {
    id: 'schluessel',
    group: 'server',
    title: 'App-Schlüssel und Pipeline-Schlüssel',
    what: 'APP_KEY (für die App) und INGEST_KEY (für die Pipeline) sind noch nicht gesetzt.',
    where: 'npx wrangler secret put APP_KEY und INGEST_KEY, je ein eigener Zufallswert (docs/BETRIEB.md, Schritt 2).',
    auto: live,
  },
  {
    id: 'freigabe',
    group: 'server',
    title: 'Freigabe für deine Website (ALLOWED_ORIGIN)',
    what: 'Liegt die App auf deiner Website und der Server bei Cloudflare, muss der Worker Anfragen von deiner Adresse erlauben.',
    where: 'In apps/api/wrangler.toml unter [vars] ALLOWED_ORIGIN = "https://deine-website.de" eintragen und neu veröffentlichen (docs/WEBSITE.md). Läuft die App im Worker selbst, entfällt das.',
    auto: live,
  },
  {
    id: 'github',
    group: 'server',
    title: 'Einsammeln über GitHub (API_URL, INGEST_KEY)',
    what: 'Noch kein echter Lauf: Ohne Repository und Secrets sammelt niemand Anzeigen ein.',
    where: 'Code in ein GitHub-Repository, Secrets API_URL und INGEST_KEY, dann Actions → Einsammeln → Run workflow (docs/BETRIEB.md, Schritt 4).',
    auto: (c) => !c.demo && c.runs > 0,
  },
  {
    id: 'ki',
    group: 'server',
    title: 'KI-Schlüssel (DeepSeek)',
    what: 'Ohne KI fehlen Kurzfassungen, die Weite, KI-Urteile im Horizont, die Nachprüfung unsicherer Fristen und das Urteil im Probelauf.',
    where: 'GitHub-Secret DEEPSEEK_API_KEY und Worker-Secret LLM_API_KEY (docs/BETRIEB.md, Schritte 4 und 5a). Erkannt wird nur der Worker-Teil.',
    auto: (c) => !c.demo && c.aiSuggest,
  },
  {
    id: 'jetzt',
    group: 'server',
    title: 'Knopf „Jetzt einsammeln“ und sofortige Probeläufe',
    what: 'Ohne GitHub-Token im Worker gibt es den Knopf nicht, und Probeläufe warten auf den nächsten Tageslauf.',
    where: 'Fine-grained Token mit „Actions: Read and write“, npx wrangler secret put GITHUB_TOKEN, GITHUB_REPO in wrangler.toml (docs/BETRIEB.md, Schritt 5).',
    optional: true,
    auto: (c) => !c.demo && c.ingestTrigger,
  },
  {
    id: 'push',
    group: 'server',
    title: 'Push-Schlüssel für Erinnerungen (VAPID)',
    what: 'Ohne Schlüssel erscheinen Fristen-Erinnerungen nur in der App unter „Gemerkt“.',
    where: 'npx web-push generate-vapid-keys; öffentlicher Schlüssel in wrangler.toml, beide als GitHub-Secrets (docs/BETRIEB.md, Schritt 3).',
    optional: true,
    auto: (c) => !c.demo && c.vapid,
  },
  {
    id: 'websuche',
    group: 'server',
    title: 'Websuche für die Erkundung (BRAVE_API_KEY)',
    what: 'Ohne zweite Quelle sucht die Erkundung neuer Websites nur bei der Arbeitsagentur.',
    where: 'GitHub-Secret BRAVE_API_KEY (Konditionen beim Anbieter prüfen).',
    optional: true,
    auto: () => null,
  },
  // ---------------------------------------------------------------- Quellen
  {
    id: 'quellen-adresse',
    group: 'quellen',
    title: 'Einrichtungen ohne Stellenseite',
    what: 'Für einige Einrichtungen ist die Adresse der Stellenliste noch unbekannt. Bis dahin finden die Portale deren Anzeigen.',
    where: 'Die Pipeline sucht selbst und legt Vorschläge unter Ich → Quellen & Läufe → Neu an; Adressen lassen sich dort auch von Hand eintragen.',
    route: '/ich/quellen',
    auto: (c) => (c.sourceSummary ? c.sourceSummary.missingUrl === 0 : null),
  },
  {
    id: 'quellen-durchsicht',
    group: 'quellen',
    title: 'Erster echter Lauf: Quellen durchsehen',
    what: 'Die Adressen stammen aus der Recherche; viele sind noch nicht gegen einen echten Lauf geprüft. Rechne mit einigen Runden in den ersten ein bis zwei Wochen.',
    where: 'Ich → Quellen & Läufe: Quellen mit „Fehler“, „leer“ oder „Warnung“ ansehen, Adresse oder Linkmuster nachschärfen, Probelauf wiederholen.',
    route: '/ich/quellen',
    auto: (c) => (c.demo ? false : c.sourceSummary && c.runs > 0 ? c.sourceSummary.problems === 0 : null),
  },
  {
    id: 'portale',
    group: 'quellen',
    title: 'Abgeschaltete Portale',
    what: 'EURAXESS, academics.de, die Helmholtz-Stellenbörse und Interamt sind aus, weil Adresse oder Nutzungsbedingungen noch zu klären sind.',
    where: 'data/seed/portals.json bzw. Ich → Quellen & Läufe: Adresse eintragen und einschalten, wenn geklärt.',
    route: '/ich/quellen',
    optional: true,
    auto: () => null,
  },
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
