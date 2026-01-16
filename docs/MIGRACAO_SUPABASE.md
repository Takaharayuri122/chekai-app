# Guia de Migração para Supabase

Este guia descreve como migrar a aplicação Meta App para usar o Supabase como banco de dados e solução de vetores.

## Por que Supabase?

- ✅ PostgreSQL gerenciado com suporte nativo a pgvector
- ✅ Escalabilidade automática
- ✅ Backups automáticos
- ✅ Interface web para gerenciamento
- ✅ Ideal para beta-tests e produção
- ✅ Conexão SSL nativa
- ✅ Pool de conexões otimizado

## Passo a Passo

### 1. Criar Projeto no Supabase

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Faça login ou crie uma conta
3. Clique em **"New Project"**
4. Preencha:
   - **Name**: meta-app
   - **Database Password**: escolha uma senha forte (guarde ela!)
   - **Region**: escolha a região mais próxima (ex: South America - São Paulo)
   - **Pricing Plan**: Free tier é suficiente para começar

### 2. Habilitar Extensão pgvector

1. No painel do projeto, vá em **SQL Editor** (ícone de banco de dados no menu lateral)
2. Clique em **"New Query"**
3. Execute o seguinte SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

4. Verifique se foi criado:

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 3. Obter Connection String

1. No painel do projeto, vá em **Settings > Database**
2. Role até a seção **"Connection string"**
3. Selecione a aba **"Connection pooling"** (recomendado) ou **"Direct connection"**
4. Copie a connection string (formato: `postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres`)
5. Substitua `[YOUR-PASSWORD]` pela senha que você definiu ao criar o projeto

### 4. Configurar Variáveis de Ambiente

Edite o arquivo `apps/api/.env`:

```env
# Ambiente
NODE_ENV=development
PORT=3001

# Banco de Dados - Supabase
DATABASE_URL=postgresql://postgres:SUA_SENHA_AQUI@seu-projeto.supabase.co:5432/postgres

# ... resto das variáveis (JWT, DeepSeek, OpenAI, CORS)
```

**Importante**: 
- A connection string do Supabase já inclui todas as informações necessárias (host, port, username, password, database)
- A conexão SSL é configurada automaticamente pelo código
- Copie o arquivo `apps/api/env.example` para `apps/api/.env` e edite os valores

### 5. Executar a Aplicação

```bash
npm run dev
```

O TypeORM irá:
- Conectar ao Supabase usando a connection string
- Criar automaticamente todas as tabelas (em desenvolvimento com `synchronize: true`)
- As queries de busca vetorial continuarão funcionando normalmente

### 6. Criar Índice HNSW (Opcional, mas Recomendado)

Para otimizar a busca vetorial, crie um índice HNSW após as tabelas serem criadas:

1. No **SQL Editor** do Supabase, execute:

```sql
-- Verifica se a tabela já existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'legislacao_chunks'
);

-- Cria índice HNSW para busca vetorial otimizada
CREATE INDEX IF NOT EXISTS idx_chunk_embedding_hnsw 
ON legislacao_chunks 
USING hnsw (embedding vector_cosine_ops);
```

**Nota**: O índice será criado automaticamente se você usar migrações, mas pode ser criado manualmente para garantir.

### 7. Executar Seeds (Dados Iniciais)

```bash
npm run db:seed
```

Isso irá:
- Conectar ao Supabase
- Criar legislações e templates iniciais
- Os embeddings precisarão ser gerados via API (usando OpenAI)

## Verificações

### Testar Conexão

1. No **SQL Editor** do Supabase, execute:

```sql
-- Lista todas as tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verifica se a extensão vector está ativa
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'vector';

-- Verifica estrutura da tabela de chunks
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'legislacao_chunks';
```

### Testar Busca Vetorial

Após criar alguns chunks com embeddings, teste a busca:

```sql
-- Exemplo de busca vetorial (substitua o embedding pelo seu)
SELECT 
  id,
  conteudo,
  artigo,
  1 - (embedding <=> '[0.1,0.2,0.3,...]'::vector) as similaridade
FROM legislacao_chunks
WHERE embedding IS NOT NULL
ORDER BY embedding <=> '[0.1,0.2,0.3,...]'::vector
LIMIT 5;
```

## Características do Supabase

- ✅ **PostgreSQL gerenciado**: Não precisa configurar servidor próprio
- ✅ **Connection string única**: Tudo configurado em uma única variável `DATABASE_URL`
- ✅ **SSL nativo**: Conexões seguras por padrão
- ✅ **Interface web**: Gerenciamento completo via dashboard
- ✅ **Backups automáticos**: Não precisa se preocupar com backup manual
- ✅ **Escalabilidade**: Escala automaticamente conforme necessidade
- ✅ **Extensões**: Ativação fácil via SQL Editor (pgvector já incluído)

## Troubleshooting

### Erro: "extension vector does not exist"

**Solução**: Execute `CREATE EXTENSION IF NOT EXISTS vector;` no SQL Editor do Supabase.

### Erro: "SSL connection required"

**Solução**: O código já configura SSL automaticamente. Verifique se está usando a connection string correta do Supabase.

### Erro: "connection timeout"

**Solução**: 
- Verifique se a connection string está correta
- Verifique se o firewall não está bloqueando
- Use a connection string de "Connection pooling" ao invés de "Direct connection"

### Erro: "relation does not exist"

**Solução**: 
- Verifique se o TypeORM criou as tabelas (veja em **Table Editor** no Supabase)
- Execute a aplicação em modo desenvolvimento primeiro (`NODE_ENV=development`)

## Próximos Passos

1. ✅ Migração concluída - Banco de dados no Supabase
2. 🔄 Configurar backups automáticos (já habilitado por padrão)
3. 🔄 Configurar monitoramento (disponível no dashboard do Supabase)
4. 🔄 Considerar usar Supabase Auth para autenticação (opcional)
5. 🔄 Considerar usar Supabase Storage para uploads (opcional)

## Recursos Úteis

- [Documentação do Supabase](https://supabase.com/docs)
- [Documentação do pgvector](https://github.com/pgvector/pgvector)
- [TypeORM Connection Options](https://typeorm.io/data-source-options)

