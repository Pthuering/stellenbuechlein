import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { headersFor, parseHeadersFile } from '../src/headers';

const APP_HEADERS = fileURLToPath(new URL('../../web/public/_headers', import.meta.url));

describe('Kopfzeilen im Cloudflare-Format', () => {
  const rules = parseHeadersFile(`
# Kommentar
/*
  X-Frame-Options: DENY
  Cache-Control: no-cache

/assets/*
	Cache-Control: immutable

/icons/:name
  ! X-Frame-Options
  X-Icon: ja

https://example.org/hallo
  X-Absolut: 1
`);

  it('liest Regeln, Kommentare und Einrückung mit Tab', () => {
    expect(rules.map((r) => r.pattern)).toEqual(['/*', '/assets/*', '/icons/:name', 'https://example.org/hallo']);
    expect(rules[1].set).toEqual([['Cache-Control', 'immutable']]);
  });

  it('verbindet gleichnamige Werte mehrerer Regeln mit Komma', () => {
    expect(headersFor(rules, '/assets/app.js')).toEqual({ 'x-frame-options': 'DENY', 'cache-control': 'no-cache, immutable' });
    expect(headersFor(rules, '/')).toEqual({ 'x-frame-options': 'DENY', 'cache-control': 'no-cache' });
  });

  it('Platzhalter gilt für genau einen Pfadabschnitt, "!" entfernt eine Kopfzeile', () => {
    expect(headersFor(rules, '/icons/icon.svg')).toEqual({ 'cache-control': 'no-cache', 'x-icon': 'ja' });
    expect(headersFor(rules, '/icons/a/b.svg')['x-icon']).toBeUndefined();
  });

  it('absolute Adressen zählen nach ihrem Pfad', () => {
    expect(headersFor(rules, '/hallo')['x-absolut']).toBe('1');
    expect(headersFor(rules, '/hallo2')['x-absolut']).toBeUndefined();
  });

  it('Sonderzeichen im Pfad sind wörtlich gemeint', () => {
    const r = parseHeadersFile('/a.b+c\n  X: 1\n');
    expect(headersFor(r, '/a.b+c').x).toBe('1');
    expect(headersFor(r, '/aXb+c').x).toBeUndefined();
  });
});

describe('Kopfzeilen der App (apps/web/public/_headers)', () => {
  const text = readFileSync(APP_HEADERS, 'utf8');
  const rules = parseHeadersFile(text);

  it('bleibt in den Grenzen von Cloudflare (100 Regeln, 2.000 Zeichen pro Zeile)', () => {
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.length).toBeLessThanOrEqual(100);
    for (const line of text.split('\n')) expect(line.length).toBeLessThan(2000);
  });

  it('schützt Startseite, Skripte und Service Worker', () => {
    for (const path of ['/', '/index.html', '/sw.js', '/assets/index-abc.js']) {
      const h = headersFor(rules, path);
      expect(h['content-security-policy']).toContain("script-src 'self'");
      expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['x-robots-tag']).toContain('noindex');
    }
  });

  it('erlaubt Fotos von fremden https-Adressen, aber Abrufe nur von der eigenen (und der Adresssuche)', () => {
    const csp = headersFor(rules, '/')['content-security-policy'];
    expect(csp).toMatch(/img-src [^;]*https:/);
    expect(csp).toMatch(/connect-src 'self' https:\/\/nominatim\.openstreetmap\.org(;|$)/);
    expect(headersFor(rules, '/')['permissions-policy']).toContain('geolocation=(self)');
  });
});
