// Suchprofil bearbeiten: Gewichte der Kategorien, Einträge mit Herzchen und Begriffen, "Lieber nicht".
// Jede Änderung wirkt sofort auf Score und Reihenfolge – die Vorschau oben zeigt es.

import { useMemo, useState } from 'react';
import {
  CATEGORY_ORDER,
  isOpen,
  JOB_KINDS,
  matchItem,
  newItemId,
  starterProfile,
  todayBerlin,
  type CategoryId,
  type Condition,
  type Hearts as HeartCount,
  type ProfileItem,
  type Suchprofil,
} from '@stellen/core';
import { useAppState, useStore, useViews } from '../../data/hooks';
import { navigate, openJob } from '../../lib/router';
import { Hearts } from '../../ui/bits';
import { Sheet } from '../../ui/Sheet';
import { IconPencil, IconPlus, IconTrash } from '../../ui/icons';
import { scoreTone } from '../../ui/JobRow';
import { SubPage } from './Settings';
import { fmtPct, srForm, texts } from '../../i18n';
import { categoryHint, categoryLabel, jobKindLabel } from '../../i18n/labels';
import { profileLabel, profileName } from '../../i18n/katalog';

type Target = CategoryId | 'avoid';
type CondType = Condition['type'] | 'none';

const t = texts({
  de: {
    cond: {
      none: 'keine, nur Begriffe',
      kind: 'Stellenart',
      payMin: 'Entgelt mindestens',
      workloadMin: 'Umfang mindestens',
      permanent: 'unbefristet',
      language: 'Sprache der Anzeige',
    } as Record<CondType, string>,
    condKind: (kinds: string) => `Stellenart: ${kinds}`,
    condPay: (level: number) => `Entgelt ab E ${level}`,
    condWorkload: (pct: number) => `Umfang ab ${fmtPct(pct)}`,
    condPermanent: 'unbefristet',
    condLangDe: 'deutschsprachig',
    condLangEn: 'englischsprachig',
    langDe: 'Deutsch',
    langEn: 'Englisch',
    // Worüber ein Eintrag beim Ausprobieren gepasst hat (Rückgabe von matchItem)
    via: {
      Stellenart: 'über Stellenart',
      Entgelt: 'über Entgelt',
      Umfang: 'über Umfang',
      Befristung: 'über Befristung',
      Sprache: 'über Sprache',
    } as Record<string, string>,
    viaTerm: (term: string) => `über „${term}“`,
    editEntry: 'Eintrag bearbeiten',
    newEntry: 'Neuer Eintrag',
    avoidHint: 'Lieber nicht: zieht 5 Punkte je Herz ab, sortiert aber nie aus.',
    category: (name: string) => `Kategorie ${name}`,
    labelField: 'Bezeichnung',
    labelPlaceholder: 'z. B. Emotionsregulation',
    howImportant: 'Wie wichtig?',
    importance: 'Wichtigkeit',
    termsField: 'Begriffe (einer reicht, je Zeile einer)',
    termsHelp: 'Wie Begriffe passen',
    ruleStart: 'passt auf Wortanfänge: kognitiv, Kognition, cognitive nicht (andere Schreibung extra eintragen).',
    ruleStar: 'mit Stern passt überall im Wort, auch in Neuropsychologie.',
    ruleQuoted: 'in Anführungszeichen passt nur auf das ganze Wort.',
    ruleCase: 'Groß- und Kleinschreibung und Umlaute sind egal (ä = ae).',
    conditionField: 'Bedingung (optional)',
    countsHalf: 'Steht die Angabe nicht in der Anzeige, zählt der Eintrag halb.',
    tryLabel: 'Ausprobieren:',
    tryResult: (yes: number, total: number) => `passt auf ${yes} von ${total} offenen Anzeigen`,
    tryUnknown: (n: number) => `, bei ${n} unklar (zählt halb)`,
    errLabel: 'Bitte eine Bezeichnung eingeben.',
    errKind: 'Bitte mindestens eine Stellenart wählen oder Begriffe eintragen.',
    errTerms: 'Bitte Begriffe eintragen oder eine Bedingung wählen.',
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    importanceOf: (label: string) => `Wichtigkeit von ${label}`,
    editItem: (label: string) => `${label} bearbeiten`,
    termsLine: (list: string, more: number) => `Begriffe: ${list}${more > 0 ? ` und ${more} weitere` : ''}`,
    title: 'Suchprofil',
    introA: 'Jede Kategorie ist voll, sobald Einträge mit zusammen ',
    introHearts: 'drei Herzchen',
    introB: ' in einer Anzeige vorkommen. Steht eine Angabe gar nicht in der Anzeige (zum Beispiel kein Entgelt), zählt der Eintrag halb. Der Score sortiert nur, aussortiert wird nie.',
    previewTop: 'Mit diesem Profil oben:',
    previewHigh: (high: number, total: number) => `${high} von ${total} offenen Anzeigen haben ${fmtPct(75)} oder mehr`,
    share: (pct: number) => `${fmtPct(pct)} vom Score`,
    notCounting: 'zählt nicht',
    weight: 'Gewicht',
    weightValue: (w: number, pct: number) => `${w}, das sind ${pct} Prozent vom Score`,
    noEntries: 'Noch keine Einträge. Leere Kategorien zählen nicht mit.',
    addEntry: 'Eintrag hinzufügen',
    avoid: 'Lieber nicht',
    avoidPenalty: '−5 Punkte je Herz',
    avoidText: 'Rückt Anzeigen nach unten, blendet aber nichts aus.',
    horizon: 'Horizont',
    horizonTag: 'außerhalb des Kerns',
    horizonText: 'Brücken in andere Felder und die Weite, in der die KI übertragbare Fähigkeiten erkennt. Zählt nicht zum Score, die Karten werden im Stapel eingestreut.',
    editHorizon: 'Horizont bearbeiten',
    reset: 'Auf Startprofil zurücksetzen',
    resetDone: 'Startprofil wiederhergestellt.',
    undo: 'Rückgängig',
    deleted: (label: string) => `„${label}“ gelöscht.`,
  },
  en: {
    cond: {
      none: 'None, terms only',
      kind: 'Position type',
      payMin: 'Minimum pay grade',
      workloadMin: 'Minimum hours',
      permanent: 'Permanent',
      language: 'Posting language',
    },
    condKind: (kinds) => `Position type: ${kinds}`,
    condPay: (level) => `Pay grade: E ${level} or higher`,
    condWorkload: (pct) => `Hours: at least ${fmtPct(pct)}`,
    condPermanent: 'Permanent',
    condLangDe: 'Posting in German',
    condLangEn: 'Posting in English',
    langDe: 'German',
    langEn: 'English',
    via: {
      Stellenart: 'via position type',
      Entgelt: 'via pay grade',
      Umfang: 'via hours',
      Befristung: 'via permanent contract',
      Sprache: 'via language',
    },
    viaTerm: (term) => `via “${term}”`,
    editEntry: 'Edit entry',
    newEntry: 'New entry',
    avoidHint: 'Rather not: takes off 5 points per heart, but never filters anything out.',
    category: (name) => `Category: ${name}`,
    labelField: 'Name',
    labelPlaceholder: 'e.g. emotion regulation',
    howImportant: 'How important?',
    importance: 'Importance',
    termsField: 'Terms (one match is enough, one per line)',
    termsHelp: 'How terms match',
    ruleStart: 'matches the start of a word: kognitiv, Kognition, but not cognitive (add other spellings separately).',
    ruleStar: 'with an asterisk matches anywhere in a word, even in Neuropsychologie.',
    ruleQuoted: 'in quotation marks only matches the whole word.',
    ruleCase: 'Upper and lower case and umlauts don’t matter (ä = ae).',
    conditionField: 'Condition (optional)',
    countsHalf: 'If the posting doesn’t say, the entry counts half.',
    tryLabel: 'Quick test:',
    tryResult: (yes, total) => `matches ${yes} of ${total} open ${total === 1 ? 'posting' : 'postings'}`,
    tryUnknown: (n) => `, unclear for ${n} (counts half)`,
    errLabel: 'Please enter a name.',
    errKind: 'Pick at least one position type or add some terms.',
    errTerms: 'Add some terms or pick a condition.',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    importanceOf: (label) => `Importance of ${label}`,
    editItem: (label) => `Edit ${label}`,
    termsLine: (list, more) => `Terms: ${list}${more > 0 ? ` and ${more} more` : ''}`,
    title: 'Search profile',
    introA: 'A category is full as soon as entries with ',
    introHearts: 'three hearts',
    introB: ' in total show up in a posting. If a posting doesn’t mention something at all (no pay grade, for example), the entry counts half. The match only sorts; nothing ever gets filtered out.',
    previewTop: 'At the top with this profile:',
    previewHigh: (high, total) => `${high} of ${total} open ${total === 1 ? 'posting matches' : 'postings match'} ${fmtPct(75)} or more`,
    share: (pct) => `${fmtPct(pct)} of the match`,
    notCounting: 'doesn’t count',
    weight: 'Weight',
    weightValue: (w, pct) => `${w}, that’s ${pct} percent of the match`,
    noEntries: 'No entries yet. Empty categories don’t count.',
    addEntry: 'Add entry',
    avoid: 'Rather not',
    avoidPenalty: '−5 points per heart',
    avoidText: 'Moves postings down, but never hides anything.',
    horizon: 'Horizon',
    horizonTag: 'beyond the core',
    horizonText: 'Bridges into other fields, plus Beyond, where the AI spots transferable skills. Doesn’t count toward the match; these cards get mixed into the stack.',
    editHorizon: 'Edit Horizon',
    reset: 'Reset to starter profile',
    resetDone: 'Starter profile restored.',
    undo: 'Undo',
    deleted: (label) => `Deleted “${label}”.`,
  },
  sr: {
    cond: {
      none: 'Bez uslova, samo pojmovi',
      kind: 'Vrsta pozicije',
      payMin: 'Minimalni platni razred',
      workloadMin: 'Minimalni obim zaposlenja',
      permanent: 'Na neodređeno',
      language: 'Jezik oglasa',
    },
    condKind: (kinds) => `Vrsta pozicije: ${kinds}`,
    condPay: (level) => `Platni razred: E ${level} ili viši`,
    condWorkload: (pct) => `Obim zaposlenja: najmanje ${fmtPct(pct)}`,
    condPermanent: 'Na neodređeno',
    condLangDe: 'Oglas na nemačkom',
    condLangEn: 'Oglas na engleskom',
    langDe: 'Nemački',
    langEn: 'Engleski',
    via: {
      Stellenart: 'preko vrste pozicije',
      Entgelt: 'preko platnog razreda',
      Umfang: 'preko obima zaposlenja',
      Befristung: 'preko ugovora na neodređeno',
      Sprache: 'preko jezika',
    },
    viaTerm: (term) => `preko „${term}“`,
    editEntry: 'Izmeni stavku',
    newEntry: 'Nova stavka',
    avoidHint: 'Radije ne: oduzima 5 poena po srcu, ali nikad ništa ne izbacuje.',
    category: (name) => `Kategorija: ${name}`,
    labelField: 'Naziv',
    labelPlaceholder: 'npr. regulacija emocija',
    howImportant: 'Koliko je važno?',
    importance: 'Važnost',
    termsField: 'Pojmovi (dovoljan je jedan, svaki u svom redu)',
    termsHelp: 'Kako se pojmovi prepoznaju',
    ruleStart: 'prepoznaje reči koje tako počinju: kognitiv, Kognition, ali ne i cognitive (drugačiji način pisanja unesi posebno).',
    ruleStar: 'sa zvezdicom pronalazi se bilo gde u reči, pa i u Neuropsychologie.',
    ruleQuoted: 'pod navodnicima prepoznaje samo celu reč.',
    ruleCase: 'Velika i mala slova i umlauti nisu bitni (ä = ae).',
    conditionField: 'Uslov (opciono)',
    countsHalf: 'Ako oglas to ne navodi, stavka se računa upola.',
    tryLabel: 'Brza provera:',
    tryResult: (yes, total) => `pogađa ${yes} od ${total} ${srForm(total, 'otvorenog oglasa', 'otvorena oglasa', 'otvorenih oglasa')}`,
    tryUnknown: (n) => `, za ${n} nije jasno (računa se upola)`,
    errLabel: 'Unesi naziv.',
    errKind: 'Izaberi bar jednu vrstu pozicije ili unesi pojmove.',
    errTerms: 'Unesi pojmove ili izaberi uslov.',
    save: 'Sačuvaj',
    cancel: 'Otkaži',
    delete: 'Obriši',
    importanceOf: (label) => `Važnost: ${label}`,
    editItem: (label) => `Izmeni: ${label}`,
    termsLine: (list, more) => `Pojmovi: ${list}${more > 0 ? ` i još ${more}` : ''}`,
    title: 'Profil pretrage',
    introA: 'Kategorija je popunjena čim se u oglasu pojave stavke koje zajedno imaju ',
    introHearts: 'tri srca',
    introB: '. Ako oglas nešto uopšte ne navodi (na primer platu), stavka se računa upola. Poklapanje samo određuje redosled, ništa se ne izbacuje.',
    previewTop: 'Na vrhu sa ovim profilom:',
    previewHigh: (high, total) => `${high} od ${total} ${srForm(total, 'otvorenog oglasa', 'otvorena oglasa', 'otvorenih oglasa')} ima poklapanje ${fmtPct(75)} ili više`,
    share: (pct) => `${fmtPct(pct)} poklapanja`,
    notCounting: 'ne računa se',
    weight: 'Težina',
    weightValue: (w, pct) => `${w}, to je ${pct} posto poklapanja`,
    noEntries: 'Još nema stavki. Prazne kategorije se ne računaju.',
    addEntry: 'Dodaj stavku',
    avoid: 'Radije ne',
    avoidPenalty: '−5 poena po srcu',
    avoidText: 'Pomera oglase naniže, ali ništa ne skriva.',
    horizon: 'Horizont',
    horizonTag: 'van jezgra',
    horizonText: 'Mostovi ka drugim oblastima i Daljina, u kojoj AI prepoznaje prenosive veštine. Ne računa se u poklapanje, a kartice se ubacuju u špil.',
    editHorizon: 'Izmeni Horizont',
    reset: 'Vrati na početni profil',
    resetDone: 'Početni profil je vraćen.',
    undo: 'Opozovi',
    deleted: (label) => `Stavka „${label}“ je obrisana.`,
  },
});

function conditionText(c: Condition | undefined): string | null {
  if (!c) return null;
  switch (c.type) {
    case 'kind':
      return t.condKind(c.kinds.map((k) => jobKindLabel(k)).join(', '));
    case 'payMin':
      return t.condPay(c.level);
    case 'workloadMin':
      return t.condWorkload(c.pct);
    case 'permanent':
      return t.condPermanent;
    case 'language':
      return c.lang === 'de' ? t.condLangDe : t.condLangEn;
  }
}

/** Worüber ein Eintrag gepasst hat: Feldname aus dem Kern oder ein Begriff in „…“. */
function viaText(via: string): string {
  const known = t.via[via];
  if (known) return known;
  const m = /^„(.*)“$/.exec(via);
  return m ? t.viaTerm(m[1]) : via;
}

function parseTerms(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function ItemEditor({ item, target, onSave, onDelete, onClose }: { item: ProfileItem | null; target: Target; onSave: (it: ProfileItem) => void; onDelete?: () => void; onClose: () => void }) {
  const views = useViews();
  // Angezeigt wird die übersetzte Bezeichnung; bleibt sie unverändert, wird die gespeicherte behalten.
  const [label, setLabel] = useState(item ? profileLabel(item.label) : '');
  const [hearts, setHearts] = useState<HeartCount>(item?.hearts ?? 2);
  const [terms, setTerms] = useState((item?.terms ?? []).join('\n'));
  const [condType, setCondType] = useState<CondType>(item?.condition?.type ?? (target === 'stelle' ? 'kind' : target === 'rahmen' ? 'payMin' : 'none'));
  const [kinds, setKinds] = useState(item?.condition?.type === 'kind' ? item.condition.kinds : []);
  const [level, setLevel] = useState(item?.condition?.type === 'payMin' ? item.condition.level : 13);
  const [pct, setPct] = useState(item?.condition?.type === 'workloadMin' ? item.condition.pct : 65);
  const [lang, setLang] = useState<'de' | 'en'>(item?.condition?.type === 'language' ? item.condition.lang : 'de');
  const [error, setError] = useState<'label' | 'kind' | 'terms' | null>(null);

  const condition: Condition | undefined =
    condType === 'none'
      ? undefined
      : condType === 'kind'
        ? kinds.length
          ? { type: 'kind', kinds }
          : undefined
        : condType === 'payMin'
          ? { type: 'payMin', level }
          : condType === 'workloadMin'
            ? { type: 'workloadMin', pct }
            : condType === 'permanent'
              ? { type: 'permanent' }
              : { type: 'language', lang };
  const termList = parseTerms(terms);

  const draft = useMemo<ProfileItem>(
    () => ({ id: item?.id ?? newItemId(target === 'avoid' ? 'a' : target[0]), label: label.trim() || t.newEntry, hearts, terms: termList.length ? termList : undefined, condition }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [label, hearts, terms, condType, kinds, level, pct, lang],
  );

  // Ausprobieren an den offenen Anzeigen
  const test = useMemo(() => {
    const today = todayBerlin();
    let yes = 0;
    let unknown = 0;
    const examples: { id: string; title: string; via: string | null }[] = [];
    let total = 0;
    for (const v of views.values()) {
      if (!isOpen(v.job, today)) continue;
      total++;
      const hit = matchItem(draft, v.job, v.norm);
      if (hit.state === 'ja') {
        yes++;
        if (examples.length < 4) examples.push({ id: v.job.id, title: v.job.title, via: hit.via });
      } else if (hit.state === 'unbekannt') unknown++;
    }
    return { yes, unknown, total, examples };
  }, [draft, views]);

  const save = () => {
    const typed = label.trim();
    if (!typed) return setError('label');
    if (!termList.length && !condition) return setError(condType === 'kind' ? 'kind' : 'terms');
    // Unveränderte (übersetzt angezeigte) Bezeichnung: die gespeicherte deutsche behalten
    const kept = item && typed === profileLabel(item.label).trim() ? item.label : typed;
    onSave({ ...draft, label: kept });
  };

  const condOptions: CondType[] = ['none', 'kind', 'payMin', 'workloadMin', 'permanent', 'language'];
  const errorText = error === 'label' ? t.errLabel : error === 'kind' ? t.errKind : error === 'terms' ? t.errTerms : null;

  return (
    <Sheet title={item ? t.editEntry : t.newEntry} onClose={onClose} full>
      <p className="hint" style={{ marginTop: 0 }}>
        {target === 'avoid' ? t.avoidHint : t.category(categoryLabel(target))}
      </p>
      <label className="field">
        <span>{t.labelField}</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t.labelPlaceholder} maxLength={120} />
      </label>
      <div className="field">
        <span>{t.howImportant}</span>
        <Hearts value={hearts} onChange={setHearts} label={t.importance} />
      </div>
      <label className="field">
        <span>{t.termsField}</span>
        <textarea className="input" style={{ minHeight: 110 }} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={'emotionsregulation\nemotion regulation\n*affekt'} spellCheck={false} />
      </label>
      <details className="help">
        <summary>{t.termsHelp}</summary>
        <ul>
          <li>
            <b>kognit</b> {t.ruleStart}
          </li>
          <li>
            <b>*psych</b> {t.ruleStar}
          </li>
          <li>
            <b>"R"</b> {t.ruleQuoted}
          </li>
          <li>{t.ruleCase}</li>
        </ul>
      </details>
      <label className="field">
        <span>{t.conditionField}</span>
        <select className="select" value={condType} onChange={(e) => setCondType(e.target.value as CondType)}>
          {condOptions.map((c) => (
            <option key={c} value={c}>
              {t.cond[c]}
            </option>
          ))}
        </select>
      </label>
      {condType === 'kind' && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {JOB_KINDS.filter((k) => k !== 'sonstige').map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kinds.includes(k)} onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
              {jobKindLabel(k)}
            </button>
          ))}
        </div>
      )}
      {condType === 'payMin' && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {[9, 10, 11, 12, 13, 14, 15].map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={level === l} onClick={() => setLevel(l)}>
              E {l}
            </button>
          ))}
        </div>
      )}
      {condType === 'workloadMin' && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {[50, 65, 75, 80, 100].map((p) => (
            <button key={p} type="button" className="chip" aria-pressed={pct === p} onClick={() => setPct(p)}>
              {fmtPct(p)}
            </button>
          ))}
        </div>
      )}
      {condType === 'language' && (
        <div className="chips" style={{ marginBottom: 8 }}>
          {(['de', 'en'] as const).map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l === 'de' ? t.langDe : t.langEn}
            </button>
          ))}
        </div>
      )}
      {condition && <p className="hint">{t.countsHalf}</p>}

      <div className="notice notice--info" style={{ marginTop: 14 }} aria-live="polite">
        <b>{t.tryLabel}</b> {t.tryResult(test.yes, test.total)}
        {test.unknown ? t.tryUnknown(test.unknown) : ''}.
        {test.examples.length > 0 && (
          <ul className="test-list">
            {test.examples.map((e) => (
              <li key={e.id}>
                <button type="button" className="linkish" onClick={() => openJob(e.id)}>
                  {e.title}
                </button>
                {e.via && <small> {viaText(e.via)}</small>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {errorText && (
        <p className="notice notice--warn" role="alert" style={{ marginTop: 12 }}>
          {errorText}
        </p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" className="btn btn--primary" onClick={save}>
          {t.save}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          {t.cancel}
        </button>
        {onDelete && (
          <button type="button" className="btn btn--quiet" onClick={onDelete}>
            <IconTrash width={18} height={18} /> {t.delete}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function ItemLine({ item, onHearts, onEdit }: { item: ProfileItem; onHearts: (h: HeartCount) => void; onEdit: () => void }) {
  const cond = conditionText(item.condition);
  const terms = item.terms ?? [];
  const label = profileLabel(item.label);
  return (
    <div className="profile-item">
      <button type="button" className="profile-item__label linkish" onClick={onEdit}>
        {label}
      </button>
      <Hearts value={item.hearts} onChange={onHearts} label={t.importanceOf(label)} />
      <button type="button" className="icon-btn" onClick={onEdit} aria-label={t.editItem(label)}>
        <IconPencil width={20} height={20} />
      </button>
      {(cond || terms.length > 0) && (
        <p className="profile-item__terms">
          {cond}
          {cond && terms.length ? '; ' : ''}
          {terms.length > 0 && t.termsLine(terms.slice(0, 6).join(', '), terms.length - 6)}
        </p>
      )}
    </div>
  );
}

export function ProfileEditor() {
  const s = useAppState();
  const store = useStore();
  const views = useViews();
  const p = s.settings.profile;
  const [editing, setEditing] = useState<{ target: Target; item: ProfileItem | null } | null>(null);

  const save = (next: Suchprofil, toastText?: string) => {
    const prev = p;
    // Profilname bleibt gespeicherte Daten (deutsch); angezeigt wird er über profileName()
    store.updateSettings('profile', { ...next, origin: next.origin === 'start' ? 'manuell' : next.origin, name: next.origin === 'start' ? 'Eigenes Profil' : next.name, updatedAt: new Date().toISOString() });
    if (toastText) store.toast(toastText, { label: t.undo, run: () => store.updateSettings('profile', prev) });
  };

  const updateItems = (target: Target, fn: (items: ProfileItem[]) => ProfileItem[]) => {
    if (target === 'avoid') return { ...p, avoid: fn(p.avoid) };
    return { ...p, categories: p.categories.map((c) => (c.id === target ? { ...c, items: fn(c.items) } : c)) };
  };

  const active = p.categories.filter((c) => c.items.length && c.weight > 0);
  const weightSum = active.reduce((a, c) => a + c.weight, 0) || 1;

  const preview = useMemo(() => {
    const today = todayBerlin();
    const open = [...views.values()].filter((v) => isOpen(v.job, today));
    const sorted = open.sort((a, b) => b.score.score - a.score.score);
    const high = open.filter((v) => v.score.score >= 75).length;
    return { top: sorted.slice(0, 3), high, total: open.length };
  }, [views]);

  return (
    <SubPage title={t.title} sub={profileName(p.name)}>
      <p className="notice">
        {t.introA}
        <b>{t.introHearts}</b>
        {t.introB}
      </p>

      {preview.total > 0 && (
        <div className="preview">
          <p className="preview__head">
            {t.previewTop} <small>{t.previewHigh(preview.high, preview.total)}</small>
          </p>
          <ol>
            {preview.top.map((v) => (
              <li key={v.job.id}>
                <span className="mini-score" style={{ color: scoreTone(v.score.score) }}>
                  {v.score.score}
                  <small>%</small>
                </span>
                <button type="button" className="linkish" onClick={() => openJob(v.job.id)}>
                  {v.job.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {CATEGORY_ORDER.map((id) => {
        const c = p.categories.find((x) => x.id === id)!;
        const isActive = c.items.length > 0 && c.weight > 0;
        const share = isActive ? Math.round((c.weight / weightSum) * 100) : 0;
        return (
          <section key={id} className="cat-card" aria-labelledby={`cat-${id}`}>
            <div className="cat-card__head">
              <h2 id={`cat-${id}`} className="section-title" style={{ margin: 0 }}>
                {categoryLabel(id)}
              </h2>
              <span className="cat-card__share">{isActive ? t.share(share) : t.notCounting}</span>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              {categoryHint(id)}
            </p>
            <label className="weight">
              <span>{t.weight}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={c.weight}
                onChange={(e) => save({ ...p, categories: p.categories.map((x) => (x.id === id ? { ...x, weight: Number(e.target.value) } : x)) })}
                aria-valuetext={t.weightValue(c.weight, share)}
              />
              <span style={{ minWidth: 30, textAlign: 'right' }}>{c.weight}</span>
            </label>
            {c.items.length === 0 && <p className="hint">{t.noEntries}</p>}
            {c.items.map((it) => (
              <ItemLine
                key={it.id}
                item={it}
                onHearts={(h) => save(updateItems(id, (items) => items.map((x) => (x.id === it.id ? { ...x, hearts: h } : x))))}
                onEdit={() => setEditing({ target: id, item: it })}
              />
            ))}
            <button type="button" className="btn btn--quiet btn--small" onClick={() => setEditing({ target: id, item: null })}>
              <IconPlus width={18} height={18} /> {t.addEntry}
            </button>
          </section>
        );
      })}

      <section className="cat-card cat-card--avoid" aria-labelledby="cat-avoid">
        <div className="cat-card__head">
          <h2 id="cat-avoid" className="section-title" style={{ margin: 0 }}>
            {t.avoid}
          </h2>
          <span className="cat-card__share">{t.avoidPenalty}</span>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          {t.avoidText}
        </p>
        {p.avoid.map((it) => (
          <ItemLine
            key={it.id}
            item={it}
            onHearts={(h) => save(updateItems('avoid', (items) => items.map((x) => (x.id === it.id ? { ...x, hearts: h } : x))))}
            onEdit={() => setEditing({ target: 'avoid', item: it })}
          />
        ))}
        <button type="button" className="btn btn--quiet btn--small" onClick={() => setEditing({ target: 'avoid', item: null })}>
          <IconPlus width={18} height={18} /> {t.addEntry}
        </button>
      </section>

      <section className="cat-card cat-card--horizon" aria-labelledby="cat-horizont">
        <div className="cat-card__head">
          <h2 id="cat-horizont" className="section-title" style={{ margin: 0 }}>
            {t.horizon}
          </h2>
          <span className="cat-card__share">{t.horizonTag}</span>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          {t.horizonText}
        </p>
        <button type="button" className="btn btn--small" onClick={() => navigate('/ich/horizont')}>
          {t.editHorizon}
        </button>
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0 8px' }}>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const prev = p;
            store.updateSettings('profile', { ...starterProfile(), horizont: p.horizont });
            store.toast(t.resetDone, { label: t.undo, run: () => store.updateSettings('profile', prev) });
          }}
        >
          {t.reset}
        </button>
      </div>

      {editing && (
        <ItemEditor
          item={editing.item}
          target={editing.target}
          onClose={() => setEditing(null)}
          onSave={(it) => {
            const exists = editing.item != null;
            save(updateItems(editing.target, (items) => (exists ? items.map((x) => (x.id === it.id ? it : x)) : [...items, it])));
            setEditing(null);
          }}
          onDelete={
            editing.item
              ? () => {
                  const id = editing.item!.id;
                  save(
                    updateItems(editing.target, (items) => items.filter((x) => x.id !== id)),
                    t.deleted(profileLabel(editing.item!.label)),
                  );
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </SubPage>
  );
}
