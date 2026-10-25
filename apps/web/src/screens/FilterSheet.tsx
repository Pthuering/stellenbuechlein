// Filter für Stapel und Liste. Blenden nur aus – gelöscht wird nichts.

import { DEFAULT_FILTER, INSTITUTION_KIND_LABELS, INSTITUTION_KINDS, JOB_KIND_LABELS, LANE_LABELS, STATES, STATE_CODES, type InstitutionKind, type JobFilter, type JobKind, type Lane, type StateCode } from '@stellen/core';
import { useAppState, useStore } from '../data/hooks';
import { Sheet } from '../ui/Sheet';

const RADII: (number | null)[] = [null, 25, 50, 100, 200, 300];
const KINDS: JobKind[] = ['promotion', 'postdoc', 'wiss_ma', 'professur', 'projekt', 'lehre', 'klinik', 'shk', 'verwaltung'];
const INST_KINDS: readonly InstitutionKind[] = INSTITUTION_KINDS;
const LANES: Lane[] = ['kern', 'horizont', 'weite'];

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function FilterSheet({ onClose }: { onClose: () => void }) {
  const s = useAppState();
  const store = useStore();
  const f = s.settings.filter;
  const set = (patch: Partial<JobFilter>) => store.updateSettings('filter', { ...f, ...patch });

  return (
    <Sheet title="Filter" onClose={onClose} full>
      <p className="hint">Filter blenden Anzeigen nur aus. Gelöscht wird nichts, und der Score sortiert weiter.</p>

      <h3 className="section-title">Ring</h3>
      <div className="chips">
        {LANES.map((l) => (
          <button key={l} type="button" className="chip" aria-pressed={(f.lanes ?? []).includes(l)} onClick={() => set({ lanes: toggle(f.lanes ?? [], l) })}>
            {LANE_LABELS[l]}
          </button>
        ))}
      </div>
      <p className="hint">Kern trifft deine Kernthemen, Horizont kommt über eine Brücke dazu, die Weite schlägt die KI vor.</p>
      <label className="toggle" style={{ marginTop: 4 }}>
        <span>
          Nur von neuen Websites
          <br />
          <small className="hint">Anzeigen von Websites, die beim Fund noch nicht im Quellen-Register standen</small>
        </span>
        <input type="checkbox" checked={!!f.newSitesOnly} onChange={(e) => set({ newSitesOnly: e.target.checked })} />
      </label>

      <h3 className="section-title">Umkreis</h3>
      <div className="chips">
        {RADII.map((r) => (
          <button key={String(r)} type="button" className="chip" aria-pressed={f.radiusKm === r} onClick={() => set({ radiusKm: r })}>
            {r == null ? 'Ganz Deutschland' : `${r} km`}
          </button>
        ))}
      </div>
      <p className="hint">gemessen ab {s.settings.home.label} (änderbar unter „Ich“)</p>

      <h3 className="section-title">Bundesländer</h3>
      <div className="chips">
        {STATE_CODES.map((c: StateCode) => (
          <button key={c} type="button" className="chip" aria-pressed={f.states.includes(c)} onClick={() => set({ states: toggle(f.states, c) })}>
            {STATES[c]}
          </button>
        ))}
      </div>

      <h3 className="section-title">Stellenart</h3>
      <div className="chips">
        {KINDS.map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={f.kinds.includes(k)} onClick={() => set({ kinds: toggle(f.kinds, k) })}>
            {JOB_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <h3 className="section-title">Art der Einrichtung</h3>
      <div className="chips">
        {INST_KINDS.map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={f.institutionKinds.includes(k)} onClick={() => set({ institutionKinds: toggle(f.institutionKinds, k) })}>
            {INSTITUTION_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <h3 className="section-title">Rahmen</h3>
      <div className="field">
        <span>Entgelt mindestens</span>
        <div className="chips">
          {[null, 12, 13, 14].map((l) => (
            <button key={String(l)} type="button" className="chip" aria-pressed={f.payMin === l} onClick={() => set({ payMin: l })}>
              {l == null ? 'egal' : `E ${l}`}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Umfang mindestens</span>
        <div className="chips">
          {[null, 50, 65, 75, 100].map((p) => (
            <button key={String(p)} type="button" className="chip" aria-pressed={f.workloadMin === p} onClick={() => set({ workloadMin: p })}>
              {p == null ? 'egal' : `${p} %`}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Frist</span>
        <div className="chips">
          {[null, 7, 14, 30].map((d) => (
            <button key={String(d)} type="button" className="chip" aria-pressed={f.minDaysLeft === d} onClick={() => set({ minDaysLeft: d })}>
              {d == null ? 'egal' : `noch mind. ${d} Tage`}
            </button>
          ))}
        </div>
      </div>
      <label className="toggle">
        <span>Nur unbefristete Stellen</span>
        <input type="checkbox" checked={f.permanentOnly} onChange={(e) => set({ permanentOnly: e.target.checked })} />
      </label>
      <p className="hint">Fehlt eine Angabe in der Anzeige (z. B. kein Entgelt genannt), bleibt sie sichtbar.</p>

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Fertig
        </button>
        <button type="button" className="btn" onClick={() => store.updateSettings('filter', { ...DEFAULT_FILTER, text: f.text })}>
          Alle Filter zurücksetzen
        </button>
      </div>
    </Sheet>
  );
}
