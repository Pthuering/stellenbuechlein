// Rauchtest für die gebaute Demo (dist-demo/index.html) im echten Browser:
// Wischen, Rückgängig, Detail, Filter, Umfrage, Steckbrief-Import, Karte, Platzhalter-Checkliste – und keine Laufzeitfehler.
// Mit installiertem Chrome statt Playwright-Chromium: CHROMIUM_PATH="…/chrome.exe".
//   npm run build:demo && npx tsx apps/web/scripts/smoke-demo.ts

import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright-core';

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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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

  // Gemerkt: Herzensjob ist da
  await page.click('.tab:nth-child(3)');
  await page.waitForSelector('#saved-title, .screen [id$="title"]');
  await page.waitForSelector('.list .row');
  assert.ok((await page.locator('.list .row').count()) >= 1);

  // Alle: Weggelegte bleiben in der Liste
  await page.click('.tab:nth-child(4)');
  await page.waitForSelector('#all-title');
  await page.waitForSelector('.list .row');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.list .row').count(), Math.min(40, start), 'Alle-Liste ist nicht vollständig');
  assert.ok((await page.locator('text=weggelegt').count()) >= 1, 'Weggelegte fehlt in „Alle“');

  // Umfrage: ein paar Antworten, bis zum Ergebnis blättern, Profil übernehmen
  await page.goto(`${url}#/ich/umfrage`);
  await page.click('text=Los geht’s');
  await page.fill('input[placeholder="Vorname"]', 'Test');
  for (let i = 0; i < 3; i++) await page.click('.survey-nav__next');
  await page.click('.survey-chips >> text=Klinische Psychologie & Psychotherapie');
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

  // Horizont: Filter auf den Ring „Horizont“ zeigt nur Horizont-Karten
  await page.click('.tab:nth-child(1)');
  await page.waitForSelector('.card--top');
  await page.click('[aria-label^="Filter"]');
  await page.click('.sheet >> text=/^Horizont$/');
  await page.click('text=Fertig');
  await page.waitForTimeout(300);
  assert.ok((await page.locator('.card--top .lane-tag').count()) === 1, 'Keine Horizont-Karte im Stapel');
  assert.ok(((await page.locator('.card--top .card__why').textContent()) ?? '').includes('Warum das passen könnte'), 'Begründung fehlt auf der Horizont-Karte');
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
  assert.ok((await page.locator('.check-item').count()) >= 20, 'Checkliste unvollständig');

  // Neue Websites: mindestens drei Anzeigen in „Alle“ markiert
  await page.goto(`${url}#/alle`);
  await page.waitForSelector('.list .row');
  assert.ok((await page.locator('.row .chip >> text=neue Website').count()) >= 3, 'Markierung „neue Website“ fehlt');
  assert.ok((await page.locator('.row .chip--dummy').count()) >= 10, 'Etikett „Dummy“ fehlt');

  assert.deepEqual(errors, [], `Laufzeitfehler:\n${errors.join('\n')}`);
  console.log('Rauchtest bestanden.');
} finally {
  await browser.close();
}
