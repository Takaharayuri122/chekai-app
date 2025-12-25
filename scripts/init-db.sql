-- Habilita a extensão pgvector para busca vetorial
CREATE EXTENSION IF NOT EXISTS vector;

-- Cria índice HNSW para busca aproximada de vizinhos mais próximos
-- Será criado após a tabela legislacao_chunks ser gerada pelo TypeORM
-- CREATE INDEX IF NOT EXISTS idx_chunk_embedding ON legislacao_chunks USING hnsw (embedding vector_cosine_ops);

