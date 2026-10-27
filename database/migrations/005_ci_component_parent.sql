-- Lección 22 (explicación oral 21:37-22:01): un componente físico
-- pertenece a un solo CI padre. Las relaciones de dependencia y conexión
-- son distintas y no quedan afectadas por esta restricción.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ci_component_single_parent
  ON ci_relations(to_ci_id) WHERE relation_type = 'PARENT_OF';
