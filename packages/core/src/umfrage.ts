// Umfrage für das Suchprofil: Die App fragt selbst, Seite für Seite, mit Vorschlägen zum Antippen.
//
// Die Antworten werden zu einem Steckbrief im Entwurfsformat (steckbrief.ts) und darüber zum Suchprofil.
// Gespeichert bleiben alle Antworten als Einstellung "umfrage", auch die, die (noch) nicht in den Score
// eingehen (Stand, Start, Einrichtungen, Traumstelle): Sie sind die Grundlage für den Feinschliff.
//
// Katalog-Einträge speichern nur ihre id; die Begriffe kommen beim Umwandeln aus dem Katalog. So wirken
// bessere Begriffe hier auch auf ältere Antworten. Eigene Einträge speichern ihre Begriffe selbst.

import { z } from 'zod';
import { starterHorizont, type Hearts, type HorizontDosis } from './profile';
import type { SteckbriefV0 } from './steckbrief';
import { JOB_KIND_LABELS, STATE_CODES, STATES, type JobKind, type StateCode } from './types';
import { normalizeText } from './text';

export interface KatalogEintrag {
  id: string;
  label: string;
  begriffe: string[];
  /** Kurze Erklärung unter dem Vorschlag. */
  hinweis?: string;
  /** Nur bei „Lieber nicht“: Stellenart statt Begriffen. */
  art?: JobKind;
}

export interface UmfrageOption {
  id: string;
  label: string;
  hinweis?: string;
}

// ---------------------------------------------------------------- Kataloge

/** Fachgebiete der Psychologie (Kategorie Thema). */
export const FACHGEBIETE: KatalogEintrag[] = [
  { id: 'f-psych', label: 'Psychologie allgemein', hinweis: 'alles mit Psychologie-Bezug', begriffe: ['*psycholog', 'psychology'] },
  { id: 'f-klin', label: 'Klinische Psychologie & Psychotherapie', begriffe: ['klinische psych', 'clinical psych', '*psychotherap', 'psychische erkrank', 'psychische störung', 'mental disorder', 'psychiatr'] },
  { id: 'f-kogn', label: 'Kognitive Psychologie', begriffe: ['kognit', 'cognit', 'kognitionspsych', 'kognitionswiss'] },
  { id: 'f-neuro', label: 'Neuropsychologie & Neurowissenschaft', begriffe: ['*neuropsych', '*neurowiss', 'neuroscien', 'neuroimaging', 'hirnforschung', 'gehirn', '"brain"'] },
  { id: 'f-bio', label: 'Biologische Psychologie', begriffe: ['biologische psych', 'biological psych', 'biopsych', 'psychophysiolog', 'psychoneuroendokrin', 'psychoneuroimmun'] },
  { id: 'f-allg', label: 'Allgemeine Psychologie', hinweis: 'Wahrnehmung, Gedächtnis, Lernen, Denken', begriffe: ['allgemeine psych', 'general psych', 'wahrnehmungspsych', 'visuelle wahrnehmung', 'perception', 'gedächtnis', 'aufmerksamkeit', 'lernpsych'] },
  { id: 'f-entw', label: 'Entwicklungspsychologie', begriffe: ['entwicklungspsych', 'developmental psych', 'developmental science', 'kindheit', 'jugendalter', 'lebensspanne', 'lifespan', 'child development'] },
  { id: 'f-paed', label: 'Pädagogische Psychologie & Bildung', begriffe: ['pädagogische psych', 'educational psych', '*bildungsforsch', 'lehr lern', 'lehrlern', 'learning sciences', 'unterrichtsforsch', 'schulpsych'] },
  { id: 'f-sozial', label: 'Sozialpsychologie', begriffe: ['sozialpsych', 'social psych', 'intergruppen', 'intergroup', 'vorurteil', 'prejudice'] },
  { id: 'f-pers', label: 'Persönlichkeitspsychologie', hinweis: 'auch Differentielle Psychologie', begriffe: ['persönlichkeitspsych', 'personality psych', 'personality research', 'differentielle psych', 'individual differences'] },
  { id: 'f-diag', label: 'Diagnostik & Psychometrie', begriffe: ['psychologische diagnostik', 'psychodiagnost', 'psychometr', 'testtheorie', 'testkonstruktion', 'testentwicklung', 'psychological assessment', 'methodenlehre'] },
  { id: 'f-ao', label: 'Arbeits- & Organisationspsychologie', begriffe: ['arbeitspsych', 'organisationspsych', 'arbeits und organisationspsych', 'work psych', 'organizational psych', 'organisational psych', 'industrial and organizational', 'personalpsych'] },
  { id: 'f-wirt', label: 'Wirtschaftspsychologie & Konsum', begriffe: ['wirtschaftspsych', 'konsumentenpsych', 'consumer psych', 'konsumverhalten', 'consumer behavio', 'marktforsch', 'market research'] },
  { id: 'f-gesund', label: 'Gesundheitspsychologie', begriffe: ['gesundheitspsych', 'health psych', 'gesundheitsverhalten', 'health behavio', 'verhaltensmedizin', 'behavioral medicine', 'behavioural medicine'] },
  { id: 'f-medien', label: 'Medienpsychologie', begriffe: ['medienpsych', 'media psych', 'medienwirkung', 'mediennutzung', 'media use'] },
  { id: 'f-ing', label: 'Ingenieurpsychologie & Human Factors', begriffe: ['ingenieurpsych', 'human factors', 'ergonomi', 'mensch maschine', 'mensch technik', 'human machine', 'mensch computer', 'human computer'] },
  { id: 'f-umwelt', label: 'Umweltpsychologie', begriffe: ['umweltpsych', 'environmental psych', 'klimapsych', 'nachhaltiges verhalten', 'pro environmental', 'proenvironmental'] },
  { id: 'f-verkehr', label: 'Verkehrspsychologie', begriffe: ['verkehrspsych', 'traffic psych', 'fahreignung', '"mpu"', 'verkehrssicherheit'] },
  { id: 'f-recht', label: 'Rechtspsychologie', begriffe: ['rechtspsych', 'forensische psych', 'forensic psych', 'aussagepsych', 'kriminalpsych', 'legal psych'] },
  { id: 'f-sport', label: 'Sportpsychologie', begriffe: ['sportpsych', 'sport psych', 'exercise psych'] },
  { id: 'f-geronto', label: 'Alternspsychologie', hinweis: 'Gerontopsychologie', begriffe: ['gerontopsych', 'gerontolog', 'alternsforsch', 'alternspsych', 'psychology of aging', '"aging"', '"ageing"'] },
];

/** Konkrete Forschungs- und Arbeitsthemen (Kategorie Thema). */
export const THEMEN: KatalogEintrag[] = [
  { id: 't-emo', label: 'Emotionen & Emotionsregulation', begriffe: ['emotionsregulation', 'emotion regulation', 'emotionsforsch', 'emotion research', 'affektiv', 'affective'] },
  { id: 't-stress', label: 'Stress & Resilienz', begriffe: ['stressforsch', 'stresserleben', 'stressreaktion', 'stressbewält', 'stress research', 'resilienz', 'resilience'] },
  { id: 't-angst', label: 'Angst & Depression', begriffe: ['angststör', 'angsterkrank', 'anxiety', 'depress'] },
  { id: 't-sucht', label: 'Sucht', begriffe: ['sucht', 'addiction', 'substanzkonsum', 'substance use', 'alkoholkonsum', 'abhängigkeitserkrank'] },
  { id: 't-trauma', label: 'Trauma', begriffe: ['traumafolge', 'traumatherap', 'traumatis', '"trauma"', '"ptbs"', '"ptsd"', 'posttraumat'] },
  { id: 't-psychose', label: 'Psychosen', begriffe: ['psychose', 'psychosis', 'psychotic', 'schizophren'] },
  { id: 't-ess', label: 'Essstörungen & Körperbild', begriffe: ['essstörung', 'eating disorder', 'körperbild', 'body image', 'anorex', 'bulim', 'adipositas'] },
  { id: 't-adhs', label: 'ADHS & Autismus', begriffe: ['"adhs"', '"adhd"', 'autismus', 'autism', 'autist', 'neurodivers'] },
  { id: 't-pt', label: 'Psychotherapieforschung', begriffe: ['psychotherapieforsch', 'psychotherapy research', 'therapieforsch', 'interventionsforsch', 'intervention research', 'internetbasierte intervention', 'digitale gesundheitsanwend'] },
  { id: 't-schlaf', label: 'Schlaf', begriffe: ['schlaf', 'sleep'] },
  { id: 't-schmerz', label: 'Schmerz & Körper', begriffe: ['schmerz', '"pain"', 'chronic pain', 'psychosomat', 'interozept', 'interocept', 'körperwahrnehmung'] },
  { id: 't-gedaecht', label: 'Gedächtnis & Lernen', begriffe: ['gedächtnis', 'memory', 'lernprozess', 'human learning'] },
  { id: 't-aufm', label: 'Aufmerksamkeit & Wahrnehmung', begriffe: ['aufmerksamkeit', 'visuelle wahrnehmung', 'auditive wahrnehmung', 'perception', 'blickbewegung', 'eye movement'] },
  { id: 't-entsch', label: 'Entscheiden & Urteilen', begriffe: ['entscheidungsverhalten', 'entscheidungsfindung', 'decision making', 'urteilsbildung', 'risikowahrnehmung', 'risk perception'] },
  { id: 't-motiv', label: 'Motivation & Selbstregulation', begriffe: ['motivationspsych', 'motivation research', 'selbstregulation', 'self regulation', 'selbstkontrolle', 'self control', 'zielverfolgung'] },
  { id: 't-sprache', label: 'Sprache', begriffe: ['psycholinguist', 'sprachverarbeitung', 'spracherwerb', 'language processing', 'language acquisition', 'sprachentwicklung'] },
  { id: 't-bez', label: 'Beziehungen & Einsamkeit', begriffe: ['paarbeziehung', 'soziale beziehungen', 'relationship', 'bindungsforsch', 'attachment', 'einsamkeit', 'loneliness'] },
  { id: 't-vorurteil', label: 'Vorurteile & Diversität', begriffe: ['vorurteil', 'prejudice', 'stereotyp', 'diskriminierungserfahr', 'diskriminierungsforsch', 'intergruppen', 'intergroup', 'rassismusforsch'] },
  { id: 't-selbst', label: 'Persönlichkeit & Selbstwert', begriffe: ['persönlichkeitsentwickl', 'persönlichkeitsmerkmal', 'personality', 'selbstwert', 'self esteem', 'big five'] },
  { id: 't-wohl', label: 'Wohlbefinden & Achtsamkeit', begriffe: ['wohlbefinden', 'well being', 'wellbeing', 'achtsamkeit', 'mindfulness', 'positive psych', 'lebenszufriedenheit'] },
  { id: 't-praev', label: 'Prävention & Gesundheitsförderung', begriffe: ['prävention', 'prevention', 'gesundheitsförderung', 'health promotion'] },
  { id: 't-kinder', label: 'Kinder, Jugendliche & Familie', begriffe: ['kinder und jugend', 'kindes und jugend', 'kindheit', 'kindesalter', 'jugendalter', 'adolescen', 'children', 'eltern kind', 'erziehungspsych', 'erziehungsverhalten', 'erziehungsberatung', 'parenting', 'familienpsych', 'familienforsch'] },
  { id: 't-schule', label: 'Schule & Unterricht', begriffe: ['schulpsych', 'schüler', 'unterrichtsforsch', 'unterrichtsqual', 'lehrkräft', 'lehrerbildung', 'classroom', 'school psych'] },
  { id: 't-alter', label: 'Altern & Demenz', begriffe: ['demenz', 'dementia', '"aging"', '"ageing"', 'gerontolog', 'alternsforsch', 'ältere menschen', 'older adults'] },
  { id: 't-arbeit', label: 'Arbeit, Führung & Teams', begriffe: ['führungsforsch', 'leadership', 'mitarbeiterführung', 'teamforsch', 'arbeitszufriedenheit', 'work engagement', 'burnout', 'arbeitsbelastung', 'psychische belastung'] },
  { id: 't-medien', label: 'Digitale Medien & Social Media', begriffe: ['social media', 'soziale medien', 'digitale medien', 'mediennutzung', 'smartphone', 'internetnutzung'] },
  { id: 't-ki', label: 'Mensch & Technik, KI', begriffe: ['künstliche intelligenz', 'künstlicher intelligenz', 'artificial intelligence', 'human ai', 'technikakzeptanz', 'mensch technik', 'mensch maschine', 'human computer', 'mensch computer'] },
  { id: 't-klima', label: 'Klima & Nachhaltigkeit', begriffe: ['klimawandel', 'klimaschutz', 'nachhaltigkeit', 'nachhaltiges verhalten', 'sustainab', 'umweltverhalten', 'pro environmental'] },
];

/** Methoden, Software und Erfahrungen (Kategorie Methoden & Können), nach Gruppen. */
export const METHODEN_GRUPPEN: { titel: string; vorschlaege: KatalogEintrag[] }[] = [
  {
    titel: 'Statistik & Software',
    vorschlaege: [
      { id: 'm-r', label: 'R', begriffe: ['"r"', 'rstudio'] },
      { id: 'm-spss', label: 'SPSS', begriffe: ['"spss"'] },
      { id: 'm-python', label: 'Python', begriffe: ['python'] },
      { id: 'm-matlab', label: 'MATLAB', begriffe: ['matlab'] },
      { id: 'm-mehrebenen', label: 'Mehrebenenmodelle', begriffe: ['mehrebenen', 'multilevel', 'mixed model', 'mixed effects', 'linear mixed', 'hierarchical linear'] },
      { id: 'm-sem', label: 'Strukturgleichungsmodelle', begriffe: ['strukturgleichung', 'structural equation', 'lavaan', 'mplus'] },
      { id: 'm-bayes', label: 'Bayes-Statistik', begriffe: ['bayes'] },
      { id: 'm-meta', label: 'Meta-Analysen & Reviews', begriffe: ['metaanaly', 'meta analy', 'systematic review', 'systematisches review', 'systematische übersicht'] },
      { id: 'm-ml', label: 'Machine Learning', begriffe: ['machine learning', 'maschinelles lernen', 'deep learning'] },
      { id: 'm-open', label: 'Open Science', begriffe: ['open science', 'präregistr', 'preregistr', 'replikation', 'replication', 'reproduzierbar', 'reproducib'] },
    ],
  },
  {
    titel: 'Studien & Erhebung',
    vorschlaege: [
      { id: 'm-exp', label: 'Experimente', begriffe: ['experiment', 'laborstud', 'laboratory stud'] },
      { id: 'm-frage', label: 'Fragebögen & Online-Studien', begriffe: ['fragebogen', 'questionnaire', 'befragung', 'survey', 'onlinestud', 'online stud', 'onlinebefragung', 'online befragung'] },
      { id: 'm-quali', label: 'Interviews & qualitative Methoden', begriffe: ['qualitative method', 'qualitativen method', 'qualitative forsch', 'qualitativer forsch', 'qualitative research', 'qualitative sozialforsch', 'qualitative interview', 'leitfadeninterview', 'leitfadengestützt', 'inhaltsanalyse', 'grounded theory', 'fokusgrupp', 'focus group'] },
      { id: 'm-ema', label: 'Längsschnitt & Tagebuchstudien', hinweis: 'auch Experience Sampling', begriffe: ['längsschnitt', 'longitudinal', 'ambulantes assessment', 'ambulatory assessment', 'experience sampling', '"esm"', 'ecological momentary', '"ema"', 'tagebuchstud', 'diary stud'] },
      { id: 'm-beob', label: 'Verhaltensbeobachtung', begriffe: ['verhaltensbeobachtung', 'behavioral observation', 'behavioural observation', 'videoanalyse', 'beobachtungsstud'] },
      { id: 'm-programm', label: 'Experimente programmieren', hinweis: 'PsychoPy, jsPsych, E-Prime …', begriffe: ['psychopy', 'jspsych', 'e prime', 'eprime', 'opensesame', 'psychtoolbox', 'presentation software'] },
      { id: 'm-tools', label: 'Umfrage-Werkzeuge', hinweis: 'SoSci Survey, Qualtrics, LimeSurvey', begriffe: ['soscisurvey', 'sosci survey', 'qualtrics', 'limesurvey', 'unipark'] },
    ],
  },
  {
    titel: 'Geräte & Messungen',
    vorschlaege: [
      { id: 'm-eeg', label: 'EEG', begriffe: ['"eeg"', 'elektroenzephalogra', 'electroencephalogra', 'ereigniskorrelierte potential', 'event related potential'] },
      { id: 'm-mrt', label: 'fMRT & Bildgebung', begriffe: ['"fmrt"', '"fmri"', '"mrt"', '"mri"', 'bildgebung', 'neuroimaging', 'magnetresonanz'] },
      { id: 'm-eye', label: 'Eye-Tracking', begriffe: ['eye tracking', 'eyetracking', 'blickbewegung'] },
      { id: 'm-phys', label: 'Physiologische Messungen', hinweis: 'Herzrate, Cortisol, Hautleitfähigkeit', begriffe: ['psychophysiolog', 'herzrate', 'heart rate', 'herzratenvariab', 'cortisol', 'hautleitfähigkeit', 'skin conductance', '"ekg"', '"ecg"'] },
      { id: 'm-tms', label: 'Hirnstimulation (TMS, tDCS)', begriffe: ['"tms"', 'tdcs', 'hirnstimulation', 'brain stimulation'] },
      { id: 'm-vr', label: 'Virtuelle Realität', begriffe: ['virtual reality', 'virtuelle realität', '"vr"', 'augmented reality'] },
    ],
  },
  {
    titel: 'Praxis & Vermitteln',
    vorschlaege: [
      { id: 'm-diag', label: 'Psychologische Diagnostik & Tests', begriffe: ['psychologische diagnostik', 'psychodiagnost', 'testdiagnost', 'testverfahren', 'neuropsychologische diagnostik', 'eignungsdiagnost', 'psychological assessment'] },
      { id: 'm-beratung', label: 'Beratung & Coaching', begriffe: ['beratung', 'coaching', 'counsel'] },
      { id: 'm-therapie', label: 'Psychotherapie', hinweis: 'Ausbildung, Weiterbildung oder Approbation', begriffe: ['*psychotherap', 'approbation'] },
      { id: 'm-gruppen', label: 'Gruppen & Workshops leiten', begriffe: ['gesprächsführung', 'gruppenleitung', 'gruppentraining', 'gruppenangebot', 'trainer', 'moderation', 'workshops durchf', 'workshops konzip', 'workshops leiten'] },
      { id: 'm-lehre', label: 'Lehre & Didaktik', begriffe: ['lehre', 'lehrveranstaltung', 'seminar', 'didaktik', 'teaching'] },
      { id: 'm-pm', label: 'Projektmanagement', begriffe: ['projektmanagement', 'project management', 'projektkoordination', 'projektleitung'] },
      { id: 'm-kommunikation', label: 'Wissenschaftskommunikation', begriffe: ['wissenschaftskommunikation', 'science communication', 'öffentlichkeitsarbeit', 'outreach'] },
      { id: 'm-schreiben', label: 'Schreiben & Publizieren', begriffe: ['publikation', 'publication', 'publizieren', 'drittmittelantr', 'grant writing', 'antragstellung'] },
    ],
  },
];

export const METHODEN: KatalogEintrag[] = METHODEN_GRUPPEN.flatMap((g) => g.vorschlaege);

/** „Lieber nicht“: Stellenarten und Inhalte, die nach unten rücken sollen. */
export const LIEBER_NICHT: KatalogEintrag[] = [
  { id: 'n-shk', label: 'Hilfskraft-Stellen', hinweis: 'studentisch oder wissenschaftlich, wenige Stunden', art: 'shk', begriffe: [] },
  { id: 'n-verw', label: 'Verwaltung & Technik', art: 'verwaltung', begriffe: [] },
  { id: 'n-lehre', label: 'Reine Lehrstellen', hinweis: 'z. B. Lehrkraft für besondere Aufgaben', art: 'lehre', begriffe: ['lehrkraft für besondere aufgaben', '"lfba"'] },
  { id: 'n-klinik', label: 'Klinik & Therapie', art: 'klinik', begriffe: [] },
  { id: 'n-projekt', label: 'Koordination ohne eigene Forschung', art: 'projekt', begriffe: [] },
  { id: 'n-tier', label: 'Tierversuche', begriffe: ['tierversuch', 'tierexperiment', 'animal research', 'animal experiment', 'versuchstier', 'nagetier', 'rodent', 'mäuse', '"mice"', 'primaten', 'primate'] },
  { id: 'n-schicht', label: 'Schicht- & Wochenenddienst', begriffe: ['schichtdienst', 'wechselschicht', 'nachtdienst', 'wochenenddienst', 'bereitschaftsdienst', 'shift work'] },
  { id: 'n-forensik', label: 'Maßregelvollzug & Justiz', begriffe: ['maßregelvollzug', 'justizvollzug', '"jva"', 'forensische klinik', 'forensische psychiatr'] },
  { id: 'n-vertrieb', label: 'Vertrieb & Verkauf', begriffe: ['vertrieb', '"sales"', 'kaltakquise', 'verkauf'] },
  { id: 'n-recruiting', label: 'Personalvermittlung', begriffe: ['personalvermittlung', 'personaldienstleist', 'arbeitnehmerüberlassung', 'zeitarbeit', 'headhunt'] },
  { id: 'n-call', label: 'Callcenter & Telefonumfragen', begriffe: ['callcenter', 'call center', 'telefoninterview', '"cati"'] },
  { id: 'n-erfassung', label: 'Reine Datenerfassung', begriffe: ['datenerfassung', 'dateneingabe', 'data entry'] },
  { id: 'n-militaer', label: 'Bundeswehr & Militär', begriffe: ['bundeswehr', 'militär', 'military', 'streitkräfte', '"defence"', '"defense"', 'rüstung'] },
];

/**
 * Arbeitsweise (Kategorie Rahmen): zählt nur, wenn die Anzeige es erwähnt; fehlt es, gibt es keinen Bonus.
 * Familienfreundlichkeit steht in fast jeder Anzeige im öffentlichen Dienst und unterscheidet darum kaum.
 */
export const ARBEITSWEISE: KatalogEintrag[] = [
  {
    id: 'w-home',
    label: 'Homeoffice',
    hinweis: 'mobiles Arbeiten, Telearbeit, remote',
    begriffe: ['homeoffice', 'home office', 'mobile arbeit', 'mobiles arbeit', 'mobilen arbeit', 'mobilem arbeit', 'mobiler arbeit', 'mobilarbeit', 'telearbeit', 'ortsunabhängig', 'remote work', 'remote arbeit', 'remote möglich', 'remote option', 'teilweise remote', 'hybrides arbeiten', 'hybride arbeit', 'hybrid work', 'work from home', 'working from home'],
  },
  {
    id: 'w-zeit',
    label: 'Flexible Arbeitszeiten',
    hinweis: 'Gleitzeit, Vertrauensarbeitszeit',
    begriffe: ['flexible arbeitszeit', 'flexiblen arbeitszeit', 'flexibler arbeitszeit', 'arbeitszeitflexib', 'gleitzeit', 'gleitende arbeitszeit', 'vertrauensarbeitszeit', 'flexible working', 'flexible hours', 'flexible work hours'],
  },
  {
    id: 'w-familie',
    label: 'Familienfreundlich',
    hinweis: 'steht in fast jeder Anzeige im öffentlichen Dienst und unterscheidet deshalb kaum',
    begriffe: ['familienfreundlich', 'familiengerecht', 'vereinbarkeit von familie', 'vereinbarkeit von beruf und familie', 'berufundfamilie', 'kinderbetreuung', 'eltern kind zimmer', 'family friendly', 'work life balance'],
  },
];

/** Viel Reisetätigkeit (wird zu „Lieber nicht“). */
export const REISEN: KatalogEintrag = {
  id: 'n-reisen',
  label: 'Viel Reisetätigkeit',
  begriffe: ['reisebereitschaft', 'reisetätigkeit', 'dienstreisetätigkeit', 'bereitschaft zu dienstreisen', 'bereitschaft zu reisen', 'bereitschaft zur reisetätigkeit', 'häufige dienstreisen', 'regelmäßige dienstreisen', 'außendienst', 'willingness to travel', 'travel required', 'frequent travel', 'extensive travel'],
};

export const REISEN_OPTIONEN: { id: 0 | 1 | 3; label: string; hinweis: string }[] = [
  { id: 0, label: 'Kein Problem', hinweis: 'gern auch mal unterwegs' },
  { id: 1, label: 'Ab und zu ist okay', hinweis: 'Stellen mit viel Reisen rutschen etwas nach unten' },
  { id: 3, label: 'Möglichst wenig', hinweis: 'Stellen mit viel Reisen rutschen deutlich nach unten' },
];

/** Interessen außerhalb der Psychologie (Horizont, Grundlage für KI-Vorschläge). */
export const INTERESSEN: string[] = [
  'Künstliche Intelligenz', 'Technik & Informatik', 'Medizin', 'Biologie', 'Klima & Nachhaltigkeit', 'Politik & Gesellschaft',
  'Bildung', 'Wirtschaft', 'Recht', 'Philosophie & Ethik', 'Sprachen & Literatur', 'Kunst & Kultur', 'Musik', 'Sport',
  'Design', 'Journalismus & Medien', 'Natur & Tiere', 'Reisen & andere Kulturen',
];

/** Kurze Beschreibungen der Start-Brücken (Horizont), damit man sie in der Umfrage auswählen kann. */
export const BRUECKEN_HINWEISE: Record<string, string> = {
  'h-ki': 'wie Menschen KI nutzen, ihr vertrauen und mit ihr arbeiten',
  'h-sec': 'Security Awareness, Phishing, sicheres Verhalten im Netz',
  'h-arbeit': 'Personalentwicklung, Arbeitsgestaltung, Eignungsdiagnostik',
  'h-gesund': 'Public Health, Prävention, Versorgungsforschung',
  'h-bildung': 'Didaktik, E-Learning, Lehrkräftebildung, Kompetenzmessung',
  'h-verkehr': 'Verkehrssicherheit, automatisiertes Fahren, Luftfahrt',
  'h-umwelt': 'Klimaschutz, Energiewende, nachhaltiges Verhalten',
  'h-daten': 'Umfrage- und Marktforschung, Evaluation, Data Science',
  'h-gesell': 'Sozialforschung, Migration, Politikberatung',
  'h-ux': 'User Research, Usability, Mensch-Computer-Interaktion',
};

export const STAND_OPTIONEN: UmfrageOption[] = [
  { id: 'bachelor', label: 'Im Bachelor' },
  { id: 'master', label: 'Im Master', hinweis: 'oder kurz vor dem Abschluss' },
  { id: 'master-fertig', label: 'Master oder Diplom fertig' },
  { id: 'promotion', label: 'Mitten in der Promotion' },
  { id: 'promoviert', label: 'Promoviert' },
  { id: 'beruf', label: 'Schon im Beruf', hinweis: 'und offen für etwas Neues' },
];

export const START_OPTIONEN: UmfrageOption[] = [
  { id: 'sofort', label: 'So bald wie möglich' },
  { id: '3m', label: 'In den nächsten drei Monaten' },
  { id: '6m', label: 'In drei bis sechs Monaten' },
  { id: 'spaeter', label: 'Später', hinweis: 'ich schaue mich erst einmal um' },
];

export const ABSCHLUSS_VORSCHLAEGE: string[] = ['Psychologie (M.Sc.)', 'Psychologie (B.Sc.)', 'Klinische Psychologie und Psychotherapie (M.Sc.)', 'Kognitive Neurowissenschaft (M.Sc.)', 'Wirtschaftspsychologie'];

export const MOBIL_OPTIONEN: UmfrageOption[] = [
  { id: 'pendeln', label: 'Nur in Pendelnähe', hinweis: 'ein Umzug kommt eher nicht infrage' },
  { id: 'region', label: 'Umzug innerhalb der Region' },
  { id: 'deutschland', label: 'Umzug überall in Deutschland' },
  { id: 'ausland', label: 'Auch ins Ausland' },
];

export const EINRICHTUNG_OPTIONEN: UmfrageOption[] = [
  { id: 'uni', label: 'Universität' },
  { id: 'hochschule', label: 'Hochschule (HAW)' },
  { id: 'institut', label: 'Forschungsinstitut', hinweis: 'Max-Planck, Leibniz, Fraunhofer, Helmholtz' },
  { id: 'klinik', label: 'Klinik oder Uniklinikum' },
  { id: 'behoerde', label: 'Behörde, öffentlicher Dienst' },
  { id: 'unternehmen', label: 'Unternehmen' },
  { id: 'verein', label: 'Verein, Stiftung, NGO' },
  { id: 'praxis', label: 'Praxis oder Beratungsstelle' },
];

/** Stellenarten in der Reihenfolge, in der die Umfrage sie zeigt, mit kurzer Erklärung. */
export const STELLENART_OPTIONEN: { art: JobKind; label: string; hinweis: string }[] = [
  { art: 'promotion', label: 'Promotion', hinweis: 'Doktorandenstelle, oft als Mitarbeit mit 50 bis 75 %' },
  { art: 'wiss_ma', label: 'Wissenschaftliche Mitarbeit', hinweis: 'Forschung und meist etwas Lehre, mit oder ohne Promotion' },
  { art: 'postdoc', label: 'Postdoc', hinweis: 'nach der Promotion' },
  { art: 'projekt', label: 'Projekt & Koordination', hinweis: 'Studien, Projekte oder Netzwerke koordinieren' },
  { art: 'lehre', label: 'Lehre', hinweis: 'Schwerpunkt Lehre, z. B. Lehrkraft oder Dozentur' },
  { art: 'klinik', label: 'Klinik & Therapie', hinweis: 'psychologische Arbeit in Klinik, Beratung oder Therapie' },
  { art: 'verwaltung', label: 'Verwaltung & Technik', hinweis: 'Wissenschaftsmanagement, Verwaltung, Technik' },
  { art: 'shk', label: 'Hilfskraft', hinweis: 'studentisch oder wissenschaftlich, wenige Stunden' },
  { art: 'professur', label: 'Professur', hinweis: 'auch Juniorprofessur' },
];

export const ENTGELT_STUFEN = [9, 10, 11, 12, 13, 14] as const;
export const UMFANG_STUFEN = [50, 65, 75, 100] as const;

export const DOSIS_OPTIONEN: { id: HorizontDosis; label: string; hinweis: string }[] = [
  { id: 'oft', label: 'Oft', hinweis: 'etwa jede zweite bis dritte Karte' },
  { id: 'normal', label: 'Ab und zu', hinweis: 'etwa jede dritte bis fünfte Karte' },
  { id: 'selten', label: 'Selten', hinweis: 'etwa jede sechste bis achte Karte' },
  { id: 'aus', label: 'Gar nicht', hinweis: 'nur Stellen mit Psychologie-Bezug' },
];

const KATALOG = new Map<string, KatalogEintrag>([...FACHGEBIETE, ...THEMEN, ...METHODEN, ...LIEBER_NICHT, ...ARBEITSWEISE, REISEN].map((v) => [v.id, v]));

export function vorschlag(id: string): KatalogEintrag | undefined {
  return KATALOG.get(id);
}

// ---------------------------------------------------------------- Antworten

/** Ein gewählter Eintrag: aus dem Katalog (nur id) oder selbst eingetragen (mit Begriffen). */
export interface Auswahl {
  id: string;
  label: string;
  herzen: Hearts;
  /** Nur bei eigenen Einträgen. */
  begriffe?: string[];
}

export interface UmfrageOrt {
  kind: 'city' | 'institution';
  ref: string;
  label: string;
}

export type Gewichte = { thema: Hearts; stelle: Hearts; methoden: Hearts; rahmen: Hearts };

export interface UmfrageAntworten {
  name: string;
  stand: string | null;
  abschluss: string;
  abschlussarbeit: string;
  start: string | null;
  fachgebiete: Auswahl[];
  themen: Auswahl[];
  stellenarten: { art: JobKind; herzen: Hearts }[];
  einrichtungen: string[];
  lieberNicht: Auswahl[];
  entgelt: { min: number | null; herzen: Hearts };
  umfang: { min: number | null; herzen: Hearts };
  /** 0 = befristet ist völlig in Ordnung */
  unbefristet: 0 | 1 | 2 | 3 | null;
  sprache: 'de' | 'en' | 'egal' | null;
  /** Homeoffice, flexible Arbeitszeiten, Familienfreundlichkeit (aus ARBEITSWEISE) */
  arbeitsweise: Auswahl[];
  /** Herzen für „Viel Reisetätigkeit“ unter „Lieber nicht“; 0 = Reisen ist kein Problem */
  reisen: 0 | 1 | 3 | null;
  methoden: Auswahl[];
  mobil: string | null;
  bundeslaender: StateCode[];
  orte: UmfrageOrt[];
  /** ids der Start-Brücken */
  bruecken: string[];
  interessen: string[];
  dosis: HorizontDosis | null;
  weite: boolean;
  gewichte: Gewichte;
  traumstelle: string;
  sonstiges: string;
}

export interface UmfrageStand {
  version: 1;
  /** Seite, auf der weitergemacht wird */
  seite: number;
  antworten: UmfrageAntworten;
  begonnen: string;
  geaendert: string;
  /** Wann das Ergebnis ins Suchprofil übernommen wurde */
  uebernommen: string | null;
}

export function leereAntworten(): UmfrageAntworten {
  return {
    name: '',
    stand: null,
    abschluss: '',
    abschlussarbeit: '',
    start: null,
    fachgebiete: [],
    themen: [],
    stellenarten: [],
    einrichtungen: [],
    lieberNicht: [],
    entgelt: { min: null, herzen: 2 },
    umfang: { min: null, herzen: 1 },
    unbefristet: null,
    sprache: null,
    arbeitsweise: [],
    reisen: null,
    methoden: [],
    mobil: null,
    bundeslaender: [],
    orte: [],
    bruecken: [],
    interessen: [],
    dosis: null,
    weite: true,
    gewichte: { thema: 2, stelle: 2, methoden: 2, rahmen: 2 },
    traumstelle: '',
    sonstiges: '',
  };
}

export function neueUmfrage(now = new Date().toISOString()): UmfrageStand {
  return { version: 1, seite: 0, antworten: leereAntworten(), begonnen: now, geaendert: now, uebernommen: null };
}

const herz = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const kurz = (max: number) => z.string().max(max).catch('');
const auswahl = z.object({ id: z.string().min(1).max(120), label: z.string().min(1).max(120), herzen: herz.catch(2), begriffe: z.array(z.string().min(1).max(80)).max(20).optional() });
const liste = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((xs) => xs.flatMap((x) => {
      const r = item.safeParse(x);
      return r.success ? [r.data as z.infer<T>] : [];
    }).slice(0, max));
const jobKind = z.enum(['promotion', 'postdoc', 'wiss_ma', 'professur', 'projekt', 'lehre', 'shk', 'klinik', 'verwaltung', 'sonstige']);

/** Tolerant: Was nicht passt, fällt auf den Anfangswert zurück, statt die ganze Umfrage zu kosten. */
const AntwortenSchema = z.object({
  name: kurz(80),
  stand: z.string().max(40).nullable().catch(null),
  abschluss: kurz(160),
  abschlussarbeit: kurz(400),
  start: z.string().max(40).nullable().catch(null),
  fachgebiete: liste(auswahl, 40),
  themen: liste(auswahl, 60),
  stellenarten: liste(z.object({ art: jobKind, herzen: herz.catch(2) }), 10),
  einrichtungen: liste(z.string().max(40), 12),
  lieberNicht: liste(auswahl, 30),
  entgelt: z.object({ min: z.number().int().min(1).max(15).nullable().catch(null), herzen: herz.catch(2) }).catch({ min: null, herzen: 2 }),
  umfang: z.object({ min: z.number().int().min(1).max(100).nullable().catch(null), herzen: herz.catch(1) }).catch({ min: null, herzen: 1 }),
  unbefristet: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).nullable().catch(null),
  sprache: z.enum(['de', 'en', 'egal']).nullable().catch(null),
  arbeitsweise: liste(auswahl, 10),
  reisen: z.union([z.literal(0), z.literal(1), z.literal(3)]).nullable().catch(null),
  methoden: liste(auswahl, 60),
  mobil: z.string().max(40).nullable().catch(null),
  bundeslaender: liste(z.enum(STATE_CODES as [StateCode, ...StateCode[]]), 16),
  orte: liste(z.object({ kind: z.enum(['city', 'institution']), ref: z.string().min(1).max(80), label: z.string().min(1).max(160) }), 40),
  bruecken: liste(z.string().max(60), 20),
  interessen: liste(z.string().min(1).max(80), 30),
  dosis: z.enum(['aus', 'selten', 'normal', 'oft']).nullable().catch(null),
  weite: z.boolean().catch(true),
  gewichte: z.object({ thema: herz.catch(2), stelle: herz.catch(2), methoden: herz.catch(2), rahmen: herz.catch(2) }).catch({ thema: 2, stelle: 2, methoden: 2, rahmen: 2 }),
  traumstelle: kurz(2000),
  sonstiges: kurz(2000),
});

const StandSchema = z.object({
  version: z.literal(1),
  seite: z.number().int().min(0).max(100).catch(0),
  antworten: AntwortenSchema,
  begonnen: z.string(),
  geaendert: z.string(),
  uebernommen: z.string().nullable().catch(null),
});

export function parseUmfrage(value: unknown): UmfrageStand | null {
  const r = StandSchema.safeParse(value);
  return r.success ? (r.data as UmfrageStand) : null;
}

/** Wie viele Fragen schon beantwortet sind (für die Anzeige „angefangen“). */
export function hatAntworten(a: UmfrageAntworten): boolean {
  const leer = leereAntworten();
  return JSON.stringify(a) !== JSON.stringify(leer);
}

// ---------------------------------------------------------------- Umwandeln

/** Begriffe aus einer eigenen Eingabe: „Emotionsregulation / emotion regulation“ → zwei Begriffe. */
export function begriffeAusEingabe(text: string): string[] {
  const parts = text
    .split(/[/;,]+/)
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter((t) => normalizeText(t).length >= 2);
  return [...new Set(parts.map((t) => t.toLowerCase()))].slice(0, 20);
}

/** Bezeichnung einer eigenen Eingabe: der erste Teil vor einem Schrägstrich. */
export function labelAusEingabe(text: string): string {
  const first = text.split(/[/;,]+/)[0].trim().replace(/\s+/g, ' ');
  return (first || text.trim()).slice(0, 120);
}

export function eigeneAuswahl(text: string, herzen: Hearts = 2): Auswahl | null {
  const begriffe = begriffeAusEingabe(text);
  if (begriffe.length === 0) return null;
  return { id: `eigen:${normalizeText(text).slice(0, 100)}`, label: labelAusEingabe(text), herzen, begriffe };
}

function begriffeVon(a: Auswahl): string[] {
  return vorschlag(a.id)?.begriffe ?? a.begriffe ?? [a.label.toLowerCase()];
}

const BASIS = { thema: 45, stelle: 30, methoden: 10, rahmen: 15 } as const;

/** Herzchen je Kategorie → Gewichte (Standard 45/30/10/15 bei je zwei Herzen), Summe 100. */
export function gewichteAusHerzen(g: Gewichte): { thema: number; stelle: number; methoden: number; rahmen: number } {
  const raw = { thema: BASIS.thema * g.thema, stelle: BASIS.stelle * g.stelle, methoden: BASIS.methoden * g.methoden, rahmen: BASIS.rahmen * g.rahmen };
  const sum = raw.thema + raw.stelle + raw.methoden + raw.rahmen;
  const r = (x: number) => Math.round((x / sum) * 100);
  const out = { thema: r(raw.thema), stelle: r(raw.stelle), methoden: r(raw.methoden), rahmen: r(raw.rahmen) };
  // Rundungsrest dem Thema zuschlagen, damit es genau 100 sind
  out.thema += 100 - (out.thema + out.stelle + out.methoden + out.rahmen);
  return out;
}

/** Baut aus den Antworten einen Steckbrief im Entwurfsformat (wird dann mit importSteckbrief eingelesen). */
export function umfrageZuSteckbrief(a: UmfrageAntworten): SteckbriefV0 {
  const seen = new Set<string>();
  const eintraege = (list: Auswahl[]) =>
    list
      .filter((x) => !seen.has(x.id) && seen.add(x.id))
      .map((x) => ({ label: x.label, begriffe: begriffeVon(x), wichtigkeit: x.herzen }));
  const start = starterHorizont();
  const bruecken = a.bruecken
    .map((id) => start.bruecken.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .map((b) => ({ name: b.name, feld: b.feld, anker: b.anker, suche: b.suche, warum: undefined }));
  const thema = eintraege([...a.fachgebiete, ...a.themen]);
  return {
    format: 'stellenbuechlein-steckbrief',
    version: 0,
    name: a.name.trim() || undefined,
    themen: thema,
    stellenarten: a.stellenarten.map((s) => ({ art: s.art, wichtigkeit: s.herzen })),
    methoden: eintraege(a.methoden),
    rahmen: {
      entgelt_min: a.entgelt.min ?? undefined,
      entgelt_wichtigkeit: a.entgelt.min ? a.entgelt.herzen : undefined,
      umfang_min: a.umfang.min ?? undefined,
      umfang_wichtigkeit: a.umfang.min ? a.umfang.herzen : undefined,
      unbefristet_wichtigkeit: a.unbefristet ?? undefined,
      sprache: a.sprache === 'de' || a.sprache === 'en' ? a.sprache : undefined,
    },
    arbeitsweise: eintraege(a.arbeitsweise),
    lieber_nicht: [
      ...a.lieberNicht.map((x) => {
        const v = vorschlag(x.id);
        return { label: x.label, begriffe: v ? v.begriffe : (x.begriffe ?? [x.label.toLowerCase()]), art: v?.art, wichtigkeit: x.herzen };
      }),
      ...(a.reisen ? [{ label: REISEN.label, begriffe: REISEN.begriffe, wichtigkeit: a.reisen }] : []),
    ],
    orte: {
      bundeslaender: a.bundeslaender,
      staedte: a.orte.filter((o) => o.kind === 'city').map((o) => o.label),
      einrichtungen: a.orte.filter((o) => o.kind === 'institution').map((o) => o.label),
    },
    gewichte: gewichteAusHerzen(a.gewichte),
    horizont: {
      interessen: a.interessen,
      faehigkeiten: [],
      bruecken,
      start_bruecken_behalten: false,
      weite: a.weite,
      dosis: a.dosis ?? 'normal',
    },
  };
}

// ---------------------------------------------------------------- Als Text

const optionLabel = (list: UmfrageOption[], id: string | null) => (id ? list.find((o) => o.id === id)?.label ?? id : null);
const herzText = (h: number) => '♥'.repeat(h);

/** Alle Antworten als lesbarer Text, zum Kopieren und Weitergeben. */
export function umfrageAlsText(stand: UmfrageStand): string {
  const a = stand.antworten;
  const lines: string[] = [`# Umfrage für das Suchprofil${a.name ? `: ${a.name}` : ''}`, `Stand: ${stand.geaendert.slice(0, 10)}${stand.uebernommen ? `, übernommen am ${stand.uebernommen.slice(0, 10)}` : ', noch nicht übernommen'}`, ''];
  const add = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) lines.push(`- **${label}:** ${value.trim()}`);
  };
  const auswahlText = (list: Auswahl[]) => list.map((x) => `${x.label} ${herzText(x.herzen)}${x.begriffe ? ` (eigene: ${x.begriffe.join(', ')})` : ''}`).join('; ');
  lines.push('## Über mich');
  add('Stand', optionLabel(STAND_OPTIONEN, a.stand));
  add('Abschluss', a.abschluss);
  add('Abschlussarbeit', a.abschlussarbeit);
  add('Start', optionLabel(START_OPTIONEN, a.start));
  lines.push('', '## Inhalte');
  add('Fachgebiete', auswahlText(a.fachgebiete));
  add('Themen', auswahlText(a.themen));
  lines.push('', '## Stelle');
  add('Stellenarten', a.stellenarten.map((s) => `${JOB_KIND_LABELS[s.art]} ${herzText(s.herzen)}`).join('; '));
  add('Einrichtungen', a.einrichtungen.map((id) => optionLabel(EINRICHTUNG_OPTIONEN, id)).join(', '));
  add('Lieber nicht', auswahlText(a.lieberNicht));
  lines.push('', '## Rahmen');
  add('Entgelt', a.entgelt.min ? `ab E ${a.entgelt.min} ${herzText(a.entgelt.herzen)}` : 'egal');
  add('Umfang', a.umfang.min ? `ab ${a.umfang.min} % ${herzText(a.umfang.herzen)}` : 'egal');
  add('Unbefristet', a.unbefristet == null ? null : a.unbefristet === 0 ? 'befristet ist in Ordnung' : herzText(a.unbefristet));
  add('Sprache', a.sprache === 'de' ? 'lieber Deutsch' : a.sprache === 'en' ? 'lieber Englisch' : a.sprache === 'egal' ? 'beides' : null);
  add('Arbeitsweise', auswahlText(a.arbeitsweise));
  add('Dienstreisen', a.reisen == null ? null : REISEN_OPTIONEN.find((r) => r.id === a.reisen)?.label);
  lines.push('', '## Können');
  add('Methoden', auswahlText(a.methoden));
  lines.push('', '## Orte');
  add('Mobilität', optionLabel(MOBIL_OPTIONEN, a.mobil));
  add('Bundesländer', a.bundeslaender.map((c) => STATES[c]).join(', '));
  add('Städte und Einrichtungen', a.orte.map((o) => o.label).join(', '));
  lines.push('', '## Horizont');
  const start = starterHorizont();
  add('Felder', a.bruecken.map((id) => start.bruecken.find((b) => b.id === id)?.name ?? id).join(', '));
  add('Interessen', a.interessen.join(', '));
  add('Wie oft im Stapel', a.dosis ? DOSIS_OPTIONEN.find((d) => d.id === a.dosis)?.label ?? a.dosis : null);
  add('KI darf weiter suchen (Weite)', a.weite ? 'ja' : 'nein');
  lines.push('', '## Zum Schluss');
  add('Wichtigkeit', `Thema ${herzText(a.gewichte.thema)}, Stellenart ${herzText(a.gewichte.stelle)}, Methoden ${herzText(a.gewichte.methoden)}, Rahmen ${herzText(a.gewichte.rahmen)}`);
  add('Traumstelle', a.traumstelle);
  add('Sonstiges', a.sonstiges);
  return lines.join('\n');
}
