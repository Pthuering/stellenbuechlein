-- Statistik: Am Ende jedes Einsammel-Laufs ein Schnappschuss (JSON): Kennzahlen des Laufs, Zustand des Bestands,
-- Verteilung der Passung und Wirkung (was Tara gemerkt oder weggelegt hat, nach Ring und Passungsstufe).
-- Die Tabelle runs hält nur die letzten 60 Läufe; hier bleibt der Verlauf erhalten (eine kleine Zeile je Lauf).
CREATE TABLE IF NOT EXISTS statistik (
  run_id INTEGER PRIMARY KEY,
  erstellt_at TEXT NOT NULL,
  daten TEXT NOT NULL
);
