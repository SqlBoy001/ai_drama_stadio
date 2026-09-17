CREATE TABLE IF NOT EXISTS director_sessions (
  id TEXT PRIMARY KEY,
  brief_json TEXT NOT NULL,
  plan_json TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  revision INTEGER NOT NULL DEFAULT 1,
  run_id TEXT,
  last_error TEXT,
  planning_calls INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
