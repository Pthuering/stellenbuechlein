import { describe, expect, it } from 'vitest';
import { candidatesFromJson } from '../src/feeds';
import { INTERAMT_BASE, InteramtSession, interamtLoadMore, interamtRows, interamtSearchForm, interamtTotal, viaInteramt } from '../src/interamt';
import { RunLog } from '../src/log';

const cfg = { userAgent: 'Test', minHostIntervalMs: 0, requestTimeoutMs: 5000 };

const row = (id: string, title: string, posted: string) => `
  <tr class="ia-e-table__row">
    <td data-field="StellenangebotId"><a href="./trefferliste?2-1.-x-editLink"><span>${id}</span><span class="ia-sr-only">Stellenausschreibung öffnen</span></a></td>
    <td data-field="Behoerde">Landkreis Eichsfeld</td>
    <td data-field="Stellenbezeichnung">${title}</td>
    <td data-field="PLZOrte">37308 Heilbad Heiligenstadt</td>
    <td data-field="Von">${posted}</td>
  </tr>`;

const SEARCH_PAGE = `<html><body>
  <form id="id1aa" method="post" action="./stellensuche?0-1.-tabOneContentContainer-oneContent-1-item-form" aria-label="Stellendetailsuche">
    <input type="text" name="stellensucheFilterAttributes.suchtextContainer:stellensucheFilterAttributes.suchText" value="">
    <button name="navFooter:navFooter_body:submitRow:actions:0:button" id="id1a7">Suchen</button>
  </form>
  <form aria-label="Stellenschnellsuche" action="./stellensuche?0-1.-tabTwo"><button name="other">x</button></form>
</body></html>`;

const RESULT_PAGE = `<html><head><script>Wicket.Ajax.baseUrl="trefferliste?2";</script></head><body>
  <p>Trefferliste 12 Angebote gefunden</p>
  <table><thead><tr><th>ID</th></tr></thead><tbody id="id85">
  ${Array.from({ length: 10 }, (_, i) => row(String(1505200 + i), `Psychologe ${i}`, '22.10.2026')).join('')}
  </tbody></table>
  <script>Wicket.Ajax.ajax({"u":"./trefferliste?2-1.0-tabTwoContentContainer-twoContent-1-item-table-bottomToolbars-toolbars-1-container-loadMoreLink","c":"id60","e":"click","pd":true});</script>
</body></html>`;

const MORE_XML = `<?xml version="1.0" encoding="UTF-8"?><ajax-response><component id="id85" ><![CDATA[<tbody id="id85">
  ${Array.from({ length: 12 }, (_, i) => row(String(1505200 + i), `Psychologe ${i}`, i === 11 ? '01.09.2026' : '22.10.2026')).join('')}
</tbody>]]></component></ajax-response>`;

const DETAIL = (id: string) => `<html><body><main><h1>Stellenangebot</h1>
  <p>Der Landkreis sucht eine Psychologin oder einen Psychologen (Stelle ${id}).</p>
  <h2>Ihre Aufgaben</h2><ul><li>Psychologische Diagnostik und Beratung</li><li>Krisenintervention</li></ul>
  <h2>Ihr Profil</h2><p>Abgeschlossenes Studium der Psychologie (Master oder Diplom).</p>
  <h2>Bewerbung</h2><p>Bewerbungen bis zum 08.11.2026 über Interamt.</p>
  ${'<p>Weitere Informationen zur Stelle und zum Team. </p>'.repeat(10)}
</main></body></html>`;

describe('Interamt', () => {
  it('liest Formular, Trefferzahl, Zeilen und die Adresse zum Nachladen', () => {
    expect(interamtSearchForm(SEARCH_PAGE)).toEqual({ action: `${INTERAMT_BASE}stellensuche?0-1.-tabOneContentContainer-oneContent-1-item-form`, button: 'navFooter:navFooter_body:submitRow:actions:0:button' });
    expect(interamtTotal('Stellenübersicht: 12.301 Angebote gefunden')).toBe(12301);
    const rows = interamtRows(RESULT_PAGE);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toEqual({ id: '1505200', title: 'Psychologe 0', org: 'Landkreis Eichsfeld', place: 'Heilbad Heiligenstadt', posted: '2026-10-22' });
    expect(interamtRows(MORE_XML)).toHaveLength(12);
    expect(interamtLoadMore(RESULT_PAGE)).toEqual({ url: `${INTERAMT_BASE}trefferliste?2-1.0-tabTwoContentContainer-twoContent-1-item-table-bottomToolbars-toolbars-1-container-loadMoreLink`, base: 'trefferliste?2' });
  });

  it('Sitzung: merkt Cookies und folgt Weiterleitungen selbst', async () => {
    const seen: { url: string; cookie: string | null; method: string }[] = [];
    const fake = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      seen.push({ url, cookie: headers.get('cookie'), method: init?.method ?? 'GET' });
      if (url.endsWith('stelle?id=1')) return new Response(null, { status: 302, headers: { location: 'stelle?0&id=1', 'set-cookie': 'JSESSIONID=abc; Path=/; Secure; HttpOnly' } });
      if (headers.get('cookie') !== 'JSESSIONID=abc') return new Response(null, { status: 302, headers: { location: url } });
      return new Response('<p>Anzeige</p>', { status: 200 });
    }) as typeof fetch;
    const s = new InteramtSession(cfg, fake);
    const r = await s.request(`${INTERAMT_BASE}stelle?id=1`);
    expect(r).toEqual({ status: 200, url: `${INTERAMT_BASE}stelle?0&id=1`, text: '<p>Anzeige</p>' });
    expect(seen.map((x) => x.cookie)).toEqual([null, 'JSESSIONID=abc']);
  });

  it('sucht, lädt nach und liefert nur vollständig gelesene Anzeigen (neueste zuerst)', async () => {
    const calls: string[] = [];
    const fake = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url.replace(INTERAMT_BASE, '')}`);
      if (url.endsWith('stellensuche')) return new Response(SEARCH_PAGE, { status: 200, headers: { 'set-cookie': 'JSESSIONID=s1' } });
      if (url.includes('item-form')) {
        expect(String(init?.body)).toContain('suchText=Psycholog');
        return new Response(null, { status: 302, headers: { location: 'trefferliste?2' } });
      }
      if (url.endsWith('trefferliste?2')) return new Response(RESULT_PAGE, { status: 200 });
      if (url.includes('loadMoreLink')) {
        expect(new Headers(init?.headers).get('wicket-ajax-baseurl')).toBe('trefferliste?2');
        return new Response(MORE_XML, { status: 200 });
      }
      const id = /id=(\d+)/.exec(url)?.[1];
      if (id) return new Response(DETAIL(id), { status: 200 });
      return new Response('', { status: 404 });
    }) as typeof fetch;
    const list = await viaInteramt(new InteramtSession(cfg, fake), { queries: ['Psycholog'], maxPages: 5, maxDetails: 11 }, new RunLog(false));
    // 12 Treffer, höchstens 11 gelesen: die älteste Anzeige (01.09.) fällt weg
    expect(list).toHaveLength(11);
    expect(list.map((c) => c.url)).not.toContain(`${INTERAMT_BASE}stelle?id=1505211`);
    expect(list.every((c) => c.prefilled?.complete)).toBe(true);
    expect(list[0].prefilled?.title).toBe('Psychologe 0');
    expect(list[0].prefilled?.descriptionMd).toContain('Studium der Psychologie');
    expect(list[0].prefilled?.hiringOrg).toBe('Landkreis Eichsfeld');
    expect(calls.filter((c) => c.includes('loadMoreLink'))).toHaveLength(1);
  });
});

describe('JSON-Listen', () => {
  it('findet Anzeigen auch tief verschachtelt und überspringt Schnittstellen-Links', () => {
    const body = JSON.stringify({
      seo: { link: [{ title: 'deutsch', link: 'https://www.helmholtz.de/api/v1/jobs/' }] },
      content: { colPos0: [{ content: { data: { documents: { list: { results: [{ title: 'Doktorand:in Kognition (w/m/d)', url: 'https://jobs.dzne.de/jobs/1' }] } } } } }] },
    });
    expect(candidatesFromJson(body, 'https://www.helmholtz.de/api/v1/jobs/').map((c) => c.url)).toEqual(['https://jobs.dzne.de/jobs/1']);
  });
});
