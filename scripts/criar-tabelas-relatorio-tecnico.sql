-- Cria enum de status do relatório técnico
DO $$
BEGIN
  CREATE TYPE relatorios_tecnicos_status_enum AS ENUM ('rascunho', 'finalizado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Cria tabela principal de relatórios técnicos
CREATE TABLE IF NOT EXISTS relatorios_tecnicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL,
  unidade_id UUID,
  consultora_id UUID NOT NULL,
  identificacao TEXT NOT NULL,
  descricao_ocorrencia_html TEXT NOT NULL,
  avaliacao_tecnica_html TEXT NOT NULL,
  acoes_executadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  recomendacoes_consultora_html TEXT NOT NULL,
  plano_acao_sugerido_html TEXT NOT NULL,
  apoio_analitico_chek_ai TEXT,
  status relatorios_tecnicos_status_enum NOT NULL DEFAULT 'rascunho',
  assinatura_nome_consultora TEXT NOT NULL DEFAULT '',
  pdf_url TEXT,
  pdf_gerado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_relatorios_tecnicos_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT fk_relatorios_tecnicos_unidade
    FOREIGN KEY (unidade_id) REFERENCES unidades(id),
  CONSTRAINT fk_relatorios_tecnicos_consultora
    FOREIGN KEY (consultora_id) REFERENCES usuarios(id)
);

-- Cria tabela de evidências fotográficas do relatório técnico
CREATE TABLE IF NOT EXISTS relatorios_tecnicos_fotos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  "nomeOriginal" VARCHAR(255),
  "mimeType" VARCHAR(50),
  "tamanhoBytes" INTEGER,
  exif JSONB,
  relatorio_tecnico_id UUID NOT NULL,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_relatorios_tecnicos_fotos_relatorio
    FOREIGN KEY (relatorio_tecnico_id) REFERENCES relatorios_tecnicos(id) ON DELETE CASCADE
);

-- Índices de apoio
CREATE INDEX IF NOT EXISTS idx_relatorios_tecnicos_cliente_id ON relatorios_tecnicos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_tecnicos_unidade_id ON relatorios_tecnicos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_tecnicos_status ON relatorios_tecnicos(status);
CREATE INDEX IF NOT EXISTS idx_relatorios_tecnicos_criado_em ON relatorios_tecnicos("criadoEm");
CREATE INDEX IF NOT EXISTS idx_relatorios_tecnicos_fotos_relatorio_id ON relatorios_tecnicos_fotos(relatorio_tecnico_id);
