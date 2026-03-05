-- Migration: Substituir campo booleano 'ativo' por enum 'status' na tabela usuarios
-- Também adiciona campos para token de convite

-- 1. Criar o tipo enum para status do usuário
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'usuarios_status_enum') THEN
    CREATE TYPE usuarios_status_enum AS ENUM ('nao_confirmado', 'ativo', 'inativo');
  END IF;
END$$;

-- 2. Adicionar coluna status com default 'ativo'
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS status usuarios_status_enum NOT NULL DEFAULT 'ativo';

-- 3. Migrar dados existentes: ativo=true -> 'ativo', ativo=false -> 'inativo'
UPDATE usuarios SET status = 'ativo' WHERE ativo = true;
UPDATE usuarios SET status = 'inativo' WHERE ativo = false;

-- 4. Adicionar colunas para token de convite
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS token_convite VARCHAR(255) NULL;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS token_convite_expires_at TIMESTAMP NULL;

-- 5. Remover coluna ativo (executar depois de validar a migração)
-- ALTER TABLE usuarios DROP COLUMN IF EXISTS ativo;
