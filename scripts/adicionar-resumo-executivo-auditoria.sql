-- Adiciona coluna resumo_executivo na tabela auditorias
-- Esta coluna armazena o resumo executivo gerado por IA em formato JSONB

ALTER TABLE auditorias
ADD COLUMN IF NOT EXISTS resumo_executivo JSONB NULL;

-- Comentário explicativo
COMMENT ON COLUMN auditorias.resumo_executivo IS 'Resumo executivo gerado por IA contendo análise estratégica da auditoria (resumo, pontos fortes, pontos fracos, recomendações, risco geral e tendências)';
