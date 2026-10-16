DO $$
BEGIN
  CREATE TYPE planos_acao_tarefas_status_enum AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS planos_acao_tarefas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gestor_id UUID NOT NULL,
  auditoria_id UUID,
  titulo VARCHAR(200) NOT NULL,
  descricao TEXT,
  responsavel_id UUID,
  criado_por_id UUID NOT NULL,
  prazo DATE NOT NULL,
  status planos_acao_tarefas_status_enum NOT NULL DEFAULT 'pendente',
  concluida_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_planos_acao_gestor FOREIGN KEY (gestor_id) REFERENCES usuarios(id),
  CONSTRAINT fk_planos_acao_auditoria FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE SET NULL,
  CONSTRAINT fk_planos_acao_responsavel FOREIGN KEY (responsavel_id) REFERENCES usuarios(id),
  CONSTRAINT fk_planos_acao_criado_por FOREIGN KEY (criado_por_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_planos_acao_gestor_status ON planos_acao_tarefas(gestor_id, status);
CREATE INDEX IF NOT EXISTS idx_planos_acao_prazo ON planos_acao_tarefas(prazo);
CREATE INDEX IF NOT EXISTS idx_planos_acao_responsavel ON planos_acao_tarefas(responsavel_id);
