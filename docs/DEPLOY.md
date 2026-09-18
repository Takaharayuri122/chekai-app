# Guia de Deploy - ChekAI

Este guia descreve o deploy da plataforma: frontend e backend no mesmo projeto Railway, banco no Supabase.

## Arquitetura de Deploy

```
Frontend (Next.js) → Railway (serviço @meta-app/web)
Backend (NestJS) → Railway (serviço @meta-app/api) — https://api.chekai.com.br
Banco de Dados → Supabase
```

Projeto Railway: **ChekAI-PRD**. A API observa `/apps/api/**`; o web observa `/apps/web/**`.

O Vercel deixou de ser o alvo de produção do frontend. O projeto antigo na Vercel pode permanecer, mas o CORS e o `FRONTEND_URL` apontam para o domínio Railway do web.

## Pré-requisitos

- Repositório GitHub `Takaharayuri122/chekai-app` (branch `master`)
- Conta no Supabase
- Conta no Railway
- Chaves de API (OpenAI, DeepSeek, provedor de e-mail)

## Variáveis de Ambiente

### Backend (`@meta-app/api`)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NODE_ENV` | Ambiente de execução | `production` |
| `PORT` | Porta (Railway define automaticamente) | `8080` |
| `DATABASE_URL` | Connection string do Supabase PostgreSQL | `postgresql://...` |
| `JWT_SECRET` | Chave secreta para JWT | string aleatória forte |
| `JWT_EXPIRES_IN` | Expiração do token | `7d` |
| `CORS_ORIGIN` | URL canônica do frontend na Railway | `https://meta-appweb-production.up.railway.app` |
| `FRONTEND_URL` | URL do frontend (e-mails de convite; obrigatória) | mesma do `CORS_ORIGIN` |
| `SUPABASE_URL` | URL do projeto Supabase | `https://[PROJECT].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key do Supabase | `eyJhbGc...` |
| `OPENAI_API_KEY` | Chave da API OpenAI | `sk-...` |
| `DEEPSEEK_API_KEY` | Chave da API DeepSeek | `sk-...` |
| `DEEPSEEK_BASE_URL` | URL base da API DeepSeek | `https://api.deepseek.com` |

A API também libera automaticamente origens `*.up.railway.app` e `*.vercel.app`, além de hosts locais de desenvolvimento.

### Frontend (`@meta-app/web`)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_URL` | URL da API (embutida no build) | `https://api.chekai.com.br/api` |
| `NODE_ENV` | Ambiente | `production` |

`NEXT_PUBLIC_*` é resolvida em **build time**. Defina a variável **antes** do primeiro deploy do web.

Configuração do serviço web:

- **Watch patterns**: `/apps/web/**`
- **Build**: `npm run build --workspace=@meta-app/web`
- **Start**: `npm run start --workspace=@meta-app/web` (`next start --hostname 0.0.0.0`; a porta vem de `PORT`)
- **Arquivo**: `apps/web/railway.json`

## Deploy do Backend (Railway)

1. Serviço `@meta-app/api` no projeto ChekAI-PRD, repo `Takaharayuri122/chekai-app@master`
2. Watch: `/apps/api/**`
3. Domínio customizado: `https://api.chekai.com.br`
4. Conferir `https://api.chekai.com.br/api/docs`

## Deploy do Frontend (Railway)

1. Criar o serviço `@meta-app/web` no mesmo projeto (vazio)
2. Configurar build/start e watch `/apps/web/**`
3. Definir `NEXT_PUBLIC_API_URL=https://api.chekai.com.br/api` **antes** de conectar o GitHub
4. Conectar o mesmo repo/branch da API (`Takaharayuri122/chekai-app@master`)
5. Gerar domínio `*.up.railway.app`
6. Atualizar `CORS_ORIGIN` e `FRONTEND_URL` na API com a URL do web
7. Acompanhar o deploy nos logs do Railway

Domínio customizado (`www.chekai.com.br`) é opcional e exige DNS apontando para a Railway — fora do fluxo inicial.

## Verificação Pós-Deploy

### Frontend

1. Abra https://meta-appweb-production.up.railway.app
2. Confirme que a landing carrega
3. Faça login e verifique as chamadas em DevTools → Network (`https://api.chekai.com.br/api`)

### Backend

1. Acesse `https://api.chekai.com.br/api/docs`
2. Confira logs do serviço `@meta-app/api`

### Integração

- Login
- Criar cliente / auditoria
- Upload de fotos e fluxos com IA

## Troubleshooting

### Backend não inicia

- Variáveis obrigatórias (incluindo `FRONTEND_URL`)
- `DATABASE_URL` e pool do Supabase
- Logs do deploy da API

### Frontend não conecta ao backend

- `NEXT_PUBLIC_API_URL` deve ser `https://api.chekai.com.br/api` e o serviço web precisa ter sido **rebuildado** depois de definir a variável
- CORS: `CORS_ORIGIN` + allowlist `*.up.railway.app`
- API no ar em `/api/docs`

### Erro de CORS

- `CORS_ORIGIN` com a URL exata do frontend (https, sem barra no final se a Origin não tiver)
- A API aceita automaticamente `*.up.railway.app`

## Deploy automático

Push em `master`:

- Alterações em `apps/api/**` redeployam só a API
- Alterações em `apps/web/**` redeployam só o web

## Custos

- **Railway**: conforme o plano da conta (API + web no mesmo projeto)
- **Supabase**: free tier ou plano contratado
- **Vercel**: não é mais necessário para produção

## Suporte

1. Logs no Railway (web e API)
2. [Documentação Railway](https://docs.railway.app)
3. Conferir se as variáveis de ambiente estão corretas
