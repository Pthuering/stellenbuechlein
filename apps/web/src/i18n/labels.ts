// Übersetzte Bezeichnungen für die festen Listen aus @stellen/core (Stellenarten, Einrichtungsarten,
// Bundesländer, Kategorien, Sortierung, Ringe, Dosis). Der Kern behält seine deutschen Listen für
// Pipeline und KI; die Oberfläche fragt hier.

import type { CategoryId, HorizontDosis, InstitutionKind, JobKind, Lane, SortKey, StateCode } from '@stellen/core';
import { lang, type Lang } from './index';

type Table<K extends string> = Record<Lang, Record<K, string>>;

const JOB_KINDS: Table<JobKind> = {
  de: {
    promotion: 'Promotion',
    postdoc: 'Postdoc',
    wiss_ma: 'Wiss. Mitarbeit',
    professur: 'Professur',
    projekt: 'Projekt & Koordination',
    lehre: 'Lehre',
    shk: 'Hilfskraft',
    klinik: 'Klinik & Therapie',
    verwaltung: 'Verwaltung & Technik',
    sonstige: 'Sonstiges',
  },
  en: {
    promotion: 'PhD',
    postdoc: 'Postdoc',
    wiss_ma: 'Research associate',
    professur: 'Professorship',
    projekt: 'Projects & coordination',
    lehre: 'Teaching',
    shk: 'Student assistant',
    klinik: 'Clinic & therapy',
    verwaltung: 'Administration & technical',
    sonstige: 'Other',
  },
  sr: {
    promotion: 'Doktorat',
    postdoc: 'Postdok',
    wiss_ma: 'Istraživač saradnik',
    professur: 'Profesura',
    projekt: 'Projekti i koordinacija',
    lehre: 'Nastava',
    shk: 'Studentski asistent',
    klinik: 'Klinika i terapija',
    verwaltung: 'Administracija i tehnika',
    sonstige: 'Ostalo',
  },
};

const INSTITUTION_KINDS: Table<InstitutionKind> = {
  de: {
    universitaet: 'Universität',
    ph: 'Pädagogische Hochschule',
    hochschule: 'Hochschule',
    privat: 'Private Hochschule',
    mpg: 'Max-Planck-Institut',
    leibniz: 'Leibniz-Institut',
    helmholtz: 'Helmholtz-Zentrum',
    fraunhofer: 'Fraunhofer-Institut',
    klinik: 'Klinikum',
    ressort: 'Bundes-/Landesinstitut',
    sonstige: 'Forschung, Stiftung, Verband',
    unternehmen: 'Unternehmen',
  },
  en: {
    universitaet: 'University',
    ph: 'University of education',
    hochschule: 'University of applied sciences',
    privat: 'Private university',
    mpg: 'Max Planck Institute',
    leibniz: 'Leibniz Institute',
    helmholtz: 'Helmholtz Centre',
    fraunhofer: 'Fraunhofer Institute',
    klinik: 'Hospital',
    ressort: 'Federal or state institute',
    sonstige: 'Research, foundation, association',
    unternehmen: 'Company',
  },
  sr: {
    universitaet: 'Univerzitet',
    ph: 'Pedagoška visoka škola',
    hochschule: 'Visoka škola primenjenih nauka',
    privat: 'Privatni univerzitet',
    mpg: 'Institut Maks Plank',
    leibniz: 'Institut Lajbnic',
    helmholtz: 'Centar Helmholc',
    fraunhofer: 'Institut Fraunhofer',
    klinik: 'Klinika',
    ressort: 'Savezni ili pokrajinski institut',
    sonstige: 'Istraživanje, fondacija, udruženje',
    unternehmen: 'Kompanija',
  },
};

const STATES: Table<StateCode> = {
  de: {
    BW: 'Baden-Württemberg',
    BY: 'Bayern',
    BE: 'Berlin',
    BB: 'Brandenburg',
    HB: 'Bremen',
    HH: 'Hamburg',
    HE: 'Hessen',
    MV: 'Mecklenburg-Vorpommern',
    NI: 'Niedersachsen',
    NW: 'Nordrhein-Westfalen',
    RP: 'Rheinland-Pfalz',
    SL: 'Saarland',
    SN: 'Sachsen',
    ST: 'Sachsen-Anhalt',
    SH: 'Schleswig-Holstein',
    TH: 'Thüringen',
  },
  en: {
    BW: 'Baden-Württemberg',
    BY: 'Bavaria',
    BE: 'Berlin',
    BB: 'Brandenburg',
    HB: 'Bremen',
    HH: 'Hamburg',
    HE: 'Hesse',
    MV: 'Mecklenburg-Western Pomerania',
    NI: 'Lower Saxony',
    NW: 'North Rhine-Westphalia',
    RP: 'Rhineland-Palatinate',
    SL: 'Saarland',
    SN: 'Saxony',
    ST: 'Saxony-Anhalt',
    SH: 'Schleswig-Holstein',
    TH: 'Thuringia',
  },
  sr: {
    BW: 'Baden-Virtemberg',
    BY: 'Bavarska',
    BE: 'Berlin',
    BB: 'Brandenburg',
    HB: 'Bremen',
    HH: 'Hamburg',
    HE: 'Hesen',
    MV: 'Meklenburg-Zapadno Pomorje',
    NI: 'Donja Saksonija',
    NW: 'Severna Rajna-Vestfalija',
    RP: 'Rajna-Palatinat',
    SL: 'Sarland',
    SN: 'Saksonija',
    ST: 'Saksonija-Anhalt',
    SH: 'Šlezvig-Holštajn',
    TH: 'Tiringija',
  },
};

const CATEGORIES: Table<CategoryId> = {
  de: { thema: 'Thema', stelle: 'Stellenart', methoden: 'Methoden & Können', rahmen: 'Rahmen' },
  en: { thema: 'Topic', stelle: 'Position type', methoden: 'Methods & skills', rahmen: 'Conditions' },
  sr: { thema: 'Tema', stelle: 'Vrsta pozicije', methoden: 'Metode i veštine', rahmen: 'Uslovi' },
};

const CATEGORY_HINTS: Table<CategoryId> = {
  de: { thema: 'Fachgebiete und Forschungsthemen', stelle: 'Promotion, Postdoc, Mitarbeit …', methoden: 'Methoden, Software, Erfahrungen', rahmen: 'Entgelt, Umfang, Befristung' },
  en: { thema: 'Fields and research topics', stelle: 'PhD, postdoc, research associate …', methoden: 'Methods, software, experience', rahmen: 'Pay, hours, fixed-term or permanent' },
  sr: { thema: 'Oblasti i istraživačke teme', stelle: 'Doktorat, postdok, istraživač saradnik …', methoden: 'Metode, softver, iskustvo', rahmen: 'Plata, obim zaposlenja, trajanje ugovora' },
};

const SORTS: Table<SortKey> = {
  de: { empfohlen: 'Lieblingsorte & Score', frist: 'Frist zuerst', neu: 'Neueste zuerst', entfernung: 'Nächste zuerst' },
  en: { empfohlen: 'Favorite places & match', frist: 'Deadline first', neu: 'Newest first', entfernung: 'Nearest first' },
  sr: { empfohlen: 'Omiljena mesta i poklapanje', frist: 'Po roku', neu: 'Najnovije', entfernung: 'Najbliže' },
};

const LANES: Table<Lane> = {
  de: { kern: 'Kern', horizont: 'Horizont', weite: 'Weite' },
  en: { kern: 'Core', horizont: 'Horizon', weite: 'Beyond' },
  sr: { kern: 'Jezgro', horizont: 'Horizont', weite: 'Daljina' },
};

const DOSIS: Table<HorizontDosis> = {
  de: { aus: 'aus', selten: 'jede 6. bis 8.', normal: 'jede 3. bis 5.', oft: 'jede 2. bis 3.' },
  en: { aus: 'off', selten: 'every 6th to 8th', normal: 'every 3rd to 5th', oft: 'every 2nd to 3rd' },
  sr: { aus: 'isključeno', selten: 'svaka 6. do 8.', normal: 'svaka 3. do 5.', oft: 'svaka 2. do 3.' },
};

const DOSIS_CARDS: Table<HorizontDosis> = {
  de: { aus: 'aus', selten: 'jede 6. bis 8. Karte', normal: 'jede 3. bis 5. Karte', oft: 'jede 2. bis 3. Karte' },
  en: { aus: 'off', selten: 'every 6th to 8th card', normal: 'every 3rd to 5th card', oft: 'every 2nd to 3rd card' },
  sr: { aus: 'isključeno', selten: 'svaka 6. do 8. kartica', normal: 'svaka 3. do 5. kartica', oft: 'svaka 2. do 3. kartica' },
};

/** „Promotion“, „PhD“, „Doktorat“ */
export const jobKindLabel = (k: JobKind): string => JOB_KINDS[lang()][k];
export const institutionKindLabel = (k: InstitutionKind): string => INSTITUTION_KINDS[lang()][k];
/** Name eines Bundeslands in der aktuellen Sprache. */
export const stateName = (c: StateCode): string => STATES[lang()][c] ?? c;
export const categoryLabel = (c: CategoryId): string => CATEGORIES[lang()][c];
export const categoryHint = (c: CategoryId): string => CATEGORY_HINTS[lang()][c];
export const sortLabel = (k: SortKey): string => SORTS[lang()][k];
/** „Kern“, „Horizont“, „Weite“ */
export const laneName = (l: Lane): string => LANES[lang()][l];
/** „jede 3. bis 5.“ (Kurzform, z. B. für Knöpfe) */
export const dosisLabel = (d: HorizontDosis): string => DOSIS[lang()][d];
/** „jede 3. bis 5. Karte“ */
export const dosisCards = (d: HorizontDosis): string => DOSIS_CARDS[lang()][d];
