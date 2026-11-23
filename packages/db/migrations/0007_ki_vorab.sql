-- Vorab bearbeitete KI-Ergebnisse: Eine Sitzung kann Aufgaben ohne Datenbankzugriff bearbeiten (etwa wenn das
-- Tageslimit der Datenbank erschöpft ist) und die Ergebnisse hier ablegen; Schreiben geht auch dann noch.
-- Eingespielt werden sie später mit „ki-vorab“ (das macht die Cloud-Routine als ersten Schritt): Zu jeder Zeile
-- wird die offene Aufgabe derselben Art und Anzeige gesucht. Zeilen ohne offene Aufgabe verfallen.
CREATE TABLE IF NOT EXISTS ki_vorab (
  art TEXT NOT NULL,
  job_id TEXT NOT NULL,
  ergebnis TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (art, job_id)
);
