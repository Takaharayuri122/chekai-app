-- Script de migração: Alterar coluna resposta de enum para varchar
-- Isso permite suportar opções personalizadas de resposta nos templates

-- PARTE 1: Alterar o tipo da coluna resposta de enum para varchar
DO $$
BEGIN
    -- Verificar se a coluna existe e é do tipo enum
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'auditoria_itens' 
        AND column_name = 'resposta'
        AND data_type = 'USER-DEFINED'
    ) THEN
        -- Alterar o tipo da coluna para varchar
        ALTER TABLE auditoria_itens 
        ALTER COLUMN resposta TYPE VARCHAR(100) 
        USING resposta::text;
        
        RAISE NOTICE 'Coluna resposta alterada de enum para VARCHAR(100).';
    ELSE
        -- Se já for varchar, apenas garantir o tamanho
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'auditoria_itens' 
            AND column_name = 'resposta'
        ) THEN
            ALTER TABLE auditoria_itens 
            ALTER COLUMN resposta TYPE VARCHAR(100);
            
            RAISE NOTICE 'Tamanho da coluna resposta ajustado para VARCHAR(100).';
        ELSE
            RAISE WARNING 'Coluna resposta não encontrada na tabela auditoria_itens.';
        END IF;
    END IF;
END
$$;

-- PARTE 2: Garantir que o valor padrão está correto
DO $$
BEGIN
    -- Verificar se o valor padrão existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'auditoria_itens' 
        AND column_name = 'resposta'
        AND column_default IS NULL
    ) THEN
        ALTER TABLE auditoria_itens 
        ALTER COLUMN resposta SET DEFAULT 'nao_avaliado';
        
        RAISE NOTICE 'Valor padrão "nao_avaliado" definido para a coluna resposta.';
    END IF;
END
$$;

-- PARTE 3: Verificar se há dados existentes que precisam ser mantidos
DO $$
DECLARE
    total_registros integer;
BEGIN
    SELECT COUNT(*) INTO total_registros
    FROM auditoria_itens;
    
    RAISE NOTICE 'Total de registros na tabela auditoria_itens: %', total_registros;
    
    -- Verificar se há valores que não são do enum padrão
    IF EXISTS (
        SELECT 1 
        FROM auditoria_itens 
        WHERE resposta NOT IN ('conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado')
    ) THEN
        RAISE NOTICE 'Encontrados registros com respostas personalizadas.';
    ELSE
        RAISE NOTICE 'Todos os registros usam valores padrão do enum.';
    END IF;
END
$$;

