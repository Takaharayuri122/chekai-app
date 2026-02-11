# Plano de implementação: PWA cache implícito (dados + UI)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Objetivo:** Implementar a camada única de dados (API + Dexie) para cache implícito e garantir que o SW sirva páginas cacheadas quando offline, conforme o design em `2026-02-04-pwa-cache-ui-dados-design.md`.

**Arquitetura:** Módulo `data-layer.ts` em `src/lib/offline/` que expõe funções de listagem/detalhe (templates, clientes, unidades por cliente, auditorias). Cada função: se online → chama API, persiste no cache via `cache.ts`, retorna; se offline → lê do cache e retorna. Páginas passam a usar essa camada. O SW já usa NetworkFirst; validar que documentos são cacheados e servidos quando offline.

**Stack:** Next.js (apps/web), Dexie (IndexedDB), next-pwa (Workbox), Zustand (useOfflineStore).

---

## Fase 1: Cache e camada de dados

### Task 1: Cache – unidades por cliente

**Arquivos:**
- Modificar: `apps/web/src/lib/offline/cache.ts`

**Passo 1:** Adicionar funções para cache de unidades por cliente (chave `unidades-${clienteId}` na tabela `cache_unidades`).

Inserir após `obterListaUnidades` (por volta da linha 39):

```ts
const CACHE_KEY_UNIDADES_CLIENTE = (clienteId: string) => `unidades-${clienteId}`;

export async function salvarUnidadesPorCliente(clienteId: string, data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_unidades.put({
    id: CACHE_KEY_UNIDADES_CLIENTE(clienteId),
    data,
    cachedAt: Date.now(),
  });
}

export async function obterUnidadesPorCliente(clienteId: string): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_unidades.get(CACHE_KEY_UNIDADES_CLIENTE(clienteId));
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}
```

**Passo 2:** Verificar linter e salvar.

```bash
cd apps/web && npx eslint src/lib/offline/cache.ts
```

**Passo 3:** Commit.

```bash
git add apps/web/src/lib/offline/cache.ts
git commit -m "feat(offline): cache de unidades por cliente no IndexedDB"
```

---

### Task 2: Cache – templates por tipo

**Arquivos:**
- Modificar: `apps/web/src/lib/offline/cache.ts`

**Passo 1:** Adicionar funções para lista de templates por tipo (chave `tipo-${tipo}` em `cache_templates`).

Inserir após `obterListaTemplates` (por volta da linha 91):

```ts
const CACHE_KEY_TEMPLATES_TIPO = (tipo: string) => `tipo-${tipo}`;

export async function salvarListaTemplatesPorTipo(tipo: string, data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_templates.put({
    id: CACHE_KEY_TEMPLATES_TIPO(tipo),
    data,
    cachedAt: Date.now(),
  });
}

export async function obterListaTemplatesPorTipo(tipo: string): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_templates.get(CACHE_KEY_TEMPLATES_TIPO(tipo));
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}
```

**Passo 2:** Verificar linter.

```bash
cd apps/web && npx eslint src/lib/offline/cache.ts
```

**Passo 3:** Commit.

```bash
git add apps/web/src/lib/offline/cache.ts
git commit -m "feat(offline): cache de lista de templates por tipo"
```

---

### Task 3: Criar módulo data-layer

**Arquivos:**
- Criar: `apps/web/src/lib/offline/data-layer.ts`
- Referência de tipos: `apps/web/src/lib/api.ts` (PaginatedResult, ChecklistTemplate, Cliente, Unidade, TipoAtividade)

**Passo 1:** Criar o arquivo com funções que usam `useOfflineStore.getState().isOnline` e, quando online, chamam a API e gravam no cache; quando offline, leem do cache.

Conteúdo inicial de `data-layer.ts`:

```ts
import {
  checklistService,
  clienteService,
  type ChecklistTemplate,
  type Cliente,
  type Unidade,
  type PaginatedResult,
  type TipoAtividade,
} from '../api';
import { useOfflineStore } from '../store-offline';
import * as cache from './cache';

function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return useOfflineStore.getState().isOnline;
}

export async function listarTemplates(
  page = 1,
  limit = 10
): Promise<PaginatedResult<ChecklistTemplate>> {
  if (isOnline()) {
    const result = await checklistService.listarTemplates(page, limit);
    await cache.salvarListaTemplates(result);
    if (result.items?.length) {
      for (const t of result.items) {
        await cache.salvarTemplate(t.id, t);
      }
    }
    return result;
  }
  const cached = await cache.obterListaTemplates();
  if (cached && typeof cached === 'object' && 'items' in cached) {
    return cached as PaginatedResult<ChecklistTemplate>;
  }
  return { items: [], total: 0, page: 1, limit };
}

export async function listarTemplatesPorTipo(tipo: TipoAtividade): Promise<ChecklistTemplate[]> {
  if (isOnline()) {
    const result = await checklistService.listarTemplatesPorTipo(tipo);
    await cache.salvarListaTemplatesPorTipo(tipo, result);
    if (result?.length) {
      for (const t of result) {
        await cache.salvarTemplate(t.id, t);
      }
    }
    return result;
  }
  const cached = await cache.obterListaTemplatesPorTipo(tipo);
  if (Array.isArray(cached)) return cached as ChecklistTemplate[];
  return [];
}

export async function buscarTemplatePorId(id: string): Promise<ChecklistTemplate | null> {
  if (isOnline()) {
    const result = await checklistService.buscarTemplatePorId(id);
    await cache.salvarTemplate(id, result);
    return result;
  }
  const cached = await cache.obterTemplate(id);
  return (cached as ChecklistTemplate) ?? null;
}

export async function listarClientes(): Promise<PaginatedResult<Cliente>> {
  if (isOnline()) {
    const result = await clienteService.listar();
    await cache.salvarClientes(result);
    return result;
  }
  const cached = await cache.obterClientes();
  if (cached && typeof cached === 'object' && 'items' in cached) {
    return cached as PaginatedResult<Cliente>;
  }
  return { items: [], total: 0, page: 1, limit };
}

export async function listarUnidadesPorCliente(clienteId: string): Promise<Unidade[]> {
  if (isOnline()) {
    const result = await clienteService.listarUnidades(clienteId);
    await cache.salvarUnidadesPorCliente(clienteId, result);
    return result;
  }
  const cached = await cache.obterUnidadesPorCliente(clienteId);
  if (Array.isArray(cached)) return cached as Unidade[];
  return [];
}
```

**Passo 2:** Verificar se `PaginatedResult` e `TipoAtividade` estão exportados em `api.ts` (buscar por `export.*PaginatedResult|export.*TipoAtividade`). Ajustar imports se necessário.

**Passo 3:** Rodar linter.

```bash
cd apps/web && npx eslint src/lib/offline/data-layer.ts
```

**Passo 4:** Commit.

```bash
git add apps/web/src/lib/offline/data-layer.ts
git commit -m "feat(offline): camada de dados para cache implícito (templates, clientes, unidades)"
```

---

### Task 4: Exportar data-layer no index offline

**Arquivos:**
- Modificar: `apps/web/src/lib/offline/index.ts`

**Passo 1:** Adicionar export do data-layer.

Incluir linha (ajustar conforme o conteúdo atual do arquivo):

```ts
export * from './data-layer';
```

**Passo 2:** Commit.

```bash
git add apps/web/src/lib/offline/index.ts
git commit -m "chore(offline): exportar data-layer"
```

---

### Task 5: Página de templates usar data-layer

**Arquivos:**
- Modificar: `apps/web/src/app/admin/templates/page.tsx`

**Passo 1:** Trocar import e chamada: em vez de `checklistService.listarTemplates()`, usar `listarTemplates` do data-layer.

- Remover uso de `checklistService` para listagem (manter para `removerTemplate` e `alterarStatusTemplate`).
- Importar: `import { listarTemplates } from '@/lib/offline/data-layer';`
- Em `carregarTemplates`: `const response = await listarTemplates(1, 100);` (ou o limit que fizer sentido; a página atual usa `listarTemplates()` sem args, então page=1, limit=10 por padrão — pode usar limit maior para lista única, ex. 100).

**Passo 2:** Verificar que a página continua funcionando (build e, se possível, abrir a rota no browser).

```bash
cd apps/web && npm run build
```

**Passo 3:** Commit.

```bash
git add apps/web/src/app/admin/templates/page.tsx
git commit -m "feat(offline): lista de templates usa data-layer para cache implícito"
```

---

### Task 6: Página nova auditoria usar data-layer

**Arquivos:**
- Modificar: `apps/web/src/app/admin/auditoria/nova/page.tsx`

**Passo 1:** Substituir chamadas diretas à API por funções do data-layer.

- Importar: `import { listarClientes, listarTemplates, listarUnidadesPorCliente } from '@/lib/offline/data-layer';`
- Remover imports de `clienteService` e `checklistService` apenas para listar (manter se usados em outro lugar).
- No `useEffect` de `carregarDados`:
  - Se online: `const [clientesRes, templatesRes] = await Promise.all([ listarClientes(), listarTemplates(1, 100) ]);` e depois, quando o usuário selecionar cliente, chamar `listarUnidadesPorCliente(clienteSelecionado.id)` (pode ser em um efeito separado ou no handler de seleção de cliente).
  - Se offline: `const [clientesRes, templatesRes] = await Promise.all([ listarClientes(), listarTemplates(1, 100) ]);` e unidades do cache quando houver cliente selecionado.

A página atual já faz cache manual de clientes/templates e lê do cache quando offline. Substituir essa lógica por chamadas únicas a `listarClientes()`, `listarTemplates(1, 100)` e, ao selecionar cliente, `listarUnidadesPorCliente(cliente.id)`. Remover as chamadas a `cache.salvarClientes`, `cache.salvarListaTemplates`, `cache.salvarTemplate` e as leituras diretas de `cache.obter*`, pois a camada já faz isso.

**Passo 2:** Garantir que a seleção de cliente carrega unidades: onde hoje chama `clienteService.listarUnidades(clienteId)`, passar a chamar `listarUnidadesPorCliente(clienteId)` (e salvar no estado de unidades da página).

**Passo 3:** Build.

```bash
cd apps/web && npm run build
```

**Passo 4:** Commit.

```bash
git add apps/web/src/app/admin/auditoria/nova/page.tsx
git commit -m "feat(offline): nova auditoria usa data-layer (clientes, templates, unidades)"
```

---

### Task 7: Manter listarAuditorias e uso consistente

**Arquivos:**
- Modificar: `apps/web/src/lib/offline/index.ts` (se ainda não exportar listarAuditorias)
- Referência: `apps/web/src/app/admin/dashboard/page.tsx`, `apps/web/src/app/admin/auditorias/page.tsx`

**Passo 1:** Garantir que `listarAuditorias` continua exportada a partir de `auditoria-offline` (ou reexportada no index). As páginas dashboard e auditorias já usam `listarAuditorias` de `@/lib/offline/auditoria-offline`; não é obrigatório mover para data-layer, mas o index pode reexportar `listarAuditorias` de auditoria-offline para um único ponto de import offline.

**Passo 2:** Nenhuma alteração obrigatória nas páginas se já importam de `auditoria-offline`. Opcional: em `data-layer.ts` reexportar `listarAuditorias` de `./auditoria-offline` para que as páginas possam importar tudo de `@/lib/offline/data-layer` ou manter como está.

**Passo 3:** Commit apenas se houver alteração.

```bash
git add apps/web/src/lib/offline/index.ts
git commit -m "chore(offline): reexport listarAuditorias no index"
```

---

## Fase 2: Cache da UI (Service Worker)

### Task 8: Revisar next-pwa para cache de documentos

**Arquivos:**
- Modificar (se necessário): `apps/web/next.config.ts`
- Documentação: https://github.com/shadowwalker/next-pwa#configuration

**Passo 1:** Confirmar que a regra de runtime caching com `urlPattern: /^https?.*/` e `NetworkFirst` se aplica a requisições de navegação (document). Em muitos setups do Workbox, requisições GET para o mesmo origin já são cacheadas por essa regra. O fallback `document: '/offline.html'` é usado quando a rede falha **e** não há resposta em cache para essa URL.

**Passo 2:** Se a documentação do next-pwa indicar que navegações são tratadas de forma diferente, adicionar uma regra explícita de runtime caching para requisições com `request.mode === 'navigate'`, usando NetworkFirst com o mesmo cache (ex.: `offlineCache`), para garantir que o HTML de cada rota visitada seja armazenado e servido quando offline.

Exemplo (só se necessário após teste):

```ts
// Em runtimeCaching, antes da regra genérica:
{
  urlPattern: ({ request }) => request.mode === 'navigate',
  handler: 'NetworkFirst',
  options: {
    cacheName: 'offlineCache',
    networkTimeoutSeconds: 10,
    expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
  },
},
```

**Passo 3:** Build de produção e inspecionar o SW gerado em `apps/web/public/sw.js` (ou saída do build) para confirmar que documentos são cacheados.

```bash
cd apps/web && npm run build && ls -la public/sw.js
```

**Passo 4:** Commit (apenas se houver alteração em next.config).

```bash
git add apps/web/next.config.ts
git commit -m "fix(pwa): garantir cache de documentos para navegação offline"
```

---

### Task 9: Documentar uso offline no README

**Arquivos:**
- Modificar: `apps/web/README.md` ou `docs/` (se existir doc de PWA)

**Passo 1:** Adicionar uma seção curta (2–4 linhas): uso offline depende de abrir as telas com internet pelo menos uma vez; no iPhone/Safari, seguir a dica do tutorial de instalação (abrir uma vez com conexão).

**Passo 2:** Commit.

```bash
git add apps/web/README.md
git commit -m "docs: requisito de uso offline (abrir telas com internet uma vez)"
```

---

## Resumo de commits esperados

1. feat(offline): cache de unidades por cliente no IndexedDB  
2. feat(offline): cache de lista de templates por tipo  
3. feat(offline): camada de dados para cache implícito (templates, clientes, unidades)  
4. chore(offline): exportar data-layer  
5. feat(offline): lista de templates usa data-layer para cache implícito  
6. feat(offline): nova auditoria usa data-layer (clientes, templates, unidades)  
7. (opcional) chore(offline): reexport listarAuditorias no index  
8. (se necessário) fix(pwa): garantir cache de documentos para navegação offline  
9. docs: requisito de uso offline  

---

## Como testar manualmente

1. **Dados:** Com internet, abrir lista de templates e nova auditoria (escolher cliente e ver unidades). Desativar rede (DevTools Offline ou modo avião). Recarregar e abrir as mesmas telas — devem carregar com dados do cache.  
2. **UI:** Com internet, visitar `/admin/auditorias` e `/admin/auditoria/nova`. Desativar rede. Navegar de novo para essas URLs — a página deve abrir (HTML do cache) e os dados vir do IndexedDB. Se cair em `offline.html`, revisar Task 8.
