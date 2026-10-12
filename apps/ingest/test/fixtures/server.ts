// Lokaler Testserver, der typische Hochschul-Stellenseiten nachbildet.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const page = (title: string, body: string, head = '') =>
  `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title} | Testuniversität</title>${head}</head>
<body><header><nav><a href="/">Startseite</a> <a href="/impressum">Impressum</a> <a href="/datenschutz">Datenschutz</a> <a href="/stellen/">Alle Stellen</a></nav></header>
<main>${body}</main><footer><a href="/barrierefreiheit">Barrierefreiheit</a> <a href="/stellen/datenschutz-bewerbung.pdf">Datenschutzhinweise für Bewerbende</a></footer></body></html>`;

export const JOB1_DESCRIPTION = `<h2>Ihre Aufgaben</h2><ul><li>Planung und Durchführung von EEG-Studien zur Emotionsregulation</li><li>Auswertung mit R</li><li>Mitarbeit in der Lehre (2 SWS)</li></ul>
<h2>Ihr Profil</h2><ul><li>Master in Psychologie</li><li>Erfahrung mit experimentellen Methoden</li></ul>
<p>Die Stelle ist befristet für 3 Jahre (WissZeitVG) und mit 65 % der regelmäßigen Arbeitszeit zu besetzen. Die Vergütung erfolgt nach Entgeltgruppe 13 TV-L.</p>
<p>Bewerbungsfrist: 15.11.2026. Bitte senden Sie Ihre Bewerbung an bewerbung@test-uni.de. Kennziffer: PSY-2026/17.</p>`;

const listPage1 = page(
  'Stellenangebote',
  `<h1>Stellenangebote – wissenschaftliches Personal</h1>
<ul class="jobs">
  <li><a href="/stellen/job-1.html">Wissenschaftliche Mitarbeiterin / Doktorand*in (m/w/d) Emotionsregulation</a> – Frist 15.11.2026</li>
  <li><a href="/stellen/job-2.html">Postdoc (m/w/d) in Kognitiver Neurowissenschaft</a> – Frist 30.11.2026</li>
  <li><a href="/stellen/ausschreibung-3.pdf">Ausschreibung Kennziffer 2026/18 (PDF)</a></li>
  <li><a href="/stellen/chemie.html">Technische Assistenz (m/w/d) im Chemielabor</a> – Frist 01.12.2026</li>
  <li><a href="/privat/geheim.html">Interne Stelle (m/w/d) Personalabteilung</a></li>
</ul>
<nav class="pagination"><a href="/stellen/?page=2">2</a> <a rel="next" href="/stellen/?page=2">weiter</a></nav>`,
  '<link rel="alternate" type="application/rss+xml" href="/feed.xml">',
);

const listPage2 = page(
  'Stellenangebote Seite 2',
  `<h1>Stellenangebote – Seite 2</h1><ul><li><a href="/stellen/job-5.html">Promotionsstelle (w/m/d) Pädagogische Psychologie</a></li></ul>`,
);

const job1 = page(
  'Doktorand*in Emotionsregulation',
  `<h1>Wissenschaftliche Mitarbeiterin / Doktorand*in (m/w/d) Emotionsregulation</h1><p>Teaser</p>`,
  `<meta property="og:image" content="/bilder/labor.jpg"><meta property="og:image:width" content="1200">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: 'Wissenschaftliche Mitarbeiterin / Doktorand*in (m/w/d) Emotionsregulation',
    description: JOB1_DESCRIPTION,
    datePosted: '2026-10-01',
    validThrough: '2026-11-15T23:59:00+01:00',
    hiringOrganization: { '@type': 'Organization', name: 'Testuniversität' },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Halle (Saale)', addressCountry: 'DE' } },
  })}</script>`,
);

const job2 = page(
  'Postdoc Kognitive Neurowissenschaft',
  `<article><h1>Postdoc (m/w/d) in Kognitiver Neurowissenschaft</h1>
<p>Am Institut für Psychologie ist zum nächstmöglichen Zeitpunkt eine Stelle als Postdoc zu besetzen. Wir untersuchen Gedächtnisprozesse mit fMRT und Computermodellen.</p>
<h2>Aufgaben</h2><ul><li>Eigenständige Forschung zu episodischem Gedächtnis</li><li>Betreuung von Abschlussarbeiten</li><li>Publikationen in internationalen Zeitschriften</li></ul>
<h2>Voraussetzungen</h2><ul><li>Abgeschlossene Promotion in Psychologie oder Neurowissenschaft</li><li>Erfahrung mit fMRT-Datenanalyse (Python)</li></ul>
<p>Vergütung: E 14 TV-L, Vollzeit, befristet für zwei Jahre.</p>
<p>Ihre Bewerbung senden Sie bitte bis zum 30. November 2026 an postdoc@test-uni.de.</p></article>`,
);

const job5 = page(
  'Promotionsstelle Pädagogische Psychologie',
  `<h1>Promotionsstelle (w/m/d) Pädagogische Psychologie</h1>
<p>Kurzbeschreibung – die vollständige Ausschreibung finden Sie im PDF.</p>
<p><a href="/stellen/ausschreibung-5.pdf">Ausschreibung als PDF herunterladen</a></p>`,
);

const chemie = page(
  'Technische Assistenz Chemie',
  `<h1>Technische Assistenz (m/w/d) im Chemielabor</h1>
<p>Am Institut für Anorganische Chemie ist zum 01.01.2027 eine Stelle als technische Assistenz zu besetzen. Das Labor arbeitet an neuen Katalysatoren für die Wasserstofferzeugung.</p>
<h2>Aufgaben</h2><ul><li>Betreuung und Wartung von Analysegeräten (HPLC, GC-MS, NMR)</li><li>Probenvorbereitung und Dokumentation der Messreihen</li><li>Bestellwesen und Gefahrstoffverwaltung</li></ul>
<h2>Profil</h2><ul><li>Abgeschlossene Ausbildung als CTA oder vergleichbare Qualifikation</li><li>Erfahrung mit chromatographischen Verfahren</li></ul>
<p>Vergütung E 8 TV-L, Vollzeit, unbefristet. Bewerbungsfrist: 01.12.2026. Bewerbung an chemie@test-uni.de.</p>`,
);

// Seite, deren Inhalt erst per JavaScript nach einem Cookie-Klick erscheint.
const jsJob = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Stelle</title>
<script>
  function zeigen() {
    document.getElementById('cookie').remove();
    document.getElementById('app').innerHTML = \`<main><h1>Studienkoordination (m/w/d) Psychotherapieforschung</h1>
    <p>Kurzfassung der Stelle.</p><button id="mehr" onclick="mehr()">Mehr anzeigen</button><div id="rest"></div></main>\`;
  }
  function mehr() {
    document.getElementById('rest').innerHTML = \`<h2>Ihre Aufgaben</h2><ul><li>Koordination einer multizentrischen Psychotherapiestudie</li><li>Schulung der Studientherapeut*innen</li><li>Datenmanagement und Qualitätssicherung</li></ul>
    <h2>Ihr Profil</h2><ul><li>Master in Psychologie</li><li>Erfahrung in klinischer Forschung</li></ul>
    <p>Vergütung nach E 13 TV-L, 75 %, befristet auf 3 Jahre.</p><p>Bewerbungsfrist: 20.11.2026. Bewerbungen an studie@test-uni.de.</p>\`;
    document.getElementById('mehr').remove();
  }
</script></head><body>
<div id="cookie" style="position:fixed;bottom:0;background:#eee;padding:1em">Wir nutzen Cookies. <button onclick="zeigen()">Alle akzeptieren</button></div>
<div id="app"></div><script></script><script></script><script></script></body></html>`;

const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Stellen</title>
<item><title>Wissenschaftliche Mitarbeiterin / Doktorand*in (m/w/d) Emotionsregulation</title><link>/stellen/job-1.html?utm_source=rss</link><pubDate>Wed, 01 Oct 2026 08:00:00 +0200</pubDate></item>
<item><title>Studienkoordination (m/w/d) Psychotherapieforschung</title><link>/stellen/js-job.html</link></item>
</channel></rss>`;

async function makePdf(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 800;
  for (const l of lines) {
    p.drawText(l, { x: 50, y, size: 11, font });
    y -= 16;
  }
  return doc.save();
}

const PDF3_LINES = [
  'Testuniversitaet - Institut fuer Psychologie',
  'Kennziffer 2026/18',
  'Wissenschaftliche Mitarbeiterin / Wissenschaftlicher Mitarbeiter (m/w/d)',
  'im Bereich Sozialpsychologie (Promotion)',
  'Ihre Aufgaben:',
  '- Durchfuehrung von Online-Experimenten zu Vorurteilen',
  '- Mitarbeit in der Lehre',
  'Ihr Profil:',
  '- Master in Psychologie, gute Kenntnisse in R',
  'Die Stelle ist mit 50 % zu besetzen und nach E 13 TV-L verguetet.',
  'Die Stelle ist auf drei Jahre befristet.',
  'Bewerbungsfrist: 10.12.2026. Bewerbungen an sozial@test-uni.de.',
];

const PDF5_LINES = [
  'Promotionsstelle (w/m/d) Paedagogische Psychologie',
  'Ihre Aufgaben:',
  '- Studien zur Lernmotivation in Schulen',
  '- Auswertung von Laengsschnittdaten',
  'Ihr Profil:',
  '- Master in Psychologie oder Lehramt',
  'Umfang 65 %, Entgeltgruppe 13 TV-L, befristet fuer 4 Jahre.',
  'Bewerbungen bitte bis zum 05.12.2026 an paed@test-uni.de.',
];


// ---------------------------------------------------------------- Zentrale Börse mit Stellen außerhalb der Psychologie

const zentralList = page(
  'Alle Stellen',
  `<h1>Stellenausschreibungen der Testuniversität</h1>
<ul>
  <li><a href="/zentral/usable-security.html">Wissenschaftliche:r Mitarbeiter:in (m/w/d) Usable Security</a></li>
  <li><a href="/zentral/mobilitaet.html">Referent:in (m/w/d) Mobilitätsplanung</a></li>
  <li><a href="/zentral/steuern.html">Sachbearbeitung (m/w/d) Steuern und Abgaben</a></li>
  <li><a href="/zentral/hausmeister.html">Hausmeister:in (m/w/d) Campus Süd</a></li>
  <li><a href="/zentral/studienberatung.html">Koordinator:in (m/w/d) Studienberatung</a></li>
  <li><a href="/zentral/frist-ohne-jahr.html">Wissenschaftliche Mitarbeiterin (m/w/d) Klinische Psychologie</a></li>
  <li><a href="/zentral/frist-weit.html">Promotionsstelle (m/w/d) Kognitive Psychologie</a></li>
</ul>`,
);

const usableSecurity = page(
  'Usable Security',
  `<h1>Wissenschaftliche:r Mitarbeiter:in (m/w/d) Usable Security</h1>
<p>Am Institut für Informatik untersuchen wir, wie Beschäftigte Phishing-Mails erkennen und wie Sicherheitswarnungen gestaltet sein müssen, damit Menschen ihnen folgen.</p>
<h2>Ihre Aufgaben</h2><ul><li>Planung und Auswertung von Nutzerstudien und Online-Experimenten</li><li>Befragungen von Beschäftigten in Partnerunternehmen</li><li>Publikation der Ergebnisse</li></ul>
<h2>Ihr Profil</h2><ul><li>Master in Informatik, Mensch-Computer-Interaktion oder einem verwandten Fach</li><li>Erfahrung mit empirischen Methoden</li></ul>
<p>Vergütung E 13 TV-L, 100 %, befristet auf 3 Jahre. Bewerbungsfrist: 20.11.2026. Bewerbungen an security@test-uni.de.</p>`,
);

const mobilitaet = page(
  'Mobilitätsplanung',
  `<h1>Referent:in (m/w/d) Mobilitätsplanung</h1>
<p>Im Dezernat Bau und Liegenschaften entwickeln Sie das Mobilitätskonzept der Universität weiter.</p>
<h2>Ihre Aufgaben</h2><ul><li>Konzeption und Auswertung einer Befragung von Studierenden und Beschäftigten zu ihren Wegen zur Arbeit</li><li>Statistische Auswertung und Bericht an die Hochschulleitung</li><li>Abstimmung mit Stadt und Verkehrsbetrieben</li></ul>
<h2>Ihr Profil</h2><ul><li>Hochschulabschluss in Sozialwissenschaften, Geografie oder Verkehrsplanung</li><li>Sicherer Umgang mit Statistik-Software</li></ul>
<p>E 11 TV-L, unbefristet. Bewerbungsfrist: 25.11.2026.</p>`,
);

const steuern = page(
  'Steuern',
  `<h1>Sachbearbeitung (m/w/d) Steuern und Abgaben</h1>
<p>In der Finanzabteilung bearbeiten Sie Umsatzsteuer-Voranmeldungen und Abgaben.</p>
<h2>Ihre Aufgaben</h2><ul><li>Umsatzsteuer und Ertragsteuern der Betriebe gewerblicher Art</li><li>Statistik der Abgaben für das Ministerium</li><li>Auskünfte zur Befragung durch das Finanzamt</li></ul>
<h2>Ihr Profil</h2><ul><li>Ausbildung als Steuerfachangestellte:r</li><li>Erfahrung im Steuerrecht</li></ul>
<p>E 9a TV-L, unbefristet. Bewerbungsfrist: 30.11.2026.</p>`,
);

const hausmeister = page(
  'Hausmeister',
  `<h1>Hausmeister:in (m/w/d) Campus Süd</h1><p>Sie betreuen die Gebäude am Campus Süd, kleinere Reparaturen und Winterdienst.</p>
<h2>Aufgaben</h2><ul><li>Kontrollgänge</li><li>Reparaturen</li></ul><h2>Profil</h2><ul><li>Handwerkliche Ausbildung</li></ul><p>E 5 TV-L. Bewerbungsfrist: 30.11.2026.</p>`,
);

const studienberatung = page(
  'Studienberatung',
  `<h1>Koordinator:in (m/w/d) Studienberatung</h1>
<p>In der Zentralen Studienberatung begleiten Sie Studieninteressierte und Studierende bei Orientierungsfragen und unterstützen Lernprozesse in Workshops.</p>
<h2>Ihre Aufgaben</h2><ul><li>Einzelgespräche mit Ratsuchenden</li><li>Konzeption von Workshops zu Lernstrategien</li><li>Auswertung der jährlichen Befragung der Ratsuchenden</li></ul>
<h2>Ihr Profil</h2><ul><li>Hochschulabschluss</li><li>Erfahrung in Beratung</li></ul>
<p>E 11 TV-L, 100 %, unbefristet. Bewerbungsfrist: 27.11.2026.</p>`,
);

const fristOhneJahr = page(
  'Klinische Psychologie',
  `<h1>Wissenschaftliche Mitarbeiterin (m/w/d) Klinische Psychologie</h1>
<p>Am Lehrstuhl für Klinische Psychologie ist eine Stelle zur Promotion zu besetzen. Wir erforschen Emotionsregulation bei Angststörungen.</p>
<h2>Aufgaben</h2><ul><li>Durchführung einer Interventionsstudie</li><li>Diagnostische Interviews</li></ul><h2>Profil</h2><ul><li>Master in Psychologie</li></ul>
<p>E 13 TV-L, 65 %. Bewerbungen richten Sie bitte bis zum 30.11. an klinisch@test-uni.de.</p>`,
);

const fristWeit = page(
  'Kognitive Psychologie',
  `<h1>Promotionsstelle (m/w/d) Kognitive Psychologie</h1>
<p>Das neue Graduiertenkolleg zu Aufmerksamkeit und Gedächtnis beginnt im Herbst 2027. Wir suchen Promovierende in Psychologie.</p>
<h2>Aufgaben</h2><ul><li>Experimente zu Aufmerksamkeit</li></ul><h2>Profil</h2><ul><li>Master in Psychologie</li></ul>
<p>E 13 TV-L, 65 %. Bewerbungsschluss für die erste Runde: 15.07.2027.</p>`,
);

// ---------------------------------------------------------------- Fremde Websites (für die Erkundung, Host „localhost“)

const fremdJob = (n: number, org: string, title: string, body: string) =>
  `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title} | ${org}</title></head><body><main><h1>${title}</h1>${body}
<p>Ihre Bewerbung senden Sie bitte bis zum 28.11.2026 an jobs${n}@beispiel.org.</p></main></body></html>`;

const FREMD: Record<string, string> = {
  '/fremd/job-1.html': fremdJob(1, 'Stiftung Lernforschung', 'Wissenschaftliche Mitarbeiterin (m/w/d) Lernpsychologie',
    '<h2>Aufgaben</h2><ul><li>Studien zur Lernmotivation in der Ausbildung</li><li>Auswertung mit R</li></ul><h2>Profil</h2><ul><li>Master in Psychologie</li></ul><p>E 13 TVöD, 75 %.</p>'),
  '/fremd/job-2.html': fremdJob(2, 'Institut für Arbeitsgestaltung e.V.', 'Projektmitarbeiter:in (m/w/d) Arbeitspsychologie',
    '<h2>Aufgaben</h2><ul><li>Gefährdungsbeurteilung psychischer Belastung in Betrieben</li><li>Befragungen und Workshops</li></ul><h2>Profil</h2><ul><li>Studium der Psychologie</li></ul><p>Vollzeit, befristet auf 2 Jahre.</p>'),
  '/fremd/job-3.html': fremdJob(3, 'Verkehrsinstitut Nord', 'Wissenschaftliche Mitarbeiterin (m/w/d) Verkehrspsychologie',
    '<h2>Aufgaben</h2><ul><li>Fahrsimulatorstudien zur Ablenkung</li><li>Auswertung von Blickdaten</li></ul><h2>Profil</h2><ul><li>Master in Psychologie oder Kognitionswissenschaft</li></ul><p>E 13 TV-L, 100 %.</p>'),
  '/fremd/job-4.html': fremdJob(4, 'Gesundheitsforum Süd gGmbH', 'Referent:in (m/w/d) Gesundheitspsychologie',
    '<h2>Aufgaben</h2><ul><li>Evaluation von Präventionsprogrammen</li><li>Psychologische Fachbeiträge</li></ul><h2>Profil</h2><ul><li>Master in Psychologie</li></ul><p>Teilzeit 80 %.</p>'),
};

function baJobs(base: string, was: string): unknown {
  const all = [
    { refnr: '10000-1', titel: 'Wissenschaftliche Mitarbeiterin Lernpsychologie', arbeitgeber: 'Stiftung Lernforschung', externeUrl: `${base}/fremd/job-1.html`, arbeitsort: { ort: 'Halle (Saale)', land: 'Deutschland' } },
    { refnr: '10000-2', titel: 'Projektmitarbeiter:in Arbeitspsychologie', arbeitgeber: 'Institut für Arbeitsgestaltung e.V.', externeUrl: `${base}/fremd/job-2.html`, arbeitsort: { ort: 'Leipzig', land: 'Deutschland' } },
    { refnr: '10000-3', titel: 'Wissenschaftliche Mitarbeiterin Verkehrspsychologie', arbeitgeber: 'Verkehrsinstitut Nord', externeUrl: `${base}/fremd/job-3.html`, arbeitsort: { ort: 'Halle (Saale)', land: 'Deutschland' } },
    { refnr: '10000-4', titel: 'Referent:in Gesundheitspsychologie', arbeitgeber: 'Gesundheitsforum Süd gGmbH', externeUrl: `${base}/fremd/job-4.html`, arbeitsort: { ort: 'Halle (Saale)', land: 'Deutschland' } },
    // Arbeitgeber steht schon im Register: wird von der Erkundung gar nicht erst gelesen
    { refnr: '10000-5', titel: 'Postdoc Kognitive Neurowissenschaft', arbeitgeber: 'Testuniversität', externeUrl: `${base}/fremd/job-5.html`, arbeitsort: { ort: 'Halle (Saale)', land: 'Deutschland' } },
  ];
  return { stellenangebote: all, maxErgebnisse: all.length, gesucht: was };
}

const homepage = page('Startseite', '<h1>Willkommen an der Testuniversität</h1><p>Forschung und Lehre.</p><p><a href="/stellen/">Stellenangebote</a> <a href="/studium">Studium</a></p>');

export interface FixtureServer {
  url: string;
  server: Server;
  hits: Map<string, number>;
  close(): Promise<void>;
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const pdf3 = await makePdf(PDF3_LINES);
  const pdf5 = await makePdf(PDF5_LINES);
  const hits = new Map<string, number>();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const key = url.pathname + url.search;
    hits.set(key, (hits.get(key) ?? 0) + 1);
    const send = (status: number, type: string, body: string | Uint8Array) => {
      res.writeHead(status, { 'content-type': type });
      res.end(body);
    };
    const html = (b: string) => send(200, 'text/html; charset=utf-8', b);
    if (FREMD[url.pathname]) return html(FREMD[url.pathname]);
    if (url.pathname === '/ba/pc/v4/jobs') {
      // Nachgebaute Jobsuche der Arbeitsagentur; die Anzeigen liegen auf „localhost“ (eine fremde Website)
      const base = `http://localhost:${(server.address() as AddressInfo).port}`;
      return send(200, 'application/json', JSON.stringify(baJobs(base, url.searchParams.get('was') ?? '')));
    }
    switch (url.pathname) {
      case '/':
        return html(homepage);
      case '/zentral/':
        return html(zentralList);
      case '/zentral/usable-security.html':
        return html(usableSecurity);
      case '/zentral/mobilitaet.html':
        return html(mobilitaet);
      case '/zentral/steuern.html':
        return html(steuern);
      case '/zentral/hausmeister.html':
        return html(hausmeister);
      case '/zentral/studienberatung.html':
        return html(studienberatung);
      case '/zentral/frist-ohne-jahr.html':
        return html(fristOhneJahr);
      case '/zentral/frist-weit.html':
        return html(fristWeit);
      case '/robots.txt':
        return send(200, 'text/plain', 'User-agent: *\nDisallow: /privat/\nCrawl-delay: 0\n');
      case '/stellen/':
        return html(url.searchParams.get('page') === '2' ? listPage2 : listPage1);
      case '/stellen/job-1.html':
        return html(job1);
      case '/stellen/job-2.html':
        return html(job2);
      case '/stellen/job-5.html':
        return html(job5);
      case '/stellen/chemie.html':
        return html(chemie);
      case '/stellen/js-job.html':
        return html(jsJob);
      case '/stellen/teaser.html':
        return html(page('Kurzinfo', '<h1>Postdoc Kognitive Neurowissenschaft</h1><p>Kurzinfo zur Stelle.</p><p><a href="/stellen/job-2.html">Hier entlang zu allen Details</a></p>'));
      case '/stellen/ohne-titel.html':
        return html(`<!doctype html><html><head><meta charset="utf-8"><title>Startseite</title></head><body><main><p>Am Lehrstuhl für Entwicklungspsychologie ist eine Promotionsstelle zu besetzen. Wir erforschen die Sprachentwicklung von Kleinkindern mit Eye-Tracking.</p><p>Aufgaben: Durchführung von Studien, Auswertung, Publikation. Profil: Master in Psychologie, Interesse an Entwicklungsforschung. Ihre Bewerbung schicken Sie bitte per E-Mail an kind@test-uni.de. Die Unterlagen sollten uns bis Ende November vorliegen, spätestens aber am 28. 11. 2026 eingegangen sein.</p></main></body></html>`);
      case '/stellen/ausschreibung-3.pdf':
        return send(200, 'application/pdf', pdf3);
      case '/stellen/ausschreibung-5.pdf':
        return send(200, 'application/pdf', pdf5);
      case '/privat/geheim.html':
        return html(page('Geheim', '<h1>Interne Stelle (m/w/d)</h1>'));
      case '/feed.xml':
        return send(200, 'application/rss+xml', rss);
      case '/bilder/labor.jpg':
        return send(200, 'image/jpeg', 'jpg');
      default:
        return send(404, 'text/html', page('Nicht gefunden', '<p>404</p>'));
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    server,
    hits,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
