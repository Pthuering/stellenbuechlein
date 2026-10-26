-- Dubletten: weitere Adressen derselben Anzeige (eine Seite veröffentlicht dieselbe Stelle mehrfach, ein Portal
-- verlinkt sie anders). Beim Einsammeln zählen sie wie die Anzeige selbst: gesehen, aber nicht neu angelegt.
CREATE TABLE IF NOT EXISTS job_aliases (
  url TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  source_id TEXT,
  seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS job_aliases_job ON job_aliases(job_id);

-- Dazu der Status „pruefung“ für jobs.status (ohne Schemawechsel): Seiten, die nach den Regeln nicht eindeutig
-- eine einzelne Anzeige sind, bleiben in der App unsichtbar, bis Claude sie beurteilt hat.
