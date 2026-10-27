ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('ADMIN','CONSULTA','SOLICITANTE','AGENTE','APROBADOR'));
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role,user_id);
INSERT INTO user_roles(user_id,role)
SELECT id,role FROM users
ON CONFLICT DO NOTHING;
