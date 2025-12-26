-- PARTE 1: Adicionar novos valores ao enum
-- Execute este script PRIMEIRO, antes da parte 2
-- IMPORTANTE: Estes comandos devem ser executados FORA de uma transação

-- Primeiro, descubra o nome exato do enum executando esta query:
-- SELECT t.typname 
-- FROM pg_type t 
-- JOIN pg_attribute a ON a.atttypid = t.oid 
-- JOIN pg_class c ON a.attrelid = c.oid 
-- WHERE c.relname = 'usuarios' 
-- AND a.attname = 'perfil' 
-- AND t.typtype = 'e';

-- Depois, execute os comandos ALTER TYPE com o nome correto do enum
-- (Substitua 'usuarios_perfil_enum' pelo nome real do enum se for diferente)

-- Se o enum se chama 'usuarios_perfil_enum', execute:
-- (Se der erro de valor duplicado, significa que já existe e pode ser ignorado)

ALTER TYPE usuarios_perfil_enum ADD VALUE 'master';
ALTER TYPE usuarios_perfil_enum ADD VALUE 'analista';
ALTER TYPE usuarios_perfil_enum ADD VALUE 'auditor';
ALTER TYPE usuarios_perfil_enum ADD VALUE 'empresa';

-- Nota: Se você receber erro "enum label already exists", significa que o valor
-- já existe no enum (provavelmente criado pelo TypeORM synchronize) e pode ser ignorado.

