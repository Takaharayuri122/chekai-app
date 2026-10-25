-- Legislação automática: permissão, leitura, vínculos e busca filtrada.
-- Idempotente: pode ser rodado mais de uma vez. Rodar antes do deploy da API.
-- Colunas de legislacoes/template_itens/auditoria_itens seguem o padrão do TypeORM
-- (camelCase, entre aspas); usuarios, tabelas de vínculo e planos_acao_tarefas usam snake_case.

-- 1. Permissão do gestor para gerenciar legislações (MASTER sempre pode).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pode_gerenciar_legislacoes boolean NOT NULL DEFAULT false;

-- 2. Legislações: número e ano só são conhecidos depois da leitura.
ALTER TABLE legislacoes ALTER COLUMN "numero" DROP NOT NULL;
ALTER TABLE legislacoes ALTER COLUMN "ano" DROP NOT NULL;

ALTER TABLE legislacoes ADD COLUMN IF NOT EXISTS "informacoes" text;
ALTER TABLE legislacoes ADD COLUMN IF NOT EXISTS "situacao" varchar(30);
ALTER TABLE legislacoes ADD COLUMN IF NOT EXISTS "dataPublicacao" date;
-- As já cadastradas entram como concluídas; as novas começam pendentes.
ALTER TABLE legislacoes ADD COLUMN IF NOT EXISTS "statusLeitura" varchar(20) NOT NULL DEFAULT 'concluida';
ALTER TABLE legislacoes ALTER COLUMN "statusLeitura" SET DEFAULT 'pendente';
ALTER TABLE legislacoes ADD COLUMN IF NOT EXISTS "erroLeitura" text;
ALTER TABLE legislacoes ADD COLUMN IF NOT EXISTS "lidoEm" timestamptz;
ALTER TABLE legislacoes ADD COLUMN IF NOT EXISTS "origemTexto" varchar(10);
ALTER TABLE legislacoes ADD COLUMN IF NOT EXISTS "criadoPorId" uuid;

-- Link vazio ou só com espaços conta como "sem link" (não entra no dedupe nem no índice).
UPDATE legislacoes SET "linkOficial" = NULL WHERE btrim("linkOficial") = '';

-- Dedupe por link (a API normaliza o link antes de comparar).
-- Bases antigas podem ter links repetidos: mantém o link só na legislação mais antiga.
UPDATE legislacoes l
   SET "linkOficial" = NULL
  FROM (
    SELECT id,
           row_number() OVER (PARTITION BY lower("linkOficial") ORDER BY "criadoEm", id) AS posicao
      FROM legislacoes
     WHERE "linkOficial" IS NOT NULL
  ) d
 WHERE l.id = d.id
   AND d.posicao > 1;

CREATE UNIQUE INDEX IF NOT EXISTS legislacoes_link_unico
  ON legislacoes (lower("linkOficial"))
  WHERE "linkOficial" IS NOT NULL;

-- 3. Compatibilidade: o texto das referências passa a guardar vários nomes.
ALTER TABLE template_itens ALTER COLUMN "legislacaoReferencia" TYPE text;
ALTER TABLE auditoria_itens ALTER COLUMN "referenciaLegal" TYPE text;

-- 4. Vínculos item <-> legislação.
CREATE TABLE IF NOT EXISTS template_item_legislacoes (
  template_item_id uuid NOT NULL REFERENCES template_itens(id) ON DELETE CASCADE,
  legislacao_id uuid NOT NULL REFERENCES legislacoes(id) ON DELETE CASCADE,
  PRIMARY KEY (template_item_id, legislacao_id)
);
CREATE INDEX IF NOT EXISTS idx_template_item_legislacoes_legislacao
  ON template_item_legislacoes (legislacao_id);

CREATE TABLE IF NOT EXISTS auditoria_item_legislacoes (
  auditoria_item_id uuid NOT NULL REFERENCES auditoria_itens(id) ON DELETE CASCADE,
  legislacao_id uuid NOT NULL REFERENCES legislacoes(id) ON DELETE CASCADE,
  PRIMARY KEY (auditoria_item_id, legislacao_id)
);
CREATE INDEX IF NOT EXISTS idx_auditoria_item_legislacoes_legislacao
  ON auditoria_item_legislacoes (legislacao_id);

-- 5. Plano de ação: referência legal da tarefa.
ALTER TABLE planos_acao_tarefas ADD COLUMN IF NOT EXISTS referencia_legal text;

-- 6. Busca vetorial com filtro opcional por legislações.
DROP FUNCTION IF EXISTS buscar_chunks_similares(vector, int);

CREATE OR REPLACE FUNCTION buscar_chunks_similares(
  query_embedding vector(1536),
  match_limit int DEFAULT 5,
  filtro_legislacao_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  conteudo text,
  artigo varchar,
  inciso varchar,
  paragrafo varchar,
  tipo varchar,
  numero varchar,
  ano int,
  titulo varchar,
  legislacao_id uuid,
  link_oficial varchar,
  similaridade float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.conteudo,
    c.artigo,
    c.inciso,
    c.paragrafo,
    l.tipo::varchar,
    l.numero,
    l.ano,
    l.titulo,
    l.id,
    l."linkOficial",
    1 - (c.embedding <=> query_embedding)::float as similaridade
  FROM legislacao_chunks c
  JOIN legislacoes l ON l.id = c.legislacao_id
  WHERE l.ativo = true
    AND c.embedding IS NOT NULL
    AND (filtro_legislacao_ids IS NULL OR l.id = ANY(filtro_legislacao_ids))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

-- Garante que a função está acessível via API
GRANT EXECUTE ON FUNCTION buscar_chunks_similares(vector, int, uuid[]) TO anon, authenticated, service_role;

-- 7. Avisa a API do Supabase (PostgREST) para recarregar o esquema (nova assinatura da função).
NOTIFY pgrst, 'reload schema';
