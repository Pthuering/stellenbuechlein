// Filter für Stapel und Liste. Blenden nur aus – gelöscht wird nichts. Im Stapel dazu die Reihenfolge.

import { DEFAULT_FILTER, INSTITUTION_KINDS, STATE_CODES, type DeckOrder, type InstitutionKind, type JobFilter, type JobKind, type Lane, type StateCode } from '@stellen/core';
import { useAppState, useStore } from '../data/hooks';
import { Sheet } from '../ui/Sheet';
import { fmtPct, srForm, texts } from '../i18n';
import { institutionKindLabel, jobKindLabel, laneName, stateName } from '../i18n/labels';

const RADII: (number | null)[] = [null, 25, 50, 100, 200, 300];
const KINDS: JobKind[] = ['promotion', 'postdoc', 'wiss_ma', 'professur', 'projekt', 'lehre', 'klinik', 'shk', 'verwaltung'];
const INST_KINDS: readonly InstitutionKind[] = INSTITUTION_KINDS;
const LANES: Lane[] = ['kern', 'horizont', 'weite'];
const MIN_SCORES = [50, 60, 70, 80, 90];
const URGENT_DAYS = [7, 14, 30, 60];

const t = texts({
  de: {
    title: 'Filter',
    intro: 'Filter blenden Anzeigen nur aus. Gelöscht wird nichts, und der Score sortiert weiter.',
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
    ring: 'Ring',
    ringHint: 'Kern trifft deine Kernthemen, Horizont kommt über eine Brücke dazu, die Weite schlägt die KI vor.',
    newSitesOnly: 'Nur von neuen Websites',
    newSitesHint: 'Anzeigen von Websites, die beim Fund noch nicht im Quellen-Register standen',
    radius: 'Umkreis',
    allGermany: 'Ganz Deutschland',
    measuredFrom: (home: string) => `gemessen ab ${home} (änderbar unter „Ich“)`,
    states: 'Bundesländer',
    kind: 'Stellenart',
    instKind: 'Art der Einrichtung',
    conditions: 'Rahmen',
    payMin: 'Entgelt mindestens',
    workloadMin: 'Umfang mindestens',
    deadline: 'Frist',
    any: 'egal',
    daysLeft: (d: number) => `noch mind. ${d} Tage`,
    permanentOnly: 'Nur unbefristete Stellen',
    missingHint: 'Fehlt eine Angabe in der Anzeige (z. B. kein Entgelt genannt), bleibt sie sichtbar.',
    done: 'Fertig',
    reset: 'Alle Filter zurücksetzen',
  },
  en: {
    title: 'Filters',
    intro: 'Filters only hide postings. Nothing gets deleted, and the match score keeps sorting.',
    order: 'Stack order',
    orderHint: 'Sorted by match, best card first.',
    topFirst: 'Good matches first',
    topFirstHint: 'First all cards from this match up, then the rest.',
    off: 'off',
    fromPct: (p) => `from ${p}`,
    urgentFirst: 'Close deadlines first',
    urgentFirstHint: 'Cards with a close deadline come before the others, among the good matches and among the rest.',
    urgentWithin: 'Close means at most',
    period: (d) => (d === 7 ? '1 week' : d === 14 ? '2 weeks' : d === 30 ? '1 month' : d === 60 ? '2 months' : `${d} days`),
    ring: 'Ring',
    ringHint: 'Core matches your core topics, Horizon comes in through a bridge, and Beyond is suggested by the AI.',
    newSitesOnly: 'Only from new websites',
    newSitesHint: 'Postings from websites that weren’t in the registry yet when they were found',
    radius: 'Radius',
    allGermany: 'All of Germany',
    measuredFrom: (home) => `measured from ${home} (change it under “Me”)`,
    states: 'Federal states',
    kind: 'Position type',
    instKind: 'Type of institution',
    conditions: 'Conditions',
    payMin: 'Pay grade at least',
    workloadMin: 'Hours at least',
    deadline: 'Deadline',
    any: 'any',
    daysLeft: (d) => `at least ${d} days left`,
    permanentOnly: 'Permanent positions only',
    missingHint: 'If a posting leaves something out (e.g. no pay given), it stays visible.',
    done: 'Done',
    reset: 'Reset all filters',
  },
  sr: {
    title: 'Filteri',
    intro: 'Filteri samo sakrivaju oglase. Ništa se ne briše, a poklapanje i dalje određuje redosled.',
    order: 'Redosled u špilu',
    orderHint: 'Redosled prati poklapanje, najbolja kartica je prva.',
    topFirst: 'Prvo dobra poklapanja',
    topFirstHint: 'Prvo sve kartice od ovog poklapanja naviše, zatim ostale.',
    off: 'isključeno',
    fromPct: (p) => `od ${p}`,
    urgentFirst: 'Prvo bliski rokovi',
    urgentFirstHint: 'Kartice sa bliskim rokom dolaze pre ostalih, i među dobrim poklapanjima i među ostalima.',
    urgentWithin: 'Blizu znači najviše',
    period: (d) => (d === 7 ? '1 nedelja' : d === 14 ? '2 nedelje' : d === 30 ? '1 mesec' : d === 60 ? '2 meseca' : `${d} ${srForm(d, 'dan', 'dana', 'dana')}`),
    ring: 'Krug',
    ringHint: 'Jezgro pogađa tvoje ključne teme, Horizont dolazi preko mosta, a Daljinu predlaže AI.',
    newSitesOnly: 'Samo sa novih sajtova',
    newSitesHint: 'Oglasi sa sajtova koji u trenutku pronalaska još nisu bili u registru',
    radius: 'Radijus',
    allGermany: 'Cela Nemačka',
    measuredFrom: (home) => `polazna tačka: ${home} (možeš je promeniti u odeljku „Ja“)`,
    states: 'Savezne pokrajine',
    kind: 'Vrsta pozicije',
    instKind: 'Vrsta ustanove',
    conditions: 'Uslovi',
    payMin: 'Platni razred najmanje',
    workloadMin: 'Obim zaposlenja najmanje',
    deadline: 'Rok',
    any: 'svejedno',
    daysLeft: (d) => `još najmanje ${d} ${srForm(d, 'dan', 'dana', 'dana')}`,
    permanentOnly: 'Samo pozicije na neodređeno',
    missingHint: 'Ako u oglasu nešto nije navedeno (npr. plata), oglas ostaje vidljiv.',
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

  return (
    <Sheet title={t.title} onClose={onClose} full>
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
        </>
      )}
      <p className="hint" style={deck ? { marginTop: 18 } : undefined}>
        {t.intro}
      </p>

      <h3 className="section-title">{t.ring}</h3>
      <div className="chips">
        {LANES.map((l) => (
          <button key={l} type="button" className="chip" aria-pressed={(f.lanes ?? []).includes(l)} onClick={() => set({ lanes: toggle(f.lanes ?? [], l) })}>
            {laneName(l)}
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

      <h3 className="section-title">{t.radius}</h3>
      <div className="chips">
        {RADII.map((r) => (
          <button key={String(r)} type="button" className="chip" aria-pressed={f.radiusKm === r} onClick={() => set({ radiusKm: r })}>
            {r == null ? t.allGermany : `${r} km`}
          </button>
        ))}
      </div>
      <p className="hint">{t.measuredFrom(s.settings.home.label)}</p>

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
      <label className="toggle">
        <span>{t.permanentOnly}</span>
        <input type="checkbox" checked={f.permanentOnly} onChange={(e) => set({ permanentOnly: e.target.checked })} />
      </label>
      <p className="hint">{t.missingHint}</p>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t.done}
        </button>
        <button type="button" className="btn" onClick={() => store.updateSettings('filter', { ...DEFAULT_FILTER, text: f.text })}>
          {t.reset}
        </button>
      </div>
    </Sheet>
  );
}
