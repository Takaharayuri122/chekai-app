-- Script de migração: ANALISTA -> GESTOR
-- Este script atualiza o enum e os dados existentes no banco de dados
-- Execute este script no SQL Editor do Supabase

-- PARTE 1: Adicionar o novo valor 'gestor' ao enum (se ainda não existir)
DO $$
DECLARE
    enum_oid oid;
    gestor_exists boolean;
BEGIN
    -- Encontrar o OID do enum
    SELECT oid INTO enum_oid
    FROM pg_type
    WHERE typname = 'usuarios_perfil_enum'
    LIMIT 1;
    
    IF enum_oid IS NOT NULL THEN
        -- Verificar se 'gestor' já existe
        SELECT EXISTS(
            SELECT 1 FROM pg_enum 
            WHERE enumtypid = enum_oid AND enumlabel = 'gestor'
        ) INTO gestor_exists;
        
        -- Adicionar 'gestor' se não existir
        IF NOT gestor_exists THEN
            ALTER TYPE usuarios_perfil_enum ADD VALUE 'gestor';
            RAISE NOTICE 'Valor "gestor" adicionado ao enum usuarios_perfil_enum';
        ELSE
            RAISE NOTICE 'Valor "gestor" já existe no enum, ignorando...';
        END IF;
    ELSE
        RAISE EXCEPTION 'Enum usuarios_perfil_enum não encontrado';
    END IF;
END $$;

-- PARTE 2: Atualizar os dados existentes de 'analista' para 'gestor'
DO $$
DECLARE
    rows_updated integer;
BEGIN
    -- Atualizar usuários
    UPDATE usuarios
    SET perfil = 'gestor'
    WHERE perfil = 'analista';
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Atualizados % usuários de "analista" para "gestor"', rows_updated;
END $$;

-- PARTE 3: Verificar se há usuários ainda com perfil 'analista' (não deveria haver)
DO $$
DECLARE
    usuarios_analista integer;
BEGIN
    SELECT COUNT(*) INTO usuarios_analista
    FROM usuarios
    WHERE perfil = 'analista';
    
    IF usuarios_analista > 0 THEN
        RAISE WARNING 'Ainda existem % usuários com perfil "analista". Verifique manualmente.', usuarios_analista;
    ELSE
        RAISE NOTICE 'Migração concluída: Todos os usuários foram atualizados para "gestor"';
    END IF;
END $$;

-- PARTE 4: Estatísticas finais
DO $$
DECLARE
    usuarios_gestor integer;
    usuarios_master integer;
    usuarios_auditor integer;
    total_usuarios integer;
BEGIN
    SELECT COUNT(*) INTO usuarios_gestor FROM usuarios WHERE perfil = 'gestor';
    SELECT COUNT(*) INTO usuarios_master FROM usuarios WHERE perfil = 'master';
    SELECT COUNT(*) INTO usuarios_auditor FROM usuarios WHERE perfil = 'auditor';
    SELECT COUNT(*) INTO total_usuarios FROM usuarios;
    
    RAISE NOTICE '=== Estatísticas de Perfis ===';
    RAISE NOTICE 'Total de usuários: %', total_usuarios;
    RAISE NOTICE 'Master: %', usuarios_master;
    RAISE NOTICE 'Gestor: %', usuarios_gestor;
    RAISE NOTICE 'Auditor: %', usuarios_auditor;
END $$;

