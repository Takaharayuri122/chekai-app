-- Sincronização offline do app iOS: criação idempotente de registros pelo id local do celular.

-- auditorias
ALTER TABLE auditorias ADD COLUMN IF NOT EXISTS local_id uuid NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_auditorias_consultor_local_id
  ON auditorias (consultor_id, local_id)
  WHERE local_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
