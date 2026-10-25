// Übersetzungen der Vorschläge aus der Umfrage (packages/core/src/umfrage.ts), der Start-Einträge im
// Suchprofil und der Start-Brücken. Deutsch steht im Kern selbst; gespeichert wird immer die deutsche
// Bezeichnung, damit Pipeline und KI dasselbe sehen. Angezeigt wird die Übersetzung.
//
// Schlüssel:
//   <id>                 Katalog-Eintrag (f-…, t-…, m-…, n-…, w-…)
//   profil:<id>          Eintrag im Startprofil
//   bruecke:<id>         Start-Brücke (label = Name, hinweis = Kurzbeschreibung)
//   gruppe:<Titel>       Gruppe der Methoden
//   stand:, beginn:, mobil:, einrichtung:, art:, dosis:, reisen:   Antwortmöglichkeiten der Umfrage
//   interesse:<Deutsch>, abschluss:<Deutsch>                        Vorschläge ohne id

import {
  ARBEITSWEISE,
  FACHGEBIETE,
  INTERESSEN,
  JOB_KIND_LABELS,
  JOB_KINDS,
  LIEBER_NICHT,
  METHODEN,
  REISEN,
  STELLENART_OPTIONEN,
  starterHorizont,
  starterProfile,
  THEMEN,
} from '@stellen/core';
import { fmtPct, lang, tr, type Lang } from './index';
import { jobKindLabel } from './labels';

export interface KatalogText {
  label: string;
  hinweis?: string;
}

type Table = Record<string, KatalogText>;

const EN: Table = {
  // Fachgebiete
  'f-psych': { label: 'Psychology in general', hinweis: 'anything related to psychology' },
  'f-klin': { label: 'Clinical psychology & psychotherapy' },
  'f-kogn': { label: 'Cognitive psychology' },
  'f-neuro': { label: 'Neuropsychology & neuroscience' },
  'f-bio': { label: 'Biological psychology' },
  'f-allg': { label: 'General psychology', hinweis: 'perception, memory, learning, thinking' },
  'f-entw': { label: 'Developmental psychology' },
  'f-paed': { label: 'Educational psychology & education research' },
  'f-sozial': { label: 'Social psychology' },
  'f-pers': { label: 'Personality psychology', hinweis: 'including differential psychology' },
  'f-diag': { label: 'Psychological assessment & psychometrics' },
  'f-ao': { label: 'Work & organizational psychology' },
  'f-wirt': { label: 'Business & consumer psychology' },
  'f-gesund': { label: 'Health psychology' },
  'f-medien': { label: 'Media psychology' },
  'f-ing': { label: 'Engineering psychology & human factors' },
  'f-umwelt': { label: 'Environmental psychology' },
  'f-verkehr': { label: 'Traffic psychology' },
  'f-recht': { label: 'Legal & forensic psychology' },
  'f-sport': { label: 'Sport psychology' },
  'f-geronto': { label: 'Psychology of aging', hinweis: 'geropsychology' },

  // Themen
  't-emo': { label: 'Emotions & emotion regulation' },
  't-stress': { label: 'Stress & resilience' },
  't-angst': { label: 'Anxiety & depression' },
  't-sucht': { label: 'Addiction' },
  't-trauma': { label: 'Trauma' },
  't-psychose': { label: 'Psychosis' },
  't-ess': { label: 'Eating disorders & body image' },
  't-adhs': { label: 'ADHD & autism' },
  't-pt': { label: 'Psychotherapy research' },
  't-schlaf': { label: 'Sleep' },
  't-schmerz': { label: 'Pain & the body' },
  't-gedaecht': { label: 'Memory & learning' },
  't-aufm': { label: 'Attention & perception' },
  't-entsch': { label: 'Decision-making & judgment' },
  't-motiv': { label: 'Motivation & self-regulation' },
  't-sprache': { label: 'Language' },
  't-bez': { label: 'Relationships & loneliness' },
  't-vorurteil': { label: 'Prejudice & diversity' },
  't-selbst': { label: 'Personality & self-esteem' },
  't-wohl': { label: 'Well-being & mindfulness' },
  't-praev': { label: 'Prevention & health promotion' },
  't-kinder': { label: 'Children, adolescents & families' },
  't-schule': { label: 'School & teaching' },
  't-alter': { label: 'Aging & dementia' },
  't-arbeit': { label: 'Work, leadership & teams' },
  't-medien': { label: 'Digital & social media' },
  't-ki': { label: 'Humans & technology, AI' },
  't-klima': { label: 'Climate & sustainability' },

  // Methoden
  'gruppe:Statistik & Software': { label: 'Statistics & software' },
  'gruppe:Studien & Erhebung': { label: 'Studies & data collection' },
  'gruppe:Geräte & Messungen': { label: 'Equipment & measurement' },
  'gruppe:Praxis & Vermitteln': { label: 'Practice & communication' },
  'm-r': { label: 'R' },
  'm-spss': { label: 'SPSS' },
  'm-python': { label: 'Python' },
  'm-matlab': { label: 'MATLAB' },
  'm-mehrebenen': { label: 'Multilevel models' },
  'm-sem': { label: 'Structural equation modeling' },
  'm-bayes': { label: 'Bayesian statistics' },
  'm-meta': { label: 'Meta-analyses & reviews' },
  'm-ml': { label: 'Machine learning' },
  'm-open': { label: 'Open science' },
  'm-exp': { label: 'Experiments' },
  'm-frage': { label: 'Questionnaires & online studies' },
  'm-quali': { label: 'Interviews & qualitative methods' },
  'm-ema': { label: 'Longitudinal & diary studies', hinweis: 'including experience sampling' },
  'm-beob': { label: 'Behavioral observation' },
  'm-programm': { label: 'Programming experiments', hinweis: 'PsychoPy, jsPsych, E-Prime …' },
  'm-tools': { label: 'Survey tools', hinweis: 'SoSci Survey, Qualtrics, LimeSurvey' },
  'm-eeg': { label: 'EEG' },
  'm-mrt': { label: 'fMRI & brain imaging' },
  'm-eye': { label: 'Eye tracking' },
  'm-phys': { label: 'Physiological measures', hinweis: 'heart rate, cortisol, skin conductance' },
  'm-tms': { label: 'Brain stimulation (TMS, tDCS)' },
  'm-vr': { label: 'Virtual reality' },
  'm-diag': { label: 'Psychological assessment & testing' },
  'm-beratung': { label: 'Counseling & coaching' },
  'm-therapie': { label: 'Psychotherapy', hinweis: 'training, further training or licensure' },
  'm-gruppen': { label: 'Leading groups & workshops' },
  'm-lehre': { label: 'Teaching & didactics' },
  'm-pm': { label: 'Project management' },
  'm-kommunikation': { label: 'Science communication' },
  'm-schreiben': { label: 'Writing & publishing' },

  // Lieber nicht
  'n-shk': { label: 'Student assistant jobs', hinweis: 'student or graduate assistants, a few hours a week' },
  'n-verw': { label: 'Administration & technical' },
  'n-lehre': { label: 'Teaching-only positions', hinweis: 'e.g. lecturer for special tasks (LfbA)' },
  'n-klinik': { label: 'Clinic & therapy' },
  'n-projekt': { label: 'Coordination without own research' },
  'n-tier': { label: 'Animal research' },
  'n-schicht': { label: 'Shift & weekend work' },
  'n-forensik': { label: 'Forensic psychiatry & prisons' },
  'n-vertrieb': { label: 'Sales' },
  'n-recruiting': { label: 'Recruitment agencies' },
  'n-call': { label: 'Call centers & phone surveys' },
  'n-erfassung': { label: 'Data entry only' },
  'n-militaer': { label: 'Armed forces & military' },
  'n-reisen': { label: 'Lots of travel' },

  // Arbeitsweise
  'w-home': { label: 'Working from home', hinweis: 'mobile work, telework, remote' },
  'w-zeit': { label: 'Flexible hours', hinweis: 'flextime, trust-based working hours' },
  'w-familie': { label: 'Family-friendly', hinweis: 'appears in almost every public-sector posting, so it hardly makes a difference' },

  // Dienstreisen
  'reisen:0': { label: 'No problem', hinweis: 'happy to be on the road now and then' },
  'reisen:1': { label: 'Now and then is fine', hinweis: 'jobs with lots of travel move down a little' },
  'reisen:3': { label: 'As little as possible', hinweis: 'jobs with lots of travel move down a lot' },

  // Interessen außerhalb der Psychologie
  'interesse:Künstliche Intelligenz': { label: 'Artificial intelligence' },
  'interesse:Technik & Informatik': { label: 'Technology & computer science' },
  'interesse:Medizin': { label: 'Medicine' },
  'interesse:Biologie': { label: 'Biology' },
  'interesse:Klima & Nachhaltigkeit': { label: 'Climate & sustainability' },
  'interesse:Politik & Gesellschaft': { label: 'Politics & society' },
  'interesse:Bildung': { label: 'Education' },
  'interesse:Wirtschaft': { label: 'Economics & business' },
  'interesse:Recht': { label: 'Law' },
  'interesse:Philosophie & Ethik': { label: 'Philosophy & ethics' },
  'interesse:Sprachen & Literatur': { label: 'Languages & literature' },
  'interesse:Kunst & Kultur': { label: 'Art & culture' },
  'interesse:Musik': { label: 'Music' },
  'interesse:Sport': { label: 'Sports' },
  'interesse:Design': { label: 'Design' },
  'interesse:Journalismus & Medien': { label: 'Journalism & media' },
  'interesse:Natur & Tiere': { label: 'Nature & animals' },
  'interesse:Reisen & andere Kulturen': { label: 'Travel & other cultures' },

  // Start-Brücken
  'bruecke:h-ki': { label: 'Humans & AI', hinweis: 'how people use, trust and work with AI' },
  'bruecke:h-sec': { label: 'IT security', hinweis: 'security awareness, phishing, safe behavior online' },
  'bruecke:h-arbeit': { label: 'Work & organization', hinweis: 'staff development, work design, personnel selection' },
  'bruecke:h-gesund': { label: 'Health & prevention', hinweis: 'public health, prevention, health services research' },
  'bruecke:h-bildung': { label: 'Education & learning', hinweis: 'didactics, e-learning, teacher education, competence assessment' },
  'bruecke:h-verkehr': { label: 'Mobility & transport', hinweis: 'road safety, automated driving, aviation' },
  'bruecke:h-umwelt': { label: 'Environment & sustainability', hinweis: 'climate protection, energy transition, sustainable behavior' },
  'bruecke:h-daten': { label: 'Data & methods', hinweis: 'survey and market research, evaluation, data science' },
  'bruecke:h-gesell': { label: 'Society & politics', hinweis: 'social research, migration, policy advice' },
  'bruecke:h-ux': { label: 'Design & UX', hinweis: 'user research, usability, human–computer interaction' },

  // Stand, Beginn, Abschluss
  'stand:bachelor': { label: 'Doing a bachelor’s' },
  'stand:master': { label: 'Doing a master’s', hinweis: 'or about to graduate' },
  'stand:master-fertig': { label: 'Master’s or diploma completed' },
  'stand:promotion': { label: 'In the middle of a PhD' },
  'stand:promoviert': { label: 'PhD completed' },
  'stand:beruf': { label: 'Already working', hinweis: 'and open to something new' },
  'beginn:sofort': { label: 'As soon as possible' },
  'beginn:3m': { label: 'Within the next three months' },
  'beginn:6m': { label: 'In three to six months' },
  'beginn:spaeter': { label: 'Later', hinweis: 'just looking around for now' },
  'abschluss:Psychologie (M.Sc.)': { label: 'Psychology (M.Sc.)' },
  'abschluss:Psychologie (B.Sc.)': { label: 'Psychology (B.Sc.)' },
  'abschluss:Klinische Psychologie und Psychotherapie (M.Sc.)': { label: 'Clinical Psychology and Psychotherapy (M.Sc.)' },
  'abschluss:Kognitive Neurowissenschaft (M.Sc.)': { label: 'Cognitive Neuroscience (M.Sc.)' },
  'abschluss:Wirtschaftspsychologie': { label: 'Business Psychology' },

  // Mobilität, Einrichtungen
  'mobil:pendeln': { label: 'Commuting distance only', hinweis: 'moving is not really an option' },
  'mobil:region': { label: 'Moving within the region' },
  'mobil:deutschland': { label: 'Moving anywhere in Germany' },
  'mobil:ausland': { label: 'Abroad as well' },
  'einrichtung:uni': { label: 'University' },
  'einrichtung:hochschule': { label: 'University of applied sciences' },
  'einrichtung:institut': { label: 'Research institute', hinweis: 'Max Planck, Leibniz, Fraunhofer, Helmholtz' },
  'einrichtung:klinik': { label: 'Clinic or university hospital' },
  'einrichtung:behoerde': { label: 'Public authority, civil service' },
  'einrichtung:unternehmen': { label: 'Company' },
  'einrichtung:verein': { label: 'Association, foundation, NGO' },
  'einrichtung:praxis': { label: 'Private practice or counseling center' },

  // Stellenarten in der Umfrage
  'art:promotion': { label: 'PhD', hinweis: 'doctoral position, often as a research associate at 50 to 75%' },
  'art:wiss_ma': { label: 'Research associate', hinweis: 'research and usually some teaching, with or without a PhD' },
  'art:postdoc': { label: 'Postdoc', hinweis: 'after the PhD' },
  'art:projekt': { label: 'Projects & coordination', hinweis: 'coordinating studies, projects or networks' },
  'art:lehre': { label: 'Teaching', hinweis: 'focus on teaching, e.g. lecturer' },
  'art:klinik': { label: 'Clinic & therapy', hinweis: 'psychological work in a clinic, counseling or therapy' },
  'art:verwaltung': { label: 'Administration & technical', hinweis: 'research management, administration, technical roles' },
  'art:shk': { label: 'Student assistant', hinweis: 'student or graduate assistant, a few hours a week' },
  'art:professur': { label: 'Professorship', hinweis: 'including junior professorship' },

  // Wie oft Horizont-Karten kommen
  'dosis:oft': { label: 'Often', hinweis: 'about every second to third card' },
  'dosis:normal': { label: 'Now and then', hinweis: 'about every third to fifth card' },
  'dosis:selten': { label: 'Rarely', hinweis: 'about every sixth to eighth card' },
  'dosis:aus': { label: 'Not at all', hinweis: 'only jobs related to psychology' },

  // Startprofil
  'profil:t-psych': { label: 'Psychology' },
  'profil:t-klin': { label: 'Clinical psychology & psychotherapy' },
  'profil:t-kogn': { label: 'Cognition & neuroscience' },
  'profil:t-bild': { label: 'Education & development' },
  'profil:s-prom': { label: 'PhD' },
  'profil:s-wiss': { label: 'Research associate' },
  'profil:s-post': { label: 'Postdoc' },
  'profil:s-proj': { label: 'Projects & coordination' },
  'profil:m-stat': { label: 'Statistics & R' },
  'profil:m-exp': { label: 'Experiments' },
  'profil:a-shk': { label: 'Student assistant' },
  'profil:a-verw': { label: 'Administration & technical' },
};

const SR: Table = {
  // Fachgebiete
  'f-psych': { label: 'Psihologija uopšte', hinweis: 'sve što je vezano za psihologiju' },
  'f-klin': { label: 'Klinička psihologija i psihoterapija' },
  'f-kogn': { label: 'Kognitivna psihologija' },
  'f-neuro': { label: 'Neuropsihologija i neuronauke' },
  'f-bio': { label: 'Biološka psihologija' },
  'f-allg': { label: 'Opšta psihologija', hinweis: 'opažanje, pamćenje, učenje, mišljenje' },
  'f-entw': { label: 'Razvojna psihologija' },
  'f-paed': { label: 'Pedagoška psihologija i istraživanje obrazovanja' },
  'f-sozial': { label: 'Socijalna psihologija' },
  'f-pers': { label: 'Psihologija ličnosti', hinweis: 'uključujući diferencijalnu psihologiju' },
  'f-diag': { label: 'Psihodijagnostika i psihometrija' },
  'f-ao': { label: 'Psihologija rada i organizaciona psihologija' },
  'f-wirt': { label: 'Ekonomska psihologija i psihologija potrošača' },
  'f-gesund': { label: 'Zdravstvena psihologija' },
  'f-medien': { label: 'Psihologija medija' },
  'f-ing': { label: 'Inženjerska psihologija i ljudski faktori' },
  'f-umwelt': { label: 'Ekološka psihologija' },
  'f-verkehr': { label: 'Psihologija saobraćaja' },
  'f-recht': { label: 'Pravna i forenzička psihologija' },
  'f-sport': { label: 'Psihologija sporta' },
  'f-geronto': { label: 'Psihologija starenja', hinweis: 'gerontopsihologija' },

  // Themen
  't-emo': { label: 'Emocije i regulacija emocija' },
  't-stress': { label: 'Stres i otpornost' },
  't-angst': { label: 'Anksioznost i depresija' },
  't-sucht': { label: 'Zavisnosti' },
  't-trauma': { label: 'Trauma' },
  't-psychose': { label: 'Psihoze' },
  't-ess': { label: 'Poremećaji ishrane i slika tela' },
  't-adhs': { label: 'ADHD i autizam' },
  't-pt': { label: 'Istraživanje psihoterapije' },
  't-schlaf': { label: 'Spavanje' },
  't-schmerz': { label: 'Bol i telo' },
  't-gedaecht': { label: 'Pamćenje i učenje' },
  't-aufm': { label: 'Pažnja i opažanje' },
  't-entsch': { label: 'Odlučivanje i rasuđivanje' },
  't-motiv': { label: 'Motivacija i samoregulacija' },
  't-sprache': { label: 'Jezik' },
  't-bez': { label: 'Odnosi i usamljenost' },
  't-vorurteil': { label: 'Predrasude i raznolikost' },
  't-selbst': { label: 'Ličnost i samopoštovanje' },
  't-wohl': { label: 'Blagostanje i mindfulness' },
  't-praev': { label: 'Prevencija i unapređenje zdravlja' },
  't-kinder': { label: 'Deca, mladi i porodica' },
  't-schule': { label: 'Škola i nastava' },
  't-alter': { label: 'Starenje i demencija' },
  't-arbeit': { label: 'Rad, liderstvo i timovi' },
  't-medien': { label: 'Digitalni i društveni mediji' },
  't-ki': { label: 'Čovek i tehnologija, AI' },
  't-klima': { label: 'Klima i održivost' },

  // Methoden
  'gruppe:Statistik & Software': { label: 'Statistika i softver' },
  'gruppe:Studien & Erhebung': { label: 'Studije i prikupljanje podataka' },
  'gruppe:Geräte & Messungen': { label: 'Uređaji i merenja' },
  'gruppe:Praxis & Vermitteln': { label: 'Praksa i prenošenje znanja' },
  'm-r': { label: 'R' },
  'm-spss': { label: 'SPSS' },
  'm-python': { label: 'Python' },
  'm-matlab': { label: 'MATLAB' },
  'm-mehrebenen': { label: 'Višenivovski modeli' },
  'm-sem': { label: 'Modelovanje strukturalnim jednačinama' },
  'm-bayes': { label: 'Bajesova statistika' },
  'm-meta': { label: 'Metaanalize i pregledni radovi' },
  'm-ml': { label: 'Mašinsko učenje' },
  'm-open': { label: 'Otvorena nauka' },
  'm-exp': { label: 'Eksperimenti' },
  'm-frage': { label: 'Upitnici i onlajn studije' },
  'm-quali': { label: 'Intervjui i kvalitativne metode' },
  'm-ema': { label: 'Longitudinalne i dnevničke studije', hinweis: 'uključujući experience sampling' },
  'm-beob': { label: 'Posmatranje ponašanja' },
  'm-programm': { label: 'Programiranje eksperimenata', hinweis: 'PsychoPy, jsPsych, E-Prime …' },
  'm-tools': { label: 'Alati za ankete', hinweis: 'SoSci Survey, Qualtrics, LimeSurvey' },
  'm-eeg': { label: 'EEG' },
  'm-mrt': { label: 'fMRI i snimanje mozga' },
  'm-eye': { label: 'Praćenje pokreta očiju' },
  'm-phys': { label: 'Fiziološka merenja', hinweis: 'srčana frekvencija, kortizol, provodljivost kože' },
  'm-tms': { label: 'Stimulacija mozga (TMS, tDCS)' },
  'm-vr': { label: 'Virtuelna realnost' },
  'm-diag': { label: 'Psihološka procena i testiranje' },
  'm-beratung': { label: 'Savetovanje i koučing' },
  'm-therapie': { label: 'Psihoterapija', hinweis: 'edukacija, dodatna obuka ili licenca' },
  'm-gruppen': { label: 'Vođenje grupa i radionica' },
  'm-lehre': { label: 'Nastava i didaktika' },
  'm-pm': { label: 'Upravljanje projektima' },
  'm-kommunikation': { label: 'Komunikacija nauke' },
  'm-schreiben': { label: 'Pisanje i objavljivanje radova' },

  // Lieber nicht
  'n-shk': { label: 'Mesta studentskih asistenata', hinweis: 'studentski ili diplomirani asistenti, nekoliko sati nedeljno' },
  'n-verw': { label: 'Administracija i tehnika' },
  'n-lehre': { label: 'Mesta samo za nastavu', hinweis: 'npr. predavač za posebne zadatke (LfbA)' },
  'n-klinik': { label: 'Klinika i terapija' },
  'n-projekt': { label: 'Koordinacija bez sopstvenog istraživanja' },
  'n-tier': { label: 'Eksperimenti na životinjama' },
  'n-schicht': { label: 'Rad u smenama i vikendom' },
  'n-forensik': { label: 'Forenzička psihijatrija i zatvori' },
  'n-vertrieb': { label: 'Prodaja' },
  'n-recruiting': { label: 'Agencije za zapošljavanje' },
  'n-call': { label: 'Kol centri i telefonske ankete' },
  'n-erfassung': { label: 'Samo unos podataka' },
  'n-militaer': { label: 'Vojska i odbrana' },
  'n-reisen': { label: 'Mnogo putovanja' },

  // Arbeitsweise
  'w-home': { label: 'Rad od kuće', hinweis: 'rad na daljinu, hibridni rad, remote' },
  'w-zeit': { label: 'Fleksibilno radno vreme', hinweis: 'klizno radno vreme, radno vreme bez evidencije' },
  'w-familie': { label: 'Pogodno za porodicu', hinweis: 'stoji u skoro svakom oglasu javnog sektora, pa slabo pravi razliku' },

  // Dienstreisen
  'reisen:0': { label: 'Nema problema', hinweis: 'rado ponekad i na putu' },
  'reisen:1': { label: 'Povremeno je u redu', hinweis: 'poslovi sa mnogo putovanja padaju malo niže' },
  'reisen:3': { label: 'Što manje', hinweis: 'poslovi sa mnogo putovanja padaju znatno niže' },

  // Interessen außerhalb der Psychologie
  'interesse:Künstliche Intelligenz': { label: 'Veštačka inteligencija' },
  'interesse:Technik & Informatik': { label: 'Tehnika i informatika' },
  'interesse:Medizin': { label: 'Medicina' },
  'interesse:Biologie': { label: 'Biologija' },
  'interesse:Klima & Nachhaltigkeit': { label: 'Klima i održivost' },
  'interesse:Politik & Gesellschaft': { label: 'Politika i društvo' },
  'interesse:Bildung': { label: 'Obrazovanje' },
  'interesse:Wirtschaft': { label: 'Ekonomija' },
  'interesse:Recht': { label: 'Pravo' },
  'interesse:Philosophie & Ethik': { label: 'Filozofija i etika' },
  'interesse:Sprachen & Literatur': { label: 'Jezici i književnost' },
  'interesse:Kunst & Kultur': { label: 'Umetnost i kultura' },
  'interesse:Musik': { label: 'Muzika' },
  'interesse:Sport': { label: 'Sport' },
  'interesse:Design': { label: 'Dizajn' },
  'interesse:Journalismus & Medien': { label: 'Novinarstvo i mediji' },
  'interesse:Natur & Tiere': { label: 'Priroda i životinje' },
  'interesse:Reisen & andere Kulturen': { label: 'Putovanja i druge kulture' },

  // Start-Brücken
  'bruecke:h-ki': { label: 'Čovek i AI', hinweis: 'kako ljudi koriste veštačku inteligenciju, veruju joj i rade s njom' },
  'bruecke:h-sec': { label: 'IT bezbednost', hinweis: 'svest o bezbednosti, fišing, bezbedno ponašanje na internetu' },
  'bruecke:h-arbeit': { label: 'Rad i organizacija', hinweis: 'razvoj zaposlenih, organizacija rada, selekcija kadrova' },
  'bruecke:h-gesund': { label: 'Zdravlje i prevencija', hinweis: 'javno zdravlje, prevencija, istraživanje zdravstvene zaštite' },
  'bruecke:h-bildung': { label: 'Obrazovanje i učenje', hinweis: 'didaktika, e-učenje, obrazovanje nastavnika, merenje kompetencija' },
  'bruecke:h-verkehr': { label: 'Mobilnost i saobraćaj', hinweis: 'bezbednost saobraćaja, automatizovana vožnja, vazduhoplovstvo' },
  'bruecke:h-umwelt': { label: 'Životna sredina i održivost', hinweis: 'zaštita klime, energetska tranzicija, održivo ponašanje' },
  'bruecke:h-daten': { label: 'Podaci i metode', hinweis: 'istraživanje javnog mnjenja i tržišta, evaluacija, nauka o podacima' },
  'bruecke:h-gesell': { label: 'Društvo i politika', hinweis: 'društvena istraživanja, migracije, savetovanje u javnim politikama' },
  'bruecke:h-ux': { label: 'Dizajn i UX', hinweis: 'istraživanje korisnika, upotrebljivost, interakcija čovek–računar' },

  // Stand, Beginn, Abschluss
  'stand:bachelor': { label: 'Na osnovnim studijama' },
  'stand:master': { label: 'Na master studijama', hinweis: 'ili pred sam kraj' },
  'stand:master-fertig': { label: 'Završen master ili diploma' },
  'stand:promotion': { label: 'Usred doktorata' },
  'stand:promoviert': { label: 'Završen doktorat' },
  'stand:beruf': { label: 'Već u radnom odnosu', hinweis: 'i otvoreno za nešto novo' },
  'beginn:sofort': { label: 'Što pre' },
  'beginn:3m': { label: 'U naredna tri meseca' },
  'beginn:6m': { label: 'Za tri do šest meseci' },
  'beginn:spaeter': { label: 'Kasnije', hinweis: 'za sada se samo raspitujem' },
  'abschluss:Psychologie (M.Sc.)': { label: 'Psihologija (master)' },
  'abschluss:Psychologie (B.Sc.)': { label: 'Psihologija (osnovne studije)' },
  'abschluss:Klinische Psychologie und Psychotherapie (M.Sc.)': { label: 'Klinička psihologija i psihoterapija (master)' },
  'abschluss:Kognitive Neurowissenschaft (M.Sc.)': { label: 'Kognitivna neuronauka (master)' },
  'abschluss:Wirtschaftspsychologie': { label: 'Ekonomska psihologija' },

  // Mobilität, Einrichtungen
  'mobil:pendeln': { label: 'Samo u blizini, bez selidbe', hinweis: 'svakodnevno putovanje do posla; selidba uglavnom ne dolazi u obzir' },
  'mobil:region': { label: 'Selidba u okviru regiona' },
  'mobil:deutschland': { label: 'Selidba bilo gde u Nemačkoj' },
  'mobil:ausland': { label: 'I u inostranstvo' },
  'einrichtung:uni': { label: 'Univerzitet' },
  'einrichtung:hochschule': { label: 'Visoka škola primenjenih nauka' },
  'einrichtung:institut': { label: 'Istraživački institut', hinweis: 'Maks Plank, Lajbnic, Fraunhofer, Helmholc' },
  'einrichtung:klinik': { label: 'Klinika ili univerzitetski klinički centar' },
  'einrichtung:behoerde': { label: 'Državni organ, javna služba' },
  'einrichtung:unternehmen': { label: 'Kompanija' },
  'einrichtung:verein': { label: 'Udruženje, fondacija, NVO' },
  'einrichtung:praxis': { label: 'Privatna praksa ili savetovalište' },

  // Stellenarten in der Umfrage
  'art:promotion': { label: 'Doktorat', hinweis: 'doktorska pozicija, često kao istraživač saradnik sa 50 do 75%' },
  'art:wiss_ma': { label: 'Istraživač saradnik', hinweis: 'istraživanje i obično malo nastave, sa doktoratom ili bez njega' },
  'art:postdoc': { label: 'Postdok', hinweis: 'posle doktorata' },
  'art:projekt': { label: 'Projekti i koordinacija', hinweis: 'koordinacija studija, projekata ili mreža' },
  'art:lehre': { label: 'Nastava', hinweis: 'težište na nastavi, npr. predavač' },
  'art:klinik': { label: 'Klinika i terapija', hinweis: 'psihološki rad u klinici, savetovalištu ili terapiji' },
  'art:verwaltung': { label: 'Administracija i tehnika', hinweis: 'menadžment u nauci, administracija, tehnički poslovi' },
  'art:shk': { label: 'Studentski asistent', hinweis: 'studentski ili diplomirani asistent, nekoliko sati nedeljno' },
  'art:professur': { label: 'Profesura', hinweis: 'uključujući juniorprofesuru' },

  // Wie oft Horizont-Karten kommen
  'dosis:oft': { label: 'Često', hinweis: 'otprilike svaka druga do treća kartica' },
  'dosis:normal': { label: 'Povremeno', hinweis: 'otprilike svaka treća do peta kartica' },
  'dosis:selten': { label: 'Retko', hinweis: 'otprilike svaka šesta do osma kartica' },
  'dosis:aus': { label: 'Nikako', hinweis: 'samo poslovi vezani za psihologiju' },

  // Startprofil
  'profil:t-psych': { label: 'Psihologija' },
  'profil:t-klin': { label: 'Klinička psihologija i psihoterapija' },
  'profil:t-kogn': { label: 'Kognicija i neuronauke' },
  'profil:t-bild': { label: 'Obrazovanje i razvoj' },
  'profil:s-prom': { label: 'Doktorat' },
  'profil:s-wiss': { label: 'Istraživač saradnik' },
  'profil:s-post': { label: 'Postdok' },
  'profil:s-proj': { label: 'Projekti i koordinacija' },
  'profil:m-stat': { label: 'Statistika i R' },
  'profil:m-exp': { label: 'Eksperimenti' },
  'profil:a-shk': { label: 'Studentski asistent' },
  'profil:a-verw': { label: 'Administracija i tehnika' },
};

const TABLES: Record<Exclude<Lang, 'de'>, Table> = { en: EN, sr: SR };

/** Übersetzung zu einem Schlüssel (siehe oben); ohne Übersetzung bleibt das Deutsche. */
export function katalogText(key: string, de: KatalogText): KatalogText {
  const l = lang();
  if (l === 'de') return de;
  const t = TABLES[l][key];
  if (!t) return de;
  return { label: t.label, hinweis: de.hinweis ? (t.hinweis ?? de.hinweis) : t.hinweis };
}

/** Katalog-Eintrag (Fachgebiet, Thema, Methode, „Lieber nicht“, Arbeitsweise). */
export const katalogEintrag = (e: { id: string; label: string; hinweis?: string }): KatalogText => katalogText(e.id, e);

/** Antwortmöglichkeit der Umfrage, z. B. option('stand', STAND_OPTIONEN[0]). */
export const option = (gruppe: 'stand' | 'beginn' | 'mobil' | 'einrichtung' | 'dosis' | 'reisen', o: { id: string | number; label: string; hinweis?: string }): KatalogText =>
  katalogText(`${gruppe}:${o.id}`, { label: o.label, hinweis: o.hinweis });

/** Stellenart in der Umfrage (STELLENART_OPTIONEN) mit Erklärung. */
export const stellenartOption = (o: { art: string; label: string; hinweis: string }): KatalogText => katalogText(`art:${o.art}`, o);

/** Start-Brücke: Name und Kurzbeschreibung. */
export const brueckeText = (id: string, name: string, hinweis?: string): KatalogText => katalogText(`bruecke:${id}`, { label: name, hinweis });

export const gruppeTitel = (titel: string): string => katalogText(`gruppe:${titel}`, { label: titel }).label;
export const interesseLabel = (de: string): string => katalogText(`interesse:${de}`, { label: de }).label;
export const abschlussLabel = (de: string): string => katalogText(`abschluss:${de}`, { label: de }).label;

// ---------------------------------------------------------------- Bezeichnungen im Suchprofil

let cache: { lang: Lang; map: Map<string, string> } | null = null;

/** Deutsche Bezeichnung → Übersetzung, für alles, was aus Katalog, Startprofil oder Start-Brücken stammt. */
function labelMap(l: Exclude<Lang, 'de'>): Map<string, string> {
  if (cache?.lang === l) return cache.map;
  const t = TABLES[l];
  const map = new Map<string, string>();
  const put = (de: string, key: string) => {
    const x = t[key];
    if (x && !map.has(de)) map.set(de, x.label);
  };
  for (const e of [...FACHGEBIETE, ...THEMEN, ...METHODEN, ...LIEBER_NICHT, ...ARBEITSWEISE, REISEN]) put(e.label, e.id);
  const start = starterProfile();
  for (const it of [...start.categories.flatMap((c) => c.items), ...start.avoid]) put(it.label, `profil:${it.id}`);
  for (const b of starterHorizont().bruecken) put(b.name, `bruecke:${b.id}`);
  for (const o of STELLENART_OPTIONEN) put(o.label, `art:${o.art}`);
  for (const i of INTERESSEN) put(i, `interesse:${i}`);
  for (const k of JOB_KINDS) if (!map.has(JOB_KIND_LABELS[k])) map.set(JOB_KIND_LABELS[k], jobKindLabel(k));
  map.set('Unbefristet', l === 'en' ? 'Permanent' : 'Na neodređeno');
  map.set('Deutschsprachig', l === 'en' ? 'In German' : 'Na nemačkom');
  map.set('Englischsprachig', l === 'en' ? 'In English' : 'Na engleskom');
  cache = { lang: l, map };
  return map;
}

/**
 * Bezeichnung eines Eintrags im Suchprofil (oder einer Brücke, eines Interesses) zum Anzeigen.
 * Stammt sie aus Katalog, Startprofil oder Steckbrief-Import, kommt die Übersetzung; Eigenes bleibt.
 */
export function profileLabel(label: string): string {
  const l = lang();
  if (l === 'de') return label;
  const hit = labelMap(l).get(label);
  if (hit) return hit;
  let m = /^Ab E ?(\d+)$/.exec(label);
  if (m) return tr(label, `From E ${m[1]}`, `Od E ${m[1]}`);
  m = /^Mindestens (\d+) ?%$/.exec(label);
  if (m) return tr(label, `At least ${fmtPct(+m[1])}`, `Najmanje ${fmtPct(+m[1])}`);
  return label;
}

/** Name des Suchprofils: „Startprofil“, „Aus Steckbrief“, „Steckbrief: Tara“, „Profil von Tara“, „Eigenes Profil“. */
export function profileName(name: string): string {
  if (lang() === 'de') return name;
  if (name === 'Startprofil') return tr(name, 'Starter profile', 'Početni profil');
  if (name === 'Aus Steckbrief') return tr(name, 'From profile sheet', 'Iz ličnog kartona');
  if (name === 'Eigenes Profil') return tr(name, 'Custom profile', 'Sopstveni profil');
  if (name === 'Aus der Umfrage') return tr(name, 'From the questionnaire', 'Iz upitnika');
  let m = /^Steckbrief: (.+)$/.exec(name);
  if (m) return tr(name, `Profile sheet: ${m[1]}`, `Lični karton: ${m[1]}`);
  m = /^Profil von (.+)$/.exec(name);
  if (m) return tr(name, `${m[1]}’s profile`, `Profil: ${m[1]}`);
  return name;
}
