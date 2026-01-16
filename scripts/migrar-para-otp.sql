-- Migração para sistema de autenticação via OTP
-- Este script altera a estrutura do banco de dados para suportar login via OTP

-- 1. Verificar e tornar senha_hash nullable (usuários novos não terão senha)
-- Verifica se a coluna existe antes de tentar alterá-la
DO $$
BEGIN
    -- Verifica se a coluna senha_hash existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'senha_hash'
    ) THEN
        -- Verifica se a coluna tem constraint NOT NULL antes de tentar remover
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'senha_hash' 
            AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE usuarios ALTER COLUMN senha_hash DROP NOT NULL;
            RAISE NOTICE 'Coluna senha_hash alterada para nullable';
        ELSE
            RAISE NOTICE 'Coluna senha_hash já é nullable';
        END IF;
    ELSE
        RAISE NOTICE 'Coluna senha_hash não encontrada. Se o banco foi criado com synchronize, isso é normal.';
    END IF;
END $$;

-- 2. Adicionar campos para OTP
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6) NULL,
ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP NULL;

-- 3. Criar índice para otp_code (opcional, mas pode melhorar performance)
CREATE INDEX IF NOT EXISTS idx_usuarios_otp_code ON usuarios(otp_code) WHERE otp_code IS NOT NULL;

-- 4. Comentários para documentação
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'senha_hash'
    ) THEN
        COMMENT ON COLUMN usuarios.senha_hash IS 'Hash da senha (nullable - não usado com sistema OTP)';
    END IF;
END $$;

COMMENT ON COLUMN usuarios.otp_code IS 'Código OTP temporário de 6 dígitos para login';
COMMENT ON COLUMN usuarios.otp_expires_at IS 'Data e hora de expiração do código OTP (válido por 10 minutos)';

