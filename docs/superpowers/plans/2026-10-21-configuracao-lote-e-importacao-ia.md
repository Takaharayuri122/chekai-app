# Configuração em lote e importação de checklist com IA — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir configurar perguntas de checklist em lote (seleção, grupo, checklist inteiro), com os novos controles "permitir foto" e "permitir observação". Resposta em texto passa a nunca receber foto. A importação de planilha ganha revisão por IA (ortografia e configurações), com confirmação antes de gravar.

**Architecture:**
- As regras de configuração de pergunta ficam num módulo puro da API (`checklist-regras.ts`), usado pela edição individual, pelo lote e pela importação.
- O lote é um endpoint único transacional, com modo de simulação.
- A importação passa a ter três chamadas, todas na API:
  - `preview` devolve as perguntas já mapeadas;
  - `revisar` é chamada pelo web, um grupo por vez;
  - `confirmar` cria o template a partir do JSON revisado.
- No web, a lógica de painel e de revisão fica em libs puras testadas com vitest; os componentes só renderizam.

**Tech Stack:** NestJS 10 + TypeORM (Postgres), Jest; Next.js + shadcn/ui + Tailwind, Vitest; DeepSeek via SDK `openai`.

**Spec:** `docs/superpowers/specs/2026-10-21-configuracao-lote-e-importacao-ia-design.md`
**Mockups:** https://claude.ai/artifact/WfHqTmGgTnFbUtg1yCmvRN

## Global Constraints

- Nenhuma alteração em `apps/mobile` ("não vamos mexer nos apps agora").
- Schema via script SQL em `scripts/`, sem migration TypeORM.
- Toda chamada de IA: `identificarGestorId` → `validarSaldoDisponivel` → chamada → `registrarUso` com `metodoChamado: 'checklistImport.revisao'`. MASTER é isento.
- Em conflito planilha × IA, **vale a IA**; o original fica visível para desfazer.
- Nada da importação é gravado antes de "confirmar".
- A API aceita foto em item com `permiteFoto = false` e só registra `Logger.warn`, porque o app antigo continua enviando.
- Telas novas usam shadcn (`@/components/ui/shadcn/*`), `ResponsiveDialog`, `ConfirmDialog` e `Tooltip`, sem DaisyUI (o teste `src/guarda/sem-daisyui.test.ts` precisa continuar passando).
- Copy em pt-BR, tom sóbrio e sem jargão técnico. Tooltips em todas as ações de ícone; ícones sempre visíveis.
- Modais e painéis: cabeçalho e rodapé fixos, conteúdo rolável, botão fechar visível; confirmação ao descartar **só** depois de interação real.
- Isolamento na API: só o gestor dono do template (`template.gestorId === usuario.id`) altera; endpoints de escrita com `@UseGuards(RolesGuard) @Roles(MASTER, GESTOR)`.
- Commits em pt-BR, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **`itemIds` de outro template** (ou de outro gestor) no lote → a API responde 400 sem alterar nada. Teste na Task 2.
2. **Itens inativos** (`ativo = false`) no escopo do lote → ignorados e fora da contagem. Teste na Task 2.
3. **IA devolve JSON malformado, chave desconhecida ou enum inválido** → o campo volta ao valor original e a revisão não quebra. Teste na Task 5.
4. **Célula vazia** em "permite fotos"/"permite comentário" → foto e observação permitidas. Teste na Task 3.
5. **Fechar o painel de lote** → pede confirmação só se alguma chave foi tocada. Teste na Task 6 (`temAlteracao`).

---

### Task 1: Campos "permitir foto/observação" e regras forçadas

**Files:**
- Create: `scripts/adicionar-permite-foto-observacao.sql`
- Create: `apps/api/src/modules/checklist/checklist-regras.ts`
- Test: `apps/api/src/modules/checklist/checklist-regras.spec.ts`
- Modify: `apps/api/src/modules/checklist/entities/template-item.entity.ts` (após `tipoRespostaCustomizada`)
- Modify: `apps/api/src/modules/checklist/dto/criar-checklist-template.dto.ts` (`CriarTemplateItemDto`)
- Modify: `apps/api/src/modules/checklist/checklist.service.ts` (`adicionarItem`, `atualizarItem`; remover o `normalizarOpcoesConfig` privado, linhas ~530-570)
- Modify: `apps/api/src/modules/auditoria/auditoria.service.ts` (`adicionarFoto`, ~301)
- Modify: `docs/regras-de-negocio.md` (seção 5: RN-CHK-014, RN-CHK-015; seção Fotos: RN-FOT-005, com o texto do spec §7.1)

**Interfaces:**
- Produces:
  - `type ItemConfiguravel = Pick<TemplateItem, 'tipoRespostaCustomizada' | 'usarRespostasPersonalizadas' | 'peso' | 'permiteFoto' | 'permiteObservacao' | 'opcoesResposta' | 'opcoesRespostaConfig'>`
  - `export function normalizarOpcoesConfig(item: Partial<ItemConfiguravel>): void`: mesma lógica do privado atual, movida.
  - `export function aplicarRegrasForcadas(item: Partial<ItemConfiguravel>): void`: chama `normalizarOpcoesConfig` e depois aplica RN-CHK-014/015.
  - `export const RESPOSTAS_PADRAO_VALORES = ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'] as const`
  - Entidade: `permiteFoto: boolean` e `permiteObservacao: boolean` (colunas `permite_foto` e `permite_observacao`, `default: true`).

- [ ] **Step 1: Escrever os testes**

```ts
describe('aplicarRegrasForcadas', () => {
  it('texto: peso 0, sem foto, sem opções e sem pontuação', () => {
    const item = { tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO, usarRespostasPersonalizadas: true, peso: 5,
      permiteFoto: true, permiteObservacao: true, opcoesResposta: ['A'],
      opcoesRespostaConfig: [{ valor: 'conforme', fotoObrigatoria: true, observacaoObrigatoria: true, pontuacao: 10 }] };
    aplicarRegrasForcadas(item);
    expect(item.peso).toBe(0);
    expect(item.permiteFoto).toBe(false);
    expect(item.opcoesResposta).toBeNull();
    expect(item.opcoesRespostaConfig.every((c) => !c.fotoObrigatoria && c.pontuacao == null)).toBe(true);
    expect(item.opcoesRespostaConfig.find((c) => c.valor === 'conforme')!.observacaoObrigatoria).toBe(true);
  });
  it('permiteFoto false zera fotoObrigatoria de todas as opções', ...);
  it('permiteObservacao false zera observacaoObrigatoria de todas as opções', ...);
  it('padrão sem config gera as 4 respostas padrão', ...); // comportamento atual preservado
  it('personalizada mantém config existente por valor e cria as que faltam', ...);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/api && npx jest src/modules/checklist/checklist-regras.spec.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar** `checklist-regras.ts`. Adicionar colunas e DTO (`@IsOptional() @IsBoolean() permiteFoto?` e `permiteObservacao?`). Trocar as duas chamadas de `this.normalizarOpcoesConfig(item)` e o `if TEXTO peso = 0` em `adicionarItem`/`atualizarItem` por `aplicarRegrasForcadas(item)`.
  - SQL: `ALTER TABLE template_itens ADD COLUMN IF NOT EXISTS permite_foto boolean NOT NULL DEFAULT true;` (idem `permite_observacao`).
  - Também: `UPDATE template_itens SET permite_foto = false WHERE tipo_resposta_customizada = 'texto';` mais um `UPDATE` com `jsonb` que zera `fotoObrigatoria` nos itens de texto. Conferir o nome real da coluna com `\d template_itens`.

- [ ] **Step 4: Em `adicionarFoto`**, carregar `item.templateItem`. Se `permiteFoto === false` ou o tipo for `texto`, registrar `this.logger.warn(\`Foto recebida em item sem permissão de foto (auditoria ${auditoriaId}, item ${itemId})\`)` e seguir normalmente. Criar o `Logger` se o service não tiver.

- [ ] **Step 5: Rodar os testes e o typecheck**

Run: `cd apps/api && npx jest src/modules/checklist && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, sem erros de tipo

- [ ] **Step 6: Commit** `Adicionar permitir foto/observação por pergunta e regras forçadas de texto`

---

### Task 2: Endpoint de configuração em lote

**Files:**
- Create: `apps/api/src/modules/checklist/dto/configurar-lote.dto.ts`
- Create: `apps/api/src/modules/checklist/checklist-lote.service.ts`
- Test: `apps/api/src/modules/checklist/checklist-lote.service.spec.ts`
- Modify: `apps/api/src/modules/checklist/checklist-regras.ts` (adicionar `aplicarTipoResposta`)
- Modify: `apps/api/src/modules/checklist/checklist.controller.ts`, `checklist.module.ts`
- Modify: `docs/regras-de-negocio.md` (RN-CHK-016)

**Interfaces:**
- Consumes: `aplicarRegrasForcadas`, `RESPOSTAS_PADRAO_VALORES` (Task 1).
- Produces (DTO com class-validator):
  ```ts
  export type TipoRespostaLote = 'padrao' | 'personalizada' | 'texto' | 'numero' | 'data';
  export class OpcaoLoteDto { valor: string; pontuacao?: number | null /* -10..10 */; fotoObrigatoria: boolean; observacaoObrigatoria: boolean }
  export class AlteracoesLoteDto { tipoResposta?: TipoRespostaLote; opcoes?: OpcaoLoteDto[]; permiteFoto?: boolean;
    permiteObservacao?: boolean; obrigatorio?: boolean; criticidade?: CriticidadeItem }
  export class ConfigurarLoteDto { itemIds?: string[]; grupoId?: string; alteracoes: AlteracoesLoteDto; simular?: boolean }
  export interface ResultadoLote { totalAfetados: number; personalizadosSubstituidos: number; ignorados: number;
    auditoriasVinculadas: number; simulado: boolean }
  ```
  - `aplicarTipoResposta(item: Partial<ItemConfiguravel>, tipo: TipoRespostaLote, opcoes?: OpcaoLoteDto[]): void`, em `checklist-regras.ts`:
    - `padrao`: `usar=false`, `tipo=null`, `opcoesResposta=null`; com `opcoes`, vira `opcoesRespostaConfig` (só os valores padrão).
    - `personalizada`: `usar=true`, `tipo=null`, `opcoesResposta = opcoes.map(o => o.valor)`, config = `opcoes`.
    - `texto`/`numero`/`data`: `usar=true`, `tipo=X`, `opcoesResposta=null`.
  - `ChecklistLoteService.configurar(templateId: string, dto: ConfigurarLoteDto, usuario): Promise<ResultadoLote>`
  - Rota: `PUT /checklists/templates/:templateId/itens/lote`, Roles MASTER/GESTOR.

Regras:
- Escopo:
  - sem `itemIds` e sem `grupoId` → template inteiro;
  - os dois juntos → 400;
  - só itens `ativo = true`.
- Validações (400):
  - `opcoes` sem `tipoResposta` em `padrao`/`personalizada`;
  - `alteracoes` vazio;
  - `itemIds` ou `grupoId` fora do template.
- Ordem de aplicação: tipo → opções → permiteFoto/permiteObservacao → obrigatorio → criticidade → `aplicarRegrasForcadas`.
- `ignorados` = itens em que, depois de aplicar, nada mudou.
- `personalizadosSubstituidos` = itens com `usarRespostasPersonalizadas && !tipoRespostaCustomizada` (ou `select`) antes, cujas opções mudaram.
- `auditoriasVinculadas` = `auditoriaRepository.count({ where: { templateId } })`.
- Com `simular: true`, calcula tudo e não salva.
- Sem simulação, salva via `itemRepository.manager.transaction(m => m.save(TemplateItem, itens))`.
- Dono: mesmo check de `adicionarItem` (`template.gestorId !== usuario.id` → 403).

- [ ] **Step 1: Testes** (repositórios mockados como em `checkin.service.spec.ts`):
  - `aplica só os campos enviados`: um item com criticidade alta, lote com `{ permiteFoto: false }` → criticidade continua alta e `permiteFoto` vira false.
  - `tipo texto em lote força peso 0 e permiteFoto false`.
  - `opcoes sem tipoResposta → BadRequestException`.
  - `itemIds de outro template → BadRequestException e save não chamado` (Review Focus 1).
  - `ignora itens inativos` (Review Focus 2).
  - `simular não chama save e devolve contagens` (`personalizadosSubstituidos: 1, auditoriasVinculadas: 3`).
  - `usuário que não é dono → ForbiddenException`.
  - Tabela `aplicarTipoResposta` no `checklist-regras.spec.ts`: um caso por tipo.
- [ ] **Step 2: Rodar e ver falhar**: `cd apps/api && npx jest src/modules/checklist/checklist-lote` → FAIL
- [ ] **Step 3: Implementar** o DTO, `aplicarTipoResposta`, o service, a rota e o registro no módulo.
- [ ] **Step 4: Rodar** `npx jest src/modules/checklist && npx tsc --noEmit -p tsconfig.json` → PASS
- [ ] **Step 5: Commit** `Adicionar configuração em lote de perguntas do checklist`

---

### Task 3: Importação, etapa 1 (aproveitar colunas da planilha)

**Files:**
- Create: `apps/api/src/modules/checklist/checklist-import-mapeamento.ts`
- Test: `apps/api/src/modules/checklist/checklist-import-mapeamento.spec.ts`
- Modify: `apps/api/src/modules/checklist/dto/importar-checklist.dto.ts`
- Modify: `apps/api/src/modules/checklist/checklist-import.service.ts` (`parseBool`, `preview`, `inferirCategoria` vira export do arquivo de mapeamento)

**Interfaces:**
- Consumes: `TipoRespostaLote`, `OpcaoLoteDto` (Task 2); `aplicarTipoResposta`, `aplicarRegrasForcadas` (Tasks 1-2).
- Produces (em `importar-checklist.dto.ts`):
  ```ts
  export interface ConfiguracaoPerguntaImportada { categoria: CategoriaItem; criticidade: CriticidadeItem; tipoResposta: TipoRespostaLote;
    peso: number; obrigatorio: boolean; permiteFoto: boolean; permiteObservacao: boolean;
    opcoes: { valor: string; pontuacao: number | null; fotoObrigatoria: boolean; observacaoObrigatoria: boolean }[] }
  export interface PerguntaImportada { chave: string /* `l${indiceLinha}` */; grupo: string; secao?: string; pergunta: string;
    configuracao: ConfiguracaoPerguntaImportada; motivoConferir?: string }
  // ImportacaoPreview ganha: perguntas: PerguntaImportada[]
  ```
  - `mapearLinhaImportada(row: ChecklistCsvRow, indice: number): PerguntaImportada`
  - `mapearTipoResposta(bruto: string | undefined, temOpcoes: boolean): { tipo: TipoRespostaLote; reconhecido: boolean }`. Mapeamento: contém "texto" → `texto`; "númer|numer" → `numero`; "data" → `data`; senão `personalizada` se houver opções, `padrao` se não. Valor não vazio e não reconhecido → `reconhecido: false`, e a pergunta recebe `motivoConferir = 'Tipo de resposta da planilha não reconhecido: "<bruto>"'`.
  - `configuracaoParaItem(c: ConfiguracaoPerguntaImportada): Partial<TemplateItem>`: usa `aplicarTipoResposta` + `aplicarRegrasForcadas`. Usada também na Task 4.
- `parseBool(value): boolean | undefined`, com vazio → `undefined`. Os campos booleanos de `ChecklistCsvRow` viram opcionais.

Mapeamento de linha:
- `permiteFoto = row.permiteFotos ?? true`; `permiteObservacao = row.permiteComentario ?? true`.
- `peso = row.pontuacaoMaxima ?? 1`; `obrigatorio = row.respostaObrigatoria ?? true`; criticidade `media`; categoria `inferirCategoria(row.grupo)`.
- Opções da planilha → `{ valor: texto, pontuacao: pontos ?? null, ... }`:
  - `fotoObrigatoria = !!row.fotosObrigatorias && (inconformidade || nenhumaOpcaoMarcadaComoInconformidade)`;
  - `observacaoObrigatoria` igual, usando `justificativaObrigatoria`.
- Sem opções, as 4 padrão: as exigências caem só em `nao_conforme`; `nao_aplicavel` e `nao_avaliado` ficam com `pontuacao: null`.
- Ao final, aplicar as regras forçadas à configuração. Texto: `permiteFoto=false`, `peso=0`, `opcoes=[]`.

- [ ] **Step 1: Testes**
  - `célula vazia de permite fotos → permiteFoto true` (Review Focus 4).
  - `"Não" em permite fotos → permiteFoto false e nenhuma opção com fotoObrigatoria`.
  - `fotos obrigatórias só nas opções de inconformidade`: opções Sim (inconformidade false) e Não (true) → só Não tem `fotoObrigatoria`.
  - `pontos por opção viram pontuacao`.
  - `tipo "Texto livre" → texto, peso 0, permiteFoto false`.
  - `tipo "Escala XYZ" desconhecido → motivoConferir preenchido`.
  - `preview devolve perguntas com chave estável l0, l1…` (usar `parseCsv` com um CSV mínimo de 6+ linhas inline no teste).
- [ ] **Step 2: Rodar e ver falhar**: `npx jest src/modules/checklist/checklist-import-mapeamento` → FAIL
- [ ] **Step 3: Implementar** o mapeamento, o `parseBool` tri-estado e `preview` preenchendo `perguntas`. Manter o `importar()` antigo, mas fazê-lo usar `mapearLinhaImportada` + `configuracaoParaItem`, para que o caminho legado também grave as colunas.
- [ ] **Step 4: Rodar** `npx jest src/modules/checklist && npx tsc --noEmit -p tsconfig.json` → PASS
- [ ] **Step 5: Commit** `Aproveitar colunas de foto, comentário e pontuação na importação de checklist`

---

### Task 4: Importação, endpoint de confirmação e guardas

**Files:**
- Modify: `apps/api/src/modules/checklist/dto/importar-checklist.dto.ts`
- Modify: `apps/api/src/modules/checklist/checklist-import.service.ts`
- Modify: `apps/api/src/modules/checklist/checklist.controller.ts` (rotas de importação, ~263-317)
- Test: `apps/api/src/modules/checklist/checklist-import.service.spec.ts`

**Interfaces:**
- Consumes: `PerguntaImportada`, `ConfiguracaoPerguntaImportada`, `configuracaoParaItem` (Task 3).
- Produces:
  ```ts
  export class ConfirmarImportacaoDto { dados: ImportarChecklistDto;
    grupos: { nome: string; perguntas: { secao?: string; pergunta: string; configuracao: ConfiguracaoPerguntaImportada }[] }[] }
  ```
  - `ChecklistImportService.confirmar(dto: ConfirmarImportacaoDto, usuario): Promise<ImportacaoResultado>`
  - Rota: `POST /checklists/importar/checklist/confirmar` (JSON). Cria template (`rascunho`), grupos (`ordem` = índice) e itens (`ordem` global), tudo em `templateRepository.manager.transaction`.
- Adicionar `@UseGuards(RolesGuard) @Roles(MASTER, GESTOR)` nas rotas `preview`, `importar/checklist`, `confirmar` e `revisar` (Task 5).

- [ ] **Step 1: Testes**
  - `cria template rascunho com gestorId do usuário`.
  - `aplica regras forçadas`: uma pergunta texto com `permiteFoto: true` no payload é salva com `permiteFoto` false.
  - `pergunta vazia é ignorada com aviso`.
  - `grupos sem perguntas não são criados`.
  - `erro no meio → transação não confirma` (o mock de `transaction` repassa o erro e `save` do template não ocorre fora dela).
- [ ] **Step 2: Rodar e ver falhar**: `npx jest src/modules/checklist/checklist-import.service` → FAIL
- [ ] **Step 3: Implementar** o DTO com `ValidateNested`/`Type`, `confirmar`, a rota e os guards.
- [ ] **Step 4: Rodar** `npx jest src/modules/checklist && npx tsc --noEmit -p tsconfig.json` → PASS
- [ ] **Step 5: Commit** `Adicionar confirmação de importação a partir da revisão`

---

### Task 5: Revisão da importação com IA

**Files:**
- Create: `apps/api/src/modules/checklist/checklist-import-revisao.ts` (puro: prompt e interpretação)
- Create: `apps/api/src/modules/checklist/checklist-import-ia.service.ts`
- Test: `apps/api/src/modules/checklist/checklist-import-revisao.spec.ts`, `checklist-import-ia.service.spec.ts`
- Modify: `checklist.controller.ts`, `checklist.module.ts`, `dto/importar-checklist.dto.ts`
- Modify: `docs/regras-de-negocio.md` (RN-CHK-017)

**Interfaces:**
- Consumes: `PerguntaImportada`, `ConfiguracaoPerguntaImportada` (Task 3); as regras forçadas aplicadas à configuração (Task 3); `CreditoService`, `LegislacaoService.buscarChunksSimilares(query, limite)`.
- Produces:
  ```ts
  export type CampoRevisado = 'pergunta' | 'categoria' | 'criticidade' | 'tipoResposta' | 'peso' | 'permiteFoto' | 'permiteObservacao' | 'opcoes';
  export interface SugestaoPergunta { chave: string; perguntaSugerida: string; configuracaoSugerida: ConfiguracaoPerguntaImportada;
    alteracoes: CampoRevisado[]; motivo?: string; conferir: boolean; motivoConferir?: string }
  export interface RevisaoGrupoResultado { status: 'revisado' | 'sem_creditos' | 'falha'; grupoNomeSugerido?: string; sugestoes: SugestaoPergunta[] }
  export class RevisarImportacaoDto { grupo: string; perguntas: PerguntaImportada[] /* máx. 40 */ }
  ```
  - `montarPromptRevisao(grupo: string, perguntas: PerguntaImportada[], contextoLegal: string[]): string`
  - `interpretarRespostaIa(bruto: string, perguntas: PerguntaImportada[]): { grupoNomeSugerido?: string; sugestoes: SugestaoPergunta[] }`
  - `ChecklistImportIaService.revisarGrupo(dto: RevisarImportacaoDto, usuario): Promise<RevisaoGrupoResultado>`
  - Rota: `POST /checklists/importar/checklist/revisar`.

Regras:
- **Prompt.** Pede JSON `{ grupoNome, perguntas: [{ chave, pergunta, categoria, criticidade, tipoResposta, peso, permiteFoto, permiteObservacao, opcoes, motivo }] }`. Instruções:
  - corrigir ortografia e acentuação sem mudar o sentido;
  - não criar, remover ou reordenar perguntas;
  - sugerir a configuração para auditoria de boas práticas em serviços de alimentação (RDC 216/2004 e a legislação fornecida);
  - valores de enum permitidos listados explicitamente.

  Chamada: `response_format: { type: 'json_object' }`, `temperature: 0.2`, modelo `deepseek-chat`, cliente DeepSeek criado como em `checklist-ia.service.ts:66-75`.
- **Interpretação.**
  - Chaves desconhecidas são descartadas; pergunta sem sugestão recebe sugestão = original com `alteracoes: []`.
  - Campo com enum ou tipo inválido → valor original.
  - Aplicar as regras forçadas à configuração sugerida.
  - `alteracoes` = diff entre original e sugerido.
  - `conferir = true` se `alteracoes` tocar `tipoResposta | peso | permiteFoto | permiteObservacao | opcoes`, ou se `original.motivoConferir` existir.
  - `motivoConferir` descreve o conflito em pt-BR. Ex.: "A planilha pedia 5 pontos e fotos nesta pergunta. Como a resposta é em texto, removemos pontuação e fotos."
  - JSON que não parseia → lança erro (o service converte em `falha`).
- **Service.**
  - Não-MASTER: `gestorId = identificarGestorId(usuario)` e `validarSaldoDisponivel(gestorId)`. Erro de saldo → `{ status: 'sem_creditos', sugestoes: [] }`.
  - RAG: `buscarChunksSimilares(\`${grupo} ${perguntas.slice(0,5).map(p=>p.pergunta).join(' ')}\`, 5)` dentro de try/catch; em falha, segue sem contexto.
  - Depois da chamada: `registrarUso({ ..., metodoChamado: 'checklistImport.revisao', contexto: \`Revisão de importação: ${grupo}\` })`.
  - Qualquer outro erro → `{ status: 'falha', sugestoes: [] }` + `logger.error`.

- [ ] **Step 1: Testes puros** (`checklist-import-revisao.spec.ts`):
  - `JSON malformado lança erro`.
  - `chave desconhecida é descartada e pergunta sem sugestão mantém original` (Review Focus 3).
  - `criticidade "altissima" volta ao valor original`.
  - `IA muda tipo para texto → permiteFoto false, peso 0, conferir true com motivo`.
  - `só correção ortográfica → alteracoes ['pergunta'] e conferir false`.
  - `prompt contém todas as chaves e os enums permitidos`.
- [ ] **Step 2: Testes do service** (DeepSeek mockado substituindo `service['deepseek']`):
  - `sem saldo → sem_creditos e IA não chamada`.
  - `MASTER não valida saldo nem registra uso`.
  - `registra uso com metodoChamado checklistImport.revisao e tokens do usage`.
  - `erro da IA → falha`.
  - `falha no RAG não impede a revisão`.
- [ ] **Step 3: Rodar e ver falhar**: `npx jest src/modules/checklist/checklist-import-revisao src/modules/checklist/checklist-import-ia` → FAIL
- [ ] **Step 4: Implementar** e registrar o service no módulo (já importa `CreditoModule` e `LegislacaoModule`). Validar `RevisarImportacaoDto` com `ArrayMaxSize(40)`.
- [ ] **Step 5: Rodar** `npx jest && npx tsc --noEmit -p tsconfig.json` (API inteira) → PASS
- [ ] **Step 6: Commit** `Adicionar revisão por IA na importação de checklist`

---

### Task 6: Web, tipos, cliente da API e lógica do painel em lote

**Files:**
- Modify: `apps/web/src/lib/api.ts` (tipos `TemplateItem` ~626, `CriarTemplateItemRequest`, `ImportacaoPreview`; métodos junto de `duplicarItem` ~819)
- Create: `apps/web/src/lib/checklist/configuracao-lote.ts`
- Test: `apps/web/src/lib/checklist/configuracao-lote.test.ts`

**Interfaces:**
- Consumes: contratos das Tasks 2-5 (mesmos nomes de campos).
- Produces em `api.ts`:
  - `TemplateItem.permiteFoto?: boolean`, `permiteObservacao?: boolean`;
  - tipos `TipoRespostaLote`, `OpcaoLote`, `AlteracoesLote`, `ConfigurarLoteRequest`, `ResultadoLote`, `PerguntaImportada`, `ConfiguracaoPerguntaImportada`, `SugestaoPergunta`, `RevisaoGrupoResultado`, `ConfirmarImportacaoRequest`;
  - métodos no mesmo objeto de `duplicarItem`, lendo `response.data.data`:
    - `configurarLote(templateId: string, req: ConfigurarLoteRequest): Promise<ResultadoLote>` (`PUT`);
    - `revisarImportacao(grupo: string, perguntas: PerguntaImportada[]): Promise<RevisaoGrupoResultado>`;
    - `confirmarImportacao(req: ConfirmarImportacaoRequest): Promise<ImportacaoResultado>`.
- Produces em `configuracao-lote.ts`:
  ```ts
  export type SecaoLote = 'tipoResposta' | 'opcoes' | 'permiteFoto' | 'permiteObservacao' | 'obrigatorio' | 'criticidade';
  export interface EstadoLote { ligadas: Record<SecaoLote, boolean>; tipoResposta: TipoRespostaLote; opcoes: OpcaoLote[];
    permiteFoto: boolean; permiteObservacao: boolean; obrigatorio: boolean; criticidade: CriticidadeItem }
  export function estadoInicialLote(): EstadoLote
  export function secoesTravadas(e: EstadoLote): Partial<Record<SecaoLote, string>>
  export function montarAlteracoes(e: EstadoLote): AlteracoesLote
  export function temAlteracao(e: EstadoLote): boolean
  export function resumoRespostasGrupo(itens: TemplateItem[]): { padrao: number; personalizadas: number; texto: number; outros: number }
  ```

Valores fixos:
- `estadoInicialLote`:
  - todas as seções desligadas;
  - `tipoResposta: 'padrao'`;
  - `opcoes` = as 4 de `RESPOSTAS_PADRAO`, com `pontuacao: null` e exigências `false`;
  - `permiteFoto: true`, `permiteObservacao: true`, `obrigatorio: true`, `criticidade: 'media'`.
- Textos de `secoesTravadas`:
  - tipo desligado → `opcoes: 'Ligue "Tipo de resposta" para definir as opções'`;
  - `texto` → `opcoes: 'Não se aplica a respostas em texto'` e `permiteFoto: 'Desativado: respostas em texto não recebem fotos'`;
  - `numero`/`data` → `opcoes: 'Não se aplica a respostas em número ou data'`.
- `montarAlteracoes` inclui só as seções ligadas e não travadas.

- [ ] **Step 1: Testes**
  - `estado inicial não tem alteração` e `temAlteracao true após ligar uma seção` (Review Focus 5).
  - `montarAlteracoes só leva seções ligadas`.
  - `texto trava opcoes e permiteFoto e não os envia`.
  - `opcoes travada com tipo desligado`.
  - `resumoRespostasGrupo conta padrão/personalizadas/texto, ignorando inativos`.
- [ ] **Step 2: Rodar e ver falhar**: `cd apps/web && npx vitest run src/lib/checklist/configuracao-lote.test.ts` → FAIL
- [ ] **Step 3: Implementar** os tipos, os métodos e a lib.
- [ ] **Step 4: Rodar** `npx vitest run src/lib/checklist && npx tsc --noEmit` → PASS
- [ ] **Step 5: Commit** `Adicionar tipos e lógica do painel de configuração em lote no web`

---

### Task 7: Web, painel em lote e modo seleção no editor

**Files:**
- Create: `apps/web/src/components/checklist/painel-configuracao-lote.tsx`
- Create: `apps/web/src/components/checklist/barra-selecao.tsx`
- Modify: `apps/web/src/app/admin/templates/[id]/page.tsx`:
  - `SortableItem` (96-207): checkbox em modo seleção;
  - cabeçalho dos grupos (953-1076): checkbox do grupo;
  - cabeçalho da página (~842): botões;
  - modal de grupo (1135-1173): bloco de respostas;
  - modal de pergunta (1175-1640): switches "Permitir fotos" e "Permitir observação"; com texto, o de fotos fica travado com o motivo.

**Interfaces:**
- Consumes: `estadoInicialLote`, `secoesTravadas`, `montarAlteracoes`, `temAlteracao`, `resumoRespostasGrupo`, `checklistApi.configurarLote` (Task 6).
- Produces:
  - `PainelConfiguracaoLote` com props `{ aberto: boolean; onFechar(): void; templateId: string; escopo: EscopoLote; onAplicado(r: ResultadoLote): void }`, onde `type EscopoLote = { tipo: 'selecao'; itemIds: string[] } | { tipo: 'grupo'; grupoId: string; nome: string; total: number } | { tipo: 'checklist'; total: number }`;
  - `BarraSelecao` com props `{ quantidade: number; onLimpar(): void; onConfigurar(): void }`.

Comportamento (mockups 2-6):
- **Painel:** `ResponsiveDialog` (lateral no desktop, gaveta no mobile).
  - Cada seção tem um `Switch` "Alterar"; seção travada mostra cadeado e o motivo.
  - A cada mudança, simulação com debounce de 400 ms (`simular: true`). O rodapé mostra:
    - "Vai alterar N perguntas";
    - aviso âmbar se `personalizadosSubstituidos > 0` ou `auditoriasVinculadas > 0` (texto do spec §4/§7.2);
    - botão "Aplicar em N perguntas".
  - Ao aplicar com algum aviso, abrir `ConfirmDialog`.
  - Sucesso: toast "Configuração aplicada em N perguntas", `onAplicado`, recarregar o template.
  - Fechar com `temAlteracao` → `ConfirmDialog` de descarte.
- **Editor:**
  - Botões "Configurar todo o checklist" e "Selecionar perguntas" / "Sair da seleção".
  - Em modo seleção: o arrastar fica desativado; o checkbox do grupo marca/desmarca todos e fica indeterminado quando parcial.
  - `BarraSelecao` fixa no rodapé quando `quantidade > 0`.
- **Modal Editar Grupo** (só ao editar um grupo existente): bloco "Respostas das perguntas deste grupo", com os chips de `resumoRespostasGrupo` e o botão "Configurar as N perguntas", que fecha o modal e abre o painel com escopo grupo.

- [ ] **Step 1: Implementar os componentes e a integração no editor**, extraindo o necessário para os arquivos novos sem reescrever o resto da página.
- [ ] **Step 2: Verificar** `cd apps/web && npx tsc --noEmit && npx vitest run` → PASS (inclui `sem-daisyui`)
- [ ] **Step 3: Verificar no navegador** (skill `run`/claude-in-chrome, web em `http://localhost:3031`):
  - selecionar 3 perguntas → aplicar `permiteFoto` off → recarregar e conferir;
  - aplicar tipo texto no grupo → fotos travadas e peso 0;
  - fechar o painel sem tocar em nada não pede confirmação, e fechar depois de tocar pede.
- [ ] **Step 4: Commit** `Adicionar seleção de perguntas e painel de configuração em lote no editor`

---

### Task 8: Web, execução da auditoria respeitando foto/observação

**Files:**
- Modify: `apps/web/src/lib/auditoria/execucao.ts`
- Test: `apps/web/src/lib/auditoria/execucao.test.ts`
- Modify: `apps/web/src/components/auditoria/execucao/painel-item.tsx`
- Modify: `apps/web/src/app/admin/auditoria/[id]/page.tsx`: `getOpcaoConfig` (~530) e as abas `fotos`/`observacao` do modal de documentação. O botão de upload só aparece com `aceitaFoto`.
- Modify: `docs/paridade-plataformas.md` (linha de pendência "Mobile: respeitar permiteFoto/permiteObservacao", coluna Mobile = `pendente`)

**Interfaces:**
- Produces:
  - `aceitaFoto(item: AuditoriaItem): boolean` = `templateItem.permiteFoto !== false && templateItem.tipoRespostaCustomizada !== 'texto'`;
  - `aceitaObservacao(item: AuditoriaItem): boolean` = `templateItem.permiteObservacao !== false`.

- [ ] **Step 1: Testes**:
  - `texto não aceita foto mesmo com permiteFoto indefinido`;
  - `permiteFoto false não aceita foto`;
  - `campos ausentes (itens antigos) aceitam foto e observação`.
- [ ] **Step 2: Rodar e ver falhar**: `npx vitest run src/lib/auditoria/execucao.test.ts` → FAIL
- [ ] **Step 3: Implementar.**
  - Rótulo do botão do `PainelItem`: "Fotos e observação", "Observação" ou "Fotos", conforme o que é aceito.
  - Sem nenhum dos dois e sem fotos/observação existentes → não mostrar o botão.
  - Fotos já existentes continuam visíveis (somente leitura).
  - `getOpcaoConfig` devolve `fotoObrigatoria: false` quando `!aceitaFoto` e `observacaoObrigatoria: false` quando `!aceitaObservacao`.
- [ ] **Step 4: Rodar** `npx vitest run && npx tsc --noEmit` → PASS
- [ ] **Step 5: Commit** `Respeitar permitir foto/observação na execução da auditoria no web`

---

### Task 9: Web, etapa "Revisão da IA" na importação

**Files:**
- Create: `apps/web/src/lib/checklist/revisao-importacao.ts`
- Test: `apps/web/src/lib/checklist/revisao-importacao.test.ts`
- Create: `apps/web/src/components/checklist/importacao/revisao-ia.tsx`, `pergunta-revisada.tsx`
- Modify: `apps/web/src/app/admin/templates/importar/page.tsx` (`Step` na linha 29 ganha `'revisao'` entre `preview` e `config`; o resultado final passa a usar `confirmarImportacao`)

**Interfaces:**
- Consumes: `checklistApi.revisarImportacao`, `confirmarImportacao`, tipos da Task 6.
- Produces:
  ```ts
  export interface EstadoRevisao { perguntas: PerguntaImportada[]; sugestoes: Record<string, SugestaoPergunta>;
    nomesGrupos: Record<string, string>; desfeitas: Set<string>; conferidas: Set<string>; edicoes: Record<string, string> }
  export type AbaRevisao = 'todas' | 'correcao' | 'conferir';
  export function dividirEmLotes(perguntas: PerguntaImportada[], max = 40): { grupo: string; perguntas: PerguntaImportada[] }[]
  export function versaoFinal(e: EstadoRevisao, chave: string): { pergunta: string; configuracao: ConfiguracaoPerguntaImportada }
  export function contadores(e: EstadoRevisao): { corrigidas: number; sugeridas: number; paraConferir: number }
  export function filtrar(e: EstadoRevisao, aba: AbaRevisao): PerguntaImportada[]
  export function aceitarTodas(e: EstadoRevisao): EstadoRevisao
  export function diferencaPalavras(original: string, sugerido: string): { texto: string; alterado: boolean }[]
  export function montarConfirmacao(e: EstadoRevisao, dados: ImportarChecklistRequest): ConfirmarImportacaoRequest
  ```

Regras:
- `versaoFinal`: o texto vem da edição; se não houver, do original (desfeita) ou da sugestão. A configuração vem do original (desfeita), da sugestão ou do original, nessa ordem.
- `paraConferir` exclui as chaves conferidas e as desfeitas.
- `diferencaPalavras`: LCS sobre tokens de `split(/(\s+)/)`.
- `montarConfirmacao` agrupa na ordem original e usa `nomesGrupos[grupo] ?? grupo`.

Comportamento (mockup 1):
- Depois do preview, revisar lote a lote, **em sequência**, com overlay de progresso "Revisando grupo X de Y" no padrão do overlay de PDF.
- Lote `sem_creditos` → não chamar os seguintes; banner "Importação sem revisão da IA (créditos insuficientes)".
- Lote `falha` → banner "Algumas perguntas entraram sem revisão" e seguir.
- Tela de revisão:
  - resumo no topo; abas com contagem; "Aceitar todas as sugestões";
  - por pergunta: original riscado + texto corrigido com destaque, chips roxos para os campos em `alteracoes`, `motivo`/`motivoConferir`;
  - ações com `Tooltip`: "Desfazer sugestões desta pergunta", "Editar texto" (edição inline do texto) e "Está certo" (marca como conferida).
- Lista longa: grupos recolhíveis.

- [ ] **Step 1: Testes da lib**:
  - `dividirEmLotes divide grupo de 90 em 40/40/10 mantendo o nome`;
  - `versaoFinal prioriza edição, depois desfeita, depois sugestão`;
  - `contadores ignora conferidas e desfeitas em paraConferir`;
  - `filtrar 'correcao' traz só alteracoes com 'pergunta'`;
  - `diferencaPalavras marca só "desuso"` para "objetos em dezuso" → "objetos em desuso";
  - `montarConfirmacao usa nome de grupo sugerido`.
- [ ] **Step 2: Rodar e ver falhar**: `npx vitest run src/lib/checklist/revisao-importacao.test.ts` → FAIL
- [ ] **Step 3: Implementar** a lib, os componentes e a etapa na página.
- [ ] **Step 4: Rodar** `npx vitest run && npx tsc --noEmit` → PASS
- [ ] **Step 5: Verificar no navegador** com uma planilha real do cliente, pedida ao Yuri. Conferir:
  - progresso por grupo;
  - correções exibidas;
  - desfazer uma pergunta;
  - confirmar;
  - o template criado no editor com fotos/observação/pontos corretos.
  - Ajustar `mapearTipoResposta` (Task 3) se aparecer um valor de tipo não reconhecido.
- [ ] **Step 6: Commit** `Adicionar etapa de revisão da IA na importação de checklist`
