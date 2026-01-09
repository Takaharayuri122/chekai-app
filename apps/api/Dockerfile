# Dockerfile para deploy no Railway
FROM node:20-alpine AS base

# Instalar dependências apenas quando necessário
FROM base AS deps
WORKDIR /app

# Copiar arquivos de configuração do monorepo (raiz)
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.json ./

# Copiar package.json dos apps (necessário para workspaces)
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Instalar dependências do monorepo
RUN npm ci

# Build da aplicação
FROM base AS builder
WORKDIR /app

# Copiar dependências instaladas
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/turbo.json ./
COPY --from=deps /app/tsconfig.json ./

# Copiar código fonte da API
COPY apps/api ./apps/api

# Build apenas da API usando turbo filter
RUN npx turbo build --filter=@meta-app/api

# Produção
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copiar apenas arquivos necessários para produção
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/main.js"]

