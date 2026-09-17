CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  project_id INTEGER,
  user_instruction TEXT NOT NULL,
  parsed_intent_json TEXT,
  plan_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  current_step TEXT,
  dry_run INTEGER NOT NULL DEFAULT 1,
  budget_limit REAL DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_key TEXT NOT NULL,
  step_type TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  idempotency_key TEXT NOT NULL UNIQUE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  project_id INTEGER,
  target_type TEXT NOT NULL,
  target_id TEXT,
  approval_stage TEXT NOT NULL,
  snapshot_json TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewer_comment TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS generation_usage (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  project_id INTEGER,
  episode_id INTEGER,
  shot_id INTEGER,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  estimated_cost REAL NOT NULL DEFAULT 0,
  actual_cost REAL NOT NULL DEFAULT 0,
  external_task_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qc_reports (
  id TEXT PRIMARY KEY,
  project_id INTEGER,
  episode_id INTEGER,
  shot_id INTEGER,
  asset_type TEXT NOT NULL,
  asset_id TEXT,
  checks_json TEXT,
  score REAL NOT NULL DEFAULT 0,
  decision TEXT NOT NULL,
  recommended_action TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_versions (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_path TEXT,
  prompt_snapshot TEXT,
  provider_snapshot TEXT,
  parent_version_id TEXT,
  selected INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_steps(run_id, started_at);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_generation_usage_run ON generation_usage(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qc_reports_project ON qc_reports(project_id, created_at);
