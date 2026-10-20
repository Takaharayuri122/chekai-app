-- Modelo personalizável do relatório técnico (RN-REL-009 a RN-REL-012)

-- Um modelo por gestor: seções configuráveis (ativa/título) em JSONB
CREATE TABLE IF NOT EXISTS modelos_relatorio_tecnico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gestor_id UUID NOT NULL,
  secoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_modelos_relatorio_tecnico_gestor UNIQUE (gestor_id),
  CONSTRAINT fk_modelos_relatorio_tecnico_gestor
    FOREIGN KEY (gestor_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Snapshot do modelo aplicado, gravado na finalização do relatório
ALTER TABLE IF EXISTS relatorios_tecnicos
  ADD COLUMN IF NOT EXISTS modelo_secoes JSONB;

-- Recurso liberado por plano
ALTER TABLE IF EXISTS planos
  ADD COLUMN IF NOT EXISTS permite_modelo_relatorio_tecnico BOOLEAN NOT NULL DEFAULT false;
