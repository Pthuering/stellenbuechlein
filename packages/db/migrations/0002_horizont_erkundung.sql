-- Horizont, blinde Flecken, Fristen-Prüfung, Quellen-Probelauf

-- Fristen: wie sicher (ok | jahr | ki | unsicher) und warum
ALTER TABLE jobs ADD COLUMN deadline_check TEXT;
ALTER TABLE jobs ADD COLUMN deadline_note TEXT;
-- Ring beim Einsammeln: kern | horizont | weite
ALTER TABLE jobs ADD COLUMN lane TEXT;
-- KI-Einschätzung für Horizont und Weite (JSON: reason, verdict, label, bridges)
ALTER TABLE jobs ADD COLUMN horizon TEXT;
-- Von einer Website/einem Arbeitgeber außerhalb des Registers (Suche nach blinden Flecken)
ALTER TABLE jobs ADD COLUMN new_site INTEGER NOT NULL DEFAULT 0;
-- quelle | portal | erkundung
ALTER TABLE jobs ADD COLUMN found_via TEXT;
-- Arbeitgeber laut Anzeige (wichtig, wenn die Einrichtung nicht im Register steht)
ALTER TABLE jobs ADD COLUMN employer TEXT;

-- Warum eine Anzeige aussortiert wurde (grobfilter | ki-nein | …) und was die KI dazu sagte
ALTER TABLE gate_skips ADD COLUMN reason TEXT;
ALTER TABLE gate_skips ADD COLUMN note TEXT;

-- Neu entdeckte Websites und Arbeitgeber, die noch nicht im Register stehen
CREATE TABLE IF NOT EXISTS discoveries (
  site_key TEXT PRIMARY KEY,
  name TEXT,
  sample_url TEXT,
  jobs INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offen'
);

-- Probeläufe für neue Quellen (KI-Prüfung, bevor eine Website ins Register kommt)
CREATE TABLE IF NOT EXISTS source_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'wartet',
  requested_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  result TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS source_checks_status ON source_checks(status);

-- Quelle für die Erkundung (sammelt bei der Arbeitsagentur und im Netz gezielt Anzeigen von neuen Websites).
-- last_ok_at bleibt leer: Erkundete Anzeigen laufen über ihre Frist ab, nicht über „nicht mehr gesehen“.
INSERT OR IGNORE INTO sources (id, institution_id, kind, label, url, adapter, config, gate, enabled, verified, status, updated_at)
VALUES ('erkundung', NULL, 'portal', 'Erkundung (neue Websites)', NULL, 'erkundung', '{}', 'psych', 0, 1, 'ok', '2026-10-12T00:00:00.000Z');
