-- A coluna auditoria_itens.resposta era varchar(100) (criada pelo TypeORM), mas guarda a
-- imagem PNG da resposta de assinatura e respostas de texto livre, que passam de 100 caracteres.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auditoria_itens'
      AND column_name = 'resposta'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.auditoria_itens ALTER COLUMN resposta TYPE text;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
