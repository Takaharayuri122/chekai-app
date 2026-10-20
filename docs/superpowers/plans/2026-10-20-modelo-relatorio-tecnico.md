# Modelo personalizável do Relatório Técnico — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** permitir que o gestor (com plano que inclua o recurso) ligue/desligue e renomeie as seções do relatório técnico. O modelo é aplicado no formulário web/mobile, no PDF, na validação de finalização e no apoio analítico, e fica congelado no relatório quando ele é finalizado.

**Architecture:** um módulo puro `modelo-secoes` (constantes + mescla + validação) existe em cada app: API, web e mobile. São cópias idênticas, porque `@meta-app/shared` só é consumido pelo mobile e o build do Nest não compila pacotes `.ts` externos. A API ganha a tabela `modelos_relatorio_tecnico` (1 por gestor), a coluna de snapshot `relatorios_tecnicos.modelo_secoes` e a flag `planos.permite_modelo_relatorio_tecnico`. Um `ModeloRelatorioTecnicoService` resolve o dono e a permissão do plano. Web e mobile apenas consomem o modelo efetivo.

**Tech Stack:** NestJS + TypeORM + Postgres (jest), Next.js + shadcn/ui (vitest), Expo + expo-sqlite + react-native-mmkv (jest-expo).

**Spec:** `docs/superpowers/specs/2026-10-20-modelo-relatorio-tecnico-design.md`

## Global Constraints

- Commits e mensagens de UI em pt-BR. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mudança de schema no Postgres **só por script SQL em `scripts/`** (sem migration TypeORM), idempotente (`IF NOT EXISTS`).
- Ordem fixa das seções: identificacao, descricaoOcorrencia, evidenciasFotograficas, avaliacaoTecnica, acoesExecutadas, recomendacoesConsultora, planoAcaoSugerido, apoioAnalitico, assinaturas. Só as 7 do meio são configuráveis.
- Títulos padrão (exatos): "Descrição da Ocorrência", "Evidências Fotográficas", "Avaliação Técnica", "Ações Executadas na Visita", "Recomendações da Consultora", "Plano de Ação Sugerido", "Apoio Analítico ChekAi".
- Título: `trim`, ≤ 60 caracteres, sem `<` nem `>`. Título vazio significa "usar o padrão".
- Seções de conteúdo (pelo menos uma ativa): descricaoOcorrencia, avaliacaoTecnica, acoesExecutadas, recomendacoesConsultora, planoAcaoSugerido.
- Sem configuração, ou sem o recurso no plano, o comportamento é **idêntico ao atual**.
- Isolamento e permissão aplicados na API. Web: shadcn/ui + tokens, sem classes DaisyUI novas (o teste `apps/web/src/guarda/sem-daisyui.test.ts` deve continuar passando), tooltips nas ações e `ConfirmDialog` para restaurar padrão.
- IA: manter validação de saldo/auditoria de tokens existente em `IaService` (`.cursor/rules/auditoria-tokens.mdc`).

## Review Focus

1. **Push do mobile reenvia `status: 'finalizado'` em todo sync.** O snapshot não pode ser refeito: um relatório finalizado com o modelo A e reenviado depois que o gestor trocou para B mantém A (teste no Task 4).
2. **Salvar a entidade carregada não pode gravar o modelo efetivo no snapshot.** `atualizarApoioAnalitico` e `atualizar` fazem `save(relatorio)`, então o modelo efetivo vai numa propriedade de resposta (`modeloEfetivo`), nunca em `modeloSecoes` de um rascunho (teste no Task 4).
3. **Gestor perde o recurso do plano depois de configurar.** Os rascunhos voltam ao padrão, mas o registro continua no banco (teste no Task 3).
4. **Título com HTML/script ou muito longo.** É rejeitado no `PUT /modelo` e escapado no PDF (testes nos Tasks 1 e 5).
5. **Usuário troca de conta no mesmo aparelho.** O cache do modelo no mobile é chaveado por `userId`, então a conta B não herda o modelo da conta A (teste no Task 9).

As três cópias de `modelo-secoes` precisam ficar iguais. O Task 6 e o Task 9 copiam o arquivo do Task 1 e os mesmos testes.

---

### Task 1: Módulo puro `modelo-secoes` (API)

**Files:**
- Create: `apps/api/src/modules/relatorio-tecnico/modelo-secoes.ts`
- Test: `apps/api/src/modules/relatorio-tecnico/modelo-secoes.spec.ts`

**Interfaces — Produces:**
```ts
export type SecaoConfiguravel = 'descricaoOcorrencia' | 'evidenciasFotograficas' | 'avaliacaoTecnica'
  | 'acoesExecutadas' | 'recomendacoesConsultora' | 'planoAcaoSugerido' | 'apoioAnalitico';
export interface ModeloSecao { secao: SecaoConfiguravel; ativa: boolean; titulo: string }
export const SECOES_CONFIGURAVEIS: ReadonlyArray<{ secao: SecaoConfiguravel; tituloPadrao: string }>; // ordem fixa
export const SECOES_CONTEUDO: ReadonlyArray<SecaoConfiguravel>;
export function modeloPadrao(): ModeloSecao[];
export function mesclarComPadrao(salvas: ModeloSecao[] | null | undefined): ModeloSecao[]; // sempre 7, ordem fixa, chaves desconhecidas ignoradas, título vazio → padrão
export function validarModelo(secoes: unknown): string | null; // mensagem pt-BR ou null
export function secaoAtiva(modelo: ModeloSecao[], secao: SecaoConfiguravel): boolean;
export function tituloSecao(modelo: ModeloSecao[], secao: SecaoConfiguravel): string;
```

- [ ] **Step 1: Escrever os testes**
  - `modeloPadrao()` devolve 7 itens na ordem fixa, todos `ativa: true` e com os títulos padrão exatos.
  - `mesclarComPadrao(null)` é igual a `modeloPadrao()`. `mesclarComPadrao([{ secao: 'avaliacaoTecnica', ativa: false, titulo: '' }])` dá avaliacaoTecnica inativa com título "Avaliação Técnica" e o resto padrão. Uma chave `'xpto'` é ignorada.
  - `validarModelo` retorna `null` para o padrão.
  - `validarModelo` retorna mensagem quando:
    - todas as 5 de conteúdo estão inativas (mesmo com evidencias e apoio ativas);
    - o título tem 61 caracteres;
    - o título contém `<b>`;
    - a seção está duplicada;
    - a seção é desconhecida;
    - a entrada não é um array.
  - `tituloSecao` com título `'  Retorno do Cliente  '` devolve `'Retorno do Cliente'`.
- [ ] **Step 2:** `cd apps/api && npx jest src/modules/relatorio-tecnico/modelo-secoes.spec.ts`. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `modelo-secoes.ts` com as assinaturas acima.
- [ ] **Step 4:** Rodar de novo. Esperado: PASS.
- [ ] **Step 5:** Commit: `Adicionar módulo de seções do modelo de relatório técnico na API`.

### Task 2: Schema, entidades e flag do plano

**Files:**
- Create: `scripts/criar-modelo-relatorio-tecnico.sql`
- Create: `apps/api/src/modules/relatorio-tecnico/entities/modelo-relatorio-tecnico.entity.ts`
- Modify: `apps/api/src/modules/relatorio-tecnico/entities/relatorio-tecnico.entity.ts`
- Modify: `apps/api/src/modules/plano/entities/plano.entity.ts`, `apps/api/src/modules/plano/dto/criar-plano.dto.ts`
- Modify: `apps/api/src/modules/relatorio-tecnico/dto/criar-relatorio-tecnico.dto.ts`

**Interfaces — Produces:**
- Entidade `ModeloRelatorioTecnico` (`modelos_relatorio_tecnico`): `id uuid`, `gestorId` (`gestor_id`, unique), `secoes: ModeloSecao[]` (jsonb), `criadoEm`, `atualizadoEm`.
- `RelatorioTecnico.modeloSecoes: ModeloSecao[] | null` (coluna `modelo_secoes` jsonb nullable).
- `Plano.permiteModeloRelatorioTecnico: boolean` (coluna `permite_modelo_relatorio_tecnico`, default false). `CriarPlanoDto.permiteModeloRelatorioTecnico?: boolean` (`@IsBoolean @IsOptional`).
- `CriarRelatorioTecnicoDto`: `descricaoOcorrenciaHtml`, `avaliacaoTecnicaHtml`, `recomendacoesConsultoraHtml`, `planoAcaoSugeridoHtml` e `acoesExecutadas` passam a `@IsOptional()` (mantém `@IsString`/`@IsArray`). `identificacao` continua `@IsNotEmpty`. **Não** adicionar `modeloSecoes` ao DTO: o cliente nunca envia modelo.

- [ ] **Step 1:** Escrever o script SQL com:
  - `CREATE TABLE IF NOT EXISTS modelos_relatorio_tecnico` com FK `gestor_id → usuarios(id) ON DELETE CASCADE` e `UNIQUE(gestor_id)`;
  - `ALTER TABLE relatorios_tecnicos ADD COLUMN IF NOT EXISTS modelo_secoes JSONB`;
  - `ALTER TABLE planos ADD COLUMN IF NOT EXISTS permite_modelo_relatorio_tecnico BOOLEAN NOT NULL DEFAULT false`.

  Seguir o estilo de `scripts/criar-tabelas-relatorio-tecnico.sql`.
- [ ] **Step 2:** Criar e alterar as entidades e DTOs acima. Registrar `ModeloRelatorioTecnico` no `TypeOrmModule.forFeature` do `RelatorioTecnicoModule`.
- [ ] **Step 3:** `cd apps/api && npx tsc --noEmit -p tsconfig.json`. Esperado: sem erros.
- [ ] **Step 4:** Commit: `Adicionar schema do modelo de relatório técnico e flag no plano`.

### Task 3: `ModeloRelatorioTecnicoService` + endpoints `/modelo`

**Files:**
- Create: `apps/api/src/modules/relatorio-tecnico/modelo-relatorio-tecnico.service.ts`
- Create: `apps/api/src/modules/relatorio-tecnico/dto/salvar-modelo-relatorio-tecnico.dto.ts`
- Modify: `apps/api/src/modules/relatorio-tecnico/relatorio-tecnico.controller.ts`, `relatorio-tecnico.module.ts` (importar `PlanoModule`; `TypeOrmModule.forFeature` + `Usuario`)
- Test: `apps/api/src/modules/relatorio-tecnico/modelo-relatorio-tecnico.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`mesclarComPadrao`, `modeloPadrao`, `validarModelo`), Task 2 (entidades), `AssinaturaService.buscarAssinaturaAtivaComValidacao(gestorId)` (devolve `Assinatura` com `plano`, ou null).
- Produces:
```ts
interface UsuarioModelo { id: string; perfil: PerfilUsuario; gestorId?: string | null }
export interface ModeloRelatorioTecnicoResposta { secoes: ModeloSecao[]; podePersonalizar: boolean }
class ModeloRelatorioTecnicoService {
  resolverDono(usuario: UsuarioModelo): string | null;            // AUDITOR → gestorId ?? null; GESTOR/MASTER → id
  podePersonalizar(donoId: string): Promise<boolean>;             // dono MASTER → true; senão plano da assinatura ativa com permiteModeloRelatorioTecnico
  obterVigente(donoId: string | null): Promise<ModeloSecao[]>;    // sem dono, sem registro ou sem recurso → modeloPadrao()
  obterParaUsuario(usuario: UsuarioModelo): Promise<ModeloRelatorioTecnicoResposta>;
  salvar(usuario: UsuarioModelo, secoes: ModeloSecao[]): Promise<ModeloRelatorioTecnicoResposta>;
}
```
- `SalvarModeloRelatorioTecnicoDto { secoes: ModeloSecao[] }` (`@IsArray`; o conteúdo é validado por `validarModelo` no service → `BadRequestException(mensagem)`).
- Controller: `GET /relatorios-tecnicos/modelo` e `PUT /relatorios-tecnicos/modelo`, declarados **antes** de `@Get(':id')`.

- [ ] **Step 1: Escrever os testes** (repositórios e `AssinaturaService` mockados com `jest.fn()`):
  - `resolverDono`: AUDITOR com `gestorId: 'g1'` → `'g1'`; AUDITOR sem gestor → `null`; GESTOR `'g1'` → `'g1'`.
  - `obterVigente('g1')` sem registro → padrão.
  - Com registro e plano `permiteModeloRelatorioTecnico: true` → registro mesclado.
  - Com registro e plano `false` → padrão, e o repositório **não** recebe `delete`/`save` (Review Focus 3).
  - Sem assinatura → padrão.
  - `salvar`:
    - AUDITOR → `ForbiddenException`;
    - GESTOR sem recurso → `ForbiddenException` com mensagem "Seu plano atual não inclui a personalização do relatório técnico.";
    - GESTOR com recurso e modelo inválido → `BadRequestException` com a mensagem de `validarModelo`;
    - GESTOR com recurso e modelo válido → upsert por `gestorId`, retornando `{ secoes: mesclado, podePersonalizar: true }`;
    - MASTER sem assinatura → salva.
  - `obterParaUsuario` de AUDITOR devolve o modelo do gestor e `podePersonalizar: false`.
- [ ] **Step 2:** `npx jest src/modules/relatorio-tecnico/modelo-relatorio-tecnico.service.spec.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar o service, o DTO e as duas rotas. Para saber se o dono é MASTER, ler o `perfil` em `Repository<Usuario>`.
- [ ] **Step 4:** Rodar de novo. Esperado: PASS. Rodar também `npx tsc --noEmit -p tsconfig.json`.
- [ ] **Step 5:** Commit: `Adicionar endpoints do modelo de relatório técnico com liberação por plano`.

### Task 4: Aplicar o modelo no `RelatorioTecnicoService` (validação, snapshot, apoio)

**Files:**
- Modify: `apps/api/src/modules/relatorio-tecnico/relatorio-tecnico.service.ts`, `relatorio-tecnico.controller.ts`
- Test: `apps/api/src/modules/relatorio-tecnico/relatorio-tecnico.service.spec.ts` (novo)

**Interfaces:**
- Consumes: Task 3 (`resolverDono`, `obterVigente`), Task 1.
- Produces:
```ts
modeloEfetivo(relatorio: RelatorioTecnico): Promise<ModeloSecao[]>;
// finalizado → relatorio.modeloSecoes ?? modeloPadrao(); rascunho → obterVigente(resolverDono(relatorio.consultora))
buscarComModelo(id: string, usuario): Promise<RelatorioTecnico & { modeloEfetivo: ModeloSecao[] }>;
```
- `GET /relatorios-tecnicos/:id` passa a usar `buscarComModelo`. `modeloEfetivo` é só propriedade de resposta: **nunca** atribuir a `relatorio.modeloSecoes` fora da transição de finalização.
- `validarRelatorioMinimoParaConclusao(relatorio, contexto, modelo: ModeloSecao[])`:
  - `identificacao` é sempre obrigatória;
  - os campos HTML só são obrigatórios se a seção estiver ativa;
  - a ação executada só é obrigatória se `acoesExecutadas` estiver ativa.
  - A mensagem usa o título: `Preencha a seção "<titulo>" antes de finalizar o relatório`, ou o mesmo texto terminando em `antes de gerar o apoio analítico`.
  - Mapa seção→campo: descricaoOcorrencia→descricaoOcorrenciaHtml, avaliacaoTecnica→avaliacaoTecnicaHtml, recomendacoesConsultora→recomendacoesConsultoraHtml, planoAcaoSugerido→planoAcaoSugeridoHtml. Evidências não são obrigatórias.
- `atualizar`:
  - se `dto.status === FINALIZADO` e o status salvo não for finalizado: `modelo = obterVigente(dono)`, validar e gravar `relatorio.modeloSecoes = modelo`;
  - se o status salvo já for finalizado: validar o mesclado com `relatorio.modeloSecoes ?? modeloPadrao()` e **não** tocar no snapshot;
  - rascunho: não valida.
- `atualizarApoioAnalitico`: se `apoioAnalitico` estiver inativa no modelo efetivo → `ConflictException('O apoio analítico não está habilitado no modelo deste relatório.')`. Senão, valida com o modelo efetivo e chama a IA conforme o Task 5.

- [ ] **Step 1: Escrever os testes** (repositório, `ClienteService`, `IaService` e `ModeloRelatorioTecnicoService` mockados):
  - Rascunho com modelo em que `avaliacaoTecnica` está inativa: finaliza com `avaliacaoTecnicaHtml: ''`, e `save` recebe `modeloSecoes` igual ao modelo vigente.
  - Rascunho sem `recomendacoesConsultoraHtml` e modelo com essa seção renomeada para "Retorno do Cliente": `ConflictException` com `Preencha a seção "Retorno do Cliente" antes de finalizar o relatório`.
  - Relatório já finalizado com snapshot A recebendo `PUT` com `status: 'finalizado'` enquanto o vigente é B: `save` mantém `modeloSecoes` A, e `obterVigente` não é chamado (Review Focus 1).
  - Relatório finalizado sem snapshot (legado): valida com o padrão.
  - `atualizarApoioAnalitico` em rascunho: o objeto passado a `save` tem `modeloSecoes` `null`/inalterado (Review Focus 2).
  - Apoio com seção `apoioAnalitico` inativa: `ConflictException`, e a IA não é chamada.
- [ ] **Step 2:** `npx jest src/modules/relatorio-tecnico/relatorio-tecnico.service.spec.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Injetar `ModeloRelatorioTecnicoService` no `RelatorioTecnicoService`.
- [ ] **Step 4:** Rodar de novo. Esperado: PASS.
- [ ] **Step 5:** Commit: `Aplicar modelo do relatório técnico na validação, snapshot e apoio analítico`.

### Task 5: IA e PDF respeitam o modelo

**Files:**
- Modify: `apps/api/src/modules/ia/ia.service.ts` (`gerarApoioAnaliticoRelatorioTecnico`), `apps/api/src/modules/relatorio-tecnico/relatorio-tecnico.service.ts` (chamada)
- Modify: `apps/api/src/modules/relatorio-tecnico/services/relatorio-tecnico-html.service.ts`, `relatorio-tecnico-pdf-puppeteer.service.ts`, `relatorio-tecnico.controller.ts` (`gerarPdf`)
- Test: `apps/api/src/modules/relatorio-tecnico/services/relatorio-tecnico-html.service.spec.ts` (novo)

**Interfaces:**
- `IaService.gerarApoioAnaliticoRelatorioTecnico(dados: { identificacao: string; secoes: Array<{ titulo: string; conteudo: string }>; nomeConsultora: string; contextoComplementar?: string }, usuario?)`. O prompt lista `IDENTIFICAÇÃO`, depois cada seção como `${titulo.toUpperCase()}:` + conteúdo (as ações vão como lista numerada), e depois consultora e contexto. O item 3 da estrutura de saída passa a ser "Consistência entre as seções do relatório". O bloco de crédito/tokens fica inalterado.
- `RelatorioTecnicoService` monta `secoes` com as seções ativas de conteúdo, na ordem fixa (exclui evidências e apoio).
- `RelatorioTecnicoHtmlService.gerarHtml(relatorio, assetsPdf?, modelo: ModeloSecao[] = modeloPadrao())`: renderiza só as seções ativas, com `escapeHtml(tituloSecao(...))`. Identificação e Assinaturas ficam sempre.
- `RelatorioTecnicoPdfPuppeteerService.gerarPdf(relatorio, modelo: ModeloSecao[])`. O controller passa `await relatorioTecnicoService.modeloEfetivo(relatorio)`.

- [ ] **Step 1: Escrever os testes do HTML:**
  - Com o padrão, o HTML contém os 9 `<h2>` atuais na ordem.
  - Com `avaliacaoTecnica` inativa, não contém "Avaliação Técnica" nem o conteúdo de `avaliacaoTecnicaHtml`.
  - Com o título `'<script>x</script>'` forçado em `recomendacoesConsultora` (bypass da validação), o HTML contém `&lt;script&gt;` e não contém `<script>x` (Review Focus 4).
- [ ] **Step 2:** Rodar `npx jest src/modules/relatorio-tecnico/services`. Esperado: FAIL.
- [ ] **Step 3:** Implementar HTML, Puppeteer e IA, e ajustar a chamada no service. Atualizar o teste do Task 4 que verifica a chamada da IA, se houver.
- [ ] **Step 4:** Rodar `npx jest src/modules/relatorio-tecnico src/modules/ia` e `npx tsc --noEmit -p tsconfig.json`. Esperado: PASS.
- [ ] **Step 5:** Commit: `Gerar PDF e apoio analítico conforme o modelo do relatório técnico`.

### Task 6: Web — tipos, cliente da API e `modelo-secoes`

**Files:**
- Create: `apps/web/src/lib/relatorio-tecnico/modelo-secoes.ts` (cópia fiel do Task 1 + `camposFaltantes`)
- Test: `apps/web/src/lib/relatorio-tecnico/modelo-secoes.test.ts`
- Modify: `apps/web/src/lib/api.ts`

**Interfaces — Produces:**
- Os mesmos exports do Task 1, mais `camposFaltantes(valor: Pick<CriarRelatorioTecnicoRequest, 'identificacao' | 'descricaoOcorrenciaHtml' | 'avaliacaoTecnicaHtml' | 'acoesExecutadas' | 'recomendacoesConsultoraHtml' | 'planoAcaoSugeridoHtml'>, modelo: ModeloSecao[]): string[]`. A função devolve os títulos faltantes; a identificação faltante sai como "Identificação" e ações vazias saem como o título da seção.
- `api.ts`:
  - `Plano.permiteModeloRelatorioTecnico: boolean` (e no payload de criar/atualizar plano);
  - `RelatorioTecnico.modeloEfetivo?: ModeloSecao[]`;
  - `CriarRelatorioTecnicoRequest` com os campos HTML/ações opcionais;
  - `relatorioTecnicoService.buscarModelo(): Promise<{ secoes: ModeloSecao[]; podePersonalizar: boolean }>`;
  - `relatorioTecnicoService.salvarModelo(secoes: ModeloSecao[]): Promise<{ secoes: ModeloSecao[]; podePersonalizar: boolean }>`.

- [ ] **Step 1: Escrever os testes:** os mesmos casos do Task 1, mais `camposFaltantes`:
  - com o padrão e tudo vazio, devolve 6 itens;
  - com `avaliacaoTecnica` inativa, não inclui "Avaliação Técnica";
  - com `recomendacoesConsultora` renomeada, devolve o novo título.
- [ ] **Step 2:** `cd apps/web && npx vitest run src/lib/relatorio-tecnico`. Esperado: FAIL.
- [ ] **Step 3:** Implementar e ajustar `api.ts`.
- [ ] **Step 4:** Rodar de novo. Esperado: PASS. Rodar também `npx tsc --noEmit`.
- [ ] **Step 5:** Commit: `Adicionar tipos e cliente do modelo de relatório técnico no web`.

### Task 7: Web — tela do modelo, botão na listagem e flag no plano

**Files:**
- Create: `apps/web/src/app/admin/relatorios-tecnicos/modelo/page.tsx`
- Modify: `apps/web/src/app/admin/relatorios-tecnicos/page.tsx`, `apps/web/src/app/admin/planos/page.tsx`

**Interfaces:** consome o Task 6 (`buscarModelo`, `salvarModelo`, `validarModelo`, `SECOES_CONFIGURAVEIS`).

- [ ] **Step 1: Página `/admin/relatorios-tecnicos/modelo`**
  - Usa `AppLayout`. AUDITOR é redirecionado para a listagem.
  - Mostra uma lista na ordem fixa. Identificação e Assinaturas aparecem travadas (ícone de cadeado e texto "Sempre incluída").
  - Cada seção configurável tem:
    - um switch "Incluir", no mesmo estilo do switch "Plano Ativo" de `planos/page.tsx`;
    - um input de título com `placeholder` = título padrão e `maxLength={60}`;
    - a legenda "Padrão: <título>".
  - Botões:
    - "Salvar": valida com `validarModelo` antes de enviar e mostra o erro por toast;
    - "Restaurar padrão": abre `ConfirmDialog` e aplica `modeloPadrao()` no estado (o usuário ainda precisa salvar).
  - Com `podePersonalizar: false`, a tela fica somente leitura, com o aviso "Seu plano atual não inclui a personalização do relatório técnico."
  - Mobile-first: uma coluna; acima de `sm`, switch e input lado a lado.
- [ ] **Step 2: Listagem**
  - Botão "Personalizar modelo" (ícone `SlidersHorizontal` com `Tooltip`), visível para GESTOR/MASTER.
  - Com `podePersonalizar: false`, o botão fica desabilitado e o tooltip diz "Recurso não incluído no seu plano atual".
- [ ] **Step 3: Formulário de planos**
  - Switch "Permite personalizar o relatório técnico" ligado a `permiteModeloRelatorioTecnico`, com default `false` no form vazio e preenchido na edição.
  - Exibir um selo no card do plano quando o switch estiver ligado.
- [ ] **Step 4: Verificar**
  - Rodar `cd apps/web && npx vitest run && npx tsc --noEmit`. Esperado: PASS (inclui `sem-daisyui.test.ts`).
  - Depois, abrir `http://localhost:3031/admin/relatorios-tecnicos/modelo` como GESTOR e salvar um modelo com uma seção desligada e outra renomeada. Ao recarregar, o modelo deve continuar igual.
- [ ] **Step 5:** Commit: `Adicionar tela de personalização do modelo de relatório técnico`.

### Task 8: Web — formulário do relatório respeita o modelo

**Files:**
- Modify: `apps/web/src/components/relatorio-tecnico/relatorio-tecnico-form.tsx`, `apps/web/src/app/admin/relatorios-tecnicos/[id]/page.tsx`

**Interfaces:**
- `RelatorioTecnicoFormProps.modelo: ModeloSecao[]`, obrigatório. A página passa `relatorio.modeloEfetivo ?? modeloPadrao()`.

- [ ] **Step 1: Formulário**
  - Cada bloco (descrição, evidências, avaliação, ações, recomendações, plano, apoio) só renderiza se `secaoAtiva(modelo, ...)`, com `label`/título vindo de `tituloSecao`.
  - `required` só aparece nas seções ativas.
  - A checagem `completo` antes de gerar o apoio passa a ser `camposFaltantes(valor, modelo).length === 0`, e o toast lista os títulos faltantes.
- [ ] **Step 2: Verificar**
  - Rodar `npx tsc --noEmit && npx vitest run`. Esperado: PASS.
  - No navegador, como AUDITOR do gestor do Task 7, abrir um rascunho. A seção desligada não aparece, a renomeada mostra o novo título, a finalização funciona sem a seção desligada e o PDF bate com o formulário.
- [ ] **Step 3:** Commit: `Aplicar modelo do relatório técnico no formulário web`.

### Task 9: Mobile — cache, schema local, sync e 409

**Files:**
- Create: `apps/mobile/src/utils/modelo-secoes.ts` (cópia do Task 6, incluindo `camposFaltantes` sobre os campos locais)
- Create: `apps/mobile/src/store/modelo-relatorio.ts`
- Modify:
  - `apps/mobile/src/db/schema.ts` (`SCHEMA_V6`);
  - `apps/mobile/src/db/migrations.ts`;
  - `apps/mobile/src/db/repositories/relatorio-tecnico.repo.ts`;
  - `apps/mobile/src/api/client.ts`;
  - `apps/mobile/src/api/relatorio-tecnico.api.ts`;
  - `apps/mobile/src/sync/pull.ts`;
  - `apps/mobile/src/sync/push.ts`.
- Test:
  - `apps/mobile/src/utils/__tests__/modelo-secoes.test.ts`;
  - `apps/mobile/src/store/__tests__/modelo-relatorio.test.ts`;
  - `apps/mobile/src/sync/__tests__/push.test.ts`;
  - `apps/mobile/src/db/__tests__/migrations.test.ts`.

**Interfaces — Produces:**
- `client.ts`: `export class ApiError extends Error { constructor(message: string, readonly status: number) }`, lançado em `!response.ok` com a mesma mensagem de hoje.
- `SCHEMA_V6`: `ALTER TABLE relatorios_tecnicos ADD COLUMN modelo_secoes TEXT; ALTER TABLE relatorios_tecnicos ADD COLUMN aviso_sync TEXT;`, aplicado em `migrations.ts` como os anteriores.
- Repo:
  - `RelatorioTecnicoCompleto.modeloSecoes: ModeloSecao[] | null` e `avisoSync: string | null` (JSON parse/stringify);
  - `upsertRemoto` aceita `modeloSecoes`;
  - `setAvisoSync(id: string, aviso: string | null): void`.
- `store/modelo-relatorio.ts` (MMKV `id: 'modelo-relatorio'`):
  - `salvarModeloCache(userId: string, secoes: ModeloSecao[]): void`;
  - `lerModeloCache(userId: string): ModeloSecao[] | null`.
- `relatorio-tecnico.api.ts`:
  - `buscarModeloRelatorioTecnico(): Promise<{ secoes: ModeloSecao[]; podePersonalizar: boolean }>`;
  - `RelatorioTecnicoApi.modeloSecoes?: ModeloSecao[] | null`.
- `pull.ts`:
  - `pullModeloRelatorioTecnico(): Promise<void>` salva no cache do usuário logado. Uma falha só loga e mantém o cache.
  - É chamado antes de `pullRelatoriosTecnicos`.
  - `pullRelatoriosTecnicos` grava `r.modeloSecoes`.
- `pushRelatorioTecnico`: se o `PUT` com `status: 'finalizado'` lançar `ApiError` 409:
  1. `updateStatus(localId, 'rascunho')`;
  2. `setAvisoSync(localId, err.message)`;
  3. `await pullModeloRelatorioTecnico()` (falha ignorada);
  4. reenviar o `PUT` sem `status`;
  5. `markSynced`.

  Outros erros continuam propagando, como hoje.

- [ ] **Step 1: Escrever os testes**
  - `modelo-secoes`: mesmos casos do Task 6.
  - Cache: salvar para `u1` e ler para `u2` dá `null` (Review Focus 5); ler para `u1` devolve o que foi salvo.
  - Push:
    - relatório local finalizado, e o primeiro `atualizarRelatorioTecnico` rejeita com `new ApiError('Preencha a seção "Avaliação Técnica" antes de finalizar o relatório', 409)`. Esperado: `updateStatus('rascunho')`, `setAvisoSync` com a mensagem, segundo `PUT` sem `status`, e item removido da fila;
    - com erro 500, o item fica na fila com `retries + 1`.
  - Migrations: V6 aplicada adiciona as duas colunas.
- [ ] **Step 2:** `cd apps/mobile && npx jest src/utils src/store src/sync src/db`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar de novo. Esperado: PASS. Rodar também `npx tsc --noEmit`.
- [ ] **Step 5:** Commit: `Sincronizar modelo do relatório técnico no app e tratar finalização recusada`.

### Task 10: Mobile — tela do relatório respeita o modelo

**Files:**
- Modify: `apps/mobile/app/(app)/relatorios/[id].tsx`

**Interfaces:** consome o Task 9 (`lerModeloCache`, `relatorio.modeloSecoes`, `relatorio.avisoSync`, `setAvisoSync`, `camposFaltantes`).

- [ ] **Step 1: Escolher o modelo**
  - `const modelo = relatorio.status === 'finalizado' ? (relatorio.modeloSecoes ?? modeloPadrao()) : (lerModeloCache(usuario.id) ?? modeloPadrao())`.
  - Esconder as seções inativas e usar `tituloSecao` nos labels.
- [ ] **Step 2: Finalizar**
  - `finalizar()` usa `camposFaltantes({ identificacao, descricaoOcorrenciaHtml: descricao, ... }, modelo)` no lugar da lista fixa.
  - Ao finalizar com sucesso, chamar `setAvisoSync(id, null)`.
  - A checagem antes de gerar o apoio também usa `camposFaltantes`. Com `apoioAnalitico` inativa, o bloco não aparece.
- [ ] **Step 3: Aviso**
  - Se `relatorio.avisoSync` existir, mostrar no topo do conteúdo um banner com o texto "Não foi possível finalizar: o modelo do relatório mudou." seguido da mensagem.
  - Seguir a regra de safe area do AGENTS.md: sem `SafeAreaView` com inset superior duplicado.
- [ ] **Step 4: Verificar**
  - Rodar `npx tsc --noEmit && npx jest`. Esperado: PASS.
  - No simulador (`npx expo run:ios`), com o gestor do Task 7: a seção desligada some, o título renomeado aparece e a finalização funciona.
- [ ] **Step 5:** Commit: `Aplicar modelo do relatório técnico na tela do app`.

### Task 11: Documentação de regras e paridade

**Files:**
- Modify: `docs/regras-de-negocio.md`, `docs/paridade-plataformas.md`, `docs/de-para-web-mobile.md`

- [ ] **Step 1: Regras de negócio**
  - Ajustar RN-REL-003 e RN-REL-004 para "quando a seção estiver ativa no modelo".
  - Adicionar:
    - **RN-REL-009:** modelo por gestor; seções configuráveis; Identificação e Assinaturas fixas; ao menos uma seção de conteúdo ativa; título ≤ 60 caracteres;
    - **RN-REL-010:** resolução por perfil (§6 do spec);
    - **RN-REL-011:** recurso liberado por plano (`permiteModeloRelatorioTecnico`); MASTER isento; ao perder o recurso, o modelo é mantido e não aplicado;
    - **RN-REL-012:** snapshot gravado só na transição para finalizado; finalizados seguem o snapshot; legados usam o padrão;
    - **RN-REL-013:** finalização offline recusada por modelo desatualizado volta a rascunho com aviso.
- [ ] **Step 2: Paridade**
  - Linha "Modelo do relatório técnico": web configura; web e mobile aplicam.
  - DE:PARA: `GET/PUT /relatorios-tecnicos/modelo`, `modeloEfetivo` no `GET :id` e `modeloSecoes` na listagem.
- [ ] **Step 3:** Commit: `Documentar regras do modelo personalizável do relatório técnico`.
