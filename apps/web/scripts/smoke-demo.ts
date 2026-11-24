// Rauchtest für die gebaute Demo (dist-demo/index.html) im echten Browser:
// Wischen, Rückgängig, Detail, Filter, Umfrage, Steckbrief-Import, Karte, Platzhalter-Checkliste, Sprachen – und keine Laufzeitfehler.
// Mit installiertem Chrome statt Playwright-Chromium: CHROMIUM_PATH="…/chrome.exe".
//   npm run build:demo && npx tsx apps/web/scripts/smoke-demo.ts

import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import { CHECK_ITEMS } from '../src/lib/checklist';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../dist-demo/index.html');
if (!existsSync(file)) {
  console.error('Erst die Demo bauen: npm run build:demo');
  process.exit(1);
}
const url = pathToFileURL(file).href;

const waiting = async (page: Page): Promise<number> => {
  const t = (await page.locator('.page-sub').first().textContent()) ?? '';
  const m = t.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
// Die Prüfungen klicken auf deutsche Texte; Englisch und Serbisch kommen am Ende dran.
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
// Ohne Wahl startet die App auf Serbisch; die Prüfungen brauchen Deutsch (später gewählte Sprachen bleiben)
await page.addInitScript(() => {
  if (localStorage.getItem('sb.lang') == null) localStorage.setItem('sb.lang', JSON.stringify('de'));
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

try {
  await page.goto(`${url}#/stapel`);
  await page.waitForSelector('.card--top');
  const start = await waiting(page);
  assert.ok(start > 0, 'Stapel ist leer');

  // Nach rechts ziehen = merken
  const box = (await page.locator('.card--top').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2 + i * 30, box.y + box.height / 2 + i * 2);
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert.equal(await waiting(page), start - 1, 'Wischen nach rechts hat nicht gemerkt');

  // Rückgängig
  await page.click('[aria-label="Rückgängig"]');
  await page.waitForTimeout(300);
  assert.equal(await waiting(page), start, 'Rückgängig hat nicht funktioniert');

  // Tastatur: links = weglegen, s = Herzensjob
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(450);
  await page.keyboard.press('s');
  await page.waitForTimeout(450);
  assert.equal(await waiting(page), start - 2);

  // Detail öffnen und schließen
  await page.click('.card__more');
  await page.waitForSelector('.detail-title');
  assert.ok(((await page.locator('.clipping').textContent()) ?? '').length > 100, 'Anzeigentext fehlt');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.detail-title').count(), 0);

  // Filter: nur Postdoc
  await page.click('[aria-label^="Filter"]');
  await page.click('.sheet >> text=Postdoc');
  await page.click('text=Fertig');
  await page.waitForTimeout(300);
  const filtered = await waiting(page);
  assert.ok(filtered < start - 2, 'Filter wirkt nicht');
  await page.click('[aria-label^="Filter"]');
  await page.click('text=Alle Filter zurücksetzen');
  await page.click('text=Fertig');

  // Reihenfolge: erst die gut passenden, dann der Rest; nahe Fristen zuerst
  const scoreOfTop = async () => Number(((await page.locator('.card--top .score__num').first().textContent()) ?? '').replace(/\D/g, ''));
  const deckBefore = await waiting(page);
  await page.click('[aria-label^="Filter"]');
  await page.click('.sheet >> text=ab 50 %');
  await page.click('.sheet >> text=Nahe Fristen zuerst');
  await page.waitForSelector('.sheet >> text=1 Monat');
  await page.click('text=Fertig');
  await page.waitForTimeout(300);
  const sub = (await page.locator('.page-sub').first().textContent()) ?? '';
  // „12 ab 50 %, danach 30 weitere“ | „Alle ab 50 % durch, noch 42 weitere“ | „42 Anzeigen warten“
  const split = sub.match(/^(\d+) ab 50 %, danach (\d+)/);
  const restOnly = sub.match(/noch (\d+) weitere/);
  const total = split ? Number(split[1]) + Number(split[2]) : restOnly ? Number(restOnly[1]) : await waiting(page);
  assert.equal(total, deckBefore, `Schwelle blendet Karten aus, statt sie nach hinten zu stellen: ${sub}`);
  if (split) assert.ok((await scoreOfTop()) >= 50, 'oberste Karte liegt unter der Schwelle');
  await page.click('[aria-label^="Filter"]');
  await page.click('.sheet .chips >> text=aus');
  await page.click('.sheet >> text=Nahe Fristen zuerst');
  await page.click('text=Fertig');
  await page.waitForTimeout(300);
  assert.equal(await waiting(page), deckBefore);

  // Wenn die gut passenden durch sind: öfter einstreuen ändert nur die Reihenfolge, nicht die Zahl der Karten
  await page.click('[aria-label^="Filter"]');
  await page.click('.sheet >> text=unter 70 %');
  await page.click('.sheet >> text=öfter Brücken, Horizont & Ausland');
  assert.ok(((await page.locator('.sheet').textContent()) ?? '').includes('Auslandsstellen jede dritte Karte'), 'Erklärung zu „öfter“ fehlt');
  await page.click('text=Fertig');
  await page.waitForTimeout(300);
  assert.equal(await waiting(page), deckBefore, '„öfter einstreuen“ verändert die Zahl der Karten');
  await page.click('[aria-label^="Filter"]');
  await page.click('.sheet >> text=unter 51 %');
  await page.click('.sheet >> text=nachfragen');
  await page.click('text=Fertig');
  await page.waitForTimeout(300);

  // Gemerkt: Herzensjob ist da
  await page.click('.tab:nth-child(3)');
  await page.waitForSelector('#saved-title, .screen [id$="title"]');
  await page.waitForSelector('.list .row');
  assert.ok((await page.locator('.list .row').count()) >= 1);

  // Alle: alle offenen Anzeigen, auch entschiedene (Weggelegte bleiben in der Liste) und Brücken-Karten, die im
  // Stapel noch auf das KI-Urteil warten. Darum mindestens so viele wie im Stapel; gezeigt werden die ersten 40.
  await page.click('.tab:nth-child(4)');
  await page.waitForSelector('#all-title');
  await page.waitForSelector('.list .row');
  await page.waitForTimeout(200);
  const openAll = await waiting(page);
  assert.ok(openAll >= start, `„Alle“ zählt weniger offene Anzeigen (${openAll}) als der Stapel (${start})`);
  assert.equal(await page.locator('.list .row').count(), Math.min(40, openAll), 'Alle-Liste ist nicht vollständig');
  assert.ok((await page.locator('text=weggelegt').count()) >= 1, 'Weggelegte fehlt in „Alle“');

  // Umfrage: ein paar Antworten, bis zum Ergebnis blättern, Profil übernehmen
  await page.goto(`${url}#/ich/umfrage`);
  await page.click('text=Los geht’s');
  await page.fill('input[placeholder="Vorname"]', 'Test');
  for (let i = 0; i < 3; i++) await page.click('.survey-nav__next');
  await page.click('.survey-chips >> text=Klinische Psychologie & Psychotherapie');
  // Direkt nach dem Antippen neu laden (vor dem verzögerten Speichern): Die Umfrage geht an derselben Stelle weiter
  await page.reload();
  await page.waitForSelector('.survey-title');
  assert.equal((await page.locator('.survey-title').textContent())?.trim(), 'Welche Bereiche der Psychologie interessieren dich?', 'Umfrage geht nach dem Neuladen nicht auf derselben Seite weiter');
  assert.equal(await page.locator('.survey-chips button', { hasText: 'Klinische Psychologie & Psychotherapie' }).getAttribute('aria-pressed'), 'true', 'Antwort ging beim Neuladen verloren');
  assert.match((await page.locator('.survey-saved').textContent()) ?? '', /gespeichert/, 'Hinweis „gespeichert“ fehlt');
  for (let i = 0; i < 3; i++) await page.click('.survey-nav__next');
  await page.getByRole('checkbox', { name: /^Promotion/ }).click();
  while (await page.locator('.survey-nav__next').count()) await page.click('.survey-nav__next');
  await page.click('text=Profil übernehmen');
  await page.waitForTimeout(300);
  assert.equal((await page.locator('.index-card__title').first().textContent())?.trim(), 'Profil von Test', 'Profil aus der Umfrage wurde nicht übernommen');

  // Steckbrief-Beispiel übernehmen
  await page.goto(`${url}#/ich/steckbrief`);
  await page.click('text=Beispiel einfügen');
  await page.click('text=Steckbrief übernehmen');
  await page.waitForTimeout(300);
  assert.ok(((await page.locator('.index-card__title').first().textContent()) ?? '').includes('Beispiel'), 'Profil wurde nicht übernommen');
  await page.goto(`${url}#/ich/orte`);
  assert.ok((await page.locator('.chip--removable').count()) >= 4, 'Lieblingsorte aus dem Steckbrief fehlen');

  // Karte mit allen offenen Anzeigen
  await page.goto(`${url}#/karte`);
  await page.waitForSelector('.map-svg .state');
  await page.click('.segmented >> text=Alle');
  await page.waitForTimeout(800);
  assert.ok((await page.locator('.map-svg .bubble').count()) > 3, 'Keine Markierungen auf der Karte');

  // Testfotos: ein Bild wählen, die Karte im Stapel zeigt dann ein Foto statt der Skizze
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.goto(`${url}#/ich`);
  await page.setInputFiles('input[type=file][accept="image/*"]', { name: 'test.png', mimeType: 'image/png', buffer: pixel });
  await page.waitForSelector('.photo-strip img');
  await page.click('.tab:nth-child(1)');
  await page.waitForSelector('.card--top img.polaroid__img');

  // Bilder aus: Ort und Score stehen in der Kopfzeile
  await page.goto(`${url}#/ich`);
  await page.click('text=Bilder auf den Karten im Stapel');
  await page.click('.tab:nth-child(1)');
  await page.waitForSelector('.card--top .card__head');
  assert.equal(await page.locator('.card--top .polaroid').count(), 0, 'Bild trotz ausgeschaltetem Schalter');

  // Brücke und Horizont: Die geprüften Karten kommen eingestreut in den Stapel, mit Begründung statt Prozentzahl.
  // Allein zeigen lassen sie sich nicht mehr (normale Einträge kommen immer), also bis zur ersten weiterblättern.
  await page.click('.tab:nth-child(1)');
  await page.waitForSelector('.card--top');
  const deckNow = await waiting(page);
  let skipped = 0;
  while (!(await page.locator('.card--top .lane-tag').count()) && skipped < 10) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(450);
    skipped++;
  }
  assert.equal(await page.locator('.card--top .lane-tag').count(), 1, 'Keine Brücken- oder Horizont-Karte unter den ersten zehn Karten im Stapel');
  assert.ok(((await page.locator('.card--top .card__why').textContent()) ?? '').includes('Warum das passen könnte'), 'Begründung fehlt auf der Brücken-Karte');
  for (let i = 0; i < skipped; i++) {
    await page.click('[aria-label="Rückgängig"]');
    await page.waitForTimeout(300);
  }
  assert.equal(await waiting(page), deckNow, 'Rückgängig hat die übersprungenen Karten nicht zurückgeholt');
  // Ausblenden geht nur ausdrücklich im Filter
  await page.click('[aria-label^="Filter"]');
  await page.click('.sheet button.chip >> text=Brücken-Karten');
  await page.click('.sheet button.chip >> text=Horizont-Karten');
  await page.click('text=Fertig');
  await page.waitForTimeout(300);
  assert.ok((await waiting(page)) < deckNow, 'Ausblenden der Brücken- und Horizont-Karten wirkt nicht');
  await page.click('[aria-label^="Filter"]');
  await page.click('text=Alle Filter zurücksetzen');
  await page.click('text=Fertig');

  // Horizont-Seite: Brücken aus dem Steckbrief, KI-Vorschlag übernehmen
  await page.goto(`${url}#/ich/horizont`);
  await page.waitForSelector('.rings');
  const bridges = await page.locator('.bridge-list > .bridge').count();
  assert.equal(bridges, 2, 'Brücken aus dem Steckbrief fehlen');
  await page.click('text=Brücken vorschlagen lassen');
  await page.waitForSelector('.bridge--suggested');
  await page.locator('.bridge--suggested >> text=Übernehmen').first().click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.bridge-list > .bridge:not(.bridge--suggested)').count(), 3, 'KI-Vorschlag wurde nicht übernommen');

  // Neue Website per Probelauf ins Register
  await page.goto(`${url}#/ich/quellen`);
  await page.click('text=Website hinzufügen');
  // eine der erfundenen „neuen Websites“ aus den Dummy-Daten
  await page.fill('.sheet input[type=url]', 'https://muster-institut-fuer-nutzerforschung.example/karriere/');
  await page.click('text=Probelauf starten');
  await page.waitForSelector('.verdict', { timeout: 10_000 });
  assert.ok((await page.locator('.check-sample').count()) >= 1, 'Probe-Anzeigen fehlen');
  await page.click('text=Als Quelle übernehmen');
  await page.waitForTimeout(400);
  await page.click('[role=tab] >> text=/^Neu/');
  assert.ok((await page.locator('.suggestion').count()) >= 3, 'Neu entdeckte Websites fehlen');

  // Platzhalter-Checkliste: Knopf oben, Haken zählt mit
  await page.goto(`${url}#/stapel`);
  await page.click('.demo-banner__btn');
  await page.waitForSelector('.check-item');
  const before = (await page.locator('.page-sub').first().textContent()) ?? '';
  await page.locator('.check-item').filter({ hasText: 'Zuhause' }).locator('input').check();
  await page.waitForTimeout(200);
  const after = (await page.locator('.page-sub').first().textContent()) ?? '';
  assert.equal(Number(after.match(/d+/)?.[0]), Number(before.match(/d+/)?.[0]) + 1, 'Haken in der Checkliste zählt nicht');
  assert.equal(await page.locator('.check-item').count(), CHECK_ITEMS.length, 'Checkliste unvollständig');

  // Neue Websites: mindestens drei Anzeigen in „Alle“ markiert
  await page.goto(`${url}#/alle`);
  await page.waitForSelector('.list .row');
  assert.ok((await page.locator('.row .chip >> text=neue Website').count()) >= 3, 'Markierung „neue Website“ fehlt');
  assert.ok((await page.locator('.row .chip--dummy').count()) >= 10, 'Etikett „Dummy“ fehlt');

  // Sprachen: Reiter übersetzt, alle Seiten laufen ohne Fehler
  for (const [lang, saved] of [['en', 'Saved'], ['sr', 'Sačuvano']] as const) {
    await page.evaluate((l) => localStorage.setItem('sb.lang', JSON.stringify(l)), lang);
    await page.goto(`${url}#/stapel`);
    await page.reload();
    await page.waitForSelector('.card--top');
    assert.equal(await page.locator('.tab', { hasText: saved }).count(), 1, `Reiter „${saved}“ fehlt (${lang})`);
    for (const route of ['karte', 'gemerkt', 'alle', 'ich', 'ich/umfrage', 'ich/profil', 'ich/steckbrief', 'ich/horizont', 'ich/orte', 'ich/zuhause', 'ich/erinnerungen', 'ich/quellen', 'ich/ki', 'ich/checkliste', 'ich/ueber']) {
      await page.goto(`${url}#/${route}`);
      await page.waitForTimeout(150);
    }
  }
  await page.evaluate(() => localStorage.setItem('sb.lang', JSON.stringify('de')));

  assert.deepEqual(errors, [], `Laufzeitfehler:\n${errors.join('\n')}`);
  console.log('Rauchtest bestanden.');
} finally {
  await browser.close();
}
