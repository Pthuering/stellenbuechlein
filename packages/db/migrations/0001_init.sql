-- Stellenbüchlein – Grundschema (SQLite / Cloudflare D1)
-- Zeitstempel sind ISO-8601-Strings (UTC), Fristen YYYY-MM-DD.

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  wiki_de TEXT,
  image_url TEXT,
  image_credit TEXT,
  image_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  kind TEXT NOT NULL,
  city_id TEXT,
  lat REAL,
  lon REAL,
  website TEXT,
  wiki_de TEXT,
  image_url TEXT,
  image_credit TEXT,
  image_checked_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  origin TEXT NOT NULL DEFAULT 'seed',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  institution_id TEXT,
  kind TEXT NOT NULL,
  label TEXT,
  url TEXT,
  adapter TEXT NOT NULL DEFAULT 'auto',
  config TEXT NOT NULL DEFAULT '{}',
  gate TEXT NOT NULL DEFAULT 'psych',
  enabled INTEGER NOT NULL DEFAULT 1,
  verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'neu',
  status_note TEXT,
  last_run_at TEXT,
  last_ok_at TEXT,
  last_count INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  methods_used TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sources_institution ON sources(institution_id);

-- Vorschläge für Stellenseiten, die die Pipeline selbst gefunden hat (Übernahme nur nach Bestätigung).
CREATE TABLE IF NOT EXISTS source_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id TEXT NOT NULL,
  url TEXT NOT NULL,
  reason TEXT,
  found_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offen',
  UNIQUE (institution_id, url)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  institution_id TEXT,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  location_text TEXT,
  city_id TEXT,
  lat REAL,
  lon REAL,
  description_md TEXT NOT NULL DEFAULT '',
  summary TEXT,
  summary_ai INTEGER NOT NULL DEFAULT 0,
  kind TEXT,
  pay_grade TEXT,
  pay_level INTEGER,
  workload_pct INTEGER,
  workload_text TEXT,
  fixed_term TEXT,
  is_permanent INTEGER,
  start_text TEXT,
  deadline TEXT,
  deadline_text TEXT,
  reference_no TEXT,
  contact TEXT,
  language TEXT,
  image_url TEXT,
  image_kind TEXT,
  image_credit TEXT,
  pdf_url TEXT,
  posted_at TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  fuzzy_key TEXT,
  status TEXT NOT NULL DEFAULT 'aktiv',
  completeness TEXT NOT NULL DEFAULT 'ok',
  method TEXT,
  psych_terms TEXT,
  extra TEXT NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_canonical ON jobs(canonical_url);
CREATE INDEX IF NOT EXISTS jobs_updated ON jobs(updated_at, id);
CREATE INDEX IF NOT EXISTS jobs_fuzzy ON jobs(fuzzy_key);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_institution ON jobs(institution_id);

-- Über welche Quellen eine Anzeige gefunden wurde (für Dubletten und den Quellen-Gesundheitscheck).
CREATE TABLE IF NOT EXISTS job_sources (
  job_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  url TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (job_id, source_id)
);
CREATE INDEX IF NOT EXISTS job_sources_source ON job_sources(source_id);

-- Gelöschte Anzeigen, damit die App ihren Zwischenspeicher aufräumen kann.
CREATE TABLE IF NOT EXISTS deleted_jobs (
  id TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deleted_jobs_at ON deleted_jobs(deleted_at);

-- Vom Grobfilter übersprungene Anzeigen (zur Kontrolle in der App).
CREATE TABLE IF NOT EXISTS gate_skips (
  url TEXT PRIMARY KEY,
  source_id TEXT,
  institution_id TEXT,
  title TEXT,
  text_hash TEXT,
  seen_at TEXT NOT NULL
);

-- Persönliche Markierungen (Swipe-Entscheidung, Herzensjob, beworben, Notiz).
CREATE TABLE IF NOT EXISTS marks (
  job_id TEXT PRIMARY KEY,
  decision TEXT,
  decided_at TEXT,
  star INTEGER NOT NULL DEFAULT 0,
  applied_at TEXT,
  note TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (kind, ref)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_ok_at TEXT,
  failures INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reminders_sent (
  job_id TEXT NOT NULL,
  days INTEGER NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (job_id, days)
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  ok INTEGER NOT NULL DEFAULT 0,
  stats TEXT NOT NULL DEFAULT '{}',
  log TEXT NOT NULL DEFAULT ''
);

-- Seiten, die der Browser-Agent (Playwright + KI) noch vollständig einlesen soll.
CREATE TABLE IF NOT EXISTS browser_queue (
  url TEXT PRIMARY KEY,
  source_id TEXT,
  institution_id TEXT,
  reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'offen',
  last_error TEXT,
  updated_at TEXT NOT NULL
);
