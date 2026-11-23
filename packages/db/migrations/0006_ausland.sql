-- Ausland: Land der Stelle als Kürzel (ISO 3166-1, zwei Buchstaben), nur bei Stellen außerhalb Deutschlands.
-- Ohne Kürzel gilt eine Anzeige als deutsch oder unbekannt. Die App streut Auslandsstellen gedeckelt in den Stapel ein.
ALTER TABLE jobs ADD COLUMN country TEXT;
