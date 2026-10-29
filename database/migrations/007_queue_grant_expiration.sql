-- Los permisos existentes de evaluación vencen al terminar 2026 (hora Guatemala).
ALTER TABLE queue_grants ADD COLUMN expires_on DATE NOT NULL DEFAULT DATE '2026-12-31';
CREATE INDEX IF NOT EXISTS idx_queue_grants_expiration ON queue_grants(queue_id,expires_on);
