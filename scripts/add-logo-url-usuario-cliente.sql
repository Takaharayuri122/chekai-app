-- Adiciona coluna logo_url em usuarios (logo da consultoria) e clientes (imagem do cliente)
-- Execute no Supabase SQL Editor ou via psql se o TypeORM migration falhar.

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS logo_url TEXT;
