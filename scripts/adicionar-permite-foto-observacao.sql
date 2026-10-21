-- Adiciona permiteFoto e permiteObservacao em template_itens (RN-CHK-014/015).
-- As colunas seguem o padrão do TypeORM (camelCase, entre aspas).
-- Itens existentes mantêm o comportamento atual (DEFAULT true).

ALTER TABLE template_itens ADD COLUMN IF NOT EXISTS "permiteFoto" boolean NOT NULL DEFAULT true;
ALTER TABLE template_itens ADD COLUMN IF NOT EXISTS "permiteObservacao" boolean NOT NULL DEFAULT true;

-- RN-CHK-014: itens de texto não permitem foto, nem opções, nem pontuação.
UPDATE template_itens
SET "permiteFoto" = false
WHERE "tipoRespostaCustomizada" = 'texto';

UPDATE template_itens
SET "opcoesRespostaConfig" = COALESCE((
  SELECT jsonb_agg(
    (cfg - 'pontuacao') || jsonb_build_object('fotoObrigatoria', false)
  )
  FROM jsonb_array_elements("opcoesRespostaConfig") AS cfg
), '[]'::jsonb)
WHERE "tipoRespostaCustomizada" = 'texto';
