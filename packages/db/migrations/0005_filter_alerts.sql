-- Gespeicherte Filter mit Push (Einstellung „savedFilters“): welche Anzeige zu welchem Filter schon gemeldet wurde.
-- Das Einsammeln meldet einen Treffer nur einmal je Filter, auch wenn er in den nächsten Läufen noch neu genug ist.
-- Alte Einträge räumt das Einsammeln selbst weg (Treffer kommen nur aus den letzten zwei Wochen).
CREATE TABLE IF NOT EXISTS filter_alerts_sent (
  filter_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (filter_id, job_id)
);
CREATE INDEX IF NOT EXISTS filter_alerts_sent_at ON filter_alerts_sent(sent_at);
