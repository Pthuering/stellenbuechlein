// Headless-Browser (Playwright) für Seiten, die ohne JavaScript leer bleiben, hinter Cookie-Bannern
// stecken oder Anzeigen in iFrames laden. Läuft lokal oder in GitHub Actions.

import { chromium, type Browser, type BrowserContext, type Frame, type Page } from 'playwright-core';
import type { IngestConfig } from './config';
import type { RunLog } from './log';

const ACCEPT_BUTTON =
  /^(?:alle (?:cookies )?(?:akzeptieren|zulassen|erlauben|annehmen)|akzeptieren(?: und schließen)?|zustimmen|einverstanden|allen zustimmen|alles akzeptieren|ok(?:ay)?|verstanden|accept(?: all)?(?: cookies)?|agree|allow all|i agree|got it|alle auswählen und speichern)$/i;
const EXPAND_BUTTON = /^(?:mehr anzeigen|weiterlesen|mehr lesen|vollständige (?:anzeige|stellenanzeige|ausschreibung)|details? anzeigen|zur stellenanzeige|zur ausschreibung|show more|read more|view details|more details)$/i;
const LOAD_MORE = /^(?:mehr laden|weitere (?:stellen|ergebnisse|anzeigen) (?:laden|anzeigen)|mehr anzeigen|alle anzeigen|load more|show more(?: jobs)?|more jobs)$/i;
const CMP_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  '[data-testid="uc-accept-all-button"]',
  '.cm-btn-accept-all',
  '.cc-allow',
  '#uc-btn-accept-banner',
  'button[data-cookie-accept]',
  '.cookie-accept',
  '#cookie-accept',
  '.js-cookie-accept',
  'button.borlabs-cookie-accept',
];

export interface RenderedPage {
  html: string;
  url: string;
}

export class BrowserPool {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private starting: Promise<void> | null = null;
  usedMs = 0;
  pagesOpened = 0;

  constructor(
    private readonly cfg: IngestConfig,
    private readonly log: RunLog,
  ) {}

  get budgetLeft(): boolean {
    return this.usedMs < this.cfg.browser.timeBudgetMs;
  }

  private async start(): Promise<void> {
    if (this.context) return;
    if (!this.starting) {
      this.starting = (async () => {
        this.browser = await chromium.launch({ headless: true, executablePath: this.cfg.browser.executablePath });
        this.context = await this.browser.newContext({
          locale: 'de-DE',
          timezoneId: 'Europe/Berlin',
          viewport: { width: 1280, height: 1600 },
          userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 ${this.cfg.uaToken}/0.1`,
          acceptDownloads: false,
        });
        // Bilder, Schriften und Videos sparen Zeit und Daten.
        await this.context.route('**/*', (route) => {
          const t = route.request().resourceType();
          return t === 'image' || t === 'media' || t === 'font' ? route.abort() : route.continue();
        });
      })();
    }
    await this.starting;
  }

  async newPage(): Promise<Page> {
    await this.start();
    this.pagesOpened++;
    return this.context!.newPage();
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.context = null;
    this.browser = null;
    this.starting = null;
  }

  /** Misst die Browserzeit für das Zeitbudget. */
  async timed<T>(fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      this.usedMs += Date.now() - t0;
    }
  }

  /** Listenseite rendern: Cookie-Banner schließen, nach unten scrollen, "mehr laden" klicken. */
  async renderList(url: string): Promise<RenderedPage | null> {
    if (!this.budgetLeft) return null;
    return this.timed(async () => {
      const page = await this.newPage();
      try {
        await gotoAndSettle(page, url);
        await dismissCookies(page);
        for (let i = 0; i < 5; i++) {
          const clicked = await clickFirst(page, LOAD_MORE, 1500);
          await page.mouse.wheel(0, 4000).catch(() => undefined);
          await page.waitForTimeout(clicked ? 1500 : 700);
          if (!clicked && i >= 2) break;
        }
        return bestFrame(page);
      } catch (e) {
        this.log.warn(`Browser konnte ${url} nicht laden: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
        return null;
      } finally {
        await page.close().catch(() => undefined);
      }
    });
  }
}

export async function gotoAndSettle(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35_000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  // Bot-Schutz mit JavaScript-Aufgabe (z. B. Anubis) braucht ein paar Sekunden.
  const text = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? '').catch(() => '');
  if (/anubis|checking your browser|just a moment|making sure you(?:'|’)re not a bot|bitte warten/i.test(text)) {
    await page.waitForTimeout(6000);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  }
}

async function clickIn(frame: Frame | Page, re: RegExp, timeout: number): Promise<boolean> {
  for (const role of ['button', 'link'] as const) {
    const loc = frame.getByRole(role, { name: re });
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 3); i++) {
      const el = loc.nth(i);
      if (await el.isVisible().catch(() => false)) {
        const ok = await el.click({ timeout }).then(() => true).catch(() => false);
        if (ok) return true;
      }
    }
  }
  return false;
}

export async function clickFirst(page: Page, re: RegExp, timeout = 2000): Promise<boolean> {
  for (const frame of page.frames()) {
    if (await clickIn(frame, re, timeout)) return true;
  }
  return false;
}

export async function dismissCookies(page: Page): Promise<boolean> {
  for (const sel of CMP_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      if (await el.click({ timeout: 2000 }).then(() => true).catch(() => false)) {
        await page.waitForTimeout(800);
        return true;
      }
    }
  }
  const ok = await clickFirst(page, ACCEPT_BUTTON, 2000);
  if (ok) await page.waitForTimeout(800);
  return ok;
}

export async function expandContent(page: Page): Promise<number> {
  let n = 0;
  for (let i = 0; i < 3; i++) {
    if (!(await clickFirst(page, EXPAND_BUTTON, 1500))) break;
    n++;
    await page.waitForTimeout(700);
  }
  return n;
}

/** Nimmt den Frame mit dem meisten Text (Anzeigen stecken oft in einem iFrame des Bewerbersystems). */
export async function bestFrame(page: Page): Promise<RenderedPage> {
  let best: RenderedPage = { html: await page.content(), url: page.url() };
  let bestLen = await page.evaluate(() => document.body?.innerText?.length ?? 0).catch(() => 0);
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    const url = f.url();
    if (!url || url === 'about:blank' || /google|youtube|vimeo|doubleclick|facebook|recaptcha|maps/i.test(url)) continue;
    const len = await f.evaluate(() => document.body?.innerText?.length ?? 0).catch(() => 0);
    if (len > bestLen * 1.2 && len > 300) {
      best = { html: await f.content().catch(() => ''), url };
      bestLen = len;
    }
  }
  return best;
}
