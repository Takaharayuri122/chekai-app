-- Migration para mapear perfis antigos para novos perfis RBAC
-- ADMIN -> MASTER
-- CONSULTOR -> ANALISTA
-- CLIENTE -> EMPRESA
--
-- IMPORTANTE: Execute PRIMEIRO o script migrar-perfis-rbac-parte1-enum.sql
-- para adicionar os novos valores ao enum antes de executar este script.
-- Se você estiver usando TypeORM com synchronize: true, os valores podem já existir.

-- Adicionar colunas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'analista_id') THEN
    ALTER TABLE usuarios ADD COLUMN analista_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'tenant_id') THEN
    ALTER TABLE usuarios ADD COLUMN tenant_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'analista_id') THEN
    ALTER TABLE clientes ADD COLUMN analista_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_templates' AND column_name = 'analista_id') THEN
    ALTER TABLE checklist_templates ADD COLUMN analista_id UUID;
  END IF;
END $$;

-- Adicionar foreign keys se não existirem
DO $$
BEGIN
  -- Verificar se a FK para usuarios.analista_id já existe (case-insensitive)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'usuarios' 
    AND kcu.column_name = 'analista_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    BEGIN
      ALTER TABLE usuarios 
      ADD CONSTRAINT FK_usuarios_analista 
      FOREIGN KEY (analista_id) REFERENCES usuarios(id);
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint FK_usuarios_analista já existe, ignorando...';
    END;
  END IF;
  
  -- Verificar se a FK para clientes.analista_id já existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'clientes' 
    AND kcu.column_name = 'analista_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    BEGIN
      ALTER TABLE clientes 
      ADD CONSTRAINT FK_clientes_analista 
      FOREIGN KEY (analista_id) REFERENCES usuarios(id);
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint FK_clientes_analista já existe, ignorando...';
    END;
  END IF;
  
  -- Verificar se a FK para checklist_templates.analista_id já existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'checklist_templates' 
    AND kcu.column_name = 'analista_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    BEGIN
      ALTER TABLE checklist_templates 
      ADD CONSTRAINT FK_templates_analista 
      FOREIGN KEY (analista_id) REFERENCES usuarios(id);
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'Constraint FK_templates_analista já existe, ignorando...';
    END;
  END IF;
END $$;

-- IMPORTANTE: ALTER TYPE ... ADD VALUE não pode ser executado dentro de blocos DO em transações
-- Execute estes comandos manualmente ANTES de executar o resto da migration
-- Ou ajuste o nome do enum conforme o que o TypeORM criou no seu banco

-- Primeiro, descubra o nome exato do enum executando:
-- SELECT t.typname FROM pg_type t JOIN pg_attribute a ON a.atttypid = t.oid 
-- JOIN pg_class c ON a.attrelid = c.oid 
-- WHERE c.relname = 'usuarios' AND a.attname = 'perfil' AND t.typtype = 'e';

-- Depois, execute os comandos ALTER TYPE com o nome correto do enum:
-- ALTER TYPE {nome_do_enum} ADD VALUE 'master';
-- ALTER TYPE {nome_do_enum} ADD VALUE 'analista';
-- ALTER TYPE {nome_do_enum} ADD VALUE 'auditor';
-- ALTER TYPE {nome_do_enum} ADD VALUE 'empresa';

-- Exemplo (ajuste o nome do enum conforme necessário):
-- ALTER TYPE usuarios_perfil_enum ADD VALUE 'master';
-- ALTER TYPE usuarios_perfil_enum ADD VALUE 'analista';
-- ALTER TYPE usuarios_perfil_enum ADD VALUE 'auditor';
-- ALTER TYPE usuarios_perfil_enum ADD VALUE 'empresa';

-- Se você estiver usando TypeORM com synchronize: true, os valores podem já existir
-- Nesse caso, você pode pular esta seção e ir direto para o mapeamento dos dados

-- Verificar se os novos valores do enum existem antes de mapear
DO $$
DECLARE
    enum_oid oid;
    master_exists boolean;
    analista_exists boolean;
    auditor_exists boolean;
    empresa_exists boolean;
BEGIN
    -- Encontrar o OID do enum
    SELECT t.oid INTO enum_oid
    FROM pg_type t
    JOIN pg_attribute a ON a.atttypid = t.oid
    JOIN pg_class c ON a.attrelid = c.oid
    WHERE c.relname = 'usuarios' 
    AND a.attname = 'perfil' 
    AND t.typtype = 'e'
    LIMIT 1;
    
    IF enum_oid IS NULL THEN
        RAISE EXCEPTION 'Enum não encontrado para a coluna perfil da tabela usuarios. Execute primeiro o script migrar-perfis-rbac-parte1-enum.sql';
    END IF;
    
    -- Verificar se os novos valores existem
    SELECT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid = enum_oid AND enumlabel = 'master') INTO master_exists;
    SELECT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid = enum_oid AND enumlabel = 'analista') INTO analista_exists;
    SELECT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid = enum_oid AND enumlabel = 'auditor') INTO auditor_exists;
    SELECT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid = enum_oid AND enumlabel = 'empresa') INTO empresa_exists;
    
    IF NOT (master_exists AND analista_exists AND auditor_exists AND empresa_exists) THEN
        RAISE EXCEPTION 'Novos valores do enum não encontrados. Execute primeiro o script migrar-perfis-rbac-parte1-enum.sql para adicionar os valores: master, analista, auditor, empresa';
    END IF;
    
    RAISE NOTICE 'Validação do enum concluída. Prosseguindo com o mapeamento dos perfis...';
END $$;

-- Mapear perfis antigos para novos
DO $$
DECLARE
    rows_updated integer;
BEGIN
    -- Mapear admin -> master
    UPDATE usuarios 
    SET perfil = 'master'
    WHERE perfil = 'admin';
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Mapeados % usuários de admin para master', rows_updated;
    
    -- Mapear consultor -> analista
    UPDATE usuarios 
    SET perfil = 'analista'
    WHERE perfil = 'consultor';
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Mapeados % usuários de consultor para analista', rows_updated;
    
    -- Mapear cliente -> empresa
    UPDATE usuarios 
    SET perfil = 'empresa'
    WHERE perfil = 'cliente';
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Mapeados % usuários de cliente para empresa', rows_updated;
END $$;

-- Configurar tenantId para Analistas (são seus próprios tenants)
DO $$
DECLARE
    rows_updated integer;
BEGIN
    UPDATE usuarios 
    SET tenant_id = id 
    WHERE perfil = 'analista' AND tenant_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Configurado tenant_id para % analistas', rows_updated;
END $$;

-- Comentário: Relações entre Analistas e Auditores devem ser configuradas manualmente
-- ou através da aplicação após a migração

-- Verificação final
DO $$
DECLARE
    total_usuarios integer;
    usuarios_master integer;
    usuarios_analista integer;
    usuarios_auditor integer;
    usuarios_empresa integer;
BEGIN
    SELECT COUNT(*) INTO total_usuarios FROM usuarios;
    SELECT COUNT(*) INTO usuarios_master FROM usuarios WHERE perfil = 'master';
    SELECT COUNT(*) INTO usuarios_analista FROM usuarios WHERE perfil = 'analista';
    SELECT COUNT(*) INTO usuarios_auditor FROM usuarios WHERE perfil = 'auditor';
    SELECT COUNT(*) INTO usuarios_empresa FROM usuarios WHERE perfil = 'empresa';
    
    RAISE NOTICE '=== Resumo da Migração ===';
    RAISE NOTICE 'Total de usuários: %', total_usuarios;
    RAISE NOTICE 'Master: %', usuarios_master;
    RAISE NOTICE 'Analista: %', usuarios_analista;
    RAISE NOTICE 'Auditor: %', usuarios_auditor;
    RAISE NOTICE 'Empresa: %', usuarios_empresa;
    RAISE NOTICE '========================';
END $$;

