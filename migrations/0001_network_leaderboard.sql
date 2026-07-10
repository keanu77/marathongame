PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leaderboard_runs (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL CHECK (length(token_hash) = 64),
  rules_version TEXT NOT NULL,
  issued_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'submitted')),
  checkpoint_elapsed_seconds REAL,
  checkpoint_items INTEGER,
  checkpoint_at_ms INTEGER,
  submitted_at_ms INTEGER,
  finish_fingerprint TEXT,
  CHECK (expires_at_ms > issued_at_ms),
  CHECK (checkpoint_elapsed_seconds IS NULL OR checkpoint_elapsed_seconds >= 0),
  CHECK (checkpoint_items IS NULL OR checkpoint_items >= 0)
);

CREATE INDEX IF NOT EXISTS leaderboard_runs_expiry
  ON leaderboard_runs (status, expires_at_ms);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  run_id TEXT PRIMARY KEY REFERENCES leaderboard_runs(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) > 0),
  score INTEGER NOT NULL CHECK (score >= 0),
  distance_meters INTEGER NOT NULL CHECK (distance_meters BETWEEN 0 AND 42195),
  elapsed_seconds REAL NOT NULL CHECK (elapsed_seconds >= 0 AND elapsed_seconds <= 82),
  collected_items INTEGER NOT NULL CHECK (collected_items >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'stopped')),
  stage_id TEXT NOT NULL CHECK (stage_id IN ('base', 'build', 'race')),
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS leaderboard_entries_ranking
  ON leaderboard_entries (
    score DESC,
    distance_meters DESC,
    outcome ASC,
    created_at_ms ASC,
    run_id ASC
  );

CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key_hash TEXT NOT NULL CHECK (length(key_hash) = 64),
  route TEXT NOT NULL,
  window_start_ms INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  PRIMARY KEY (key_hash, route, window_start_ms)
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_expiry
  ON rate_limit_counters (window_start_ms);
