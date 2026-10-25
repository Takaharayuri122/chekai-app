-- Função para busca vetorial de chunks similares (com filtro opcional por legislações)
-- Execute este SQL no SQL Editor do Supabase
-- Mesma função de scripts/legislacao-automatica.sql

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
