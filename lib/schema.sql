CREATE TABLE IF NOT EXISTS founders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  email TEXT,
  links_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  bio TEXT,
  current_score REAL,
  score_low REAL,
  score_high REAL,
  cold_start INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_founders_norm ON founders(normalized_name);

-- Append-only: the Founder Score follows the person, never resets.
CREATE TABLE IF NOT EXISTS founder_score_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  founder_id INTEGER NOT NULL REFERENCES founders(id),
  score REAL NOT NULL,
  low REAL NOT NULL,
  high REAL NOT NULL,
  components_json TEXT NOT NULL,
  rationale TEXT,
  trigger_event TEXT NOT NULL,
  opportunity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  founder_id INTEGER REFERENCES founders(id),
  source TEXT NOT NULL DEFAULT 'inbound',
  status TEXT NOT NULL DEFAULT 'received',
  one_liner TEXT,
  sector TEXT,
  geo TEXT,
  stage TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  deck_path TEXT,
  deck_text TEXT,
  screen_json TEXT,
  memo_json TEXT,
  recommendation_json TEXT,
  outreach_json TEXT,
  source_signal TEXT,
  linked_opportunity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One table for all signals: deck slides, web hits, GitHub, application fields.
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  founder_id INTEGER,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  title TEXT,
  snippet TEXT,
  synthetic INTEGER NOT NULL DEFAULT 0,
  retrieved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evidence_opp ON evidence(opportunity_id);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified',
  trust_score INTEGER,
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  verification_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_claims_opp ON claims(opportunity_id);

-- Append-only: keeping every snapshot is what makes trends real.
CREATE TABLE IF NOT EXISTS axis_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL,
  axis TEXT NOT NULL,
  verdict TEXT NOT NULL,
  score REAL NOT NULL,
  confidence TEXT NOT NULL,
  trend TEXT NOT NULL,
  rationale TEXT,
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_axis_opp ON axis_scores(opportunity_id);

CREATE TABLE IF NOT EXISTS reasoning_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  opportunity_id INTEGER,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  summary TEXT,
  detail_json TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_opp ON reasoning_log(opportunity_id);

CREATE TABLE IF NOT EXISTS thesis (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tavily_cache (
  query_hash TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
