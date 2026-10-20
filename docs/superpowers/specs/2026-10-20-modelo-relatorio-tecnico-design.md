# Modelo personalizável do Relatório Técnico — Design

**Data:** 2026-10-20
**Origem:** pedido da cliente por áudio (WhatsApp, 2026-10-20)
**Status:** rascunho para aprovação

## 1. Intenção e motivo

Hoje o relatório técnico usa formato fixo e as consultoras gostam dele. A cliente quer que o **gestor defina, uma vez, como o relatório técnico da equipe dele deve ser**: quais seções aparecem e qual o nome de cada uma. Assim a consultora preenche só o que interessa ao gestor, e o PDF entregue ao cliente final sai com os nomes que fazem sentido no negócio dele.

Citação (transcrição): *"a gente poderia botar editável pro gestor… ele pode ativar ou desativar a descrição da ocorrência ou a avaliação técnica… ou ele pode editar, tipo, retorno do cliente… onde tem recomendações pra consultora, plano de ação sugerido, ela pode botar ações realizadas… eu posso editar como eu quero que esse relatório técnico seja desenvolvido."*

## 2. Objetivos

1. O gestor configura **um único modelo** de relatório técnico. É configuração de conta, feita uma vez e alterável depois.
2. No modelo, o gestor pode:
   - **ativar/desativar** cada seção configurável;
   - **renomear** cada seção configurável.
3. Todos os relatórios criados pelas consultoras vinculadas ao gestor seguem o modelo:
   - formulário (web e mobile) mostra só as seções ativas, com os títulos definidos;
   - PDF mostra só as seções ativas, com os títulos definidos;
   - validação para finalizar e para gerar apoio analítico exige apenas as seções ativas.
4. Sem configuração, o comportamento é **idêntico ao de hoje**.

## 3. Não-objetivos

- Criar seções novas do zero (campos livres adicionais). *(Decisão minha: a cliente pediu ligar/desligar e renomear. Seções novas exigiriam um esquema de campos dinâmicos e ficam para depois, se pedirem.)*
- Reordenar seções.
- Vários modelos por gestor (por cliente, por tipo de visita etc.).
- Personalizar o relatório de auditoria (checklist). Isso é outro produto.
- Mudar o tipo de campo de uma seção (ex.: transformar "Ações executadas", que é lista, em texto rico).

## 4. Anti-objetivos (seria falha mesmo funcionando)

- Um relatório **já finalizado** mudar de aparência (títulos/seções) no PDF porque o gestor alterou o modelo depois.
- Uma consultora ficar travada sem conseguir finalizar por causa de uma seção que o gestor desligou.
- Perder conteúdo já digitado quando uma seção é desligada e depois religada.
- Isolamento só no front: a API precisa aplicar o modelo e a permissão de edição.

## 5. Seções

| Chave (`secao`) | Título padrão | Configurável | Tipo de conteúdo / campo da entidade |
|---|---|---|---|
| `identificacao` | Identificação | **Não**, sempre ativa e título fixo | `identificacao` |
| `descricaoOcorrencia` | Descrição da Ocorrência | Sim | `descricaoOcorrenciaHtml` (texto rico) |
| `evidenciasFotograficas` | Evidências Fotográficas | Sim | `fotos` (relação) |
| `avaliacaoTecnica` | Avaliação Técnica | Sim | `avaliacaoTecnicaHtml` (texto rico) |
| `acoesExecutadas` | Ações Executadas na Visita | Sim | `acoesExecutadas` (lista) |
| `recomendacoesConsultora` | Recomendações da Consultora | Sim | `recomendacoesConsultoraHtml` (texto rico) |
| `planoAcaoSugerido` | Plano de Ação Sugerido | Sim | `planoAcaoSugeridoHtml` (texto rico) |
| `apoioAnalitico` | Apoio Analítico ChekAi | Sim | `apoioAnaliticoChekAi` (gerado por IA) |
| `assinaturas` | Assinaturas | **Não**, sempre ativa e título fixo | `assinaturaNomeConsultora`, `responsavel` |

A ordem é sempre a da tabela. Os campos da entidade **não mudam**: o modelo só controla exibição, títulos e obrigatoriedade.

Regras do modelo:
- Pelo menos **uma** seção configurável de conteúdo precisa ficar ativa, sem contar `evidenciasFotograficas` nem `apoioAnalitico`. *(Decisão minha: evita um relatório só com identificação e assinatura, e garante que a IA tenha texto para analisar.)*
- Título: obrigatório quando a seção está ativa, com no máximo 60 caracteres, sem HTML (aparar espaços). Título vazio é tratado como "usar o padrão".
- "Restaurar padrão": ação na tela de configuração que volta tudo para o estado de hoje.

## 6. De quem é o modelo (resolução)

O modelo pertence ao **gestor** (`gestorId`), igual a clientes e checklists.

| Perfil de quem cria/abre o relatório | Modelo usado |
|---|---|
| AUDITOR com `gestorId` | modelo do seu gestor |
| AUDITOR sem `gestorId` | padrão |
| GESTOR | o próprio modelo |
| MASTER | o próprio modelo (MASTER também pode configurar) *(decisão minha)* |

Quem pode **editar** o modelo: GESTOR (o próprio) e MASTER (o próprio). AUDITOR só lê. A validação fica na API.

## 6.1 Liberação por plano

Decisão da cliente: personalizar o modelo é um recurso de **plano/assinatura**, e o MASTER escolhe quais planos o incluem.

- Nova coluna `planos.permite_modelo_relatorio_tecnico boolean not null default false`, via script SQL em `scripts/`. Ela aparece como um switch "Permite personalizar o relatório técnico" no formulário de planos do web (`/admin/planos`), editável só pelo MASTER, e entra nos DTOs de criar/atualizar plano.
- A permissão é calculada a partir da **assinatura ativa do gestor** (`AssinaturaService.buscarAssinaturaAtiva`), seguindo o padrão de `ValidacaoLimitesService`.
- `PUT /relatorios-tecnicos/modelo`: GESTOR sem assinatura ativa, ou com plano sem o recurso, recebe 403 com uma mensagem clara. O MASTER não depende de plano.
- `GET /relatorios-tecnicos/modelo` também devolve `podePersonalizar: boolean`.
- Web: para o GESTOR sem o recurso, o botão "Personalizar modelo" aparece desabilitado, com tooltip explicando que o recurso não está incluído no plano atual. *(Decisão minha. A alternativa seria esconder o botão.)*
- **Plano perde o recurso** (troca de plano ou assinatura encerrada): o modelo salvo **é mantido no banco, mas deixa de ser aplicado**. Os rascunhos voltam ao padrão, os finalizados mantêm o snapshot, e se o gestor voltar a ter o recurso, o modelo dele volta a valer. *(Decisão minha.)*

## 7. Congelamento (relatórios existentes)

- **Rascunho** segue sempre o modelo vigente do dono (resolvido pela `consultoraId` do relatório, não por quem está visualizando).
- **Ao finalizar**, a API grava no relatório um *snapshot* do modelo aplicado (`modelo_secoes` jsonb). A partir daí, PDF e visualização usam o snapshot.
- Relatórios finalizados **antes** desta feature (snapshot nulo) usam o modelo padrão, exatamente como saem hoje.
- Desligar uma seção **não apaga** o conteúdo salvo. Ele só deixa de aparecer, e volta se a seção for religada enquanto o relatório estiver em rascunho. No snapshot de finalização, o conteúdo de seções inativas é ignorado no PDF.
- **O snapshot só é gravado na transição** de status para `finalizado`, ou seja, quando o status salvo ainda não é `finalizado`. Um `PUT` que reenvia `status: 'finalizado'` para um relatório já finalizado **não** refaz o snapshot. Isso é importante porque o push do mobile reenvia o status em toda sincronização (`sync/push.ts`). *(Decisão minha.)*
- **Relatório finalizado editado no web** (o fluxo atual permite): o formulário e a validação seguem o **snapshot**. A validação de obrigatórios roda em todo salvamento de relatório finalizado, usando o snapshot. *(Decisão minha.)*
- Não existe hoje um "reabrir para rascunho", e esta feature não cria um. Se um dia existir, ele deve descartar o snapshot.
- **Finalização offline no mobile com modelo desatualizado:** o mobile não envia o modelo, e a API valida contra o modelo vigente (o cliente nunca dita o modelo, seguindo a regra de isolamento na API). Se faltar uma seção que o gestor ligou nesse meio-tempo, a API responde 409 com a mensagem citando o título da seção. O app mantém o relatório como rascunho localmente, atualiza o modelo em cache e avisa a consultora o que falta preencher. *(Decisão minha. A alternativa de aceitar o modelo enviado pelo app foi descartada por confiar no cliente.)*

## 8. Comportamento por parte do sistema

### 8.1 API (`apps/api/src/modules/relatorio-tecnico`)
- Nova tabela `modelos_relatorio_tecnico` (script SQL em `scripts/`, sem migration TypeORM):
  `id uuid pk`, `gestor_id uuid unique not null fk usuarios`, `secoes jsonb not null`, `criado_em`, `atualizado_em`.
  `secoes` = array `{ secao: string; ativa: boolean; titulo: string }` apenas com as configuráveis.
- Nova coluna `relatorios_tecnicos.modelo_secoes jsonb null` (snapshot, ver §7).
- Endpoints (declarar **antes** das rotas `:id`):
  - `GET /relatorios-tecnicos/modelo` → modelo resolvido para o usuário logado (§6), já mesclado com os padrões (sempre devolve todas as seções configuráveis, mesmo se o registro não existir).
  - `PUT /relatorios-tecnicos/modelo` → GESTOR/MASTER; valida regras do §5; faz upsert.
  - `GET /relatorios-tecnicos/:id` passa a devolver `modeloSecoes` efetivo daquele relatório (snapshot se finalizado; senão modelo vigente do dono), para web/mobile renderizarem sem segunda chamada.
- `validarRelatorioMinimoParaConclusao`: exigir apenas campos de seções ativas no modelo efetivo; `identificacao` é sempre obrigatória. A regra de "ao menos uma ação executada" vale só se `acoesExecutadas` estiver ativa.
- `CriarRelatorioTecnicoDto`: os campos HTML deixam de ser `@IsNotEmpty` (passam a `@IsOptional` + `@IsString`), já que a obrigatoriedade passa a ser decidida pelo modelo na finalização.
- Apoio analítico (`IaService.gerarApoioAnaliticoRelatorioTecnico`): bloqueado se `apoioAnalitico` estiver inativa; o prompt inclui só seções ativas, rotuladas com os **títulos personalizados**. Mantém auditoria de tokens (`CreditoService`), conforme `.cursor/rules/auditoria-tokens.mdc`.
- PDF (`relatorio-tecnico-html.service.ts`): renderiza só seções ativas, com títulos do modelo efetivo e escape de HTML nos títulos.

### 8.2 Web (`apps/web`)
- Nova tela **"Modelo do relatório técnico"**, acessível por um botão "Personalizar modelo" na listagem `/admin/relatorios-tecnicos` (visível só para GESTOR/MASTER). Rota sugerida: `/admin/relatorios-tecnicos/modelo`.
- Conteúdo da tela: lista das seções na ordem fixa. Cada linha tem um switch (ativa/inativa), um campo de título (placeholder = título padrão) e a indicação do título padrão. Identificação e Assinaturas aparecem travadas, como informação. Botões "Salvar" e "Restaurar padrão" (este com `ConfirmDialog`). Mobile-first, shadcn/ui + tokens da marca (sem DaisyUI novo), tooltips nas ações.
- Uma prévia simples (lista de títulos na ordem em que vão sair no PDF) fica a critério do builder.
- `RelatorioTecnicoForm`: recebe `modeloSecoes`, esconde seções inativas, usa os títulos e marca como obrigatórias só as ativas.

### 8.3 Mobile (`apps/mobile`)
- Sem tela de configuração (configuração é tarefa de gestor, feita no web). *(Decisão minha.)*
- Tela `relatorios/[id].tsx` respeita o modelo: esconde seções inativas e usa os títulos.
- Offline: guardar o modelo resolvido localmente (MMKV ou SQLite, a critério do builder), atualizado no pull de sincronização. Sem cache, usar o padrão. A `modeloSecoes` vinda do detalhe do relatório tem precedência.
- Validação local de finalização espelha a da API.

### 8.4 Documentação
- `docs/regras-de-negocio.md`: novas regras RN-REL-009 em diante (modelo por gestor, resolução por perfil, snapshot na finalização, obrigatoriedade condicionada) e ajuste de RN-REL-003/004 para "quando a seção estiver ativa".
- `docs/paridade-plataformas.md` e `docs/de-para-web-mobile.md`: linha "Modelo do relatório técnico" (web configura; web e mobile respeitam).

## 9. Critérios de aceite

1. Gestor sem configuração: relatório, formulário e PDF idênticos aos de hoje.
2. Gestor desliga "Avaliação Técnica" e renomeia "Recomendações da Consultora" para "Retorno do Cliente". A auditora vinculada abre um relatório novo (web e mobile) e não vê Avaliação Técnica, vê "Retorno do Cliente", e finaliza sem preencher avaliação. O PDF segue o mesmo modelo.
3. Gestor muda o modelo depois. Relatórios já finalizados mantêm títulos e seções no PDF, e rascunhos passam a seguir o novo modelo.
4. AUDITOR que chama `PUT /relatorios-tecnicos/modelo` recebe 403.
5. Tentar salvar um modelo sem nenhuma seção de conteúdo ativa retorna erro de validação claro.
6. Com "Apoio Analítico" desligado, o botão some e o endpoint retorna erro.
7. Gestor A nunca vê nem altera o modelo do gestor B.
8. Gestor com plano sem o recurso: o botão fica desabilitado com tooltip, e o `PUT` retorna 403. Quando o MASTER liga o recurso no plano, o gestor passa a conseguir configurar.
9. Gestor que configurou o modelo e depois perde o recurso: rascunhos novos voltam ao padrão, e o modelo reaparece intacto se o recurso voltar.

## 10. Deixado para o builder

- Componentização da tela de configuração e da prévia.
- Formato exato do cache offline no mobile.
- Nomes finais de DTOs/serviços e organização de testes, seguindo o padrão do módulo e TDD (pipeline SDD do projeto).
- Mensagens de erro exatas (em pt-BR, usando os títulos personalizados quando fizer sentido).
