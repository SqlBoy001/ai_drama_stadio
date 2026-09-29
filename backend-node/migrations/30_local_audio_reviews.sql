CREATE TABLE IF NOT EXISTS local_audio_reviews (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL,
 media_sha256 TEXT NOT NULL,
 timeline_digest TEXT NOT NULL,
 status TEXT NOT NULL,
 contract_json TEXT NOT NULL,
 result_json TEXT,
 error TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(job_id,media_sha256,timeline_digest)
);
