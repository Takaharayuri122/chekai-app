# Meta App - Consultoria em Segurança de Alimentos com IA

POC de aplicativo web mobile-first para consultoria em segurança de alimentos, utilizando IA (DeepSeek) para análise de imagens e geração de textos técnicos via RAG.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 15 + TailwindCSS |
| Backend | NestJS + TypeORM |
| Banco de Dados | Supabase (PostgreSQL + pgvector nativo) |
| IA Texto/RAG | DeepSeek-V3 |
| IA Imagem | DeepSeek-VL2 |
| Embeddings | OpenAI text-embedding-3-small |

## Estrutura do Projeto

```
meta-app/
├── apps/
│   ├── api/                    # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # Autenticação JWT
│   │   │   │   ├── usuario/    # Gestão de usuários
│   │   │   │   ├── cliente/    # Clientes e unidades
│   │   │   │   ├── checklist/  # Templates e instâncias
│   │   │   │   ├── auditoria/  # Auditorias e itens
│   │   │   │   ├── legislacao/ # Base normativa + RAG
│   │   │   │   └── ia/         # Integração DeepSeek
│   │   │   ├── core/           # Filtros, guards, interceptors
│   │   │   └── shared/         # Utilitários compartilhados
│   │   └── package.json
│   │
│   └── web/                    # Frontend Next.js
│       ├── src/
│       │   ├── app/            # App Router
│       │   ├── lib/            # API, store
│       │   └── ...
│       └── package.json
│
├── scripts/                    # Scripts de inicialização
└── package.json                # Monorepo config
```

## Pré-requisitos

- Node.js 20+
- Conta Supabase
- Conta DeepSeek API
- Conta OpenAI (para embeddings)

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

1. Crie um projeto no [Supabase](https://app.supabase.com)
2. **Habilite a extensão `pgvector`**:
   - Vá em **SQL Editor** no painel do Supabase
   - Execute: `CREATE EXTENSION IF NOT EXISTS vector;`
3. **Obtenha as credenciais do Supabase**:
   - **SUPABASE_URL**: Vá em **Settings > API** > "Project URL"
   - **SUPABASE_SERVICE_ROLE_KEY**: Vá em **Settings > API** > "service_role" (secret key)
   - **DATABASE_URL**: Vá em **Settings > Database** > "Connection string" (Connection pooling)
4. **Crie a função stored procedure para busca vetorial**:
   - Vá em **SQL Editor**
   - Execute o conteúdo do arquivo `scripts/supabase-busca-vetorial-function.sql`
   - Ou veja o arquivo `MIGRACAO_SUPABASE_SDK.md` para mais detalhes

Crie o arquivo `apps/api/.env` (copie de `apps/api/env.example`):

```bash
cp apps/api/env.example apps/api/.env
```

Edite `apps/api/.env` e configure:

```env
# Ambiente
NODE_ENV=development
PORT=3001

# Supabase SDK
SUPABASE_URL=https://[SEU_PROJECT].supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# Banco de Dados - Supabase (para TypeORM)
DATABASE_URL=postgresql://postgres:[SEU_PASSWORD]@[SEU_PROJECT].supabase.co:5432/postgres

# JWT
JWT_SECRET=sua-chave-secreta-muito-segura-aqui
JWT_EXPIRES_IN=7d

# DeepSeek API
DEEPSEEK_API_KEY=sua-api-key-deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com

# OpenAI (para embeddings)
OPENAI_API_KEY=sua-api-key-openai

# CORS
CORS_ORIGIN=http://localhost:3000
```

**⚠️ IMPORTANTE**: A `SUPABASE_SERVICE_ROLE_KEY` tem privilégios administrativos. Nunca exponha no frontend!

Crie o arquivo `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 3. Executar migrações (automático no dev)

O TypeORM está configurado com `synchronize: true` em desenvolvimento, então as tabelas são criadas automaticamente na primeira execução.

**Importante**: 
- Certifique-se de que a extensão `pgvector` está habilitada no Supabase
- Certifique-se de que a função `buscar_chunks_similares` foi criada (veja passo 2.4)
- Veja `MIGRACAO_SUPABASE_SDK.md` para mais detalhes sobre o uso do SDK do Supabase

### 4. Iniciar aplicação

```bash
# Iniciar API e Web simultaneamente
npm run dev

# Ou separadamente:
npm run dev:api
npm run dev:web
```

## Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuário autenticado
- `GET /api/auth/test` - Smoke test

### Usuários
- `POST /api/usuarios` - Criar usuário
- `GET /api/usuarios` - Listar usuários
- `GET /api/usuarios/:id` - Buscar usuário
- `PUT /api/usuarios/:id` - Atualizar usuário
- `DELETE /api/usuarios/:id` - Remover usuário

### Clientes
- `POST /api/clientes` - Criar cliente
- `GET /api/clientes` - Listar clientes
- `GET /api/clientes/:id` - Buscar cliente
- `PUT /api/clientes/:id` - Atualizar cliente
- `POST /api/clientes/:id/unidades` - Criar unidade

### Checklists
- `POST /api/checklists/templates` - Criar template
- `GET /api/checklists/templates` - Listar templates
- `GET /api/checklists/templates/:id` - Buscar template
- `POST /api/checklists/templates/:id/itens` - Adicionar item

### Auditorias
- `POST /api/auditorias` - Iniciar auditoria
- `GET /api/auditorias` - Listar auditorias
- `GET /api/auditorias/:id` - Buscar auditoria
- `PUT /api/auditorias/:id/itens/:itemId` - Responder item
- `PUT /api/auditorias/:id/finalizar` - Finalizar

### IA
- `POST /api/ia/analisar-imagem` - Análise de imagem (DeepSeek-VL2)
- `POST /api/ia/gerar-texto` - Gerar texto técnico (DeepSeek-V3 + RAG)
- `POST /api/ia/plano-acao` - Gerar plano de ação

### Legislações (RAG)
- `POST /api/legislacoes` - Criar legislação
- `GET /api/legislacoes` - Listar legislações
- `POST /api/legislacoes/rag/buscar` - Busca semântica
- `POST /api/legislacoes/rag/contexto` - Gerar contexto RAG

## Swagger

Documentação disponível em: `http://localhost:3001/api/docs`

## Funcionalidades Principais

### Checklists Inteligentes
- Templates baseados em RDC 216, 275 e outras legislações
- Customização por cliente/unidade
- Vinculação automática com artigos legais

### Análise de Imagens com IA
- Upload de fotos durante auditoria
- DeepSeek-VL2 detecta não conformidades
- Sugestão automática de classificação

### Geração de Textos com RAG
- Base de legislações indexada com pgvector
- Busca semântica por similaridade
- DeepSeek-V3 gera textos técnicos contextualizado

### Planos de Ação
- Geração automática baseada na não conformidade
- Ações corretivas e preventivas
- Prazos e responsáveis sugeridos

## Custos Estimados (DeepSeek)

| Modelo | Custo | Uso |
|--------|-------|-----|
| DeepSeek-V3 | ~$0.14/1M tokens | RAG + textos |
| DeepSeek-VL2 | ~$0.27/1M tokens | Análise de imagens |

**Comparativo**: GPT-4o custa ~$2.50/1M tokens. DeepSeek é **~10x mais barato**.

## Próximos Passos

1. [ ] Seed de legislações (RDC 216, 275)
2. [ ] Geração de relatórios PDF
3. [ ] Integração WhatsApp Business API
4. [ ] Modo offline com sincronização
5. [ ] Dashboards e indicadores

## Licença

Proprietário - Evobit © 2024

