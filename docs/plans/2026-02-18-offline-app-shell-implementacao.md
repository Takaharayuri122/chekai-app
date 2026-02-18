# Offline Real — App Shell + Cache Warming: Plano de Implementação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Garantir que o PWA abra e funcione offline após ao menos uma visita online, resolvendo o erro "Safari pede conexão" ao abrir o app com o dispositivo offline.

**Architecture:** Três mudanças complementares: (1) trocar a estratégia do SW de `NetworkFirst` para `StaleWhileRevalidate` nos documentos HTML — isso garante que qualquer página visitada fique em cache e seja servida imediatamente offline; (2) cache warming explícito após login — dispara fetches para rotas críticas e preenche IndexedDB com dados necessários para nova auditoria; (3) offline shell inteligente — o `offline.html` existente vira um hub de navegação offline com status dos dados disponíveis.

**Tech Stack:** Next.js 14 App Router, next-pwa (Workbox), Dexie (IndexedDB), Zustand, TypeScript

---

## Contexto obrigatório antes de começar

Leia estes arquivos antes de qualquer tarefa:
- `apps/web/next.config.ts` — configuração atual do SW / next-pwa
- `apps/web/src/lib/offline/data-layer.ts` — funções de cache de dados (listarClientes, listarTemplatesPorTipo, etc.)
- `apps/web/src/components/pwa/offline-provider.tsx` — onde o warming será disparado
- `apps/web/src/lib/store.ts` — `useAuthStore` com `isAuthenticated`
- `apps/web/src/lib/store-offline.ts` — `useOfflineStore` com `isOnline`
- `apps/web/public/offline.html` — fallback atual, será melhorado
- `apps/web/public/manifest.json` — `start_url` atual é `/`

---

## Task 1: Corrigir manifest.json e estratégia do Service Worker

**Problema central:** `start_url: "/"` no manifest redireciona para `/admin/dashboard` server-side. O SW cacheia a resposta final (HTML do dashboard) sob a chave `/`, mas quando o PWA abre offline com URL=`/`, o Next.js pode ter conflito entre URL e HTML servido. Além disso, `NetworkFirst` para documentos falha se o cache expirou.

**Arquivos:**
- Modificar: `apps/web/public/manifest.json`
- Modificar: `apps/web/next.config.ts`

---

**Step 1: Atualizar `start_url` no manifest**

O `start_url` deve apontar para a rota que o usuário autenticado realmente quer ver, evitando redirects server-side que complicam o cache.

Abrir `apps/web/public/manifest.json` e alterar:
```json
"start_url": "/admin/auditorias",
"scope": "/",
```

**Step 2: Atualizar estratégia do SW em `apps/web/next.config.ts`**

Substituir a configuração existente do `pwaConfig` pela versão abaixo.

A mudança principal: adicionar uma regra específica para **navegação de documentos** antes do catch-all, usando `StaleWhileRevalidate` em vez de `NetworkFirst`. Também adicionar `navigateFallback` para rotas admin sem cache.

```typescript
import type { NextConfig } from 'next';
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};

const isDev = process.env.NODE_ENV === 'development';

const pwaConfig = withPWA({
  dest: 'public',
  register: !isDev,
  skipWaiting: true,
  disable: isDev,
  sw: 'sw.js',
  // Fallback de ÚLTIMO RECURSO (quando SWR falha: sem cache + sem rede)
  fallbacks: {
    document: '/offline.html',
  },
  // Serve offline.html para rotas /admin/* que nunca foram cacheadas
  navigateFallback: '/offline.html',
  navigateFallbackAllowlist: [/^\/admin\//],
  navigateFallbackDenylist: [/^\/_next\//, /^\/api\//],
  runtimeCaching: [
    // Auth: nunca cachear
    {
      urlPattern: /\/api\/auth\/.*/i,
      handler: 'NetworkOnly',
      options: {
        cacheName: 'auth-requests',
      },
    },
    // API calls: NetworkFirst, TTL curto (dados dinâmicos)
    {
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60,
        },
      },
    },
    // Documentos HTML (navegação): StaleWhileRevalidate, TTL longo
    // Serve do cache IMEDIATAMENTE (offline funciona), atualiza em background
    {
      urlPattern: ({ request }: { request: Request }) =>
        request.mode === 'navigate',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages-cache',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 dias
        },
      },
    },
    // Assets, fontes, imagens: NetworkFirst, TTL 24h
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 86400,
        },
      },
    },
  ],
  buildExcludes: [/middleware-manifest\.json$/],
  publicExcludes: ['!noprecache/**/*'],
  reloadOnOnline: true,
});

export default pwaConfig(nextConfig);
```

**Step 3: Rebuild e verificar que o SW foi gerado corretamente**

```bash
cd apps/web && npm run build
```

Após o build, abrir `apps/web/public/sw.js` e verificar que contém:
- `StaleWhileRevalidate` para navegação (`navigate` mode)
- `navigateFallback` referenciando `/offline.html`
- O `NetworkFirst` existente para `/api/*` ainda presente

**Step 4: Teste manual no dispositivo (iOS Safari)**

1. Abrir o app com internet ativa
2. Navegar para `/admin/auditorias`
3. Ativar modo avião
4. Fechar o Safari completamente
5. Reabrir o PWA pelo ícone da home screen

**Esperado:** O app deve abrir mostrando a tela de auditorias (ou o `offline.html` se não havia cache) — **sem** o erro "Safari não consegue abrir a página".

**Step 5: Commit**

```bash
git add apps/web/next.config.ts apps/web/public/manifest.json
git commit -m "feat(offline): StaleWhileRevalidate para documentos + navigateFallback admin"
```

---

## Task 2: Cache Warming — preencher IndexedDB e SW cache após login

Criar a função `esquentarCachePostLogin()` que, logo após o usuário se autenticar, pré-popula tanto o IndexedDB (dados de templates/clientes) quanto o SW Cache API (HTML das rotas críticas).

**Arquivos:**
- Criar: `apps/web/src/lib/offline/cache-warming.ts`

---

**Step 1: Criar `apps/web/src/lib/offline/cache-warming.ts`**

```typescript
import { TipoAtividade } from '../api';
import { listarClientes, listarTemplatesPorTipo } from './data-layer';

// Rotas cujo HTML deve estar disponível offline após o login
const ROTAS_CRITICAS = [
  '/admin/auditorias',
  '/admin/auditoria/nova',
  '/admin/dashboard',
];

/**
 * Aquece o cache de dados (IndexedDB) buscando todos os templates e clientes.
 * Usa o data-layer existente que já persiste no IndexedDB automaticamente.
 */
async function aquecerDados(): Promise<void> {
  const tipos = Object.values(TipoAtividade);
  await Promise.all([
    listarClientes().catch(() => {}),
    ...tipos.map((tipo) => listarTemplatesPorTipo(tipo).catch(() => {})),
  ]);
}

/**
 * Aquece o SW Cache API buscando o HTML de cada rota crítica.
 * O SW (StaleWhileRevalidate) intercepta o fetch e salva no "pages-cache".
 * cache: 'reload' força a busca na rede mesmo que já haja cache, garantindo conteúdo fresco.
 */
async function aquecerHtml(): Promise<void> {
  await Promise.all(
    ROTAS_CRITICAS.map((rota) =>
      fetch(rota, { cache: 'reload' }).catch(() => {})
    )
  );
}

/**
 * Dispara o cache warming completo após o login.
 * Silencioso: erros são ignorados — o warming não é crítico para o login.
 * Idempotente: pode ser chamado múltiplas vezes sem efeitos colaterais.
 */
export async function esquentarCachePostLogin(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;

  // Executa em paralelo, sem bloquear a UI
  await Promise.all([aquecerDados(), aquecerHtml()]);
}
```

**Step 2: Verificar que as importações existem**

No arquivo `apps/web/src/lib/offline/data-layer.ts`, confirmar que `listarClientes` e `listarTemplatesPorTipo` estão exportados (já existem — apenas verificar).

Em `apps/web/src/lib/api.ts`, confirmar que `TipoAtividade` é um enum exportado com valores como `'restaurante'`, `'industria'`, etc. (já existe).

**Step 3: Exportar de `apps/web/src/lib/offline/index.ts`**

Adicionar no final do arquivo:
```typescript
export * from './cache-warming';
```

**Step 4: Commit**

```bash
git add apps/web/src/lib/offline/cache-warming.ts apps/web/src/lib/offline/index.ts
git commit -m "feat(offline): cache warming pós-login (IndexedDB + SW cache)"
```

---

## Task 3: Disparar cache warming no OfflineProvider

O `OfflineProvider` já existe em `apps/web/src/components/pwa/offline-provider.tsx` e é montado dentro de `AppLayout` — que só renderiza quando `isAuthenticated === true`. Portanto, quando `OfflineProvider` monta, o usuário JÁ está autenticado.

O warming deve rodar:
- Ao montar (usuário já autenticado + online)
- Quando a conectividade volta (usuário estava offline, voltou online)

**Arquivos:**
- Modificar: `apps/web/src/components/pwa/offline-provider.tsx`

---

**Step 1: Atualizar `offline-provider.tsx`**

```typescript
'use client';

import { useEffect } from 'react';
import { useOnline } from '@/hooks/use-online';
import { registrarListenerOnline, tentarSincronizarAoCarregar } from '@/lib/offline/sync';
import { atualizarContadorPendentes } from '@/lib/offline/queue';
import { esquentarCachePostLogin } from '@/lib/offline/cache-warming';

/**
 * Inicializa estado de conectividade, listener de sync ao voltar online,
 * contador de pendências, tenta sincronizar ao carregar e aquece o cache
 * para uso offline das rotas críticas.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnline();

  // Warming inicial: roda na primeira montagem (usuário autenticado + online)
  useEffect(() => {
    registrarListenerOnline();
    atualizarContadorPendentes().then(() => {
      tentarSincronizarAoCarregar();
    });
    // Aquecer cache apenas se online
    if (navigator.onLine) {
      esquentarCachePostLogin();
    }
  }, []);

  // Re-warming quando o dispositivo volta online após estar offline
  useEffect(() => {
    if (isOnline) {
      esquentarCachePostLogin();
    }
  }, [isOnline]);

  return <>{children}</>;
}
```

**Notas importantes:**
- `useOnline()` já atualiza `isOnline` via eventos `window.online`/`offline`
- O segundo `useEffect` usa `isOnline` como dep: quando muda de `false` para `true`, re-aquece
- O warming é silencioso (erros ignorados) e idempotente — chamar duas vezes é seguro

**Step 2: Verificar tipagem**

Confirmar que não há erros de TypeScript:
```bash
cd apps/web && npx tsc --noEmit
```

Esperado: sem erros relacionados aos arquivos modificados.

**Step 3: Commit**

```bash
git add apps/web/src/components/pwa/offline-provider.tsx
git commit -m "feat(offline): disparar cache warming ao montar e ao voltar online"
```

---

## Task 4: Melhorar offline.html como shell de navegação offline

O `offline.html` atual mostra apenas "você está offline" com uma dica estática. Ele é servido em dois casos: (1) como `fallbacks.document` quando `StaleWhileRevalidate` falha (sem cache + sem rede), e (2) como `navigateFallback` para rotas admin nunca visitadas.

Vamos melhorá-lo para mostrar: status dos dados no IndexedDB e links para as rotas disponíveis.

**Arquivos:**
- Modificar: `apps/web/public/offline.html`

---

**Step 1: Substituir conteúdo de `apps/web/public/offline.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChekAI - Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #00B8A9 0%, #007A6E 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container { text-align: center; max-width: 480px; width: 100%; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 26px; margin-bottom: 8px; font-weight: 700; }
    .subtitle { font-size: 15px; opacity: 0.85; margin-bottom: 24px; line-height: 1.5; }
    .card {
      background: rgba(255,255,255,0.15);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      text-align: left;
    }
    .card-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin-bottom: 10px; }
    .status-row { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 6px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; flex-shrink: 0; }
    .dot.ok { background: #a7f3d0; }
    .dot.empty { background: #fca5a5; }
    .links { display: flex; flex-direction: column; gap: 10px; }
    .btn {
      display: block;
      background: #fff;
      color: #00B8A9;
      padding: 12px 20px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.15s;
    }
    .btn:active { transform: scale(0.97); }
    .btn-ghost {
      background: rgba(255,255,255,0.2);
      color: #fff;
    }
    .pending-badge {
      display: inline-block;
      background: #fff;
      color: #00B8A9;
      border-radius: 999px;
      padding: 1px 8px;
      font-size: 12px;
      font-weight: 700;
      margin-left: 8px;
    }
    #loading { opacity: 0.7; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>Você está offline</h1>
    <p class="subtitle" id="subtitle">Verificando dados disponíveis...</p>

    <div id="status-card" class="card" style="display:none">
      <div class="card-title">Dados disponíveis offline</div>
      <div class="status-row">
        <span class="dot" id="dot-templates"></span>
        <span id="label-templates">Carregando templates...</span>
      </div>
      <div class="status-row">
        <span class="dot" id="dot-clientes"></span>
        <span id="label-clientes">Carregando clientes...</span>
      </div>
      <div class="status-row" id="row-pendentes" style="display:none">
        <span class="dot ok"></span>
        <span id="label-pendentes"></span>
      </div>
    </div>

    <div class="links" id="links">
      <p id="loading">Verificando...</p>
    </div>
  </div>

  <script>
    // Abre o banco IndexedDB do Dexie diretamente para ler status
    function contarRegistros(dbName, storeName) {
      return new Promise(function(resolve) {
        try {
          var req = indexedDB.open(dbName);
          req.onsuccess = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) { resolve(0); return; }
            var tx = db.transaction(storeName, 'readonly');
            var countReq = tx.objectStore(storeName).count();
            countReq.onsuccess = function() { resolve(countReq.result); };
            countReq.onerror = function() { resolve(0); };
          };
          req.onerror = function() { resolve(0); };
        } catch(e) { resolve(0); }
      });
    }

    async function verificarStatus() {
      var nTemplates = await contarRegistros('chekai-offline', 'cache_templates');
      var nUnidades = await contarRegistros('chekai-offline', 'cache_unidades');
      var nFila = await contarRegistros('chekai-offline', 'sync_queue');

      // Templates
      var dotT = document.getElementById('dot-templates');
      var lblT = document.getElementById('label-templates');
      if (nTemplates > 0) {
        dotT.className = 'dot ok';
        lblT.textContent = nTemplates + ' template(s) de checklist disponíveis';
      } else {
        dotT.className = 'dot empty';
        lblT.textContent = 'Nenhum template em cache (conecte-se para baixar)';
      }

      // Clientes/Unidades
      var dotC = document.getElementById('dot-clientes');
      var lblC = document.getElementById('label-clientes');
      if (nUnidades > 0) {
        dotC.className = 'dot ok';
        lblC.textContent = nUnidades + ' cliente(s) e unidade(s) disponíveis';
      } else {
        dotC.className = 'dot empty';
        lblC.textContent = 'Nenhum cliente em cache (conecte-se para baixar)';
      }

      // Fila de sync pendente
      if (nFila > 0) {
        document.getElementById('row-pendentes').style.display = 'flex';
        document.getElementById('label-pendentes').innerHTML =
          nFila + ' auditoria(s) aguardando envio' +
          '<span class="pending-badge">' + nFila + '</span>';
      }

      document.getElementById('status-card').style.display = 'block';

      // Links
      var linksDiv = document.getElementById('links');
      var podeAuditar = nTemplates > 0 && nUnidades > 0;

      var html = '';
      if (podeAuditar) {
        document.getElementById('subtitle').textContent =
          'Você pode iniciar uma nova auditoria com os dados em cache.';
        html += '<a href="/admin/auditoria/nova" class="btn">Nova Auditoria</a>';
      } else {
        document.getElementById('subtitle').textContent =
          'Conecte-se à internet e abra o app para baixar os dados necessários.';
      }
      html += '<a href="/admin/auditorias" class="btn btn-ghost">Ver Auditorias</a>';
      html += '<a href="/" class="btn btn-ghost" onclick="location.reload();return false;">Tentar reconectar</a>';
      linksDiv.innerHTML = html;
    }

    verificarStatus();

    window.addEventListener('online', function() {
      window.location.reload();
    });
  </script>
</body>
</html>
```

**Step 2: Verificar que o arquivo foi salvo corretamente**

Abrir `apps/web/public/offline.html` e confirmar que o HTML novo está presente, sem erros de sintaxe visíveis.

**Step 3: Rebuild para incluir o novo offline.html no precache**

```bash
cd apps/web && npm run build
```

O `sw.js` gerado incluirá o novo hash do `offline.html` no precache automaticamente.

**Step 4: Commit**

```bash
git add apps/web/public/offline.html
git commit -m "feat(offline): offline.html como shell inteligente com status do IndexedDB"
```

---

## Task 5: Teste de ponta a ponta no dispositivo

Este task é um roteiro de testes manuais para validar todas as mudanças juntas.

**Pré-requisito:** deploy da versão com as 4 tasks anteriores no ambiente de staging/produção (ou testar via `npm run build && npm start` + ngrok para acesso HTTPS no mobile — PWA exige HTTPS).

---

**Cenário 1: App abre offline depois do login**

1. Fazer login com internet no dispositivo iOS/Safari
2. Aguardar o warming completar (observar no DevTools → Application → Cache Storage → "pages-cache" deve ter entries para `/admin/auditorias`, `/admin/auditoria/nova`, `/admin/dashboard`)
3. Ativar modo avião no dispositivo
4. Fechar o Safari completamente (não apenas minimizar)
5. Abrir o PWA pelo ícone da home screen

**Esperado:**
- O app abre sem pedir conexão
- Aparece a tela de auditorias (ou dashboard, dependendo do start_url)
- A lista pode estar vazia se nenhuma auditoria offline existir, mas a UI aparece

---

**Cenário 2: Nova auditoria offline**

1. Com internet, fazer login
2. Aguardar warming (verificar DevTools → Application → IndexedDB → `chekai-offline` → `cache_templates` deve ter entradas)
3. Ativar modo avião
4. Navegar para "Nova Auditoria" (ou abrir diretamente pelo link)

**Esperado:**
- Formulário de nova auditoria abre
- Dropdown de clientes popula com dados do IndexedDB
- Dropdown de templates popula com dados do IndexedDB
- Usuário pode iniciar e preencher o checklist

---

**Cenário 3: Rota nunca visitada aciona offline shell**

1. Com internet, fazer login
2. NÃO visitar `/admin/configuracoes-credito`
3. Ativar modo avião
4. Tentar navegar para `/admin/configuracoes-credito`

**Esperado:**
- Aparece o `offline.html` shell com status dos dados
- Mostra botão "Nova Auditoria" se templates/clientes estão em cache
- NÃO aparece o erro do Safari "não está conectado à internet"

---

**Cenário 4: Volta online — cache atualizado**

1. Com modo avião, usar o app
2. Voltar a ter conexão
3. Observar o `OfflineProvider` re-disparar o warming (verificar no DevTools que "pages-cache" atualiza timestamps)

**Esperado:** sem erros no console, cache atualizado silenciosamente.

---

## Referências

- Design doc: `docs/plans/2026-02-18-offline-app-shell-design.md`
- next-pwa docs: `apps/web/next-pwa.d.ts` (tipos disponíveis)
- Workbox NavigateFallback: https://developer.chrome.com/docs/workbox/modules/workbox-routing#navigation_route
- iOS PWA limitations: iOS limpa caches após ~7 dias sem uso — o TTL de 7 dias do `StaleWhileRevalidate` é o máximo prático

---

## Ordem das tasks

```
Task 1 (SW Strategy + manifest) → Task 2 (cache-warming.ts) → Task 3 (offline-provider) → Task 4 (offline.html) → Task 5 (teste)
```

Tasks 2 e 3 podem ser feitas em paralelo se desejado (não há dependência entre elas).
Task 4 é independente de todas as outras.
Task 5 requer rebuild após Tasks 1-4.
