import { beforeEach, describe, expect, it } from 'vitest';
import { SqliteDb, migrateSqlite } from '@stellen/db/sqlite';
import { countOpenAiTasks, enqueueAiTaskStmt, listGateSkips, syncJobs, upsertJobStmt, type JobWrite } from '@stellen/db';
import { canonicalUrl, contentHash, jobIdForUrl } from '@stellen/core';
import { exportAiTasks, importAiResults } from '../src/aiTasks';

const NOW = '2026-10-26T10:00:00.000Z';

function job(slug: string, over: Partial<JobWrite> = {}): JobWrite {
  const url = `https://uni.example/jobs/${slug}`;
  return {
    id: jobIdForUrl(url),
    institutionId: null,
    url,
    canonicalUrl: canonicalUrl(url),
    title: 'Wissenschaftliche Mitarbeiterin (m/w/d)',
    descriptionMd: 'Am Institut für Psychologie ist eine Stelle zu besetzen. Bewerbungsschluss ist der 15.12.2026. Wir bieten E 13 TV-L, 65 %.',
    kind: 'wiss_ma',
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    updatedAt: NOW,
    status: 'aktiv',
    completeness: 'ok',
    contentHash: contentHash(slug, 'x'),
    fuzzyKey: null,
    ...over,
  };
}

let db: SqliteDb;
const a = job('a', { title: 'Stellenanzeige' });
const b = job('b');
const c = job('c', { title: 'UX Researcher', lane: 'horizont', horizon: { bridges: ['h-ux'], label: 'Gestaltung & UX' } });
const d = job('d', { title: 'Sachbearbeitung Studienberatung' });
const e = job('e', { title: 'Infoseite' });

beforeEach(async () => {
  db = new SqliteDb(':memory:');
  migrateSqlite(db);
  await db.batch([
    upsertJobStmt(a),
    upsertJobStmt(b),
    upsertJobStmt(c),
    upsertJobStmt(e),
    enqueueAiTaskStmt('auswerten', a.id, { titelFehlt: true }, NOW),
    enqueueAiTaskStmt('frist', b.id, { gefunden: null }, NOW),
    enqueueAiTaskStmt('horizont', c.id, { bruecke: 'Gestaltung & UX', warum: null, aussen: true }, NOW),
    enqueueAiTaskStmt('weite', d.id, { job: d, sourceId: 'test-z1', url: d.url, folge: [{ art: 'auswerten', payload: null }] }, NOW),
    enqueueAiTaskStmt('auswerten', e.id, null, NOW),
  ]);
});

const ids = async () => (await exportAiTasks(db, { max: 10 })).aufgaben.reduce<Record<string, number>>((m, t) => ({ ...m, [t.titel]: t.id }), {});

describe('KI-Warteschlange für Claude', () => {
  it('gibt ein Paket mit Anweisungen, Profil und Anzeigentext aus', async () => {
    const pkg = await exportAiTasks(db, { max: 10 });
    expect(pkg.aufgaben).toHaveLength(5);
    expect(Object.keys(pkg.anleitung).sort()).toEqual(['auswerten', 'frist', 'horizont', 'weite']);
    expect(pkg.profil).toMatch(/Thema/);
    const auswerten = pkg.aufgaben.find((t) => t.titel === 'Stellenanzeige')!;
    expect(auswerten.titel_fehlt).toBe(true);
    expect(auswerten.text).toMatch(/Bewerbungsschluss/);
    expect(pkg.aufgaben.find((t) => t.art === 'horizont')?.bruecke?.name).toBe('Gestaltung & UX');
    expect(pkg.aufgaben.find((t) => t.art === 'weite')?.titel).toBe('Sachbearbeitung Studienberatung');
  });

  it('spielt Ergebnisse ein: Felder, belegte Frist, Horizont „nein“, Weite „passt“', async () => {
    const id = await ids();
    const r = await importAiResults(
      db,
      [
        { id: id['Stellenanzeige'], ergebnis: { is_job_posting: true, title: 'Doktorand*in Entwicklungspsychologie', summary_de: 'Promotion zur Sprachentwicklung im Kleinkindalter. Mitarbeit an einer Längsschnittstudie.', workload_pct: '65' } },
        { id: id['Wissenschaftliche Mitarbeiterin (m/w/d)'], ergebnis: { deadline: '2026-12-15', quote: 'Bewerbungsschluss ist der 15.12.2026', still_open: true } },
        { id: id['UX Researcher'], ergebnis: { verdict: 'nein', reason_de: 'Reine Entwicklerstelle ohne Nutzerforschung.', label: null } },
        { id: id['Sachbearbeitung Studienberatung'], ergebnis: { verdict: 'eher', reason_de: 'Beratung und Lernstrategien knüpfen an Pädagogische Psychologie an.', label: 'Beratung × Lernen' } },
        { id: id['Infoseite'], ergebnis: { is_job_posting: false } },
      ],
      NOW,
    );
    expect(r).toMatchObject({ erledigt: 5, entfernt: 2, weiteGespeichert: 1, fehler: [] });
    const { jobs } = await syncJobs(db, '', 50);
    const byId = new Map(jobs.map((j) => [j.id, j]));
    expect(byId.get(a.id)).toMatchObject({ title: 'Doktorand*in Entwicklungspsychologie', summaryByAi: true, workloadPct: 65 });
    expect(byId.get(b.id)).toMatchObject({ deadline: '2026-12-15', deadlineCheck: 'ki' });
    expect(byId.has(c.id)).toBe(false);
    expect(byId.has(e.id)).toBe(false);
    expect(byId.get(d.id)).toMatchObject({ lane: 'weite', horizon: { verdict: 'eher', label: 'Beratung × Lernen' } });
    // Folgeaufgabe der Weite-Anzeige ist dazugekommen
    expect((await countOpenAiTasks(db)).auswerten).toBe(1);
    const skips = await listGateSkips(db);
    expect(skips.map((s) => s.reason).sort()).toEqual(['keine-anzeige', 'ki-nein']);
  });

  it('nimmt eine unbelegte Frist nicht an und behält gemerkte Anzeigen', async () => {
    const id = await ids();
    await db.run("INSERT INTO marks (job_id, decision, star, updated_at) VALUES (?, 'gemerkt', 0, ?)", [e.id, NOW]);
    await importAiResults(
      db,
      [
        { id: id['Wissenschaftliche Mitarbeiterin (m/w/d)'], ergebnis: { deadline: '2026-12-31', quote: 'Bewerbungen bis Silvester', still_open: true } },
        { id: id['Infoseite'], ergebnis: { is_job_posting: false } },
      ],
      NOW,
    );
    const { jobs } = await syncJobs(db, '', 50);
    expect(jobs.find((j) => j.id === b.id)?.deadline ?? null).toBeNull();
    expect(jobs.some((j) => j.id === e.id)).toBe(true);
  });

  it('lässt fehlerhafte Ergebnisse offen und meldet sie', async () => {
    const id = await ids();
    const r = await importAiResults(db, [{ id: id['UX Researcher'], ergebnis: { verdict: 'vielleicht' } }, { id: 999, ergebnis: {} }], NOW);
    expect(r.erledigt).toBe(0);
    expect(r.fehler[0]).toMatch(/verdict/);
    expect((await countOpenAiTasks(db)).horizont).toBe(1);
  });
});
