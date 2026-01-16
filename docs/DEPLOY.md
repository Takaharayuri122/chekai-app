# Guia de Deploy - Meta App

Este guia descreve o processo completo de deploy da aplicação Meta App, incluindo frontend (Vercel) e backend (Railway).

## Arquitetura de Deploy

```
Frontend (Next.js) → Vercel (Free Tier)
Backend (NestJS) → Railway ($5/mês)
Banco de Dados → Supabase (Existente)
```

## Pré-requisitos

- Conta no GitHub/GitLab com o código do projeto
- Conta no Supabase (já configurada)
- Conta na Vercel (gratuita)
- Conta no Railway (trial de $5 grátis, depois $5/mês)
- Chaves de API:
  - OpenAI API Key
  - DeepSeek API Key

## Variáveis de Ambiente

### Backend (Railway)

Configure as seguintes variáveis de ambiente no Railway:

#### Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NODE_ENV` | Ambiente de execução | `production` |
| `PORT` | Porta do servidor (Railway define automaticamente) | `3001` |
| `DATABASE_URL` | Connection string do Supabase PostgreSQL | `postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres` |
| `JWT_SECRET` | Chave secreta para JWT (use uma string aleatória forte) | `sua-chave-secreta-muito-segura` |
| `JWT_EXPIRES_IN` | Tempo de expiração do token JWT | `7d` |
| `CORS_ORIGIN` | URL do frontend na Vercel | `https://meta-app.vercel.app` |
| `SUPABASE_URL` | URL do projeto Supabase | `https://[PROJECT].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key do Supabase | `eyJhbGc...` |
| `OPENAI_API_KEY` | Chave da API OpenAI | `sk-...` |
| `DEEPSEEK_API_KEY` | Chave da API DeepSeek | `sk-...` |
| `DEEPSEEK_BASE_URL` | URL base da API DeepSeek | `https://api.deepseek.com` |

#### Como obter as credenciais do Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
   - Copie `Project URL` → `SUPABASE_URL`
   - Copie `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Vá em **Settings** → **Database**
   - Copie a **Connection string** (use "Connection pooling" recomendado)
   - Substitua `[YOUR-PASSWORD]` pela senha do banco → `DATABASE_URL`

### Frontend (Vercel)

Configure as seguintes variáveis de ambiente no Vercel:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_URL` | URL completa da API no Railway | `https://meta-app-production.up.railway.app/api` |

**Nota**: A variável deve começar com `NEXT_PUBLIC_` para ser acessível no cliente Next.js.

## Deploy do Backend (Railway)

### Passo 1: Criar conta e projeto

1. Acesse [Railway](https://railway.app)
2. Faça login com GitHub/GitLab
3. Clique em **New Project**
4. Selecione **Deploy from GitHub repo**
5. Escolha o repositório do Meta App

### Passo 2: Configurar o projeto

1. No projeto criado, clique em **Settings**
2. Configure:
   - **Root Directory**: `apps/api`
   - **Build Command**: `npm run build` (Railway detecta automaticamente)
   - **Start Command**: `npm run start:prod`

### Passo 3: Configurar variáveis de ambiente

1. No projeto Railway, vá em **Variables**
2. Adicione todas as variáveis listadas na seção "Backend (Railway)" acima
3. Salve as alterações

### Passo 4: Deploy

1. Railway fará deploy automático após o primeiro push
2. Aguarde o build completar
3. Anote a URL gerada (ex: `https://meta-app-production.up.railway.app`)

### Passo 5: Verificar deploy

1. Acesse `https://[sua-url-railway]/api/docs` para ver o Swagger
2. Verifique os logs em **Deployments** → **View Logs**

## Deploy do Frontend (Vercel)

### Passo 1: Criar conta e projeto

1. Acesse [Vercel](https://vercel.com)
2. Faça login com GitHub/GitLab
3. Clique em **Add New Project**
4. Importe o repositório do Meta App

### Passo 2: Configurar o projeto

1. Em **Framework Preset**, selecione **Next.js**
2. Configure:
   - **Root Directory**: `apps/web`
   - **Build Command**: `cd ../.. && npm run build --filter=@meta-app/web`
   - **Output Directory**: `.next`
   - **Install Command**: `cd ../.. && npm install`

**Nota**: O arquivo `vercel.json` já está configurado, mas você pode ajustar se necessário.

### Passo 3: Configurar variáveis de ambiente

1. Na página de configuração do projeto, vá em **Environment Variables**
2. Adicione:
   - `NEXT_PUBLIC_API_URL`: URL completa da API no Railway (ex: `https://meta-app-production.up.railway.app/api`)

### Passo 4: Deploy

1. Clique em **Deploy**
2. Aguarde o build completar
3. Anote a URL gerada (ex: `https://meta-app.vercel.app`)

### Passo 5: Atualizar CORS no Backend

1. Volte ao Railway
2. Atualize a variável `CORS_ORIGIN` com a URL do frontend na Vercel
3. Faça um novo deploy (ou aguarde o redeploy automático)

## Verificação Pós-Deploy

### Testar Frontend

1. Acesse a URL do frontend na Vercel
2. Verifique se a página carrega corretamente
3. Tente fazer login
4. Verifique se as requisições para a API estão funcionando (abrir DevTools → Network)

### Testar Backend

1. Acesse `https://[sua-url-railway]/api/docs`
2. Teste os endpoints via Swagger
3. Verifique os logs no Railway para erros

### Testar Integração

1. Faça login no frontend
2. Teste funcionalidades principais:
   - Criar cliente
   - Criar auditoria
   - Adicionar fotos
   - Análise com IA

## Troubleshooting

### Backend não inicia

- Verifique se todas as variáveis de ambiente estão configuradas
- Verifique os logs no Railway
- Confirme que `DATABASE_URL` está correta
- Verifique se o build foi bem-sucedido

### Frontend não conecta ao backend

- Verifique se `NEXT_PUBLIC_API_URL` está correto
- Verifique CORS no backend (deve aceitar domínio da Vercel)
- Verifique se o backend está rodando (acesse `/api/docs`)

### Erro de CORS

- Certifique-se de que `CORS_ORIGIN` no backend contém a URL exata do frontend
- O backend também aceita automaticamente domínios `*.vercel.app`
- Verifique os logs do backend para mensagens de CORS

### Erro de banco de dados

- Verifique se `DATABASE_URL` está correta
- Confirme que o Supabase permite conexões externas
- Verifique se está usando "Connection pooling" no Supabase

## Alternativa: Render (Free Tier)

Se preferir começar totalmente gratuito, você pode usar Render:

### Configuração no Render

1. Crie um arquivo `render.yaml` na raiz do projeto:

```yaml
services:
  - type: web
    name: meta-app-api
    env: node
    buildCommand: cd apps/api && npm install && npm run build
    startCommand: cd apps/api && npm run start:prod
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      # ... outras variáveis
```

2. Siga o processo similar ao Railway, mas usando Render

**Nota**: Render tem free tier, mas aplicações "spins down" após 15min de inatividade, causando cold starts de ~30s.

## Atualizações Futuras

### Deploy Automático

Ambas as plataformas fazem deploy automático quando você faz push para a branch principal:

- **Railway**: Deploy automático na branch `main` ou `master`
- **Vercel**: Deploy automático na branch `main` ou `master`

### Variáveis de Ambiente

- Sempre atualize variáveis de ambiente nas plataformas antes de fazer deploy
- Variáveis sensíveis nunca devem ser commitadas no código

### Monitoramento

- Use os logs das plataformas para monitorar erros
- Configure alertas se necessário
- Monitore uso de recursos (especialmente no Railway)

## Custos Estimados

- **Vercel**: Gratuito (free tier suficiente para apps experimentais)
- **Railway**: $5/mês após trial de $5 grátis
- **Supabase**: Free tier disponível (verifique limites)
- **Total**: ~$5/mês para produção experimental

## Suporte

Em caso de problemas:

1. Verifique os logs nas plataformas
2. Consulte a documentação:
   - [Vercel Docs](https://vercel.com/docs)
   - [Railway Docs](https://docs.railway.app)
3. Verifique se todas as variáveis de ambiente estão configuradas corretamente

