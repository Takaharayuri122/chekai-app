# Design: ChekAI Mobile — React Native App

**Data:** 2026-02-18
**Objetivo:** Criar um app React Native (iOS + Android) com as 5 funcionalidades principais do ChekAI, mantendo o mesmo design system e lógica offline, compilando para iOS primeiro.

---

## 1. Abordagem técnica escolhida: Expo + Expo Router

**Alternativas consideradas:**

| Abordagem | Prós | Contras | Decisão |
|-----------|------|---------|---------|
| **Expo + Expo Router** | File-based routing (igual Next.js), acesso fácil a câmera/GPS/SQLite, EAS Build para distribuição, sem Xcode para dev | Menor controle sobre código nativo | ✅ Escolhida |
| React Native CLI (bare) | Controle total do código nativo | Setup complexo, overhead para cada lib nativa, sem file routing | ❌ |
| Capacitor (web → native) | Reutiliza código web 100% | Não é React Native nativo, limitações de performance, mesmo problema de webview | ❌ |

**Razão da escolha:** Expo Managed Workflow com EAS Build permite compilar IPA para iOS sem Xcode local, usa o mesmo modelo de roteamento em arquivo que o Next.js App Router (familiar para o time), e oferece acesso nativo a câmera, GPS e SQLite sem configuração manual.

---

## 2. Stack técnico

| Camada | Tecnologia | Equivalente web |
|--------|-----------|-----------------|
| Framework | Expo SDK 52+ (Managed) | Next.js 15 |
| Roteamento | Expo Router v4 (file-based) | Next.js App Router |
| Estilização | NativeWind v4 (Tailwind para RN) | Tailwind CSS |
| State | Zustand 5 (mesmo) | Zustand 5 |
| HTTP | Axios (mesmo) | Axios |
| Forms | React Hook Form + Zod (mesmo) | React Hook Form + Zod |
| Offline DB | expo-sqlite (via op-sqlite ou drizzle-orm) | Dexie.js (IndexedDB) |
| Câmera | expo-camera + expo-image-picker | Browser File API |
| Localização | expo-location | Browser Geolocation API |
| Ícones | @expo/vector-icons (Lucide-compatible) | lucide-react |
| Build | EAS Build | Vercel |
| Notificações | expo-notifications | — |
| Token storage | expo-secure-store | localStorage |

---

## 3. Estrutura do projeto no monorepo

O app mobile será adicionado como `apps/mobile/` no Turborepo existente:

```
meta-app/
├── apps/
│   ├── api/          ← NestJS (sem mudanças)
│   ├── web/          ← Next.js (sem mudanças)
│   └── mobile/       ← NOVO: Expo React Native
│       ├── app/                  ← Expo Router (file-based)
│       │   ├── (auth)/
│       │   │   ├── _layout.tsx
│       │   │   ├── index.tsx         ← Login (email)
│       │   │   ├── otp.tsx           ← Validar OTP
│       │   │   └── lista-espera.tsx  ← Fila de espera
│       │   ├── (admin)/
│       │   │   ├── _layout.tsx       ← Tab navigator
│       │   │   ├── dashboard.tsx
│       │   │   ├── auditorias/
│       │   │   │   ├── index.tsx     ← Lista de auditorias
│       │   │   │   ├── nova/
│       │   │   │   │   └── index.tsx ← Wizard nova auditoria
│       │   │   │   └── [id]/
│       │   │   │       ├── index.tsx       ← Checklist
│       │   │   │       └── relatorio.tsx   ← Relatório
│       │   │   ├── clientes/
│       │   │   │   ├── index.tsx
│       │   │   │   └── [id].tsx
│       │   │   ├── templates/
│       │   │   │   ├── index.tsx
│       │   │   │   └── [id].tsx
│       │   │   └── perfil.tsx
│       │   └── _layout.tsx           ← Root layout + auth guard
│       ├── src/
│       │   ├── components/           ← UI components
│       │   ├── lib/
│       │   │   ├── api/              ← Axios + endpoints (portado do web)
│       │   │   ├── store/            ← Zustand stores (portado)
│       │   │   ├── offline/          ← SQLite + sync queue
│       │   │   └── utils/
│       │   └── hooks/
│       ├── assets/                   ← Images, fonts, icons
│       ├── app.json                  ← Expo config
│       ├── eas.json                  ← EAS Build config
│       ├── tailwind.config.js        ← NativeWind config
│       └── package.json
```

---

## 4. Design System

O design system do mobile espelha o design web:

### Cores (mesmas do DaisyUI theme)
```js
// tailwind.config.js
colors: {
  primary: '#00B8A9',    // Teal
  secondary: '#0891b2',  // Cyan
  neutral: '#1B2A4A',    // Navy
  accent: '#f59e0b',     // Amber
  success: '#10b981',    // Emerald
  error: '#ef4444',      // Red
  base: {
    100: '#FFFFFF',
    200: '#F5F7FA',
    300: '#E5E7EB',
  }
}
```

### Tipografia
- **Display/Headings**: Montserrat (carregada via expo-font)
- **Body**: Inter (carregada via expo-font)

### Componentes compartilhados (nativos)
- `Button` — variantes: primary, secondary, ghost, danger
- `Card` — container com sombra sutil
- `Input` — campo com label flutuante
- `Badge` — status com cores semânticas
- `StatCard` — card de métrica (igual ao web)
- `EmptyState` — estado vazio com ícone
- `LoadingSpinner` — indicador de carregamento
- `OfflineBanner` — banner quando sem conexão

---

## 5. Funcionalidades por tela

### 5.1 Login / Fila de Espera

**Fluxo:**
1. Splash screen com logo ChekAI (2 segundos)
2. Verificar token salvo → se válido, ir para Dashboard
3. Tela de login: campo email + botão "Enviar código"
4. Tela OTP: 6 campos de dígito + contador de reenvio
5. Sucesso → salvar token no SecureStore → ir para Dashboard
6. Link "Ainda não tem conta" → tela de lista de espera (formulário simples: nome, email, empresa)

**Offline:** Login requer internet (por design — sem OTP offline).

### 5.2 Dashboard

**Conteúdo:**
- Saudação com nome do usuário
- Cards de métricas: auditorias em andamento, concluídas, pontuação média
- Lista "Auditorias Recentes" (últimas 5)
- Botão flutuante "+ Nova Auditoria"

**Offline:** Exibe dados cacheados do SQLite.

### 5.3 Auditorias

**5.3a — Lista de Auditorias (`/auditorias`)**
- Lista filtrable por status (todas, em andamento, finalizadas)
- Card por auditoria: cliente, unidade, data, status, pontuação
- Pull-to-refresh para sincronizar

**5.3b — Nova Auditoria (wizard 3 passos)**
- Passo 1: Selecionar cliente (lista com busca)
- Passo 2: Selecionar unidade do cliente
- Passo 3: Selecionar template
- Confirmar: capturar localização GPS → criar auditoria (online/offline)

**5.3c — Checklist de Auditoria (tela principal)**
- Header: nome do cliente/unidade, progresso (X/Y itens)
- Lista de grupos/seções na lateral ou em tabs
- Por item:
  - Pergunta + badge de criticidade
  - Botões de resposta: Conforme / Não Conforme / N/A
  - Campo de observação (condicional)
  - Captura de foto (câmera nativa)
  - Campos IA (quando disponíveis)
- Swipe/navegação entre itens
- Botão "Finalizar Auditoria"

**5.3d — Relatório de Auditoria**
- Pontuação geral (gauge visual)
- Resumo executivo (texto)
- Pontos fortes e fracos (lista)
- Risco geral (badge colorido)
- Botão compartilhar/ver PDF (abre WebView ou browser)

### 5.4 Clientes

- Lista de clientes com busca
- Card do cliente: razão social, tipo de atividade, telefone
- Detalhe: informações + unidades + histórico de auditorias por unidade
- **Mobile-only**: Clientes são somente leitura no mobile (criação/edição fica no web)

### 5.5 Templates (Checklists)

- Lista de templates com filtro por tipo de atividade
- Detalhe: grupos + itens do template
- **Mobile-only**: Templates são somente leitura no mobile

---

## 6. Offline (SQLite)

Substitui o Dexie.js (IndexedDB) por SQLite via `expo-sqlite`:

```sql
-- Tabelas equivalentes ao Dexie
CREATE TABLE cache_templates (id TEXT PRIMARY KEY, data TEXT, cached_at INTEGER);
CREATE TABLE cache_clientes (id TEXT PRIMARY KEY, data TEXT, cached_at INTEGER);
CREATE TABLE cache_unidades (id TEXT PRIMARY KEY, cliente_id TEXT, data TEXT, cached_at INTEGER);
CREATE TABLE cache_auditorias (id TEXT PRIMARY KEY, data TEXT, cached_at INTEGER);
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  tipo TEXT,
  payload TEXT,
  auditoria_temp_id TEXT,
  ordem INTEGER,
  status TEXT DEFAULT 'pendente',
  erro TEXT,
  criado_em INTEGER
);
CREATE TABLE blob_fotos (id TEXT PRIMARY KEY, auditoria_item_id TEXT, data BLOB);
```

**Sync queue:** Mesma lógica do web — criar_auditoria → responder_item/foto → finalizar_auditoria.

---

## 7. Auth e Segurança

- Token JWT salvo no **expo-secure-store** (Keychain iOS / Keystore Android)
- Axios interceptor adiciona `Authorization: Bearer {token}` automaticamente
- Interceptor 401 → redireciona para tela de login e limpa SecureStore
- Expiração: 30 dias (igual ao web)

---

## 8. Build e Distribuição (iOS primeiro)

- **EAS Build** para compilar sem Xcode local
- **Internal Distribution** via TestFlight para testes internos
- Arquivo `eas.json` configura profiles: development, preview (TestFlight), production (App Store)
- Bundle ID: `com.evobit.chekai` (a definir)
- Conta Apple Developer necessária ($99/ano)

---

## 9. O que fica fora do escopo (YAGNI)

- Criação/edição de clientes no mobile (somente leitura)
- Criação/edição de templates no mobile (somente leitura)
- Gestão de usuários no mobile
- Gestão de planos/créditos no mobile
- Geração de PDF no mobile (mostra PDF gerado pelo servidor)
- Notificações push (fase 2)
- Internacionalização

---

## 10. Arquivos afetados

| Arquivo/Pasta | Mudança |
|---------------|---------|
| `apps/mobile/` | **Novo**: app Expo completo |
| `turbo.json` | Adicionar pipeline para `mobile` |
| `package.json` (root) | Adicionar workspace `apps/mobile` |
| `apps/api/` | Sem mudanças |
| `apps/web/` | Sem mudanças |

---

## 11. Ordem de implementação

1. Scaffold do projeto Expo + Expo Router + NativeWind
2. Design system (cores, tipografia, componentes base)
3. Auth (login, OTP, token, guard de rotas)
4. Camada de API (Axios, endpoints, tipos — portado do web)
5. Camada offline (SQLite, sync queue)
6. Dashboard
7. Lista de Auditorias + relatório
8. Nova Auditoria (wizard)
9. Checklist de Auditoria (tela principal com câmera)
10. Clientes (somente leitura)
11. Templates (somente leitura)
12. Perfil + configurações
13. EAS Build config (iOS)
