# Configuração em lote de perguntas e importação de checklist com IA — Design

**Data:** 2026-10-21
**Origem:** pedido do cliente por áudio (WhatsApp, 2026-10-20) + decisões do Yuri na conversa de 2026-10-21
**Mockups:** https://claude.ai/artifact/WfHqTmGgTnFbUtg1yCmvRN (6 telas)
**Status:** rascunho para aprovação

## 1. Intenção e motivo

O cliente importou todos os checklists que usa no dia a dia. Como cada planilha veio com uma configuração diferente, as respostas ficaram despadronizadas, e hoje a única forma de corrigir é abrir pergunta por pergunta.

Citação (transcrição): *"as respostas eu tenho que padronizar… queria saber se dava pra ter uma edição de respostas, como se replicasse… a partir do momento que eu coloco isso nesse checklist, ele replica isso pra todas as perguntas… quando eu falo de respostas eu falo tanto de respostas como de pontuação, como a configuração do que é foto, do que é obrigatório o foto, do que é obrigatório a observação… na parte do editar grupo… configura a resposta padrão para cada grupo ou pelo checklist mesmo."*

O Yuri ampliou o pedido em três frentes:

1. **IA na importação:** inferir os valores corretos para o nosso cenário (boas práticas e legislação) e corrigir a ortografia.
2. **Configuração em lote:** de perguntas selecionadas, de um grupo ou do checklist inteiro. Inclui a configuração nova "pode receber foto" e "pode receber observação".
3. **Resposta do tipo "texto" desativa anexar imagens.**

Pedido explícito: *uma experiência fluida para essa parte de configuração.*

## 2. Objetivos

1. Importar uma planilha e receber um checklist já padronizado e com a escrita correta, revisando só o que precisa de atenção.
2. Aplicar a mesma configuração de resposta a várias perguntas de uma vez, com três escopos:
   - perguntas selecionadas;
   - grupo inteiro;
   - checklist inteiro.
3. Ter controle por pergunta de **permitir foto** e **permitir observação**, além das exigências por opção que já existem.
4. Perguntas com resposta em texto nunca recebem fotos. A regra vale na API, no web e no mobile.

## 3. Não-objetivos

- Importar PDF ou Word. Continua só .xlsx/.csv.
- A IA criar, remover, dividir ou reordenar perguntas e grupos. Ela só corrige textos e preenche ou ajusta configurações.
- "Modelos de resposta" salvos e reutilizáveis entre checklists. O botão "Usar um modelo salvo" do mockup 4 fica **fora** desta entrega.
- **Qualquer mudança no app mobile** (decisão do Yuri, 2026-10-21: "não vamos mexer nos apps agora"). A paridade da execução no mobile fica registrada como pendência em `docs/paridade-plataformas.md`.
- Congelar a configuração da pergunta dentro da auditoria. *Decisão minha* (a pergunta ficou em aberto e o Yuri pediu para seguir): auditorias continuam lendo o template ao vivo, como já acontece hoje na edição individual. O painel em lote avisa quando o checklist já tem auditorias ("Este checklist tem N auditorias; pontuação e exigências delas passam a seguir a nova configuração").

## 4. Anti-objetivos (seria falha mesmo funcionando)

- A configuração em lote alterar um campo que o usuário **não ligou**.
- A importação salvar algo antes de o usuário confirmar a revisão.
- A importação travar por inteiro porque a IA falhou ou o gestor está sem créditos.
- Fotos de auditores sumirem em silêncio na sincronização do app (que não será atualizado agora).
- Chamada de IA sem registro de tokens/créditos (`RN-CRD-007`).
- Web e mobile exigirem coisas diferentes do auditor para a mesma pergunta (hoje isso já acontece com texto + foto obrigatória; ver 7.3).

## 5. Estado atual (levantado no código)

- `TemplateItem` (`apps/api/src/modules/checklist/entities/template-item.entity.ts`) tem os campos:
  - `pergunta`, `categoria`, `criticidade`, `peso`, `obrigatorio`;
  - `opcoesResposta` (string[]);
  - `opcoesRespostaConfig` (jsonb `{valor, fotoObrigatoria, observacaoObrigatoria, pontuacao}`);
  - `usarRespostasPersonalizadas`;
  - `tipoRespostaCustomizada` (`texto | numero | data | select`).
- **Não existe** "permitir foto" nem "permitir observação": foto e observação sempre ficam disponíveis.
- `ChecklistService.normalizarOpcoesConfig` reconstrói a config de opções. Texto força `peso = 0`.
- **Importação** (`checklist-import.service.ts`):
  - Lê um layout fixo de colunas e já faz o parse de tipoResposta, permiteFotos, fotosObrigatorias, justificativa/comentário obrigatório e pontos por opção.
  - Porém **descarta** esses campos ao gravar.
  - Grava toda pergunta com criticidade `media` e `opcoesRespostaConfig` vazio.
  - Não usa IA.
- **Editor web** (`apps/web/src/app/admin/templates/[id]/page.tsx`):
  - É um arquivo único com dnd-kit, o modal "Editar Grupo" (nome + descrição) e o modal de pergunta.
  - Não tem seleção múltipla nem operações em lote.
- **Execução:**
  - A API aceita foto em qualquer item (`AuditoriaService.adicionarFoto` não checa o tipo).
  - O web nunca exige foto em texto.
  - O mobile (`sync/pull.ts`) resume a config para `foto_obrigatoria = some(fotoObrigatoria)` e pode exigir foto em item de texto.

## 6. Experiência (mockups)

| # | Tela | O que mostra |
|---|------|--------------|
| 1 | Importação → **Revisão da IA** | Nova etapa entre "Arquivo" e "Dados do checklist" (ver detalhes abaixo). |
| 2 | Editor → **modo seleção** | Botão "Configurar todo o checklist" + "Selecionar perguntas"; checkbox por pergunta e por grupo (marca/desmarca o grupo); barra flutuante "N perguntas selecionadas · Limpar · Configurar em lote". |
| 3 | **Editar Grupo** | Mantém nome/descrição e ganha o bloco "Respostas das perguntas deste grupo" com resumo (no padrão / personalizadas / em texto) e o atalho "Configurar as N perguntas", que abre o painel 4 com escopo = grupo. |
| 4 | **Painel Configurar em lote** | Painel lateral no desktop e gaveta inferior no mobile, ambos via `ResponsiveDialog`/`Sheet` (ver detalhes abaixo). |
| 5 | Lote com **tipo = Texto** | "Opções, pontuação e exigências" e "Permitir fotos" ficam travados com cadeado e o motivo escrito; aviso de que a pontuação e as fotos configuradas serão perdidas. |
| 6 | Web em tela de celular | O mesmo painel com escopo = checklist inteiro. |

**Tela 1, Revisão da IA:**
- Resumo no topo: textos corrigidos, configurações sugeridas, itens para conferir.
- Abas: Todas / Com correção / Para conferir.
- Por pergunta:
  - o texto original riscado acima do texto corrigido, com a palavra alterada destacada;
  - chips em roxo para o que a IA preencheu ou mudou;
  - o motivo quando relevante (ex.: "crítica por envolver controle de pragas");
  - ações para desfazer as sugestões da pergunta e para editar.
- "Aceitar todas as sugestões". Nada é gravado antes de "Continuar" e da confirmação final.

**Painel 4, Configurar em lote:**
- Cada seção tem uma chave **Alterar**. Seção desligada = "Não será alterado".
- Seções:
  - tipo de resposta;
  - opções + pontos + foto/observação obrigatória por opção;
  - permitir fotos;
  - permitir observação;
  - pergunta obrigatória;
  - criticidade.
- O rodapé mostra o impacto ("1 das perguntas já tem opções personalizadas e elas serão substituídas") e o botão "Aplicar em N perguntas".

Visual: tokens do spec `2026-10-17-reestruturacao-visual-web-design.md`, com teal, navy, Inter e Montserrat. Componentes shadcn: `Sheet`, `Drawer`, `Switch`, `Checkbox`, `Tabs`, `Badge`, `Tooltip`, `ConfirmDialog`.
*Decisão minha:* nos botões primários com texto branco, usar `#00796D` (teal escurecido para atingir contraste 4.5:1) e manter `#00B8A9` como cor de marca/realce.

## 7. Regras

### 7.1 Novos campos por pergunta

| Campo | Tipo | Padrão | Regra |
|-------|------|--------|-------|
| `permiteFoto` | boolean | `true` | Se `false`, nenhuma opção pode ter `fotoObrigatoria = true` (a API zera). |
| `permiteObservacao` | boolean | `true` | Se `false`, nenhuma opção pode ter `observacaoObrigatoria = true` (a API zera). |

- Schema via script SQL em `scripts/` (preferência do projeto), com `DEFAULT true` para os itens existentes. Não muda o comportamento de nada que já existe.
- Novas regras de negócio a registrar em `docs/regras-de-negocio.md`:
  - **RN-CHK-014:** pergunta com resposta em **texto** tem `permiteFoto = false`, `peso = 0`, sem opções e sem pontuação. A API força esses valores ao salvar (individual, em lote e na importação).
  - **RN-CHK-015:** `permiteFoto = false` implica `fotoObrigatoria = false` em todas as opções; `permiteObservacao = false` implica `observacaoObrigatoria = false`.
  - **RN-CHK-016:** a configuração em lote só altera os campos enviados. É atômica (tudo ou nada) e restrita ao gestor dono do template (`RN-CHK-011`).
  - **RN-CHK-017:** a importação pode usar IA para corrigir textos e sugerir configurações. Em conflito com a planilha, **vale a sugestão da IA** (decisão do Yuri), e o valor original fica visível para reverter. Nada é gravado antes da confirmação.
  - **RN-FOT-005:** item com `permiteFoto = false` (inclui texto) não oferece anexar foto no web. *Decisão minha:* enquanto o app mobile não for atualizado, a API **aceita** a foto mesmo assim e registra um log de aviso, para não perder fotos de apps antigos. Recusar na API fica para quando o app tiver a mesma regra.
- *Decisão minha:* texto **permite observação** por padrão. A observação é um campo separado da resposta e pode ser desligada pela configuração.

### 7.2 Configuração em lote

- **Escopo:** `itemIds[]` (seleção), `grupoId` (grupo) ou o template inteiro. Considera só os itens ativos.
- **Campos alteráveis** (cada um opcional; ausente = não altera):
  - `tipoResposta`: `padrao | personalizada | texto | numero | data`;
  - `opcoes`: lista de `{valor, pontuacao, fotoObrigatoria, observacaoObrigatoria}`;
  - `permiteFoto`;
  - `permiteObservacao`;
  - `obrigatorio`;
  - `criticidade`.
- **Opções:**
  - Com `tipoResposta = padrao`, a lista vale para as 4 respostas padrão (conforme, não conforme, não se aplica, não avaliado). Não se aplica e não avaliado ficam sem pontuação (`OPCOES_SEM_PONTUACAO`).
  - Com `personalizada`, substitui `opcoesResposta` e `opcoesRespostaConfig` e marca `usarRespostasPersonalizadas = true`.
  - *Decisão minha:* `opcoes` **só pode ser enviado junto com `tipoResposta` = `padrao` ou `personalizada`**. No painel, a seção "Opções, pontuação e exigências" só liga quando "Tipo de resposta" está ligado com um desses dois tipos; a API rejeita (400) o envio sem tipo. Assim a lista final de cada pergunta é sempre exatamente a do painel, sem merge ambíguo.
- **Regras forçadas** depois do merge: RN-CHK-014 e RN-CHK-015 e `normalizarOpcoesConfig`.
- **Ordem de aplicação:** tipo → opções → permite foto/observação → obrigatório → criticidade → regras forçadas.
- **Impacto prévio:** a API expõe uma simulação (mesmo endpoint com `simular: true`) que devolve o total afetado, quantos itens personalizados serão substituídos, quantos são ignorados e quantas auditorias usam o checklist. O painel mostra isso no rodapé antes de aplicar.
- Ao aplicar com substituição de personalizadas, pedir confirmação com `ConfirmDialog`.

### 7.3 Execução de auditoria (somente web)

- `permiteFoto = false` (inclui texto): esconder a aba/botão de fotos e não exigir foto.
- `permiteObservacao = false`: esconder o campo de observação e não exigir observação.
- Itens que já têm fotos continuam mostrando as fotos existentes (somente leitura); a regra só impede fotos novas.
- **Mobile: fora desta entrega.** A API continua devolvendo os campos novos no `GET` (o app ignora campos desconhecidos). Como a API força `fotoObrigatoria = false` nas opções de itens de texto (RN-CHK-014/015), o app antigo deixa de exigir foto em texto por consequência, sem mudança no app.
- Registrar em `docs/paridade-plataformas.md` a pendência "mobile: respeitar permiteFoto/permiteObservacao".

### 7.4 Importação com IA

**Etapa 1, ler melhor a planilha (sem IA):** gravar os campos que o parser já lê e hoje são descartados.
- *Decisão minha:* célula **vazia** = "não informado" → usa o padrão (`true` para permitir foto/observação, `false` para exigências). O parser passa a distinguir vazio de "não" (`parseBool` devolve `undefined` para vazio).
- `permiteFotos` (col. 16) → `permiteFoto`; `permiteComentario` (col. 11) → `permiteObservacao`;
- `fotosObrigatorias` (col. 17) e `justificativaObrigatoria` (col. 9) → exigências por opção (aplicadas às opções de inconformidade quando a planilha indicar, senão a todas);
- `pontos` por opção → `pontuacao`;
- `tipoResposta` (col. 3) → tipo, quando reconhecível (*decisão minha:* mapear por palavras-chave — texto/número/data/lista/seleção; valor desconhecido → padrão ou personalizada conforme houver opções, e a pergunta vai para "conferir"). Ajustar o mapeamento com uma planilha real do cliente durante a implementação;
- chamar `normalizarOpcoesConfig`.

**Etapa 2, revisão com IA:**

1. **Endpoint novo** `POST /checklists/importar/checklist/revisar` (JSON).
   - *Decisão minha:* o front já tem a estrutura lida pela planilha (o `preview` passa a devolver as perguntas completas, já com a etapa 1 aplicada). Ele chama `revisar` **uma vez por lote** (um grupo, ou até ~40 perguntas), **em sequência**. Isso dá progresso real ("Revisando grupo X de Y") e evita timeout de proxy, sem fila nem polling.
   - Cada chamada devolve o lote revisado (grupos → perguntas) com, por pergunta:
     - `original` (texto e configuração da planilha);
     - `sugerido` (texto corrigido e configuração);
     - `alteracoes[]` (lista de campos alterados);
     - `motivo?`;
     - `conferir: boolean`.
   - Não grava nada.
2. **O que a IA faz:**
   - corrige a ortografia e a acentuação de grupos, perguntas e opções, sem mudar o sentido;
   - sugere categoria, criticidade, tipo de resposta, pontuação, permitir foto/observação e foto/observação obrigatória por opção.
   - Contexto: boas práticas de manipulação de alimentos e a legislação já indexada (RAG existente, `LegislacaoModule`).
3. **Marcação "conferir":**
   - quando a sugestão contradiz a planilha;
   - quando uma regra forçada removeu algo (ex.: virou texto e perdeu fotos/pontos).
4. **Créditos:**
   - Mesmo padrão do `ChecklistIaService`: `identificarGestorId` → `validarSaldoDisponivel` → chamada DeepSeek → `registrarUso` com `metodoChamado: 'checklistImport.revisao'`. MASTER é isento.
   - *Decisão minha:* saldo validado **antes de cada lote**. Se acabar no meio, os lotes restantes entram sem sugestões (como um lote com falha), com aviso.
   - Sem saldo desde o início: a tela pula a revisão com o aviso "importação sem revisão da IA (créditos insuficientes)" e segue só com a etapa 1.
5. **Falha de um lote:** as perguntas desse lote entram sem sugestões e com aviso. As demais seguem normalmente.
6. **Progresso:** a tela mostra "Revisando grupo X de Y", com base nas chamadas por lote do item 1.
7. **Confirmação:** endpoint novo `POST /checklists/importar/checklist/confirmar` (JSON).
   - Recebe a estrutura final revisada (com as sugestões aceitas ou desfeitas e as edições) mais os dados do checklist (nome, descrição, tipo de atividade, versão).
   - Cria o template como **rascunho**, numa transação, aplicando RN-CHK-014/015.
   - O endpoint atual baseado em arquivo continua funcionando.
8. **Autorização:** os endpoints de importação passam a exigir perfil MASTER ou GESTOR (hoje não há `RolesGuard`; regra `RN-CHK-002`).

## 8. Restrições

- Monorepo NestJS + Next.js + Expo; DaisyUI em remoção, então as telas novas usam shadcn.
- Isolamento e autorização na API (`gestorId` dono do template).
- Auditoria de tokens obrigatória para IA.
- Schema via SQL em `scripts/`.
- Pipeline SDD do projeto: regras catalogadas em `docs/regras-de-negocio.md`, TDD na API.
- Mobile-first nos formulários: o painel em lote vira gaveta inferior no celular (web responsivo; mockup 6).
- Nenhuma alteração em `apps/mobile`.

## 9. Deixado para quem implementa

- Formato exato do prompt da IA e do JSON de resposta (validar com schema e descartar campos inválidos).
- Divisão do editor de 1.667 linhas em componentes: no mínimo, extrair o painel de lote e o modo seleção para arquivos próprios. O editor de `novo/page.tsx` é quase duplicado; aplicar o lote só em `[id]` (template já salvo).
- Se a seleção mantém ou não o arrastar-para-reordenar ativo (sugestão: desativar o drag em modo seleção).
- Textos finais de tooltips e avisos, seguindo o tom sóbrio do produto e sem jargão técnico.
