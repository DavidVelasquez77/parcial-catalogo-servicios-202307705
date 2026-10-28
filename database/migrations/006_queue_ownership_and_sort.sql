-- Cada cola tiene un responsable. En instalaciones existentes se asigna
-- temporalmente una cuenta activa de administración o atención; el responsable
-- puede cambiarse desde el mantenimiento de colas.
ALTER TABLE support_queues ADD COLUMN IF NOT EXISTS responsible_user_id INTEGER REFERENCES users(id);

UPDATE support_queues q SET responsible_user_id = (
  SELECT u.id FROM users u
  WHERE u.active AND EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role IN ('ADMIN','AGENTE')
  ) AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='CONSULTA'
  )
  ORDER BY CASE WHEN u.role='ADMIN' THEN 0 ELSE 1 END,u.id LIMIT 1
)
WHERE q.responsible_user_id IS NULL;

ALTER TABLE support_queues ALTER COLUMN responsible_user_id SET NOT NULL;
INSERT INTO queue_grants(queue_id,user_id,can_view,can_handle)
SELECT id,responsible_user_id,TRUE,TRUE FROM support_queues WHERE active
ON CONFLICT (queue_id,user_id) WHERE role IS NULL
DO UPDATE SET can_view=TRUE,can_handle=TRUE;
ALTER TABLE support_queues DROP CONSTRAINT IF EXISTS support_queues_sort_rule_check;
ALTER TABLE support_queues ADD CONSTRAINT support_queues_sort_rule_check
  CHECK (sort_rule IN ('PRIORITY_AGE','AGE_PRIORITY'));
CREATE INDEX IF NOT EXISTS idx_support_queues_responsible ON support_queues(responsible_user_id);
