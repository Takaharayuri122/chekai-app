-- Novo tipo de resposta "assinatura": a pessoa assina na tela e a resposta guarda a imagem PNG.
-- O tipo enum da coluna template_itens."tipoRespostaCustomizada" foi criado pelo TypeORM;
-- o nome é lido do catálogo para não depender da convenção de nomes.
DO $$
DECLARE
  nome_tipo text;
BEGIN
  SELECT t.typname INTO nome_tipo
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'template_itens'
    AND a.attname = 'tipoRespostaCustomizada'
    AND t.typtype = 'e';

  IF nome_tipo IS NOT NULL THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', nome_tipo, 'assinatura');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
