// Quellen & Läufe: wo eingesammelt wird, was schiefging, was der Grobfilter aussortiert hat.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GATE_TERMS,
  INSTITUTION_KINDS,
  normalizeText,
  siteLabel,
  type Gate,
  type Institution,
  type InstitutionKind,
  type RunInfo,
  type Source,
  type SourceKind,
  type SourceStatus,
} from '@stellen/core';
import type { CheckResult, CheckVerdict, Discovery, GateSkip, SourceCheck, SourcesData } from '../../data/backend';
import { useAppState, useStore } from '../../data/hooks';
import { fmtDate, lang, LANG_TAGS, srForm, texts } from '../../i18n';
import { institutionKindLabel, jobKindLabel } from '../../i18n/labels';
import { methodLabel, relativeTime } from '../../lib/format';
import { takeIntent } from '../../lib/intent';
import { Sheet } from '../../ui/Sheet';
import { IconExternal, IconPlus, IconRefresh, IconSearch } from '../../ui/icons';
import { SubPage } from './Settings';

/** Kennzahlen eines Laufs, die im Lauf-Blatt mit Bezeichnung erscheinen (in dieser Reihenfolge). */
const STAT_KEYS = [
  'neu',
  'neueWebsites',
  'erkundet',
  'neuHorizont',
  'neuWeite',
  'aktualisiert',
  'abgelaufen',
  'grobfilter',
  'kiNein',
  'fristKiPruefung',
  'fristUnsicher',
  'probelaeufe',
  'dubletten',
  'keineAnzeigeRegel',
  'musterAusgelassen',
  'inPruefung',
  'browserNeu',
  'browserVervollstaendigt',
  'fehlerDetail',
  'quelle_fehler',
  'robots',
  'erinnerungen',
  'benachrichtigtNeu',
  'ki',
] as const;
type StatKey = (typeof STAT_KEYS)[number];

type Tab = 'quellen' | 'neu' | 'aussortiert' | 'laeufe';
const TABS: Tab[] = ['quellen', 'neu', 'aussortiert', 'laeufe'];
const NEW_SOURCE_KINDS: SourceKind[] = ['fachbereich', 'zentral', 'portal'];

const t = texts({
  de: {
    status: {
      neu: 'noch nicht gelaufen',
      ok: 'läuft',
      leer: 'gerade keine Stellen',
      warnung: 'Warnung',
      fehler: 'Fehler',
      blockiert: 'blockiert',
      'url-fehlt': 'Adresse fehlt',
    } as Record<SourceStatus, string>,
    stats: {
      neu: 'neu',
      neueWebsites: 'davon von neuen Websites',
      erkundet: 'über die Erkundung (Ziel: mindestens 3)',
      neuHorizont: 'neu im Horizont',
      neuWeite: 'neu in der Weite',
      aktualisiert: 'aktualisiert',
      abgelaufen: 'abgelaufen',
      grobfilter: 'vom Grobfilter aussortiert',
      kiNein: 'von der KI aussortiert (passt nicht)',
      fristKiPruefung: 'Fristen von der KI nachgeprüft',
      fristUnsicher: 'Fristen unsicher',
      probelaeufe: 'Probeläufe für neue Quellen',
      dubletten: 'Dubletten zusammengeführt',
      keineAnzeigeRegel: 'keine Stellenanzeige (nach Regeln)',
      musterAusgelassen: 'Adressen ohne Anzeigen übersprungen',
      inPruefung: 'warten auf die KI-Prüfung',
      browserNeu: 'per Browser gefunden',
      browserVervollstaendigt: 'per Browser vervollständigt',
      fehlerDetail: 'Anzeigen nicht lesbar',
      quelle_fehler: 'Quellen mit Fehler',
      robots: 'durch robots.txt gesperrt',
      erinnerungen: 'Fristen-Erinnerungen verschickt',
      benachrichtigtNeu: 'neue, sehr gut passende Anzeigen gemeldet',
      ki: 'KI-Aufrufe',
    } as Record<StatKey, string>,
    verdict: { gut: 'gut geeignet', mit_einschraenkungen: 'mit Einschränkungen', ungeeignet: 'ungeeignet' } as Record<CheckVerdict, string>,
    verdictTitle: { gut: 'Quelle gut geeignet', mit_einschraenkungen: 'Quelle mit Einschränkungen', ungeeignet: 'Quelle ungeeignet' } as Record<CheckVerdict, string>,
    checkStatus: {
      wartet: 'wartet',
      laeuft: 'läuft',
      fertig: 'fertig',
      fehler: 'Fehler',
      uebernommen: 'übernommen',
      verworfen: 'verworfen',
    } as Record<SourceCheck['status'], string>,
    tabs: { quellen: 'Quellen', neu: 'Neu', aussortiert: 'Aussortiert', laeufe: 'Läufe' } as Record<Tab, string>,
    /** Art der Quelle, ausführlich (Kopf des Quellen-Blatts) */
    kindLong: { portal: 'Portal (Sicherheitsnetz)', zentral: 'Zentrale Stellenbörse der Einrichtung', fachbereich: 'Stellenseite eines Fachbereichs' } as Record<SourceKind, string>,
    /** Art der Quelle, kurz (Zeile in der Liste) */
    kindShort: { portal: 'Portal', zentral: 'zentrale Börse', fachbereich: 'Fachbereich' } as Record<SourceKind, string>,
    /** Art der Quelle, Knopf beim Übernehmen */
    kindButton: { fachbereich: 'Fachbereich', zentral: 'Zentrale Börse', portal: 'Portal' } as Record<SourceKind, string>,
    postings: (n: number) => `${n} ${n === 1 ? 'Anzeige' : 'Anzeigen'}`,

    // Lauf-Zusammenfassung
    sumNew: (n: number) => `${n} neu`,
    sumNewSites: (n: number) => `${n} von neuen Websites`,
    sumHorizon: (n: number) => `${n} im Horizont`,
    sumUpdated: (n: number) => `${n} aktualisiert`,
    sumSkipped: (n: number) => `${n} aussortiert`,
    sumFailed: (n: number) => `${n} Quellen mit Fehler`,

    // Quellen-Blatt
    urlHttps: 'Die Adresse muss mit https:// beginnen.',
    badPattern: 'Das Linkmuster ist kein gültiger regulärer Ausdruck.',
    sourceSaved: 'Quelle gespeichert. Beim nächsten Lauf gilt die neue Einstellung.',
    source: 'Quelle',
    state: 'Zustand',
    failingRuns: (n: number) => ` seit ${n} Läufen`,
    note: 'Hinweis',
    last: 'Zuletzt',
    lastRun: (rel: string, n: number) => `${rel}, ${n} ${n === 1 ? 'Anzeige' : 'Anzeigen'}`,
    notRunYet: 'noch nicht gelaufen',
    lastOk: (rel: string) => `, zuletzt erfolgreich ${rel}`,
    foundVia: 'Gefunden über',
    research: 'Recherche',
    pageUrl: 'Adresse der Stellenseite',
    openPage: 'Seite öffnen und prüfen',
    labelOptional: 'Bezeichnung (optional)',
    labelPlaceholder: 'z. B. Institut für Psychologie',
    collectSource: 'Quelle einsammeln',
    verified: 'Adresse geprüft',
    verifiedHint: 'schützt sie vor automatischen Änderungen',
    whatToTake: 'Was übernehmen?',
    gateAria: 'Grobfilter für diese Quelle',
    allPostings: 'alle Anzeigen',
    psychOnly: 'nur mit Psychologie-Bezug',
    gateHintSource: 'Fachbereichs-Seiten nehmen alles. Zentrale Börsen laufen durch den Grobfilter, Aussortiertes steht unter „Aussortiert“.',
    advanced: 'Für Fortgeschrittene',
    render: 'Seite im Browser öffnen',
    renderHint: 'für Listen, die erst per JavaScript erscheinen',
    ignoreRobots: 'robots.txt übergehen',
    ignoreRobotsHint: 'Wirkt nur, wenn die Pipeline die robots.txt beachtet (ROBOTS=1). Standard ist: Sperren gelten nicht, Abstand und Crawl-delay schon.',
    pattern: 'Linkmuster für Anzeigen (regulärer Ausdruck)',
    patternPlaceholder: 'z. B. /stellenangebote/\\d+',
    adapter: 'Adapter',
    save: 'Speichern',
    cancel: 'Abbrechen',
    recheck: 'Probelauf wiederholen',

    // Einrichtung wählen
    institution: 'Einrichtung',
    change: 'ändern',
    searchInstitution: 'Vorhandene Einrichtung suchen',
    orCreate: 'Oder neu anlegen:',
    name: 'Name',
    city: 'Stadt',
    pleaseChoose: 'bitte wählen',
    kind: 'Art',

    // Ergebnis des Probelaufs
    aiVerdict: 'KI-Urteil: ',
    found: 'Gefunden',
    via: (methods: string) => ` über ${methods}`,
    jobList: 'Stellenliste',
    sample: 'Probe',
    readFully: (done: number, total: number) => `${done} von ${total} Anzeigen vollständig gelesen`,
    settings: 'Einstellungen',
    openInBrowser: 'im Browser öffnen',
    linkPattern: (p: string) => `Linkmuster ${p}`,
    samplePostings: 'Probe-Anzeigen',
    deadline: (date: string) => `Frist ${date}`,
    unsure: ' (unsicher)',
    noDeadline: 'ohne Frist',
    chars: (n: number) => `${n} Zeichen`,
    notSinglePosting: 'Laut KI keine einzelne Anzeige. ',

    // Probelauf
    enterFullUrl: 'Bitte die vollständige Adresse eingeben, mit https://.',
    chooseInstitution: 'Bitte eine Einrichtung wählen oder Name und Stadt angeben.',
    sourceUpdated: 'Quelle aktualisiert. Der nächste Lauf nutzt die geprüften Einstellungen.',
    sourceAccepted: 'Quelle übernommen. Sie wird beim nächsten Lauf eingesammelt.',
    addWebsite: 'Website hinzufügen',
    checkIntro:
      'Gib die Seite mit den Stellenanzeigen ein (oder einfach die Startseite). Ein Probelauf liest die Seite und ein paar Anzeigen, die KI prüft, ob alles sauber ankommt. Ins Register kommt die Quelle erst, wenn du das Ergebnis übernimmst.',
    url: 'Adresse',
    startCheck: 'Probelauf starten',
    checkWaiting: 'Probelauf wartet: ',
    checkRunning: 'Probelauf läuft: ',
    checkDemo: 'In der Demo ist das nur nachgestellt und gleich fertig.',
    checkStarted: 'Das dauert meist zwei bis vier Minuten. Du kannst das Blatt schließen; das Ergebnis steht dann unter Quellen.',
    checkQueued: 'Ohne GitHub-Token im Worker startet der Probelauf mit dem nächsten Einsammeln (täglich gegen 12 Uhr). Das Ergebnis steht dann unter Quellen.',
    checkFailed: 'Der Probelauf ist fehlgeschlagen: ',
    unknownError: 'unbekannter Fehler',
    registered: (label: string | null, url: string | null) =>
      `Diese Website steht schon im Register${label ? ` („${label}“)` : ''}${url ? `: ${url}` : ''}. Übernehmen legt trotzdem eine weitere Quelle an.`,
    takeAs: 'Übernehmen als',
    sourceKindAria: 'Art der Quelle',
    psychAndHorizon: 'Psychologie-Bezug und Horizont',
    gateHintCheck: 'Fachbereichs-Seiten nehmen alles. Breite Seiten laufen durch Grobfilter, Brücken und Weite.',
    applySettings: 'Einstellungen übernehmen',
    addAsSource: 'Als Quelle übernehmen',
    discard: 'Verwerfen',
    close: 'Schließen',

    // Neue Websites
    employerOnly: 'Arbeitgeber aus einer Jobbörse, Website noch unbekannt',
    discoveryFound: (n: number, rel: string) => `${n} ${n === 1 ? 'Anzeige' : 'Anzeigen'} gefunden, zuletzt ${rel}`,
    checkAsSource: 'Als Quelle prüfen',
    dontAdd: 'Nicht aufnehmen',
    viewPosting: 'Anzeige ansehen',

    // Grobfilter
    gateTerms: (n: number) => `Grobfilter-Begriffe (${n})`,
    gateHintA: 'Gilt nur für breite Quellen (zentrale Stellenbörsen, Portale). Eine Anzeige kommt durch, wenn ',
    gateHintB: 'einer',
    gateHintC: ' dieser Begriffe vorkommt. Im Zweifel lieber mehr Begriffe: Der Score sortiert danach ohnehin. Schreibweise wie im Suchprofil (* = überall im Wort).',
    gateSaved: 'Grobfilter gespeichert. Aussortiertes wird beim nächsten Lauf neu geprüft.',
    defaultList: 'Standardliste',

    // Seite
    collectStarted: 'Einsammeln gestartet. Das dauert etwa 15 bis 30 Minuten.',
    title: 'Quellen & Läufe',
    activeSources: (n: number) => `${n} ${n === 1 ? 'aktive Quelle' : 'aktive Quellen'}`,
    loading: 'wird geladen …',
    lastRunKicker: 'Letzter Lauf',
    endedWithError: '(mit Fehler beendet)',
    stillRunning: '(läuft noch)',
    blindSpots: (n: number, missing: number | undefined, goal: number) =>
      `Blinde Flecken: ${n} ${n === 1 ? 'Anzeige' : 'Anzeigen'} von Websites außerhalb des Registers über die Erkundung` +
      (missing ? `, ${missing} weniger als das Ziel von ${goal}. Das Protokoll unter „Läufe“ zeigt, woran es lag.` : ` (Ziel: mindestens ${goal}).`),
    demoNoCollect: 'In der Demo wird nicht eingesammelt. Die Quellenliste ist trotzdem die echte Startliste.',
    noRunYet:
      'Noch kein Lauf. Die Pipeline läuft täglich gegen 12 Uhr über GitHub Actions und bringt jedes Mal mindestens drei Anzeigen von Websites, die noch nicht im Register stehen.',
    browserQueue: (n: number) => `${n} ${n === 1 ? 'Anzeige wartet' : 'Anzeigen warten'} auf den Browser-Agenten.`,
    collectNow: 'Jetzt einsammeln',
    collectNeedsToken: '„Jetzt einsammeln“ braucht ein GitHub-Token im Worker (siehe Betriebsanleitung).',
    sectionAria: 'Bereich',
    retry: 'nochmal',
    checks: 'Probeläufe',
    requested: (rel: string) => `angefragt ${rel}`,
    viewResult: 'Ergebnis ansehen',
    problems: (n: number) => `Probleme (${n})`,
    withoutUrl: (n: number) => `ohne Adresse (${n})`,
    all: (n: number) => `alle (${n})`,
    searchSources: 'Quellen durchsuchen',
    searchPlaceholder: 'Einrichtung oder Adresse',
    missingHint: 'Für diese Einrichtungen sucht die Pipeline selbst nach der Stellenseite und legt Vorschläge an. Bis dahin decken die Portale sie ab.',
    noProblems: 'Keine Probleme.',
    noMatches: 'Keine passenden Quellen.',
    rowLast: (rel: string, n: number) => `, ${rel} ${n} ${n === 1 ? 'Anzeige' : 'Anzeigen'}`,
    off: 'aus',
    newWebsites: 'Neue Websites',
    newWebsitesHint: 'Jeder Lauf sucht gezielt nach Anzeigen von Websites und Arbeitgebern, die noch nicht im Register stehen, damit keine blinden Flecken bleiben. Was dabei auffällt, steht hier. „Als Quelle prüfen“ startet einen Probelauf mit KI.',
    nothingNew: 'Gerade nichts Neues.',
    notSuggested: 'Wird nicht mehr vorgeschlagen.',
    foundPages: 'Gefundene Stellenseiten',
    foundPagesHint: 'Für Einrichtungen ohne Adresse sucht die Pipeline selbst nach der Stellenseite. Übernommen wird erst, was du bestätigst.',
    noSuggestions: 'Gerade keine Vorschläge.',
    accepted: 'Übernommen.',
    accept: 'Übernehmen',
    skippedHint:
      'Diese Anzeigen stammen aus breiten Quellen: ohne Begriff aus dem Grobfilter und ohne passende Brücke, oder die KI hat sie als fremd eingeschätzt. Ist etwas Passendes dabei, den fehlenden Begriff im Grobfilter oder eine Brücke im Horizont ergänzen: Beim nächsten Lauf wird neu geprüft.',
    demoNoSkips: 'In der Demo wird nichts aussortiert.',
    noSkips: 'Nichts aussortiert.',
    aiNo: ', KI: passt nicht',
    notPosting: ', keine Stellenanzeige',
    notPostingRule: ', keine Stellenanzeige (Regeln)',
    demoNoRuns: 'In der Demo gibt es keine Läufe.',
    noRuns: 'Noch keine Läufe.',
    logUnavailable: 'Protokoll nicht verfügbar.',
    runOf: (date: string) => `Lauf vom ${date}`,
    log: 'Protokoll',
  },
  en: {
    status: {
      neu: 'not run yet',
      ok: 'working',
      leer: 'no jobs right now',
      warnung: 'warning',
      fehler: 'error',
      blockiert: 'blocked',
      'url-fehlt': 'URL missing',
    },
    stats: {
      neu: 'new',
      neueWebsites: 'of which from new websites',
      erkundet: 'via exploration (goal: at least 3)',
      neuHorizont: 'new in Horizon',
      neuWeite: 'new in Beyond',
      aktualisiert: 'updated',
      abgelaufen: 'expired',
      grobfilter: 'filtered out by the pre-filter',
      kiNein: 'filtered out by the AI (not a match)',
      fristKiPruefung: 'deadlines double-checked by the AI',
      fristUnsicher: 'deadlines uncertain',
      probelaeufe: 'test runs for new sources',
      dubletten: 'duplicates merged',
      keineAnzeigeRegel: 'not a job posting (rules)',
      musterAusgelassen: 'URLs without postings skipped',
      inPruefung: 'waiting for the AI check',
      browserNeu: 'found via browser',
      browserVervollstaendigt: 'completed via browser',
      fehlerDetail: 'postings not readable',
      quelle_fehler: 'sources with errors',
      robots: 'blocked by robots.txt',
      erinnerungen: 'deadline reminders sent',
      benachrichtigtNeu: 'new, very strong matches notified',
      ki: 'AI calls',
    },
    verdict: { gut: 'well suited', mit_einschraenkungen: 'with limitations', ungeeignet: 'unsuitable' },
    verdictTitle: { gut: 'Well suited as a source', mit_einschraenkungen: 'Usable as a source, with limitations', ungeeignet: 'Not suitable as a source' },
    checkStatus: {
      wartet: 'waiting',
      laeuft: 'running',
      fertig: 'done',
      fehler: 'error',
      uebernommen: 'added',
      verworfen: 'discarded',
    },
    tabs: { quellen: 'Sources', neu: 'New', aussortiert: 'Filtered out', laeufe: 'Runs' },
    kindLong: { portal: 'Portal (safety net)', zentral: 'Central job board of the institution', fachbereich: 'Jobs page of a department' },
    kindShort: { portal: 'portal', zentral: 'central job board', fachbereich: 'department' },
    kindButton: { fachbereich: 'Department', zentral: 'Central job board', portal: 'Portal' },
    postings: (n) => `${n} ${n === 1 ? 'posting' : 'postings'}`,

    sumNew: (n) => `${n} new`,
    sumNewSites: (n) => `${n} from new websites`,
    sumHorizon: (n) => `${n} in Horizon`,
    sumUpdated: (n) => `${n} updated`,
    sumSkipped: (n) => `${n} filtered out`,
    sumFailed: (n) => `${n} ${n === 1 ? 'source' : 'sources'} with errors`,

    urlHttps: 'The URL must start with https://.',
    badPattern: "The link pattern isn't a valid regular expression.",
    sourceSaved: 'Source saved. The new setting applies from the next run.',
    source: 'Source',
    state: 'Status',
    failingRuns: (n) => ` for ${n} runs in a row`,
    note: 'Note',
    last: 'Last run',
    lastRun: (rel, n) => `${rel}, ${n} ${n === 1 ? 'posting' : 'postings'}`,
    notRunYet: "hasn't run yet",
    lastOk: (rel) => `, last successful run ${rel}`,
    foundVia: 'Found via',
    research: 'Research notes',
    pageUrl: 'Jobs page URL',
    openPage: 'Open and check the page',
    labelOptional: 'Label (optional)',
    labelPlaceholder: 'e.g. Institut für Psychologie',
    collectSource: 'Collect from this source',
    verified: 'URL verified',
    verifiedHint: 'protects it from automatic changes',
    whatToTake: 'What to include?',
    gateAria: 'Pre-filter for this source',
    allPostings: 'all postings',
    psychOnly: 'only psychology-related',
    gateHintSource: 'Department pages take everything. Central job boards go through the pre-filter; anything it removes shows up under “Filtered out.”',
    advanced: 'Advanced',
    render: 'Open the page in a browser',
    renderHint: 'for lists that only appear via JavaScript',
    ignoreRobots: 'Ignore robots.txt',
    ignoreRobotsHint: "Only has an effect if the pipeline respects robots.txt (ROBOTS=1). By default, its blocks don't apply, but request spacing and crawl-delay do.",
    pattern: 'Link pattern for postings (regular expression)',
    patternPlaceholder: 'e.g. /stellenangebote/\\d+',
    adapter: 'Adapter',
    save: 'Save',
    cancel: 'Cancel',
    recheck: 'Run test again',

    institution: 'Institution',
    change: 'change',
    searchInstitution: 'Search existing institutions',
    orCreate: 'Or add a new one:',
    name: 'Name',
    city: 'City',
    pleaseChoose: 'please choose',
    kind: 'Type',

    aiVerdict: 'AI verdict: ',
    found: 'Found',
    via: (methods) => ` via ${methods}`,
    jobList: 'Job list',
    sample: 'Sample',
    readFully: (done, total) => `${done} of ${total} ${total === 1 ? 'posting' : 'postings'} read in full`,
    settings: 'Settings',
    openInBrowser: 'open in browser',
    linkPattern: (p) => `link pattern ${p}`,
    samplePostings: 'Sample postings',
    deadline: (date) => `deadline ${date}`,
    unsure: ' (uncertain)',
    noDeadline: 'no deadline',
    chars: (n) => `${n} ${n === 1 ? 'character' : 'characters'}`,
    notSinglePosting: "According to the AI, this isn't a single posting. ",

    enterFullUrl: 'Please enter the full URL, including https://.',
    chooseInstitution: 'Please choose an institution or enter a name and city.',
    sourceUpdated: 'Source updated. The next run will use the tested settings.',
    sourceAccepted: "Source added. It'll be collected on the next run.",
    addWebsite: 'Add website',
    checkIntro:
      "Enter the page with the job postings (or just the homepage). A test run reads the page and a few postings, and the AI checks that everything comes through cleanly. The source only joins the registry once you accept the result.",
    url: 'URL',
    startCheck: 'Start test run',
    checkWaiting: 'Test run waiting: ',
    checkRunning: 'Test run in progress: ',
    checkDemo: "In the demo this is only simulated and done in a moment.",
    checkStarted: 'This usually takes two to four minutes. You can close this sheet; the result will then show up under Sources.',
    checkQueued: 'Without a GitHub token in the Worker, the test run starts with the next collection (daily around noon). The result will then show up under Sources.',
    checkFailed: 'The test run failed: ',
    unknownError: 'unknown error',
    registered: (label, url) => `This website is already in the registry${label ? ` (“${label}”)` : ''}${url ? `: ${url}` : ''}. Adding it will still create another source.`,
    takeAs: 'Add as',
    sourceKindAria: 'Source type',
    psychAndHorizon: 'psychology-related and Horizon',
    gateHintCheck: 'Department pages take everything. Broad sites go through the pre-filter, bridges and Beyond.',
    applySettings: 'Apply settings',
    addAsSource: 'Add as source',
    discard: 'Discard',
    close: 'Close',

    employerOnly: 'Employer from a job board, website not known yet',
    discoveryFound: (n, rel) => `${n} ${n === 1 ? 'posting' : 'postings'} found, latest ${rel}`,
    checkAsSource: 'Check as source',
    dontAdd: "Don't add",
    viewPosting: 'View posting',

    gateTerms: (n) => `Pre-filter terms (${n})`,
    gateHintA: 'Only applies to broad sources (central job boards, portals). A posting gets through if it contains ',
    gateHintB: 'at least one',
    gateHintC: ' of these terms. When in doubt, add more terms: the match score does the sorting afterward anyway. Same notation as in the search profile (* = anywhere in a word).',
    gateSaved: 'Pre-filter saved. Filtered-out postings will be checked again on the next run.',
    defaultList: 'Default list',

    collectStarted: 'Collecting started. This takes about 15 to 30 minutes.',
    title: 'Sources & runs',
    activeSources: (n) => `${n} active ${n === 1 ? 'source' : 'sources'}`,
    loading: 'Loading…',
    lastRunKicker: 'Last run',
    endedWithError: '(ended with errors)',
    stillRunning: '(still running)',
    blindSpots: (n, missing, goal) =>
      `Blind spots: ${n} ${n === 1 ? 'posting' : 'postings'} from websites outside the registry, via exploration` +
      (missing ? `, ${missing} short of the goal of ${goal}. The log under “Runs” shows why.` : ` (goal: at least ${goal}).`),
    demoNoCollect: 'Nothing is collected in the demo. The source list is still the real starting list, though.',
    noRunYet:
      "No runs yet. The pipeline runs daily around noon via GitHub Actions and each time brings in at least three postings from websites that aren't in the registry yet.",
    browserQueue: (n) => `${n} ${n === 1 ? 'posting is' : 'postings are'} waiting for the browser agent.`,
    collectNow: 'Collect now',
    collectNeedsToken: '“Collect now” needs a GitHub token in the Worker (see the operations guide).',
    sectionAria: 'Section',
    retry: 'try again',
    checks: 'Test runs',
    requested: (rel) => `requested ${rel}`,
    viewResult: 'View result',
    problems: (n) => `Problems (${n})`,
    withoutUrl: (n) => `no URL (${n})`,
    all: (n) => `all (${n})`,
    searchSources: 'Search sources',
    searchPlaceholder: 'Institution or URL',
    missingHint: 'For these institutions, the pipeline looks for the jobs page on its own and makes suggestions. Until then, the portals cover them.',
    noProblems: 'No problems.',
    noMatches: 'No matching sources.',
    rowLast: (rel, n) => `, ${n} ${n === 1 ? 'posting' : 'postings'} ${rel}`,
    off: 'off',
    newWebsites: 'New websites',
    newWebsitesHint:
      "Every run specifically looks for postings from websites and employers that aren't in the registry yet, so no blind spots remain. Whatever turns up is listed here. “Check as source” starts a test run with AI.",
    nothingNew: 'Nothing new right now.',
    notSuggested: "Won't be suggested again.",
    foundPages: 'Jobs pages found',
    foundPagesHint: 'For institutions without a URL, the pipeline looks for the jobs page on its own. Nothing is added until you confirm it.',
    noSuggestions: 'No suggestions right now.',
    accepted: 'Accepted.',
    accept: 'Accept',
    skippedHint:
      'These postings come from broad sources: they had no pre-filter term and no matching bridge, or the AI judged them off-topic. If something relevant is among them, add the missing term to the pre-filter or a bridge in Horizon: the next run checks again.',
    demoNoSkips: 'Nothing is filtered out in the demo.',
    noSkips: 'Nothing filtered out.',
    aiNo: ', AI: not a match',
    notPosting: ', not a job posting',
    notPostingRule: ', not a job posting (rules)',
    demoNoRuns: 'There are no runs in the demo.',
    noRuns: 'No runs yet.',
    logUnavailable: 'Log not available.',
    runOf: (date) => `Run on ${date}`,
    log: 'Log',
  },
  sr: {
    status: {
      neu: 'još nije pokrenut',
      ok: 'radi',
      leer: 'trenutno nema oglasa',
      warnung: 'upozorenje',
      fehler: 'greška',
      blockiert: 'blokirano',
      'url-fehlt': 'nedostaje adresa',
    },
    stats: {
      neu: 'novi',
      neueWebsites: 'od toga sa novih sajtova',
      erkundet: 'preko izviđanja (cilj: najmanje 3)',
      neuHorizont: 'novi u Horizontu',
      neuWeite: 'novi u Daljini',
      aktualisiert: 'ažurirani',
      abgelaufen: 'istekli',
      grobfilter: 'odbačeni grubim filterom',
      kiNein: 'odbačeni posle AI provere (ne odgovaraju)',
      fristKiPruefung: 'rokovi dodatno provereni pomoću AI',
      fristUnsicher: 'nesigurni rokovi',
      probelaeufe: 'probni prolazi za nove izvore',
      dubletten: 'spojeni duplikati',
      keineAnzeigeRegel: 'nije oglas za posao (pravila)',
      musterAusgelassen: 'preskočene adrese bez oglasa',
      inPruefung: 'čeka AI proveru',
      browserNeu: 'pronađeni pomoću pregledača',
      browserVervollstaendigt: 'dopunjeni pomoću pregledača',
      fehlerDetail: 'nečitljivi oglasi',
      quelle_fehler: 'izvori sa greškom',
      robots: 'blokirani zbog robots.txt',
      erinnerungen: 'poslati podsetnici za rokove',
      benachrichtigtNeu: 'javljeni novi oglasi sa odličnim poklapanjem',
      ki: 'AI pozivi',
    },
    verdict: { gut: 'pogodan', mit_einschraenkungen: 'pogodan uz ograničenja', ungeeignet: 'nepogodan' },
    verdictTitle: { gut: 'Pogodan izvor', mit_einschraenkungen: 'Izvor pogodan uz ograničenja', ungeeignet: 'Nepogodan izvor' },
    checkStatus: {
      wartet: 'čeka',
      laeuft: 'u toku',
      fertig: 'gotovo',
      fehler: 'greška',
      uebernommen: 'dodato',
      verworfen: 'odbačeno',
    },
    tabs: { quellen: 'Izvori', neu: 'Novo', aussortiert: 'Odbačeno', laeufe: 'Prolazi' },
    kindLong: { portal: 'Portal (sigurnosna mreža)', zentral: 'Centralna berza poslova ustanove', fachbereich: 'Stranica sa oglasima jednog odseka' },
    kindShort: { portal: 'portal', zentral: 'centralna berza', fachbereich: 'odsek' },
    kindButton: { fachbereich: 'Odsek', zentral: 'Centralna berza', portal: 'Portal' },
    postings: (n) => `${n} ${srForm(n, 'oglas', 'oglasa', 'oglasa')}`,

    sumNew: (n) => `${n} ${srForm(n, 'novi', 'nova', 'novih')}`,
    sumNewSites: (n) => `${n} sa novih sajtova`,
    sumHorizon: (n) => `${n} u Horizontu`,
    sumUpdated: (n) => `${n} ${srForm(n, 'ažuriran', 'ažurirana', 'ažuriranih')}`,
    sumSkipped: (n) => `${n} ${srForm(n, 'odbačen', 'odbačena', 'odbačenih')}`,
    sumFailed: (n) => `${n} ${srForm(n, 'izvor', 'izvora', 'izvora')} sa greškom`,

    urlHttps: 'Adresa mora da počinje sa https://.',
    badPattern: 'Obrazac linkova nije ispravan regularni izraz.',
    sourceSaved: 'Izvor je sačuvan. Novo podešavanje važi od sledećeg prolaza.',
    source: 'Izvor',
    state: 'Stanje',
    failingRuns: (n) => ` ${n}. prolaz zaredom`,
    note: 'Napomena',
    last: 'Poslednji put',
    lastRun: (rel, n) => `${rel}, ${n} ${srForm(n, 'oglas', 'oglasa', 'oglasa')}`,
    notRunYet: 'još nije pokrenut',
    lastOk: (rel) => `, poslednji uspešan prolaz ${rel}`,
    foundVia: 'Pronađeno preko',
    research: 'Beleške iz istraživanja',
    pageUrl: 'Adresa stranice sa oglasima',
    openPage: 'Otvori stranicu i proveri',
    labelOptional: 'Naziv (opciono)',
    labelPlaceholder: 'npr. Institut für Psychologie',
    collectSource: 'Prikupljaj iz ovog izvora',
    verified: 'Adresa proverena',
    verifiedHint: 'štiti je od automatskih izmena',
    whatToTake: 'Šta uključiti?',
    gateAria: 'Grubi filter za ovaj izvor',
    allPostings: 'sve oglase',
    psychOnly: 'samo vezane za psihologiju',
    gateHintSource: 'Stranice odseka preuzimaju sve. Centralne berze poslova prolaze kroz grubi filter, a ono što on odbaci nalazi se pod „Odbačeno“.',
    advanced: 'Napredno',
    render: 'Otvori stranicu u pregledaču',
    renderHint: 'za liste koje se pojavljuju tek preko JavaScripta',
    ignoreRobots: 'Zanemari robots.txt',
    ignoreRobotsHint:
      'Deluje samo ako sistem za prikupljanje poštuje robots.txt (ROBOTS=1). Podrazumevano zabrane iz njega ne važe, ali razmak između zahteva i crawl-delay važe.',
    pattern: 'Obrazac linkova do oglasa (regularni izraz)',
    patternPlaceholder: 'npr. /stellenangebote/\\d+',
    adapter: 'Adapter',
    save: 'Sačuvaj',
    cancel: 'Otkaži',
    recheck: 'Ponovi probni prolaz',

    institution: 'Ustanova',
    change: 'promeni',
    searchInstitution: 'Pretraži postojeće ustanove',
    orCreate: 'Ili dodaj novu:',
    name: 'Naziv',
    city: 'Grad',
    pleaseChoose: 'izaberi',
    kind: 'Vrsta',

    aiVerdict: 'Ocena AI: ',
    found: 'Pronađeno',
    via: (methods) => ` preko: ${methods}`,
    jobList: 'Lista oglasa',
    sample: 'Uzorak',
    readFully: (done, total) => `pročitano u celosti: ${done} od ${total} oglasa`,
    settings: 'Podešavanja',
    openInBrowser: 'otvaranje u pregledaču',
    linkPattern: (p) => `obrazac linkova ${p}`,
    samplePostings: 'Oglasi iz uzorka',
    deadline: (date) => `rok ${date}`,
    unsure: ' (nesiguran)',
    noDeadline: 'bez roka',
    chars: (n) => `${n} ${srForm(n, 'znak', 'znaka', 'znakova')}`,
    notSinglePosting: 'Prema AI, ovo nije pojedinačan oglas. ',

    enterFullUrl: 'Unesi celu adresu, sa https://.',
    chooseInstitution: 'Izaberi ustanovu ili unesi naziv i grad.',
    sourceUpdated: 'Izvor je ažuriran. Sledeći prolaz koristi proverena podešavanja.',
    sourceAccepted: 'Izvor je dodat. Prikupljaće se od sledećeg prolaza.',
    addWebsite: 'Dodaj sajt',
    checkIntro:
      'Unesi stranicu sa oglasima za posao (ili samo početnu stranicu). Probni prolaz čita stranicu i nekoliko oglasa, a AI proverava da li sve stiže kako treba. Izvor ulazi u registar tek kada prihvatiš rezultat.',
    url: 'Adresa',
    startCheck: 'Pokreni probni prolaz',
    checkWaiting: 'Probni prolaz čeka: ',
    checkRunning: 'Probni prolaz je u toku: ',
    checkDemo: 'U demo verziji ovo je samo simulacija i odmah je gotovo.',
    checkStarted: 'To obično traje dva do četiri minuta. Možeš da zatvoriš ovaj prozor; rezultat će zatim biti pod „Izvori“.',
    checkQueued: 'Bez GitHub tokena u Workeru probni prolaz počinje sa sledećim prikupljanjem (svakog dana oko podne). Rezultat će zatim biti pod „Izvori“.',
    checkFailed: 'Probni prolaz nije uspeo: ',
    unknownError: 'nepoznata greška',
    registered: (label, url) => `Ovaj sajt je već u registru${label ? ` („${label}“)` : ''}${url ? `: ${url}` : ''}. Dodavanjem se ipak pravi još jedan izvor.`,
    takeAs: 'Dodaj kao',
    sourceKindAria: 'Vrsta izvora',
    psychAndHorizon: 'vezane za psihologiju i Horizont',
    gateHintCheck: 'Stranice odseka preuzimaju sve. Široki sajtovi prolaze kroz grubi filter, mostove i Daljinu.',
    applySettings: 'Primeni podešavanja',
    addAsSource: 'Dodaj kao izvor',
    discard: 'Odbaci',
    close: 'Zatvori',

    employerOnly: 'Poslodavac sa berze poslova, sajt još nepoznat',
    discoveryFound: (n, rel) => `${n} ${srForm(n, 'oglas', 'oglasa', 'oglasa')}, poslednji ${rel}`,
    checkAsSource: 'Proveri kao izvor',
    dontAdd: 'Ne dodaj',
    viewPosting: 'Pogledaj oglas',

    gateTerms: (n) => `Pojmovi grubog filtera (${n})`,
    gateHintA: 'Važi samo za široke izvore (centralne berze poslova, portale). Oglas prolazi ako sadrži ',
    gateHintB: 'bar jedan',
    gateHintC: ' od ovih pojmova. U nedoumici je bolje više pojmova: redosled ionako posle određuje poklapanje. Zapis je isti kao u profilu pretrage (* = bilo gde u reči).',
    gateSaved: 'Grubi filter je sačuvan. Odbačeni oglasi biće ponovo provereni u sledećem prolazu.',
    defaultList: 'Podrazumevana lista',

    collectStarted: 'Prikupljanje je pokrenuto. Traje oko 15 do 30 minuta.',
    title: 'Izvori i prolazi',
    activeSources: (n) => `${n} ${srForm(n, 'aktivan izvor', 'aktivna izvora', 'aktivnih izvora')}`,
    loading: 'Učitavam…',
    lastRunKicker: 'Poslednji prolaz',
    endedWithError: '(završen sa greškom)',
    stillRunning: '(još traje)',
    blindSpots: (n, missing, goal) =>
      `Slepe mrlje: ${n} ${srForm(n, 'oglas', 'oglasa', 'oglasa')} sa sajtova van registra, preko izviđanja` +
      (missing ? `, ${missing} manje od cilja (${goal}). Zapisnik pod „Prolazi“ pokazuje zašto.` : ` (cilj: najmanje ${goal}).`),
    demoNoCollect: 'U demo verziji se ništa ne prikuplja. Lista izvora je ipak prava početna lista.',
    noRunYet:
      'Još nema prolaza. Prikupljanje se pokreće svakog dana oko podne preko GitHub Actions i svaki put donosi najmanje tri oglasa sa sajtova koji još nisu u registru.',
    browserQueue: (n) => `${n} ${srForm(n, 'oglas čeka', 'oglasa čekaju', 'oglasa čeka')} na agenta u pregledaču.`,
    collectNow: 'Prikupi sada',
    collectNeedsToken: 'Za „Prikupi sada“ potreban je GitHub token u Workeru (vidi uputstvo za rad).',
    sectionAria: 'Odeljak',
    retry: 'pokušaj ponovo',
    checks: 'Probni prolazi',
    requested: (rel) => `zatraženo ${rel}`,
    viewResult: 'Pogledaj rezultat',
    problems: (n) => `Problemi (${n})`,
    withoutUrl: (n) => `bez adrese (${n})`,
    all: (n) => `svi (${n})`,
    searchSources: 'Pretraži izvore',
    searchPlaceholder: 'Ustanova ili adresa',
    missingHint: 'Za ove ustanove sistem za prikupljanje sam traži stranicu sa oglasima i pravi predloge. Do tada ih pokrivaju portali.',
    noProblems: 'Nema problema.',
    noMatches: 'Nema odgovarajućih izvora.',
    rowLast: (rel, n) => `, ${n} ${srForm(n, 'oglas', 'oglasa', 'oglasa')} ${rel}`,
    off: 'isključeno',
    newWebsites: 'Novi sajtovi',
    newWebsitesHint:
      'Svaki prolaz ciljano traži oglase sa sajtova i od poslodavaca koji još nisu u registru, da ne bi ostale slepe mrlje. Ono što se pri tome pronađe stoji ovde. „Proveri kao izvor“ pokreće probni prolaz sa AI.',
    nothingNew: 'Trenutno ništa novo.',
    notSuggested: 'Više se neće predlagati.',
    foundPages: 'Pronađene stranice sa oglasima',
    foundPagesHint: 'Za ustanove bez adrese sistem za prikupljanje sam traži stranicu sa oglasima. Dodaje se samo ono što potvrdiš.',
    noSuggestions: 'Trenutno nema predloga.',
    accepted: 'Prihvaćeno.',
    accept: 'Prihvati',
    skippedHint:
      'Ovi oglasi potiču iz širokih izvora: nemaju nijedan pojam iz grubog filtera ni odgovarajući most, ili ih AI smatra nevezanim. Ako je među njima nešto odgovarajuće, dodaj pojam koji nedostaje u grubi filter ili most u Horizontu: sledeći prolaz ponovo proverava.',
    demoNoSkips: 'U demo verziji se ništa ne odbacuje.',
    noSkips: 'Ništa nije odbačeno.',
    aiNo: ', AI: ne odgovara',
    notPosting: ', nije oglas za posao',
    notPostingRule: ', nije oglas za posao (pravila)',
    demoNoRuns: 'U demo verziji nema prolaza.',
    noRuns: 'Još nema prolaza.',
    logUnavailable: 'Zapisnik nije dostupan.',
    runOf: (date) => `Prolaz od ${date}`,
    log: 'Zapisnik',
  },
});

/** Datum und Uhrzeit eines Laufs in der Sprache der App. */
function runTime(iso: string, dateStyle: 'short' | 'medium'): string {
  return new Date(iso).toLocaleString(LANG_TAGS[lang()], { dateStyle, timeStyle: 'short' });
}

type SourceFilter = 'probleme' | 'ohne' | 'alle';

function isProblem(src: Source): boolean {
  return src.enabled && (src.status === 'fehler' || src.status === 'blockiert' || src.status === 'warnung');
}

function runSummary(r: RunInfo): string {
  const st = r.stats ?? {};
  const parts = [t.sumNew(st.neu ?? 0)];
  if (st.neueWebsites) parts.push(t.sumNewSites(st.neueWebsites));
  if (st.neuHorizont || st.neuWeite) parts.push(t.sumHorizon((st.neuHorizont ?? 0) + (st.neuWeite ?? 0)));
  parts.push(t.sumUpdated(st.aktualisiert ?? 0));
  if (st.grobfilter || st.kiNein) parts.push(t.sumSkipped((st.grobfilter ?? 0) + (st.kiNein ?? 0)));
  if (st.quelle_fehler) parts.push(t.sumFailed(st.quelle_fehler));
  return parts.join(', ');
}

function SourceSheet({ src, inst, onClose, onSaved, onRecheck }: { src: Source; inst?: Institution; onClose: () => void; onSaved: () => void; onRecheck: () => void }) {
  const store = useStore();
  const [url, setUrl] = useState(src.url ?? '');
  const [label, setLabel] = useState(src.label ?? '');
  const [enabled, setEnabled] = useState(src.enabled);
  const [gate, setGate] = useState<Gate>(src.gate);
  const [verified, setVerified] = useState(src.verified);
  const [render, setRender] = useState(!!src.config.render);
  const [ignoreRobots, setIgnoreRobots] = useState(!!src.config.ignoreRobots);
  const [pattern, setPattern] = useState(src.config.linkPattern ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    if (url && !/^https?:\/\//i.test(url.trim())) return setMsg(t.urlHttps);
    if (pattern) {
      try {
        new RegExp(pattern);
      } catch {
        return setMsg(t.badPattern);
      }
    }
    setBusy(true);
    setMsg(null);
    try {
      const config = { ...src.config, render: render || undefined, ignoreRobots: ignoreRobots || undefined, linkPattern: pattern.trim() || undefined };
      await store.api.patchSource(src.id, { url: url.trim() || null, label: label.trim() || null, enabled, gate, verified, config });
      store.toast(t.sourceSaved);
      onSaved();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={inst?.shortName ?? inst?.name ?? src.label ?? t.source} onClose={onClose} full>
      <p className="hint" style={{ marginTop: 0 }}>
        {t.kindLong[src.kind] ?? t.kindLong.fachbereich}
        {inst ? `, ${institutionKindLabel(inst.kind)}` : ''}
      </p>
      <ul className="facts">
        <li>
          <span className="facts__k">{t.state}</span>
          <span className="facts__v">
            <span className={`status status--${src.status}`}>{t.status[src.status]}</span>
            {src.consecutiveFailures > 1 ? t.failingRuns(src.consecutiveFailures) : ''}
          </span>
        </li>
        {src.statusNote && (
          <li>
            <span className="facts__k">{t.note}</span>
            <span className="facts__v">{src.statusNote}</span>
          </li>
        )}
        <li>
          <span className="facts__k">{t.last}</span>
          <span className="facts__v">
            {src.lastRunAt ? t.lastRun(relativeTime(src.lastRunAt), src.lastCount ?? 0) : t.notRunYet}
            {src.lastOkAt && src.lastOkAt !== src.lastRunAt ? t.lastOk(relativeTime(src.lastOkAt)) : ''}
          </span>
        </li>
        {src.methodsUsed && src.methodsUsed.length > 0 && (
          <li>
            <span className="facts__k">{t.foundVia}</span>
            <span className="facts__v">{src.methodsUsed.map(methodLabel).join(', ')}</span>
          </li>
        )}
        {typeof src.config.note === 'string' && (
          <li>
            <span className="facts__k">{t.research}</span>
            <span className="facts__v">{src.config.note}</span>
          </li>
        )}
      </ul>

      <label className="field">
        <span>{t.pageUrl}</span>
        <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </label>
      {url && /^https?:\/\//.test(url) && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="hint" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <IconExternal width={14} height={14} /> {t.openPage}
        </a>
      )}
      <label className="field">
        <span>{t.labelOptional}</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t.labelPlaceholder} />
      </label>
      <label className="toggle">
        <span>{t.collectSource}</span>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </label>
      <label className="toggle">
        <span>
          {t.verified}
          <br />
          <small className="hint">{t.verifiedHint}</small>
        </span>
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
      </label>
      <div className="field">
        <span>{t.whatToTake}</span>
        <div className="segmented" role="group" aria-label={t.gateAria}>
          <button type="button" aria-pressed={gate === 'none'} onClick={() => setGate('none')}>
            {t.allPostings}
          </button>
          <button type="button" aria-pressed={gate === 'psych'} onClick={() => setGate('psych')}>
            {t.psychOnly}
          </button>
        </div>
        <small className="hint">{t.gateHintSource}</small>
      </div>

      <details className="help">
        <summary>{t.advanced}</summary>
        <label className="toggle">
          <span>
            {t.render}
            <br />
            <small className="hint">{t.renderHint}</small>
          </span>
          <input type="checkbox" checked={render} onChange={(e) => setRender(e.target.checked)} />
        </label>
        <label className="toggle">
          <span>
            {t.ignoreRobots}
            <br />
            <small className="hint">{t.ignoreRobotsHint}</small>
          </span>
          <input type="checkbox" checked={ignoreRobots} onChange={(e) => setIgnoreRobots(e.target.checked)} />
        </label>
        <label className="field">
          <span>{t.pattern}</span>
          <input className="input" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder={t.patternPlaceholder} spellCheck={false} />
        </label>
        <p className="hint">
          {t.adapter}: {src.config.ats ?? src.adapter}
        </p>
      </details>

      {msg && (
        <p className="notice notice--warn" role="alert">
          {msg}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void save()}>
          {t.save}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {t.cancel}
        </button>
        {src.url && (
          <button type="button" className="btn btn--quiet" onClick={onRecheck}>
            {t.recheck}
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Einrichtung wählen oder neu anlegen (vorausgefüllt aus dem Probelauf). */
function InstitutionPicker({
  chosenId,
  setChosenId,
  draft,
  setDraft,
}: {
  chosenId: string | null;
  setChosenId: (id: string | null) => void;
  draft: { name: string; cityId: string; kind: InstitutionKind; website: string };
  setDraft: (d: { name: string; cityId: string; kind: InstitutionKind; website: string }) => void;
}) {
  const s = useAppState();
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return [];
    return [...s.institutions.values()].filter((i) => normalizeText(`${i.name} ${i.shortName ?? ''}`).includes(n)).slice(0, 8);
  }, [q, s.institutions]);
  const cities = useMemo(() => [...s.cities.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')), [s.cities]);
  const chosen = chosenId ? s.institutions.get(chosenId) : undefined;
  if (chosen) {
    return (
      <div className="field">
        <span>{t.institution}</span>
        <p style={{ margin: 0 }}>
          <b>{chosen.name}</b>{' '}
          <button type="button" className="btn btn--quiet btn--small" onClick={() => setChosenId(null)}>
            {t.change}
          </button>
        </p>
      </div>
    );
  }
  return (
    <div className="field">
      <span>{t.institution}</span>
      <label className="search" style={{ display: 'block' }}>
        <span className="visually-hidden">{t.searchInstitution}</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchInstitution} />
      </label>
      {hits.length > 0 && (
        <ul className="list">
          {hits.map((i) => (
            <li key={i.id} className="pick">
              <button type="button" className="pick__btn" onClick={() => setChosenId(i.id)}>
                <span>
                  {i.name} <small>{s.cities.get(i.cityId ?? '')?.name}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint" style={{ margin: '8px 0 4px' }}>
        {t.orCreate}
      </p>
      <label className="field">
        <span>{t.name}</span>
        <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <label className="field">
        <span>{t.city}</span>
        <select className="select" value={draft.cityId} onChange={(e) => setDraft({ ...draft, cityId: e.target.value })}>
          <option value="">{t.pleaseChoose}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t.kind}</span>
        <select className="select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as InstitutionKind })}>
          {INSTITUTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {institutionKindLabel(k)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function CheckResultView({ r }: { r: CheckResult }) {
  const complete = r.samples.filter((x) => x.complete).length;
  return (
    <div className="check">
      <p className={`verdict verdict--${r.verdict}`}>{t.verdictTitle[r.verdict]}</p>
      {r.ai && (
        <div className="ai-note">
          <b>
            {t.aiVerdict}
            {t.verdict[r.ai.verdict]}
          </b>
          {r.ai.summary}
        </div>
      )}
      <ul className="facts" style={{ marginTop: 12 }}>
        <li>
          <span className="facts__k">{t.found}</span>
          <span className="facts__v">
            {t.postings(r.candidates)}
            {r.methods.length ? t.via(r.methods.map(methodLabel).join(', ')) : ''}
          </span>
        </li>
        {r.listUrl !== r.url && (
          <li>
            <span className="facts__k">{t.jobList}</span>
            <a className="facts__v" href={r.listUrl} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>
              {r.listUrl.replace(/^https?:\/\//, '')}
            </a>
          </li>
        )}
        <li>
          <span className="facts__k">{t.sample}</span>
          <span className="facts__v">{t.readFully(complete, r.samples.length)}</span>
        </li>
        {(r.config.render || r.config.linkPattern) && (
          <li>
            <span className="facts__k">{t.settings}</span>
            <span className="facts__v">{[r.config.render ? t.openInBrowser : null, r.config.linkPattern ? t.linkPattern(r.config.linkPattern) : null].filter(Boolean).join(', ')}</span>
          </li>
        )}
      </ul>
      {r.notes.length > 0 && (
        <ul className="check__notes">
          {r.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {r.samples.length > 0 && <h3 className="section-title">{t.samplePostings}</h3>}
      <ul className="check__samples">
        {r.samples.map((x) => (
          <li key={x.url} className="check-sample">
            <a href={x.url} target="_blank" rel="noopener noreferrer" className="check-sample__title">
              {x.title}
            </a>
            <p className="check-sample__facts">
              {[
                x.kind && x.kind !== 'sonstige' ? jobKindLabel(x.kind) : null,
                x.deadline ? `${t.deadline(fmtDate(x.deadline))}${x.deadlineCheck === 'unsicher' ? t.unsure : ''}` : t.noDeadline,
                x.payGrade,
                x.workload,
                t.chars(x.chars),
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
            {x.excerpt && <p className="check-sample__excerpt print">{x.excerpt}</p>}
            {(!x.complete || x.aiOk === false || x.problems.length > 0) && (
              <p className="check-sample__problems">
                {x.aiOk === false ? t.notSinglePosting : ''}
                {x.problems.join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Website hinzufügen mit Probelauf: Adresse eingeben → die Pipeline liest die Seite und ein paar Anzeigen,
 * die KI beurteilt das Ergebnis → erst nach deiner Bestätigung kommt die Quelle ins Register.
 */
function CheckSheet({ initialUrl, sourceId, check: initialCheck, onClose, onChanged }: { initialUrl?: string; sourceId?: string; check?: SourceCheck; onClose: () => void; onChanged: () => void }) {
  const s = useAppState();
  const store = useStore();
  const [url, setUrl] = useState(initialCheck?.url ?? initialUrl ?? '');
  const [check, setCheck] = useState<SourceCheck | null>(initialCheck ?? null);
  const [started, setStarted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [instId, setInstId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', cityId: '', kind: 'sonstige' as InstitutionKind, website: '' });
  const [kind, setKind] = useState<SourceKind>('zentral');
  const [gate, setGate] = useState<Gate>('psych');
  const [label, setLabel] = useState('');
  const prefilled = useRef<number | null>(null);

  // Ergebnis abholen, solange der Probelauf läuft
  useEffect(() => {
    if (!check || !(check.status === 'wartet' || check.status === 'laeuft')) return;
    const timer = window.setInterval(
      () => {
        if (document.visibilityState !== 'visible') return;
        void store.api.getCheck(check.id).then(setCheck, () => undefined);
      },
      s.demo ? 1000 : 5000,
    );
    return () => window.clearInterval(timer);
  }, [check, store, s.demo]);

  // Formular einmal mit dem Ergebnis vorausfüllen
  useEffect(() => {
    const r = check?.result;
    if (!r || prefilled.current === check.id) return;
    prefilled.current = check.id;
    setInstId(r.institution.id && s.institutions.has(r.institution.id) ? r.institution.id : null);
    setDraft({ name: r.institution.name ?? '', cityId: r.institution.cityId ?? '', kind: r.institution.kind ?? 'sonstige', website: r.institution.website ?? '' });
    setKind(r.kindGuess);
    setGate(r.gateGuess);
  }, [check, s.institutions]);

  const start = async () => {
    const u = url.trim();
    if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(u)) return setMsg(t.enterFullUrl);
    setBusy(true);
    setMsg(null);
    try {
      const r = await store.api.checkSource(u, sourceId);
      setCheck(r.check);
      setStarted(r.started);
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!check?.result) return;
    if (kind !== 'portal' && !instId && (!draft.name.trim() || !draft.cityId)) return setMsg(t.chooseInstitution);
    setBusy(true);
    setMsg(null);
    try {
      await store.api.acceptCheck(check.id, {
        kind,
        gate,
        label: label.trim() || undefined,
        ...(kind === 'portal' ? {} : instId ? { institutionId: instId } : { institution: { name: draft.name.trim(), cityId: draft.cityId, kind: draft.kind, website: draft.website || undefined } }),
      });
      store.toast(sourceId ? t.sourceUpdated : t.sourceAccepted);
      onChanged();
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (check) await store.api.discardCheck(check.id).catch(() => undefined);
    onChanged();
    onClose();
  };

  const running = check && (check.status === 'wartet' || check.status === 'laeuft');
  const r = check?.status === 'fertig' ? check.result : null;

  return (
    <Sheet title={sourceId ? t.recheck : t.addWebsite} onClose={onClose} full>
      {!check && (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            {t.checkIntro}
          </p>
          <label className="field">
            <span>{t.url}</span>
            <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/stellenangebote" autoFocus />
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void start()}>
              {t.startCheck}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              {t.cancel}
            </button>
          </div>
        </>
      )}

      {running && (
        <div className="check-wait" aria-live="polite">
          <span className="check-wait__dot" aria-hidden="true" />
          <div>
            <b>{check.status === 'wartet' ? t.checkWaiting : t.checkRunning}</b>
            {check.url.replace(/^https?:\/\//, '')}
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {s.demo ? t.checkDemo : started ? t.checkStarted : t.checkQueued}
            </p>
          </div>
        </div>
      )}

      {check?.status === 'fehler' && (
        <p className="notice notice--warn" role="alert">
          {t.checkFailed}
          {check.error ?? t.unknownError}
        </p>
      )}

      {r && (
        <>
          <CheckResultView r={r} />
          {r.registered && (
            <p className="notice notice--info" style={{ marginTop: 12 }}>
              {t.registered(r.registered.label, r.registered.url ? r.registered.url.replace(/^https?:\/\//, '') : null)}
            </p>
          )}
          <h3 className="section-title">{t.takeAs}</h3>
          {!sourceId && (
            <>
              <div className="field">
                <span>{t.kind}</span>
                <div className="segmented" role="group" aria-label={t.sourceKindAria}>
                  {NEW_SOURCE_KINDS.map((k) => (
                    <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                      {t.kindButton[k]}
                    </button>
                  ))}
                </div>
              </div>
              {kind !== 'portal' && <InstitutionPicker chosenId={instId} setChosenId={setInstId} draft={draft} setDraft={setDraft} />}
              <label className="field">
                <span>{t.labelOptional}</span>
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t.labelPlaceholder} />
              </label>
            </>
          )}
          <div className="field">
            <span>{t.whatToTake}</span>
            <div className="segmented" role="group" aria-label={t.gateAria}>
              <button type="button" aria-pressed={gate === 'none'} onClick={() => setGate('none')}>
                {t.allPostings}
              </button>
              <button type="button" aria-pressed={gate === 'psych'} onClick={() => setGate('psych')}>
                {t.psychAndHorizon}
              </button>
            </div>
            <small className="hint">{t.gateHintCheck}</small>
          </div>
        </>
      )}

      {msg && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 12 }}>
          {msg}
        </p>
      )}

      {check && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {r && (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void accept()}>
              {sourceId ? t.applySettings : t.addAsSource}
            </button>
          )}
          {(r || check.status === 'fehler') && (
            <button type="button" className="btn" disabled={busy} onClick={() => void discard()}>
              {t.discard}
            </button>
          )}
          {running && (
            <button type="button" className="btn" onClick={onClose}>
              {t.close}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function DiscoveryItem({ d, onCheck, onIgnore }: { d: Discovery; onCheck: () => void; onIgnore: () => void }) {
  const isSite = !d.siteKey.startsWith('arbeitgeber:');
  return (
    <li className="suggestion">
      <b>{d.name ?? siteLabel(d.siteKey)}</b>
      {isSite ? <span className="suggestion__url">{siteLabel(d.siteKey)}</span> : <span className="hint">{t.employerOnly}</span>}
      <small className="hint">{t.discoveryFound(d.jobs, relativeTime(d.lastSeenAt))}</small>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        {isSite && (
          <button type="button" className="btn btn--small btn--primary" onClick={onCheck}>
            {t.checkAsSource}
          </button>
        )}
        <button type="button" className="btn btn--small" onClick={onIgnore}>
          {t.dontAdd}
        </button>
        {d.sampleUrl && (
          <a className="btn btn--small btn--quiet" href={d.sampleUrl} target="_blank" rel="noopener noreferrer">
            {t.viewPosting}
          </a>
        )}
      </div>
    </li>
  );
}

function GateEditor() {
  const s = useAppState();
  const store = useStore();
  const [text, setText] = useState(s.settings.gateTerms.join('\n'));
  const changed = text.trim() !== s.settings.gateTerms.join('\n').trim();
  return (
    <details className="help">
      <summary>{t.gateTerms(s.settings.gateTerms.length)}</summary>
      <p className="hint">
        {t.gateHintA}
        <b>{t.gateHintB}</b>
        {t.gateHintC}
      </p>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--small btn--primary"
          disabled={!changed}
          onClick={() => {
            const terms = [...new Set(text.split('\n').map((x) => x.trim()).filter(Boolean))];
            if (terms.length === 0) return;
            store.updateSettings('gateTerms', terms);
            store.toast(t.gateSaved);
          }}
        >
          {t.save}
        </button>
        <button type="button" className="btn btn--small" onClick={() => setText(DEFAULT_GATE_TERMS.join('\n'))}>
          {t.defaultList}
        </button>
      </div>
    </details>
  );
}

export function SourcesPage() {
  const s = useAppState();
  const store = useStore();
  const [tab, setTab] = useState<Tab>('quellen');
  const [data, setData] = useState<SourcesData | null>(null);
  const [skips, setSkips] = useState<GateSkip[] | null>(null);
  const [runs, setRuns] = useState<RunInfo[]>(s.runs);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SourceFilter>('probleme');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Source | null>(null);
  const [checkSheet, setCheckSheet] = useState<{ url?: string; sourceId?: string; check?: SourceCheck } | null>(() => {
    const url = takeIntent('checkUrl');
    return url ? { url } : null;
  });
  const [log, setLog] = useState<{ run: RunInfo; text: string | null } | null>(null);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await store.api.sources());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'aussortiert' && !skips) void store.api.skips().then(setSkips, () => setSkips([]));
    if (tab === 'laeufe') void store.api.runs().then(setRuns, () => undefined);
  }, [tab, skips, store]);

  // Die Erkundung ist eine interne Quelle; sie steht oben im Lauf, nicht in der Liste.
  const sources = (data?.sources ?? []).filter((x) => x.adapter !== 'erkundung');
  const problems = sources.filter(isProblem);
  const openChecks = (data?.checks ?? []).filter((c) => c.status !== 'uebernommen' && c.status !== 'verworfen');
  const discoveries = data?.discoveries ?? [];
  const missing = sources.filter((x) => x.enabled && !x.url);
  useEffect(() => {
    if (data && filter === 'probleme' && problems.length === 0) setFilter(missing.length ? 'ohne' : 'alle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const nameOf = (src: Source) => {
    const inst = src.institutionId ? s.institutions.get(src.institutionId) : undefined;
    return { inst, name: inst ? (inst.shortName ?? inst.name) : (src.label ?? src.id), sub: inst && src.label ? src.label : (t.kindShort[src.kind] ?? t.kindShort.fachbereich) };
  };

  const list = useMemo(() => {
    const n = normalizeText(q);
    const base = filter === 'probleme' ? problems : filter === 'ohne' ? missing : sources;
    const filtered = n ? base.filter((src) => normalizeText(`${nameOf(src).name} ${src.label ?? ''} ${src.url ?? ''}`).includes(n)) : base;
    return [...filtered].sort((a, b) => nameOf(a).name.localeCompare(nameOf(b).name, 'de'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, filter, q, s.institutions]);

  const lastRun = runs[0];
  const queue = data ? Object.values(data.browserQueue).reduce((a, b) => a + b, 0) : 0;
  const explore = lastRun?.stats ?? {};
  const newCount = data ? discoveries.length + data.suggestions.length : 0;

  const trigger = async () => {
    setTriggering(true);
    try {
      await store.api.triggerIngest();
      store.toast(t.collectStarted);
    } catch (e) {
      store.toast(e instanceof Error ? e.message : String(e));
    } finally {
      setTriggering(false);
    }
  };

  return (
    <SubPage title={t.title} sub={data ? t.activeSources(sources.filter((x) => x.enabled).length) : t.loading}>
      <div className="index-card">
        <p className="index-card__kicker">{t.lastRunKicker}</p>
        {lastRun ? (
          <>
            <h2 className="index-card__title" style={{ fontSize: 20 }}>
              {relativeTime(lastRun.finishedAt ?? lastRun.startedAt)} {lastRun.finishedAt ? (lastRun.ok ? '' : t.endedWithError) : t.stillRunning}
            </h2>
            <p className="hint" style={{ marginTop: 0 }}>
              {runSummary(lastRun)}
            </p>
            {explore.erkundungZiel != null && (
              <p className={explore.erkundungFehlt ? 'notice notice--warn' : 'hint'} style={{ marginTop: 4 }}>
                {t.blindSpots(explore.erkundet ?? 0, explore.erkundungFehlt, explore.erkundungZiel)}
              </p>
            )}
          </>
        ) : (
          <p className="hint">{s.demo ? t.demoNoCollect : t.noRunYet}</p>
        )}
        {queue > 0 && <p className="hint">{t.browserQueue(queue)}</p>}
        {!s.demo && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {s.ingestTrigger ? (
              <button type="button" className="btn btn--small btn--primary" disabled={triggering} onClick={() => void trigger()}>
                <IconRefresh width={18} height={18} /> {t.collectNow}
              </button>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                {t.collectNeedsToken}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="segmented segmented--wrap" role="tablist" aria-label={t.sectionAria}>
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {t.tabs[k]}
            {k === 'neu' && newCount ? ` (${newCount})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 12 }}>
          {error}{' '}
          <button type="button" className="btn btn--quiet btn--small" onClick={() => void load()}>
            {t.retry}
          </button>
        </p>
      )}

      {tab === 'quellen' && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '12px 0 4px' }}>
            <button type="button" className="btn btn--small btn--primary" onClick={() => setCheckSheet({})}>
              <IconPlus width={18} height={18} /> {t.addWebsite}
            </button>
          </div>
          {openChecks.length > 0 && (
            <div className="checks">
              <h3 className="section-title" style={{ marginTop: 10 }}>
                {t.checks}
              </h3>
              <ul className="list">
                {openChecks.map((c) => (
                  <li key={c.id} className="row row--source" tabIndex={0} onClick={() => setCheckSheet({ check: c, sourceId: c.sourceId ?? undefined })} onKeyDown={(e) => e.key === 'Enter' && setCheckSheet({ check: c, sourceId: c.sourceId ?? undefined })}>
                    <div className="row__main">
                      <p className="row__title">{c.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
                      <p className="row__sub">
                        {c.result ? `${t.verdict[c.result.verdict]}, ${t.postings(c.result.candidates)}` : c.status === 'fehler' ? (c.error ?? t.checkStatus.fehler) : t.requested(relativeTime(c.requestedAt))}
                      </p>
                    </div>
                    <div className="row__meta">
                      <span className={`status status--${c.status === 'fertig' ? 'ok' : c.status === 'fehler' ? 'fehler' : 'neu'}`}>{c.status === 'fertig' ? t.viewResult : t.checkStatus[c.status]}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="toolbar">
            <div className="chips">
              <button type="button" className="chip" aria-pressed={filter === 'probleme'} onClick={() => setFilter('probleme')}>
                {t.problems(problems.length)}
              </button>
              <button type="button" className="chip" aria-pressed={filter === 'ohne'} onClick={() => setFilter('ohne')}>
                {t.withoutUrl(missing.length)}
              </button>
              <button type="button" className="chip" aria-pressed={filter === 'alle'} onClick={() => setFilter('alle')}>
                {t.all(sources.length)}
              </button>
            </div>
          </div>
          <label className="search" style={{ display: 'block' }}>
            <span className="visually-hidden">{t.searchSources}</span>
            <IconSearch />
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} />
          </label>
          {filter === 'ohne' && missing.length > 0 && <p className="hint">{t.missingHint}</p>}
          {data && list.length === 0 && <p className="hint">{filter === 'probleme' ? t.noProblems : t.noMatches}</p>}
          <ul className="list">
            {list.map((src) => {
              const n = nameOf(src);
              return (
                <li key={src.id} className={`row row--source ${src.enabled ? '' : 'row--faded'}`} onClick={() => setEdit(src)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEdit(src)}>
                  <div className="row__main">
                    <p className="row__title">{n.name}</p>
                    <p className="row__sub">
                      {n.sub}
                      {src.lastRunAt ? t.rowLast(relativeTime(src.lastRunAt), src.lastCount ?? 0) : ''}
                    </p>
                  </div>
                  <div className="row__meta">
                    <span className={`status status--${src.enabled ? src.status : 'leer'}`}>{src.enabled ? t.status[src.status] : t.off}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <GateEditor />
        </>
      )}

      {tab === 'neu' && (
        <>
          <h3 className="section-title" style={{ marginTop: 14 }}>
            {t.newWebsites}
          </h3>
          <p className="hint">{t.newWebsitesHint}</p>
          {discoveries.length === 0 ? (
            <p className="hint">{t.nothingNew}</p>
          ) : (
            <ul className="list">
              {discoveries.map((d) => (
                <DiscoveryItem
                  key={d.siteKey}
                  d={d}
                  onCheck={() => setCheckSheet({ url: d.sampleUrl ? `${new URL(d.sampleUrl).origin}/` : `https://${siteLabel(d.siteKey)}/` })}
                  onIgnore={async () => {
                    await store.api.setDiscoveryStatus(d.siteKey, 'ignoriert');
                    store.toast(t.notSuggested);
                    void load();
                  }}
                />
              ))}
            </ul>
          )}

          <h3 className="section-title">{t.foundPages}</h3>
          <p className="hint">{t.foundPagesHint}</p>
          {!data?.suggestions.length ? (
            <p className="hint">{t.noSuggestions}</p>
          ) : (
            <ul className="list">
              {data.suggestions.map((sg) => {
                const inst = s.institutions.get(sg.institutionId);
                return (
                  <li key={sg.id} className="suggestion">
                    <b>{inst?.name ?? sg.institutionId}</b>
                    <a href={sg.url} target="_blank" rel="noopener noreferrer" className="suggestion__url">
                      {sg.url.replace(/^https?:\/\//, '')}
                    </a>
                    {sg.reason && <small className="hint">{sg.reason}</small>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        type="button"
                        className="btn btn--small btn--primary"
                        onClick={async () => {
                          await store.api.resolveSuggestion(sg.id, true);
                          store.toast(t.accepted);
                          void load();
                        }}
                      >
                        {t.accept}
                      </button>
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={async () => {
                          await store.api.resolveSuggestion(sg.id, false);
                          void load();
                        }}
                      >
                        {t.discard}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'aussortiert' && (
        <>
          <p className="hint">{t.skippedHint}</p>
          {skips == null ? (
            <p className="hint">{t.loading}</p>
          ) : skips.length === 0 ? (
            <p className="hint">{s.demo ? t.demoNoSkips : t.noSkips}</p>
          ) : (
            <ul className="list">
              {skips.map((k) => (
                <li key={k.url} className="skip">
                  <a href={k.url} target="_blank" rel="noopener noreferrer">
                    {k.title ?? k.url.replace(/^https?:\/\//, '')}
                  </a>
                  <small className="hint">
                    {k.institutionId ? (s.institutions.get(k.institutionId)?.shortName ?? s.institutions.get(k.institutionId)?.name) : k.sourceId}, {relativeTime(k.seenAt)}
                    {k.reason === 'ki-nein' ? t.aiNo : k.reason === 'keine-anzeige' ? t.notPosting : k.reason === 'regel-keine-anzeige' ? t.notPostingRule : ''}
                  </small>
                  {k.reason === 'ki-nein' && k.note && <small className="skip__note">{k.note}</small>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'laeufe' && (
        <>
          {runs.length === 0 ? (
            <p className="hint">{s.demo ? t.demoNoRuns : t.noRuns}</p>
          ) : (
            <ul className="list">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="row row--source"
                  tabIndex={0}
                  onClick={() => {
                    setLog({ run: r, text: null });
                    void store.api.runLog(r.id).then(
                      (text) => setLog({ run: r, text }),
                      () => setLog({ run: r, text: t.logUnavailable }),
                    );
                  }}
                >
                  <div className="row__main">
                    <p className="row__title">{runTime(r.startedAt, 'medium')}</p>
                    <p className="row__sub">{runSummary(r)}</p>
                  </div>
                  <div className="row__meta">
                    <span className={`status status--${r.finishedAt ? (r.ok ? 'ok' : 'fehler') : 'neu'}`}>{r.finishedAt ? (r.ok ? t.checkStatus.fertig : t.checkStatus.fehler) : t.checkStatus.laeuft}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {edit && (
        <SourceSheet
          src={edit}
          inst={edit.institutionId ? s.institutions.get(edit.institutionId) : undefined}
          onClose={() => setEdit(null)}
          onSaved={() => void load()}
          onRecheck={() => {
            setCheckSheet({ url: edit.url ?? undefined, sourceId: edit.id });
            setEdit(null);
          }}
        />
      )}
      {checkSheet && <CheckSheet initialUrl={checkSheet.url} sourceId={checkSheet.sourceId} check={checkSheet.check} onClose={() => setCheckSheet(null)} onChanged={() => void load()} />}
      {log && (
        <Sheet title={t.runOf(runTime(log.run.startedAt, 'short'))} onClose={() => setLog(null)} full>
          <ul className="facts">
            {STAT_KEYS.filter((k) => log.run.stats?.[k]).map((k) => (
              <li key={k}>
                <span className="facts__k">{t.stats[k]}</span>
                <span className="facts__v">{log.run.stats[k]}</span>
              </li>
            ))}
          </ul>
          <h3 className="section-title">{t.log}</h3>
          <pre className="log">{log.text ?? t.loading}</pre>
        </Sheet>
      )}
    </SubPage>
  );
}
