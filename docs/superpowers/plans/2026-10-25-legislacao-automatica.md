# Legislação automática Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar legislação só com link/título/informações, ler a página (ou PDF/texto colado) automaticamente para preencher dados e trechos da IA, e trocar todo texto livre de legislação por seleção de legislações cadastradas, com permissão por usuário.

**Architecture:** API NestJS ganha funções puras (`legislacao/lib/`) para nome curto, chave de referência, divisão em trechos, URL segura e extração de texto; um `LegislacaoLeituraService` roda a leitura em segundo plano; vínculos N:N entre itens (template/auditoria) e legislações mantêm o texto legado derivado para o mobile. Web ganha telas de legislação reescritas, um `SeletorLegislacoes` reutilizável e a permissão no cadastro de usuários.

**Tech Stack:** NestJS 10 + TypeORM (Postgres/Supabase, pgvector), class-validator, Jest; `cheerio` + `pdf-parse` (novos); OpenAI embeddings `text-embedding-3-small`; DeepSeek `deepseek-chat` via SDK openai; Next.js + shadcn + cmdk, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-legislacao-automatica-design.md`

## Global Constraints

- Não alterar nada em `apps/mobile`. `legislacaoReferencia` (TemplateItem) e `referenciaLegal` (AuditoriaItem e respostas de `/ia/*`) continuam strings.
- Schema só por script SQL idempotente em `scripts/legislacao-automatica.sql` + linha em `docs/DEPLOY.md` (seção "Scripts SQL antes do deploy da API"). Sem migrations TypeORM.
- Colunas: `legislacoes`/`template_itens`/`auditoria_itens` em camelCase entre aspas (sem `name:`); `usuarios` e tabelas novas de vínculo e `plano_acao_tarefas` em snake_case (`name:`).
- Autorização na API. Regra efetiva: `perfil === MASTER || (perfil === GESTOR && podeGerenciarLegislacoes)`.
- ValidationPipe é `whitelist + forbidNonWhitelisted`: todo campo novo enviado pela web precisa existir no DTO.
- IA: auditar tokens com `CreditoService` (MASTER não paga; GESTOR paga do próprio saldo; AUDITOR paga do gestor) — `metodoChamado` `'lerLegislacao'` (DeepSeek) e `'gerarEmbeddingsLegislacao'` (OpenAI `text-embedding-3-small`).
- Web: shadcn + tokens da marca, sem DaisyUI (`src/guarda/sem-daisyui.test.ts`), `ConfirmDialog` (nunca `confirm()`), Tooltip em ações de ícone, modais com cabeçalho/rodapé fixos, mobile-first, copy pt-BR sóbria sem jargão (dizer "trechos", nunca RAG/embedding/chunk).
- Commits em pt-BR terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git add` só dos arquivos tocados; não fazer push.
- Verificação: `cd apps/api && npx jest && npx tsc --noEmit -p tsconfig.json`; `cd apps/web && npx vitest run && npx tsc --noEmit`.

## Review Focus

- Página que responde 200 mas é tela de erro/firewall ou casca vazia (ex.: 503 do F5 em `bvsms`, ou HTML só com menu) → leitura `falhou` com a mensagem de plano B, sem apagar trechos anteriores (teste no Task 4).
- Link que redireciona para IP privado (`http://exemplo.gov.br` → `http://169.254.169.254/`) → recusado (teste no Task 2, `validarUrlPublica` com resolver falso; e no Task 4, redirect seguido manualmente).
- Cliente antigo/mobile que faz `PUT` de item sem `legislacaoIds` → vínculos existentes preservados e `referenciaLegal` enviado aceito como hoje (teste no Task 5).
- Gestor que perde a permissão com sessão aberta → 403 já na próxima chamada (a regra é lida no `JwtStrategy.validate`, teste no Task 3).
- Texto antigo com várias normas ("RDC 216/2004; Portaria CVS 5/2013") → cada uma liga à sua legislação quando cadastrada (teste no Task 2 `chavesNoTexto` e Task 4 ligação).

---

### Task 1: Schema, entidades e configuração de créditos

**Files:**
- Create: `scripts/legislacao-automatica.sql`
- Modify: `apps/api/src/modules/legislacao/entities/legislacao.entity.ts`, `apps/api/src/modules/checklist/entities/template-item.entity.ts`, `apps/api/src/modules/auditoria/entities/auditoria-item.entity.ts`, `apps/api/src/modules/usuario/entities/usuario.entity.ts`, `apps/api/src/modules/plano-acao/entities/plano-acao-tarefa.entity.ts`, `apps/api/src/modules/credito/configuracao-credito.service.ts`, `scripts/supabase-busca-vetorial-function.sql`, `docs/DEPLOY.md`
- Test: `apps/api/src/modules/credito/configuracao-credito.service.spec.ts` (criar se não existir)

**Interfaces:**
- Produces: `Legislacao` com `numero: string | null`, `ano: number | null`, `informacoes`, `situacao: SituacaoLegislacao | null`, `dataPublicacao: string | null`, `statusLeitura: StatusLeitura`, `erroLeitura`, `lidoEm`, `origemTexto: OrigemTexto | null`, `criadoPorId`; enums exportados do arquivo da entidade: `SituacaoLegislacao { VIGENTE='vigente', VIGENTE_COM_ALTERACOES='vigente_com_alteracoes', REVOGADA='revogada' }`, `StatusLeitura { PENDENTE='pendente', LENDO='lendo', CONCLUIDA='concluida', FALHOU='falhou' }`, `OrigemTexto { LINK='link', PDF='pdf', TEXTO='texto' }` (colunas varchar, não enum de banco). `TemplateItem.legislacoes: Legislacao[]` (`@ManyToMany` + `@JoinTable({ name: 'template_item_legislacoes', joinColumn: { name: 'template_item_id' }, inverseJoinColumn: { name: 'legislacao_id' } })`), `AuditoriaItem.legislacoes` idem com `auditoria_item_legislacoes`/`auditoria_item_id`. `legislacaoReferencia` e `referenciaLegal` passam a `type: 'text'`. `Usuario.podeGerenciarLegislacoes: boolean` (`name: 'pode_gerenciar_legislacoes'`, default false). `PlanoAcaoTarefa.referenciaLegal: string | null` (`name: 'referencia_legal'`, text).

- [ ] **Step 1: Teste** — `inicializarConfiguracoesPadrao` cria `openai/text-embedding-3-small` com `tokensPorCredito: 100000` quando ausente; `buscarConfiguracao(ProvedorIa.OPENAI, 'text-embedding-3-small')` sem registro cria o padrão (mock do repositório). Rodar: falha.
- [ ] **Step 2:** Adicionar o padrão nas duas listas de `configuracao-credito.service.ts`. Rodar o teste: passa.
- [ ] **Step 3:** Atualizar entidades conforme Interfaces.
- [ ] **Step 4:** Escrever `scripts/legislacao-automatica.sql` (idempotente, comentado no estilo de `scripts/adicionar-permite-foto-observacao.sql`): `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pode_gerenciar_legislacoes boolean NOT NULL DEFAULT false`; em `legislacoes`: `ALTER COLUMN "numero" DROP NOT NULL`, `"ano" DROP NOT NULL`, novas colunas da spec §2 (`"statusLeitura" varchar(20) NOT NULL DEFAULT 'concluida'` para as já existentes, depois `ALTER ... SET DEFAULT 'pendente'`), índice único parcial `CREATE UNIQUE INDEX IF NOT EXISTS legislacoes_link_unico ON legislacoes (lower("linkOficial")) WHERE "linkOficial" IS NOT NULL`; `ALTER TABLE template_itens ALTER COLUMN "legislacaoReferencia" TYPE text`; `ALTER TABLE auditoria_itens ALTER COLUMN "referenciaLegal" TYPE text`; `CREATE TABLE IF NOT EXISTS template_item_legislacoes (template_item_id uuid NOT NULL REFERENCES template_itens(id) ON DELETE CASCADE, legislacao_id uuid NOT NULL REFERENCES legislacoes(id) ON DELETE CASCADE, PRIMARY KEY (template_item_id, legislacao_id))` + índice em `legislacao_id`; idem `auditoria_item_legislacoes`; `ALTER TABLE plano_acao_tarefas ADD COLUMN IF NOT EXISTS referencia_legal text`; nova `buscar_chunks_similares(query_embedding vector(1536), match_limit int DEFAULT 5, filtro_legislacao_ids uuid[] DEFAULT NULL)` que retorna também `legislacao_id uuid` e `link_oficial varchar` e filtra `(filtro_legislacao_ids IS NULL OR l.id = ANY(filtro_legislacao_ids))` (com `DROP FUNCTION IF EXISTS` da assinatura antiga antes). Antes de escrever, conferir nomes reais das tabelas (`template_itens`, `auditoria_itens`, `plano_acao_tarefas`) nas entidades. Copiar a mesma função para `scripts/supabase-busca-vetorial-function.sql`.
- [ ] **Step 5:** Linha nova em `docs/DEPLOY.md`: `scripts/legislacao-automatica.sql` — "Legislação automática: permissão, leitura, vínculos e busca filtrada. Rodar antes do deploy da API."
- [ ] **Step 6:** `npx tsc --noEmit -p tsconfig.json` e `npx jest` verdes (ajustar mocks/specs que quebrarem por tipos). Commit "Preparar o banco para a legislação automática".

### Task 2: Funções puras de legislação (API)

**Files:**
- Create: `apps/api/src/modules/legislacao/lib/nome-legislacao.ts`, `lib/chave-legislacao.ts`, `lib/dividir-trechos.ts`, `lib/url-segura.ts`, `lib/extrair-texto.ts`, `lib/permissao.ts`, e um `*.spec.ts` para cada; fixtures em `lib/__fixtures__/` (`dou.html`, `datalegis-latin1.html` gravado em ISO-8859-1, `planalto.html`, `firewall.html`), pequenas (< 5 KB, escritas à mão imitando a estrutura real).
- Modify: `apps/api/package.json` (deps `cheerio`, `pdf-parse`; dev `@types/pdf-parse`).

**Interfaces:**
- Produces:
  - `SIGLAS_TIPO: Record<TipoLegislacao, string>` = rdc→"RDC", portaria→"Portaria", instrucao_normativa→"IN", lei→"Lei", decreto→"Decreto", outro→"".
  - `nomeCurtoLegislacao(l: { tipo: TipoLegislacao; numero?: string | null; ano?: number | null; titulo: string }): string`
  - `chaveDaLegislacao(l: { tipo; numero?; ano? }): string | null` → `"rdc:216:2004"` (número só dígitos, sem zeros à esquerda; null se faltar tipo≠outro, número ou ano).
  - `chavesNoTexto(texto: string | null | undefined): string[]` (únicas, na ordem).
  - `dividirEmTrechos(texto: string): { conteudo: string; artigo: string | null }[]`
  - `normalizarLink(url: string): string`; `ipPrivado(ip: string): boolean`; `validarUrlPublica(url: string, resolver?: (host: string) => Promise<string[]>): Promise<URL>` lança `LinkInvalidoError` (classe exportada, `message` em pt-BR).
  - `decodificarHtml(buffer: Buffer, contentType: string | null): string`; `extrairTextoHtml(html: string): { texto: string; indicioSituacao: SituacaoLegislacao | null }`; `extrairTextoPdf(buffer: Buffer): Promise<string>`; `ehPdf(buffer: Buffer, contentType: string | null): boolean`.
  - `podeGerenciarLegislacoes(u: { perfil: PerfilUsuario; podeGerenciarLegislacoes?: boolean | null }): boolean`.

- [ ] **Step 1: Testes (falhando)**, com estes casos mínimos:
  - nome: `{tipo:'rdc',numero:'216',ano:2004}` → `"RDC 216/2004"`; `{tipo:'lei',numero:'8.078',ano:1990}` → `"Lei 8.078/1990"`; `{tipo:'outro',titulo:'Código Sanitário'}` → `"Código Sanitário"`; sem número → título.
  - chave: `chavesNoTexto('RDC 216/2004')` → `['rdc:216:2004']`; `'RDC nº 216, de 15 de setembro de 2004'` → `['rdc:216:2004']`; `'Resolução-RDC N° 216/04'` → `[]`; `'Lei 8.078/1990'` → `['lei:8078:1990']`; `'Portaria CVS 5/2013'` → `['portaria:5:2013']`; `'IN 60/2019'` e `'Instrução Normativa nº 60, de 23 de dezembro de 2019'` → `['instrucao_normativa:60:2019']`; `'RDC 216/2004; Portaria CVS 5/2013'` → as duas; `'rdc 216'` → `[]`; `chaveDaLegislacao({tipo:'rdc',numero:'0216',ano:2004})` → `'rdc:216:2004'`.
  - trechos: texto com `Art. 1º ... Art. 2º ...` curtos → agrupa num trecho com `artigo: 'Art. 1º'`; artigo de 5000 chars → vários trechos, todos ≤ 2000 chars, sem palavra cortada; anexo com `4.1.1 ...`, `4.1.2 ...` → rótulo `'Item 4.1.1'`; texto sem marcadores → trechos com `artigo: null`; nenhum trecho vazio.
  - url: `ipPrivado` verdadeiro para `10.0.0.1`, `172.16.5.4`, `192.168.0.1`, `127.0.0.1`, `169.254.169.254`, `0.0.0.0`, `::1`, `fc00::1`, `fe80::1`, `::ffff:127.0.0.1`; falso para `200.152.32.1`; `validarUrlPublica('ftp://x')` rejeita; `validarUrlPublica('https://a.gov.br', async () => ['10.1.1.1'])` rejeita; `normalizarLink(' https://A.gov.br/x/#top ')` → `'https://a.gov.br/x'`.
  - extração: DOU fixture com `.texto-dou` → texto começa pelo título do ato e não contém o menu; datalegis em latin1 decodificado contém "Resolução" e "Boas Práticas" acentuados e `indicioSituacao === 'vigente_com_alteracoes'`; página com "Revogada" → `'revogada'`; firewall fixture → texto < 500 chars; `ehPdf(Buffer.from('%PDF-1.4'), null)` → true.
  - permissão: MASTER → true; GESTOR com flag → true; GESTOR sem → false; AUDITOR com flag → false.
- [ ] **Step 2:** `npx jest src/modules/legislacao/lib` falha.
- [ ] **Step 3:** Instalar deps (`npm install cheerio pdf-parse -w apps/api` ou o gerenciador do repo; conferir lockfile da raiz) e implementar. `extrairTextoPdf` importa `pdf-parse/lib/pdf-parse.js`. `dividirEmTrechos`: alvo ~1500, corte duro ~2000 em fim de parágrafo/frase. Regex de marcador de artigo `/\bArt\.?\s*\d+[º°o]?/`.
- [ ] **Step 4:** Testes passam; `tsc` limpo. Commit "Criar as funções de leitura e identificação de legislações".

### Task 3: Permissão por usuário e acesso às rotas de legislação

**Files:**
- Modify: `usuario/dto/criar-usuario.dto.ts`, `usuario/usuario.service.ts`, `usuario/usuario.controller.ts`, `auth/strategies/jwt.strategy.ts`, `core/interfaces/authenticated-request.interface.ts`, `auth/auth.service.ts` (resposta de login), `auth/auth.controller.ts` (`/auth/me`), `legislacao/legislacao.controller.ts`, `legislacao/legislacao.service.ts`
- Create: `legislacao/guards/pode-gerenciar-legislacoes.guard.ts`, `legislacao/dto/*.dto.ts` (mover os DTOs inline do controller; `CriarLegislacaoDto { linkOficial (IsUrl, MaxLength 500), titulo (MaxLength 500), informacoes? }`, `AtualizarLegislacaoDto` com dados lidos editáveis + título/informações/link, `AlterarAtivoDto`, `AlterarPermissaoLegislacoesDto`, `ListarLegislacoesQueryDto { busca?, statusLeitura?, ativo? }`)
- Test: specs do guard, `usuario.service.spec.ts` (ou novo), `legislacao.service.spec.ts`, `jwt.strategy.spec.ts` (criar se preciso)

**Interfaces:**
- Consumes: `podeGerenciarLegislacoes()` (Task 2), entidades (Task 1).
- Produces: `request.user.podeGerenciarLegislacoes: boolean` (valor efetivo); `PATCH /usuarios/:id/permissao-legislacoes`; `GET /legislacoes/opcoes` → `LegislacaoOpcao[] = { id; nome; titulo; situacao }[]`; `LegislacaoService.listarOpcoes()`, `listar(filtros)` com `totalTrechos` (`loadRelationCountAndMap`), `alterarAtivo(id, ativo)`, `remover(id)` com 409 se houver vínculo; `LegislacaoService.buscarPorIds(ids: string[]): Promise<Legislacao[]>` (400 "Legislação não encontrada." se algum faltar ou estiver inativa).

- [ ] **Step 1: Testes (falhando)**: guard 403 com mensagem "Você não tem permissão para gerenciar legislações." para GESTOR sem flag e AUDITOR, passa para MASTER/GESTOR com flag; `JwtStrategy.validate` devolve `podeGerenciarLegislacoes` lido do usuário recarregado (flag desligada no banco → false mesmo que o token seja antigo); MASTER criando GESTOR com `podeGerenciarLegislacoes: true` grava true; GESTOR criando AUDITOR com o campo → grava false; `PUT /usuarios/:id` com o campo não altera a flag; `alterarPermissaoLegislacoes` em alvo AUDITOR → 400 "A permissão de legislações vale só para gestores."; `remover` com vínculo → 409 com a mensagem da spec §4; `listarOpcoes` só ativas, ordenadas por nome curto.
- [ ] **Step 2:** Implementar. Controller: `GET /legislacoes/opcoes` declarado antes de `GET /:id`, só `JwtAuthGuard`; demais rotas com `@UseGuards(JwtAuthGuard, PodeGerenciarLegislacoesGuard)`. Remover o `console.log` com prefixo da chave e logs verbosos do service; `adicionarChunks` continua `ordem` a partir do maior existente. Listagem de usuários e login incluem `podeGerenciarLegislacoes`.
- [ ] **Step 3:** jest + tsc verdes. Commit "Controlar quem gerencia legislações".

### Task 4: Leitura automática em segundo plano

**Files:**
- Create: `legislacao/legislacao-leitura.service.ts`, `legislacao/legislacao-leitura.service.spec.ts`, `legislacao/legislacao-vinculo.service.ts`, `legislacao/legislacao-vinculo.service.spec.ts`
- Modify: `legislacao/legislacao.controller.ts`, `legislacao/legislacao.module.ts` (importar `CreditoModule` e repositórios de `TemplateItem`/`AuditoriaItem` sem ciclo — usar `TypeOrmModule.forFeature`), `legislacao/legislacao.service.ts` (`criar` passa a validar link/dedupe e disparar leitura)

**Interfaces:**
- Consumes: Task 2 libs; `CreditoService`; `UsuarioAutenticado` com `perfil/gestorId`.
- Produces:
  - `type FonteLeitura = { tipo: 'link' } | { tipo: 'pdf'; buffer: Buffer } | { tipo: 'texto'; texto: string }`
  - `LegislacaoLeituraService.iniciar(id: string, usuario: UsuarioAutenticado, fonte: FonteLeitura): Promise<Legislacao>` (marca `lendo`, dispara `processar` sem aguardar, devolve a entidade)
  - `LegislacaoLeituraService.processar(id, usuario, fonte): Promise<void>` (aguardável nos testes; nunca lança — grava `falhou`)
  - `LegislacaoLeituraService.buscarConteudo(url: string): Promise<{ buffer: Buffer; contentType: string | null }>` (fetch injetável via propriedade `fetchFn` para teste)
  - `onModuleInit()` → `lendo` com `atualizadoEm` > 10 min viram `falhou` "A leitura foi interrompida. Tente de novo."
  - `LegislacaoVinculoService.textoDerivado(legislacoes: Legislacao[]): string | null`; `idsPorTexto(texto: string | null): Promise<string[]>`; `ligarReferenciasAntigas(legislacao: Legislacao): Promise<{ templateItens: number; auditoriaItens: number }>`
  - Rotas: `POST /legislacoes` (201 com `statusLeitura: 'lendo'`; 409 `{ message: 'Esta legislação já está cadastrada.', id }`), `POST /:id/ler-novamente`, `POST /:id/arquivo` (FileInterceptor `arquivo`, PDF ≤ 20 MB, senão 400 "Envie um arquivo PDF de até 20 MB."), `POST /:id/texto { texto }` (`MinLength(500)`, `MaxLength(2000000)`).

- [ ] **Step 1: Testes (falhando)**, com `fetchFn`, OpenAI e DeepSeek mockados:
  - sucesso com HTML: dados da IA gravados (tipo/numero/ano/ementa/situacao/dataPublicacao), `titulo` e `informacoes` do usuário preservados, trechos antigos substituídos, `ordem` 0..n-1, `statusLeitura 'concluida'`, `origemTexto 'link'`, `registrarUso` chamado 2× com `metodoChamado` `'lerLegislacao'` e `'gerarEmbeddingsLegislacao'` para GESTOR e 0× para MASTER; embeddings em lotes de no máximo 100.
  - página de firewall (texto < 500) → `falhou` com "Não foi possível ler o texto deste link. Anexe o PDF ou cole o texto da legislação.", trechos e dados anteriores intactos.
  - redirect 302 para `http://169.254.169.254/` → `falhou` sem segunda requisição para esse host.
  - gestor sem saldo (`validarSaldoDisponivel` lança) → `falhou` "Sem créditos de IA para ler a legislação."
  - IA devolve `ano: "abc"`, `situacao: "x"` → gravados como null.
  - fonte `texto` → não chama `fetchFn`; `origemTexto 'texto'`.
  - `criar` com link já existente (normalizado) → 409 com id.
  - `ligarReferenciasAntigas`: item de template sem vínculo com `legislacaoReferencia 'RDC 216/2004; Portaria CVS 5/2013'` ganha vínculo com a RDC 216/2004; item já vinculado não muda; item de auditoria com `referenciaLegal 'RDC nº 216, de 15 de setembro de 2004'` ganha vínculo.
  - `onModuleInit` marca leituras travadas.
- [ ] **Step 2:** Implementar. Prompt de dados em pt-BR pedindo JSON `{tipo, numero, ano, orgaoEmissor, ementa, dataPublicacao, situacao}` com os valores de enum permitidos; `max_tokens` 800; `response_format: { type: 'json_object' }`. Redirects com `redirect: 'manual'`, máx. 5, `validarUrlPublica` a cada salto; leitura do corpo com limite de 20 MB (abortar ao exceder); timeout 30 s via `AbortController`. Gravação final em `dataSource.transaction`.
- [ ] **Step 3:** jest + tsc verdes. Commit "Ler legislações automaticamente pelo link, PDF ou texto".

### Task 5: Vínculos nos itens de checklist e de auditoria

**Files:**
- Modify: `checklist/dto/criar-checklist-template.dto.ts` (+ DTO de atualização de item se separado), `checklist/checklist.service.ts` (`adicionarItem`, `atualizarItem`, `duplicarGrupo`, `duplicarItem`, leituras de template com itens → `relations` incluem `itens.legislacoes`), `checklist/checklist.module.ts`, `auditoria/dto/criar-auditoria.dto.ts` (`ResponderItemDto`), `auditoria/auditoria.service.ts` (responder item; detalhe com `itens.legislacoes` e `itens.templateItem.legislacoes`), `auditoria/auditoria.module.ts`
- Test: specs existentes de checklist/auditoria (estender)

**Interfaces:**
- Consumes: `LegislacaoService.buscarPorIds`, `LegislacaoVinculoService.textoDerivado` (exportar ambos do `LegislacaoModule`).
- Produces: `legislacaoIds?: string[]` (`@IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID('4', { each: true })`) nos DTOs de item de template e `ResponderItemDto`; respostas trazem `legislacoes: { id, tipo, numero, ano, titulo, situacao }[]`.

- [ ] **Step 1: Testes (falhando)**: criar item com `legislacaoIds` de duas legislações → `legislacoes` gravadas e `legislacaoReferencia === 'RDC 216/2004, Portaria 5/2013'`; `legislacaoIds: []` → sem vínculos e `legislacaoReferencia` null; atualizar sem `legislacaoIds` → vínculos e texto intactos; id inexistente → 400; duplicar item/grupo copia vínculos; responder item com `legislacaoIds` → vínculos + `referenciaLegal` derivado; responder sem o campo mas com `referenciaLegal: 'texto'` (mobile) → texto gravado, vínculos intactos.
- [ ] **Step 2:** Implementar. Ao salvar ManyToMany, não sobrescrever o array quando o DTO não traz `legislacaoIds` (cuidado registrado no AGENTS.md sobre relação parcial anulando FKs).
- [ ] **Step 3:** jest + tsc verdes. Commit "Ligar perguntas e não conformidades às legislações cadastradas".

### Task 6: IA usando as legislações escolhidas

**Files:**
- Modify: `legislacao/legislacao.service.ts` (`buscarChunksSimilares(query, limite = 5, opcoes?: { legislacaoIds?: string[] })`, `gerarContextoRag(query, opcoes?)`), `ia/ia.service.ts` (`gerarTextoNaoConformidade`, `analisarImagemChecklist`), `ia/ia.controller.ts` (aceitar `templateItemId?`/`legislacaoIds?` opcionais nos DTOs desses dois endpoints), `checklist/checklist-ia.service.ts`
- Test: `ia/ia.service.spec.ts`, `checklist/checklist-ia.service.spec.ts`, `legislacao/legislacao.service.spec.ts`

**Interfaces:**
- Consumes: RPC nova (Task 1), `LegislacaoVinculoService.idsPorTexto` (Task 4).
- Produces: respostas de `/ia/gerar-texto` e `/ia/analisar-imagem-checklist` com `referenciaLegal: string` **e** `legislacaoIds: string[]`; `ItemGeradoIa.legislacoes?: string[]` (nomes).

- [ ] **Step 1: Testes (falhando)**: `gerarContextoRag(q, { legislacaoIds: [a] })` chama a RPC com `filtro_legislacao_ids: [a]` e, se vierem < 3 trechos, chama de novo sem filtro e junta sem repetir; resposta da IA `referenciaLegal: 'RDC 216/2004, Art. 4.1.3'` → `legislacaoIds` com o id da RDC 216/2004; sem casamento → `[]`; checklist IA com item `legislacoes: ['RDC 216/2004', 'Inexistente 1/2000']` salva `legislacaoIds` só do que existe; prompt de geração lista as legislações cadastradas (até 80, nome + ementa cortada em 160 chars) e não pede mais `artigo`/`textoLegal`.
- [ ] **Step 2:** Implementar. Nos prompts de não conformidade, pedir "referenciaLegal: nome da norma aplicável (ex.: 'RDC 216/2004'), sem artigo". Quando o pedido trouxer `legislacaoIds`, usá-los no filtro do contexto.
- [ ] **Step 3:** jest + tsc verdes. Commit "Usar as legislações escolhidas no apoio da IA".

### Task 7: Relatórios e plano de ação com o nome da norma

**Files:**
- Modify: `auditoria/services/relatorio-html.service.ts` (card do item em `gerarDetalhamentoPorGrupo`), carregamento de dados do PDF (garantir `itens.legislacoes` e `itens.templateItem.legislacoes` nas relations), `plano-acao/plano-acao.service.ts` (`gerarDaAuditoria` carrega `legislacoes` e `templateItem.legislacoes`, preenche `referenciaLegal`), DTO/retorno do plano se necessário
- Create: `legislacao/lib/legislacoes-do-item.ts` (+ spec)
- Test: spec da lib + spec existente do relatório HTML/plano (estender)

**Interfaces:**
- Produces: `nomesLegislacoesDoItem(item: { legislacoes?: L[]; referenciaLegal?: string | null; templateItem?: { legislacoes?: L[]; legislacaoReferencia?: string | null } }): string | null` — próprias → herdadas → `referenciaLegal` → null; nomes por `nomeCurtoLegislacao` unidos por ", ".

- [ ] **Step 1: Testes (falhando)**: prioridade das três fontes; HTML do item não conforme contém `Legislação:</...>RDC 216/2004` (escapado), item conforme não contém "Legislação:"; `gerarDaAuditoria` grava `referenciaLegal 'RDC 216/2004'`.
- [ ] **Step 2:** Implementar (escapar HTML como o serviço já faz).
- [ ] **Step 3:** jest + tsc verdes. Commit "Mostrar a legislação nas não conformidades do relatório e do plano de ação".

### Task 8: Web — tipos, permissão e navegação

**Files:**
- Modify: `apps/web/src/lib/api.ts` (tipos `Legislacao` com campos novos, `SituacaoLegislacao`, `StatusLeitura`, `LegislacaoOpcao`, `LegislacaoResumo`; `legislacaoService.opcoes()`, `listar(filtros)`, `lerNovamente(id)`, `enviarArquivo(id, arquivo: File)`, `enviarTexto(id, texto)`, `alterarAtivo(id, ativo)`; `TemplateItem.legislacoes?`, `CriarTemplateItemRequest.legislacaoIds?`, `AuditoriaItem.legislacoes?`, payload de responder item `legislacaoIds?`, `GeracaoTextoResponse.legislacaoIds?`, `usuarioService.alterarPermissaoLegislacoes(id, valor)`, `CriarUsuarioRequest.podeGerenciarLegislacoes?`, `authService.me()` tipado com a flag), `apps/web/src/lib/store.ts` (`Usuario.podeGerenciarLegislacoes?`), `apps/web/src/components/layout/navegacao.ts` (+ teste), consumidores de `getGruposNavegacao/getItensMais/getItensConta`, `apps/web/src/app/admin/usuarios/page.tsx`
- Create: `apps/web/src/lib/legislacao/nome-legislacao.ts` (+ `.test.ts`, mesmos casos de nome do Task 2)

**Interfaces:**
- Produces: `nomeCurtoLegislacao` (web, mesma assinatura do Task 2, `tipo` como `TipoLegislacao` da web); navegação: `ItemNavegacao.requer?: 'gerenciarLegislacoes'`; `getGruposNavegacao(perfil, opcoes?: { podeGerenciarLegislacoes?: boolean })` (idem `getItensMais`, `getItensConta`); item Legislações com `perfis: GESTAO, requer: 'gerenciarLegislacoes'`.

- [ ] **Step 1: Testes (falhando)**: navegação — GESTOR sem flag não vê Legislações, GESTOR com flag e MASTER (com flag efetiva true vinda da API) veem; AUDITOR nunca; nome curto web.
- [ ] **Step 2:** Implementar. Onde o app já chama `/auth/me` no carregamento, atualizar a flag no store; se não chama, não criar chamada nova (vale após login). Formulário de usuários: `Switch` shadcn "Pode gerenciar legislações" + descrição "Cadastra e mantém a base de legislações usada pela IA e nos checklists", só para quem edita sendo MASTER e perfil GESTOR; na criação vai no payload; na edição chama `alterarPermissaoLegislacoes` só se mudou.
- [ ] **Step 3:** vitest + tsc verdes. Commit "Permitir liberar a gestão de legislações para gestores".

### Task 9: Web — telas de legislações

**Files:**
- Modify/rewrite: `apps/web/src/app/admin/legislacoes/page.tsx`, `nova/page.tsx`, `[id]/page.tsx`
- Create: `apps/web/src/lib/legislacao/leitura.ts` (+ teste) e componentes em `apps/web/src/components/legislacao/` conforme preciso (ex.: `modal-enviar-pdf.tsx`, `modal-colar-texto.tsx`, `lista-trechos.tsx`)

**Interfaces:**
- Consumes: Task 8 tipos/serviços.
- Produces: `rotuloStatusLeitura(s: StatusLeitura): string` ("Aguardando", "Lendo…", "Pronta", "Falhou"); `rotuloSituacao(s: SituacaoLegislacao | null): string | null` ("Vigente", "Vigente com alterações", "Revogada"); `deveAtualizar(s: StatusLeitura): boolean` (true para pendente/lendo).

- [ ] **Step 1: Testes (falhando)** das três funções.
- [ ] **Step 2:** Implementar telas conforme spec §7 seguindo a skill `crud-frontend` (`.cursor/skills/crud-frontend`): lista com `CrudFiltros` (busca + situação da leitura) e `CrudTable` (Nome, Título, Situação, Leitura com `StatusChip`, Trechos, ações Abrir / Ler novamente / Desativar-Ativar / Remover com `ConfirmDialog`; 409 de remoção mostra a mensagem da API). Nova: link + título obrigatórios, informações opcional, ajuda "O sistema lê a página e preenche o resto."; 409 mostra "Esta legislação já está cadastrada." com link "Abrir a existente". Detalhe: polling a cada 3 s enquanto `deveAtualizar`, parando ao desmontar; estados de falha com "Tentar de novo", "Enviar PDF" (input file `accept="application/pdf"`, ≤ 20 MB validado no cliente), "Colar texto" (textarea, mínimo 500 caracteres com contador); dados lidos editáveis + salvar; "Ler novamente" com `ConfirmDialog` e o texto da spec; trechos somente leitura com busca, recolhível. Sem acesso (403) → mensagem "Você não tem permissão para gerenciar legislações."
- [ ] **Step 3:** vitest + tsc verdes (inclui guarda sem DaisyUI). Commit "Refazer as telas de legislação com leitura automática".

### Task 10: Web — seletor de legislações no editor e na execução

**Files:**
- Create: `apps/web/src/components/legislacao/seletor-legislacoes.tsx`, `apps/web/src/lib/legislacao/selecao.ts` (+ `.test.ts`), `apps/web/src/lib/legislacao/use-opcoes-legislacao.ts`
- Modify: `apps/web/src/app/admin/templates/[id]/page.tsx` e `templates/novo/page.tsx` (estado, reset, carregar, payload e selo da lista — trocar `legislacaoReferencia`/`artigo` por `legislacaoIds`), `apps/web/src/components/auditoria/execucao/painel-item.tsx` (e quem salva a resposta do item / aplica texto da IA), tela de relatório da auditoria (aba de não conformidades, `admin/auditoria/[id]/relatorio/page.tsx`) e `admin/planos-acao/page.tsx` (mostrar "Legislação: …" de `referenciaLegal`)
- Create (web): `apps/web/src/lib/legislacao/legislacoes-do-item.ts` (+ teste; mesma regra de prioridade do Task 7)

**Interfaces:**
- Consumes: `legislacaoService.opcoes()`, `nomeCurtoLegislacao`.
- Produces: `<SeletorLegislacoes valor={string[]} onChange={(ids) => void} referenciaAnterior?={string | null} desabilitado?={boolean} />`; `alternarSelecao(ids: string[], id: string): string[]`; `filtrarOpcoes(opcoes: LegislacaoOpcao[], busca: string): LegislacaoOpcao[]` (sem acento/caixa, por nome e título); `useOpcoesLegislacao(): { opcoes: LegislacaoOpcao[]; carregando: boolean }` (cache em módulo durante a sessão da página).

- [ ] **Step 1: Testes (falhando)**: `alternarSelecao` adiciona/remove preservando ordem; `filtrarOpcoes('rdc 216')` acha "RDC 216/2004", `'boas praticas'` acha pelo título acentuado; `nomesLegislacoesDoItem` web com as três fontes.
- [ ] **Step 2:** Implementar o seletor conforme spec §5 (chips removíveis com Tooltip "Remover", botão "Adicionar legislação", `ResponsiveDialog` com busca cmdk e checkbox, selo "Revogada", rodapé fixo "Concluir", vazio "Nenhuma legislação cadastrada ainda.", `referenciaAnterior` → "Referência anterior: {texto} — escolha a legislação correspondente." quando não há vínculo). Editor: payload envia `legislacaoIds` e não envia mais `legislacaoReferencia`/`artigo`. Painel do item: na não conformidade, seletor pré-preenchido com as da pergunta se o item não tiver as próprias; salvar envia `legislacaoIds`; ao aplicar texto da IA usa `legislacaoIds` se vier não vazio; linha informativa da pergunta mostra nomes. Relatório (aba NC) e planos: linha "Legislação: …".
- [ ] **Step 3:** vitest + tsc verdes. Commit "Escolher legislações cadastradas no checklist e na não conformidade".

### Task 11: Regras de negócio

**Files:**
- Modify: `docs/regras-de-negocio.md`

- [ ] **Step 1:** Seção "Legislação" com `RN-LEG-001…` cobrindo, nesta ordem: base única global; quem gerencia (MASTER/GESTOR com permissão, concedida só pelo MASTER); todos selecionam; várias por pergunta, só a norma; herança na não conformidade; relatórios só com o nome; leitura automática + plano B (PDF/texto) e "Ler novamente" substitui dados lidos e trechos (preserva título/informações); créditos de IA na leitura; dedupe por link; remoção bloqueada com vínculos (desativar). Seguir o formato das seções existentes.
- [ ] **Step 2:** Commit "Registrar as regras da legislação automática".
