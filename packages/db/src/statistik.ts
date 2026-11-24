// Statistik: Schnappschüsse je Einsammel-Lauf (Tabelle statistik) und Auswertungen je Tag, die direkt aus den
// vorhandenen Tabellen gerechnet werden (KI-Urteile aus ki_aufgaben, Taras Entscheidungen aus marks).

import type { EntscheidungTag, KiTag } from '@stellen/core';
import type { Db, Stmt } from './db';

export interface StatistikRow {
  runId: number;
  erstelltAt: string;
  daten: unknown;
}

export function statistikStmt(runId: number, erstelltAt: string, daten: unknown): Stmt {
  return { sql: 'INSERT OR REPLACE INTO statistik (run_id, erstellt_at, daten) VALUES (?, ?, ?)', params: [runId, erstelltAt, JSON.stringify(daten)] };
}

export async function listStatistik(db: Db, limit = 120): Promise<StatistikRow[]> {
  const rows = await db.all<{ run_id: number; erstellt_at: string; daten: string }>('SELECT run_id, erstellt_at, daten FROM statistik ORDER BY run_id DESC LIMIT ?', [limit]);
  return rows.map((r) => {
    let daten: unknown = null;
    try {
      daten = JSON.parse(r.daten);
    } catch {
      daten = null;
    }
    return { runId: r.run_id, erstelltAt: r.erstellt_at, daten };
  });
}

export async function kiTage(db: Db, seit: string): Promise<KiTag[]> {
  // done_at steht auch bei einem gescheiterten Versuch, der offen bleibt; gezählt werden nur erledigte und endgültig gescheiterte
  return db.all<KiTag>(
    `SELECT substr(done_at, 1, 10) AS tag, art,
       CASE
         WHEN status = 'fehler' THEN 'fehler'
         WHEN NOT json_valid(ergebnis) THEN 'unbekannt'
         WHEN json_extract(ergebnis, '$.entfallen') IS NOT NULL THEN 'entfallen'
         WHEN art IN ('horizont', 'weite') THEN COALESCE(json_extract(ergebnis, '$.verdict'), 'unbekannt')
         WHEN art = 'auswerten' THEN CASE json_extract(ergebnis, '$.is_job_posting') WHEN 0 THEN 'keine-anzeige' WHEN 1 THEN 'anzeige' ELSE 'unbekannt' END
         WHEN art = 'frist' THEN CASE WHEN json_extract(ergebnis, '$.deadline') IS NOT NULL THEN 'frist' ELSE 'keine-frist' END
         ELSE 'unbekannt'
       END AS ergebnis,
       COUNT(*) AS n,
       AVG((julianday(done_at) - julianday(created_at)) * 24) AS stunden
     FROM ki_aufgaben
     WHERE done_at >= ? AND status IN ('erledigt', 'fehler')
     GROUP BY 1, 2, 3
     ORDER BY 1`,
    [seit],
  );
}

export async function entscheidungenTage(db: Db, seit: string): Promise<EntscheidungTag[]> {
  return db.all<EntscheidungTag>(
    `SELECT substr(m.decided_at, 1, 10) AS tag, m.decision AS entscheidung,
       CASE WHEN j.id IS NULL THEN 'weg' WHEN j.country IS NOT NULL AND j.country <> 'DE' THEN 'ausland' ELSE COALESCE(j.lane, 'kern') END AS ring,
       COUNT(*) AS n
     FROM marks m LEFT JOIN jobs j ON j.id = m.job_id
     WHERE m.decided_at >= ? AND m.decision IS NOT NULL
     GROUP BY 1, 2, 3
     ORDER BY 1`,
    [seit],
  );
}
