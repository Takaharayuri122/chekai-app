-- Adiciona campos para armazenar URL do PDF e data de geração
ALTER TABLE auditorias
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_gerado_em TIMESTAMP;

-- Cria índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_auditorias_pdf_gerado_em ON auditorias(pdf_gerado_em);
