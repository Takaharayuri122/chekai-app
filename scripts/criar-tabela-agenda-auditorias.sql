DO $$
BEGIN
  CREATE TYPE agenda_auditorias_status_enum AS ENUM ('agendada', 'realizada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE agenda_auditorias_recorrencia_enum AS ENUM ('nenhuma', 'semanal', 'quinzenal', 'mensal');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS agenda_auditorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gestor_id UUID NOT NULL,
  unidade_id UUID NOT NULL,
  template_id UUID NOT NULL,
  responsavel_id UUID,
  criado_por_id UUID NOT NULL,
  data_prevista DATE NOT NULL,
  recorrencia agenda_auditorias_recorrencia_enum NOT NULL DEFAULT 'nenhuma',
  status agenda_auditorias_status_enum NOT NULL DEFAULT 'agendada',
  observacao TEXT,
  realizada_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_agenda_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios(id),
  CONSTRAINT fk_agenda_unidade FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE,
  CONSTRAINT fk_agenda_template FOREIGN KEY (template_id) REFERENCES checklist_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_agenda_responsavel FOREIGN KEY (responsavel_id) REFERENCES usuarios(id),
  CONSTRAINT fk_agenda_criado_por FOREIGN KEY (criado_por_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_agenda_gestor_status ON agenda_auditorias(gestor_id, status);
CREATE INDEX IF NOT EXISTS idx_agenda_data_prevista ON agenda_auditorias(data_prevista);
CREATE INDEX IF NOT EXISTS idx_agenda_responsavel ON agenda_auditorias(responsavel_id);
