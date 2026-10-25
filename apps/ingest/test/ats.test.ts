import { describe, expect, it } from 'vitest';
import { jsonAtsApi, jsonAtsOf, parseAshby, parseGreenhouse, parseHpCareerDetail, parseHpCareerList, parseLever, parseRecruitee, parseSmartRecruitersDetail, parseSmartRecruitersList } from '../src/ats';

const TEXT = 'Ihre Aufgaben: Nutzerstudien planen und auswerten. Ihr Profil: Studium der Psychologie. Wir bieten: ein nettes Team. '.repeat(8);

describe('Bewerbermanagement-Systeme mit JSON-Schnittstelle', () => {
  it('erkennt das System und baut die Adresse der Schnittstelle', () => {
    expect(jsonAtsOf('https://job-boards.greenhouse.io/beispiel')).toBe('greenhouse');
    expect(jsonAtsApi('greenhouse', 'https://job-boards.greenhouse.io/beispiel')).toBe('https://boards-api.greenhouse.io/v1/boards/beispiel/jobs?content=true');
    expect(jsonAtsApi('greenhouse', 'https://boards.greenhouse.io/embed/job_board?for=beispiel')).toBe('https://boards-api.greenhouse.io/v1/boards/beispiel/jobs?content=true');
    expect(jsonAtsOf('https://jobs.eu.lever.co/firma')).toBe('lever');
    expect(jsonAtsApi('lever', 'https://jobs.eu.lever.co/firma')).toBe('https://api.eu.lever.co/v0/postings/firma?mode=json');
    expect(jsonAtsOf('https://jobs.smartrecruiters.com/BoschGroup?search=UX')).toBe('smartrecruiters');
    expect(jsonAtsApi('smartrecruiters', 'https://jobs.smartrecruiters.com/BoschGroup?search=UX')).toBe('https://api.smartrecruiters.com/v1/companies/BoschGroup/postings?q=UX');
    expect(jsonAtsApi('smartrecruiters', 'https://api.smartrecruiters.com/v1/companies/BoschGroup/postings?q=Human+Factors&country=de')).toBe(
      'https://api.smartrecruiters.com/v1/companies/BoschGroup/postings?q=Human+Factors&country=de',
    );
    expect(jsonAtsApi('recruitee', 'https://firma.recruitee.com/o/ux-researcher')).toBe('https://firma.recruitee.com/api/offers/');
    expect(jsonAtsApi('ashby', 'https://jobs.ashbyhq.com/oviva')).toBe('https://api.ashbyhq.com/posting-api/job-board/oviva');
    expect(jsonAtsOf('https://www.uni-beispiel.de/stellen')).toBeNull();
  });

  it('Greenhouse: maskiertes HTML wird zu lesbarem Text', () => {
    const body = JSON.stringify({
      jobs: [{ id: 1, title: 'UX Researcher', absolute_url: 'https://job-boards.greenhouse.io/firma/jobs/1', location: { name: 'Berlin' }, content: `&lt;h2&gt;Ihre Aufgaben&lt;/h2&gt;&lt;p&gt;${TEXT}&lt;/p&gt;`, first_published: '2026-10-20T10:00:00Z' }],
    });
    const [c] = parseGreenhouse(body);
    expect(c.url).toBe('https://job-boards.greenhouse.io/firma/jobs/1');
    expect(c.prefilled?.descriptionMd).toMatch(/^## Ihre Aufgaben/);
    expect(c.prefilled?.descriptionMd).not.toMatch(/&lt;/);
    expect(c.prefilled?.locationText).toBe('Berlin');
    expect(c.prefilled?.complete).toBe(true);
  });

  it('Lever, Recruitee, Ashby: Text und Ort aus der Liste', () => {
    const lever = parseLever(JSON.stringify([{ text: 'Human Factors Engineer', hostedUrl: 'https://jobs.lever.co/firma/abc', categories: { location: 'München', team: 'HMI' }, description: `<p>${TEXT}</p>`, lists: [{ text: 'Profil', content: '<li>Psychologie</li>' }], createdAt: 1792000000000 }]));
    expect(lever[0].prefilled?.descriptionMd).toMatch(/## Profil/);
    expect(lever[0].prefilled?.department).toBe('HMI');
    expect(lever[0].prefilled?.postedAt).toMatch(/^20\d\d-/);

    const rec = parseRecruitee(JSON.stringify({ offers: [{ title: 'Psychologin (m/w/d)', careers_url: 'https://firma.recruitee.com/o/psychologin', description: `<p>${TEXT}</p>`, requirements: '<p>Approbation</p>', location: 'Hamburg' }] }));
    expect(rec[0].prefilled?.descriptionMd).toMatch(/## Anforderungen/);

    const ash = parseAshby(JSON.stringify({ jobs: [{ title: 'Clinical Psychologist', jobUrl: 'https://jobs.ashbyhq.com/oviva/1', descriptionHtml: `<p>${TEXT}</p>`, location: 'Berlin', isListed: true }, { title: 'versteckt', jobUrl: 'https://jobs.ashbyhq.com/oviva/2', isListed: false }] }));
    expect(ash.map((c) => c.title)).toEqual(['Clinical Psychologist']);
  });

  it('Hidden Professionals (TU Darmstadt, Goethe, JGU): Liste und Detail mit rohen Zeilenumbrüchen', () => {
    expect(jsonAtsApi('hpcareer', 'https://www.career.tu-darmstadt.de/tu-darmstadt/jobs')).toBe('https://api.career.hidden-professionals.de/company/listjobs/tu-darmstadt');
    expect(jsonAtsOf('https://api.career.hidden-professionals.de/company/listjobs/jgu')).toBe('hpcareer');
    const list = parseHpCareerList(
      JSON.stringify([{ jobofferId: 1, advertUrl: 'https://www.career.tu-darmstadt.de/tu-darmstadt/job/1', name: [{ languageKey: 'de-DE', translation: 'Wiss. Mitarbeiter:in' }], department: [{ languageKey: 'de-DE', translation: 'FB Humanwissenschaften' }], location: [{ languageKey: 'de-DE', translation: 'Darmstadt' }] }]),
    );
    expect(list[0].title).toBe('Wiss. Mitarbeiter:in – FB Humanwissenschaften');
    expect(list[0].via).toBe('ats:hpcareer');
    const ld = `{\n "@type": "JobPosting", "title": "Wiss. Mitarbeiter:in", "validThrough": "2026-12-01T00:00",\n "description": "<h3>Ihre Aufgaben</h3><p>${TEXT}\n</p>",\n "jobLocation": {"address": {"addressLocality": "Darmstadt"}} }`;
    const d = parseHpCareerDetail(JSON.stringify({ google4JobsData: ld }), list[0].url);
    expect(d?.descriptionMd).toMatch(/^### Ihre Aufgaben/);
    expect(d?.validThrough).toBe('2026-12-01T00:00');
    expect(d?.locationText).toBe('Darmstadt');
  });

  it('SmartRecruiters: Liste ohne Text, Text aus der Detail-Schnittstelle', () => {
    const { candidates, total } = parseSmartRecruitersList(
      JSON.stringify({ totalFound: 1, content: [{ id: '7440001', name: 'UX Researcher (m/w/d)', company: { identifier: 'BoschGroup', name: 'Bosch' }, location: { city: 'Renningen', country: 'de' }, releasedDate: '2026-10-21T08:00:00Z' }] }),
    );
    expect(total).toBe(1);
    expect(candidates[0].url).toBe('https://jobs.smartrecruiters.com/BoschGroup/7440001');
    expect(candidates[0].prefilled).toBeUndefined();
    const d = parseSmartRecruitersDetail(
      JSON.stringify({ name: 'UX Researcher (m/w/d)', company: { name: 'Bosch' }, location: { city: 'Renningen', country: 'de' }, jobAd: { sections: { jobDescription: { title: 'Ihre Aufgaben', text: `<p>${TEXT}</p>` }, qualifications: { title: 'Ihr Profil', text: '<p>Psychologie</p>' } } } }),
      candidates[0].url,
    );
    expect(d?.descriptionMd).toMatch(/## Ihre Aufgaben[\s\S]*## Ihr Profil/);
    expect(d?.hiringOrg).toBe('Bosch');
  });
});

describe('Beliebige JSON-Stellenliste', () => {
  it('findet Titel und (auch relative) Adressen in verschachtelten Daten', async () => {
    const { candidatesFromJson } = await import('../src/feeds');
    const lmu = candidatesFromJson(JSON.stringify([{ id: 'a', job_title: 'Psychologin (m/w/d)', url: '/stellenanzeigen/psychologin/a' }, { id: 'b', job_title: 'Ohne Link' }]), 'https://www.klinik.example/api/v1/career/search.json');
    expect(lmu).toEqual([{ url: 'https://www.klinik.example/stellenanzeigen/psychologin/a', title: 'Psychologin (m/w/d)', via: 'json' }]);
    const fom = candidatesFromJson(JSON.stringify({ ausschreibungen: [{ titel: 'Wiss. Mitarbeiter (m/w/d) Wirtschaftspsychologie', applyOnlineUrl: 'https://jobs.example/view/1.html', anlagen: [{ url: 'https://jobs.example/a.pdf', dateiname: 'x.pdf' }] }] }), 'https://jobs.example/alle');
    expect(fom.map((c) => c.url)).toEqual(['https://jobs.example/view/1.html']);
    expect(candidatesFromJson('kein json', 'https://x.example/')).toEqual([]);
  });
});

describe('BITE (Stellenlisten vieler Hochschulen)', () => {
  it('findet eingebundene Listen und liest Schlüssel, Kanal und Filter aus dem Listen-Skript', async () => {
    const { biteListingsIn, parseBiteListingScript, parseBitePostings } = await import('../src/ats');
    const html = '<div data-bite-jobs-api-listing="universitaet-x:wissenschaftliches-personal-listing"></div><script src="https://cs-assets.b-ite.com/universitaet-x/jobs-api/loader-v1/api-loader-v1.min.js"></script>';
    expect(biteListingsIn(html)).toEqual([{ customer: 'universitaet-x', listing: 'wissenschaftliches-personal-listing' }]);
    const js = 'var i,o,e;i=0,o="homepage",e="wissenschaftliches_personal",function(t){}; var l=r.createClient({key:"772b368818c51d27683efccde180c440264ab3eb"}),a=r.createSearchConfig({channel:i,locale:"de",page:{num:1e3},filter:{"custom.zuordnung":{in:e},locale:{in:["de","en"]}}})';
    expect(parseBiteListingScript(js)).toEqual({ key: '772b368818c51d27683efccde180c440264ab3eb', channel: 0, filter: { 'custom.zuordnung': { in: ['wissenschaftliches_personal'] } } });
    expect(parseBiteListingScript('kein Schlüssel')).toBeNull();
    const { candidates, total } = parseBitePostings(JSON.stringify({ total: 1, jobPostings: [{ title: 'Wiss. Mitarbeiter*in Psychologie', url: 'https://stellen.uni-x.de/jobposting/abc', address: { city: 'Lübeck' }, employer: { name: 'Uni X' } }] }));
    expect(total).toBe(1);
    expect(candidates[0]).toMatchObject({ url: 'https://stellen.uni-x.de/jobposting/abc', via: 'ats:bite', hints: { locality: 'Lübeck', org: 'Uni X' } });
  });
});
