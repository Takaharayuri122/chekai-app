# Catálogo da primeira onda

Vinte e cinco tools, todas com perfis `master`, `gestor` e `auditor`. O nome no protocolo é o da coluna Tool. A descrição abaixo é a registrada no servidor.

Listagens aceitam `page` (inteiro ≥ 1, padrão 1) e `limit` (inteiro de 1 a 100, padrão 20), salvo quando o schema da tool não inclui paginação. IDs são UUID. Datas de filtro e prazo são `YYYY-MM-DD`. A resposta de lista é `{ items, total, page, limit, totalPages, hasNext, hasPrevious }`.

| Tool | Scope | Argumentos |
|------|-------|------------|
| `chekai_me` | `chekai:contexto` | nenhum |
| `chekai_listar_clientes` | `chekai:clientes:ler` | `page`, `limit` |
| `chekai_obter_cliente` | `chekai:clientes:ler` | `clienteId` |
| `chekai_listar_unidades` | `chekai:clientes:ler` | `page`, `limit`, `clienteId` opcional |
| `chekai_listar_checklists` | `chekai:checklists:ler` | `page`, `limit` |
| `chekai_obter_checklist` | `chekai:checklists:ler` | `checklistId` |
| `chekai_listar_auditorias` | `chekai:auditorias:ler` | `page`, `limit`, `clienteId` opcional |
| `chekai_obter_auditoria` | `chekai:auditorias:ler` | `auditoriaId` |
| `chekai_iniciar_auditoria` | `chekai:auditorias:escrever` | `unidadeId`, `templateId`, `latitude` e `longitude` opcionais |
| `chekai_responder_item` | `chekai:auditorias:escrever` | `auditoriaId`, `itemId`, `resposta`; opcionais `observacao`, `descricaoNaoConformidade`, `complementoDescricao`, `referenciaLegal` |
| `chekai_preparar_finalizacao` | `chekai:auditorias:finalizar` | `auditoriaId` |
| `chekai_finalizar_auditoria` | `chekai:auditorias:finalizar` | `auditoriaId`, `confirmationToken`; opcionais `latitude`, `longitude`, `observacoesGerais` |
| `chekai_listar_agenda` | `chekai:agenda:ler` | `page`, `limit`; opcionais `status`, `responsavelId`, `de`, `ate` |
| `chekai_concluir_agendamento` | `chekai:agenda:concluir` | `agendamentoId` |
| `chekai_listar_tarefas` | `chekai:tarefas:ler` | `page`, `limit`; opcionais `status`, `responsavelId` |
| `chekai_criar_tarefa` | `chekai:tarefas:escrever` | `titulo` (1–200), `prazo`; opcionais `descricao`, `responsavelId`, `auditoriaId` |
| `chekai_atualizar_tarefa` | `chekai:tarefas:escrever` | `tarefaId`; opcionais `titulo`, `descricao`, `responsavelId`, `prazo` |
| `chekai_concluir_tarefa` | `chekai:tarefas:escrever` | `tarefaId` |
| `chekai_reabrir_tarefa` | `chekai:tarefas:escrever` | `tarefaId` |
| `chekai_listar_relatorios` | `chekai:relatorios:ler` | `page`, `limit`; opcionais `clienteId`, `status`, `dataInicio`, `dataFim` |
| `chekai_obter_relatorio` | `chekai:relatorios:ler` | `relatorioId` |
| `chekai_iniciar_relatorio` | `chekai:relatorios:escrever` | `clienteId`, `unidadeId` |
| `chekai_atualizar_relatorio` | `chekai:relatorios:escrever` | `relatorioId`; opcionais `clienteId`, `unidadeId`, `identificacao`, `descricaoOcorrenciaHtml`, `avaliacaoTecnicaHtml`, `acoesExecutadas` (até 100 strings), `recomendacoesConsultoraHtml`, `planoAcaoSugeridoHtml`, `assinaturaNomeConsultora`, `responsavel` |
| `chekai_preparar_finalizacao_relatorio` | `chekai:relatorios:finalizar` | `relatorioId` |
| `chekai_finalizar_relatorio` | `chekai:relatorios:finalizar` | `relatorioId`, `confirmationToken` |

## Valores de enum aceitos no input

- Agenda `status`: `agendada`, `realizada`, `cancelada`.
- Tarefa `status` na listagem: `pendente`, `em_andamento`, `concluida`, `cancelada`.
- Relatório `status`: `rascunho`, `finalizado`.
- Perfil em `chekai_me`: `master`, `gestor`, `auditor`.

## Recorte que não é outro catálogo

AUDITOR vê checklist somente com status ativo; obter um inativo responde que o checklist não está disponível. Clientes, unidades, auditorias, agenda, tarefas e relatórios seguem o isolamento já aplicado nos services (vínculo do auditor, domínio do gestor). Não há tool para criar, editar, cancelar ou remover agendamento, nem para reabrir auditoria ou apagar tarefa, cliente ou relatório.

Coordenadas em iniciar ou finalizar auditoria são opcionais. O servidor não inventa localização.

## Fora do canal

Não estão registradas e não executam, para qualquer perfil e scope: equipe e convites, planos e assinaturas, lista de espera, créditos, auditoria global de tokens, legislação, chunks, RAG, cadastro público, login legado, IA genérica, fotos, PDF e check-in. CRUD de clientes, unidades e checklists também fica para onda posterior.

Nomes que os testes de segurança garantem ausentes: `chekai_convidar_equipe`, `chekai_listar_equipe`, `chekai_convites`, `chekai_planos`, `chekai_assinaturas`, `chekai_lista_espera`, `chekai_configurar_creditos`, `chekai_auditoria_tokens`, `chekai_legislacao`, `chekai_chunks`, `chekai_rag`, `chekai_cadastro_publico`, `chekai_login`, `chekai_ia`, `chekai_prompt`, `chekai_criar_agendamento`, `chekai_editar_agendamento`, `chekai_cancelar_agendamento`, `chekai_remover_agendamento`, `chekai_reabrir_auditoria`, `chekai_remover_tarefa`, `chekai_remover_cliente`.

## Confirmação

`chekai_preparar_finalizacao` e `chekai_preparar_finalizacao_relatorio` devolvem `token`, `expiraEm` e `resumo`. A finalização correspondente exige esse `confirmationToken`. O token é de uso único, vale 10 minutos e está amarrado ao usuário, à ação e ao id do recurso. A tentativa de uso consome o token. Ele vive só na memória do processo da API.
