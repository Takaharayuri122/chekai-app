# Regras de Negócio — Plataforma ChekAI

> Documento vivo mantido pelo agente `platform-orchestrator`.
> Cada regra possui um identificador único (`RN-<DOMÍNIO>-<NNN>`) para rastreabilidade em casos de uso, testes e código.

---

## 1. Usuários e Perfis

### Perfis

| Perfil | Papel |
|--------|-------|
| MASTER | Administrador da plataforma; visão global, CRUD de planos, configurações de créditos, gestão de legislação |
| GESTOR | Dono de consultoria; `tenantId = próprio id`; gerencia clientes, templates, auditores vinculados |
| AUDITOR | Executor; vinculado a um GESTOR via `gestorId`; executa auditorias e relatórios como consultor |

### Regras

| ID | Regra |
|----|-------|
| RN-USR-001 | E-mail é único no sistema; tentativa de cadastro duplicado retorna erro |
| RN-USR-002 | GESTOR só pode criar usuários com perfil AUDITOR; o `gestorId` é forçado como o ID do gestor criador |
| RN-USR-003 | MASTER pode criar qualquer perfil; se o perfil for GESTOR, `gestorId` é removido |
| RN-USR-004 | Ao criar um GESTOR, `tenantId` é igualado ao próprio `id` do usuário após o save |
| RN-USR-005 | Criação de usuário por convite interno: status `nao_confirmado`, token de convite UUID com expiração de 48h |
| RN-USR-006 | Cadastro público (pelo site): sempre cria GESTOR + assinatura no plano selecionado + e-mail de boas-vindas |
| RN-USR-007 | Aceite de convite: valida token e expiração; ativa a conta (`status = ativo`); limpa token |
| RN-USR-008 | Reenvio de convite: só para usuários com status `nao_confirmado`; gera novo token com nova expiração de 48h |
| RN-USR-009 | MASTER vê todos os usuários; GESTOR vê a si mesmo e seus auditores; AUDITOR vê apenas a si |
| RN-USR-010 | Atualização de dados: MASTER/GESTOR podem atualizar a si ou seus auditores; AUDITOR apenas a si |
| RN-USR-011 | Remoção (hard delete): apenas MASTER; bloqueada se existirem auditorias como consultor ou usuários como gestor; clientes vinculados têm `gestorId` anulado antes do delete |
| RN-USR-012 | Validação de limite de usuários do plano antes de criar (exceto MASTER) |

---

## 2. Autenticação

| ID | Regra |
|----|-------|
| RN-AUTH-001 | Login via OTP: código de 6 dígitos enviado por e-mail, expira em 10 minutos |
| RN-AUTH-002 | Em ambiente de desenvolvimento (`NODE_ENV !== production`), o código mock `252622` é aceito |
| RN-AUTH-003 | Conta com status `nao_confirmado` não pode solicitar OTP (orientação: aceitar convite primeiro) |
| RN-AUTH-004 | Conta com status `inativo` não pode solicitar OTP |
| RN-AUTH-005 | Após validação do OTP, token JWT é gerado com `sub`, `email` e `perfil` |
| RN-AUTH-006 | JWT é enriquecido no `JwtStrategy`: recarrega usuário e injeta `gestorId` e `tenantId` no request |
| RN-AUTH-007 | Usuário que não está ATIVO é rejeitado no `JwtStrategy` |
| RN-AUTH-008 | Login legado com senha existe mas está deprecated; prioridade é OTP |
| RN-AUTH-009 | `FRONTEND_URL` deve existir em todos os ambientes; sem fallback — falhar claro se ausente |

---

## 3. Isolamento de Dados

| ID | Regra |
|----|-------|
| RN-ISO-001 | Clientes são isolados por `gestorId`: cada gestor vê apenas seus clientes |
| RN-ISO-002 | Templates são isolados por `gestorId`: AUDITOR vê apenas templates **ativos** do seu gestor |
| RN-ISO-003 | Auditorias são isoladas por `consultorId`: AUDITOR vê apenas as próprias; MASTER/GESTOR veem as próprias E as de auditores vinculados (`consultor.gestorId = usuario.id`) |
| RN-ISO-004 | Relatórios técnicos seguem a mesma regra de isolamento das auditorias (`consultoraId`) |
| RN-ISO-005 | Check-ins: GESTOR vê e edita apenas check-ins de clientes onde é `gestorId`; AUDITOR não acessa listagem administrativa |
| RN-ISO-006 | Créditos de IA são contabilizados por gestor; auditor consome quota do seu gestor |

---

## 4. Clientes e Unidades

| ID | Regra |
|----|-------|
| RN-CLI-001 | Apenas MASTER e GESTOR podem criar clientes |
| RN-CLI-002 | CNPJ é único no sistema (normalizado sem máscara antes de validar) |
| RN-CLI-003 | Cliente pode ter N auditores (N:N via `cliente_auditores`); auditores devem pertencer ao mesmo gestor |
| RN-CLI-004 | Unidade pertence a um cliente; possui geolocalização e `raioGeofencing` (default 100m) |
| RN-CLI-005 | Unidade pode ter N auditores (N:N via `unidade_auditores`); auditores da unidade devem estar no pool de auditores do cliente |
| RN-CLI-006 | AUDITOR vê apenas clientes/unidades aos quais está vinculado (N:N) |
| RN-CLI-007 | Remoção de cliente/unidade é soft delete (`ativo = false`) |
| RN-CLI-008 | Ao remover auditores de um cliente, verificar se há auditorias em andamento; se sim, retorna warning para confirmação |
| RN-CLI-009 | Validação de limite de clientes do plano antes de criar (exceto MASTER) |
| RN-CLI-010 | Tipos de atividade: `restaurante`, `industria`, `supermercado`, `padaria`, `hospital`, `escola`, `hotel`, `outro` (enum `TipoAtividade`) |

---

## 5. Templates e Checklist

| ID | Regra |
|----|-------|
| RN-CHK-001 | Templates possuem status: `rascunho`, `ativo`, `inativo`; criados sempre como `rascunho` |
| RN-CHK-002 | Apenas MASTER e GESTOR criam templates; `gestorId` = ID do criador |
| RN-CHK-003 | AUDITOR vê apenas templates **ativos** do seu gestor |
| RN-CHK-004 | Para ativar um template, é obrigatório ter pelo menos um item ativo |
| RN-CHK-005 | Template não pode ser excluído (hard delete) se estiver vinculado a alguma auditoria; usar inativação |
| RN-CHK-006 | Template organiza itens em grupos (`ChecklistGrupo`); grupos possuem ordem e podem ser duplicados com seus itens |
| RN-CHK-007 | Itens possuem: pergunta, categoria, criticidade (`baixa`, `media`, `alta`, `critica`), peso, ordem, legislação de referência, flag `obrigatorio` |
| RN-CHK-008 | Tipos de resposta customizada: `texto` (peso=0), `numero`, `data`, `select` |
| RN-CHK-009 | Cada opção de resposta pode ter configuração individual: `fotoObrigatoria`, `observacaoObrigatoria`, `pontuacao` |
| RN-CHK-010 | Itens com `usarRespostasPersonalizadas` permitem opções livres; senão usa enum padrão (`conforme`, `nao_conforme`, `nao_aplicavel`, `nao_avaliado`) |
| RN-CHK-011 | Apenas o gestor dono do template pode editar/remover itens e grupos |
| RN-CHK-012 | Remoção de itens e grupos é soft delete (`ativo = false`) |
| RN-CHK-013 | Geração de templates com IA via `IaService` e RAG via legislação, com auditoria de tokens |
| RN-CHK-014 | Pergunta com resposta em **texto** tem `permiteFoto = false`, `peso = 0`, sem opções e sem pontuação. A API força esses valores ao salvar (individual, em lote e na importação) |
| RN-CHK-015 | `permiteFoto = false` implica `fotoObrigatoria = false` em todas as opções; `permiteObservacao = false` implica `observacaoObrigatoria = false` |
| RN-CHK-016 | Configuração em lote (`PUT /checklists/templates/:id/itens/lote`, MASTER/GESTOR dono do template): aplica só os campos enviados a todos os itens ativos do template, de um grupo ou de `itemIds` informados (itemIds e grupoId juntos ou fora do template = 400). As regras RN-CHK-014/015 são reaplicadas; itens sem mudança são ignorados; `simular: true` devolve as contagens sem salvar |
| RN-CHK-017 | Revisão por IA da importação (`POST /checklists/importar/checklist/revisar`, MASTER/GESTOR): um grupo por chamada (máx. 40 perguntas), com RAG de legislação e auditoria de tokens (`metodoChamado = checklistImport.revisao`). A IA só sugere (corrige texto e propõe configuração) — não cria, remove nem reordena perguntas; valores inválidos voltam ao original e RN-CHK-014/015 são reaplicadas. Alterações em tipo de resposta, peso, foto, observação ou opções, ou conflito vindo da planilha, marcam a pergunta como "conferir". Sem saldo → `sem_creditos`; erro → `falha` (a importação segue sem revisão) |
| RN-CHK-018 | Respostas na configuração em lote: em **opções personalizadas** o gestor edita o texto, remove, adiciona e reordena as respostas (mínimo 2, sem texto vazio nem repetido, ignorando espaços e maiúsculas); a ordem da lista é a ordem que o auditor vê. Nas **respostas padrão** (conforme / não conforme / não se aplica / não avaliado) textos e ordem são fixos — conformidade é decidida por `nao_conforme` e a pontuação padrão depende da posição; só pontos, foto obrigatória e observação obrigatória são editáveis. Histórico: cada opção enviada pode trazer `valorOriginal`; renomear uma resposta de item que já era personalizado atualiza também as respostas já dadas (`auditoria_itens.resposta`) na mesma transação (um único UPDATE com CASE, o que permite trocar A↔B). Remover uma resposta já usada em alguma auditoria é recusado pela API (400, nada é salvo) e a tela desabilita a remoção ("Usada em N auditorias"); `respostasEmUso` vem também na simulação. Itens que eram padrão e passam a personalizados seguem sem bloqueio nem renomeação. Trocar perguntas personalizadas para outro tipo (padrão, texto, número ou data) é permitido mesmo com respostas já usadas em auditorias: o painel avisa que as respostas serão substituídas e a escolha é do usuário (decisão de 2026-10-25) |
| RN-CHK-019 | Sentido da resposta: cada resposta de uma pergunta é positiva, negativa ou neutra. O sentido gravado na configuração da resposta sempre prevalece; sem ele, é deduzido na leitura (nunca gravado por migração): nas respostas padrão, conforme é positiva, não conforme é negativa e não se aplica / não avaliado são neutras; em respostas personalizadas, rótulos como "N/A" e "Não se aplica" são neutros e as demais são classificadas pela pontuação — a de maior pontuação é positiva, a de menor é negativa e as intermediárias ou empatadas são neutras (dedução pela maior e menor pontuação). Perguntas de texto, número e data não têm sentido. Uma não conformidade é toda resposta de sentido negativo, não só `nao_conforme`: o "Não" de uma pergunta [Sim, Não] conta nas métricas dos grupos, no resumo executivo, na listagem de itens não conformes, no ícone do relatório e na geração do plano de ação (RN-PAC-008). O valor gravado em `auditoria_itens.resposta` não muda |
| RN-CHK-020 | Faixas de classificação: cada checklist pode ter suas próprias faixas (nome, cor, emoji, de e até, de 0 a 100); sem faixas próprias, valem as padrão — Crítico (0 a 59,99), Atenção Necessária (60 a 69,99), Regular (70 a 79,99), Bom (80 a 89,99) e Com Excelência (90 a 100). Validação: nome obrigatório (até 20 caracteres), cor no formato #RRGGBB, início menor que o fim, valores entre 0 e 100 e sem sobreposição entre faixas. Nota abaixo de 0 é "Abaixo do mínimo"; nota que cai num vão entre faixas é "Sem classificação". A faixa é calculada na leitura, sempre pelas faixas atuais do checklist; a nota de auditoria finalizada é a gravada na finalização e nunca é recalculada, enquanto a de auditoria em andamento é calculada na hora (pontos obtidos ÷ pontos possíveis). O resultado mostra ainda a tendência frente à auditoria finalizada anterior da mesma unidade e do mesmo checklist e as últimas três notas |

---

## 6. Auditorias

### Ciclo de Vida

| Status | Descrição |
|--------|-----------|
| `rascunho` | Criado mas não iniciado (no mobile muda para `em_andamento` ao abrir) |
| `em_andamento` | Em execução pelo auditor |
| `finalizada` | Concluída com pontuação calculada |
| `cancelada` | Cancelada (uso limitado no fluxo atual) |

### Regras

| ID | Regra |
|----|-------|
| RN-AUD-001 | Todos os perfis (MASTER, GESTOR, AUDITOR) podem iniciar auditorias |
| RN-AUD-002 | AUDITOR deve ter vínculo com o cliente da unidade para iniciar auditoria |
| RN-AUD-003 | Validação de limite de auditorias do plano antes de criar (exceto MASTER) |
| RN-AUD-004 | Ao iniciar, itens ativos do template são copiados para `auditoria_itens` com resposta `nao_avaliado` |
| RN-AUD-005 | Não é possível editar itens de uma auditoria finalizada (sugestão: reabrir) |
| RN-AUD-006 | Resposta de item: validada contra opções do template (enum padrão, personalizada, ou customizada por tipo) |
| RN-AUD-007 | Validação por tipo de resposta customizada: `numero` (deve ser numérico), `data` (deve ser data válida), `select` (deve estar nas opções), `texto` (qualquer string não vazia) |
| RN-AUD-008 | Pontuação de item: usa valor explícito de `opcoesRespostaConfig` quando existir; senão cálculo sequencial (base da primeira opção - índice); `nao_aplicavel`/`nao_avaliado` sempre = 0; `texto` sempre = 0 |
| RN-AUD-009 | Finalização: valida que todos os itens **obrigatórios** foram respondidos (não podem estar como `nao_avaliado`) |
| RN-AUD-010 | Pontuação total = (soma pontuação obtida nos itens pontuáveis / soma pontuação máxima possível) * 100 |
| RN-AUD-011 | Reabertura: apenas auditorias finalizadas; AUDITOR só reabre as próprias; GESTOR/MASTER reabrem se o consultor está vinculado; limpa dados de finalização e resumo executivo |
| RN-AUD-012 | Remoção de auditoria: apenas MASTER e GESTOR; o gestor/master deve ser o consultor ou o consultor deve estar vinculado a ele; remove cascata (itens e fotos) |
| RN-AUD-013 | Resumo executivo: gerado por IA apenas para auditorias finalizadas; agrupado por grupo de itens com pontuação e não conformidades; salvo como JSON na auditoria |
| RN-AUD-014 | PDF: gerado via Puppeteer; cache — só regenera se auditoria foi atualizada após último `pdfGeradoEm`; armazenado no Supabase Storage |
| RN-AUD-015 | Execução (web): fotos e observação são registradas por botões e janelas separados. Cada janela só exige o que é dela (foto obrigatória na de fotos, observação obrigatória na de observação), conforme a resposta escolhida; foto marcada como não relevante sempre leva à observação. Sem resposta, cada janela salva se tiver o próprio registro (foto ou observação) |

### Fotos

| ID | Regra |
|----|-------|
| RN-FOT-001 | Fotos só podem ser adicionadas em auditorias não finalizadas |
| RN-FOT-002 | Upload: imagem obrigatória, validação de MIME type (`image/*`), compressão via sharp, extração de EXIF |
| RN-FOT-003 | Análise por IA: campo `analiseIa` e flag `processadoPorIa` por foto |
| RN-FOT-004 | No mobile: múltiplas seleções, upload e processamento IA em sequência (não paralelo), grid 2 colunas |
| RN-FOT-005 | Item com `permiteFoto = false` (inclui texto) não oferece anexar foto no web. Enquanto o app mobile não for atualizado, a API aceita a foto mesmo assim e registra log de aviso, para não perder fotos de apps antigos |

---

## 7. Relatório Técnico

| ID | Regra |
|----|-------|
| RN-REL-001 | Relatório técnico é por cliente (opcionalmente por unidade), sem pontuação de auditoria |
| RN-REL-002 | `consultoraId` = usuário que cria; mesma regra de isolamento da auditoria para acesso |
| RN-REL-003 | Para finalizar: `identificacao` sempre obrigatória; `descricaoOcorrenciaHtml`, `avaliacaoTecnicaHtml`, `recomendacoesConsultoraHtml` e `planoAcaoSugeridoHtml` obrigatórios **quando a seção estiver ativa no modelo** (RN-REL-009) |
| RN-REL-004 | Pelo menos uma `acaoExecutada` obrigatória antes de finalizar ou gerar apoio analítico, **quando a seção estiver ativa no modelo** |
| RN-REL-005 | Apoio analítico gerado por IA: somente leitura pelo usuário (preenchido pela IA) |
| RN-REL-006 | Fotos de evidência sem processamento por IA (diferente das fotos de auditoria) |
| RN-REL-007 | Vínculo cliente/unidade validado: unidade deve pertencer ao cliente informado |
| RN-REL-008 | PDF: mesma lógica de geração e armazenamento das auditorias |
| RN-REL-009 | Modelo por gestor (`modelos_relatorio_tecnico`, 1 por `gestorId`): seções configuráveis (descrição da ocorrência, evidências fotográficas, avaliação técnica, ações executadas, recomendações, plano de ação, apoio analítico) podem ser ligadas/desligadas e renomeadas (título ≤ 60 caracteres, sem `<`/`>`, vazio = padrão). Identificação e Assinaturas são fixas. Ao menos uma seção de texto deve ficar ativa. Ordem fixa. PDF, formulário (web/mobile), validação e apoio analítico seguem o modelo |
| RN-REL-010 | Resolução do modelo: AUDITOR usa o modelo do seu gestor (sem gestor → padrão); GESTOR e MASTER usam o próprio. O modelo de um relatório é resolvido pela consultora do relatório, não por quem visualiza. Só GESTOR e MASTER editam (`PUT /relatorios-tecnicos/modelo`) |
| RN-REL-011 | Recurso liberado por plano (`planos.permite_modelo_relatorio_tecnico`, configurado pelo MASTER); MASTER é isento. Gestor sem o recurso recebe 403 ao salvar; se perder o recurso, o modelo salvo é mantido mas deixa de ser aplicado (volta ao padrão) |
| RN-REL-012 | Snapshot (`relatorios_tecnicos.modelo_secoes`) gravado somente na transição para finalizado; reenvios de `status=finalizado` não o refazem. Finalizados seguem o snapshot (inclusive em edições posteriores no web); finalizados legados sem snapshot usam o padrão. Rascunhos seguem o modelo vigente |
| RN-REL-013 | Finalização offline (mobile) recusada pela API por modelo desatualizado (409) volta o relatório a rascunho no app, atualiza o modelo em cache e exibe à consultora o que falta preencher |
| RN-REL-014 | Conteúdo do relatório (PDF) da auditoria: topo com checklist, cliente/unidade, auditor, código, início, fim, duração e link "Ver no mapa" (só com coordenadas); cartão de resultado com percentual, faixa, barra das faixas, até 3 avaliações anteriores e contadores; tabela por grupo (AP, PP, PR, NA, NC, NR) e linha Geral, todos vindos do mesmo cálculo da tela; cada resposta com o ícone da opção (ou o padrão do sentido) na cor do sentido, e "?" quando não respondida; última página com quadro de resumo e duas linhas de assinatura (auditor e responsável da unidade). O PDF guardado é refeito quando a auditoria, o checklist ou suas perguntas mudam depois da geração |

---

## 8. Check-in

| ID | Regra |
|----|-------|
| RN-CKI-001 | Apenas 1 check-in aberto por usuário; tentativa de abrir segundo retorna erro |
| RN-CKI-002 | Check-in exige unidade ativa pertencente ao cliente informado |
| RN-CKI-003 | Validação de acesso: MASTER livre; GESTOR se for gestor do cliente; AUDITOR se seu `gestorId` for o gestor do cliente |
| RN-CKI-004 | Checkout pelo próprio usuário (FAB); GESTOR/MASTER podem encerrar ou editar check-ins no isolamento do cliente (`gestorId`) |
| RN-CKI-005 | Alerta após 3 horas de check-in aberto; flag `alerta3hEmitidoEm` para não repetir; no web também via Notification API (toast se a permissão for negada) |
| RN-CKI-006 | Listagem administrativa (tela de check-ins): AUDITOR não tem acesso; GESTOR vê apenas check-ins de seus clientes |
| RN-CKI-007 | Check-in registra geolocalização de entrada e saída (latitude/longitude) |
| RN-CKI-008 | Filtros na listagem: por auditor, cliente, período (dataInicio/dataFim) |
| RN-CKI-009 | Check-in aberto há mais de 12h é encerrado automaticamente; `dataCheckout = dataCheckin + 12h`; lat/lng de checkout = lat/lng do check-in; comentário `Encerrado automaticamente após 12 horas.` |
| RN-CKI-010 | GESTOR/MASTER podem alterar `dataCheckin`, `dataCheckout` e `comentario` de check-ins do seu isolamento. `dataCheckout` não pode ser anterior a `dataCheckin`. Preencher checkout em registro aberto fecha o status. Não reabrir check-in já fechado |
| RN-CKI-011 | Relatório de horas (GESTOR/MASTER) agrupa por cliente ou usuário no período, com o mesmo isolamento da listagem. Totais = soma dos fechados + tempo decorrido dos abertos (em andamento) |

---

## 9. Planos e Assinaturas

### Planos

| ID | Regra |
|----|-------|
| RN-PLN-001 | Apenas MASTER pode criar, atualizar e remover (soft delete) planos |
| RN-PLN-002 | Plano define limites: `limiteUsuarios`, `limiteAuditorias`, `limiteClientes`, `limiteCreditos` |
| RN-PLN-003 | Planos ativos são listados publicamente (sem autenticação) para cadastro |
| RN-PLN-004 | Remoção de plano é soft delete (`ativo = false`) |

### Assinaturas

| ID | Regra |
|----|-------|
| RN-ASS-001 | Apenas GESTOR pode ter assinatura; tentativa de assinar para outro perfil retorna erro |
| RN-ASS-002 | Criar assinatura (por MASTER) cancela a assinatura ativa anterior do gestor |
| RN-ASS-003 | Assinatura pública (cadastro): criada automaticamente durante `cadastroPublico`; plano deve estar ativo |
| RN-ASS-004 | Status: `ativa`, `cancelada`, `expirada`; expiração verificada ao consultar (`dataFim < agora` marca como expirada) |
| RN-ASS-005 | Cancelamento de assinatura: apenas MASTER |
| RN-ASS-006 | Assinatura ativa é pré-requisito para validação de limites (auditorias, usuários, clientes, créditos) |

---

## 10. Validação de Limites

| ID | Regra |
|----|-------|
| RN-LIM-001 | `identificarGestorId`: MASTER retorna vazio (isento de limites); AUDITOR usa `gestorId`; GESTOR usa próprio `id` |
| RN-LIM-002 | Contagem de usuários: gestor + todos os auditores vinculados |
| RN-LIM-003 | Contagem de auditorias: soma todas as auditorias de todos os usuários na "árvore" do gestor |
| RN-LIM-004 | Contagem de clientes: todos os clientes onde `gestorId = id do gestor` |
| RN-LIM-005 | Validação bloqueante: se limite atingido, lança exceção impedindo a criação |
| RN-LIM-006 | Assinatura ativa com validação de data é pré-requisito; sem assinatura = bloqueado |

---

## 11. Créditos de IA

| ID | Regra |
|----|-------|
| RN-CRD-001 | MASTER é isento de validação de créditos |
| RN-CRD-002 | AUDITOR consome créditos do seu gestor |
| RN-CRD-003 | Validação de saldo: `creditosUsados >= limiteCreditos` do plano bloqueia novas chamadas de IA |
| RN-CRD-004 | Conversão: `creditosConsumidos = ceil((tokensInput + tokensOutput) / tokensPorCredito * 100) / 100` |
| RN-CRD-005 | Cada uso registra: gestor, usuário que consumiu, provedor, modelo, tokens, créditos, método e contexto |
| RN-CRD-006 | Configuração por provedor/modelo: `tokensPorCredito` define quantos tokens equivalem a 1 crédito |
| RN-CRD-007 | Qualquer funcionalidade que envolva IA deve passar pela auditoria de tokens (regra `auditoria-tokens.mdc`) |

---

## 12. Legislação e RAG

| ID | Regra |
|----|-------|
| RN-LEG-001 | Existe uma única base de legislações, global para o sistema (sem separação por gestor ou unidade); a IA usa a base inteira. O cadastro informa link oficial, título e informações (opcional); tipo, número, ano, órgão, ementa, data de publicação e situação (`vigente`, `vigente_com_alteracoes`, `revogada`; nulo = não identificada) são lidos pelo sistema e podem ser editados |
| RN-LEG-002 | Texto é quebrado em trechos (por artigo e, em anexos, por itens numerados) com embedding vetorial (pgvector) para busca semântica |
| RN-LEG-003 | Cada trecho possui referência ao artigo/item de origem |
| RN-LEG-004 | RAG alimenta a geração de templates e análise de auditorias via `IaService`; quando a pergunta tem legislações escolhidas, a busca começa nelas e completa com a base toda se vierem menos de 3 trechos |
| RN-LEG-005 | Gerenciam a base (menu Legislações; criar, editar, desativar/ativar, remover, reler, enviar PDF/texto, trechos) o MASTER e o GESTOR com a permissão "Pode gerenciar legislações" (`podeGerenciarLegislacoes`); AUDITOR nunca. A regra é imposta na API (403 "Você não tem permissão para gerenciar legislações.") |
| RN-LEG-006 | Só o MASTER concede ou retira a permissão, e só para usuários GESTOR (na criação ou por `PATCH /usuarios/:id/permissao-legislacoes`); a edição genérica de usuário ignora o campo. A API respeita a mudança na hora; o GESTOR vê o menu depois de entrar de novo no sistema |
| RN-LEG-007 | Qualquer usuário logado escolhe legislações da base nos seletores (checklist e não conformidade) por `GET /legislacoes/opcoes`, que devolve só as ativas |
| RN-LEG-008 | Cada pergunta do checklist e cada item de auditoria aceita várias legislações (até 10), apenas a norma, sem artigo; ids inexistentes são recusados. Duplicar grupo/item copia os vínculos |
| RN-LEG-009 | Ao gravar a lista de legislações de um item, o texto legado (`legislacaoReferencia` da pergunta e `referenciaLegal` da não conformidade) é regravado com os nomes curtos separados por "; " (ex.: "RDC 216/2004; Lei 8078/1990"); lista vazia apaga o texto. O app de celular continua usando esse texto, e o texto enviado sem lista de legislações segue aceito |
| RN-LEG-010 | Nome curto da legislação: `SIGLA número/ano` (RDC, Portaria, IN, Lei, Decreto); para tipo `outro` ou sem número usa o título |
| RN-LEG-011 | Não conformidade sem legislações próprias herda as da pergunta na exibição e nos relatórios (a herança não é gravada) |
| RN-LEG-012 | Na auditoria, a IA sugere legislações para a não conformidade (`legislacaoIds`, obtidos casando a norma citada com a base); a sugestão só é aplicada se o usuário não tiver escolhido manualmente |
| RN-LEG-013 | Relatórios (PDF, tela de relatório, plano de ação) mostram só o nome da norma em "Legislação: …", sem ementa ou lista: próprias do item, depois herdadas da pergunta, depois o texto `referenciaLegal` como último recurso |
| RN-LEG-014 | Leitura automática pelo link: aceita só páginas públicas (`http`/`https`); endereços internos, privados ou reservados são recusados (também nos redirecionamentos). Aceita HTML e PDF; texto útil com menos de 500 caracteres falha com orientação para o plano B |
| RN-LEG-015 | Plano B: anexar PDF (até 20 MB) ou colar o texto (de 500 a 2.000.000 de caracteres); disponível quando a leitura falha ou não foi iniciada e também com a legislação pronta (releitura por outra fonte). "Ler novamente"/"Tentar de novo" pelo link só aparecem quando a legislação tem link |
| RN-LEG-016 | A leitura roda em segundo plano (`statusLeitura`: `pendente`, `lendo`, `concluida`, `falhou`); o cadastro já nasce em `lendo`. Não é possível pedir nova leitura enquanto uma está em andamento. Ao reiniciar o servidor, legislação em `lendo` ou `pendente` sem mudança há mais de 10 minutos vira `falhou` e pode ser repetida |
| RN-LEG-017 | "Ler novamente" substitui os dados lidos e os trechos pelo conteúdo atual, preservando título e informações; quando a IA não identifica um campo na releitura, o valor anterior é mantido. Se a leitura falhar, trechos e dados anteriores ficam intactos |
| RN-LEG-018 | A leitura consome créditos de IA de quem a disparou (extração de dados e embeddings), conforme RN-CRD-001/002/007: MASTER isento; GESTOR paga da própria conta; sem saldo a leitura falha com "Sem créditos de IA para ler a legislação." |
| RN-LEG-019 | Não há legislação repetida por link: o link é normalizado (sem espaços, `#fragmento` ou barra final) e, se já existir, o cadastro é recusado (409) apontando a existente. Não há deduplicação por número/ano. Link com mais de 500 caracteres é recusado (400). Na edição o link é opcional (vazio tira o link) |
| RN-LEG-020 | Quando uma leitura conclui, perguntas e itens de auditoria sem vínculo cujo texto livre cita a norma (tipo + número + ano) ganham o vínculo; o texto livre não é alterado |
| RN-LEG-021 | Legislação ligada a perguntas ou não conformidades não pode ser removida (409); deve ser desativada. Desativada deixa de aparecer nos seletores, mas os vínculos existentes são mantidos e o item que já a tem continua podendo ser salvo com ela |

---

## 13. Sincronização Mobile (Offline-First)

### Princípios

| ID | Regra |
|----|-------|
| RN-SYN-001 | SQLite é a fonte de verdade para a UI no mobile; o app funciona offline |
| RN-SYN-002 | TanStack Query configurado com `networkMode: 'offlineFirst'` |
| RN-SYN-003 | Ordem de sync: **push antes de pull** para não sobrescrever dados locais pendentes |
| RN-SYN-004 | Sync só executa se houver conexão (`NetInfo`); mutex impede sync concorrente |

### Pull (servidor → local)

| ID | Regra |
|----|-------|
| RN-SYN-005 | Ordem de pull respeita FKs: clientes → templates → auditorias |
| RN-SYN-006 | Pull de auditorias: ignora auditoria se cliente, unidade ou template não existir localmente |
| RN-SYN-007 | Pull de auditorias não sobrescreve registros com `sync_status = 'pending'` (`ON CONFLICT ... WHERE sync_status != 'pending'`) |
| RN-SYN-008 | Pull de itens usa `INSERT OR IGNORE` (não sobrescreve item já existente) |
| RN-SYN-009 | Status da API é mapeado para vocabulário local: `finalizada` → `concluida` |

### Push (local → servidor)

| ID | Regra |
|----|-------|
| RN-SYN-010 | Push de auditoria: cria no servidor → mapeia itens remotos → envia itens → envia fotos (sequencial) → finaliza → marca como synced |
| RN-SYN-011 | Fila de push: tabela SQLite `sync_queue` com entity, operation, payload, retries |
| RN-SYN-012 | Em caso de erro no push, incrementa `retries` na fila |
| RN-SYN-013 | `enqueuePush` adiciona à fila quando offline; `pushPending` drena a fila quando online |
| RN-SYN-014 | Fotos são enviadas via `expo-file-system` multipart (fora do API client JSON) |

### Store (Zustand)

| ID | Regra |
|----|-------|
| RN-SYN-015 | Store `auditoria` é cache de UI em memória; escrita efetiva é no SQLite via repositórios |
| RN-SYN-016 | Ao iniciar auditoria no store, se status é `rascunho`, muda para `em_andamento` no SQLite |
| RN-SYN-017 | Finalização local calcula pontuação somando `pontuacao` de todos os itens |

---

## 14. E-mail

| ID | Regra |
|----|-------|
| RN-EML-001 | Em produção (Railway): usar provider HTTP (Resend, MailerSend, SendGrid via HTTPS/443); SMTP em portas clássicas dá timeout |
| RN-EML-002 | Em desenvolvimento: Ethereal via `nodemailer.createTestAccount()` |
| RN-EML-003 | Provider efetivo depende da variável `EMAIL_PROVIDER` |
| RN-EML-004 | Templates HTML de e-mail devem estar listados em `assets` no `nest-cli.json` para ir para `dist` no build |

---

## 15. PDF e Relatórios

| ID | Regra |
|----|-------|
| RN-PDF-001 | Geração via Puppeteer/Chromium no Docker; preparação de imagens com sharp |
| RN-PDF-002 | Cache: PDF só é regenerado se auditoria/relatório foi atualizado após `pdfGeradoEm` |
| RN-PDF-003 | Armazenamento no Supabase Storage (bucket configurável) |
| RN-PDF-004 | Preferir abrir/visualizar no navegador (nova aba); tratar bloqueio de pop-up com orientação |
| RN-PDF-005 | Durante geração, overlay de carregamento em tela cheia alinhado ao padrão visual dos modais |
| RN-PDF-006 | Variáveis opcionais: `CHEKAI_LOGO_URL`, `PDF_GERACAO_METRICAS` |

---

## 16. Planos de Ação

| ID | Regra |
|----|-------|
| RN-PAC-001 | Tarefa de plano de ação possui título, descrição, prazo, responsável (opcional), auditoria de origem (opcional) e status: `pendente`, `em_andamento`, `concluida`, `cancelada` |
| RN-PAC-002 | Tarefas são isoladas por `gestorId` do tenant; MASTER/GESTOR veem todas as do tenant |
| RN-PAC-003 | AUDITOR vê apenas tarefas que criou ou pelas quais é responsável |
| RN-PAC-004 | Responsável deve ser o próprio gestor ou auditor vinculado a ele; auditoria de origem deve pertencer ao tenant |
| RN-PAC-005 | Concluir uma tarefa registra `concluidaEm`; reabrir limpa o campo |
| RN-PAC-006 | Tarefa aberta com prazo anterior a hoje é considerada atrasada (resumo do dashboard: atrasadas, próximos 7 dias, futuras, concluídas) |
| RN-PAC-007 | Apenas MASTER/GESTOR removem tarefas |
| RN-PAC-008 | É possível gerar tarefas a partir dos itens `nao_conforme` de uma auditoria (prazo padrão de 15 dias, sem duplicar títulos já existentes na auditoria) |

---

## 17. Agenda de Auditorias

| ID | Regra |
|----|-------|
| RN-AGD-001 | Agendamento vincula unidade, checklist, data prevista, responsável (opcional) e recorrência: `nenhuma`, `semanal`, `quinzenal`, `mensal`; status: `agendada`, `realizada`, `cancelada` |
| RN-AGD-002 | Agendamentos são isolados por `gestorId`; unidade deve pertencer a cliente do gestor e checklist ao gestor |
| RN-AGD-003 | AUDITOR vê apenas agendamentos sob sua responsabilidade e pode apenas concluí-los; criar, editar, cancelar e remover são de MASTER/GESTOR |
| RN-AGD-004 | Agendamento com data anterior a hoje e status `agendada` é exibido como atrasado |
| RN-AGD-005 | Ao concluir um agendamento recorrente, o próximo é criado automaticamente (mensal respeita o último dia do mês) |

---

## Changelog

| Data | Alteração | Autor |
|------|-----------|-------|
| 2026-04-11 | Documento inicial compilado a partir do código-fonte da API, mobile e web | platform-orchestrator |
| 2026-10-16 | Adicionada seção 16 (Planos de Ação) | Claude |
| 2026-10-16 | Adicionadas seções 17 (Agenda) e RN-PAC-008 | Claude |
| 2026-10-25 | Seção 12 reescrita para a legislação automática (RN-LEG-001 a RN-LEG-021) | Claude |
| 2026-10-25 | RN-LEG-015/016/019/021 ajustadas ao comportamento final (releitura por PDF/texto com legislação pronta, cadastro já em leitura, limite do link, desativadas aceitas em itens já ligados) | Claude |
| 2026-10-25 | RN-AUD-015: fotos e observação separadas na execução do checklist (web) | Claude |
| 2026-10-26 | RN-CHK-019: não conformidade contada pelo sentido da resposta (padrão e personalizadas) | Claude |
| 2026-10-26 | RN-CHK-020: faixas de classificação configuráveis por checklist e resultado da auditoria | Claude |
| 2026-10-26 | RN-REL-014: conteúdo do relatório da auditoria (dados da avaliação, cartão de resultado, NA/NR, ícones das respostas e assinaturas) | Claude |
