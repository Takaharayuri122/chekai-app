# App iOS offline-first — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a consultora faz auditoria completa e check-in/checkout sem internet no iPhone; tudo sobe sozinho por uma fila segura (sem IA, sem duplicar) e o build vai para o TestFlight interno.

**Architecture:** a API ganha idempotência por identificador local, aceita horários do celular e exceções para trabalho iniciado antes de bloqueios. O app passa a salvar foto antes de qualquer espera, só chama IA com internet de fato e ganha uma fila com estados (pendente, falhou), dona (usuária) e retomada. Check-in/checkout viram registros locais enfileirados.

**Tech Stack:** NestJS + TypeORM + Postgres (Supabase migrations), Next.js (web do gestor), Expo/React Native + expo-sqlite (mobile), Jest, xcodebuild.

**Spec:** `docs/superpowers/specs/2026-11-01-ios-offline-first-design.md`

## Global Constraints

- Textos de interface, commits e docs em pt-BR, linguagem natural, sem jargão ("aguardando envio", "enviado", "falha no envio", "sem internet", "sem localização").
- Banco do servidor: só `supabase/migrations/<AAAAMMDDHHMMSS>_<nome>.sql`, idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`), terminando com `NOTIFY pgrst, 'reload schema'`. Entidades TypeORM acompanham.
- Autorização e isolamento na API.
- Mobile: UUID via `gerarUUID()` (`src/utils/uuid.ts`); SQLite local via `SCHEMA_Vn` + `migrations.ts` (próxima: V8).
- Nunca rodar `expo prebuild`. Build pelo `apps/mobile/ios/chekAI.xcworkspace`, scheme `chekAI`.
- FAB de check-in segue oculto em checklist/auditoria/relatórios. Sem `SafeAreaView` com inset superior duplicado.
- IA nunca é chamada pela fila nem sem internet.
- Valores fixos: tolerância de horário futuro **5 min**; tentativas automáticas **5**; tempo limite GPS **4 s**; tempo limite IA **20 s**; checkout automático segue **12 h** (`LIMITE_CHECKOUT_AUTOMATICO_MS`).
- Horários do celular trafegam em ISO 8601 UTC (`toISOString()`).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Wi-Fi conectado sem internet (portal cativo, sinal fraco):** IA não é chamada e nada fica girando; a consultora segue trabalhando. → teste em Task 7 (`temInternet` falso quando `isInternetReachable === false`).
2. **App fechado no meio do envio:** a próxima tentativa continua de onde parou, sem auditoria nem foto duplicada. → teste em Task 10 (remoteId gravado logo após criar; fotos `synced` puladas) e Task 2 (mesmo `localId` devolve a mesma auditoria).
3. **Relógio do celular adiantado:** API recusa com mensagem clara (não 500); app mostra "falha no envio" com o motivo. → teste em Task 4 (dataCheckin > agora + 5 min → 400).
4. **Uma auditoria com falha definitiva não trava as outras da fila.** → teste em Task 11.
5. **Fuso horário:** horário em ISO com `Z` gravado e devolvido sem deslocamento. → teste em Task 2 (dataInicio enviada = dataInicio salva).

---

### Task 1: Destravar testes do mobile (`expo-crypto`)

**Files:**
- Create: `apps/mobile/__mocks__/expo-crypto.js`
- Modify: `apps/mobile/jest.config.js` (projetos `db-unit` e `sync-unit`: `moduleNameMapper` `'^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.js'`)

**Interfaces:**
- Produces: mock com `randomUUID()` (usar `require('crypto').randomUUID`).

- [ ] **Step 1:** Rodar `cd apps/mobile && npx jest src/sync src/db` — Expected: 3 suítes "failed to run" (`expo-crypto` import).
- [ ] **Step 2:** Criar o mock e mapear nos dois projetos.
- [ ] **Step 3:** Rodar de novo — Expected: todas as suítes carregam e passam (corrigir apenas asserções que estavam obsoletas, sem mudar código de produção).
- [ ] **Step 4:** Commit `Destravar testes do mobile que importam expo-crypto`.

---

### Task 2: API — criação de auditoria idempotente, com datas e itens do celular

**Files:**
- Create: `supabase/migrations/20261101120000_offline_auditorias_checkins.sql` (esta task cria a parte de auditorias; Tasks 3 e 4 acrescentam ao mesmo arquivo)
- Modify: `apps/api/src/modules/auditoria/entities/auditoria.entity.ts`
- Modify: `apps/api/src/modules/auditoria/dto/criar-auditoria.dto.ts` (`IniciarAuditoriaDto`, `FinalizarAuditoriaDto`)
- Modify: `apps/api/src/modules/auditoria/auditoria.service.ts` (`iniciarAuditoria`, `finalizarAuditoria`)
- Test: `apps/api/src/modules/auditoria/auditoria.service.offline.spec.ts` (seguir o estilo de `auditoria.service.inativacao.spec.ts`)

**Interfaces:**
- Produces (API):
  - `IniciarAuditoriaDto` + `localId?: string` (`@IsUUID()`), `dataInicio?: string` (`@IsISO8601()`), `templateItemIds?: string[]` (`@IsArray() @IsUUID('all', { each: true })`).
  - `FinalizarAuditoriaDto` + `dataFim?: string` (`@IsISO8601()`).
  - Coluna `auditorias.local_id uuid NULL`, índice único `(consultor_id, local_id) WHERE local_id IS NOT NULL`; entidade `localId: string | null`.
  - Resposta de `POST /auditorias` inalterada (`{ id, itens: [{ id, templateItemId }] , ... }`).

- [ ] **Step 1: Testes que falham**
  - `devolve a auditoria existente quando o mesmo localId é reenviado` — repo `findOne({ where: { consultorId, localId } })` retorna auditoria → `iniciarAuditoria` não chama `save` e devolve a mesma.
  - `usa dataInicio do celular` — dto `dataInicio: '2026-11-01T13:05:00.000Z'` → `create` recebe `dataInicio` igual a `new Date('2026-11-01T13:05:00.000Z')` (mesmo `getTime()`).
  - `cria itens a partir de templateItemIds do celular` — template com itens A(ativo), B(inativo), C(ativo); dto `templateItemIds: [A, B]` → itens criados para A e B; C não.
  - `ignora templateItemIds de outro template` — id desconhecido no dto → `BadRequestException`.
  - `finalizar com dataFim usa o horário do celular` e `finalizar repetido com dataFim devolve a auditoria sem erro` (status já `FINALIZADA` + `dto.dataFim` → retorna sem `save`).
- [ ] **Step 2:** `cd apps/api && npx jest auditoria.service.offline` — Expected: FAIL.
- [ ] **Step 3:** Migration (bloco `auditorias`) + entidade + DTOs + service. Sem `templateItemIds`, comportamento atual (itens ativos). Sem `dataFim`, `new Date()` e "Auditoria já finalizada" como hoje.
- [ ] **Step 4:** `npx jest` (suíte inteira) e `npx tsc --noEmit -p tsconfig.json` — Expected: PASS.
- [ ] **Step 5:** Commit `Criar auditoria idempotente com datas e itens do celular`.

---

### Task 3: API — aceitar trabalho iniciado antes de bloqueios

**Files:**
- Modify: `supabase/migrations/20261101120000_offline_auditorias_checkins.sql` (blocos: `clientes.inativado_em`, `unidades.inativado_em` timestamp NULL; tabela `cliente_auditor_desvinculos (id uuid pk default gen_random_uuid(), cliente_id uuid not null, auditor_id uuid not null, desvinculado_em timestamp not null default now())` + índice `(cliente_id, auditor_id)`)
- Create: `apps/api/src/modules/cliente/entities/cliente-auditor-desvinculo.entity.ts`
- Modify: `apps/api/src/modules/cliente/entities/cliente.entity.ts`, `unidade.entity.ts` (`inativadoEm: Date | null`, coluna `inativado_em`)
- Modify: `apps/api/src/modules/cliente/cliente.service.ts` (`definirAtivoCliente`/`definirAtivoUnidade` gravam/limpam `inativadoEm`; `atualizarCliente` registra desvínculos dos auditores removidos)
- Modify: `apps/api/src/modules/plano/validacao-limites.service.ts`, `apps/api/src/modules/plano/assinatura.service.ts`
- Modify: `apps/api/src/modules/auditoria/auditoria.service.ts` (`validarUnidadeParaNovaAuditoria`)
- Test: `apps/api/src/modules/auditoria/auditoria.service.offline.spec.ts`, `apps/api/src/modules/cliente/cliente.service.inativacao.spec.ts`, `apps/api/src/modules/plano/validacao-limites.service.spec.ts` (criar se não existir)

**Interfaces:**
- Consumes: `IniciarAuditoriaDto.dataInicio` (Task 2).
- Produces:
  - `ValidacaoLimitesService.validarLimiteAuditorias(gestorId: string, momento?: Date): Promise<void>` — com `momento`: assinatura vigente em `momento` (via `AssinaturaService.buscarAssinaturaVigenteEm(gestorId: string, momento: Date): Promise<Assinatura | null>`: `dataInicio <= momento` e (`dataFim` nulo ou `>= momento`), status `ATIVA` ou `EXPIRADA`) e uso = auditorias do gestor com `dataInicio < momento`.
  - `validarUnidadeParaNovaAuditoria(unidadeId, usuario?, momento?: Date)` — com `momento`: cliente/unidade inativos são aceitos se `inativadoEm > momento`; auditor não vinculado é aceito se houver desvínculo com `desvinculadoEm > momento`.
  - `iniciarAuditoria` passa `momento = dto.dataInicio` só quando `dto.localId` e `dto.dataInicio` vêm juntos (fluxo offline).

- [ ] **Step 1: Testes que falham**
  - `aceita unidade inativada depois do início offline` (inativadoEm 10:00, dataInicio 09:00) e `recusa unidade inativada antes do início` (inativadoEm 08:00) → `BadRequestException` com a mensagem atual.
  - Mesmo par para cliente inativo e para auditor desvinculado (`ForbiddenException` quando desvínculo anterior ou inexistente).
  - `definirAtivoCliente(false)` grava `inativadoEm`; `definirAtivoCliente(true)` limpa para `null`.
  - `atualizarCliente` que remove auditor salva um `ClienteAuditorDesvinculo` para cada removido.
  - Limites: `aceita auditoria offline iniciada quando o limite ainda não estava atingido` (limite 10, 9 auditorias com dataInicio < momento) e `recusa quando já estava atingido no momento`; `aceita com assinatura vencida depois do momento`.
- [ ] **Step 2:** Rodar os três specs — Expected: FAIL.
- [ ] **Step 3:** Implementar. Sem `momento`, regras atuais intactas.
- [ ] **Step 4:** Suíte inteira + `tsc` — Expected: PASS.
- [ ] **Step 5:** Atualizar `docs/regras-de-negocio.md`: nova RN-AUD (aceite de auditoria offline iniciada antes de bloqueio) e changelog.
- [ ] **Step 6:** Commit `Aceitar auditoria offline iniciada antes de bloqueios`.

---

### Task 4: API — check-in e checkout offline

**Files:**
- Modify: `supabase/migrations/20261101120000_offline_auditorias_checkins.sql` (bloco `checkins`: `local_id uuid NULL` + índice único parcial; `checkin_offline boolean not null default false`; `checkin_sincronizado_em timestamp NULL`; `checkout_offline boolean not null default false`; `checkout_sincronizado_em timestamp NULL`; `latitude_checkin`/`longitude_checkin` `DROP NOT NULL`)
- Modify: `apps/api/src/modules/checkin/entities/checkin.entity.ts`, `dto/iniciar-checkin.dto.ts`, `dto/finalizar-checkin.dto.ts`, `checkin.service.ts`
- Test: `apps/api/src/modules/checkin/checkin.service.offline.spec.ts` (estilo de `checkin.service.spec.ts`)

**Interfaces:**
- Produces (API):
  - `IniciarCheckinDto`: `latitude?`, `longitude?` (`@IsOptional()`), `localId?: string` (`@IsUUID()`), `dataCheckin?: string` (`@IsISO8601()`), `offline?: boolean`.
  - `FinalizarCheckinDto`: `latitude?`, `longitude?` opcionais, `dataCheckout?: string`, `offline?: boolean`.
  - Entidade: `localId`, `checkinOffline`, `checkinSincronizadoEm`, `checkoutOffline`, `checkoutSincronizadoEm`; `latitudeCheckin: number | null`, `longitudeCheckin: number | null`.
  - `ItemRelatorioHorasCheckin` + `quantidadeOffline: number` (check-ins com `checkinOffline || checkoutOffline`).
  - Conflitos respondem `409 ConflictException` com mensagem pt-BR.

- [ ] **Step 1: Testes que falham**
  - `check-in offline usa o horário do celular e marca offline` → `dataCheckin` = dto, `checkinOffline = true`, `checkinSincronizadoEm` = agora.
  - `check-in offline repetido com o mesmo localId devolve o mesmo registro`.
  - `recusa horário do celular mais de 5 min no futuro` → `BadRequestException('O horário informado está no futuro. Verifique o relógio do celular.')`.
  - `check-in sem localização é aceito` (latitude/longitude ausentes → `null`).
  - `check-in offline com outro aberto → 409`.
  - `check-in offline em unidade inativada depois da marcação é aceito` (`inativadoEm` > `dataCheckin`, Task 3).
  - `checkout offline substitui o encerramento automático quando é anterior a ele` → `dataCheckout` = dto, `encerradoAutomaticamente = false`, `checkoutOffline = true`.
  - `checkout offline posterior ao encerramento automático mantém o automático` (retorna registro sem alterar).
  - `checkout offline em check-in encerrado pelo gestor → 409 'Este check-in já foi encerrado pelo gestor.'`.
  - `checkout offline repetido (mesmo dataCheckout) devolve sem erro`.
  - `checkout antes do check-in → BadRequestException` (mensagem atual de edição).
  - `relatório de horas conta quantidadeOffline`.
- [ ] **Step 2:** `npx jest checkin.service.offline` — Expected: FAIL.
- [ ] **Step 3:** Implementar. "Encerrado pelo gestor" = `status FECHADO && !encerradoAutomaticamente && !checkoutOffline`. Encerramento automático com localização nula mantém nula. Online (sem `offline`), comportamento atual.
- [ ] **Step 4:** Suíte inteira + `tsc` — Expected: PASS.
- [ ] **Step 5:** `docs/regras-de-negocio.md`: RN-CKI-007 (localização opcional quando o GPS não responder), nova RN-CKI de marcação offline (horário do celular, marcação offline, horário de sincronização, conflitos) e changelog.
- [ ] **Step 6:** Commit `Aceitar check-in e checkout offline`.

---

### Task 5: Web do gestor — exibir marcação offline

**Files:**
- Modify: `apps/web/src/lib/services/checkin.service.ts` (`CheckinRegistro` + `checkinOffline`, `checkinSincronizadoEm`, `checkoutOffline`, `checkoutSincronizadoEm`; `latitudeCheckin: number | null`, `longitudeCheckin: number | null`; item do relatório + `quantidadeOffline`)
- Modify: `apps/web/src/app/admin/checkins/page.tsx` (coluna Início/Fim: selo "Offline" e, abaixo, "Enviado às dd/mm HH:mm"; detalhe: mesmas informações e "Sem localização" quando coordenadas nulas, sem marcador no mapa)
- Modify: `apps/web/src/app/admin/checkins/relatorio/page.tsx` e `apps/api/src/modules/checkin/checkin-relatorio-html.ts` (coluna "Offline" com `quantidadeOffline`)
- Test: `apps/api/src/modules/checkin/checkin-relatorio-html.spec.ts` (nova asserção da coluna)

- [ ] **Step 1:** Teste `inclui a quantidade de marcações offline` no spec do HTML — FAIL.
- [ ] **Step 2:** Implementar API do HTML; rodar spec — PASS.
- [ ] **Step 3:** Web (tipos + telas). Selo no padrão visual do selo "Inativo" de clientes.
- [ ] **Step 4:** `cd apps/web && npx tsc --noEmit -p .` — Expected: sem erros.
- [ ] **Step 5:** Commit `Mostrar marcações offline de check-in para o gestor`.

---

### Task 6: Mobile — foto nunca espera o GPS

**Files:**
- Create: `apps/mobile/src/utils/tempo-limite.ts`, `apps/mobile/src/utils/localizacao.ts`
- Modify: `apps/mobile/src/utils/foto-picker.ts`, `apps/mobile/app/(app)/auditorias/nova-template.tsx`, `apps/mobile/src/hooks/use-geolocalizacao.ts`
- Test: `apps/mobile/src/sync/__tests__/tempo-limite.test.ts` (roda no projeto `sync-unit`)

**Interfaces:**
- Produces:
  - `class TempoLimiteError extends Error`; `comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T>` (rejeita com `TempoLimiteError`).
  - `obterLocalizacaoRapida(ms = 4000): Promise<LatLng | undefined>` — permissão já concedida → `getLastKnownPositionAsync({ maxAge: 300000 })`; senão `getCurrentPositionAsync({ accuracy: Balanced })` com `comTempoLimite`; qualquer falha → `undefined`. Nunca pede permissão (quem pede é o onboarding/hook).

- [ ] **Step 1:** Testes: `resolve antes do limite`, `rejeita com TempoLimiteError ao estourar` (jest fake timers) — FAIL.
- [ ] **Step 2:** Implementar `tempo-limite.ts` — PASS.
- [ ] **Step 3:** `foto-picker.processarAssets`: comprimir e salvar cada foto **antes**; obter localização com `obterLocalizacaoRapida()` em paralelo (`Promise.all` com a compressão) e anexar se veio. `nova-template.tsx` e `use-geolocalizacao.ts` usam a mesma função (o hook mantém pedido de permissão e estados).
- [ ] **Step 4:** `npx tsc --noEmit -p .` sem erros novos (comparar contagem com a base: 96).
- [ ] **Step 5:** Commit `Salvar foto sem esperar o GPS`.

---

### Task 7: Mobile — IA só com internet de fato

**Files:**
- Create: `apps/mobile/src/utils/conexao.ts`
- Modify: `apps/mobile/src/api/ia.api.ts` (`analisarImagemChecklist` com `FileSystem.createUploadTask` + `cancelAsync` em 20 s; `getSugestaoIa` envolvida em `comTempoLimite(…, 20000)`)
- Modify: `apps/mobile/src/components/auditoria/FotoGrid.tsx`, `ItemDetailSheet.tsx`, `SwipeCard.tsx`, `apps/mobile/app/(app)/auditorias/[id]/item/[itemId].tsx`
- Test: `apps/mobile/src/sync/__tests__/conexao.test.ts`

**Interfaces:**
- Produces: `temInternet(): Promise<boolean>` — `NetInfo.fetch()`; `true` só se `isConnected` e `isInternetReachable !== false`.

- [ ] **Step 1:** Testes: `falso sem conexão`, `falso com rede conectada e isInternetReachable false`, `verdadeiro com isInternetReachable null` (iOS ainda medindo) — FAIL.
- [ ] **Step 2:** Implementar — PASS.
- [ ] **Step 3:** `FotoGrid`: antes de analisar, `if (!(await temInternet()))` → não analisa, **não** marca a foto como tentada (pode analisar se reabrir online durante a auditoria) e mostra abaixo do grid "Análise das fotos disponível apenas com internet." Os três pontos que chamam `getSugestaoIa` fazem a mesma checagem e mostram "Sugestão automática disponível apenas com internet." no lugar do carregamento. Estouro de tempo = falha silenciosa como hoje (sem alerta).
- [ ] **Step 4:** `tsc` sem erros novos.
- [ ] **Step 5:** Commit `Chamar IA apenas com internet e com tempo limite`.

---

### Task 8: Mobile — banco local V8 e repositório da fila

**Files:**
- Modify: `apps/mobile/src/db/schema.ts` (`SCHEMA_VERSION = 8`, `SCHEMA_V8`), `apps/mobile/src/db/migrations.ts`
- Create: `apps/mobile/src/db/repositories/fila.repo.ts`
- Test: `apps/mobile/src/db/__tests__/migrations.test.ts`, `apps/mobile/src/db/__tests__/fila.repo.test.ts`

**Interfaces:**
- Produces:
  - `SCHEMA_V8`: `sync_queue` + `usuario_id TEXT`, `status TEXT NOT NULL DEFAULT 'pendente'`, `ultimo_erro TEXT`, `atualizado_em TEXT`; recria `checkins` (cache sem dados offline até aqui) com `latitude_checkin`/`longitude_checkin` anuláveis e colunas `local_id TEXT`, `checkin_offline INTEGER NOT NULL DEFAULT 0`, `checkin_sincronizado_em TEXT`, `checkout_offline INTEGER NOT NULL DEFAULT 0`, `checkout_sincronizado_em TEXT`, `envio_status TEXT` (`'pendente' | 'enviado' | 'recusado'` ou nulo para registros vindos do servidor), `envio_erro TEXT`.
  - `type EntidadeFila = 'auditoria' | 'relatorio_tecnico' | 'checkin'`; `type StatusFila = 'pendente' | 'falhou'`.
  - `class FilaRepo`:
    - `enfileirar(entidade: EntidadeFila, localId: string, usuarioId: string): void` — não duplica `(entidade, localId)` ainda na fila; se existir com `falhou`, volta a `pendente`.
    - `listarParaEnvio(usuarioId: string): ItemFila[]` — `status = 'pendente'` e (`usuario_id = ?` ou `usuario_id IS NULL`), por `created_at`.
    - `registrarFalha(id: string, erro: string, definitiva: boolean): void` — incrementa `retries`; `falhou` se definitiva ou `retries >= 5`.
    - `remover(id: string): void`; `tentarDeNovo(entidade, localId): void` (zera `retries`, `pendente`).
    - `estado(entidade, localId): { status: StatusFila; ultimoErro: string | null } | null`.
    - `contarPendentes(usuarioId: string, entidade?: EntidadeFila): number` (pendente + falhou).
  - `ItemFila = { id: string; entidade: EntidadeFila; localId: string; retries: number }`.

- [ ] **Step 1:** Testes da migração V8 (statements esperados, `PRAGMA user_version = 8`; "skips" atualizado para 8) e do repo (cada método acima, incluindo `falhou` na 5ª falha e filtro por usuária) — FAIL.
- [ ] **Step 2:** Implementar — PASS (`npx jest src/db`).
- [ ] **Step 3:** Commit `Criar fila com estados e dona no banco local`.

---

### Task 9: Mobile — primeira sincronização obrigatória

**Files:**
- Modify: `apps/mobile/src/sync/pull.ts` (export `jaSincronizouAlgumaVez(): boolean` — existe linha em `sync_meta` para `'clientes'`)
- Modify: `apps/mobile/app/(app)/auditorias/nova.tsx`
- Test: `apps/mobile/src/sync/__tests__/primeira-sincronizacao.test.ts`

- [ ] **Step 1:** Testes `falso sem registro em sync_meta`, `verdadeiro com registro` — FAIL.
- [ ] **Step 2:** Implementar — PASS.
- [ ] **Step 3:** `nova.tsx`: se `false`, mostrar no lugar da lista "Conecte-se à internet uma vez para baixar clientes e checklists. Depois disso, as auditorias funcionam sem internet." (sem botão novo; puxar para atualizar já sincroniza na lista de auditorias).
- [ ] **Step 4:** Commit `Exigir uma primeira sincronização antes de auditar sem internet`.

---

### Task 10: Mobile — envio de auditoria retomável

**Files:**
- Modify: `apps/mobile/src/api/auditoria.api.ts` (`createAuditoria` envia `localId`, `dataInicio`, `templateItemIds`; `finalizarAuditoria` aceita `dataFim`; `uploadFoto` lança `ApiError` com status em resposta ≥ 400)
- Modify: `apps/mobile/src/db/repositories/auditoria.repo.ts` (`setRemoteId(id: string, remoteId: string): void`)
- Modify: `apps/mobile/src/sync/push.ts` (`pushAuditoria`)
- Test: `apps/mobile/src/sync/__tests__/push.test.ts`

**Interfaces:**
- Consumes: API das Tasks 2–3.
- Produces: `pushAuditoria(localId, onProgress?)` com a mesma assinatura; lança erro se alguma foto falhar (a auditoria **não** é finalizada no servidor nesse caso).

- [ ] **Step 1: Testes que falham**
  - `envia localId, dataInicio e os templateItemIds dos itens locais`.
  - `grava o remoteId logo após criar, antes de enviar itens` (ordem das chamadas).
  - `pula fotos já enviadas` (foto com `syncStatus 'synced'` não chama `uploadFoto`).
  - `não finaliza quando uma foto falha` (uploadFoto rejeita → `finalizarAuditoria` não é chamado e `pushAuditoria` rejeita).
  - `finaliza com dataFim local`.
  - `nunca chama a IA` (`ia.api` mockado; nenhuma função chamada).
- [ ] **Step 2:** `npx jest src/sync/__tests__/push.test.ts` — FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS + `tsc` sem erros novos.
- [ ] **Step 5:** Commit `Retomar envio de auditoria sem duplicar`.

---

### Task 11: Mobile — fila com estados, dona e tentativa manual

**Files:**
- Create: `apps/mobile/src/sync/erros.ts`
- Modify: `apps/mobile/src/sync/push.ts` (`pushPending`, `enqueuePush`, `enqueueRelatorioPush`, `getPendingCount`, `getPendingRelatoriosCount` passam a usar `FilaRepo`; recebem/obtêm `usuarioId` de `useAuthStore`)
- Modify: `apps/mobile/app/(app)/auditorias/index.tsx`, `apps/mobile/app/(app)/auditorias/[id]/resumo.tsx`, `apps/mobile/app/(app)/relatorios/index.tsx`, `apps/mobile/src/components/auditoria/AuditoriaStatusBadge.tsx`
- Test: `apps/mobile/src/sync/__tests__/push.test.ts`, `apps/mobile/src/sync/__tests__/erros.test.ts`

**Interfaces:**
- Consumes: `FilaRepo` (Task 8), `pushAuditoria` (Task 10), `pushCheckin` (Task 12 — até lá, a entidade `checkin` é ignorada).
- Produces:
  - `ehFalhaDefinitiva(e: unknown): boolean` — `ApiError` com status 400–499 exceto 401, 408, 429.
  - `ehSessaoExpirada(e: unknown): boolean` — `ApiError` 401.
  - `pushPending(): Promise<void>` — só itens da usuária logada; sucesso remove; falha `registrarFalha(id, mensagem, ehFalhaDefinitiva(e))`; 401 interrompe o laço sem contar tentativa.
  - `tentarEnviarDeNovo(entidade: EntidadeFila, localId: string): Promise<void>` — `FilaRepo.tentarDeNovo` + `SyncService.sync()`.

- [ ] **Step 1: Testes que falham**
  - `ehFalhaDefinitiva`: 400/403/404/409 true; 401/408/429/500/erro de rede false.
  - `falha definitiva na primeira auditoria não impede a segunda` (Review Focus 4).
  - `não envia itens de outra usuária`.
  - `401 interrompe sem incrementar tentativas`.
- [ ] **Step 2:** FAIL → implementar → PASS (`npx jest src/sync`).
- [ ] **Step 3:** UI: badge com "Aguardando envio" (pendente) e "Falha no envio" (falhou, cor de erro); ao tocar numa auditoria com falha, mostrar `ultimoErro` e botão "Tentar de novo" (`tentarEnviarDeNovo`). `resumo.tsx`: finalizar offline usa `enqueuePush` como hoje. Mesmo tratamento na lista de relatórios técnicos.
- [ ] **Step 4:** `tsc` sem erros novos.
- [ ] **Step 5:** Commit `Mostrar estado de envio e permitir nova tentativa`.

---

### Task 12: Mobile — check-in e checkout offline

**Files:**
- Modify: `apps/mobile/src/db/repositories/checkin.repo.ts` (campos novos da V8; `salvarOffline(input)`, `registrarCheckoutOffline(localId, dataCheckout, coords?)`, `marcarEnviado(localId, etapa: 'checkin' | 'checkout', remoteId?, sincronizadoEm)`, `marcarRecusado(localId, erro)`, `descartar(localId)`, `listarRecentesOffline(usuarioId, dias = 7)`)
- Modify: `apps/mobile/src/api/checkin.api.ts` (payloads com `localId`, `dataCheckin`/`dataCheckout`, `offline`, lat/lng opcionais)
- Create: `apps/mobile/src/sync/push-checkin.ts`
- Modify: `apps/mobile/src/store/checkin.ts`, `apps/mobile/src/sync/push.ts` (despacho da entidade `checkin`), `apps/mobile/src/sync/pull.ts` (`pullCheckinAberto` não sobrescreve registro local com `envio_status = 'pendente'`)
- Modify: `apps/mobile/src/components/checkin/CheckinModal.tsx`, `CheckinFab.tsx`, `CheckinCard.tsx`; Create: `apps/mobile/src/components/checkin/CheckinOfflineLista.tsx` (usada em `app/(app)/index.tsx`)
- Test: `apps/mobile/src/sync/__tests__/push-checkin.test.ts`, `apps/mobile/src/db/__tests__/checkin.repo.test.ts`

**Interfaces:**
- Consumes: API da Task 4, `FilaRepo` (Task 8), `temInternet` (Task 7), `obterLocalizacaoRapida` (Task 6).
- Produces: `pushCheckin(localId: string): Promise<void>` — sem `remoteId`: `iniciarCheckin({ …, localId, dataCheckin, offline: true })`, `marcarEnviado('checkin')`; com checkout local não enviado: `finalizarCheckin(remoteId, { dataCheckout, offline: true, lat?, lng? })`, `marcarEnviado('checkout')`. `ApiError` 409 → `marcarRecusado` e relança como definitiva.

- [ ] **Step 1: Testes que falham**
  - `envia check-in e checkout offline na ordem`.
  - `não reenvia check-in já enviado; só o checkout`.
  - `409 marca recusado com a mensagem do servidor`.
  - `envia sem localização quando não há coordenadas`.
  - repo: `salvarOffline` + `listarRecentesOffline`; `descartar` remove o registro e o item da fila.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Store: `iniciar`/`finalizar` usam a API como hoje se `temInternet()`; sem internet ou erro de rede (não `ApiError`), gravam offline com `new Date().toISOString()` e `FilaRepo.enfileirar('checkin', localId, usuarioId)`.
- [ ] **Step 4:** UI: o modal tenta a localização (4 s); sem ela, o botão continua habilitado com o aviso "Sem localização — a marcação será registrada assim mesmo." O card do check-in aberto mostra "Feito às HH:mm" e "Aguardando envio" ou "Enviado às HH:mm". `CheckinOfflineLista` (home) lista as marcações offline dos últimos 7 dias com os mesmos dados; recusadas mostram o motivo e "Descartar" (com `Alert` de confirmação).
- [ ] **Step 5:** `tsc` sem erros novos; atualizar `docs/paridade-plataformas.md` (offline no app: auditoria, fila, check-in) e o comentário do topo de `checkin.repo.ts` (deixa de ser "online-only").
- [ ] **Step 6:** Commit `Permitir check-in e checkout sem internet no app`.

---

### Task 13: Mobile — sair da conta com envios pendentes

**Files:**
- Modify: `apps/mobile/app/(app)/perfil.tsx`

- [ ] **Step 1:** Antes de `AuthService.logout()`, se `new FilaRepo().contarPendentes(user.id) > 0`, `Alert` com "Há N envio(s) pendente(s) neste aparelho. Eles ficam guardados e serão enviados quando você entrar de novo." e botões "Cancelar" / "Sair mesmo assim". Nada é apagado.
- [ ] **Step 2:** `tsc` sem erros novos.
- [ ] **Step 3:** Commit `Avisar envios pendentes ao sair da conta`.

---

### Task 14: Integração e publicação da API

- [ ] **Step 1:** `cd apps/api && npx jest && npx tsc --noEmit -p tsconfig.json`; `cd apps/web && npx tsc --noEmit -p .`; `cd apps/mobile && npx jest src/db src/sync` — Expected: tudo PASS (mobile `tsc` sem erros além dos 96 da base).
- [ ] **Step 2:** Push da branch `feat/ios-offline-first` e PR para `master` (título "App iOS sem internet: auditoria, fila e check-in offline"), com resumo, migrations e checklist de teste manual.
- [ ] **Step 3:** **Parar e pedir ao usuário o merge.** Depois, confirmar que a API nova está no ar: `curl -s https://api.chekai.com.br/api/docs-json | grep -c dataCheckin` > 0; se o Swagger não estiver público, perguntar ao usuário se o deploy e a migration rodaram.

---

### Task 15: Build e envio ao TestFlight

**Files:**
- Modify: `apps/mobile/ios/chekAI/Info.plist` (`CFBundleVersion` 4 → 5)
- Create (fora do repo): `<scratchpad>/ExportOptions.plist` — `method` = `app-store-connect`, `destination` = `upload`, `teamID` = `35W4YR6DBH`, `signingStyle` = `automatic`

- [ ] **Step 1:** `cd apps/mobile/ios && pod install` (se falhar pelo Ruby do sistema, usar o Ruby do Homebrew).
- [ ] **Step 2:** Archive:
```bash
xcodebuild -workspace chekAI.xcworkspace -scheme chekAI -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$SCRATCH/chekAI.xcarchive" archive \
  -allowProvisioningUpdates \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_N4WG586FF5.p8 \
  -authenticationKeyID N4WG586FF5 \
  -authenticationKeyIssuerID 3db46331-2e7b-40c8-9083-91cdd793ca1e
```
Expected: `** ARCHIVE SUCCEEDED **`.
- [ ] **Step 3:** Exportar e enviar: `xcodebuild -exportArchive -archivePath "$SCRATCH/chekAI.xcarchive" -exportOptionsPlist "$SCRATCH/ExportOptions.plist" -exportPath "$SCRATCH/export"` + os mesmos parâmetros de autenticação — Expected: `** EXPORT SUCCEEDED **` e upload concluído.
- [ ] **Step 4:** Commit `Incrementar build do iOS para 5` e push.
- [ ] **Step 5:** Informar ao usuário: build 5 em processamento na App Store Connect (≈ 10–30 min) e roteiro de teste manual (modo avião: auditoria com fotos, check-in/checkout; religar a rede; conferir no web o selo "Offline" e os dois horários).
