-- Faixas de classificação e envio automático do relatório no template de checklist
ALTER TABLE checklist_templates
  ADD COLUMN IF NOT EXISTS faixas_classificacao jsonb NULL;

ALTER TABLE checklist_templates
  ADD COLUMN IF NOT EXISTS enviar_relatorio_ao_finalizar boolean NOT NULL DEFAULT false;

-- Histórico de envios do relatório da auditoria por e-mail
CREATE TABLE IF NOT EXISTS auditoria_envios_relatorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  destinatarios text[] NOT NULL,
  automatico boolean NOT NULL,
  enviado_por_id uuid NULL REFERENCES usuarios(id),
  sucesso boolean NOT NULL,
  erro text NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_envios_relatorio_auditoria_id
  ON auditoria_envios_relatorio (auditoria_id);

NOTIFY pgrst, 'reload schema';
