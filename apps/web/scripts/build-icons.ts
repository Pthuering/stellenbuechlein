// Rendert die App-Symbole als PNG (Playwright/Chromium).
//   npx tsx apps/web/scripts/build-icons.ts

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { badgeSvg, iconSvg, maskableSvg } from './icon-art';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');

async function render(svg: string, size: number, file: string, transparent = false): Promise<void> {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: resolve(out, file), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  await browser.close();
}

writeFileSync(resolve(out, 'icon.svg'), iconSvg());
await render(iconSvg(), 192, 'icon-192.png', true);
await render(iconSvg(), 512, 'icon-512.png', true);
await render(maskableSvg(), 512, 'icon-maskable-512.png');
await render(maskableSvg(), 180, 'apple-touch-icon.png');
await render(badgeSvg(), 96, 'badge-96.png', true);
console.log('Symbole geschrieben nach', out);
