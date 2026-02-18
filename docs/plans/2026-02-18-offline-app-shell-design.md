# Design: Offline Real — App Shell + Cache Warming

**Data:** 2026-02-18
**Objetivo:** Garantir que o app funcione realmente offline após ao menos uma visita online, resolvendo o problema em que o iOS Safari exibe erro de conexão ao abrir o PWA sem internet.

---

## 1. Problema e causa raiz

Ao abrir o PWA pelo ícone da home screen com o dispositivo offline, o Safari exibe erro de conexão em vez de servir o app do cache.

**Causas identificadas:**

1. **Estratégia `NetworkFirst` para documentos HTML**: ao falhar a rede, tenta o cache; se o cache estiver vazio ou expirado (`maxAgeSeconds: 86400` = 1 dia), serve `offline.html` ou falha antes disso.
2. **Sem cache warming após login**: o runtime cache só é populado quando o usuário visita manualmente cada rota com internet. Rotas nunca visitadas não têm HTML em cache.
3. **Sem `navigateFallback` configurado**: rotas admin nunca visitadas não têm nenhum fallback além do `offline.html` genérico, que não permite ao usuário navegar para o conteúdo disponível.

**Requisito aceito:** ao menos uma visita online após instalar o PWA é necessária para ativar o Service Worker e popular o cache inicial.

---

## 2. Arquitetura da solução (três pilares)

### Pilar 1: Mudança de estratégia do Service Worker

**De:** `NetworkFirst` com TTL de 24h para documentos HTML e assets gerais.
**Para:** `StaleWhileRevalidate` com TTL de 7 dias para documentos HTML e payloads RSC do Next.js.

Benefícios do `StaleWhileRevalidate`:
- Serve do cache **imediatamente**, sem timeout de rede → funciona offline sem atraso
- Atualiza o cache em background quando online → o usuário sempre vê conteúdo atualizado no próximo carregamento
- Sem risco de entrada expirar inadvertidamente após 1 dia sem abrir o app

Adicionalmente, configurar `navigateFallback: '/offline-shell'` com allowlist para `/admin/*`: quando uma rota admin nunca foi visitada (sem cache), o SW serve a shell em vez de nada.

**Regras de runtime caching (nova ordem):**

| Padrão | Handler | TTL | Motivo |
|--------|---------|-----|--------|
| `/api/auth/*` | `NetworkOnly` | — | Sem cache de auth |
| `*/api/*` | `NetworkFirst` | 60s | Dados dinâmicos, curto |
| `/_next/data/*` | `StaleWhileRevalidate` | 7d | RSC payloads (navegação client-side) |
| `/*` documentos | `StaleWhileRevalidate` | 7d | HTML das páginas |
| `/*` demais | `NetworkFirst` | 24h | Assets, fontes, imagens |

### Pilar 2: Cache Warming após login

Após o `validarOtp()` ter sucesso (usuário autenticado), disparar uma função `esquentarCachePostLogin()` que:

**2a. Data warming (IndexedDB via data-layer existente):**
- `listarClientes()` → salva no Dexie automaticamente
- `listarTemplatesPorTipo(...)` para todos os tipos de atividade → salva no Dexie
- Garante que nova auditoria funciona 100% offline: clientes e templates disponíveis

**2b. HTML warming (SW Cache API via fetch):**
- `fetch('/admin/auditorias', { cache: 'reload' })`
- `fetch('/admin/auditoria/nova', { cache: 'reload' })`
- `fetch('/admin/dashboard', { cache: 'reload' })`
- O SW intercepta cada fetch e salva no "pages" cache com `StaleWhileRevalidate`

**2c. RSC payload warming (navegação client-side offline):**
- Same URLs com header `RSC: 1` (usado pelo Next.js App Router em navegação SPA)
- Salva no "next-data" cache
- Necessário para que links no app funcionem offline sem recarregar a página inteira

**Onde disparar:** dentro de `useEffect` na `OfflineProvider` (já montada no layout), após detectar que o usuário está autenticado E online. Também idempotente: re-executar o warming não causa efeitos colaterais.

### Pilar 3: Offline Shell (`/offline-shell`)

Página Next.js `'use client'` em `src/app/offline-shell/page.tsx`.

**Propósito:** último recurso quando uma rota admin nunca foi cacheada. Não tenta ser a página pedida — é um hub de navegação offline.

**Comportamento:**
1. Lê o `window.location.pathname` para saber qual rota foi pedida originalmente
2. Verifica se a rota está disponível no SW Cache API (`caches.match(pathname)`)
3. Se disponível: redireciona automaticamente (provavelmente não vai ser atingida neste caso, pois o SW já teria servido)
4. Se não disponível: exibe o hub offline:
   - Status dos dados no IndexedDB: quantos templates, clientes disponíveis
   - Link direto para "Nova Auditoria" (se dados de templates/clientes existirem)
   - Link para "Lista de Auditorias" (se existir cache)
   - Instrução clara: conecte-se e abra o app para sincronizar

**Visual:** mantém a identidade visual do app (cores, tipografia), não confunde com erro do sistema.

---

## 3. Fluxo completo de abertura offline

```
Usuário instala PWA → abre com internet → faz login
    ↓
[login bem-sucedido] → esquentarCachePostLogin()
    ├── IndexedDB: templates + clientes + unidades
    └── SW Cache: HTML + RSC de /auditorias, /auditoria/nova, /dashboard

Usuário fecha o app, fica offline, abre pelo ícone da home screen
    ↓
SW intercepta navegação para start_url (/)
    ├── Cache HIT (StaleWhileRevalidate) → serve HTML da / → Next.js hidrata
    │   → auth check client-side → redirect para /admin/dashboard
    │   → SW intercepta /admin/dashboard → cache HIT → serve HTML
    │   → app funciona normalmente com dados do IndexedDB
    └── Cache MISS → serve /offline-shell → usuário vê hub offline
        → pode navegar para /admin/auditoria/nova se dados existem

Usuário navega offline para /admin/auditoria/nova
    ↓
SW intercepta → verifica "pages" cache
    ├── HIT → serve HTML → Next.js hidrata → página abre
    │   → próxima navegação interna usa RSC do "next-data" cache
    └── MISS → serve /offline-shell → hub com links disponíveis
```

---

## 4. Fluxo de dados e erros

- **Online:** SW salva documentos e RSC em background (StaleWhileRevalidate); data-layer continua salvando no IndexedDB conforme as telas são abertas.
- **Offline:** SW serve HTML do cache; React hidrata; data-layer lê do IndexedDB; fila de sync continua acumulando operações.
- **Transição online→offline:** O `useOfflineStore` e `useOnline` já detectam e atualizam o estado. Nada muda aqui.
- **Transição offline→online:** Sync existente roda; o SW atualiza os caches em background na próxima abertura de cada rota.
- **Cache warming falha (rede instável no login):** Silencioso — erros são ignorados com `.catch(() => {})`. O warming não é crítico para o login em si; será tentado novamente na próxima sessão online.

---

## 5. O que NÃO muda

- Fila de sync (`sync.ts`, `queue.ts`): sem alterações
- Data-layer (`data-layer.ts`, `cache.ts`): sem alterações estruturais, apenas o warming usa as funções existentes
- Autenticação: sem alterações
- IndexedDB schema: sem alterações
- Comportamento online: sem alterações perceptíveis ao usuário (StaleWhileRevalidate é transparente quando online)

---

## 6. O que fica de fora (YAGNI)

- Cache warming de TODAS as rotas admin (apenas as críticas do fluxo de auditoria)
- Escrita offline além do que já existe (templates, clientes, etc.)
- Estratégia para expiração e invalidação manual do cache
- Suporte offline sem nenhuma visita online prévia (App Shell estático sem Next.js App Router)
- Background Sync API (BackgroundSyncPlugin do Workbox) — a fila de sync existente já cobre

---

## 7. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `apps/web/next.config.ts` | Estratégia SW: `StaleWhileRevalidate` + `navigateFallback` |
| `apps/web/src/lib/offline/cache-warming.ts` | **Novo:** função de warming pós-login |
| `apps/web/src/components/pwa/offline-provider.tsx` | Dispara warming quando autenticado e online |
| `apps/web/src/app/offline-shell/page.tsx` | **Nova:** página de shell offline |
| `apps/web/public/offline.html` | Manter como fallback final (sem mudanças necessárias) |

---

## 8. Ordem de implementação

1. Mudança no SW (`next.config.ts`) + rebuild + teste no dispositivo
2. `cache-warming.ts` + integração no `offline-provider.tsx`
3. Página `/offline-shell`
4. Testes: modo avião no iOS Safari após login online
