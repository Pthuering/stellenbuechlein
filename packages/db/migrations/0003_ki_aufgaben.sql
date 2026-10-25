-- KI-Warteschlange: Die Einsammel-Pipeline arbeitet ohne KI und legt hier ab, was eine KI noch erledigen soll.
-- Abgearbeitet wird sie von Claude (Befehl /ki-aufgaben, täglich als Cloud-Aufgabe nach dem Einsammeln).
--   auswerten – Titel, Eckdaten, Kurzfassung, und ob es überhaupt eine Stellenanzeige ist
--   frist     – unplausible oder unklare Bewerbungsfrist im Text nachprüfen
--   horizont  – Urteil und „Warum das passen könnte“ für eine Anzeige über eine Brücke
--   weite     – Urteil für eine Anzeige ohne Brücke; die Anzeige (payload) wird erst bei „passt“/„eher“ gespeichert
CREATE TABLE IF NOT EXISTS ki_aufgaben (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  art TEXT NOT NULL,
  job_id TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'offen',
  ergebnis TEXT,
  versuche INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  done_at TEXT,
  UNIQUE (art, job_id)
);

CREATE INDEX IF NOT EXISTS idx_ki_aufgaben_status ON ki_aufgaben (status, id);
