CREATE TABLE IF NOT EXISTS chatcut_asset_imports (
  run_id TEXT NOT NULL,
  handoff_digest TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  source_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  asset_id TEXT,
  error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (run_id, handoff_digest, project_id, source_id)
);
