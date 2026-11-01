-- Sincronização offline do app iOS: criação idempotente de registros pelo id local do celular.

-- auditorias
ALTER TABLE auditorias ADD COLUMN IF NOT EXISTS local_id uuid NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_auditorias_consultor_local_id
  ON auditorias (consultor_id, local_id)
  WHERE local_id IS NOT NULL;

-- clientes e unidades
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS inativado_em timestamp NULL;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS inativado_em timestamp NULL;

-- desvínculos de auditores
CREATE TABLE IF NOT EXISTS cliente_auditor_desvinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  auditor_id uuid NOT NULL,
  desvinculado_em timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_cliente_auditor_desvinculos_cliente_auditor
  ON cliente_auditor_desvinculos (cliente_id, auditor_id);

-- checkins
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS local_id uuid NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_checkins_usuario_local_id
  ON checkins (usuario_id, local_id)
  WHERE local_id IS NOT NULL;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS checkin_offline boolean NOT NULL DEFAULT false;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS checkin_sincronizado_em timestamp NULL;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS checkout_offline boolean NOT NULL DEFAULT false;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS checkout_sincronizado_em timestamp NULL;
ALTER TABLE checkins ALTER COLUMN latitude_checkin DROP NOT NULL;
ALTER TABLE checkins ALTER COLUMN longitude_checkin DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
