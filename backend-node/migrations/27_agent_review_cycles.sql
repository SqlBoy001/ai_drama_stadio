CREATE TABLE IF NOT EXISTS agent_review_cycles (
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL,
 stage TEXT NOT NULL,
 status TEXT NOT NULL,
 contract_json TEXT NOT NULL,
 versions_json TEXT NOT NULL,
 reviews_json TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0,
 reason TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(run_id, stage)
);
