-- Script para verificar as colunas da tabela usuarios
-- Execute este script primeiro para descobrir o nome real da coluna de senha

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;

