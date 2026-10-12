// Das Quellen-Register: alle Websites, die die App schon kennt (Quellen, Websites der Einrichtungen,
// erledigte Funde). Was nicht drinsteht, ist ein möglicher blinder Fleck.

import { siteKeyOf, type Institution, type Source } from '@stellen/core';

export class Registry {
  private keys = new Set<string>();

  constructor(sources: Source[], institutions: Institution[], handledSiteKeys: Iterable<string> = []) {
    for (const s of sources) if (s.url) this.add(siteKeyOf(s.url));
    for (const i of institutions) if (i.website) this.add(siteKeyOf(i.website));
    for (const k of handledSiteKeys) this.add(k);
  }

  private add(key: string | null): void {
    if (key) this.keys.add(key);
  }

  get size(): number {
    return this.keys.size;
  }

  /**
   * Steht die Anzeige im Register? Ja, wenn ihre Einrichtung bekannt ist oder ihre Website im Register steht.
   * Lässt sich weder Website noch Arbeitgeber bestimmen, zählt sie nicht als neu.
   */
  known(url: string | null | undefined, institutionId: string | null, org?: string | null): boolean {
    if (institutionId) return true;
    const key = siteKeyOf(url, org);
    if (!key) return true;
    return this.keys.has(key);
  }

  siteKey(url: string | null | undefined, org?: string | null): string | null {
    return siteKeyOf(url, org);
  }

  /** Nach einem Fund: weitere Anzeigen derselben Website zählen in diesem Lauf trotzdem als neu. */
  has(key: string): boolean {
    return this.keys.has(key);
  }
}
