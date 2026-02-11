# Design: PWA – Cache implícito de dados + UI offline

**Data:** 2026-02-04  
**Objetivo:** Melhorar a experiência offline do app (auditoria em campo) com cache implícito de dados e cache da UI para manter páginas acessíveis offline.

---

## 1. Contexto e escopo

- **Foco:** Auditoria em campo e leitura offline dos dados que o usuário já acessou (templates, lista de auditorias, unidades/clientes).
- **Estratégia:** Cache **implícito** — ao abrir cada tela, os dados são persistidos no IndexedDB; offline, a mesma tela usa apenas o cache, sem botão “disponível offline”.
- **UI offline:** Garantir que as páginas já visitadas (HTML/JS) sejam servidas pelo Service Worker quando não houver rede, em vez de cair direto na página genérica “você está offline”.

Hoje o projeto já tem: next-pwa (Workbox), Dexie com tabelas de cache e fila de sync, e padrão “online → API + gravar no cache; offline → ler do cache” em `listarAuditorias` e na página de nova auditoria (clientes/templates feitos na mão). O que falta é (a) uma **camada única** de dados que unifique esse comportamento para todos os recursos e (b) garantir que o **SW cacheie respostas de documento** para as rotas do app.

---

## 2. Camada de dados (API + cache Dexie)

**Ideia:** Uma camada que concentra a regra “online → chamar API, salvar no IndexedDB, devolver; offline → devolver do IndexedDB”.

- **Onde fica:** Módulo(s) em `src/lib/offline/` (ex.: `data-layer.ts` ou estender `auditoria-offline.ts` e criar um módulo genérico para listagens/detalhes). As páginas e componentes passam a chamar essa camada em vez de `checklistService`, `clienteService`, `unidadeService` etc. diretamente para os fluxos que precisam funcionar offline.
- **Recursos a cobrir (ordem sugerida):**
  1. **Templates:** listar (paginado e por tipo), buscar por ID — já existem `salvarListaTemplates`, `salvarTemplate`, `obterListaTemplates`, `obterTemplate` em `cache.ts`.
  2. **Auditorias:** listar — já existe `listarAuditorias` em `auditoria-offline`; manter e, se necessário, alinhar assinaturas com a camada.
  3. **Unidades:** listar por cliente (e, se fizer sentido, lista global) — já existem `salvarListaUnidades` / `obterListaUnidades`; no `cache.ts` há uso de `cache_unidades` para “list” e “clientes”; padronizar chaves (ex.: `clientes/{clienteId}/unidades` para lista por cliente).
  4. **Clientes:** listar — já existem `salvarClientes` / `obterClientes` em `cache.ts`.

**Comportamento:** Sempre que a camada chamar a API com sucesso, grava no Dexie (usando as funções atuais de `cache.ts`). Se `navigator.onLine === false` (ou flag/store de “offline”), a camada só lê do cache e devolve; se não houver dado em cache, devolve lista vazia ou null conforme o caso. TTL já existente (ex.: 24h) em `cache.ts` pode ser mantido; opcionalmente expor “dados do cache” para a UI exibir um aviso discreto.

**Implementação:** Criar funções do tipo `listarTemplates(...)`, `buscarTemplatePorId(id)`, `listarUnidadesPorCliente(clienteId)`, `listarClientes()` que internamente fazem `isOnline() ? api + cache : cache`. As páginas que hoje usam `checklistService.listarTemplates()`, `clienteService.listar()`, etc. passam a usar essas funções para os cenários que devem funcionar offline. O restante (criar/editar/remover) continua indo direto à API quando online; quando offline, apenas auditoria já tem fila de sync — não expandir escrita offline neste escopo.

---

## 3. Cache da UI (Service Worker e páginas offline)

**Objetivo:** Manter a página offline — ao navegar para uma rota já visitada sem internet, o usuário ver a própria página (com dados do cache), não a tela genérica “você está offline”.

**Comportamento desejado:**

- Requisições de **documento** (navegação para `/admin/auditorias`, `/admin/auditoria/nova`, etc.): ao falhar a rede, o SW deve tentar servir a **resposta em cache** dessa mesma URL (que foi cacheada quando o usuário visitou a página com rede). Só se não houver resposta em cache para essa URL, aí sim servir `offline.html` como fallback.
- Assets e dados (JS, CSS, API): manter estratégia atual (NetworkFirst com cache), garantindo que as rotas de API usadas pelas páginas em cache possam ser servidas do IndexedDB pela camada de dados (não pelo SW).

**Configuração next-pwa / Workbox:**

- Garantir que requisições de **navegação** (document) entrem na mesma regra de runtime cache que já cacheia respostas (ex.: regra genérica `urlPattern: /^https?.*/` com NetworkFirst). Assim, o HTML de cada URL visitada é armazenado no Cache API quando a rede responde.
- O fallback `document: '/offline.html'` deve ser usado **apenas quando não existir resposta em cache para a URL solicitada** (comportamento padrão do NetworkFirst: tenta rede, em falha usa cache; se não houver cache, aí o fallback do plugin). Validar na prática que, ao ficar offline e acessar novamente uma rota já visitada, o SW devolve o documento em cache e não o `offline.html`.
- Não é necessário, neste escopo, precache de todas as rotas do app; o foco é cache em runtime ao visitar cada página.

**Experiência resultante:** Usuário abre `/admin/auditorias` com internet → HTML e dados são cacheados. Depois, sem internet, abre o app e navega para “Auditorias” → SW serve o HTML cacheado → a aplicação hidrata e a camada de dados devolve a lista do IndexedDB → a página aparece com os dados já vistos.

---

## 4. Fluxo de dados e erros

- **Online:** A camada chama a API; em sucesso, persiste no Dexie e retorna os dados. Em falha (4xx/5xx), não grava no cache e propaga o erro para a UI (toast/estado de erro como hoje).
- **Offline:** A camada não chama a API; lê do Dexie. Se não houver registro ou estiver expirado (TTL), retorna lista vazia ou null. A UI pode mostrar “Nenhum dado em cache” ou “Abra esta tela com internet para usar offline” de forma discreta.
- **Transição online → offline:** O store/flag de “offline” já usado no app (ex.: `useOfflineStore`) continua definindo quando usar apenas cache; a camada consulta esse estado antes de decidir entre API ou cache.
- **Transição offline → online:** Ao voltar online, a sync da fila de auditoria segue como hoje; as próximas navegações e chamadas passam a usar a API de novo e a atualizar o cache.

Nenhuma mudança no tratamento de erros de rede além do que já existe; a camada apenas centraliza a decisão “rede vs cache”.

---

## 5. Ordem de implementação sugerida

1. **Camada de dados**
   - Criar módulo (ex.: `data-layer.ts`) com funções para templates (listar, buscar por ID), alinhando com `cache.ts` e com a API atual.
   - Refatorar página de **lista de templates** e **nova auditoria** (clientes + templates) para usar a camada em vez de chamar serviços da API direto.
   - Incluir **clientes** e **unidades por cliente** na camada; padronizar chaves no `cache.ts` se necessário; usar na nova auditoria e em qualquer lista que precise funcionar offline.
   - Manter `listarAuditorias` em `auditoria-offline` usando a mesma ideia (já implementado); garantir que a assinatura e o uso em dashboard/auditorias estejam consistentes com o resto da camada.

2. **Cache da UI**
   - Revisar a configuração do next-pwa (e o SW gerado) para confirmar que respostas de documento são cacheadas e que o fallback para `offline.html` só ocorre quando não houver documento em cache para a URL.
   - Testar no dispositivo: visitar duas ou três rotas do admin com rede, ativar modo avião, reabrir o app e navegar para as mesmas rotas — deve carregar a página a partir do cache e os dados a partir do IndexedDB.
   - Se em algum ambiente o SW não servir o documento em cache, considerar configuração explícita de `navigateFallback` (ou equivalente) para rotas do app, servindo um shell único apenas como último recurso (documentar decisão).

3. **Ajustes finos**
   - Opcional: indicador visual discreto “dados do cache” quando a lista/detalhe vier só do IndexedDB.
   - Documentar no README ou em docs que o uso offline depende de ter aberto as telas com internet pelo menos uma vez (e, no iOS/Safari, da dica já existente no tutorial de instalação).

---

## 6. O que fica de fora (YAGNI)

- Botão “Deixar disponível offline” ou download explícito de recursos.
- Cache de rotas que o usuário nunca visitou (precache de todas as páginas do admin).
- Escrita offline além do fluxo de auditoria já existente (ex.: criar/editar templates offline).
- Mudança para React Query ou outra lib de estado apenas para esse objetivo; a solução permanece com a camada explícita + Dexie.

---

## Resumo

- **Dados:** Uma camada única (API + Dexie) para listagens e detalhes de templates, auditorias, clientes e unidades, com cache implícito ao navegar; páginas passam a usar essa camada nos fluxos offline.
- **UI:** Garantir que o Service Worker cacheie respostas de documento ao visitar cada rota e as sirva quando offline, usando `offline.html` só quando não houver documento em cache para a URL.
- **Ordem:** Implementar camada de dados e migrar telas (templates, nova auditoria, clientes/unidades); em seguida validar e, se necessário, ajustar cache de documentos no SW.
