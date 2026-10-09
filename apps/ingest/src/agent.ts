// Browser-Agent: öffnet eine Anzeige im echten Browser und arbeitet sich bis zum vollständigen Text vor –
// erst mit festen Regeln (Cookie-Banner, "mehr anzeigen", iFrames, PDF), dann mit KI-Entscheidungen.

import type { Page } from 'playwright-core';
import { bestFrame, dismissCookies, expandContent, gotoAndSettle, type BrowserPool } from './browser';
import { assessCompleteness, fromHtml, readPdf, type PostingData } from './extract';
import type { Http } from './http';
import type { Llm } from './llm';
import type { RunLog } from './log';

const FORBIDDEN = /bewerb|apply|login|anmeld|registrier|absenden|submit|teilen|share|drucken|print|merken|facebook|twitter|linkedin|xing|whatsapp|instagram|mailto|newsletter|job-?alert|abonn/i;

interface Clickable {
  i: number;
  label: string;
}

async function clickables(page: Page): Promise<Clickable[]> {
  return page
    .evaluate((forbiddenSrc) => {
      const forbidden = new RegExp(forbiddenSrc, 'i');
      const out: { i: number; label: string }[] = [];
      const els = Array.from(document.querySelectorAll('a, button, [role="button"], summary, [onclick]'));
      let i = 0;
      for (const el of els) {
        const h = el as HTMLElement;
        const rect = h.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || getComputedStyle(h).visibility === 'hidden') continue;
        const text = (h.innerText || h.getAttribute('aria-label') || h.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        const href = (h as HTMLAnchorElement).href || '';
        if (!text && !href) continue;
        if (forbidden.test(`${text} ${href}`)) continue;
        h.setAttribute('data-sb-idx', String(i));
        out.push({ i, label: `${h.tagName.toLowerCase()} „${text.slice(0, 90)}“${href ? ` → ${href.slice(0, 140)}` : ''}` });
        i++;
        if (i >= 80) break;
      }
      return out;
    }, FORBIDDEN.source)
    .catch(() => [] as { i: number; label: string }[]);
}

async function snapshot(page: Page, http: Http): Promise<PostingData | null> {
  const frame = await bestFrame(page);
  if (!frame.html) return null;
  const { data, pdfLinks } = fromHtml(frame.html, frame.url);
  if (pdfLinks.length && (!data.complete || data.descriptionMd.length < 1500)) {
    const pdf = await readPdf(http, pdfLinks[0], true);
    if (pdf) {
      data.descriptionMd = data.descriptionMd.length > 120 ? `${data.descriptionMd}\n\n---\n\n**Ausschreibung (PDF)**\n\n${pdf.markdown}` : pdf.markdown;
      data.pdfUrl = pdfLinks[0];
      const c = assessCompleteness(data.descriptionMd);
      data.complete = c.complete;
      data.incompleteReason = c.reason;
    }
  }
  data.method = `browser${data.method === 'jsonld' ? '+jsonld' : ''}`;
  return data;
}

export interface AgentResult {
  data: PostingData | null;
  steps: string[];
}

export async function agentReadPosting(pool: BrowserPool, http: Http, llm: Llm, log: RunLog, url: string, titleHint?: string | null): Promise<AgentResult> {
  const steps: string[] = [];
  if (!pool.budgetLeft) return { data: null, steps: ['Browser-Zeitbudget aufgebraucht'] };
  return pool.timed(async () => {
    const page = await pool.newPage();
    try {
      await gotoAndSettle(page, url);
      if (await dismissCookies(page)) steps.push('Cookie-Hinweis geschlossen');
      const expanded = await expandContent(page);
      if (expanded) steps.push(`${expanded}× „mehr anzeigen“`);
      let best = await snapshot(page, http);

      for (let step = 0; step < 6 && !(best?.complete) && llm.available; step++) {
        const els = await clickables(page);
        const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
        const d = await llm.agentStep(
          `Vollständige Stellenausschreibung ${titleHint ? `„${titleHint}“ ` : ''}lesbar machen`,
          text,
          els,
          steps,
        );
        if (!d || d.action !== 'click' || d.index == null) {
          if (d) steps.push(d.action === 'done' ? 'KI: Text vollständig' : `KI: aufgegeben (${d.reason})`);
          break;
        }
        const target = page.locator(`[data-sb-idx="${d.index}"]`).first();
        const label = els.find((e) => e.i === d.index)?.label ?? `#${d.index}`;
        const popupPromise = page.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);
        const clicked = await target.click({ timeout: 4000 }).then(() => true).catch(() => false);
        steps.push(`KI-Klick: ${label}${clicked ? '' : ' (fehlgeschlagen)'}`);
        if (!clicked) continue;
        const popup = await popupPromise;
        const active = popup ?? page;
        await active.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
        await active.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => undefined);
        await dismissCookies(active);
        await expandContent(active);
        const snap = await snapshot(active, http);
        if (snap && (!best || snap.descriptionMd.length > best.descriptionMd.length * 0.9)) best = snap;
        if (popup && popup !== page) await popup.close().catch(() => undefined);
      }
      if (best && !best.title && titleHint) best.title = titleHint;
      return { data: best, steps };
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
      log.warn(`Browser-Agent bei ${url}: ${msg}`);
      steps.push(`Fehler: ${msg}`);
      return { data: null, steps };
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}
