-- Ampliación del catálogo para Service Desk. La migración 001 permanece intacta.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(24) NOT NULL CHECK (role IN ('ADMIN','CONSULTA','SOLICITANTE','AGENTE','APROBADOR')),
  PRIMARY KEY (user_id, role)
);
INSERT INTO user_roles(user_id, role)
SELECT id, role FROM users
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS support_queues (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  process VARCHAR(40) NOT NULL CHECK (process IN
    ('NEW_SERVICE','CHANGE','INCIDENT','EVENT','PROBLEM','ACCESS','TECH_SERVICE')),
  support_level SMALLINT NOT NULL DEFAULT 1 CHECK (support_level BETWEEN 0 AND 4),
  sort_rule VARCHAR(40) NOT NULL DEFAULT 'PRIORITY_AGE'
    CHECK (sort_rule IN ('PRIORITY_AGE')),
  first_response_minutes INTEGER CHECK (first_response_minutes > 0),
  resolution_minutes INTEGER CHECK (resolution_minutes > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_grants (
  id SERIAL PRIMARY KEY,
  queue_id INTEGER NOT NULL REFERENCES support_queues(id),
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(24) CHECK (role IN ('ADMIN','AGENTE','APROBADOR')),
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_handle BOOLEAN NOT NULL DEFAULT FALSE,
  can_transfer BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve BOOLEAN NOT NULL DEFAULT FALSE,
  can_admin BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK ((user_id IS NULL) <> (role IS NULL)),
  UNIQUE (queue_id, user_id, role)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_grants_role
  ON queue_grants(queue_id, role) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_grants_user
  ON queue_grants(queue_id, user_id) WHERE role IS NULL;

CREATE TABLE IF NOT EXISTS ci_categories (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  parent_id INTEGER REFERENCES ci_categories(id),
  source_kind VARCHAR(24) NOT NULL CHECK (source_kind IN ('EXCEL','LESSON_22','PROJECT')),
  source_reference VARCHAR(240) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE IF NOT EXISTS ci_locations (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS configuration_items (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(240) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES ci_categories(id),
  is_device BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  serial_number VARCHAR(160),
  version VARCHAR(120),
  acquired_on DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','MAINTENANCE','RETIRED','UNKNOWN')),
  location VARCHAR(240) NOT NULL,
  location_id INTEGER REFERENCES ci_locations(id),
  responsible_user_id INTEGER REFERENCES users(id),
  responsible_label VARCHAR(240),
  documentation_url TEXT,
  security_level VARCHAR(60),
  compliance_status VARCHAR(100),
  configuration_status VARCHAR(100),
  license_number VARCHAR(160),
  license_expires_on DATE,
  technical_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  synthetic_seed VARCHAR(80),
  source_reference VARCHAR(240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_configuration_items_category ON configuration_items(category_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_name ON configuration_items(name);
CREATE INDEX IF NOT EXISTS idx_configuration_items_seed ON configuration_items(synthetic_seed);

CREATE TABLE IF NOT EXISTS ci_relations (
  id BIGSERIAL PRIMARY KEY,
  from_ci_id BIGINT NOT NULL REFERENCES configuration_items(id),
  to_ci_id BIGINT NOT NULL REFERENCES configuration_items(id),
  relation_type VARCHAR(24) NOT NULL CHECK (relation_type IN
    ('DEPENDS_ON','CONNECTED_TO','HOSTED_ON','PARENT_OF')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_ci_id, to_ci_id, relation_type),
  CHECK (from_ci_id <> to_ci_id)
);
CREATE INDEX IF NOT EXISTS idx_ci_relations_to ON ci_relations(to_ci_id);

CREATE TABLE IF NOT EXISTS ci_services (
  ci_id BIGINT NOT NULL REFERENCES configuration_items(id),
  service_id INTEGER NOT NULL REFERENCES service_level_2(id),
  PRIMARY KEY (ci_id, service_id)
);

CREATE TABLE IF NOT EXISTS ci_history (
  id BIGSERIAL PRIMARY KEY,
  ci_id BIGINT NOT NULL REFERENCES configuration_items(id),
  actor_id INTEGER REFERENCES users(id),
  action VARCHAR(60) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ci_history_ci ON ci_history(ci_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  number VARCHAR(32) UNIQUE,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  creator_id INTEGER NOT NULL REFERENCES users(id),
  beneficiary_id INTEGER REFERENCES users(id),
  service_id INTEGER NOT NULL REFERENCES service_level_2(id),
  queue_id INTEGER NOT NULL REFERENCES support_queues(id),
  assigned_user_id INTEGER REFERENCES users(id),
  type VARCHAR(32) NOT NULL CHECK (type IN
    ('ACCESS','EVENT','INCIDENT','CHANGE','SERVICE_REQUEST','PROBLEM')),
  process VARCHAR(40) NOT NULL CHECK (process IN
    ('NEW_SERVICE','CHANGE','INCIDENT','EVENT','PROBLEM','ACCESS','TECH_SERVICE')),
  state VARCHAR(40) NOT NULL,
  priority SMALLINT NOT NULL CHECK (priority BETWEEN 1 AND 5),
  impact SMALLINT NOT NULL CHECK (impact BETWEEN 1 AND 5),
  urgency SMALLINT NOT NULL CHECK (urgency BETWEEN 1 AND 5),
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('PORTAL','PHONE','EMAIL','IN_PERSON','SYSTEM')),
  process_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  no_ci_reason TEXT,
  first_attended_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  paused_seconds BIGINT NOT NULL DEFAULT 0 CHECK (paused_seconds >= 0),
  reopen_count INTEGER NOT NULL DEFAULT 0 CHECK (reopen_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_queue_state ON tickets(queue_id, state, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assigned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_priority_age ON tickets(priority DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS ticket_ci (
  ticket_id BIGINT NOT NULL REFERENCES tickets(id),
  ci_id BIGINT NOT NULL REFERENCES configuration_items(id),
  PRIMARY KEY (ticket_id, ci_id)
);
CREATE TABLE IF NOT EXISTS ticket_links (
  ticket_id BIGINT NOT NULL REFERENCES tickets(id),
  related_ticket_id BIGINT NOT NULL REFERENCES tickets(id),
  link_type VARCHAR(32) NOT NULL CHECK (link_type IN
    ('RELATED','CAUSED_BY','DUPLICATE_OF','IMPLEMENTS','GENERATED_INCIDENT')),
  PRIMARY KEY (ticket_id, related_ticket_id, link_type),
  CHECK (ticket_id <> related_ticket_id)
);
CREATE TABLE IF NOT EXISTS ticket_history (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id),
  actor_id INTEGER REFERENCES users(id),
  action VARCHAR(60) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket ON ticket_history(ticket_id, created_at);
CREATE TABLE IF NOT EXISTS ticket_comments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  visibility VARCHAR(16) NOT NULL CHECK (visibility IN ('PUBLIC','INTERNAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id),
  uploader_id INTEGER NOT NULL REFERENCES users(id),
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ticket_notifications (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  body TEXT NOT NULL,
  service_id INTEGER REFERENCES service_level_2(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
