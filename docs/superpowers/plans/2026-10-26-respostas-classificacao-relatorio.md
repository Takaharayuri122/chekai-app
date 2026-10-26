# Respostas configuráveis, faixas de classificação e relatório ao cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar sentido (positiva/negativa/neutra) e ícone a cada opção de resposta, tornar as faixas de classificação configuráveis por checklist, mostrar um cartão de resultado com histórico na web e no PDF, completar o PDF (dados da avaliação, colunas NA/NR, assinaturas em branco) e enviar o relatório ao cliente por e-mail.

**Architecture:** As regras novas ficam em funções puras na API (`modules/checklist/regras/`) e um espelho no web (`lib/checklist/`), com os mesmos casos de teste dos dois lados (o pacote `packages/shared` não é consumido por API nem web hoje, então não o usamos). Um `ResultadoAuditoriaService` na API monta o cartão de resultado e é a fonte única para o endpoint web e para o PDF. A geração de PDF sai do controller para um service reutilizado pelo envio de e-mail.

**Tech Stack:** NestJS + TypeORM (synchronize off) + Postgres/Supabase, Jest (API); Next.js + shadcn/ui + Tailwind, Vitest (web); Puppeteer para PDF; `EmailService` com provedores SMTP/SendGrid/MailerSend/Resend/Ethereal.

**Spec:** `docs/superpowers/specs/2026-10-26-respostas-classificacao-relatorio-design.md`

## Global Constraints

- Não mexer em `apps/mobile`. Campos novos são opcionais; os valores gravados em `AuditoriaItem.resposta` não mudam.
- Banco: uma migration em `supabase/migrations/<AAAAMMDDHHMMSS>_<nome>.sql`, idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`), terminando com `NOTIFY pgrst, 'reload schema'`. Nada em `scripts/`, nada de migration TypeORM.
- A nota gravada (`Auditoria.pontuacaoTotal`) nunca é recalculada para auditorias finalizadas.
- Sentido gravado prevalece; sem sentido gravado, é deduzido na leitura (nunca escrito no banco por migração).
- Cores: positiva `success`, negativa `destructive`, neutra `warning`; respostas padrão mantêm as cores atuais (N/A `muted`). Sem cor livre por resposta.
- UI: shadcn/ui + tokens da marca (sem DaisyUI — `src/guarda/sem-daisyui.test.ts`), mobile-first, modais com cabeçalho/rodapé fixos, `ConfirmDialog` (nunca `confirm()`), tooltip em toda ação de ícone. Copy sóbria, pt-BR, sem jargão.
- Autorização e isolamento na API (consultor/gestor) para todo endpoint novo.
- Uso de IA respeita a auditoria de tokens (`CreditoService`) já existente no fluxo de importação.
- Commits em pt-BR terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Testes: API `npm test --workspace=@meta-app/api -- <arquivo>`; web `npm test --workspace=@meta-app/web -- <arquivo>`; tipos `npx tsc --noEmit -p apps/api` e `npx tsc --noEmit -p apps/web`.

## Review Focus

1. Opção personalizada cujo texto é "N/A", "Não se aplica" ou "Não aplicável" ficando por último numa lista sem pontuação: a regra "menor pontuação = negativa" a marcaria como não conformidade. Esperado: neutra. (Ruling deste plano: rótulo que normaliza para N/A é neutro na dedução.) — teste na Task 1.
2. Pergunta de texto/número/data (sem opções) ou item sem `templateItem` carregado: nunca é não conformidade e não quebra a contagem. — teste na Task 1.
3. Faixas com lacuna (ex.: 0–49,99 e 60–100) e nota 55: mostra "Sem classificação", não quebra a barra. Nota negativa: "Abaixo do mínimo". — teste na Task 1.
4. Falha do provedor de e-mail ou PDF ao finalizar: a finalização responde sucesso e o envio fica registrado com erro. — teste na Task 6.
5. Unidade sem e-mail e cliente sem e-mail: não envia, registra "sem destinatário". Destinatários manuais inválidos são recusados com 400. — teste na Task 6.

---

### Task 1: Regras puras na API — pontuação, sentido, ícones e faixas

**Files:**
- Create: `apps/api/src/modules/checklist/regras/pontuacao.ts`, `regras/sentido.ts`, `regras/faixas.ts`, `regras/icones.ts`, `regras/index.ts`
- Test: `apps/api/src/modules/checklist/regras/sentido.spec.ts`, `regras/faixas.spec.ts`
- Modify: `apps/api/src/modules/auditoria/auditoria.service.ts:408-450` e `apps/api/src/modules/auditoria/services/relatorio-html.service.ts:~1160-1210` (passam a importar de `regras/pontuacao.ts`, removendo as cópias privadas)

**Interfaces:**
- Produces (todos exportados por `modules/checklist/regras`):
  - `type ItemComOpcoes = Pick<TemplateItem, 'tipoRespostaCustomizada' | 'usarRespostasPersonalizadas' | 'opcoesResposta' | 'opcoesRespostaConfig'>`
  - `isOpcaoSemPontuacao(valor: string): boolean` — `nao_aplicavel`/`nao_avaliado` (movida, mesmo comportamento)
  - `calcularPontuacaoOpcao(item: ItemComOpcoes | null | undefined, valor: string): number` e `getPontuacaoMaximaItem(item): number` — movidas sem mudar comportamento
  - `type SentidoResposta = 'positiva' | 'negativa' | 'neutra'`
  - `sentidoDaOpcao(item: ItemComOpcoes | null | undefined, valor: string | null | undefined): SentidoResposta | null` — `null` para não respondida (`nao_avaliado`, vazio) e para perguntas TEXTO/NUMERO/DATA
  - `ehNaoConformidade(item, valor): boolean` = `sentidoDaOpcao(...) === 'negativa'`
  - `ICONES_RESPOSTA: readonly { codigo: string; emoji: string; rotulo: string }[]` e `ICONE_PADRAO_POR_SENTIDO: Record<SentidoResposta, string>` (✓ / ✗ / —)
  - `interface FaixaClassificacao { nome: string; cor: string; emoji: string | null; de: number; ate: number }`
  - `FAIXAS_PADRAO: FaixaClassificacao[]` — Crítico 0–59,99 · Atenção Necessária 60–69,99 · Regular 70–79,99 · Bom 80–89,99 · Com Excelência 90–100
  - `validarFaixas(faixas: FaixaClassificacao[]): string[]` — mensagens de erro em pt-BR; vazio = válido
  - `classificar(nota: number, faixas?: FaixaClassificacao[] | null): { nome: string; cor: string | null; emoji: string | null; faixa: FaixaClassificacao | null }` — `faixas` nulo/vazio usa `FAIXAS_PADRAO`
  - Mesmo `OpcaoRespostaConfig` com campos novos opcionais `sentido?: SentidoResposta | null` e `icone?: string | null` (atualizar o tipo na entidade `template-item.entity.ts:105-110`)

Regra de dedução (`sentidoDaOpcao`), na ordem:
1. Pergunta TEXTO/NUMERO/DATA, valor vazio ou `nao_avaliado` → `null`.
2. Config da opção tem `sentido` → ele.
3. Valores padrão: `conforme` positiva, `nao_conforme` negativa, `nao_aplicavel` neutra.
4. Rótulo que, sem acento/caixa/pontuação, é `na`, `n a`, `nao se aplica`, `nao aplicavel` → neutra.
5. Entre as opções do item que pontuam (excluindo as dos passos 3–4 neutras), calcula `calcularPontuacaoOpcao` de cada; se todas iguais ou só uma → neutra; maior → positiva; menor → negativa; demais → neutra.

- [ ] **Step 1: Escrever os testes que falham**

`sentido.spec.ts` (`describe('sentidoDaOpcao')`):
- `['Sim','Não']` sem config → Sim `positiva`, Não `negativa`
- `['Sim','Parcial','Não']` sem config → `positiva` / `neutra` / `negativa`
- `['Sim','Não','N/A']` sem config → N/A `neutra`, Não `negativa`
- config `{valor:'Não', sentido:'positiva'}` → `positiva` (gravado prevalece)
- config com pontuações Sim=2, Não=2 → ambas `neutra`
- respostas padrão: `conforme`→positiva, `nao_conforme`→negativa, `nao_aplicavel`→neutra, `nao_avaliado`→`null`
- `tipoRespostaCustomizada: TEXTO` → `null`; item `null` → `null`
- `ehNaoConformidade` true só para negativa

`faixas.spec.ts`:
- `classificar(95)` → `nome: 'Com Excelência'`; `classificar(59.99)` → `'Crítico'`; `classificar(60)` → `'Atenção Necessária'`
- `classificar(-5)` → `{ nome: 'Abaixo do mínimo', faixa: null }`
- faixas `[{0–49.99},{60–100}]`, `classificar(55, faixas)` → `{ nome: 'Sem classificação', faixa: null }`
- `validarFaixas` acusa: nome vazio ou >20 caracteres, cor fora de `#RRGGBB`, `de >= ate`, fora de 0–100, sobreposição (`[{0–50},{50–100}]` é sobreposição), lista vazia; aceita `FAIXAS_PADRAO`

- [ ] **Step 2: Rodar e ver falhar** — `npm test --workspace=@meta-app/api -- regras` → FAIL (módulos inexistentes)
- [ ] **Step 3: Implementar os arquivos de `regras/`** e trocar as cópias privadas em `auditoria.service.ts` e `relatorio-html.service.ts` pelos imports. `ICONES_RESPOSTA` com ~12 opções: ✓ ✗ 👍 👎 🙂 😐 🙁 ⚠️ ⭐ 🟢 🟡 🔴. Cores padrão das faixas: tons da paleta da marca (vermelho, laranja, amarelo, verde-claro, verde) em hex.
- [ ] **Step 4: Rodar a suíte da API inteira** — `npm test --workspace=@meta-app/api` → PASS (garante que mover a pontuação não mudou nada)
- [ ] **Step 5: Commit** — `Criar regras de sentido, ícone e faixas de classificação`

---

### Task 2: Banco, entidades e validação dos checklists

**Files:**
- Create: `supabase/migrations/20261026120000_respostas_classificacao_relatorio.sql`
- Create: `apps/api/src/modules/auditoria/entities/auditoria-envio-relatorio.entity.ts`
- Modify: `apps/api/src/modules/checklist/entities/checklist-template.entity.ts`, `dto/criar-checklist-template.dto.ts` (`OpcaoRespostaConfigDto` + DTO de template), `dto/configurar-lote.dto.ts` (`OpcaoLoteDto`), `checklist-regras.ts` (`normalizarOpcoesConfig` e `aplicarTipoResposta` preservam `sentido`/`icone`), service de checklist (valida faixas)
- Test: `apps/api/src/modules/checklist/checklist-regras.spec.ts` (ou o spec existente do lote)

**Interfaces:**
- Consumes: `validarFaixas`, `FaixaClassificacao`, `SentidoResposta`, `ICONES_RESPOSTA` (Task 1)
- Produces:
  - `ChecklistTemplate.faixasClassificacao: FaixaClassificacao[] | null` (coluna `faixas_classificacao jsonb null`)
  - `ChecklistTemplate.enviarRelatorioAoFinalizar: boolean` (coluna `enviar_relatorio_ao_finalizar boolean not null default false`)
  - Entidade `AuditoriaEnvioRelatorio` (tabela `auditoria_envios_relatorio`): `id uuid pk`, `auditoriaId` (`auditoria_id uuid not null references auditorias(id) on delete cascade`), `destinatarios text[] not null`, `automatico boolean not null`, `enviadoPorId uuid null` (`enviado_por_id references usuarios(id)`), `sucesso boolean not null`, `erro text null`, `criadoEm timestamptz default now()`; índice por `auditoria_id`. Registrar no `TypeOrmModule.forFeature` do módulo de auditoria.
  - DTOs aceitam `sentido` (`IsIn(['positiva','negativa','neutra'])`, opcional, nulo) e `icone` (`IsString`, opcional, nulo, ≤ 32 caracteres) por opção; template aceita `faixasClassificacao` (array validado, ou `null` para voltar ao padrão) e `enviarRelatorioAoFinalizar` (`IsBoolean` opcional). Faixas inválidas → `BadRequestException` com as mensagens de `validarFaixas` unidas.

- [ ] **Step 1: Testes que falham** — `normalizarOpcoesConfig` mantém `sentido: 'negativa', icone: '👎'` de uma opção existente; `aplicarTipoResposta` em lote com `OpcaoLote` contendo `sentido`/`icone` grava os dois; atualizar template com faixas sobrepostas lança `BadRequestException`; `faixasClassificacao: null` é aceito.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** entidades, DTOs, normalização, validação, e a migration (conferir nomes reais das tabelas `checklist_templates`, `auditorias`, `usuarios` antes de escrever; `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `NOTIFY pgrst, 'reload schema'`).
- [ ] **Step 4: Rodar** `npm test --workspace=@meta-app/api` e `npx tsc --noEmit -p apps/api` → PASS
- [ ] **Step 5: Commit** — `Guardar sentido e ícone das respostas, faixas e opção de envio no checklist`

---

### Task 3: Não conformidade pelo sentido em toda a API

**Files:**
- Modify: `apps/api/src/modules/auditoria/auditoria.service.ts` (~559 `buscarItensNaoConformes`, ~652, ~674), `services/relatorio-html.service.ts` (~980-1010 ícone/rótulo, ~1236 contagem), `modules/ia/ia.service.ts:468`, `modules/plano-acao/plano-acao.service.ts:90` (`gerarDaAuditoria`)
- Rodar `grep -rn "nao_conforme\|NAO_CONFORME" apps/api/src --include=*.ts | grep -v spec` e tratar todo uso que *conta ou filtra* não conformidade (validações de valor permitido continuam como estão).
- Test: `plano-acao.service.spec.ts`, spec de `auditoria.service` existente

**Interfaces:**
- Consumes: `ehNaoConformidade(item, valor)` (Task 1)
- Onde o filtro era `where: { resposta: 'nao_conforme' }`, carregar os itens da auditoria com `templateItem` e filtrar em código.

- [ ] **Step 1: Testes que falham** — `gerarDaAuditoria` com item respondido `'Não'` num template `['Sim','Não']` cria 1 tarefa; com `'Sim'` cria 0; com `nao_conforme` continua criando 1. `buscarItensNaoConformes` devolve o item `'Não'`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar a suíte da API** → PASS
- [ ] **Step 5: Commit** — `Contar não conformidades pelo sentido da resposta` + regra `RN-CHK-019` em `docs/regras-de-negocio.md` (sentido da resposta, dedução, ícone) com entrada no changelog do arquivo

---

### Task 4: Resultado da auditoria (cartão) na API

**Files:**
- Create: `apps/api/src/modules/auditoria/services/resultado-auditoria.service.ts` + `.spec.ts`
- Modify: `auditoria.service.ts` (`listarHistoricoPorUnidade(unidadeId, usuario, templateId?)`), `auditoria.controller.ts` (query `templateId` em `GET historico-unidade/:unidadeId`; novo `GET :id/resultado`), `auditoria.module.ts`

**Interfaces:**
- Consumes: `classificar`, `FAIXAS_PADRAO`, `ehNaoConformidade`, `calcularPontuacaoOpcao`, `getPontuacaoMaximaItem` (Task 1); `ChecklistTemplate.faixasClassificacao` (Task 2)
- Produces:
```ts
interface ResultadoAuditoria {
  aproveitamento: number;            // finalizada: pontuacaoTotal gravada; senão recalculada
  classificacao: { nome: string; cor: string | null; emoji: string | null };
  faixas: FaixaClassificacao[];      // do checklist ou FAIXAS_PADRAO
  tendencia: 'subiu' | 'caiu' | 'igual' | null; // vs. anterior finalizada da mesma unidade+checklist
  anteriores: { id: string; dataFim: string; aproveitamento: number }[]; // até 3, mais recente primeiro, excluindo a própria
  contadores: { pontosPossiveis: number; pontosRealizados: number; naoConformidades: number; fotos: number; planosAcao: number };
  grupos: { nome: string; aproveitamento: number | null; pontosPossiveis: number; pontosRealizados: number; naoAplicaveis: number; naoConformidades: number; naoRespondidas: number }[];
}
ResultadoAuditoriaService.calcular(auditoria: Auditoria /* com itens, templateItem, fotos, template, unidade */, usuario): Promise<ResultadoAuditoria>
```
  - `GET /auditorias/:id/resultado` → `ResultadoAuditoria` (usa `buscarAuditoriaPorId` para isolamento)
  - "Anteriores" só de auditorias **finalizadas** com `dataFim` anterior à da atual (ou todas, se a atual não estiver finalizada).
  - `planosAcao` = contagem de `PlanoAcaoTarefa` com `auditoriaId`.
  - `naoRespondidas` = itens com resposta vazia ou `nao_avaliado`; `naoAplicaveis` = sentido neutro com valor `nao_aplicavel` ou rótulo N/A.

- [ ] **Step 1: Testes que falham** — auditoria finalizada com `pontuacaoTotal: 82.5` e itens que recalculariam 90 → `aproveitamento: 82.5` e `classificacao.nome: 'Bom'`; anteriores com notas [85, 70, 60, 90] (da mais recente para a mais antiga) → devolve só as 3 primeiras e `tendencia: 'caiu'` (82,5 < 85, a imediatamente anterior); sem anteriores → `tendencia: null`; template com faixas próprias → usa elas; contador `naoConformidades` conta resposta personalizada `'Não'`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar a suíte** → PASS
- [ ] **Step 5: Commit** — `Calcular o resultado da auditoria com faixas e histórico` + `RN-CHK-020` (faixas de classificação) no `regras-de-negocio.md`

---

### Task 5: PDF do relatório

**Files:**
- Create: `apps/api/src/modules/auditoria/services/relatorio-auditoria-pdf.service.ts` (extrai a lógica de `auditoria.controller.ts:268-375`)
- Modify: `auditoria.controller.ts` (o endpoint `GET :id/pdf` vira chamada ao service), `services/relatorio-html.service.ts`, `services/relatorio-pdf-puppeteer.service.ts` (`gerarPdf(auditoria, resultado)` em vez de `historico`)
- Test: `services/relatorio-html.service.spec.ts`, `relatorio-auditoria-pdf.service.spec.ts`

**Interfaces:**
- Consumes: `ResultadoAuditoriaService.calcular` (Task 4); `sentidoDaOpcao`, `ICONE_PADRAO_POR_SENTIDO`, `ICONES_RESPOSTA` (Task 1)
- Produces: `RelatorioAuditoriaPdfService.obterPdf(auditoriaId: string, usuario): Promise<{ buffer: Buffer; url: string }>` — exige finalizada (`BadRequestException` como hoje); regenera quando não há PDF, quando `auditoria.atualizadoEm > pdfGeradoEm` **ou** `template.atualizadoEm > pdfGeradoEm`; senão reaproveita do bucket.

Conteúdo do HTML (`gerarHtml(auditoria, resultado)`):
- Topo: checklist, cliente/unidade, auditor, código (`id.slice(0, 8).toUpperCase()`), início, fim, duração, "Ver no mapa" (`https://www.google.com/maps?q=<latInicio>,<lngInicio>`, só com coordenadas).
- Cartão: emoji + percentual (2 casas, vírgula) + ▲/▼, nome da faixa na cor da faixa, barra com um segmento por faixa (largura ∝ `ate - de`) e marcador na posição da nota, até 3 anteriores (data `dd/MM/yy` + percentual), contadores (pontos possíveis, realizados, não conformidades, fotos, planos de ação).
- Tabela por grupo: colunas AP, PP, PR, NA, NC, NR + linha "Geral" + legenda "AP: Aproveitamento | PP: Pontos possíveis | PR: Pontos realizados | NA: Não aplicáveis | NC: Não conformidades | NR: Não respondidas".
- Pergunta: ícone configurado da opção (ou `ICONE_PADRAO_POR_SENTIDO`) na cor do sentido; não respondida "?". Rótulo da resposta = texto da opção (padrão: "Conforme", "Não conforme", "Não aplicável").
- Página final: quadro de resumo (checklist, unidade, início, fim, duração, auditor, aproveitamento, faixa, pontos possíveis/realizados, não conformidades); linha `____________________, ____ de ______________ de ________`; duas linhas de assinatura com o nome do auditor e `unidade.responsavel` embaixo.
- Remover a seção `gerarHistoricoEvolucao` se ela só repetir o que o cartão já mostra; manter gráficos e resumo executivo.

- [ ] **Step 1: Testes que falham** (no HTML gerado): contém `RESUMO`/assinaturas com `unidade.responsavel`; contém a legenda NA/NR; resposta `'Não'` de template `['Sim','Não']` renderiza o ícone de negativa; opção com `icone: '👎'` renderiza `👎`; sem coordenadas não há link de mapa. `obterPdf` regenera quando `template.atualizadoEm > pdfGeradoEm`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar a suíte + gerar um PDF real local** (`GET /api/auditorias/<id>/pdf` com a API rodando) e abrir para conferir emoji, barra e quebra de página
- [ ] **Step 5: Commit** — `Completar o PDF com dados da avaliação, cartão de resultado e assinaturas` + `RN-REL-014` (conteúdo do relatório)

---

### Task 6: Envio do relatório por e-mail

**Files:**
- Modify: `apps/api/src/modules/email/email.service.ts` (anexos em todos os provedores), `nest-cli.json` (se o glob de assets não cobrir o template novo)
- Create: `apps/api/src/modules/email/templates/relatorio-auditoria.html`
- Create: `apps/api/src/modules/auditoria/services/envio-relatorio.service.ts` + `.spec.ts`, `dto/enviar-relatorio.dto.ts`
- Modify: `auditoria.service.ts` (`finalizarAuditoria` dispara o envio), `auditoria.controller.ts`, `auditoria.module.ts`

**Interfaces:**
- Consumes: `RelatorioAuditoriaPdfService.obterPdf` (Task 5), `ResultadoAuditoriaService.calcular` (Task 4), `AuditoriaEnvioRelatorio` e `enviarRelatorioAoFinalizar` (Task 2)
- Produces:
  - `EmailService.enviarEmail(destinatario: string | string[], assunto: string, html: string, anexos?: { nome: string; conteudo: Buffer; tipo: string }[]): Promise<void>` — compatível com as chamadas atuais
  - `EnvioRelatorioService.enviar(auditoriaId: string, opcoes: { destinatarios?: string[]; usuario?: UsuarioAutenticado; automatico: boolean }): Promise<AuditoriaEnvioRelatorio>` — nunca lança por falha de e-mail/PDF: grava `sucesso: false, erro` e devolve o registro
  - `EnvioRelatorioService.destinatariosPadrao(auditoria): string[]` — `[unidade.email]`, senão `[cliente.email]`, senão `[]`
  - `POST /auditorias/:id/enviar-relatorio` body `{ destinatarios?: string[] }` (cada um `IsEmail`, 1–5) → registro; exige finalizada e acesso à auditoria
  - `GET /auditorias/:id/envios-relatorio` → registros, mais recente primeiro
  - Em `finalizarAuditoria`: após salvar, se `template.enviarRelatorioAoFinalizar`, chama `enviar(id, { automatico: true })` sem `await` na resposta (`void ...catch(log)`)
- E-mail: assunto `Relatório de auditoria — <unidade> — <dd/MM/yyyy>`; corpo curto: unidade, checklist, data, aproveitamento e faixa, auditor; PDF anexado como `relatorio-<codigo>.pdf` quando ≤ 8 MB; acima disso, link assinado do Supabase Storage válido por 30 dias no corpo.
- Sem destinatário: registro `sucesso: false, erro: 'Unidade e cliente sem e-mail cadastrado'`.

- [ ] **Step 1: Testes que falham** — destinatário padrão unidade → cliente → vazio; PDF de 9 MB manda link e não anexo; `EmailService` rejeitando → registro `sucesso: false` e `enviar` resolve; `finalizarAuditoria` com opção ligada chama `enviar` com `automatico: true` e com a opção desligada não chama; e-mail inválido no POST → 400.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** (conferir o formato de anexo de cada provedor: nodemailer `attachments`, SendGrid `attachments[].content` base64, MailerSend `attachments[].content` base64, Resend `attachments[].content`)
- [ ] **Step 4: Rodar a suíte + teste manual com Ethereal** (abrir o link de preview que o log imprime e conferir o anexo)
- [ ] **Step 5: Commit** — `Enviar o relatório da auditoria ao cliente por e-mail` + `RN-EML-005`

---

### Task 7: Espelho das regras no web e tipos

**Files:**
- Create: `apps/web/src/lib/checklist/sentido.ts`, `lib/checklist/faixas.ts`, `lib/checklist/icones.ts` + `sentido.test.ts`, `faixas.test.ts`
- Modify: `apps/web/src/lib/api.ts` (tipos `OpcaoRespostaConfig` com `sentido`/`icone`; `ChecklistTemplate` com `faixasClassificacao`/`enviarRelatorioAoFinalizar`; `ResultadoAuditoria`; `AuditoriaEnvioRelatorio`; métodos `obterResultado(id)`, `enviarRelatorio(id, destinatarios?)`, `listarEnviosRelatorio(id)`, `listarHistoricoUnidade(unidadeId, templateId?)`)

**Interfaces:**
- Produces (mesmos nomes e semântica da Task 1): `sentidoDaOpcao`, `ehNaoConformidade`, `ICONES_RESPOSTA`, `ICONE_PADRAO_POR_SENTIDO`, `FAIXAS_PADRAO`, `validarFaixas`, `classificar`, e `calcularPontuacaoOpcao`/`isOpcaoSemPontuacao` (hoje o web repete essa conta inline em `app/admin/templates/[id]/page.tsx` e `novo/page.tsx`).
- `classeDoSentido(sentido: SentidoResposta | null): string` — classes Tailwind com os tokens (`border-success bg-success/12 text-success`, `destructive`, `warning`).

- [ ] **Step 1: Testes que falham** — copiar exatamente os casos dos specs da Task 1 para Vitest
- [ ] **Step 2: Rodar e ver falhar** — `npm test --workspace=@meta-app/web -- lib/checklist`
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar** web tests + `npx tsc --noEmit -p apps/web` → PASS
- [ ] **Step 5: Commit** — `Espelhar no web as regras de sentido e faixas`

---

### Task 8: Configurar sentido e ícone das respostas (web + importação pela IA)

**Files:**
- Create: `apps/web/src/components/checklist/seletor-sentido-icone.tsx` (+ teste)
- Modify: `apps/web/src/app/admin/templates/[id]/page.tsx` (~1690-1870, linhas das opções), `app/admin/templates/novo/page.tsx` (~1450-1610), `components/checklist/editor-respostas-lote.tsx`, `components/checklist/importacao/pergunta-revisada.tsx`
- Modify (API): `apps/api/src/modules/checklist/checklist-import-revisao.ts` (~95 prompt e ~127 mapeamento) + spec

**Interfaces:**
- Consumes: Task 7 (`sentidoDaOpcao`, `ICONES_RESPOSTA`, `ICONE_PADRAO_POR_SENTIDO`, `classeDoSentido`)
- Produces: `<SeletorSentidoIcone sentido icone sentidoDeduzido onChange={(v: { sentido: SentidoResposta | null; icone: string | null }) => void} />` — três botões segmentados (Positiva / Neutra / Negativa) pré-marcados com o sentido deduzido quando não há gravado, mais um popover com a grade de `ICONES_RESPOSTA` e "Sem ícone"; tooltips; alvo de toque ≥ 40px.
- Ao mudar só a pontuação, o sentido não gravado acompanha a nova dedução; uma vez escolhido pelo gestor, fica gravado.
- Prompt da importação: acrescentar `"sentido": "positiva" | "negativa" | "neutra"` ao formato de `opcoes`; mapeamento aceita só esses três valores (outro valor → omitido, cai na dedução).

- [ ] **Step 1: Testes que falham** — componente: mostra o deduzido marcado e emite `{sentido:'negativa', icone:'👎'}` ao escolher; API: `mapearRevisao` preserva `sentido` válido e descarta `'ruim'`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** nos quatro editores
- [ ] **Step 4: Rodar testes web/API + conferir no navegador** (`next dev --port 3031`) editar uma pergunta "Sim / Não", trocar ícone, salvar e reabrir
- [ ] **Step 5: Commit** — `Permitir escolher o sentido e o ícone de cada resposta`

---

### Task 9: Faixas e envio automático na tela do checklist

**Files:**
- Create: `apps/web/src/components/checklist/editor-faixas-classificacao.tsx` (+ teste)
- Modify: `apps/web/src/app/admin/templates/[id]/page.tsx` (formulário de dados do checklist, ~262 e ~402-428)

**Interfaces:**
- Consumes: `FAIXAS_PADRAO`, `validarFaixas`, `ICONES_RESPOSTA` (Task 7); `faixasClassificacao`, `enviarRelatorioAoFinalizar` no tipo do template
- Produces: `<EditorFaixasClassificacao valor={FaixaClassificacao[] | null} onChange={(f: FaixaClassificacao[] | null) => void} />`
  - Seção "Classificação": explica em uma frase o que são as faixas; lista com nome (contador x/20), cor (paleta curta + campo `#RRGGBB`), emoji (mesma grade de ícones), de, até (aceita vírgula decimal); "Nova faixa"; remover com `ConfirmDialog`; "Voltar ao padrão" envia `null`; prévia da barra colorida; erros de `validarFaixas` inline e botão salvar desabilitado enquanto inválido; aviso (não bloqueante) para lacunas.
  - No mobile, cada faixa vira um card empilhado.
  - Switch "Enviar o relatório ao cliente quando a auditoria for finalizada" com texto de apoio "Vai para o e-mail da unidade; se não houver, para o e-mail do cliente."

- [ ] **Step 1: Testes que falham** — editor: adicionar faixa sobreposta mostra erro e `onChange` não é chamado com valor inválido; "Voltar ao padrão" emite `null`
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar testes + conferir no navegador** (desktop e largura 375px)
- [ ] **Step 5: Commit** — `Configurar faixas de classificação e envio automático no checklist`

---

### Task 10: Execução da auditoria com ícone e sentido

**Files:**
- Modify: `apps/web/src/components/auditoria/execucao/respostas-item.tsx` (botões personalizados ~87-103; `classeSelecionada` ~20-23), `lista-secoes.tsx` (~11-19), `revisao-final.tsx`, `lib/auditoria/execucao.ts`, `components/ui/status-chip.tsx` (ou onde estiver), modal de `app/admin/auditoria/[id]/page.tsx` (`statusItem()` ~410/833)
- Test: `lib/auditoria/execucao.test.ts`, teste de `respostas-item` se existir

**Interfaces:**
- Consumes: `sentidoDaOpcao`, `ehNaoConformidade`, `classeDoSentido`, `ICONE_PADRAO_POR_SENTIDO` (Task 7)
- Botão de opção personalizada: ícone configurado (se houver) + texto; selecionado pinta com `classeDoSentido(sentidoDaOpcao(item, opcao))`. Respostas padrão mantêm exatamente o visual atual. Contagens/realces de não conformidade na lista e na revisão usam `ehNaoConformidade`.

- [ ] **Step 1: Testes que falham** — em `execucao.test.ts` (ou onde a contagem de NC da revisão vive): item `['Sim','Não']` respondido `'Não'` conta como não conformidade
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Rodar testes + conferir no navegador** respondendo uma auditoria com perguntas padrão e personalizadas
- [ ] **Step 5: Commit** — `Mostrar ícone e sentido das respostas na execução`

---

### Task 11: Relatório web — cartão de resultado e envio ao cliente

**Files:**
- Create: `apps/web/src/components/auditoria/relatorio/cartao-resultado.tsx`, `components/auditoria/relatorio/enviar-relatorio-modal.tsx`, `components/auditoria/relatorio/envios-relatorio.tsx` (+ testes do cartão)
- Modify: `apps/web/src/app/admin/auditoria/[id]/relatorio/page.tsx` (remover `getClassificacao` ~271 e o recálculo ~131-144 para finalizadas; contagem de NC ~132), `app/auditoria/[id]/relatorio/page.tsx` (~259, ~355)

**Interfaces:**
- Consumes: `api.obterResultado`, `api.enviarRelatorio`, `api.listarEnviosRelatorio` (Task 7); `ResultadoAuditoria` (Task 4)
- Produces: `<CartaoResultado resultado={ResultadoAuditoria} />` — esquerda: emoji, percentual (`90,36 %`), seta ▲ (`text-success`) / ▼ (`text-destructive`) com tooltip "Comparado com a avaliação anterior", nome da faixa na cor da faixa, barra de faixas com marcador, até 3 anteriores; direita: 5 contadores com ícones lucide. No mobile empilha.
- `<EnviarRelatorioModal auditoriaId emailSugerido onEnviado />` — campo de e-mails (vírgula), confirmação, estados de envio/erro; cabeçalho/rodapé fixos.
- `<EnviosRelatorio auditoriaId />` — "Relatório enviado para X em DD/MM às HH:MM" ou falha com "Tentar de novo".
- Botão "Enviar ao cliente" (ícone `Mail` + texto) só para auditoria finalizada.

- [ ] **Step 1: Testes que falham** — cartão: `tendencia: 'caiu'` mostra ▼; sem anteriores não mostra seta nem a linha de histórico; `classificacao.nome` aparece
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar** e trocar as duas páginas para usar o cartão e a nota de `resultado.aproveitamento`
- [ ] **Step 4: Rodar web tests, `tsc`, `src/guarda/sem-daisyui.test.ts` e conferir no navegador** (relatório de auditoria finalizada; enviar para um e-mail de teste com Ethereal)
- [ ] **Step 5: Commit** — `Mostrar o cartão de resultado e enviar o relatório ao cliente pela web` + atualizar `docs/paridade-plataformas.md` (mobile ainda sem ícone/sentido, faixas, cartão e envio)

---

## Ordem e dependências

1 → 2 → 3 → 4 → 5 → 6 (API, sequencial) · 7 depende de 2 (tipos) · 8, 9, 10 dependem de 7 · 11 depende de 4, 6 e 7.
