-- Adiciona coluna resumo_executivo_gerado_em na tabela auditorias
-- Usada para habilitar novamente o botão "Gerar Resumo" quando a auditoria for alterada após a geração

ALTER TABLE auditorias
ADD COLUMN IF NOT EXISTS resumo_executivo_gerado_em TIMESTAMP NULL;

COMMENT ON COLUMN auditorias.resumo_executivo_gerado_em IS 'Data/hora em que o resumo executivo foi gerado; comparado com atualizado_em para exibir resumo desatualizado';
