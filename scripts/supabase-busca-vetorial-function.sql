-- Função para busca vetorial de chunks similares
-- Execute este SQL no SQL Editor do Supabase

CREATE OR REPLACE FUNCTION buscar_chunks_similares(
  query_embedding vector(1536),
  match_limit int DEFAULT 5
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
    1 - (c.embedding <=> query_embedding)::float as similaridade
  FROM legislacao_chunks c
  JOIN legislacoes l ON l.id = c.legislacao_id
  WHERE l.ativo = true
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

-- Garante que a função está acessível via API
GRANT EXECUTE ON FUNCTION buscar_chunks_similares(vector, int) TO anon, authenticated, service_role;

