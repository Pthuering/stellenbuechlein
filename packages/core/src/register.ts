// Das Quellen-Register: Welche Websites kennt die App schon? Wichtig für die Suche nach blinden Flecken:
// Jeder Lauf soll Anzeigen von Websites bringen, die hier noch nicht stehen.

import { registrableHost } from './dedup';
import { normalizeText } from './text';

/** Stellenbörsen und Portale, die Anzeigen vieler Arbeitgeber sammeln: Dort zählt der Arbeitgeber, nicht die Website. */
export const AGGREGATOR_HOSTS = new Set([
  'arbeitsagentur.de', 'psychjob.eu', 'academicpositions.com', 'academics.de', 'zeit.de', 'stellenwerk.de', 'europa.eu',
  'indeed.com', 'indeed.de', 'stepstone.de', 'linkedin.com', 'xing.com', 'jobvector.de', 'wissenschaftsjobs.de', 'interamt.de',
  'bund.de', 'leibniz-gemeinschaft.de', 'helmholtz.de', 'jobs.de', 'stellenanzeigen.de', 'monster.de', 'kimeta.de', 'jobware.de',
  'gesinesjobtipps.de', 'goodjobs.eu', 'talents4good.org', 'karriere.nrw', 'unicum.de', 'jobteaser.com',
]);

/** Bewerbermanagement-Systeme: Hier gehört die Unterdomain (firma.jobs.personio.de) dem Arbeitgeber. */
export const ATS_HOSTS = new Set([
  'personio.de', 'personio.com', 'softgarden.io', 'softgarden.de', 'myworkdayjobs.com', 'umantis.com', 'successfactors.eu',
  'successfactors.com', 'b-ite.com', 'b-ite.de', 'helixjobs.com', 'teamtailor.com', 'stellenticket.de', 'onlyfy.jobs', 'prescreenapp.io',
  'join.com', 'recruitee.com', 'greenhouse.io', 'lever.co', 'smartrecruiters.com', 'dvinci.de', 'dvinci-easy.com', 'rexx-systems.com',
  'concludis.de', 'jobbase.io', 'kenjo.io', 'hr4you.org', 'mein-check-in.de', 'bewerbung.dvinci.de', 'jobs.b-ite.com',
]);

export function isAggregatorUrl(url: string | null | undefined): boolean {
  const h = url ? registrableHost(url) : null;
  return !!h && AGGREGATOR_HOSTS.has(h);
}

/**
 * Schlüssel einer Website im Register:
 *  - normale Website: die Domain („uni-beispiel.de“)
 *  - Bewerbermanagement-System: die volle Unterdomain („institut.jobs.personio.de“)
 *  - Portal/Stellenbörse: der Arbeitgeber („arbeitgeber:stiftung beispiel“), falls bekannt
 */
export function siteKeyOf(url: string | null | undefined, org?: string | null): string | null {
  if (url) {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      const reg = registrableHost(url);
      if (reg && ATS_HOSTS.has(reg)) return host;
      if (reg && !AGGREGATOR_HOSTS.has(reg)) return reg;
    } catch {
      // ungültige Adresse: weiter mit dem Arbeitgeber
    }
  }
  const n = org ? normalizeText(org) : '';
  return n.length >= 3 ? `arbeitgeber:${n.slice(0, 80)}` : null;
}

/** Lesbare Form eines Register-Schlüssels. */
export function siteLabel(key: string): string {
  return key.startsWith('arbeitgeber:') ? key.slice('arbeitgeber:'.length) : key;
}
