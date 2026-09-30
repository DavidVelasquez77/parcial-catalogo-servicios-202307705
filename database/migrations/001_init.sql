CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES areas(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(area_id, code)
);

CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(department_id, code)
);

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(section_id, code)
);

CREATE TABLE IF NOT EXISTS service_classes (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS criticalities (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS service_types (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS service_level_1 (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(240) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_level_2 (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(240) NOT NULL,
  level_1_id INTEGER NOT NULL REFERENCES service_level_1(id),
  active_code VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'REVIEW' CHECK(status IN ('ACTIVE','INACTIVE','REVIEW')),
  class_id INTEGER REFERENCES service_classes(id),
  criticality_id INTEGER REFERENCES criticalities(id),
  type_id INTEGER REFERENCES service_types(id),
  description TEXT,
  metric VARCHAR(240),
  minimum NUMERIC,
  maximum NUMERIC,
  responsible_section_id INTEGER REFERENCES sections(id),
  responsible_user_id INTEGER,
  source_sheet VARCHAR(160),
  source_rows VARCHAR(80),
  source_transformations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(minimum IS NULL OR maximum IS NULL OR minimum <= maximum)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(180) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK(role IN ('ADMIN','CONSULTA')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  position_id INTEGER NOT NULL REFERENCES positions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE service_level_2
  ADD CONSTRAINT service_level_2_responsible_user_fk
  FOREIGN KEY(responsible_user_id) REFERENCES users(id);

CREATE TABLE IF NOT EXISTS import_runs (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK(status IN ('RUNNING','SUCCESS','FAILED')),
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  observed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS import_observations (
  id SERIAL PRIMARY KEY,
  import_run_id INTEGER NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL CHECK(severity IN ('INFO','WARNING','ERROR')),
  code VARCHAR(80),
  message TEXT NOT NULL,
  source_sheet VARCHAR(160),
  source_rows VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_level_2_level_1 ON service_level_2(level_1_id);
CREATE INDEX IF NOT EXISTS idx_service_level_2_status ON service_level_2(status);
CREATE INDEX IF NOT EXISTS idx_service_level_2_name ON service_level_2(name);
CREATE INDEX IF NOT EXISTS idx_import_observations_run ON import_observations(import_run_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
