# DE:PARA Web ↔ Mobile — Levantamento Funcional

> Fonte da verdade: **web** (`apps/web`, Next.js + DaisyUI, em produção). Objetivo: **paridade funcional** do mobile (`apps/mobile`, Expo, offline-first SQLite) com o web, consumindo os MESMOS endpoints, parâmetros, relations, isolamento e regras de negócio.
>
> Base: `docs/paridade-plataformas.md`, `docs/regras-de-negocio.md` (regras `RN-XXX-NNN`) e leitura direta do código de `apps/api`, `apps/web` e `apps/mobile`.
>
> Convenção: todos os paths de API têm prefixo global **`/api`** (`apps/api/src/main.ts`). O `ValidationPipe` global usa **`whitelist: true` + `forbidNonWhitelisted: true`** — **campos extras no body causam HTTP 400**. Isso é determinante para vários ajustes abaixo.

---

## Resumo

**Contagem:** **13 ajustes**, **16 novas**, **paridade OK** em ~7 áreas centrais.

| Módulo | Ajustes | Novas | OK / Observação |
|--------|:------:|:-----:|-----------------|
| Autenticação | 0 | 0 | OK (OTP, logout) |
| Usuários | 0 | 1 | CRUD admin = fora de escopo mobile |
| Clientes / Unidades | 1 | 0 | Pull readonly OK; CRUD admin fora de escopo |
| Templates / Checklist | 1 | 0 | Pull/seleção OK; editor/IA fora de escopo |
| **Auditorias** | **6** | **5** | Core (criar/listar/responder/foto) OK |
| Relatório Técnico | 0 | 1 | Módulo inteiro ausente (placeholder) |
| Check-in | 0 | 1 | Módulo inteiro ausente |
| Planos / Assinaturas | 0 | 1 | Admin = fora de escopo; ver limites = opcional |
| Créditos IA | 2 | 1 | Auditoria de tokens é obrigatória |
| Legislação | 0 | 0 | Admin/RAG interno = fora de escopo mobile |
| Sincronização | 2 | 1 | Pull/push core OK; automação/fila divergem |
| Perfil | 1 | 0 | Edição de perfil ausente (web também tem gap) |

**Visão geral:** o **núcleo de auditoria offline-first existe e funciona** (criar → responder → foto → push). As divergências mais graves são **2 chamadas de API quebradas** no fluxo de auditoria (finalizar com campos não-whitelisted → 400; sugestão de NC por IA usando endpoint inexistente → 404) e **IA de foto + resumo executivo + PDF + reabrir** ausentes. Os módulos **Relatório Técnico** e **Check-in** existem só como schema/placeholder no mobile. Os módulos administrativos (Usuários, Planos, Legislação, Auditoria de Tokens) são considerados fora de escopo do app mobile do auditor.

---

## AJUSTES (existe no mobile, diverge do web)

### [AJUSTE] Auditorias — Finalização envia campos que causam HTTP 400 (forbidNonWhitelisted)
- **O que o web faz:** `PUT /auditorias/:id/finalizar` com body conforme `FinalizarAuditoriaDto` — **apenas** `latitude?`, `longitude?`, `observacoesGerais?`. `dataFim` é definido no servidor (`auditoria.service.ts` → `auditoria.dataFim = new Date()`).
- **O que o mobile faz hoje:** `finalizarAuditoria()` envia `{ dataFim, latitudeFim?, longitudeFim?, assinaturaNome? }` (`apps/mobile/src/api/auditoria.api.ts`, `FinalizarPayload`). A tela `resumo.tsx` envia `dataFim` + `assinaturaNome`.
- **Divergência exata:** (1) `dataFim`, `latitudeFim`, `longitudeFim`, `assinaturaNome` **não existem** no DTO; com `forbidNonWhitelisted: true` (`apps/api/src/main.ts`) o request é **rejeitado com 400** → o push de finalização falha contra a API atual. (2) Mesmo se aceito, os nomes de coordenada divergem (`latitudeFim`/`longitudeFim` vs `latitude`/`longitude`). (3) `assinaturaNome` não é persistido por nenhum campo da API.
- **Endpoint(s)/query(s) correto(s):** `PUT /auditorias/:id/finalizar` — body `{ latitude?: number, longitude?: number, observacoesGerais?: string }`.
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/page.tsx` (chamada `finalizar`), `apps/web/src/lib/api.ts` (`auditoriaService.finalizar`).
- **Arquivos mobile a alterar:** `apps/mobile/src/api/auditoria.api.ts` (`FinalizarPayload`, `finalizarAuditoria`), `apps/mobile/src/sync/push.ts`, `apps/mobile/app/(app)/auditorias/[id]/resumo.tsx`.
- **Critérios de aceite:**
  - Finalização não envia `dataFim`/`assinaturaNome`/`latitudeFim`/`longitudeFim`.
  - Coordenadas de fim (se capturadas) vão como `latitude`/`longitude`.
  - Observações gerais vão como `observacoesGerais`.
  - Push de uma auditoria completa retorna 200 e marca `sync_status='synced'`.
  - Se assinatura for requisito de produto, abrir item NOVA na API para persistir (hoje não há campo).
- **Prioridade sugerida:** **alta** — quebra o push de auditorias contra a API de produção (RN-AUD-009, RN-SYN-010).

### [AJUSTE] Auditorias — Sugestão de NC por IA usa endpoint inexistente (404)
- **O que o web faz:** análise/sugestão por IA via endpoints reais do `IaController` (`apps/api/src/modules/ia/ia.controller.ts`): `POST /ia/analisar-checklist` (multipart imagem + `perguntaChecklist`, `categoria?`, `tipoEstabelecimento?`), `POST /ia/gerar-texto` (`{ descricao, tipoEstabelecimento? }`), `POST /ia/plano-acao` (`{ descricaoNaoConformidade, referenciaLegal? }`). Todos debitam créditos via `CreditoService`.
- **O que o mobile faz hoje:** `getSugestaoIa()` chama `POST /auditorias/ia/sugestao-nc` com `{ itemId, contexto }` (`apps/mobile/src/api/auditoria.api.ts` linha ~104), usado em `[itemId].tsx`, `SwipeCard.tsx`, `ItemDetailSheet.tsx`.
- **Divergência exata:** **a rota `/auditorias/ia/sugestao-nc` não existe na API** (o `AuditoriaController` não a declara; o `IaController` é `/ia/*`). A chamada resulta em 404 / timeout. O contrato esperado (`{ descricao, planoAcao }`) também não corresponde a nenhum endpoint atual.
- **Endpoint(s)/query(s) correto(s):** para texto de plano de ação a partir de NC: `POST /ia/plano-acao` (`{ descricaoNaoConformidade, referenciaLegal? }`); para geração de texto contextual: `POST /ia/gerar-texto`; para análise de imagem do item: `POST /ia/analisar-checklist` (multipart).
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/page.tsx`, `apps/web/src/lib/api.ts` (`iaService`).
- **Arquivos mobile a alterar:** `apps/mobile/src/api/auditoria.api.ts` (`getSugestaoIa`), `apps/mobile/app/(app)/auditorias/[id]/item/[itemId].tsx`, `apps/mobile/src/components/auditoria/SwipeCard.tsx`, `apps/mobile/src/components/auditoria/ItemDetailSheet.tsx`.
- **Critérios de aceite:**
  - Sugestão de NC/plano de ação chama endpoint REAL existente e retorna texto.
  - Mapear resposta da API para os campos usados na UI (descrição NC / plano de ação).
  - Consumo de créditos é contabilizado (RN-CRD-007 / `auditoria-tokens.mdc`).
- **Prioridade sugerida:** **alta** — funcionalidade de IA do auditor está quebrada (RN-CRD-007).

### [AJUSTE] Auditorias — Resposta de item não envia todos os campos do contrato
- **O que o web faz:** `PUT /auditorias/:id/itens/:itemId` enviando o `ResponderItemDto` completo: `resposta`, `observacao?`, `descricaoNaoConformidade?`, `descricaoIa?`, `complementoDescricao?`, `planoAcaoSugerido?`, `referenciaLegal?`.
- **O que o mobile faz hoje:** `submitItem()` envia apenas `{ resposta, observacao, descricaoNaoConformidade, planoAcaoSugerido }` (este último mapeado de `planoAcaoFinal`). Não envia `descricaoIa`, `complementoDescricao`, `referenciaLegal`.
- **Divergência exata:** campos `descricaoIa`, `complementoDescricao`, `referenciaLegal` ficam ausentes no push; dados gerados/editados localmente (ex.: descrição da IA + complemento do operador) não chegam ao servidor. O SQLite local já possui essas colunas (`auditoria_itens.descricao_ia`, `complemento_descricao`, `referencia_legal`).
- **Endpoint(s)/query(s) correto(s):** `PUT /auditorias/:id/itens/:itemId` com `ResponderItemDto` completo (`apps/api/src/modules/auditoria/dto/criar-auditoria.dto.ts`).
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/page.tsx`.
- **Arquivos mobile a alterar:** `apps/mobile/src/api/auditoria.api.ts` (`ItemPayload`, `submitItem`), `apps/mobile/src/sync/push.ts`, `apps/mobile/src/db/repositories/auditoria-item.repo.ts` (garantir que os campos sejam lidos no payload de push).
- **Critérios de aceite:**
  - Push de item inclui `descricaoIa`, `complementoDescricao`, `referenciaLegal` quando preenchidos localmente.
  - Pull subsequente de `GET /auditorias/:id` reflete os mesmos valores.
- **Prioridade sugerida:** **média** — perda de dados de NC/IA no servidor (RN-FOT-003, RN-AUD-006).

### [AJUSTE] Auditorias — Criação não envia GPS de início
- **O que o web faz:** `POST /auditorias` com `{ unidadeId, templateId, latitude?, longitude? }` (`IniciarAuditoriaDto`); a tela `auditoria/nova` captura GPS opcional.
- **O que o mobile faz hoje:** `createAuditoria()` envia **apenas** `{ unidadeId, templateId }` (descarta `latitudeInicio`/`longitudeInicio` que existem no `CreateAuditoriaPayload`). A tela `nova-template.tsx` captura GPS, mas ele não vai no POST.
- **Divergência exata:** coordenadas de início não são enviadas; a auditoria criada no servidor fica sem geolocalização de abertura, divergindo do web.
- **Endpoint(s)/query(s) correto(s):** `POST /auditorias` — `{ unidadeId, templateId, latitude?, longitude? }`.
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/nova/page.tsx`.
- **Arquivos mobile a alterar:** `apps/mobile/src/api/auditoria.api.ts` (`createAuditoria`), `apps/mobile/src/sync/push.ts`.
- **Critérios de aceite:** quando GPS de início estiver disponível localmente, o POST inclui `latitude`/`longitude`.
- **Prioridade sugerida:** **média** — geolocalização de abertura faz parte do registro de auditoria.

### [AJUSTE] Auditorias — Pull não traz fotos existentes (relation `itens.fotos`)
- **O que o web faz:** ao abrir uma auditoria, `GET /auditorias/:id` retorna `itens.fotos` (relation completa); listagem `GET /auditorias` traz `itens` mas **não** `itens.fotos`.
- **O que o mobile faz hoje:** `pullAuditorias()` consome `GET /auditorias?limit=1000` (listagem) e popula `auditoria_itens` via `INSERT OR IGNORE`. Não há pull de fotos — fotos só existem localmente após captura no próprio device.
- **Divergência exata:** fotos enviadas por outro dispositivo/usuário (ou já no servidor) **não descem** para o SQLite; o auditor não vê evidências fotográficas pré-existentes offline.
- **Endpoint(s)/query(s) correto(s):** `GET /auditorias/:id` (traz `itens.templateItem` e `itens.fotos`) para hidratar detalhe; a listagem não serve para fotos.
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/page.tsx`.
- **Arquivos mobile a alterar:** `apps/mobile/src/sync/pull.ts` (adicionar pull de detalhe por auditoria quando necessário), `apps/mobile/src/db/repositories/foto.repo.ts`.
- **Critérios de aceite:**
  - Ao sincronizar/abrir uma auditoria já existente no servidor, fotos remotas aparecem no grid local.
  - Respeitar RN-SYN-007/008 (não sobrescrever registros `pending`).
- **Prioridade sugerida:** **média** (baixa se o uso real for "um auditor por auditoria, sempre criada no device").

### [AJUSTE] Auditorias — Status concluída não sincroniza pontuação/analise/PDF de volta
- **O que o web faz:** após finalizar, o web busca `GET /auditorias/:id` (pontuação calculada no servidor), `GET /auditorias/:id/resumo-executivo` (IA) e `GET /auditorias/:id/pdf`.
- **O que o mobile faz hoje:** `finalizarAuditoria()` espera receber `AuditoriaResumo` (`analiseIa`, `resumoExecutivo`, `pdfUrl`, `pontuacaoTotal`) na resposta do `PUT .../finalizar` e grava via `updateAfterFinalize`. Porém o endpoint de finalizar **não retorna** resumo/PDF (resumo é gerado em rota separada).
- **Divergência exata:** os campos `resumoExecutivo`/`pdfUrl`/`analiseIa` chegam nulos; a pontuação total exibida no mobile é a **calculada localmente** (`finalizarLocal`), que pode divergir da pontuação oficial do servidor (RN-AUD-010 usa config de opções/peso; o cálculo local soma `pontuacao` dos itens).
- **Endpoint(s)/query(s) correto(s):** após push, chamar `GET /auditorias/:id` para obter `pontuacaoTotal` oficial; resumo via `GET /auditorias/:id/resumo-executivo` (ver NOVA correspondente).
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/relatorio/page.tsx`.
- **Arquivos mobile a alterar:** `apps/mobile/src/sync/push.ts`, `apps/mobile/src/db/repositories/auditoria.repo.ts` (`updateAfterFinalize`/`updatePontuacao`).
- **Critérios de aceite:** após push bem-sucedido, mobile reflete a `pontuacaoTotal` retornada por `GET /auditorias/:id`.
- **Prioridade sugerida:** **média** — divergência de pontuação entre plataformas (RN-AUD-010).

### [AJUSTE] Clientes/Unidades — Pull com `limit` fixo pode truncar grandes carteiras
- **O que o web faz:** `GET /clientes?page=1&limit=100` (com paginação real disponível na API: `page`/`limit`). Isolamento por `gestorId` (GESTOR/MASTER) ou vínculo M2M `cliente.auditores` (AUDITOR) é aplicado na API.
- **O que o mobile faz hoje:** `pullClientes()` faz `GET /clientes?limit=1000` (single shot, sem paginação) e popula `clientes` + `unidades`.
- **Divergência exata:** sem laço de paginação, carteiras com >1000 clientes são truncadas no offline. O isolamento em si está correto (a API filtra por perfil), então não é problema de dados errados, e sim de cobertura.
- **Endpoint(s)/query(s) correto(s):** `GET /clientes?page=N&limit=...` com laço até esgotar.
- **Arquivos web de referência:** `apps/web/src/app/admin/clientes/page.tsx`, `apps/web/src/lib/api.ts`.
- **Arquivos mobile a alterar:** `apps/mobile/src/sync/pull.ts` (`pullClientes`, idem `pullTemplates`/`pullAuditorias`).
- **Critérios de aceite:** pull percorre todas as páginas; nenhum cliente/unidade vinculado fica de fora offline.
- **Prioridade sugerida:** **baixa** (sobe conforme o volume real de clientes por gestor).

### [AJUSTE] Templates — Pull deve garantir somente templates utilizáveis (status `ativo`)
- **O que o web faz:** `GET /checklists/templates` — para AUDITOR a API já retorna **apenas `status=ativo`** do gestor (RN-CHK-003); GESTOR/MASTER recebem todos os próprios. A tela `auditoria/nova` filtra `status === 'ativo'` no front antes de permitir uso.
- **O que o mobile faz hoje:** `pullTemplates()` faz `GET /checklists/templates?limit=1000` e grava em `checklist_templates` (campo `status`). A seleção em `nova-template.tsx` lista "templates ativos".
- **Divergência exata:** **verificar** — se o usuário logado no mobile for GESTOR/MASTER, o pull traz também `rascunho`/`inativo`; a seleção de auditoria deve filtrar `status='ativo'` consistentemente (como o web faz) para não permitir iniciar auditoria com template não publicado (RN-CHK-004).
- **Endpoint(s)/query(s) correto(s):** `GET /checklists/templates` (relation `itens`); filtrar `status='ativo'` na seleção.
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/nova/page.tsx`.
- **Arquivos mobile a alterar:** `apps/mobile/app/(app)/auditorias/nova-template.tsx`, `apps/mobile/src/sync/pull.ts`.
- **Critérios de aceite:** só templates `ativo` ficam selecionáveis para nova auditoria, independentemente do perfil.
- **Prioridade sugerida:** **baixa**.

### [AJUSTE] Créditos IA — Chamadas de IA no mobile devem passar pela auditoria de tokens
- **O que o web faz:** toda chamada de IA passa por endpoints que debitam créditos via `CreditoService` (RN-CRD-001..007). A IA respeita saldo/limite do gestor.
- **O que o mobile faz hoje:** usa endpoint inexistente para sugestão de NC (ver AJUSTE acima); como consequência, **nenhuma** auditoria de tokens ocorre para o consumo de IA do app.
- **Divergência exata:** o mobile precisa consumir os endpoints reais (`/ia/plano-acao`, `/ia/gerar-texto`, `/ia/analisar-checklist`) que já fazem o débito; sem isso, fica fora da regra obrigatória `auditoria-tokens.mdc`.
- **Endpoint(s)/query(s) correto(s):** endpoints do `IaController` (debitam crédito quando há usuário autenticado).
- **Arquivos web de referência:** `apps/web/src/lib/api.ts` (`iaService`), `apps/api/src/modules/ia/ia.controller.ts`.
- **Arquivos mobile a alterar:** `apps/mobile/src/api/auditoria.api.ts` (e novo `apps/mobile/src/api/ia.api.ts` se preferir isolar).
- **Critérios de aceite:** uso de IA no mobile gera registro em `UsoCredito` e respeita bloqueio por saldo (RN-CRD-003).
- **Prioridade sugerida:** **alta** (acoplada ao ajuste de endpoint de IA).

### [AJUSTE] Créditos IA — Sem tratamento de bloqueio por saldo insuficiente
- **O que o web faz:** quando o saldo de créditos esgota, a API bloqueia a chamada de IA (RN-CRD-003) e o front trata o erro.
- **O que o mobile faz hoje:** `getSugestaoIa` apenas aplica timeout de 10s e não diferencia erro de saldo de erro de rede; offline-first pode mascarar o bloqueio.
- **Divergência exata:** ausência de feedback específico de "créditos esgotados".
- **Endpoint(s)/query(s) correto(s):** mesmos endpoints de IA; tratar resposta de erro de crédito.
- **Arquivos mobile a alterar:** componentes que chamam IA na auditoria.
- **Critérios de aceite:** UI mostra mensagem clara quando a IA é bloqueada por saldo.
- **Prioridade sugerida:** **baixa**.

### [AJUSTE] Sincronização — Fila offline duplicada (SQLite `sync_queue` vs MMKV `SyncQueue`)
- **O que o web faz:** n/a (web é online direto).
- **O que o mobile faz hoje:** o envio offline real usa a tabela SQLite `sync_queue` (`enqueuePush`/`pushPending` em `apps/mobile/src/sync/push.ts`), mas o `OfflineBanner` exibe a contagem de uma classe `SyncQueue` baseada em MMKV (`sync-queue`) que **nunca recebe enqueue** do fluxo de auditoria.
- **Divergência exata:** o banner de pendências pode mostrar 0 mesmo havendo auditorias na fila SQLite; risco de o usuário achar que está tudo sincronizado.
- **Endpoint(s)/query(s):** n/a (lógica local).
- **Arquivos mobile a alterar:** `apps/mobile/src/components/OfflineBanner.tsx`, `apps/mobile/src/sync/*` (unificar para a fila SQLite `sync_queue`).
- **Critérios de aceite:** o indicador de pendências reflete a quantidade real de itens em `sync_queue`.
- **Prioridade sugerida:** **média** — impacta confiança do auditor no estado de sincronização (RN-SYN-011..013).

### [AJUSTE] Sincronização — Sem sync automático no login e ao reconectar
- **O que o web faz:** sempre online; dados sempre frescos da API.
- **O que o mobile faz hoje:** sync só dispara via pull-to-refresh em `auditorias/index.tsx` e push manual em `resumo.tsx`. Não há pull inicial após login nem listener de reconexão (deps `expo-background-fetch`/`expo-task-manager` instaladas, sem código em `src/`).
- **Divergência exata:** no primeiro acesso offline, clientes/unidades/templates podem não existir localmente (nunca foram puxados); auditorias pendentes não são enviadas automaticamente ao reconectar.
- **Endpoint(s)/query(s):** os mesmos do pull/push.
- **Arquivos mobile a alterar:** `apps/mobile/src/sync/SyncService.ts`, `apps/mobile/app/(auth)/login.tsx` (disparar `sync()` pós-login), listener NetInfo.
- **Critérios de aceite:**
  - Após login com conexão, dados base (clientes/templates) são puxados.
  - Ao recuperar conexão, push pendente é drenado (RN-SYN-003/013).
- **Prioridade sugerida:** **média**.

### [AJUSTE] Perfil — Mobile não permite editar perfil próprio
- **O que o web faz:** tela `/admin/perfil` exibe dados e (deveria) salvar via `PUT /usuarios/:id`. **Observação:** o web também tem gap — o botão Salvar hoje só simula (`setTimeout`), sem chamar a API. Logo upload usa `PUT/DELETE /usuarios/:id/logo`.
- **O que o mobile faz hoje:** `perfil.tsx` mostra apenas nome + logout; sem edição de dados.
- **Divergência exata:** mobile não tem edição de nome/telefone (RN-USR-010). Como o web também não persiste hoje, definir o comportamento correto antes (ver Observações gerais).
- **Endpoint(s)/query(s) correto(s):** `PUT /usuarios/:id` (`AtualizarUsuarioDto`); `GET /usuarios/:id` para carregar.
- **Arquivos web de referência:** `apps/web/src/app/admin/perfil/page.tsx`.
- **Arquivos mobile a alterar:** `apps/mobile/app/(app)/perfil.tsx`.
- **Critérios de aceite:** auditor edita nome/telefone e persiste via API (quando online).
- **Prioridade sugerida:** **baixa**.

---

## NOVAS (existe no web, falta no mobile)

### [NOVA] Auditorias — Análise de foto por IA
- **Funcionalidade no web:** na execução da auditoria, ao anexar foto, o web chama IA para analisar a imagem do item e sugerir NC. As fotos têm `analiseIa`/`processadoPorIa` (RN-FOT-003).
- **Endpoint(s)/query(s) da API:** `POST /ia/analisar-checklist` (multipart `imagem`, `perguntaChecklist`, `categoria?`, `tipoEstabelecimento?`); persistência via `PUT /auditorias/:id/itens/:itemId/fotos/:fotoId/analise` (`{ analiseIa }`).
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/page.tsx`, `apps/web/src/lib/api.ts` (`iaService`).
- **O que precisa no mobile:** ao adicionar foto, enviar imagem para `/ia/analisar-checklist`, exibir resultado, e persistir `analiseIa` na foto; respeitar processamento **em sequência, não paralelo**, grid 2 colunas (RN-FOT-004, já parcialmente seguido no upload). Arquivos: `apps/mobile/src/components/auditoria/FotoGrid.tsx`, `apps/mobile/src/api/auditoria.api.ts`, `foto.repo.ts` (coluna `analise_ia` já existe).
- **Considerações offline-first:** análise de imagem **exige online** (chamada de IA). Enfileirar como ação opcional pós-reconexão ou permitir disparo manual quando online. Persistir resultado no SQLite (`fotos.analise_ia`) e sincronizar via endpoint de análise.
- **Critérios de aceite:**
  - Foto analisada por IA mostra resultado no app.
  - `analise_ia` persiste localmente e sincroniza.
  - Consumo contabilizado em créditos (RN-CRD-007).
- **Prioridade sugerida:** **alta** — a matriz `paridade-plataformas.md` marca como "ok", mas no código o mobile **não** faz análise de foto por IA (corrigir a matriz).

### [NOVA] Auditorias — Resumo executivo por IA
- **Funcionalidade no web:** após finalizar, gera/exibe resumo executivo agrupado por grupo, com pontuação e NCs (RN-AUD-013); somente para auditorias `finalizada`.
- **Endpoint(s)/query(s) da API:** `GET /auditorias/:id/resumo-executivo` (gera via `IaService.gerarResumoExecutivo`, persiste `resumoExecutivo` na auditoria).
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/relatorio/page.tsx`.
- **O que precisa no mobile:** botão/seção para buscar e exibir resumo executivo após finalização e sync; gravar em `auditorias.resumo_executivo`.
- **Considerações offline-first:** geração **exige online**; resumo pode ser somente leitura no app (cache local após gerado). Não tentar gerar offline.
- **Critérios de aceite:** auditoria finalizada e sincronizada permite visualizar resumo executivo; valor cacheado offline.
- **Prioridade sugerida:** **média**.

### [NOVA] Auditorias — Visualização/Download de PDF do relatório
- **Funcionalidade no web:** gera/visualiza PDF (`?pdf=true`, fetch blob), com cache server-side (RN-PDF-002), armazenamento Supabase (RN-PDF-003).
- **Endpoint(s)/query(s) da API:** `GET /auditorias/:id/pdf` (stream `application/pdf`; só `finalizada`).
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/relatorio/page.tsx`.
- **O que precisa no mobile:** baixar/abrir o PDF (ex.: `expo-file-system` + visualizador/`Sharing`); guardar `pdf_url` (coluna já existe em `auditorias.pdf_url`).
- **Considerações offline-first:** download **exige online**; após baixado, pode abrir offline a partir do arquivo local.
- **Critérios de aceite:** auditor abre o PDF da auditoria finalizada no device.
- **Prioridade sugerida:** **média**.

### [NOVA] Auditorias — Reabrir auditoria finalizada
- **Funcionalidade no web:** reabre auditoria finalizada, limpando dados de finalização/resumo (RN-AUD-011).
- **Endpoint(s)/query(s) da API:** `PUT /auditorias/:id/reabrir` (MASTER/GESTOR/AUDITOR; AUDITOR só as próprias; GESTOR/MASTER se consultor vinculado).
- **Arquivos web de referência:** `apps/web/src/app/admin/auditorias/page.tsx`.
- **O que precisa no mobile:** ação de reabrir na listagem/detalhe; ao reabrir, atualizar `auditorias.status` local (`concluida`→`em_andamento`) e limpar pontuação/resumo locais.
- **Considerações offline-first:** reabertura **exige online** (validação de permissão na API); refletir localmente após sucesso. Não permitir reabrir offline para evitar divergência de estado.
- **Critérios de aceite:** auditor reabre uma auditoria finalizada (online) e volta a editar itens.
- **Prioridade sugerida:** **baixa/média**.

### [NOVA] Auditorias — Histórico por unidade
- **Funcionalidade no web:** mostra histórico de auditorias finalizadas da unidade (tendência de pontuação).
- **Endpoint(s)/query(s) da API:** `GET /auditorias/historico-unidade/:unidadeId` (finalizadas, máx 30, mesmo filtro consultor/gestor).
- **Arquivos web de referência:** `apps/web/src/app/admin/auditoria/[id]/relatorio/page.tsx`.
- **O que precisa no mobile:** seção de histórico na tela de relatório/resumo da auditoria.
- **Considerações offline-first:** somente leitura; **online** para dados completos; pode derivar parcialmente do SQLite local (auditorias concluídas da mesma unidade) como fallback offline.
- **Critérios de aceite:** exibir histórico de pontuação da unidade.
- **Prioridade sugerida:** **baixa**.

### [NOVA] Relatório Técnico — Módulo completo
- **Funcionalidade no web:** wizard cliente→unidade→pré-criação; formulário rich text com auto-save; ações executadas; fotos de evidência (sem IA); apoio analítico por IA (somente leitura); finalizar; PDF. Por cliente/unidade, sem pontuação (RN-REL-001..008).
- **Endpoint(s)/query(s) da API:**
  - `POST /relatorios-tecnicos/iniciar` (`{ clienteId, unidadeId }`)
  - `GET /relatorios-tecnicos?page&limit&clienteId?&status?&dataInicio?&dataFim?`
  - `GET /relatorios-tecnicos/:id`
  - `PUT /relatorios-tecnicos/:id` (campos HTML + `status`)
  - `POST /relatorios-tecnicos/:id/fotos` (multipart) / `DELETE .../fotos/:fotoId`
  - `POST /relatorios-tecnicos/:id/gerar-apoio-analitico` (`{ prompt? }`)
  - `GET /relatorios-tecnicos/:id/pdf`
- **Arquivos web de referência:** `apps/web/src/app/admin/relatorios-tecnicos/*`, `apps/web/src/components/relatorio-tecnico/relatorio-tecnico-form.tsx`.
- **O que precisa no mobile:** telas (lista, wizard, formulário rich text — dep `react-native-pell-rich-editor` já instalada), repositórios SQLite (tabelas `relatorios_tecnicos` e `relatorio_fotos` já existem no schema), sync pull/push.
- **Considerações offline-first:** rascunho/edição podem ser offline (campos HTML); apoio analítico por IA e PDF **exigem online**. Isolamento por `consultoraId` (RN-REL-002).
- **Critérios de aceite:** criar/editar/finalizar relatório técnico no app com paridade de campos obrigatórios (RN-REL-003/004); fotos de evidência sem IA (RN-REL-006).
- **Prioridade sugerida:** **média** (marcado "Plano 3" no app — confirmar prioridade de produto).

### [NOVA] Check-in — Módulo completo (check-in / checkout / alerta 3h)
- **Funcionalidade no web:** FAB global de check-in/checkout com geolocalização; alerta após 3h (Notification API); listagem administrativa (GESTOR/MASTER) com início/fim, mapa no detalhe, edição de datas/comentário; relatório de horas por cliente ou usuário (PDF/CSV) (RN-CKI-001..011).
- **Endpoint(s)/query(s) da API:**
  - `POST /checkins/iniciar` (`{ clienteId, unidadeId, latitude, longitude }`)
  - `POST /checkins/:id/finalizar` (`{ latitude, longitude }`)
  - `PATCH /checkins/:id` (`{ dataCheckin?, dataCheckout?, comentario? }`) — GESTOR/MASTER
  - `GET /checkins/me/aberto`, `GET /checkins/me/alertas`
  - (admin) `GET /checkins/filtros`, `GET /checkins?...`, `GET /checkins/:id`
  - `GET /checkins/relatorio-horas`, `GET /checkins/relatorio-horas/pdf`
- **Arquivos web de referência:** `apps/web/src/components/checkin/checkin-fab.tsx`, `checkin-modal.tsx`, `checkin-mapa.tsx`, `checkin-editar-modal.tsx`, `apps/web/src/lib/services/checkin.service.ts`, `apps/web/src/app/admin/checkins/page.tsx`, `apps/web/src/app/admin/checkins/relatorio/page.tsx`.
- **O que precisa no mobile:** UI de check-in/checkout (geolocalização nativa), exibição de check-in aberto e alerta 3h. Tabela `checkins` já existe no schema; o onboarding do app já menciona check-in/geofencing. Listagem administrativa de check-ins é GESTOR/MASTER (provável fora de escopo do auditor — confirmar).
- **Considerações offline-first:** check-in/checkout idealmente **online** (validação de unidade/gestor na API — RN-CKI-002/003); avaliar enfileirar offline com cuidado (regra de "1 check-in aberto" RN-CKI-001 é validada no servidor).
- **Critérios de aceite:** auditor faz check-in/checkout com GPS; vê alerta de 3h; respeita "apenas 1 aberto".
- **Prioridade sugerida:** **média**.
- **Status (mobile — implementado):** FAB global de check-in/checkout (`apps/mobile/src/components/checkin/CheckinFab.tsx`) + modal de seleção de cliente/unidade com captura de GPS nativo (`expo-location`) (`CheckinModal.tsx`), card de estado no Dashboard com alerta de 3h (`CheckinCard.tsx`), store (`src/store/checkin.ts`), API (`src/api/checkin.api.ts`), cache local (`CheckinRepo`, SQLite **V5**) e atualização via `pullCheckinAberto` em `pullAll`. O FAB é ocultado nas áreas de auditoria e relatórios técnicos (evita controle duplicado).
- **Decisão de produto (MVP):** check-in/checkout é **online-only** — as regras RN-CKI-001 ("apenas 1 aberto"), RN-CKI-002 (unidade ativa/pertencente) e RN-CKI-003 (vínculo do gestor) são validadas no servidor e não podem ser garantidas offline; tentar enfileirar geraria divergência de estado. O SQLite (`checkins`, recriado em V5 sem FKs, como cache) guarda apenas o **check-in aberto** para exibição offline. O alerta de 3h (RN-CKI-005) é obtido de `GET /checkins/me/alertas`/`me/aberto` e cacheado.
- **Pendência:** listagem administrativa (GESTOR/MASTER — `GET /checkins`, `/filtros`, `/:id`) ainda sem tela no mobile; funções de API já prontas em `checkin.api.ts`.

### [NOVA] Usuários — Edição de perfil próprio (mínimo viável)
- **Funcionalidade no web:** edição de dados próprios (nome/telefone) e, para GESTOR, logo da consultoria.
- **Endpoint(s)/query(s) da API:** `GET /usuarios/:id`, `PUT /usuarios/:id`, `PUT/DELETE /usuarios/:id/logo`.
- **Arquivos web de referência:** `apps/web/src/app/admin/perfil/page.tsx`.
- **O que precisa no mobile:** formulário em `perfil.tsx` para editar nome/telefone (logo é mais relevante para GESTOR). Ver também AJUSTE de perfil.
- **Considerações offline-first:** edição de perfil pode ser **online-only** (não há repo local de usuário em uso).
- **Critérios de aceite:** auditor atualiza nome/telefone.
- **Prioridade sugerida:** **baixa**.

### [NOVA] Planos — Visualizar limites/uso do gestor (opcional)
- **Funcionalidade no web:** `/admin/gestor/limites` e `/admin/gestor/creditos` (GESTOR/MASTER) — plano atual, uso vs limites, saldo de créditos.
- **Endpoint(s)/query(s) da API:** `GET /gestores/me/limites`, `GET /gestores/me/creditos?page&limit`.
- **Arquivos web de referência:** `apps/web/src/app/admin/gestor/limites/page.tsx`, `apps/web/src/app/admin/gestor/creditos/page.tsx`.
- **O que precisa no mobile:** telas somente leitura (relevante se o GESTOR usar o app). CRUD de planos/assinaturas é MASTER → fora de escopo mobile.
- **Considerações offline-first:** somente leitura online; cache opcional.
- **Critérios de aceite:** GESTOR/MASTER veem uso e saldo no app.
- **Prioridade sugerida:** **baixa**.

> As demais NOVAS de detalhe (cada endpoint de RT/Check-in) estão consolidadas dentro dos itens "Módulo completo" acima para virarem épicos no ClickUp, com subtarefas por endpoint/tela.

---

## OK (paridade funcional já atingida)

- **Autenticação OTP:** `POST /auth/solicitar-otp` + `POST /auth/validar-otp` — mesmos endpoints e fluxo de 2 passos (web e mobile). Logout local OK. (RN-AUTH-001/005).
- **Auditorias — criar:** `POST /auditorias` (mesmo endpoint; ressalva GPS no AJUSTE).
- **Auditorias — listar:** `GET /auditorias?limit=...` — API só aceita `page`/`limit` e já inclui relation `itens`; web e mobile filtram status/cliente **no cliente** (não há filtro de status na API). Paridade de comportamento.
- **Auditorias — responder item:** `PUT /auditorias/:id/itens/:itemId` (mesmo endpoint; ressalva de campos no AJUSTE).
- **Auditorias — upload de foto:** `POST /auditorias/:id/itens/:itemId/fotos` (multipart `file`) — mesmo endpoint; mobile via `FileSystem.uploadAsync`.
- **Clientes/Unidades — leitura para auditoria:** `GET /clientes` com isolamento por perfil aplicado na API; mobile usa pull readonly (ressalva de paginação no AJUSTE).
- **Templates — seleção para auditoria:** `GET /checklists/templates` (relation `itens`); mobile pull readonly (ressalva de filtro `ativo` no AJUSTE).
- **Sincronização (núcleo):** ordem push→pull (RN-SYN-003), pull respeitando FKs e `sync_status='pending'` (RN-SYN-006/007/008), mapeamento `finalizada→concluida` (RN-SYN-009), fila SQLite `sync_queue` (ressalvas de fila/automação nos AJUSTES).

---

## Observações gerais / riscos

1. **`forbidNonWhitelisted: true` (API) é o maior risco silencioso:** qualquer payload do mobile com campo extra retorna **400**. Já confirmado quebrando `finalizar`. Recomenda-se alinhar TODOS os payloads do mobile aos DTOs reais (auditoria de payloads em `apps/mobile/src/api/*` e `apps/mobile/src/sync/push.ts`).

2. **Endpoint de IA fantasma:** `POST /auditorias/ia/sugestao-nc` não existe na API — é o caso mais grave de divergência funcional de IA. Decidir entre (a) migrar o mobile para `/ia/plano-acao` / `/ia/gerar-texto` / `/ia/analisar-checklist`, ou (b) criar o endpoint na API (menos recomendado — duplica responsabilidade). A opção (a) já garante auditoria de tokens.

3. **Matriz `paridade-plataformas.md` desatualizada em pontos-chave:** marca "Análise de foto por IA" e "Resumo executivo (IA)" como ok/parcial no mobile, mas o código não implementa análise de foto por IA nem busca o resumo executivo. Atualizar a matriz e o changelog após os ajustes.

4. **Pontuação local vs servidor:** o mobile calcula pontuação somando `pontuacao` dos itens (`finalizarLocal`), enquanto a API aplica RN-AUD-008/010 (config de opções/peso). Pode haver divergência numérica — sincronizar a pontuação oficial pós-push (ver AJUSTE).

5. **Isolamento de dados:** está corretamente delegado à API em ambos (web e mobile confiam no filtro por `gestorId`/`consultorId`/vínculo M2M). O pull do mobile herda esse isolamento porque consome os mesmos endpoints autenticados. Sem ação necessária além de garantir o token correto.

6. **Schema mobile à frente da UI:** tabelas `usuarios`, `relatorios_tecnicos`, `relatorio_fotos`, `checkins` existem sem uso — facilitam as NOVAS de RT e Check-in.

7. **Módulos administrativos fora de escopo do app do auditor (confirmar com produto):** CRUD de Usuários, CRUD de Clientes/Unidades/Templates, Planos/Assinaturas (MASTER), Legislação/RAG, Configuração de créditos e Auditoria de Tokens (MASTER), Lista de Espera. Mantidos como **n/a** no mobile salvo decisão em contrário.

8. **Itens marcados "verificar":** filtro de status `ativo` no pull de templates para perfis GESTOR/MASTER; necessidade real de pull de fotos remotas; comportamento esperado do "Salvar" no perfil (web hoje não persiste).

---

*Gerado a partir de leitura direta de `apps/api`, `apps/web`, `apps/mobile` e dos documentos `docs/paridade-plataformas.md` / `docs/regras-de-negocio.md`.*
