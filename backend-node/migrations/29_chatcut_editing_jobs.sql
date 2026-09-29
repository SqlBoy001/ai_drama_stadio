CREATE TABLE IF NOT EXISTS chatcut_editing_jobs (
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL,
 handoff_digest TEXT NOT NULL,
 project_id TEXT NOT NULL,
 episode_id INTEGER NOT NULL,
 status TEXT NOT NULL,
 timeline_id TEXT,
 timeline_digest TEXT,
 timeline_snapshot_json TEXT,
 export_path TEXT,
 output_json TEXT,
 error TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(run_id,handoff_digest,project_id,episode_id)
);
CREATE TABLE IF NOT EXISTS chatcut_operations (
 job_id TEXT NOT NULL,
 operation_key TEXT NOT NULL,
 status TEXT NOT NULL,
 response_json TEXT,
 PRIMARY KEY(job_id,operation_key)
);
