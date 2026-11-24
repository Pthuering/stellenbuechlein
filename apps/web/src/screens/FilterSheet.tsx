// Filter für Stapel und Liste. Blenden nur aus – gelöscht wird nichts. Im Stapel dazu die Reihenfolge.
// Oben die gespeicherten Filter zum Anwenden, unten Speichern unter einem Namen und der Push-Schalter:
// Gespeicherte Filter mit Push meldet das Einsammeln, egal welcher Filter gerade im Stapel gilt.

import { useEffect, useState } from 'react';
import {
  countActiveFilters,
  DEFAULT_FILTER,
  INSTITUTION_KINDS,
  laneAllowed,
  LOW_MODES,
  STATE_CODES,
  type DeckOrder,
  type InstitutionKind,
  type JobFilter,
  type JobKind,
  type Lane,
  type SavedFilter,
  type StateCode,
} from '@stellen/core';
import { useAppState, useStore } from '../data/hooks';
import { navigate } from '../lib/router';
import { pushState, type PushState } from '../lib/push';
import { addSavedFilter, removeSavedFilter, savedFilterFor, suggestFilterName, updateSavedFilter } from '../lib/savedFilters';
import { Sheet } from '../ui/Sheet';
import { CityPicker } from '../ui/CityPicker';
import { IconBell } from '../ui/icons';
import { fmtPct, srForm, texts } from '../i18n';
import { institutionKindLabel, jobKindLabel, stateName } from '../i18n/labels';

const RADII: (number | null)[] = [null, 25, 50, 100, 200, 300];
const KINDS: JobKind[] = ['promotion', 'postdoc', 'wiss_ma', 'professur', 'projekt', 'lehre', 'klinik', 'shk', 'verwaltung'];
const INST_KINDS: readonly InstitutionKind[] = INSTITUTION_KINDS;
// Brücken- und Horizont-Karten lassen sich ausblenden; die normalen Einträge (intern „kern“) kommen immer.
const OUTER: ('horizont' | 'weite')[] = ['horizont', 'weite'];

/** Schaltet Brücken- oder Horizont-Karten um; leer heißt „alles zeigen“. */
function toggleOuter(f: JobFilter, l: 'horizont' | 'weite'): Lane[] {
  const shown = OUTER.filter((x) => (x === l ? !laneAllowed(f, x) : laneAllowed(f, x)));
  return shown.length === OUTER.length ? [] : ['kern', ...shown];
}
const MIN_SCORES = [50, 60, 70, 80, 90];
// Schwelle für „gut passende durch“: normale Einträge darunter gelten als weniger passend
const LOW_SCORES = [40, 51, 60, 70];
const URGENT_DAYS = [7, 14, 30, 60];
const TERM_YEARS = [1, 2, 3, 5];

const t = texts({
  de: {
    title: 'Filter',
    intro: 'Filter blenden Anzeigen nur aus. Gelöscht wird nichts, und der Score sortiert weiter.',
    savedTitle: 'Gespeicherte Filter',
    savedHint: 'Antippen wendet den Filter an. Mit Glocke: Neue Treffer kommen als Benachrichtigung.',
    allPostings: 'Alle Anzeigen',
    order: 'Reihenfolge im Stapel',
    orderHint: 'Sortiert wird nach Passung, die beste Karte zuerst.',
    topFirst: 'Gut passende zuerst',
    topFirstHint: 'Erst alle Karten ab dieser Passung, danach der Rest.',
    off: 'aus',
    fromPct: (p: string) => `ab ${p}`,
    urgentFirst: 'Nahe Fristen zuerst',
    urgentFirstHint: 'Karten mit naher Frist kommen vor den anderen, bei den gut passenden und beim Rest.',
    urgentWithin: 'Nah heißt höchstens',
    period: (d: number) => (d === 7 ? '1 Woche' : d === 14 ? '2 Wochen' : d === 30 ? '1 Monat' : d === 60 ? '2 Monate' : `${d} Tage`),
    low: 'Wenn die gut passenden durch sind',
    lowBelow: (p: string) => `unter ${p}`,
    lowModes: { fragen: 'nachfragen', mehr: 'öfter Brücken, Horizont & Ausland', normal: 'normal weiter' },
    lowHints: {
      off: 'Aus: Der Stapel mischt Brücken, Horizont und Ausland immer im gewohnten Rhythmus.',
      fragen: 'Liegen die übrigen normalen Einträge alle unter dieser Passung, fragt der Stapel einmal, ob jetzt öfter Brücken, Horizont und Ausland kommen sollen.',
      mehr: 'Nach dem letzten normalen Eintrag ab dieser Passung kommen Brücken- und Horizont-Karten eine Stufe häufiger und Auslandsstellen jede dritte Karte.',
      normal: 'Auch unter dieser Passung geht es im gewohnten Rhythmus weiter.',
    },
    ring: 'Brücken und Horizont',
    outerCards: { horizont: 'Brücken-Karten', weite: 'Horizont-Karten' },
    ringHint: 'Normale Einträge kommen immer. Brücken-Karten kommen über eine deiner Brücken aus anderen Feldern, Horizont-Karten schlägt die KI ohne Brücke vor. Beide haben keine Prozentzahl und kommen im Stapel unabhängig von den übrigen Filtern. Hier lassen sie sich ausblenden.',
    newSitesOnly: 'Nur von neuen Websites',
    newSitesHint: 'Anzeigen von Websites, die beim Fund noch nicht im Quellen-Register standen',
    minScore: 'Passung mindestens',
    minScoreHint: 'Blendet Anzeigen unter dieser Passung aus (anders als „Gut passende zuerst“, das nur sortiert).',
    radius: 'Umkreis',
    allGermany: 'Ganz Deutschland',
    measuredFrom: (home: string) => `gemessen ab ${home} (änderbar unter „Ich“)`,
    cities: 'Städte',
    states: 'Bundesländer',
    kind: 'Stellenart',
    instKind: 'Art der Einrichtung',
    conditions: 'Rahmen',
    payMin: 'Entgelt mindestens',
    workloadMin: 'Umfang mindestens',
    deadline: 'Frist',
    any: 'egal',
    daysLeft: (d: number) => `noch mind. ${d} Tage`,
    missingHint: 'Fehlt eine Angabe zu Entgelt oder Umfang, bleibt die Anzeige sichtbar.',
    term: 'Vertragsdauer',
    termYears: (y: number) => `mind. ${y} ${y === 1 ? 'Jahr' : 'Jahre'}`,
    termPermanent: 'nur unbefristet',
    termHint: 'Unbefristete Stellen zählen bei jeder Mindestdauer mit. Bei „befristet bis …“ zählt die Zeit ab heute.',
    termUnknown: 'Auch Anzeigen ohne Angabe zur Dauer',
    termUnknownHint: 'Viele Anzeigen nennen keine Dauer. Claude ergänzt sie beim Auswerten, wo der Text sie hergibt.',
    saveTitle: 'Speichern und benachrichtigen',
    saveEmpty: 'Wähle oben Kriterien. Dann kannst du den Filter unter einem Namen speichern und dir neue Treffer melden lassen.',
    nameLabel: 'Name des Filters',
    save: 'Filter speichern',
    saveChanges: (name: string) => `Änderungen in „${name}“ speichern`,
    savedAs: (name: string) => `Gespeichert als „${name}“`,
    push: 'Neue Treffer als Benachrichtigung',
    pushHint: 'Kommt mit dem täglichen Einsammeln, egal welcher Filter gerade im Stapel gilt. Ein- und ausschalten geht auch unter „Ich → Erinnerungen“.',
    rename: 'Umbenennen',
    apply: 'Übernehmen',
    remove: 'Löschen',
    removed: (name: string) => `„${name}“ gelöscht.`,
    undo: 'Rückgängig',
    savedToast: (name: string) => `„${name}“ gespeichert.`,
    deviceOff: 'Auf diesem Gerät sind Benachrichtigungen noch aus.',
    deviceOn: 'Einschalten',
    done: 'Fertig',
    reset: 'Alle Filter zurücksetzen',
  },
  en: {
    title: 'Filters',
    intro: 'Filters only hide postings. Nothing gets deleted, and the match score keeps sorting.',
    savedTitle: 'Saved filters',
    savedHint: 'Tap to apply a filter. With a bell: new matches arrive as notifications.',
    allPostings: 'All postings',
    order: 'Stack order',
    orderHint: 'Sorted by match, best card first.',
    topFirst: 'Good matches first',
    topFirstHint: 'First every card with at least this match, then the rest.',
    off: 'off',
    fromPct: (p) => `from ${p}`,
    urgentFirst: 'Close deadlines first',
    urgentFirstHint: 'Cards with a close deadline come before the others, among the good matches and among the rest.',
    urgentWithin: 'Close means at most',
    period: (d) => (d === 7 ? '1 week' : d === 14 ? '2 weeks' : d === 30 ? '1 month' : d === 60 ? '2 months' : `${d} days`),
    low: 'When the good matches are used up',
    lowBelow: (p) => `below ${p}`,
    lowModes: { fragen: 'ask me', mehr: 'more Bridges, Horizon & abroad', normal: 'carry on as usual' },
    lowHints: {
      off: 'Off: the stack always mixes in Bridges, Horizon and abroad at the usual pace.',
      fragen: 'Once all remaining regular entries are below this match, the stack asks once whether Bridges, Horizon and abroad should come more often.',
      mehr: 'After the last regular entry at or above this match, Bridge and Horizon cards come one step more often and postings abroad every third card.',
      normal: 'Below this match, too, the stack carries on at the usual pace.',
    },
    ring: 'Bridges and Horizon',
    outerCards: { horizont: 'Bridge cards', weite: 'Horizon cards' },
    ringHint: 'Regular entries always show. Bridge cards come from other fields through one of your bridges; Horizon cards are suggested by the AI without a bridge. Neither has a match percentage, and in the stack they appear regardless of the other filters. You can hide them here.',
    newSitesOnly: 'Only from new websites',
    newSitesHint: 'Postings from websites that weren’t in the registry yet when they were found',
    minScore: 'Match at least',
    minScoreHint: 'Hides postings below this match (unlike “Good matches first”, which only sorts).',
    radius: 'Radius',
    allGermany: 'All of Germany',
    measuredFrom: (home) => `measured from ${home} (change it under “Me”)`,
    cities: 'Cities',
    states: 'Federal states',
    kind: 'Position type',
    instKind: 'Type of institution',
    conditions: 'Conditions',
    payMin: 'Pay grade at least',
    workloadMin: 'Hours at least',
    deadline: 'Deadline',
    any: 'any',
    daysLeft: (d) => `at least ${d} days left`,
    missingHint: 'If a posting leaves out the pay or the hours, it stays visible.',
    term: 'Contract length',
    termYears: (y) => `at least ${y} ${y === 1 ? 'year' : 'years'}`,
    termPermanent: 'permanent only',
    termHint: 'Permanent positions count for any minimum length. For “fixed-term until …”, the time from today counts.',
    termUnknown: 'Also postings that don’t mention the length',
    termUnknownHint: 'Many postings don’t state a length. Claude fills it in during evaluation where the text gives it.',
    saveTitle: 'Save and get notified',
    saveEmpty: 'Choose some criteria above. Then you can save the filter under a name and get notified about new matches.',
    nameLabel: 'Filter name',
    save: 'Save filter',
    saveChanges: (name) => `Save changes to “${name}”`,
    savedAs: (name) => `Saved as “${name}”`,
    push: 'Notify me about new matches',
    pushHint: 'Arrives with the daily collecting run, no matter which filter is active in the stack. You can also turn it on and off under “Me → Reminders”.',
    rename: 'Rename',
    apply: 'Apply',
    remove: 'Delete',
    removed: (name) => `“${name}” deleted.`,
    undo: 'Undo',
    savedToast: (name) => `“${name}” saved.`,
    deviceOff: 'Notifications are still off on this device.',
    deviceOn: 'Turn on',
    done: 'Done',
    reset: 'Reset all filters',
  },
  sr: {
    title: 'Filteri',
    intro: 'Filteri samo sakrivaju oglase. Ništa se ne briše, a poklapanje i dalje određuje redosled.',
    savedTitle: 'Sačuvani filteri',
    savedHint: 'Dodirni da primeniš filter. Sa zvoncem: novi pogoci stižu kao obaveštenja.',
    allPostings: 'Svi oglasi',
    order: 'Redosled u špilu',
    orderHint: 'Redosled prati poklapanje, najbolja kartica je prva.',
    topFirst: 'Prvo dobra poklapanja',
    topFirstHint: 'Prvo sve kartice sa barem ovolikim poklapanjem, zatim ostale.',
    off: 'isključeno',
    fromPct: (p) => `od ${p}`,
    urgentFirst: 'Prvo bliski rokovi',
    urgentFirstHint: 'Kartice sa bliskim rokom dolaze pre ostalih, i među dobrim poklapanjima i među ostalima.',
    urgentWithin: 'Blizu znači najviše',
    period: (d) => (d === 7 ? '1 nedelja' : d === 14 ? '2 nedelje' : d === 30 ? '1 mesec' : d === 60 ? '2 meseca' : `${d} ${srForm(d, 'dan', 'dana', 'dana')}`),
    low: 'Kad nestane dobrih poklapanja',
    lowBelow: (p) => `ispod ${p}`,
    lowModes: { fragen: 'pitaj me', mehr: 'češće Mostovi, Horizont i inostranstvo', normal: 'nastavi normalno' },
    lowHints: {
      off: 'Isključeno: špil uvek ubacuje Mostove, Horizont i inostranstvo uobičajenim ritmom.',
      fragen: 'Kad su svi preostali obični oglasi ispod ovog poklapanja, špil jednom pita da li da češće dolaze Mostovi, Horizont i inostranstvo.',
      mehr: 'Posle poslednjeg običnog oglasa sa ovim ili većim poklapanjem, kartice preko mosta i sa horizonta dolaze za stepen češće, a oglasi iz inostranstva kao svaka treća kartica.',
      normal: 'I ispod ovog poklapanja špil nastavlja uobičajenim ritmom.',
    },
    ring: 'Mostovi i Horizont',
    outerCards: { horizont: 'Kartice preko mosta', weite: 'Kartice sa horizonta' },
    ringHint: 'Obični oglasi se uvek prikazuju. Kartice preko mosta dolaze iz drugih oblasti preko nekog tvog mosta, a kartice sa horizonta predlaže AI bez mosta. Nijedne nemaju procenat poklapanja i u špilu se pojavljuju nezavisno od ostalih filtera. Ovde ih možeš sakriti.',
    newSitesOnly: 'Samo sa novih sajtova',
    newSitesHint: 'Oglasi sa sajtova koji u trenutku pronalaska još nisu bili u registru',
    minScore: 'Poklapanje najmanje',
    minScoreHint: 'Sakriva oglase ispod ovog poklapanja (za razliku od opcije „Prvo dobra poklapanja“, koja samo menja redosled).',
    radius: 'Radijus',
    allGermany: 'Cela Nemačka',
    measuredFrom: (home) => `polazna tačka: ${home} (možeš je promeniti u odeljku „Ja“)`,
    cities: 'Gradovi',
    states: 'Savezne pokrajine',
    kind: 'Vrsta pozicije',
    instKind: 'Vrsta ustanove',
    conditions: 'Uslovi',
    payMin: 'Platni razred najmanje',
    workloadMin: 'Obim zaposlenja najmanje',
    deadline: 'Rok',
    any: 'svejedno',
    daysLeft: (d) => `još najmanje ${d} ${srForm(d, 'dan', 'dana', 'dana')}`,
    missingHint: 'Ako u oglasu nedostaje plata ili obim zaposlenja, oglas ostaje vidljiv.',
    term: 'Trajanje ugovora',
    termYears: (y) => `najmanje ${y} ${srForm(y, 'godina', 'godine', 'godina')}`,
    termPermanent: 'samo na neodređeno',
    termHint: 'Pozicije na neodređeno se računaju uz svako minimalno trajanje. Kod „na određeno do …“ računa se vreme od danas.',
    termUnknown: 'I oglasi bez podatka o trajanju',
    termUnknownHint: 'Mnogi oglasi ne navode trajanje. Claude ga dopunjuje pri obradi, kada tekst to omogućava.',
    saveTitle: 'Sačuvaj i primaj obaveštenja',
    saveEmpty: 'Izaberi kriterijume gore. Onda možeš da sačuvaš filter pod nekim imenom i da dobijaš obaveštenja o novim pogocima.',
    nameLabel: 'Ime filtera',
    save: 'Sačuvaj filter',
    saveChanges: (name) => `Sačuvaj izmene u „${name}“`,
    savedAs: (name) => `Sačuvano kao „${name}“`,
    push: 'Obavesti me o novim pogocima',
    pushHint: 'Stiže uz svakodnevni prolaz prikupljanja, bez obzira na to koji filter trenutno važi u špilu. Možeš ga uključiti i isključiti i u odeljku „Ja → Podsetnici“.',
    rename: 'Preimenuj',
    apply: 'Primeni',
    remove: 'Obriši',
    removed: (name) => `„${name}“ je obrisan.`,
    undo: 'Opozovi',
    savedToast: (name) => `„${name}“ je sačuvan.`,
    deviceOff: 'Na ovom uređaju obaveštenja su još isključena.',
    deviceOn: 'Uključi',
    done: 'Gotovo',
    reset: 'Poništi sve filtere',
  },
});

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** deck: aus dem Stapel geöffnet, dann steht oben die Reihenfolge im Stapel. */
export function FilterSheet({ onClose, deck = false }: { onClose: () => void; deck?: boolean }) {
  const s = useAppState();
  const store = useStore();
  const f = s.settings.filter;
  const set = (patch: Partial<JobFilter>) => store.updateSettings('filter', { ...f, ...patch });
  const o = s.settings.deck;
  const setOrder = (patch: Partial<DeckOrder>) => store.updateSettings('deck', { ...o, ...patch });
  const saved = s.settings.savedFilters;
  const active = savedFilterFor(f, saved);
  // Zuletzt angewendeter gespeicherter Filter: Wird er danach verändert, lässt sich die Änderung in ihn übernehmen
  const [baseId, setBaseId] = useState<string | null>(active?.id ?? null);
  const base = !active && baseId ? (saved.find((x) => x.id === baseId) ?? null) : null;
  const termMode = f.permanentOnly ? 'permanent' : f.minTermYears;

  const apply = (sf: SavedFilter | null) => {
    store.updateSettings('filter', sf ? { ...sf.filter } : { ...DEFAULT_FILTER, text: f.text });
    setBaseId(sf?.id ?? null);
  };

  return (
    <Sheet title={t.title} onClose={onClose} full>
      {saved.length > 0 && (
        <>
          <h3 className="section-title">{t.savedTitle}</h3>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={countActiveFilters({ ...f, text: '' }) === 0} onClick={() => apply(null)}>
              {t.allPostings}
            </button>
            {saved.map((sf) => (
              <button key={sf.id} type="button" className="chip" aria-pressed={active?.id === sf.id} onClick={() => apply(sf)}>
                {sf.push && <IconBell width={14} height={14} aria-hidden="true" style={{ verticalAlign: -2 }} />} {sf.name}
              </button>
            ))}
          </div>
          <p className="hint">{t.savedHint}</p>
        </>
      )}

      {deck && (
        <>
          <h3 className="section-title">{t.order}</h3>
          <p className="hint">{t.orderHint}</p>
          <div className="field">
            <span>{t.topFirst}</span>
            <div className="chips">
              {[null, ...MIN_SCORES].map((p) => (
                <button key={String(p)} type="button" className="chip" aria-pressed={o.minScore === p} onClick={() => setOrder({ minScore: p })}>
                  {p == null ? t.off : t.fromPct(fmtPct(p))}
                </button>
              ))}
            </div>
            <small className="hint">{t.topFirstHint}</small>
          </div>
          <label className="toggle">
            <span>
              {t.urgentFirst}
              <br />
              <small className="hint">{t.urgentFirstHint}</small>
            </span>
            <input type="checkbox" checked={o.urgentFirst} onChange={(e) => setOrder({ urgentFirst: e.target.checked })} />
          </label>
          {o.urgentFirst && (
            <div className="field">
              <span>{t.urgentWithin}</span>
              <div className="chips">
                {URGENT_DAYS.map((d) => (
                  <button key={d} type="button" className="chip" aria-pressed={o.urgentDays === d} onClick={() => setOrder({ urgentDays: d })}>
                    {t.period(d)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="field">
            <span>{t.low}</span>
            <div className="chips">
              {[null, ...LOW_SCORES].map((p) => (
                <button key={String(p)} type="button" className="chip" aria-pressed={o.lowBelow === p} onClick={() => setOrder({ lowBelow: p })}>
                  {p == null ? t.off : t.lowBelow(fmtPct(p))}
                </button>
              ))}
            </div>
            {o.lowBelow != null && (
              <div className="chips" style={{ marginTop: 6 }}>
                {LOW_MODES.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={o.lowMode === m} onClick={() => setOrder({ lowMode: m })}>
                    {t.lowModes[m]}
                  </button>
                ))}
              </div>
            )}
            <small className="hint">{o.lowBelow == null ? t.lowHints.off : t.lowHints[o.lowMode]}</small>
          </div>
        </>
      )}
      <p className="hint" style={deck || saved.length ? { marginTop: 18 } : undefined}>
        {t.intro}
      </p>

      <h3 className="section-title">{t.ring}</h3>
      <div className="chips">
        {OUTER.map((l) => (
          <button key={l} type="button" className="chip" aria-pressed={laneAllowed(f, l)} onClick={() => set({ lanes: toggleOuter(f, l) })}>
            {t.outerCards[l]}
          </button>
        ))}
      </div>
      <p className="hint">{t.ringHint}</p>
      <label className="toggle" style={{ marginTop: 4 }}>
        <span>
          {t.newSitesOnly}
          <br />
          <small className="hint">{t.newSitesHint}</small>
        </span>
        <input type="checkbox" checked={!!f.newSitesOnly} onChange={(e) => set({ newSitesOnly: e.target.checked })} />
      </label>

      <h3 className="section-title">{t.minScore}</h3>
      <div className="chips">
        {[null, ...MIN_SCORES].map((p) => (
          <button key={String(p)} type="button" className="chip" aria-pressed={f.minScore === p} onClick={() => set({ minScore: p })}>
            {p == null ? t.any : t.fromPct(fmtPct(p))}
          </button>
        ))}
      </div>
      {deck && <p className="hint">{t.minScoreHint}</p>}

      <h3 className="section-title">{t.radius}</h3>
      <div className="chips">
        {RADII.map((r) => (
          <button key={String(r)} type="button" className="chip" aria-pressed={f.radiusKm === r} onClick={() => set({ radiusKm: r })}>
            {r == null ? t.allGermany : `${r} km`}
          </button>
        ))}
      </div>
      <p className="hint">{t.measuredFrom(s.settings.home.label)}</p>

      <h3 className="section-title">{t.cities}</h3>
      <CityPicker value={f.cities} onChange={(cities) => set({ cities })} />

      <h3 className="section-title">{t.states}</h3>
      <div className="chips">
        {STATE_CODES.map((c: StateCode) => (
          <button key={c} type="button" className="chip" aria-pressed={f.states.includes(c)} onClick={() => set({ states: toggle(f.states, c) })}>
            {stateName(c)}
          </button>
        ))}
      </div>

      <h3 className="section-title">{t.kind}</h3>
      <div className="chips">
        {KINDS.map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={f.kinds.includes(k)} onClick={() => set({ kinds: toggle(f.kinds, k) })}>
            {jobKindLabel(k)}
          </button>
        ))}
      </div>

      <h3 className="section-title">{t.instKind}</h3>
      <div className="chips">
        {INST_KINDS.map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={f.institutionKinds.includes(k)} onClick={() => set({ institutionKinds: toggle(f.institutionKinds, k) })}>
            {institutionKindLabel(k)}
          </button>
        ))}
      </div>

      <h3 className="section-title">{t.conditions}</h3>
      <div className="field">
        <span>{t.payMin}</span>
        <div className="chips">
          {[null, 12, 13, 14].map((l) => (
            <button key={String(l)} type="button" className="chip" aria-pressed={f.payMin === l} onClick={() => set({ payMin: l })}>
              {l == null ? t.any : `E ${l}`}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>{t.workloadMin}</span>
        <div className="chips">
          {[null, 50, 65, 75, 100].map((p) => (
            <button key={String(p)} type="button" className="chip" aria-pressed={f.workloadMin === p} onClick={() => set({ workloadMin: p })}>
              {p == null ? t.any : fmtPct(p)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>{t.deadline}</span>
        <div className="chips">
          {[null, 7, 14, 30].map((d) => (
            <button key={String(d)} type="button" className="chip" aria-pressed={f.minDaysLeft === d} onClick={() => set({ minDaysLeft: d })}>
              {d == null ? t.any : t.daysLeft(d)}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">{t.missingHint}</p>

      <h3 className="section-title">{t.term}</h3>
      <div className="chips">
        <button type="button" className="chip" aria-pressed={termMode == null} onClick={() => set({ permanentOnly: false, minTermYears: null })}>
          {t.any}
        </button>
        {TERM_YEARS.map((y) => (
          <button key={y} type="button" className="chip" aria-pressed={termMode === y} onClick={() => set({ permanentOnly: false, minTermYears: y })}>
            {t.termYears(y)}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={termMode === 'permanent'} onClick={() => set({ permanentOnly: true, minTermYears: null })}>
          {t.termPermanent}
        </button>
      </div>
      {termMode != null && (
        <>
          {termMode !== 'permanent' && <p className="hint">{t.termHint}</p>}
          <label className="toggle">
            <span>
              {t.termUnknown}
              <br />
              <small className="hint">{t.termUnknownHint}</small>
            </span>
            <input type="checkbox" checked={!!f.termUnknown} onChange={(e) => set({ termUnknown: e.target.checked })} />
          </label>
        </>
      )}

      <SaveSection active={active} base={base} onSaved={(id) => setBaseId(id)} />

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t.done}
        </button>
        <button type="button" className="btn" onClick={() => apply(null)}>
          {t.reset}
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Unten im Filter: Ist der Filter gespeichert, sein Name, der Push-Schalter, Umbenennen und Löschen. Sonst ein
 * Name (mit Vorschlag), der Push-Schalter (Einschalten speichert gleich mit) und Speichern; nach einer Änderung
 * an einem angewendeten Filter zusätzlich „Änderungen speichern“.
 */
function SaveSection({ active, base, onSaved }: { active: SavedFilter | null; base: SavedFilter | null; onSaved: (id: string | null) => void }) {
  const s = useAppState();
  const store = useStore();
  const f = s.settings.filter;
  const saved = s.settings.savedFilters;
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [device, setDevice] = useState<PushState | null>(null);
  const suggestion = suggestFilterName(f, s);
  const anyPush = saved.some((x) => x.push);

  useEffect(() => {
    if (s.demo || !anyPush) return;
    void pushState().then(setDevice);
  }, [s.demo, anyPush]);

  const save = (push: boolean) => {
    const sf = addSavedFilter(store, saved, name || suggestion, f, push);
    setName('');
    onSaved(sf.id);
    store.toast(t.savedToast(sf.name));
  };

  const remove = (sf: SavedFilter) => {
    removeSavedFilter(store, saved, sf.id);
    onSaved(null);
    store.toast(t.removed(sf.name), { label: t.undo, run: () => store.updateSettings('savedFilters', saved) });
  };

  return (
    <>
      <h3 className="section-title">{t.saveTitle}</h3>
      {active ? (
        <>
          {renaming ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 200px' }}>
                <span className="visually-hidden">{t.nameLabel}</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={active.name} autoFocus />
              </label>
              <button
                type="button"
                className="btn btn--small btn--primary"
                onClick={() => {
                  if (name.trim()) updateSavedFilter(store, saved, active.id, { name });
                  setName('');
                  setRenaming(false);
                }}
              >
                {t.apply}
              </button>
            </div>
          ) : (
            <p className="hint">{t.savedAs(active.name)}</p>
          )}
          <label className="toggle">
            <span>
              {t.push}
              <br />
              <small className="hint">{t.pushHint}</small>
            </span>
            <input type="checkbox" checked={active.push} onChange={(e) => updateSavedFilter(store, saved, active.id, { push: e.target.checked })} />
          </label>
          {!renaming && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="btn btn--small" onClick={() => setRenaming(true)}>
                {t.rename}
              </button>
              <button type="button" className="btn btn--small btn--quiet" onClick={() => remove(active)}>
                {t.remove}
              </button>
            </div>
          )}
        </>
      ) : countActiveFilters({ ...f }) === 0 ? (
        <p className="hint">{t.saveEmpty}</p>
      ) : (
        <>
          {base && (
            <button type="button" className="btn btn--small btn--primary" style={{ marginBottom: 10 }} onClick={() => updateSavedFilter(store, saved, base.id, { filter: { ...f } })}>
              {t.saveChanges(base.name)}
            </button>
          )}
          <label className="field">
            <span>{t.nameLabel}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={suggestion} />
          </label>
          <label className="toggle">
            <span>
              {t.push}
              <br />
              <small className="hint">{t.pushHint}</small>
            </span>
            <input type="checkbox" checked={false} onChange={(e) => e.target.checked && save(true)} />
          </label>
          <button type="button" className="btn btn--small" style={{ marginTop: 8 }} onClick={() => save(false)}>
            {t.save}
          </button>
        </>
      )}
      {anyPush && device && device !== 'on' && !s.demo && (
        <p className="notice" style={{ marginTop: 10 }}>
          {t.deviceOff}{' '}
          <button type="button" className="btn btn--small" onClick={() => navigate('/ich/erinnerungen')}>
            {t.deviceOn}
          </button>
        </p>
      )}
    </>
  );
}
