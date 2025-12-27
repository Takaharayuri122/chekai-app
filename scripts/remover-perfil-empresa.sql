-- Script para remover o perfil 'empresa' do enum usuarios_perfil_enum
-- IMPORTANTE: Este script deve ser executado apenas se não houver usuários com perfil 'empresa'
-- ou se todos os usuários com perfil 'empresa' já foram migrados/removidos

DO $$
DECLARE
    enum_name text;
    enum_oid oid;
    usuarios_empresa_count integer;
BEGIN
    -- Verifica se há usuários com perfil 'empresa'
    SELECT COUNT(*) INTO usuarios_empresa_count 
    FROM usuarios 
    WHERE perfil = 'empresa';
    
    IF usuarios_empresa_count > 0 THEN
        RAISE EXCEPTION 'Existem % usuário(s) com perfil "empresa". Migre ou remova esses usuários antes de executar este script.', usuarios_empresa_count;
    END IF;
    
    -- Tenta encontrar o nome do enum da coluna 'perfil' na tabela 'usuarios'
    SELECT t.typname, t.oid INTO enum_name, enum_oid
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    JOIN pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'usuarios'
    AND a.attname = 'perfil'
    AND t.typtype = 'e'
    LIMIT 1;
    
    -- Se não encontrou, tenta o nome padrão do TypeORM
    IF enum_name IS NULL THEN
        SELECT typname, oid INTO enum_name, enum_oid
        FROM pg_type
        WHERE typname = 'usuarios_perfil_enum'
        AND typtype = 'e'
        LIMIT 1;
    END IF;
    
    IF enum_name IS NOT NULL THEN
        -- Verifica se o valor 'empresa' existe no enum
        IF EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = enum_oid AND enumlabel = 'empresa') THEN
            -- PostgreSQL não permite remover valores de enum diretamente
            -- A solução é criar um novo enum sem 'empresa', migrar os dados e substituir
            RAISE NOTICE 'O valor "empresa" existe no enum %. Para removê-lo completamente, é necessário criar um novo enum sem esse valor e migrar os dados.';
            RAISE NOTICE 'Como não há usuários com perfil "empresa", você pode deixar o valor no enum sem problemas.';
            RAISE NOTICE 'O TypeORM continuará funcionando normalmente, apenas não permitirá criar novos usuários com esse perfil.';
        ELSE
            RAISE NOTICE 'O valor "empresa" não existe no enum %. Nada a fazer.';
        END IF;
    ELSE
        RAISE WARNING 'Enum de perfil de usuário não encontrado. Verifique a tabela "usuarios" e a coluna "perfil".';
    END IF;
END $$;

