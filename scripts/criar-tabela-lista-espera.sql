-- Tabela de lista de espera (fase beta).
-- Execute no Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS lista_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  telefone VARCHAR(20) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
