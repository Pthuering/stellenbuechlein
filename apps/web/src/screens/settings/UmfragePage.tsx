// Umfrage für das Suchprofil: Seite für Seite, mit Vorschlägen zum Antippen und Fortschritt oben.
// Die Antworten werden laufend als Einstellung "umfrage" gespeichert (Weitermachen geht auch auf einem
// anderen Gerät). Am Ende entsteht daraus über den Steckbrief-Import das Suchprofil.
// Gespeichert wird bei Katalog-Einträgen immer die deutsche Bezeichnung (Pipeline und KI arbeiten
// damit); angezeigt wird die Übersetzung aus i18n/katalog.ts. Eigene Einträge bleiben, wie getippt.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ABSCHLUSS_VORSCHLAEGE,
  ARBEITSWEISE,
  BRUECKEN_HINWEISE,
  DOSIS_OPTIONEN,
  EINRICHTUNG_OPTIONEN,
  ENTGELT_STUFEN,
  FACHGEBIETE,
  INTERESSEN,
  LIEBER_NICHT,
  METHODEN_GRUPPEN,
  MOBIL_OPTIONEN,
  REISEN_OPTIONEN,
  START_OPTIONEN,
  STAND_OPTIONEN,
  STATE_CODES,
  STELLENART_OPTIONEN,
  THEMEN,
  UMFANG_STUFEN,
  eigeneAuswahl,
  freigeben,
  importSteckbrief,
  isOpen,
  neueUmfrage,
  normalizeText,
  scoreJob,
  starterHorizont,
  todayBerlin,
  umfrageAlsText,
  umfrageZuSteckbrief,
  type Auswahl,
  type CategoryId,
  type Hearts as HeartCount,
  type KatalogEintrag,
  type StateCode,
  type Suchprofil,
  type UmfrageAntworten,
  type UmfrageOption,
  type UmfrageOrt,
  type UmfrageStand,
} from '@stellen/core';
import { useAppState, useStore, useViews } from '../../data/hooks';
import { navigate, openJob } from '../../lib/router';
import { Hearts } from '../../ui/bits';
import { IconChevron, IconHeart, IconPlus, IconSearch, IconX } from '../../ui/icons';
import { scoreTone } from '../../ui/JobRow';
import { ProfilePreview, steckbriefMessage } from './SteckbriefImport';
import { fmtDate, fmtPct, srForm, texts } from '../../i18n';
import { categoryLabel, institutionKindLabel, stateName } from '../../i18n/labels';
import { abschlussLabel, brueckeText, gruppeTitel, interesseLabel, katalogEintrag, option, stellenartOption } from '../../i18n/katalog';

type Set_ = (patch: Partial<UmfrageAntworten>) => void;

const TEILE = ['ueberDich', 'inhalte', 'stelle', 'rahmen', 'koennen', 'orte', 'horizont', 'schluss'] as const;
type Teil = (typeof TEILE)[number];

const t = texts({
  de: {
    add: 'Dazu',
    remove: (x: string) => `${x} entfernen`,
    howImportant: 'Wie wichtig?',
    importanceOf: (x: string) => `Wichtigkeit von ${x}`,
    heartHelp: '3 Herzen = zentral, 2 = wichtig, 1 = schön, wenn es passt.',
    anythingElse: 'Noch etwas?',
    otherInterest: 'Noch etwas anderes?',
    ownInterest: 'Eigenes Interesse',
    ownInterestPh: 'z. B. Astronomie',
    placeSearch: 'Stadt oder Einrichtung suchen',
    placePh: 'z. B. Leipzig, Max-Planck, Charité',
    placeNone: 'Nichts gefunden. Schreib sie einfach am Ende unter „Sonst noch etwas“ dazu.',
    city: 'Stadt',
    toResult: 'Zum Ergebnis',
    teile: { ueberDich: 'Über dich', inhalte: 'Inhalte', stelle: 'Die Stelle', rahmen: 'Rahmen', koennen: 'Können', orte: 'Orte', horizont: 'Horizont', schluss: 'Zum Schluss' } as Record<Teil, string>,
    name: {
      titel: 'Wie heißt du, und wo stehst du gerade?',
      sub: 'Der Name steht nur über deinem Profil.',
      firstName: 'Vorname',
      stand: 'Wo stehst du gerade?',
    },
    studium: {
      titel: 'Was hast du studiert?',
      sub: 'Schwerpunkte und Abschlussarbeit verraten viel darüber, was zu dir passt.',
      degree: 'Studiengang und Abschluss',
      degreePh: 'z. B. Psychologie (M.Sc.)',
      thesis: 'Worum ging es in deiner Abschlussarbeit?',
      thesisPh: 'z. B. Emotionsregulation bei Jugendlichen, eine EEG-Studie',
    },
    start: { titel: 'Ab wann suchst du?' },
    fach: {
      titel: 'Welche Bereiche der Psychologie interessieren dich?',
      sub: 'Tipp alles an, was dich reizt. Wie wichtig dir was ist, kommt gleich.',
      ownLabel: 'Fehlt ein Bereich?',
      ownPh: 'Eigener Bereich',
    },
    themen: {
      titel: 'An welchen Themen würdest du gern arbeiten?',
      sub: 'Konkrete Forschungs- oder Arbeitsthemen. Andere Schreibweisen gehen mit Schrägstrich: Emotionsregulation / emotion regulation.',
      ownLabel: 'Eigene Themen',
      ownPh: 'z. B. Interozeption / interoception',
    },
    themenRate: {
      titel: 'Wie wichtig ist dir was?',
      sub: 'Je mehr Herzen, desto weiter oben landen passende Anzeigen.',
      empty: 'Noch nichts ausgewählt. Geh zwei Seiten zurück, oder lass es einfach leer.',
    },
    art: { titel: 'Welche Art von Stelle suchst du?', sub: 'Antippen, dann gewichten.' },
    einrichtung: {
      titel: 'Wo würdest du gern arbeiten?',
      sub: 'Mehrere sind möglich. Das sortiert noch nichts, hilft aber, das Profil später nachzuschärfen.',
    },
    nicht: {
      titel: 'Gibt es etwas, das du lieber nicht möchtest?',
      sub: 'Solche Anzeigen rutschen nach unten. Ausgeblendet wird nichts.',
      ownPh: 'z. B. Pflege',
      howFar: 'Wie weit nach unten?',
      howFarHint: '1 Herz = ein bisschen, 3 Herzen = deutlich.',
    },
    geld: {
      titel: 'Bezahlung und Umfang',
      sub: 'Was mindestens drin sein sollte. Steht es nicht in der Anzeige, zählt es halb.',
      payMin: 'Bezahlung mindestens',
      any: 'egal',
      payHint: 'Für Stellen mit Master ist E 13 üblich (Tarif im öffentlichen Dienst).',
      payImportance: 'Wichtigkeit der Bezahlung',
      hoursMin: 'Umfang mindestens',
      fullTime: 'Vollzeit',
      hoursHint: 'Promotionsstellen haben oft 50 bis 75 %.',
      hoursImportance: 'Wichtigkeit des Umfangs',
    },
    befristung: {
      titel: 'Befristung und Sprache',
      permQ: 'Wie wichtig ist dir eine unbefristete Stelle?',
      permHint: 'In der Wissenschaft sind die meisten Stellen befristet.',
      perm: ['Befristet ist völlig in Ordnung', 'Wäre schön', 'Wichtig', 'Sehr wichtig'],
      langQ: 'In welcher Sprache arbeitest du lieber?',
      langs: { de: 'Lieber auf Deutsch', en: 'Lieber auf Englisch', egal: 'Beides gleich gern' },
    },
    arbeitsweise: {
      titel: 'Wie möchtest du arbeiten?',
      sub: 'Anzeigen, die das erwähnen, rücken nach oben. Steht nichts dazu drin, gibt es einfach keinen Bonus.',
      travel: 'Und Dienstreisen?',
    },
    methoden: {
      titel: 'Was kannst du, und was machst du gern?',
      sub: 'Methoden, Software, Erfahrungen. Anzeigen, die das verlangen, rücken nach oben.',
      ownPh: 'z. B. Stata / jamovi',
    },
    methodenRate: {
      titel: 'Wie gern möchtest du das einsetzen?',
      empty: 'Noch nichts ausgewählt. Geh eine Seite zurück, oder lass es einfach leer.',
    },
    mobil: { titel: 'Wie weit würdest du für eine Stelle gehen?' },
    laender: {
      titel: 'Welche Bundesländer sind dir am liebsten?',
      sub: 'Sie werden Lieblingsorte: Ihre Anzeigen stehen im Stapel und in den Listen oben. Alles andere bleibt sichtbar.',
    },
    orte: { titel: 'Lieblingsstädte oder Wunsch-Einrichtungen?', sub: 'Suchen und antippen. Auch sie stehen dann oben.' },
    bruecken: {
      titel: 'Wo könntest du dein Wissen auch außerhalb der Psychologie einsetzen?',
      sub: 'Aus diesen Feldern kommen Stellen, die nicht nach Psychologie klingen, aber zu dir passen können. Sie werden im Stapel eingestreut. Wählst du keins, bleiben alle zehn als breite Startauswahl.',
      label: 'Felder außerhalb der Psychologie',
    },
    interessen: {
      titel: 'Was findest du außerhalb der Psychologie spannend?',
      sub: 'Daraus kann die KI später weitere Felder vorschlagen (Ich → Horizont).',
    },
    dosis: {
      titel: 'Wie oft sollen solche Stellen auftauchen?',
      label: 'Wie oft im Stapel',
      weite: 'Auch Stellen ohne passendes Feld',
      weiteHint: 'Die KI darf Anzeigen vorschlagen, in denen deine Fähigkeiten tragen, auch wenn keins der Felder passt.',
    },
    gewichte: {
      titel: 'Was zählt für dich am meisten?',
      sub: 'Wie stark jeder Bereich in die Prozentzahl einer Anzeige eingeht.',
      hints: { thema: 'worum es inhaltlich geht', stelle: 'Promotion, Mitarbeit, Postdoc …', methoden: 'was du einsetzen kannst', rahmen: 'Bezahlung, Umfang, Befristung' } as Record<CategoryId, string>,
      weightOf: (x: string) => `Gewicht von ${x}`,
    },
    traum: {
      titel: 'Wie sähe deine Traumstelle aus?',
      sub: 'Ganz frei, in ein paar Sätzen. Geht (noch) nicht in die Prozentzahl ein, hilft aber sehr, das Profil später nachzuschärfen.',
      label: 'Traumstelle',
      ph: 'Was würdest du den Tag über machen, mit wem, wo?',
      elseQ: 'Sonst noch etwas, das die App wissen sollte?',
      elseLabel: 'Sonst noch etwas',
      elsePh: 'Wünsche, No-Gos, Orte, die fehlten …',
    },
    intro: {
      kicker: 'Steckbrief',
      titleDone: 'Deine Antworten',
      titleContinue: 'Schön, dass du weitermachst',
      titleNew: 'Erzähl, was du suchst',
      applied: (date: string) => `Am ${date} hast du daraus dein Profil gemacht. Du kannst alles durchgehen, ändern und das Profil neu übernehmen.`,
      size: (pages: number, parts: number) => `${pages} kurze Seiten in ${parts} Teilen, etwa 15 Minuten.`,
      tap: 'Vorschläge zum Antippen, Eigenes geht immer. Nichts ist Pflicht.',
      saved: 'Alles wird gleich gespeichert. Du kannst jederzeit aufhören und später weitermachen, auch auf einem anderen Gerät.',
      end: 'Am Ende siehst du dein Profil, bevor es übernommen wird. Aussortiert wird nie etwas, nur sortiert.',
      hearts: 'Herzchen:',
      core: 'zentral,',
      important: 'wichtig,',
      nice: 'schön, wenn es passt.',
      continueResult: 'Weiter zum Ergebnis',
      continueAt: (n: number) => `Weiter bei Seite ${n}`,
      fromStart: 'Von vorn durchgehen',
      review: 'Antworten durchgehen',
      start: 'Los geht’s',
      reset: 'Antworten löschen',
    },
    result: {
      top: 'Damit oben:',
      count: (high: number, total: number) => `${high} von ${total} offenen Anzeigen hätten 75 % oder mehr`,
      favs: 'Lieblingsorte',
      favsHint: 'Was du abhakst, wird nicht übernommen.',
      kinds: { state: 'Bundesland', city: 'Stadt', institution: 'Einrichtung' },
      applyAgain: 'Profil neu übernehmen',
      apply: 'Profil übernehmen',
      edit: 'Antworten ändern',
      copy: 'Antworten kopieren',
      copied: 'Antworten kopiert.',
      copyFailed: 'Kopieren ging nicht. Die Antworten bleiben aber gespeichert.',
      replaceHint:
        'Das bisherige Profil wird ersetzt. Direkt danach lässt es sich mit „Profil zurück“ wiederherstellen. Feinheiten wie Suchbegriffe lassen sich jederzeit unter „Profil anpassen“ ändern.',
    },
    page: {
      later: 'Später weitermachen',
      saved: 'Antworten gespeichert. Du kannst jederzeit aufhören.',
      savedLocal: 'Auf diesem Gerät gespeichert. Wird übertragen, sobald du wieder online bist.',
      me: 'Ich',
      part: (i: number, n: number, name: string) => `Teil ${i} von ${n}: ${name}`,
      done: 'Geschafft',
      pageOf: (i: number, n: number) => `Seite ${i} von ${n}`,
      progress: 'Fortschritt der Umfrage',
      title: 'Umfrage für dein Profil',
      sub: 'Damit oben steht, was wirklich zu dir passt',
      back: 'Zurück',
      next: 'Weiter',
      doneTitle: 'Geschafft!',
      doneSub: 'Aus deinen Antworten ist dieses Profil entstanden. Schau es dir an und übernimm es, wenn es passt.',
      applied: (n: number) => `Profil übernommen${n ? `, ${n} Lieblingsort${n === 1 ? '' : 'e'} dazu` : ''}. Die Anzeigen sind neu sortiert.`,
      appliedAndRun: (n: number) => `Profil übernommen${n ? `, ${n} Lieblingsort${n === 1 ? '' : 'e'} dazu` : ''}. Der große Durchlauf läuft jetzt an: Er liest alle Quellen nach deinem Profil und kann einige Stunden dauern; neue Anzeigen erscheinen nach und nach.`,
      undoProfile: 'Profil zurück',
      deleted: 'Antworten gelöscht.',
      undo: 'Rückgängig',
    },
  },
  en: {
    add: 'Add',
    remove: (x) => `Remove ${x}`,
    howImportant: 'How important?',
    importanceOf: (x) => `Importance of ${x}`,
    heartHelp: '3 hearts = essential, 2 = important, 1 = nice if it fits.',
    anythingElse: 'Anything else?',
    otherInterest: 'Something else?',
    ownInterest: 'Your own interest',
    ownInterestPh: 'e.g. astronomy',
    placeSearch: 'Search for a city or institution',
    placePh: 'e.g. Leipzig, Max-Planck, Charité',
    placeNone: 'Nothing found. Just add it at the end under “Anything else”.',
    city: 'City',
    toResult: 'See the result',
    teile: { ueberDich: 'About you', inhalte: 'Topics', stelle: 'The job', rahmen: 'Conditions', koennen: 'Skills', orte: 'Places', horizont: 'Horizon', schluss: 'Wrapping up' },
    name: {
      titel: 'What’s your name, and where are you at right now?',
      sub: 'Your name only appears at the top of your profile.',
      firstName: 'First name',
      stand: 'Where are you at right now?',
    },
    studium: {
      titel: 'What did you study?',
      sub: 'Your focus areas and your thesis say a lot about what suits you.',
      degree: 'Program and degree',
      degreePh: 'e.g. Psychology (M.Sc.)',
      thesis: 'What was your thesis about?',
      thesisPh: 'e.g. emotion regulation in adolescents, an EEG study',
    },
    start: { titel: 'When are you looking to start?' },
    fach: {
      titel: 'Which areas of psychology interest you?',
      sub: 'Tap everything that appeals to you. How much each one matters comes in a moment.',
      ownLabel: 'Missing an area?',
      ownPh: 'Your own area',
    },
    themen: {
      titel: 'Which topics would you like to work on?',
      sub: 'Specific research or work topics. Postings are in German or English, so add other spellings with a slash: emotion regulation / Emotionsregulation.',
      ownLabel: 'Your own topics',
      ownPh: 'e.g. interoception / Interozeption',
    },
    themenRate: {
      titel: 'How much does each one matter to you?',
      sub: 'The more hearts, the higher matching postings land.',
      empty: 'Nothing selected yet. Go back two pages, or just leave it empty.',
    },
    art: { titel: 'What kind of position are you looking for?', sub: 'Tap to choose, then rate.' },
    einrichtung: {
      titel: 'Where would you like to work?',
      sub: 'You can pick several. This doesn’t sort anything yet, but it helps fine-tune your profile later.',
    },
    nicht: {
      titel: 'Is there anything you’d rather not do?',
      sub: 'Postings like that move down the list. Nothing gets hidden.',
      ownPh: 'e.g. nursing / Pflege',
      howFar: 'How far down?',
      howFarHint: '1 heart = a little, 3 hearts = a lot.',
    },
    geld: {
      titel: 'Pay and hours',
      sub: 'The minimum it should offer. If a posting doesn’t say, it counts half.',
      payMin: 'Minimum pay',
      any: 'any',
      payHint: 'E 13 is the usual pay grade for positions that require a master’s (public-sector pay scale).',
      payImportance: 'Importance of pay',
      hoursMin: 'Minimum hours',
      fullTime: 'Full-time',
      hoursHint: 'PhD positions are often 50 to 75%.',
      hoursImportance: 'Importance of hours',
    },
    befristung: {
      titel: 'Contract and language',
      permQ: 'How important is a permanent position to you?',
      permHint: 'In academia, most positions are fixed-term.',
      perm: ['Fixed-term is totally fine', 'Would be nice', 'Important', 'Very important'],
      langQ: 'Which language do you prefer to work in?',
      langs: { de: 'Preferably German', en: 'Preferably English', egal: 'Either is fine' },
    },
    arbeitsweise: {
      titel: 'How would you like to work?',
      sub: 'Postings that mention it move up. If a posting says nothing about it, there’s simply no bonus.',
      travel: 'And business travel?',
    },
    methoden: {
      titel: 'What can you do, and what do you enjoy doing?',
      sub: 'Methods, software, experience. Postings that ask for them move up.',
      ownPh: 'e.g. Stata / jamovi',
    },
    methodenRate: {
      titel: 'How much would you like to use these?',
      empty: 'Nothing selected yet. Go back one page, or just leave it empty.',
    },
    mobil: { titel: 'How far would you go for a job?' },
    laender: {
      titel: 'Which federal states do you like best?',
      sub: 'They become favorite places: their postings appear at the top of the stack and the lists. Everything else stays visible.',
    },
    orte: { titel: 'Favorite cities or dream institutions?', sub: 'Search and tap. They’ll go to the top too.' },
    bruecken: {
      titel: 'Where else could you use your knowledge, outside psychology?',
      sub: 'These fields bring up jobs that don’t sound like psychology but may still suit you. They get mixed into the stack. If you pick none, all ten stay on as a broad starting set.',
      label: 'Fields outside psychology',
    },
    interessen: {
      titel: 'What do you find exciting outside psychology?',
      sub: 'The AI can use this later to suggest more fields (Me → Horizon).',
    },
    dosis: {
      titel: 'How often should jobs like these show up?',
      label: 'How often in the stack',
      weite: 'Also jobs without a matching field',
      weiteHint: 'The AI may suggest postings where your skills are a strong fit, even if none of the fields match.',
    },
    gewichte: {
      titel: 'What matters most to you?',
      sub: 'How much each area counts toward a posting’s percentage.',
      hints: { thema: 'what the work is about', stelle: 'PhD, research associate, postdoc…', methoden: 'what you can bring', rahmen: 'pay, hours, fixed-term or permanent' },
      weightOf: (x) => `Weight of ${x}`,
    },
    traum: {
      titel: 'What would your ideal job look like?',
      sub: 'In your own words, just a few sentences. It doesn’t count toward the percentage (yet), but it really helps fine-tune the profile later.',
      label: 'Ideal job',
      ph: 'What would you do all day, with whom, and where?',
      elseQ: 'Anything else the app should know?',
      elseLabel: 'Anything else',
      elsePh: 'Wishes, no-gos, places that were missing…',
    },
    intro: {
      kicker: 'Profile sheet',
      titleDone: 'Your answers',
      titleContinue: 'Great to have you back',
      titleNew: 'Tell me what you’re looking for',
      applied: (date) => `On ${date}, you turned these answers into your profile. You can go through everything, change it and apply the profile again.`,
      size: (pages, parts) => `${pages} short pages in ${parts} parts, about 15 minutes.`,
      tap: 'Suggestions to tap, and you can always add your own. Nothing is required.',
      saved: 'Everything is saved right away. You can stop anytime and pick up later, even on another device.',
      end: 'At the end, you’ll see your profile before it’s applied. Nothing ever gets filtered out, only sorted.',
      hearts: 'Hearts:',
      core: 'essential,',
      important: 'important,',
      nice: 'nice if it fits.',
      continueResult: 'Continue to the result',
      continueAt: (n) => `Continue on page ${n}`,
      fromStart: 'Start from the beginning',
      review: 'Go through your answers',
      start: 'Let’s go',
      reset: 'Delete answers',
    },
    result: {
      top: 'Top of the list with this profile:',
      count: (high, total) => `${high} of ${total} open ${total === 1 ? 'posting' : 'postings'} would be a 75% match or better`,
      favs: 'Favorite places',
      favsHint: 'Anything you uncheck won’t be added.',
      kinds: { state: 'Federal state', city: 'City', institution: 'Institution' },
      applyAgain: 'Apply profile again',
      apply: 'Apply profile',
      edit: 'Edit answers',
      copy: 'Copy answers',
      copied: 'Answers copied (in German).',
      copyFailed: 'Couldn’t copy. Your answers are still saved, though.',
      replaceHint:
        'This replaces your current profile. Right afterwards, you can bring it back with “Restore profile”. Details like search terms can be changed anytime under “Adjust profile”.',
    },
    page: {
      later: 'Continue later',
      saved: 'Answers saved. You can stop anytime.',
      savedLocal: 'Saved on this device. It’ll sync as soon as you’re back online.',
      me: 'Me',
      part: (i, n, name) => `Part ${i} of ${n}: ${name}`,
      done: 'Done',
      pageOf: (i, n) => `Page ${i} of ${n}`,
      progress: 'Questionnaire progress',
      title: 'Questionnaire for your profile',
      sub: 'So that what really suits you ends up on top',
      back: 'Back',
      next: 'Next',
      doneTitle: 'All done!',
      doneSub: 'Your answers turned into this profile. Take a look, and apply it if it fits.',
      applied: (n) => `Profile applied${n ? `, ${n} favorite ${n === 1 ? 'place' : 'places'} added` : ''}. Postings have been re-sorted.`,
      appliedAndRun: (n) => `Profile applied${n ? `, ${n} favorite ${n === 1 ? 'place' : 'places'} added` : ''}. The full run is starting now: it reads all sources by your profile and can take a few hours; new postings will show up gradually.`,
      undoProfile: 'Restore profile',
      deleted: 'Answers deleted.',
      undo: 'Undo',
    },
  },
  sr: {
    add: 'Dodaj',
    remove: (x) => `Ukloni: ${x}`,
    howImportant: 'Koliko je važno?',
    importanceOf: (x) => `Važnost: ${x}`,
    heartHelp: '3 srca = ključno, 2 = važno, 1 = lepo ako se poklopi.',
    anythingElse: 'Još nešto?',
    otherInterest: 'Nešto drugo?',
    ownInterest: 'Tvoje interesovanje',
    ownInterestPh: 'npr. astronomija',
    placeSearch: 'Pretraži grad ili ustanovu',
    placePh: 'npr. Leipzig, Max-Planck, Charité',
    placeNone: 'Ništa nije pronađeno. Jednostavno to dopiši na kraju, pod „Još nešto“.',
    city: 'Grad',
    toResult: 'Pogledaj rezultat',
    teile: { ueberDich: 'O tebi', inhalte: 'Teme', stelle: 'Posao', rahmen: 'Uslovi', koennen: 'Veštine', orte: 'Mesta', horizont: 'Horizont', schluss: 'Za kraj' },
    name: {
      titel: 'Kako se zoveš i u kojoj si trenutno fazi?',
      sub: 'Ime se prikazuje samo iznad tvog profila.',
      firstName: 'Ime',
      stand: 'U kojoj si trenutno fazi?',
    },
    studium: {
      titel: 'Koje je tvoje obrazovanje?',
      sub: 'Usmerenje i završni rad mnogo govore o tome šta ti odgovara.',
      degree: 'Studijski program i diploma',
      degreePh: 'npr. Psihologija (master)',
      thesis: 'O čemu je tvoj završni rad?',
      thesisPh: 'npr. regulacija emocija kod adolescenata, EEG studija',
    },
    start: { titel: 'Kada želiš da počneš?' },
    fach: {
      titel: 'Koje oblasti psihologije te zanimaju?',
      sub: 'Dodirni sve što te privlači. Koliko ti je šta važno, odredićeš malo kasnije.',
      ownLabel: 'Nedostaje neka oblast?',
      ownPh: 'Tvoja oblast',
    },
    themen: {
      titel: 'Na kojim temama želiš da radiš?',
      sub: 'Konkretne istraživačke ili radne teme. Oglasi su na nemačkom ili engleskom, pa druge varijante dodaj sa kosom crtom: Emotionsregulation / emotion regulation.',
      ownLabel: 'Tvoje teme',
      ownPh: 'npr. Interozeption / interoception',
    },
    themenRate: {
      titel: 'Koliko ti je šta važno?',
      sub: 'Što više srca, to su odgovarajući oglasi više na listi.',
      empty: 'Još ništa nije izabrano. Vrati se dve stranice unazad ili jednostavno ostavi prazno.',
    },
    art: { titel: 'Kakvu poziciju tražiš?', sub: 'Dodirni, pa oceni srcima.' },
    einrichtung: {
      titel: 'Gde želiš da radiš?',
      sub: 'Možeš da izabereš više njih. Ovo još ništa ne sortira, ali pomaže da se profil kasnije izoštri.',
    },
    nicht: {
      titel: 'Ima li nečega što radije izbegavaš?',
      sub: 'Takvi oglasi padaju niže na listi. Ništa se ne sakriva.',
      ownPh: 'npr. Pflege / nursing',
      howFar: 'Koliko niže?',
      howFarHint: '1 srce = malo, 3 srca = znatno.',
    },
    geld: {
      titel: 'Plata i obim zaposlenja',
      sub: 'Koliko najmanje treba da bude. Ako oglas to ne navodi, računa se upola.',
      payMin: 'Plata, najmanje',
      any: 'svejedno',
      payHint: 'Za pozicije sa masterom uobičajen je E 13 (platni razred u javnom sektoru).',
      payImportance: 'Važnost plate',
      hoursMin: 'Obim zaposlenja, najmanje',
      fullTime: 'Puno radno vreme',
      hoursHint: 'Doktorske pozicije često imaju obim od 50 do 75%.',
      hoursImportance: 'Važnost obima zaposlenja',
    },
    befristung: {
      titel: 'Trajanje ugovora i jezik',
      permQ: 'Koliko ti je važna pozicija na neodređeno?',
      permHint: 'U nauci je većina pozicija na određeno.',
      perm: ['Na određeno je sasvim u redu', 'Bilo bi lepo', 'Važno', 'Veoma važno'],
      langQ: 'Na kom jeziku radije radiš?',
      langs: { de: 'Radije na nemačkom', en: 'Radije na engleskom', egal: 'Svejedno, oba jezika' },
    },
    arbeitsweise: {
      titel: 'Kako želiš da radiš?',
      sub: 'Oglasi koji to pominju idu naviše. Ako oglas o tome ništa ne kaže, jednostavno nema bonusa.',
      travel: 'A službena putovanja?',
    },
    methoden: {
      titel: 'Šta umeš i šta voliš da radiš?',
      sub: 'Metode, softver, iskustva. Oglasi koji to traže idu naviše.',
      ownPh: 'npr. Stata / jamovi',
    },
    methodenRate: {
      titel: 'Koliko ti je stalo da ovo koristiš?',
      empty: 'Još ništa nije izabrano. Vrati se jednu stranicu unazad ili jednostavno ostavi prazno.',
    },
    mobil: { titel: 'Koliko daleko ideš zbog posla?' },
    laender: {
      titel: 'Koje savezne pokrajine su ti najdraže?',
      sub: 'One postaju omiljena mesta: njihovi oglasi su na vrhu špila i liste. Sve ostalo ostaje vidljivo.',
    },
    orte: { titel: 'Omiljeni gradovi ili željene ustanove?', sub: 'Pronađi i dodirni. I oni će onda biti na vrhu.' },
    bruecken: {
      titel: 'Gde još možeš da primeniš svoje znanje, van psihologije?',
      sub: 'Iz ovih oblasti stižu poslovi koji ne zvuče psihološki, ali ti mogu odgovarati. Ubacuju se u špil. Ako ne izabereš nijednu, ostaje svih deset kao širok početni izbor.',
      label: 'Oblasti van psihologije',
    },
    interessen: {
      titel: 'Šta te zanima van psihologije?',
      sub: 'Na osnovu toga AI kasnije može da predloži nove oblasti (Ja → Horizont).',
    },
    dosis: {
      titel: 'Koliko često treba da se pojavljuju ovakvi poslovi?',
      label: 'Koliko često u špilu',
      weite: 'I poslovi bez odgovarajuće oblasti',
      weiteHint: 'AI sme da predloži oglase u kojima tvoje veštine dolaze do izražaja, čak i kad nijedna oblast ne odgovara.',
    },
    gewichte: {
      titel: 'Šta ti je najvažnije?',
      sub: 'Koliko svaka kategorija utiče na procenat poklapanja oglasa.',
      hints: { thema: 'o čemu se u poslu radi', stelle: 'doktorat, istraživač saradnik, postdok…', methoden: 'šta možeš da ponudiš', rahmen: 'plata, obim zaposlenja, trajanje ugovora' },
      weightOf: (x) => `Težina: ${x}`,
    },
    traum: {
      titel: 'Kako bi izgledao tvoj idealan posao?',
      sub: 'Sasvim slobodno, u nekoliko rečenica. To (još) ne utiče na procenat, ali mnogo pomaže da se profil kasnije izoštri.',
      label: 'Idealan posao',
      ph: 'Kako izgleda tvoj radni dan: šta radiš, s kim i gde?',
      elseQ: 'Još nešto što aplikacija treba da zna?',
      elseLabel: 'Još nešto',
      elsePh: 'Želje, stvari koje ne dolaze u obzir, mesta koja su nedostajala…',
    },
    intro: {
      kicker: 'Lični karton',
      titleDone: 'Tvoji odgovori',
      titleContinue: 'Lepo je što nastavljaš',
      titleNew: 'Ispričaj šta tražiš',
      applied: (date) => `Dana ${date} od ovih odgovora je nastao tvoj profil. Možeš da prođeš kroz sve, izmeniš šta želiš i ponovo primeniš profil.`,
      size: (pages, parts) => `${pages} ${srForm(pages, 'kratka stranica', 'kratke stranice', 'kratkih stranica')} u ${parts} ${srForm(parts, 'deo', 'dela', 'delova')}, oko 15 minuta.`,
      tap: 'Predlozi koje samo dodirneš, a uvek možeš da dodaš i nešto svoje. Ništa nije obavezno.',
      saved: 'Sve se odmah čuva. Možeš da staneš kad god hoćeš i nastaviš kasnije, čak i na drugom uređaju.',
      end: 'Na kraju ćeš videti svoj profil pre nego što se primeni. Ništa se nikad ne izbacuje, samo se sortira.',
      hearts: 'Srca:',
      core: 'ključno,',
      important: 'važno,',
      nice: 'lepo ako se poklopi.',
      continueResult: 'Nastavi do rezultata',
      continueAt: (n) => `Nastavi od stranice ${n}`,
      fromStart: 'Kreni ispočetka',
      review: 'Prođi kroz odgovore',
      start: 'Krenimo',
      reset: 'Obriši odgovore',
    },
    result: {
      top: 'Na vrhu liste sa ovim profilom:',
      count: (high, total) => `poklapanje od 75% ili više: ${high} od ${total} ${srForm(total, 'otvorenog oglasa', 'otvorena oglasa', 'otvorenih oglasa')}`,
      favs: 'Omiljena mesta',
      favsHint: 'Mesta bez kvačice neće biti dodata.',
      kinds: { state: 'Savezna pokrajina', city: 'Grad', institution: 'Ustanova' },
      applyAgain: 'Ponovo primeni profil',
      apply: 'Primeni profil',
      edit: 'Izmeni odgovore',
      copy: 'Kopiraj odgovore',
      copied: 'Odgovori su kopirani (na nemačkom).',
      copyFailed: 'Kopiranje nije uspelo. Odgovori su ipak sačuvani.',
      replaceHint:
        'Dosadašnji profil biće zamenjen. Odmah posle toga možeš da ga vratiš dugmetom „Vrati profil“. Detalje, poput pojmova za pretragu, uvek možeš da promeniš pod „Prilagodi profil“.',
    },
    page: {
      later: 'Nastavi kasnije',
      saved: 'Odgovori su sačuvani. Možeš da staneš kad god hoćeš.',
      savedLocal: 'Odgovori su sačuvani na ovom uređaju i biće preneti čim ponovo budeš onlajn.',
      me: 'Ja',
      part: (i, n, name) => `Deo ${i} od ${n}: ${name}`,
      done: 'Gotovo',
      pageOf: (i, n) => `Stranica ${i} od ${n}`,
      progress: 'Napredak kroz upitnik',
      title: 'Upitnik za tvoj profil',
      sub: 'Da na vrhu bude ono što ti zaista odgovara',
      back: 'Nazad',
      next: 'Dalje',
      doneTitle: 'Gotovo!',
      doneSub: 'Od tvojih odgovora nastao je ovaj profil. Pogledaj ga i primeni ako ti odgovara.',
      applied: (n) => `Profil je primenjen${n ? `, uz ${n} ${srForm(n, 'novo omiljeno mesto', 'nova omiljena mesta', 'novih omiljenih mesta')}` : ''}. Oglasi su ponovo sortirani.`,
      appliedAndRun: (n) => `Profil je primenjen${n ? `, uz ${n} ${srForm(n, 'novo omiljeno mesto', 'nova omiljena mesta', 'novih omiljenih mesta')}` : ''}. Veliki prolaz upravo kreće: čita sve izvore prema tvom profilu i može da potraje nekoliko sati; novi oglasi stižu postepeno.`,
      undoProfile: 'Vrati profil',
      deleted: 'Odgovori su obrisani.',
      undo: 'Opozovi',
    },
  },
});

/** Antwortmöglichkeiten der Umfrage mit übersetzter Bezeichnung (gespeichert wird nur die id). */
function opts<O extends { id: string | number; label: string; hinweis?: string }>(gruppe: Parameters<typeof option>[0], list: O[]): O[] {
  return list.map((o) => ({ ...o, ...option(gruppe, o) }));
}

// ---------------------------------------------------------------- Bausteine

/** Eine Antwort aus mehreren (nochmal antippen hebt die Wahl auf). */
function Choice<T extends string | number>({ options, value, onChange, label }: { options: { id: T; label: string; hinweis?: string }[]; value: T | null; onChange: (v: T | null) => void; label: string }) {
  return (
    <div className="survey-options" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} className="survey-option" onClick={() => onChange(value === o.id ? null : o.id)}>
          <span className="survey-option__mark" aria-hidden="true" />
          <span>
            {o.label}
            {o.hinweis && <small>{o.hinweis}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Mehrere Antworten als große Zeilen. */
function MultiChoice({ options, values, onChange, label }: { options: UmfrageOption[]; values: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="survey-options" role="group" aria-label={label}>
      {options.map((o) => {
        const on = values.includes(o.id);
        return (
          <button key={o.id} type="button" role="checkbox" aria-checked={on} className="survey-option survey-option--multi" onClick={() => onChange(on ? values.filter((x) => x !== o.id) : [...values, o.id])}>
            <span className="survey-option__mark" aria-hidden="true" />
            <span>
              {o.label}
              {o.hinweis && <small>{o.hinweis}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Eingabefeld für eigene Einträge (Enter oder Knopf). */
function AddField({ placeholder, onAdd, label }: { placeholder: string; onAdd: (text: string) => boolean; label: string }) {
  const [text, setText] = useState('');
  const id = useId();
  return (
    <form
      className="survey-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && onAdd(text.trim())) setText('');
      }}
    >
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={120} enterKeyHint="done" />
      <button type="submit" className="btn btn--small" disabled={!text.trim()}>
        <IconPlus width={18} height={18} /> {t.add}
      </button>
    </form>
  );
}

/** Vorschläge zum Antippen plus eigene Einträge. Gespeichert wird die deutsche Bezeichnung aus dem Katalog. */
function ChipPicker({
  gruppen,
  value,
  onChange,
  eigenPlaceholder,
  eigenLabel,
}: {
  gruppen: { titel?: string; vorschlaege: KatalogEintrag[] }[];
  value: Auswahl[];
  onChange: (v: Auswahl[]) => void;
  eigenPlaceholder: string;
  eigenLabel: string;
}) {
  const ids = new Set(value.map((v) => v.id));
  const toggle = (k: KatalogEintrag) => onChange(ids.has(k.id) ? value.filter((v) => v.id !== k.id) : [...value, { id: k.id, label: k.label, herzen: 2 }]);
  const eigene = value.filter((v) => v.id.startsWith('eigen:'));
  return (
    <>
      {gruppen.map((g, i) => (
        <div key={g.titel ?? i}>
          {g.titel && <h3 className="survey-group">{gruppeTitel(g.titel)}</h3>}
          <div className="chips survey-chips">
            {g.vorschlaege.map((k) => {
              const txt = katalogEintrag(k);
              return (
                <button key={k.id} type="button" className="chip" aria-pressed={ids.has(k.id)} onClick={() => toggle(k)}>
                  <span>
                    {txt.label}
                    {txt.hinweis && <small> {txt.hinweis}</small>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <h3 className="survey-group">{eigenLabel}</h3>
      {eigene.length > 0 && (
        <div className="chips survey-chips" style={{ marginBottom: 6 }}>
          {eigene.map((e) => (
            <span key={e.id} className="chip chip--primary chip--removable">
              {e.label}
              {e.begriffe && e.begriffe.length > 1 && <small> ({e.begriffe.slice(1).join(', ')})</small>}
              <button type="button" onClick={() => onChange(value.filter((v) => v.id !== e.id))} aria-label={t.remove(e.label)}>
                <IconX width={14} height={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <AddField
        label={eigenLabel}
        placeholder={eigenPlaceholder}
        onAdd={(text) => {
          const e = eigeneAuswahl(text);
          if (!e) return false;
          if (!ids.has(e.id)) onChange([...value, e]);
          return true;
        }}
      />
    </>
  );
}

/** Große Zeile zum Antippen; gewählt erscheinen darunter die Herzchen. */
function ToggleRow({ label, hinweis, herzen, onToggle, onHearts }: { label: string; hinweis?: string; herzen: HeartCount | null; onToggle: () => void; onHearts: (h: HeartCount) => void }) {
  return (
    <div className={`survey-kind${herzen ? ' survey-kind--on' : ''}`}>
      <button type="button" role="checkbox" aria-checked={!!herzen} className="survey-option survey-option--multi" onClick={onToggle}>
        <span className="survey-option__mark" aria-hidden="true" />
        <span>
          {label}
          {hinweis && <small>{hinweis}</small>}
        </span>
      </button>
      {herzen && (
        <div className="survey-kind__hearts">
          <span>{t.howImportant}</span>
          <Hearts value={herzen} onChange={onHearts} label={t.importanceOf(label)} />
        </div>
      )}
    </div>
  );
}

/** Gewählte Einträge mit Herzchen (Katalog-Einträge übersetzt, eigene wie getippt). */
function RateList({ items, onHearts, onRemove, empty }: { items: Auswahl[]; onHearts: (id: string, h: HeartCount) => void; onRemove?: (id: string) => void; empty: string }) {
  if (items.length === 0) return <p className="notice">{empty}</p>;
  return (
    <ul className="survey-rate">
      {items.map((it) => {
        const label = katalogEintrag(it).label;
        return (
          <li key={it.id}>
            <span className="survey-rate__label">{label}</span>
            <Hearts value={it.herzen} onChange={(h) => onHearts(it.id, h)} label={t.importanceOf(label)} />
            {onRemove && (
              <button type="button" className="icon-btn" onClick={() => onRemove(it.id)} aria-label={t.remove(label)}>
                <IconX width={18} height={18} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Question({ children }: { children: ReactNode }) {
  return <h3 className="survey-q">{children}</h3>;
}

/** Freie Liste von Wörtern (Interessen): Vorschläge (deutsch gespeichert) plus eigene. */
function WordPicker({ vorschlaege, value, onChange }: { vorschlaege: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const eigene = value.filter((v) => !vorschlaege.includes(v));
  return (
    <>
      <div className="chips survey-chips">
        {vorschlaege.map((w) => (
          <button key={w} type="button" className="chip" aria-pressed={value.includes(w)} onClick={() => onChange(value.includes(w) ? value.filter((x) => x !== w) : [...value, w])}>
            {interesseLabel(w)}
          </button>
        ))}
        {eigene.map((w) => (
          <span key={w} className="chip chip--primary chip--removable">
            {w}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== w))} aria-label={t.remove(w)}>
              <IconX width={14} height={14} />
            </button>
          </span>
        ))}
      </div>
      <h3 className="survey-group">{t.otherInterest}</h3>
      <AddField
        label={t.ownInterest}
        placeholder={t.ownInterestPh}
        onAdd={(text) => {
          const w = text.trim().slice(0, 80);
          if (!w) return false;
          if (!value.some((x) => normalizeText(x) === normalizeText(w))) onChange([...value, w]);
          return true;
        }}
      />
    </>
  );
}

/** Städte und Einrichtungen aus dem Register suchen und antippen. */
function PlacePicker({ value, onChange }: { value: UmfrageOrt[]; onChange: (v: UmfrageOrt[]) => void }) {
  const s = useAppState();
  const [q, setQ] = useState('');
  const has = (kind: UmfrageOrt['kind'], ref: string) => value.some((o) => o.kind === kind && o.ref === ref);
  const toggle = (o: UmfrageOrt) => onChange(has(o.kind, o.ref) ? value.filter((x) => !(x.kind === o.kind && x.ref === o.ref)) : [...value, o]);
  const hits = useMemo(() => {
    const n = normalizeText(q);
    if (n.length < 2) return { cities: [], insts: [] };
    const cities = [...s.cities.values()].filter((c) => normalizeText(c.name).includes(n)).slice(0, 6);
    const insts = [...s.institutions.values()].filter((i) => normalizeText(`${i.name} ${i.shortName ?? ''} ${s.cities.get(i.cityId ?? '')?.name ?? ''}`).includes(n)).slice(0, 10);
    return { cities, insts };
  }, [q, s.cities, s.institutions]);
  return (
    <>
      {value.length > 0 && (
        <div className="chips survey-chips" style={{ marginBottom: 10 }}>
          {value.map((o) => (
            <span key={`${o.kind}:${o.ref}`} className="chip chip--primary chip--removable">
              <IconHeart filled width={14} height={14} /> {o.label}
              <button type="button" onClick={() => toggle(o)} aria-label={t.remove(o.label)}>
                <IconX width={14} height={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <label className="search" style={{ display: 'block' }}>
        <span className="visually-hidden">{t.placeSearch}</span>
        <IconSearch />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.placePh} />
      </label>
      {q.trim().length >= 2 && hits.cities.length === 0 && hits.insts.length === 0 && <p className="hint">{t.placeNone}</p>}
      {(hits.cities.length > 0 || hits.insts.length > 0) && (
        <ul className="list">
          {hits.cities.map((c) => {
            const on = has('city', c.id);
            return (
              <li key={`c${c.id}`} className="pick">
                <button type="button" className="pick__btn" aria-pressed={on} onClick={() => toggle({ kind: 'city', ref: c.id, label: c.name })}>
                  <IconHeart filled={on} width={20} height={20} style={{ color: on ? 'var(--primary-strong)' : 'var(--text-subtle)' }} />
                  <span>
                    {c.name}{' '}
                    <small>
                      {t.city}, {stateName(c.state)}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
          {hits.insts.map((i) => {
            const on = has('institution', i.id);
            return (
              <li key={`i${i.id}`} className="pick">
                <button type="button" className="pick__btn" aria-pressed={on} onClick={() => toggle({ kind: 'institution', ref: i.id, label: i.name })}>
                  <IconHeart filled={on} width={20} height={20} style={{ color: on ? 'var(--primary-strong)' : 'var(--text-subtle)' }} />
                  <span>
                    {i.name}{' '}
                    <small>
                      {institutionKindLabel(i.kind)}
                      {i.cityId ? `, ${s.cities.get(i.cityId)?.name ?? ''}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Seiten

interface Seite {
  teil: number;
  /** Texte als Funktion, damit sie beim Zeichnen in der aktuellen Sprache geholt werden. */
  titel: () => string;
  sub?: () => string;
  inhalt: (a: UmfrageAntworten, set: Set_) => ReactNode;
}

const mapHearts = (list: Auswahl[], id: string, h: HeartCount) => list.map((x) => (x.id === id ? { ...x, herzen: h } : x));
const BRUECKEN = starterHorizont().bruecken.map((b) => ({ id: b.id, name: b.name, hinweis: BRUECKEN_HINWEISE[b.id] }));
const brueckenOptionen = (): UmfrageOption[] => BRUECKEN.map((b) => ({ id: b.id, ...brueckeText(b.id, b.name, b.hinweis) }));
const UNBEFRISTET_IDS = [0, 1, 2, 3] as const;
const SPRACHEN_IDS = ['de', 'en', 'egal'] as const;
const GEWICHT_IDS: (keyof UmfrageAntworten['gewichte'])[] = ['thema', 'stelle', 'methoden', 'rahmen'];

const SEITEN: Seite[] = [
  {
    teil: 0,
    titel: () => t.name.titel,
    sub: () => t.name.sub,
    inhalt: (a, set) => (
      <>
        <label className="field">
          <span>{t.name.firstName}</span>
          <input className="input" value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder={t.name.firstName} maxLength={80} autoComplete="given-name" />
        </label>
        <Question>{t.name.stand}</Question>
        <Choice label={t.name.stand} options={opts('stand', STAND_OPTIONEN)} value={a.stand} onChange={(v) => set({ stand: v })} />
      </>
    ),
  },
  {
    teil: 0,
    titel: () => t.studium.titel,
    sub: () => t.studium.sub,
    inhalt: (a, set) => (
      <>
        <label className="field">
          <span>{t.studium.degree}</span>
          <input className="input" value={a.abschluss} onChange={(e) => set({ abschluss: e.target.value })} placeholder={t.studium.degreePh} maxLength={160} />
        </label>
        <div className="chips survey-chips">
          {ABSCHLUSS_VORSCHLAEGE.map((v) => {
            // Freitext: eingesetzt wird der angezeigte (übersetzte) Text
            const text = abschlussLabel(v);
            const on = a.abschluss === text || a.abschluss === v;
            return (
              <button key={v} type="button" className="chip" aria-pressed={on} onClick={() => set({ abschluss: on ? '' : text })}>
                {text}
              </button>
            );
          })}
        </div>
        <label className="field" style={{ marginTop: 18 }}>
          <span>{t.studium.thesis}</span>
          <textarea className="input survey-text" rows={3} value={a.abschlussarbeit} onChange={(e) => set({ abschlussarbeit: e.target.value })} placeholder={t.studium.thesisPh} maxLength={400} />
        </label>
      </>
    ),
  },
  {
    teil: 0,
    titel: () => t.start.titel,
    inhalt: (a, set) => <Choice label={t.start.titel} options={opts('beginn', START_OPTIONEN)} value={a.start} onChange={(v) => set({ start: v })} />,
  },
  {
    teil: 1,
    titel: () => t.fach.titel,
    sub: () => t.fach.sub,
    inhalt: (a, set) => <ChipPicker gruppen={[{ vorschlaege: FACHGEBIETE }]} value={a.fachgebiete} onChange={(v) => set({ fachgebiete: v })} eigenLabel={t.fach.ownLabel} eigenPlaceholder={t.fach.ownPh} />,
  },
  {
    teil: 1,
    titel: () => t.themen.titel,
    sub: () => t.themen.sub,
    inhalt: (a, set) => <ChipPicker gruppen={[{ vorschlaege: THEMEN }]} value={a.themen} onChange={(v) => set({ themen: v })} eigenLabel={t.themen.ownLabel} eigenPlaceholder={t.themen.ownPh} />,
  },
  {
    teil: 1,
    titel: () => t.themenRate.titel,
    sub: () => `${t.heartHelp} ${t.themenRate.sub}`,
    inhalt: (a, set) => (
      <RateList
        items={[...a.fachgebiete, ...a.themen]}
        empty={t.themenRate.empty}
        onHearts={(id, h) => set({ fachgebiete: mapHearts(a.fachgebiete, id, h), themen: mapHearts(a.themen, id, h) })}
        onRemove={(id) => set({ fachgebiete: a.fachgebiete.filter((x) => x.id !== id), themen: a.themen.filter((x) => x.id !== id) })}
      />
    ),
  },
  {
    teil: 2,
    titel: () => t.art.titel,
    sub: () => `${t.art.sub} ${t.heartHelp}`,
    inhalt: (a, set) => (
      <div className="survey-options">
        {STELLENART_OPTIONEN.map((o) => {
          const sel = a.stellenarten.find((x) => x.art === o.art);
          const txt = stellenartOption(o);
          return (
            <ToggleRow
              key={o.art}
              label={txt.label}
              hinweis={txt.hinweis}
              herzen={sel?.herzen ?? null}
              onToggle={() => set({ stellenarten: sel ? a.stellenarten.filter((x) => x.art !== o.art) : [...a.stellenarten, { art: o.art, herzen: 2 }] })}
              onHearts={(h) => set({ stellenarten: a.stellenarten.map((x) => (x.art === o.art ? { ...x, herzen: h } : x)) })}
            />
          );
        })}
      </div>
    ),
  },
  {
    teil: 2,
    titel: () => t.einrichtung.titel,
    sub: () => t.einrichtung.sub,
    inhalt: (a, set) => <MultiChoice label={t.einrichtung.titel} options={opts('einrichtung', EINRICHTUNG_OPTIONEN)} values={a.einrichtungen} onChange={(v) => set({ einrichtungen: v })} />,
  },
  {
    teil: 2,
    titel: () => t.nicht.titel,
    sub: () => t.nicht.sub,
    inhalt: (a, set) => (
      <>
        <ChipPicker gruppen={[{ vorschlaege: LIEBER_NICHT }]} value={a.lieberNicht} onChange={(v) => set({ lieberNicht: v })} eigenLabel={t.anythingElse} eigenPlaceholder={t.nicht.ownPh} />
        {a.lieberNicht.length > 0 && (
          <>
            <Question>{t.nicht.howFar}</Question>
            <p className="hint" style={{ marginTop: -2 }}>
              {t.nicht.howFarHint}
            </p>
            <RateList items={a.lieberNicht} empty="" onHearts={(id, h) => set({ lieberNicht: mapHearts(a.lieberNicht, id, h) })} />
          </>
        )}
      </>
    ),
  },
  {
    teil: 3,
    titel: () => t.geld.titel,
    sub: () => t.geld.sub,
    inhalt: (a, set) => (
      <>
        <Question>{t.geld.payMin}</Question>
        <div className="chips survey-chips" role="radiogroup" aria-label={t.geld.payMin}>
          <button type="button" className="chip" role="radio" aria-checked={a.entgelt.min == null} aria-pressed={a.entgelt.min == null} onClick={() => set({ entgelt: { ...a.entgelt, min: null } })}>
            {t.geld.any}
          </button>
          {ENTGELT_STUFEN.map((e) => (
            <button key={e} type="button" className="chip" role="radio" aria-checked={a.entgelt.min === e} aria-pressed={a.entgelt.min === e} onClick={() => set({ entgelt: { ...a.entgelt, min: e } })}>
              E {e}
            </button>
          ))}
        </div>
        <p className="hint">{t.geld.payHint}</p>
        {a.entgelt.min != null && (
          <div className="survey-inline-hearts">
            <span>{t.howImportant}</span>
            <Hearts value={a.entgelt.herzen} onChange={(h) => set({ entgelt: { ...a.entgelt, herzen: h } })} label={t.geld.payImportance} />
          </div>
        )}
        <Question>{t.geld.hoursMin}</Question>
        <div className="chips survey-chips" role="radiogroup" aria-label={t.geld.hoursMin}>
          <button type="button" className="chip" role="radio" aria-checked={a.umfang.min == null} aria-pressed={a.umfang.min == null} onClick={() => set({ umfang: { ...a.umfang, min: null } })}>
            {t.geld.any}
          </button>
          {UMFANG_STUFEN.map((u) => (
            <button key={u} type="button" className="chip" role="radio" aria-checked={a.umfang.min === u} aria-pressed={a.umfang.min === u} onClick={() => set({ umfang: { ...a.umfang, min: u } })}>
              {u === 100 ? t.geld.fullTime : fmtPct(u)}
            </button>
          ))}
        </div>
        <p className="hint">{t.geld.hoursHint}</p>
        {a.umfang.min != null && (
          <div className="survey-inline-hearts">
            <span>{t.howImportant}</span>
            <Hearts value={a.umfang.herzen} onChange={(h) => set({ umfang: { ...a.umfang, herzen: h } })} label={t.geld.hoursImportance} />
          </div>
        )}
      </>
    ),
  },
  {
    teil: 3,
    titel: () => t.befristung.titel,
    inhalt: (a, set) => (
      <>
        <Question>{t.befristung.permQ}</Question>
        <p className="hint" style={{ marginTop: -2, marginBottom: 8 }}>
          {t.befristung.permHint}
        </p>
        <Choice label={t.befristung.permQ} options={UNBEFRISTET_IDS.map((id) => ({ id, label: t.befristung.perm[id] }))} value={a.unbefristet} onChange={(v) => set({ unbefristet: v })} />
        <Question>{t.befristung.langQ}</Question>
        <Choice label={t.befristung.langQ} options={SPRACHEN_IDS.map((id) => ({ id, label: t.befristung.langs[id] }))} value={a.sprache} onChange={(v) => set({ sprache: v })} />
      </>
    ),
  },
  {
    teil: 3,
    titel: () => t.arbeitsweise.titel,
    sub: () => t.arbeitsweise.sub,
    inhalt: (a, set) => (
      <>
        <div className="survey-options">
          {ARBEITSWEISE.map((k) => {
            const sel = a.arbeitsweise.find((x) => x.id === k.id);
            const txt = katalogEintrag(k);
            return (
              <ToggleRow
                key={k.id}
                label={txt.label}
                hinweis={txt.hinweis}
                herzen={sel?.herzen ?? null}
                onToggle={() => set({ arbeitsweise: sel ? a.arbeitsweise.filter((x) => x.id !== k.id) : [...a.arbeitsweise, { id: k.id, label: k.label, herzen: 2 }] })}
                onHearts={(h) => set({ arbeitsweise: mapHearts(a.arbeitsweise, k.id, h) })}
              />
            );
          })}
        </div>
        <Question>{t.arbeitsweise.travel}</Question>
        <Choice label={t.arbeitsweise.travel} options={opts('reisen', REISEN_OPTIONEN)} value={a.reisen} onChange={(v) => set({ reisen: v })} />
      </>
    ),
  },
  {
    teil: 4,
    titel: () => t.methoden.titel,
    sub: () => t.methoden.sub,
    inhalt: (a, set) => <ChipPicker gruppen={METHODEN_GRUPPEN} value={a.methoden} onChange={(v) => set({ methoden: v })} eigenLabel={t.anythingElse} eigenPlaceholder={t.methoden.ownPh} />,
  },
  {
    teil: 4,
    titel: () => t.methodenRate.titel,
    sub: () => t.heartHelp,
    inhalt: (a, set) => (
      <RateList
        items={a.methoden}
        empty={t.methodenRate.empty}
        onHearts={(id, h) => set({ methoden: mapHearts(a.methoden, id, h) })}
        onRemove={(id) => set({ methoden: a.methoden.filter((x) => x.id !== id) })}
      />
    ),
  },
  {
    teil: 5,
    titel: () => t.mobil.titel,
    inhalt: (a, set) => <Choice label={t.mobil.titel} options={opts('mobil', MOBIL_OPTIONEN)} value={a.mobil} onChange={(v) => set({ mobil: v })} />,
  },
  {
    teil: 5,
    titel: () => t.laender.titel,
    sub: () => t.laender.sub,
    inhalt: (a, set) => (
      <div className="chips survey-chips">
        {STATE_CODES.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={a.bundeslaender.includes(c)} onClick={() => set({ bundeslaender: a.bundeslaender.includes(c) ? a.bundeslaender.filter((x) => x !== c) : [...a.bundeslaender, c as StateCode] })}>
            {stateName(c)}
          </button>
        ))}
      </div>
    ),
  },
  {
    teil: 5,
    titel: () => t.orte.titel,
    sub: () => t.orte.sub,
    inhalt: (a, set) => <PlacePicker value={a.orte} onChange={(v) => set({ orte: v })} />,
  },
  {
    teil: 6,
    titel: () => t.bruecken.titel,
    sub: () => t.bruecken.sub,
    inhalt: (a, set) => <MultiChoice label={t.bruecken.label} options={brueckenOptionen()} values={a.bruecken} onChange={(v) => set({ bruecken: v })} />,
  },
  {
    teil: 6,
    titel: () => t.interessen.titel,
    sub: () => t.interessen.sub,
    inhalt: (a, set) => <WordPicker vorschlaege={INTERESSEN} value={a.interessen} onChange={(v) => set({ interessen: v })} />,
  },
  {
    teil: 6,
    titel: () => t.dosis.titel,
    inhalt: (a, set) => (
      <>
        <Choice label={t.dosis.label} options={opts('dosis', DOSIS_OPTIONEN)} value={a.dosis} onChange={(v) => set({ dosis: v })} />
        <label className="toggle" style={{ marginTop: 16 }}>
          <span>
            {t.dosis.weite}
            <br />
            <small className="hint">{t.dosis.weiteHint}</small>
          </span>
          <input type="checkbox" checked={a.weite} onChange={(e) => set({ weite: e.target.checked })} />
        </label>
      </>
    ),
  },
  {
    teil: 7,
    titel: () => t.gewichte.titel,
    sub: () => t.gewichte.sub,
    inhalt: (a, set) => (
      <ul className="survey-rate">
        {GEWICHT_IDS.map((id) => (
          <li key={id}>
            <span className="survey-rate__label">
              {categoryLabel(id)}
              <small>{t.gewichte.hints[id]}</small>
            </span>
            <Hearts value={a.gewichte[id]} onChange={(h) => set({ gewichte: { ...a.gewichte, [id]: h } })} label={t.gewichte.weightOf(categoryLabel(id))} />
          </li>
        ))}
      </ul>
    ),
  },
  {
    teil: 7,
    titel: () => t.traum.titel,
    sub: () => t.traum.sub,
    inhalt: (a, set) => (
      <>
        <label className="field">
          <span className="visually-hidden">{t.traum.label}</span>
          <textarea className="input survey-text" rows={5} value={a.traumstelle} onChange={(e) => set({ traumstelle: e.target.value })} placeholder={t.traum.ph} maxLength={2000} />
        </label>
        <Question>{t.traum.elseQ}</Question>
        <label className="field">
          <span className="visually-hidden">{t.traum.elseLabel}</span>
          <textarea className="input survey-text" rows={4} value={a.sonstiges} onChange={(e) => set({ sonstiges: e.target.value })} placeholder={t.traum.elsePh} maxLength={2000} />
        </label>
      </>
    ),
  },
];

const ERGEBNIS = SEITEN.length + 1;

// ---------------------------------------------------------------- Anfang und Ergebnis

function Intro({ stand, onStart, onReset }: { stand: UmfrageStand; onStart: (seite: number) => void; onReset: () => void }) {
  const weiter = stand.seite > 0 && !stand.uebernommen;
  return (
    <div className="index-card survey-intro">
      <span className="tape tape--tl" aria-hidden="true" />
      <p className="index-card__kicker">{t.intro.kicker}</p>
      <h2 className="index-card__title">{stand.uebernommen ? t.intro.titleDone : weiter ? t.intro.titleContinue : t.intro.titleNew}</h2>
      {stand.uebernommen ? (
        <p>{t.intro.applied(fmtDate(stand.uebernommen.slice(0, 10)))}</p>
      ) : (
        <ul className="survey-intro__list">
          <li>{t.intro.size(SEITEN.length, TEILE.length)}</li>
          <li>{t.intro.tap}</li>
          <li>{t.intro.saved}</li>
          <li>{t.intro.end}</li>
        </ul>
      )}
      <p className="hint">
        {t.intro.hearts} <Hearts value={3} /> {t.intro.core} <Hearts value={2} /> {t.intro.important} <Hearts value={1} /> {t.intro.nice}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
        {weiter ? (
          <>
            <button type="button" className="btn btn--primary" onClick={() => onStart(Math.min(stand.seite, ERGEBNIS))}>
              {stand.seite >= ERGEBNIS ? t.intro.continueResult : t.intro.continueAt(stand.seite)}
            </button>
            <button type="button" className="btn" onClick={() => onStart(1)}>
              {t.intro.fromStart}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => onStart(1)}>
            {stand.uebernommen ? t.intro.review : t.intro.start}
          </button>
        )}
        {stand.uebernommen && (
          <button type="button" className="btn" onClick={() => onStart(ERGEBNIS)}>
            {t.toResult}
          </button>
        )}
        {(weiter || stand.uebernommen) && (
          <button type="button" className="btn btn--quiet btn--small" onClick={onReset}>
            {t.intro.reset}
          </button>
        )}
      </div>
    </div>
  );
}

/** Name des neuen Suchprofils. Bleibt deutsch (wird gespeichert); die Anzeige übersetzt profileName() in i18n/katalog.ts. */
function profileName(a: UmfrageAntworten): string {
  return a.name.trim() ? `Profil von ${a.name.trim()}` : 'Aus der Umfrage';
}

function Ergebnis({ stand, onApply, onEdit }: { stand: UmfrageStand; onApply: (profile: Suchprofil, favs: { kind: 'state' | 'city' | 'institution'; ref: string }[]) => void; onEdit: () => void }) {
  const store = useStore();
  const views = useViews();
  const a = stand.antworten;
  const result = useMemo(() => {
    const r = importSteckbrief(umfrageZuSteckbrief(a));
    return 'error' in r ? r : { ...r, profile: { ...r.profile, name: profileName(a) } };
  }, [a]);
  // Bezeichnungen der Bundesländer und Arten werden erst beim Zeichnen geholt (Sprache)
  const favs = useMemo(
    () => [
      ...a.bundeslaender.map((c) => ({ key: `state:${c}`, kind: 'state' as const, ref: c as string, label: c as string })),
      ...a.orte.map((o) => ({ key: `${o.kind}:${o.ref}`, kind: o.kind, ref: o.ref, label: o.label })),
    ],
    [a],
  );
  const [skip, setSkip] = useState<Set<string>>(new Set());

  // Wie die offenen Anzeigen mit dem neuen Profil aussähen
  const preview = useMemo(() => {
    if ('error' in result) return null;
    const today = todayBerlin();
    const scored: { id: string; title: string; score: number }[] = [];
    for (const v of views.values()) {
      if (!isOpen(v.job, today)) continue;
      scored.push({ id: v.job.id, title: v.job.title, score: scoreJob(v.job, v.norm, result.profile).score });
    }
    scored.sort((x, y) => y.score - x.score);
    return { top: scored.slice(0, 3), high: scored.filter((x) => x.score >= 75).length, total: scored.length };
  }, [result, views]);

  if ('error' in result) {
    return (
      <p className="notice notice--warn" role="alert">
        {steckbriefMessage(result.error)}
      </p>
    );
  }
  return (
    <div className="import-preview" aria-live="polite">
      <ProfilePreview profile={result.profile} warnings={result.warnings} />

      {preview && preview.total > 0 && (
        <div className="preview" style={{ marginTop: 14 }}>
          <p className="preview__head">
            {t.result.top} <small>{t.result.count(preview.high, preview.total)}</small>
          </p>
          <ol>
            {preview.top.map((x) => (
              <li key={x.id}>
                <span className="mini-score" style={{ color: scoreTone(x.score) }}>
                  {x.score}
                  <small>%</small>
                </span>
                <button type="button" className="linkish" onClick={() => openJob(x.id)}>
                  {x.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {favs.length > 0 && (
        <>
          <h3 className="section-title">{t.result.favs}</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            {t.result.favsHint}
          </p>
          {favs.map((f) => (
            <label key={f.key} className="toggle">
              <span>
                {f.kind === 'state' ? stateName(f.ref as StateCode) : f.label} <small className="hint">{t.result.kinds[f.kind]}</small>
              </span>
              <input
                type="checkbox"
                checked={!skip.has(f.key)}
                onChange={(e) => {
                  const next = new Set(skip);
                  if (e.target.checked) next.delete(f.key);
                  else next.add(f.key);
                  setSkip(next);
                }}
              />
            </label>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <button type="button" className="btn btn--primary" onClick={() => onApply(result.profile, favs.filter((f) => !skip.has(f.key)))}>
          {stand.uebernommen ? t.result.applyAgain : t.result.apply}
        </button>
        <button type="button" className="btn" onClick={onEdit}>
          {t.result.edit}
        </button>
        <button
          type="button"
          className="btn btn--quiet btn--small"
          onClick={() => {
            // Der kopierte Text bleibt deutsch (zum Weitergeben an Claude)
            navigator.clipboard
              ?.writeText(umfrageAlsText(stand))
              .then(() => store.toast(t.result.copied))
              .catch(() => store.toast(t.result.copyFailed));
          }}
        >
          {t.result.copy}
        </button>
      </div>
      <p className="hint">{t.result.replaceHint}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Seite

export function UmfragePage() {
  const s = useAppState();
  const store = useStore();
  const [stand, setStand] = useState<UmfrageStand>(() => s.settings.umfrage ?? neueUmfrage());
  const seite = Math.min(Math.max(stand.seite, 0), ERGEBNIS);
  const screen = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Speichern: kurz nach der letzten Änderung; sofort, wenn die Seite verlassen, die App geschlossen oder
  // in den Hintergrund geschickt wird. Gespeichert wird zuerst auf dem Gerät (Warteschlange), dann auf dem Server.
  const dirty = useRef(false);
  const touched = useRef(false);
  const latest = useRef(stand);
  latest.current = stand;
  useEffect(() => {
    if (!dirty.current) return;
    const timer = window.setTimeout(() => {
      dirty.current = false;
      store.updateSettings('umfrage', latest.current);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [stand, store]);
  useEffect(() => {
    const save = () => {
      if (!dirty.current) return;
      dirty.current = false;
      store.updateSettings('umfrage', latest.current);
    };
    // Zurück in der App: den Stand vom Server holen, falls inzwischen auf einem anderen Gerät weitergemacht wurde
    const onVisibility = () => (document.visibilityState === 'hidden' ? save() : void store.refresh());
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onVisibility);
    void store.refresh();
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVisibility);
      save();
    };
  }, [store]);

  // Neuerer Stand aus dem Abgleich (anderes Gerät): übernehmen, solange hier nichts ungespeichert ist.
  // Hat man hier noch nichts angetippt, gilt der Stand vom Server auch dann, wenn er älter ist.
  const incoming = s.settings.umfrage;
  useEffect(() => {
    if (!incoming || dirty.current) return;
    const cur = latest.current;
    if (incoming.geaendert === cur.geaendert) return;
    if (touched.current && incoming.geaendert < cur.geaendert) return;
    setStand(incoming);
  }, [incoming]);

  const update = (fn: (s: UmfrageStand) => UmfrageStand) => {
    dirty.current = true;
    touched.current = true;
    setStand((prev) => ({ ...fn(prev), geaendert: new Date().toISOString() }));
  };
  const set: Set_ = (patch) => update((st) => ({ ...st, antworten: { ...st.antworten, ...patch } }));
  const goto = (n: number) => {
    update((st) => ({ ...st, seite: n }));
  };

  // Neue Seite: nach oben und Überschrift ansagen
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    screen.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [seite]);

  const apply = async (profile: Suchprofil, favs: { kind: 'state' | 'city' | 'institution'; ref: string }[]) => {
    const prev = s.settings.profile;
    const now = new Date().toISOString();
    const applied = { ...profile, updatedAt: now };
    store.updateSettings('profile', applied);
    let n = 0;
    for (const f of favs) {
      if (!store.isFavorite(f.kind, f.ref)) {
        store.setFavorite(f.kind, f.ref, true);
        n++;
      }
    }
    // Beim nächsten Öffnen wieder am Anfang („Deine Antworten“)
    const done = { ...latest.current, seite: 0, uebernommen: now, geaendert: now };
    dirty.current = false;
    setStand(done);
    store.updateSettings('umfrage', done);
    navigate('/ich');
    // Der große Durchlauf startet gleich mit, ohne eigenen Freigabe-Schritt, wenn der Worker ihn anstoßen kann.
    // Sonst bleibt der Kasten „Profil prüfen und freigeben“ unter „Ich“ zuständig.
    if (!s.demo && s.ingestTrigger) {
      try {
        await store.api.triggerIngest(true);
        store.updateSettings('freigabe', freigeben(applied, s.settings.freigabe));
        store.toast(t.page.appliedAndRun(n), undefined, 10_000);
        return;
      } catch (e) {
        store.toast(e instanceof Error ? e.message : String(e));
      }
    }
    store.toast(t.page.applied(n), { label: t.page.undoProfile, run: () => store.updateSettings('profile', prev) }, 8000);
  };

  const reset = () => {
    const prev = latest.current;
    dirty.current = false;
    const fresh = neueUmfrage();
    setStand(fresh);
    store.updateSettings('umfrage', null);
    store.toast(t.page.deleted, {
      label: t.page.undo,
      run: () => {
        setStand(prev);
        store.updateSettings('umfrage', prev);
      },
    });
  };

  const page = seite >= 1 && seite <= SEITEN.length ? SEITEN[seite - 1] : null;
  const teil = page ? page.teil : seite === ERGEBNIS ? TEILE.length : -1;
  const pct = seite === 0 ? 0 : Math.round((Math.min(seite, SEITEN.length + 1) / (SEITEN.length + 1)) * 100);

  return (
    <section ref={screen} className="screen paper" aria-labelledby="survey-title">
      <button type="button" className="back-link" onClick={() => navigate('/ich')}>
        <IconChevron width={18} height={18} style={{ transform: 'rotate(180deg)' }} /> {seite > 0 && seite < ERGEBNIS ? t.page.later : t.page.me}
      </button>

      {seite > 0 && (
        <div className="survey-head">
          <div className="survey-head__meta">
            <span>{teil < TEILE.length ? t.page.part(teil + 1, TEILE.length, t.teile[TEILE[teil]]) : t.page.done}</span>
            <span>{seite <= SEITEN.length ? t.page.pageOf(seite, SEITEN.length) : ''}</span>
          </div>
          <div className="check-progress" role="progressbar" aria-label={t.page.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="survey-saved">{s.pending > 0 && (s.sync.error || !navigator.onLine) ? t.page.savedLocal : t.page.saved}</p>
        </div>
      )}

      {seite === 0 && (
        <>
          <div className="page-head">
            <div>
              <h1 id="survey-title" ref={heading} tabIndex={-1} className="page-title">
                {t.page.title}
              </h1>
              <p className="page-sub">{t.page.sub}</p>
            </div>
          </div>
          <Intro stand={stand} onStart={goto} onReset={reset} />
        </>
      )}

      {page && (
        <>
          <h1 id="survey-title" ref={heading} tabIndex={-1} className="survey-title">
            {page.titel()}
          </h1>
          {page.sub && <p className="survey-sub">{page.sub()}</p>}
          <div className="survey-body">{page.inhalt(stand.antworten, set)}</div>
          <div className="survey-nav">
            <button type="button" className="btn" onClick={() => goto(seite - 1)} aria-label={t.page.back}>
              <IconChevron width={18} height={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button type="button" className="btn btn--primary survey-nav__next" onClick={() => goto(seite + 1)}>
              {seite === SEITEN.length ? t.toResult : t.page.next} <IconChevron width={18} height={18} />
            </button>
          </div>
        </>
      )}

      {seite === ERGEBNIS && (
        <>
          <h1 id="survey-title" ref={heading} tabIndex={-1} className="survey-title">
            {t.page.doneTitle}
          </h1>
          <p className="survey-sub">{t.page.doneSub}</p>
          <Ergebnis stand={stand} onApply={(p, f) => void apply(p, f)} onEdit={() => goto(1)} />
        </>
      )}
    </section>
  );
}
