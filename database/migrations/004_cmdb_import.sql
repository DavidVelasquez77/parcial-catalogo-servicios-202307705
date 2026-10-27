CREATE TABLE IF NOT EXISTS cmdb_import_runs (
  id BIGSERIAL PRIMARY KEY,
  source_file VARCHAR(240) NOT NULL,
  source_sha256 VARCHAR(64) NOT NULL,
  source_sheet VARCHAR(80) NOT NULL,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  observed_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS cmdb_import_observations (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES cmdb_import_runs(id),
  source_row INTEGER NOT NULL,
  field_name VARCHAR(80) NOT NULL,
  message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cmdb_import_observations_run ON cmdb_import_observations(run_id);
