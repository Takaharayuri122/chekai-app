# Legislação automática — design

Data: 2026-10-25 · Branch: `feat/legislacao-automatica`

## Por quê

Hoje cadastrar uma legislação é manual: digitar tipo, número, ano, ementa e colar o texto
trecho a trecho para alimentar a busca da IA. Nos checklists e nas não conformidades, a
legislação é um texto livre ("RDC 216/2004", "rdc 216"...), sem ligação com a base. O cliente
quer cadastrar só o link oficial e deixar o sistema buscar tudo o que der da página (ementa,
número, órgão, situação, texto integral), montar a base da IA a partir disso e trocar todo
texto livre por um seletor das legislações cadastradas.

## Decisões do usuário (vinculantes)

1. **Base única e global.** Uma só base de legislações para o sistema todo (sem separação por
   gestor/unidade). A IA usa a base inteira.
2. **Quem gerencia:** MASTER sempre; GESTOR somente se tiver a permissão **"Pode gerenciar
   legislações"**, marcada no cadastro de usuários. Só esses usuários veem o menu
   Legislações e criam/editam/desativam/releem. A API impõe a regra.
3. **Todos selecionam, só os autorizados editam.** Qualquer usuário logado escolhe
   legislações da base nos seletores (montagem de checklist, não conformidade).
4. **Várias legislações por pergunta**, e só a norma (sem artigo).
5. **Relatórios mostram só o nome da norma** (ex.: "RDC 216/2004"), sem ementa/lista.
6. **Cadastro:** o usuário informa link, título e informações; o sistema extrai o resto.
7. Fontes alvo: Anvisa (incl. `anvisalegis.datalegis.net`), Diário Oficial (`in.gov.br`),
   Planalto e outras páginas oficiais — HTML ou PDF.
8. O usuário delegou as demais decisões ("pode decidir tudo sozinho até subirmos a PR").
   Tudo abaixo marcado **(decisão nossa)** é escolha do time de implementação.

## Não objetivos

- Não mexer em `apps/mobile`. O mobile continua lendo/gravando `legislacaoReferencia` e
  `referenciaLegal` como texto — por isso esses campos continuam existindo e são mantidos
  preenchidos automaticamente a partir das legislações escolhidas.
- Sem fila/worker externo; sem monitorar mudanças nas páginas automaticamente (há "Ler
  novamente" manual).
- Sem deduplicação por número/ano (só por link). Sem artigo por pergunta.
- Separar "Fotos" e "Observação" na execução do checklist é outro assunto, fora daqui.

## Constatações que moldam o design

- `bvsms.saude.gov.br` responde 503 de firewall para robôs; `in.gov.br` pode não responder
  fora do Brasil/de navegadores. `anvisalegis.datalegis.net` (ISO-8859-1, traz "Vigente com
  Alterações") e `planalto.gov.br` respondem bem. **Logo, a leitura pelo link precisa de
  plano B:** anexar o PDF ou colar o texto (decisão nossa).
- A API não tem parser de HTML nem de PDF: adicionar `cheerio` e `pdf-parse` (decisão nossa;
  importar `pdf-parse/lib/pdf-parse.js` para evitar o modo debug do index).
- `CreditoService.registrarUso` exige `ConfiguracaoCredito` para provedor+modelo; não existe
  para `text-embedding-3-small`. Adicionar o padrão `openai/text-embedding-3-small` com
  `tokensPorCredito: 100000` nas duas listas de padrão de `configuracao-credito.service.ts`.
- `legislacaoReferencia` é `varchar(50)` e `referenciaLegal` `varchar(100)`: curtos demais
  para vários nomes → passam a `text`.
- `JwtStrategy.validate()` já recarrega o usuário a cada request: a permissão pode ser lida ali.
- Hoje o controller de legislações não tem controle de acesso nenhum (qualquer logado cria e
  apaga) — corrigido aqui.

## 1. Permissão "Pode gerenciar legislações"

- Coluna `usuarios.pode_gerenciar_legislacoes boolean NOT NULL DEFAULT false` (snake_case,
  padrão da tabela `usuarios`), entidade `podeGerenciarLegislacoes`.
- Regra efetiva: `perfil === MASTER || (perfil === GESTOR && pode_gerenciar_legislacoes)`.
  AUDITOR nunca (a flag é ignorada/zerada).
- Quem altera: só MASTER. Na criação (MASTER criando GESTOR) via campo opcional
  `podeGerenciarLegislacoes` do `CriarUsuarioDto` — ignorado se o criador não for MASTER ou o
  perfil não for GESTOR. Na edição, endpoint próprio `PATCH /usuarios/:id/permissao-legislacoes`
  `{ podeGerenciarLegislacoes: boolean }`, `@Roles(MASTER)`, só para alvo GESTOR (400 caso
  contrário) (decisão nossa: evita mexer na regra genérica de edição). O `PUT /usuarios/:id`
  genérico deve ignorar esse campo (remover do objeto antes do `Object.assign`).
- `JwtStrategy.validate()` passa a devolver `podeGerenciarLegislacoes` (valor efetivo);
  incluir em `AuthenticatedRequest`, `/auth/me` e na resposta de login. A listagem de
  usuários devolve a coluna.
- Web: store `Usuario.podeGerenciarLegislacoes?: boolean`; `/auth/me` atualiza o store ao
  carregar o app (para refletir mudança sem novo login — decisão nossa, se já houver chamada a
  `me` no bootstrap; senão, vale após novo login). No formulário de usuários: `Switch`
  "Pode gerenciar legislações" com descrição "Cadastra e mantém a base de legislações usada
  pela IA e nos checklists", visível só quando quem edita é MASTER e o perfil é GESTOR.
- Navegação: o item Legislações aparece quando `podeGerenciarLegislacoes` é verdadeiro
  (`navegacao.ts` ganha suporte a predicado por usuário; manter testes).
- Guard `PodeGerenciarLegislacoesGuard` (em `legislacao/`): 403 "Você não tem permissão para
  gerenciar legislações." quando a regra efetiva for falsa.

## 2. Modelo de dados

`legislacoes` (colunas camelCase entre aspas, como a tabela já usa):
- `numero` e `ano` passam a aceitar nulo (só se sabe depois da leitura); `tipo` mantém
  default `outro` quando não identificado. `titulo` continua obrigatório (vem do usuário).
- Novas: `informacoes text null` (notas de quem cadastrou), `situacao varchar(30) null`
  (`vigente` | `vigente_com_alteracoes` | `revogada`; nulo = não identificada),
  `dataPublicacao date null`, `statusLeitura varchar(20) NOT NULL DEFAULT 'pendente'`
  (`pendente` | `lendo` | `concluida` | `falhou`), `erroLeitura text null`,
  `lidoEm timestamptz null`, `origemTexto varchar(10) null` (`link` | `pdf` | `texto`),
  `criadoPorId uuid null`.
- Índice único parcial em `lower("linkOficial")` onde não nulo (dedupe por link; a API
  normaliza o link — trim, sem `#fragmento`, sem barra final — antes de comparar).

Vínculos (tabelas novas, snake_case, PK composta, FK `ON DELETE CASCADE`):
- `template_item_legislacoes (template_item_id, legislacao_id)` → `TemplateItem.legislacoes`
  (`@ManyToMany` + `@JoinTable`).
- `auditoria_item_legislacoes (auditoria_item_id, legislacao_id)` → `AuditoriaItem.legislacoes`.

Compatibilidade (mobile e histórico):
- `template_itens."legislacaoReferencia"` e `auditoria_itens."referenciaLegal"` viram `text`.
- Sempre que a lista de legislações de um item for gravada, o texto correspondente é
  regravado com os nomes curtos separados por ", " (vazio → null). Quando o cliente não manda
  a lista (mobile/antigos), o texto enviado continua sendo aceito como hoje.
- `artigo` e `textoLegal` ficam no banco, sem uso na tela (não são mais enviados pela web
  nem gerados pela IA).

Nome curto (função pura compartilhada em API e web, mesma regra): `SIGLA número/ano`, com
SIGLA = RDC, Portaria, IN, Lei, Decreto; para `outro` ou sem número usa o `titulo`. Ex.:
"RDC 216/2004", "Lei 8078/1990". O número é exibido como lido (sem forçar pontos).

## 3. Leitura automática

Serviço `LegislacaoLeituraService` (+ funções puras testáveis em arquivos próprios).

Fluxo ao cadastrar (`POST /legislacoes { linkOficial, titulo, informacoes? }`):
1. Valida e normaliza o link; 409 com `{ id }` e mensagem "Esta legislação já está cadastrada."
   se o link já existir.
2. Cria com `statusLeitura = 'lendo'` e responde na hora. A leitura roda em segundo plano no
   mesmo processo (promise solta com `catch` que grava `falhou`). Na inicialização do módulo,
   registros em `lendo` há mais de 10 min viram `falhou` com "A leitura foi interrompida.
   Tente de novo." (decisão nossa).
3. **Busca** (`buscarConteudo`): só `http/https`; resolve o DNS e recusa IPs privados,
   loopback, link-local e reservados (proteção contra SSRF), revalidando a cada redirect
   (máx. 5, seguidos manualmente); timeout 30 s; máximo 20 MB; User-Agent de navegador e
   `Accept-Language: pt-BR`.
4. **Texto**: PDF (content-type ou assinatura `%PDF`) → `pdf-parse`. HTML → decodifica pelo
   charset do header ou da `<meta>` (ISO-8859-1 incluso, via `TextDecoder`), `cheerio`,
   remove script/style/nav/header/footer/form/aside, prioriza o miolo conhecido
   (`.texto-dou` no DOU; maior bloco de texto nos demais) e mantém quebras de parágrafo.
   Também captura indícios de situação no HTML ("Revogad", "Vigente com Alterações", "Vigente").
5. Se o texto útil tiver menos de 500 caracteres → `falhou` com "Não foi possível ler o texto
   deste link. Anexe o PDF ou cole o texto da legislação."
6. **Dados** via IA (DeepSeek `deepseek-chat`, JSON): a partir dos primeiros ~12 mil e últimos
   ~2 mil caracteres + indícios de situação, extrai `tipo`, `numero`, `ano`, `orgaoEmissor`,
   `ementa`, `dataPublicacao` (AAAA-MM-DD) e `situacao`. Valores inválidos viram nulo. O
   `titulo` e as `informacoes` do usuário nunca são sobrescritos.
7. **Trechos**: `dividirEmTrechos(texto)` quebra por artigo (`Art. 1º`…) e, em anexos de
   regulamento, por itens numerados (`4.1.3`); agrupa até ~1500 caracteres (corta em parágrafo
   acima de ~2000), rotula `artigo` com o primeiro marcador do trecho ("Art. 5º", "Item 4.1").
   `ordem` sequencial a partir de 0. Embeddings em lote (até 100 textos por chamada da OpenAI).
8. Grava numa transação: apaga os trechos antigos e insere os novos, atualiza os dados,
   `statusLeitura = 'concluida'`, `lidoEm`, `origemTexto`, limpa `erroLeitura`. Se algo falhar
   antes disso, os trechos e dados anteriores ficam intactos e só `statusLeitura/erroLeitura`
   mudam.
9. **Liga referências antigas** (seção 5) a esta legislação.

Créditos de IA (regra do projeto): a leitura é cobrada de quem disparou, no padrão do
`CreditoService` — MASTER não paga; GESTOR paga da própria conta (valida saldo antes; sem
saldo → `falhou` com "Sem créditos de IA para ler a legislação."). Registra o uso do DeepSeek
(`metodoChamado: 'lerLegislacao'`) e dos embeddings (`ProvedorIa.OPENAI`,
`text-embedding-3-small`, `tokensInput = usage.prompt_tokens`, `metodoChamado:
'gerarEmbeddingsLegislacao'`). O processamento em segundo plano recebe o usuário que disparou.

Plano B e releitura (todos com o guard de permissão; respondem na hora e processam em
segundo plano):
- `POST /legislacoes/:id/ler-novamente` — busca o link de novo.
- `POST /legislacoes/:id/arquivo` (multipart `arquivo`, só PDF, ≤ 20 MB) — passos 4–9 com
  `origemTexto = 'pdf'`.
- `POST /legislacoes/:id/texto { texto }` (≥ 500 e ≤ 2 milhões de caracteres) — passos 5–9
  com `origemTexto = 'texto'`.
- O limite de corpo JSON atual (5 MB) comporta o texto colado.

Também: remover o `console.log` que imprime prefixo da chave da OpenAI e os logs verbosos do
`LegislacaoService`; corrigir `adicionarChunks` (`ordem` continua a partir do maior existente).

## 4. API de legislações

- `GET /legislacoes/opcoes` — **qualquer usuário logado**: ativas e com leitura concluída ou
  não, `[{ id, nome, titulo, situacao }]` ordenado por nome. É a fonte dos seletores.
- Com o guard de permissão: `GET /legislacoes` (lista com `totalTrechos` via contagem, filtros
  `busca`, `statusLeitura`, `ativo`), `GET /legislacoes/:id`, `POST`, `PUT /:id` (edita
  dados lidos, título, informações, link — trocar o link não relê sozinho), `PATCH /:id/ativo`,
  `DELETE /:id` (409 "Esta legislação está ligada a perguntas ou não conformidades. Desative
  em vez de remover." se houver vínculos), os três endpoints de leitura acima, endpoints de
  trechos existentes (listar; adicionar/remover manual mantidos) e `rag/buscar`, `rag/contexto`.
- DTOs em arquivos próprios (`dto/`), com class-validator (o ValidationPipe é
  `whitelist + forbidNonWhitelisted`).

## 5. Seleção nos checklists e nas não conformidades

API:
- `CriarTemplateItemDto`/atualização ganham `legislacaoIds?: string[]` (`@IsUUID('4', {each})`,
  `@ArrayMaxSize(10)`); ids inexistentes → 400. Ao gravar, define `legislacoes` e regrava
  `legislacaoReferencia`. Duplicar grupo/item copia os vínculos. As leituras de template que
  hoje trazem os itens passam a trazer `legislacoes` (id + campos do nome curto).
- `ResponderItemDto` ganha `legislacaoIds?: string[]`; idem para `AuditoriaItem` e
  `referenciaLegal`. O detalhe da auditoria traz `itens.legislacoes` e
  `itens.templateItem.legislacoes`.
- Uma não conformidade sem legislações próprias **herda** as da pergunta na exibição e nos
  relatórios (não grava a herança).
- Ligação das referências antigas: `chaveLegislacao(texto)` extrai pares tipo+número+ano de
  textos livres ("RDC 216/2004", "RDC nº 216, de 15 de setembro de 2004", "Portaria CVS 5/2013",
  "Lei 8.078/1990"; número sem pontos e zeros à esquerda; ano de 2 dígitos não é aceito).
  Quando uma leitura conclui, itens de template e de auditoria **sem vínculo** cujo texto
  contém a chave da legislação ganham o vínculo (o texto livre não é alterado).

IA:
- RPC `buscar_chunks_similares` ganha `filtro_legislacao_ids uuid[] DEFAULT NULL` e passa a
  devolver `legislacao_id` e `link_oficial`. `buscarChunksSimilares/gerarContextoRag` aceitam
  `{ legislacaoIds? }`: quando a pergunta tem legislações, o contexto da IA ao gerar texto de
  não conformidade e ao analisar imagem do checklist busca primeiro nelas (e completa com a
  base toda se vier menos de 3 trechos).
- `gerarTextoNaoConformidade` e `analisarImagemChecklist` continuam devolvendo
  `referenciaLegal: string` (mobile) e passam a devolver também `legislacaoIds: string[]`,
  obtidos casando `chaveLegislacao(referenciaLegal)` com a base. O prompt pede só a norma
  (sem artigo).
- Geração de checklist com IA: o prompt recebe a lista de legislações cadastradas (até 80,
  nome + ementa curta) e o item gerado traz `legislacoes: string[]` (nomes); o salvamento
  converte em `legislacaoIds` por `chaveLegislacao`. Saem `artigo`/`textoLegal` do prompt.

Web:
- Componente `SeletorLegislacoes` (multi): chips com o nome curto (removíveis) + botão
  "Adicionar legislação" que abre um `ResponsiveDialog` com busca (`cmdk`, já instalado) e
  lista com checkbox (nome, título, selo "Revogada" quando for o caso); rodapé fixo com
  "Concluir". Carrega `GET /legislacoes/opcoes` uma vez por sessão de página. Sem
  legislações na base: texto "Nenhuma legislação cadastrada ainda." Tooltip nos botões de
  ícone. Mobile-first (alvos ≥ 44px).
- Editor de checklist (`templates/[id]` e `templates/novo`, modais de pergunta): troca os
  campos "Legislação" e "Artigo/Inciso" pelo seletor. Se o item tem texto antigo e nenhum
  vínculo, mostra abaixo, discreto: "Referência anterior: RDC 216 — escolha a legislação
  correspondente." Na lista de perguntas, o selo mostra os nomes curtos.
- Execução da auditoria (`painel-item.tsx`): na não conformidade, seletor "Legislação"
  pré-preenchido com as da pergunta quando o item não tem as próprias; ao aplicar texto da IA,
  usa os `legislacaoIds` retornados se vierem. A linha informativa da pergunta mostra os nomes.

## 6. Relatórios

- PDF da auditoria (`relatorio-html.service.ts`, card do item): para itens não conformes,
  linha "Legislação: RDC 216/2004, Portaria CVS 5/2013" (próprias do item → herdadas da
  pergunta → texto `referenciaLegal` como último recurso). Só o nome.
- Tela de relatório da auditoria, aba de não conformidades: mesma linha.
- Plano de ação: `plano_acao_tarefas.referencia_legal text null`, preenchida em
  `gerarDaAuditoria` com os mesmos nomes; a tela de planos mostra "Legislação: …" quando houver.

## 7. Telas de legislação (web, `admin/legislacoes`)

- **Lista** (padrão `crud-frontend`: `CrudFiltros` + `CrudTable`, cards no mobile): busca,
  filtro de situação da leitura. Colunas: Nome, Título, Situação (vigente/revogada), Leitura
  (`StatusChip`: Lendo… / Pronta / Falhou), Trechos, menu de ações (Abrir, Ler novamente,
  Desativar/Ativar, Remover com `ConfirmDialog`).
- **Nova**: Link oficial (obrigatório), Título (obrigatório), Informações (opcional). Texto de
  ajuda: "O sistema lê a página e preenche o resto." Ao salvar, vai para o detalhe. Link
  repetido: mensagem com atalho para a existente.
- **Detalhe**: cabeçalho com nome/título/situação e estado da leitura. Em "Lendo…", atualiza
  a cada 3 s. Em "Falhou": mensagem de erro + ações "Tentar de novo", "Enviar PDF", "Colar
  texto" (modais com cabeçalho/rodapé fixos). Em "Pronta": dados lidos editáveis (tipo,
  número, ano, órgão, data de publicação, situação, ementa) + título, informações, link;
  "Ler novamente" com `ConfirmDialog` ("Os dados lidos e os trechos serão substituídos pelo
  conteúdo atual da página."); lista de trechos somente leitura, com busca, recolhível.
- Copy sóbria, sem jargão (não falar "RAG", "embedding", "chunks": usar "trechos").

## 8. Regras e documentação

- `docs/regras-de-negocio.md`: novas regras `RN-LEG-001…` cobrindo permissão, base global,
  seleção por todos, várias por pergunta sem artigo, herança na não conformidade, relatórios só
  com o nome, leitura com plano B, créditos, remoção bloqueada com vínculos.
- Script `scripts/legislacao-automatica.sql` (idempotente) com todas as mudanças de schema +
  a nova versão da função `buscar_chunks_similares`; linha nova em `docs/DEPLOY.md` (rodar
  antes do deploy da API).

## Critérios de pronto

- Suites verdes: API `npx jest` + `tsc --noEmit`; web `npx vitest run` + `tsc --noEmit`;
  teste de guarda sem DaisyUI segue passando.
- Testes cobrem: nome curto, `chaveLegislacao`, `dividirEmTrechos`, extração de HTML
  (fixtures pequenas de DOU/datalegis/Planalto, incluindo ISO-8859-1), validação de URL
  (IPs privados, esquema), guard de permissão, fluxo de leitura (sucesso, link vazio → falhou
  sem apagar trechos antigos, sem créditos), dedupe por link, vínculos e texto derivado,
  ligação de referências antigas, `legislacaoIds` na resposta da IA, remoção bloqueada.
