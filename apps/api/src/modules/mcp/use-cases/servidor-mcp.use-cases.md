# Casos de Uso — Servidor MCP ChekAI

Fonte de verdade do domínio para o canal MCP. A tela web de consentimento referencia este arquivo em `apps/web/src/app/oauth/autorizar/use-cases/oauth-mcp.use-cases.md`. Mobile não participa.

Contrato: `docs/regras-de-negocio.md` (RN-AUTH-010, RN-MCP-001 a RN-MCP-011) e `docs/paridade-plataformas.md` (seção Canal MCP). Handlers da primeira onda delegam aos services existentes; este documento não redefine RN-CLI, RN-CHK, RN-AUD, RN-AGD, RN-PAC nem RN-REL.

### Regras de Negócio Aplicáveis

- RN-AUTH-001, RN-AUTH-002, RN-AUTH-003, RN-AUTH-004, RN-AUTH-007, RN-AUTH-009, RN-AUTH-010
- RN-MCP-001 a RN-MCP-011
- RN-ISO-001, RN-ISO-002, RN-ISO-003, RN-ISO-004
- RN-CLI-006
- RN-CHK-003
- RN-AUD-001, RN-AUD-002, RN-AUD-003, RN-AUD-004, RN-AUD-005, RN-AUD-006, RN-AUD-007, RN-AUD-009
- RN-AGD-002, RN-AGD-003, RN-AGD-005
- RN-PAC-002, RN-PAC-003, RN-PAC-004, RN-PAC-005
- RN-REL-001, RN-REL-002, RN-REL-003, RN-REL-004, RN-REL-007
- RN-LIM-005, RN-LIM-006, RN-ASS-006 (limites já aplicados pelos services na criação)

---

### UC-01: Descobrir o servidor e autorizar o cliente MCP

**Rastreabilidade**: RN-AUTH-001, RN-AUTH-003, RN-AUTH-004, RN-AUTH-007, RN-AUTH-009, RN-AUTH-010, RN-MCP-001, RN-MCP-002, RN-MCP-005, RN-MCP-011
**Plataformas**: Canal MCP + Web (consentimento). Mobile não participa.

- **Ator**: MASTER, GESTOR ou AUDITOR com conta ativa, operando um cliente MCP
- **Pré-condição**: Usuário com status ativo (RN-AUTH-007). `FRONTEND_URL` configurada (RN-AUTH-009). Em produção, issuer, URL pública, TTLs e chave OAuth distinta do JWT web presentes (RN-MCP-011). Cliente informa `redirect_uri` exata, `code_challenge` S256, `resource` igual ao endpoint MCP e apenas scopes operacionais (RN-MCP-005).
- **Fluxo Principal**:
  1. O cliente chama o endpoint MCP sem access token.
  2. O servidor responde 401 com `WWW-Authenticate` e `resource_metadata` (RN-MCP-001).
  3. O cliente lê `/.well-known/oauth-authorization-server`, fora do prefixo `/api`.
  4. O cliente abre `/oauth/authorize` com PKCE, `resource`, `state` e os scopes pedidos. O web exibe e-mail, OTP e consentimento, preservando `state`, PKCE e `redirect_uri`.
  5. O usuário informa o e-mail e recebe OTP de 6 dígitos com validade de 10 minutos (RN-AUTH-001).
  6. OTP válido e conta ativa levam à tela de consentimento, que lista somente os scopes operacionais solicitados (RN-MCP-005).
  7. O consentimento emite authorization code de uso único, ligado ao desafio PKCE, à `redirect_uri`, ao `resource` e ao cliente. Só o hash é persistido (RN-MCP-002).
  8. O cliente troca o code em `/oauth/token` com o `code_verifier`.
  9. O servidor devolve access token de 1 hora e refresh token rotativo. O access token traz `iss`, `sub`, `aud` do MCP, `resource`, `scope`, `perfil` e `jti`. Perfil e vínculos vêm do banco (RN-AUTH-010).
- **Fluxos Alternativos**:
  - FA-01: `redirect_uri` diferente da cadastrada, PKCE ausente ou `code_verifier` inválido → autorização ou troca recusada, sem token (RN-MCP-002).
  - FA-02: `resource` ou audience diferente do endpoint MCP → recusa (RN-MCP-001, RN-MCP-002).
  - FA-03: Conta `nao_confirmado` ou `inativo` solicita OTP → recusa, com a orientação já definida para o OTP (RN-AUTH-003, RN-AUTH-004).
  - FA-04: OTP inválido ou expirado → sem code.
  - FA-05: Scope desconhecido ou não operacional no pedido → autorização recusada; o scope não é concedido por omissão (RN-MCP-005).
  - FA-06: Reuso do authorization code → recusa (RN-MCP-002).
  - FA-07: JWT de sessão web/mobile apresentado ao MCP, ou access token OAuth apresentado ao web/mobile → 401 (RN-AUTH-010).
  - FA-08: Em desenvolvimento, o OTP mock `252622` é aceito (RN-AUTH-002). Fora de desenvolvimento, não.
- **Pós-condição**: Cliente possui access token e refresh token da concessão. Nenhum segredo em claro fica no banco além do necessário para verificar hashes.
- **Diferenças por Plataforma**:
  - Web: apenas a tela `/oauth/autorizar` (e-mail → OTP → consentimento).
  - Mobile: sem fluxo. O app não autoriza nem consome o canal.
  - MCP: discovery, token e chamadas seguintes são online (RN-MCP-009).

### UC-02: Renovar e revogar a concessão OAuth

**Rastreabilidade**: RN-AUTH-007, RN-AUTH-010, RN-MCP-003
**Plataformas**: Canal MCP. Mobile não participa.

- **Ator**: Cliente MCP com refresh token de uma concessão emitida em UC-01
- **Pré-condição**: Família de refresh ainda não revogada. Conta do `sub` continua ativa.
- **Fluxo Principal**:
  1. Com access token expirado ou próximo do vencimento, o cliente chama `/oauth/token` com `grant_type=refresh_token` e o refresh atual.
  2. O servidor relê perfil e status no banco (RN-MCP-003).
  3. Emite access token novo (1 hora) e refresh token novo. O refresh apresentado deixa de valer.
  4. Na revogação explícita (`/oauth/revoke`), a família é invalidada: refresh pendentes e access tokens da concessão deixam de autorizar `tools/list` e `tools/call`.
- **Fluxos Alternativos**:
  - FA-01: Refresh já rotacionado é reapresentado → a família inteira é revogada e a resposta não traz token novo (RN-MCP-003).
  - FA-02: Access expirado, sem refresh válido, usado no MCP → 401 com `resource_metadata` (RN-MCP-001, RN-MCP-003).
  - FA-03: Concessão já revogada → 401. Não há reativação do mesmo refresh.
  - FA-04: Conta passou a `inativo` ou deixou de estar ativa entre a emissão e o refresh → refresh recusado (RN-AUTH-007, RN-MCP-003).
  - FA-05: Perfil alterado no banco → o access token seguinte carrega o perfil relido, não o claim antigo (RN-AUTH-010).
- **Pós-condição**: Ou a família tem um único refresh vigente, ou está revogada por completo. Não existem dois refresh válidos da mesma geração.
- **Diferenças por Plataforma**:
  - Web e mobile: logout e JWT de sessão não revogam nem renovam esta família.
  - MCP: após revogação, o cliente precisa repetir UC-01.

### UC-03: Listar o catálogo de tools por perfil e scope

**Rastreabilidade**: RN-MCP-004, RN-MCP-005, RN-MCP-008, RN-MCP-010, RN-AGD-003
**Plataformas**: Canal MCP

- **Ator**: MASTER, GESTOR ou AUDITOR com access token OAuth vigente
- **Pré-condição**: Token com audience do MCP, conta ativa e perfil relido do banco (RN-AUTH-010).
- **Fluxo Principal**:
  1. O cliente chama `tools/list`.
  2. O servidor cruza a allowlist da primeira onda (RN-MCP-010) com o perfil e com os scopes do token (RN-MCP-005).
  3. A resposta contém só tools dessa interseção. Com todos os scopes operacionais, MASTER, GESTOR e AUDITOR recebem o mesmo conjunto de nomes: `chekai_me`; `chekai_listar_clientes`, `chekai_obter_cliente`, `chekai_listar_unidades`; `chekai_listar_checklists`, `chekai_obter_checklist`; `chekai_listar_auditorias`, `chekai_obter_auditoria`, `chekai_iniciar_auditoria`, `chekai_responder_item`, `chekai_preparar_finalizacao`, `chekai_finalizar_auditoria`; `chekai_listar_agenda`, `chekai_concluir_agendamento`; `chekai_listar_tarefas`, `chekai_criar_tarefa`, `chekai_atualizar_tarefa`, `chekai_concluir_tarefa`, `chekai_reabrir_tarefa`; `chekai_listar_relatorios`, `chekai_obter_relatorio`, `chekai_iniciar_relatorio`, `chekai_atualizar_relatorio`, `chekai_preparar_finalizacao_relatorio`, `chekai_finalizar_relatorio`.
  4. Nenhuma tool administrativa entra na lista (RN-MCP-008). Criar, editar, cancelar ou remover agendamento não entra (RN-AGD-003, RN-MCP-010).
- **Fluxos Alternativos**:
  - FA-01: Token só com `chekai:clientes:ler` → a lista traz apenas `chekai_listar_clientes`, `chekai_obter_cliente` e `chekai_listar_unidades`.
  - FA-02: `tools/call` de tool fora da allowlist, ou fora do perfil/scope, mesmo que o cliente a invente → sem execução de handler (RN-MCP-004, RN-MCP-005). Scope insuficiente → `insufficient_scope`.
  - FA-03: Chamada a tool de equipe, planos, assinatura, créditos, legislação, RAG, cadastro público, login legado ou IA genérica → ausente e não executável para os três perfis (RN-MCP-008).
  - FA-04: Sem token, token expirado ou concessão revogada → 401 (UC-02).
- **Pós-condição**: O catálogo visto pelo modelo é subconjunto da allowlist. O recorte de dados de cada tool continua a cargo dos services na execução.
- **Diferenças por Plataforma**:
  - Web e mobile: não expõem `tools/list`.
  - MCP: o catálogo é recalculado a cada listagem; não há cache offline do catálogo (RN-MCP-009).

### UC-04: Ler o próprio contexto, clientes, unidades e checklists

**Rastreabilidade**: RN-MCP-005, RN-MCP-006, RN-MCP-010, RN-ISO-001, RN-ISO-002, RN-CLI-006, RN-CHK-003
**Plataformas**: Canal MCP

- **Ator**: MASTER, GESTOR ou AUDITOR com os scopes `chekai:contexto`, `chekai:clientes:ler` e `chekai:checklists:ler`
- **Pré-condição**: Tools presentes no catálogo de UC-03. Input sem `gestorId`, `tenantId` e `consultorId`.
- **Fluxo Principal**:
  1. `chekai_me` devolve identificação estável do usuário autenticado (id, nome, e-mail, perfil), sem segredo e sem dados de outro usuário.
  2. `chekai_listar_clientes` e `chekai_obter_cliente` chamam o service de clientes com esse usuário. GESTOR e MASTER recebem clientes do próprio domínio. AUDITOR recebe só clientes aos quais está vinculado (RN-ISO-001, RN-CLI-006).
  3. `chekai_listar_unidades` aplica o mesmo recorte de acesso.
  4. `chekai_listar_checklists` e `chekai_obter_checklist` chamam o service de templates. AUDITOR recebe apenas templates ativos do seu gestor (RN-ISO-002, RN-CHK-003).
  5. A resposta é resumo paginado, com IDs estáveis, sem entidade crua (RN-MCP-006).
- **Fluxos Alternativos**:
  - FA-01: Input contém `gestorId`, `tenantId` ou `consultorId` → rejeição antes do service (RN-MCP-006).
  - FA-02: Scope de leitura ausente → `insufficient_scope` e o service não é chamado (RN-MCP-005).
  - FA-03: AUDITOR pede cliente ou unidade sem vínculo, ou checklist que não esteja ativo para o seu gestor → erro de negócio seguro, sem corpo do recurso alheio (RN-CLI-006, RN-CHK-003). O caso cross-tenant detalhado está em UC-09.
- **Pós-condição**: Nenhuma escrita em cliente, unidade ou checklist. O modelo não escolhe o tenant.
- **Diferenças por Plataforma**:
  - Web: CRUD administrativo segue os contratos atuais; esta UC não os altera.
  - Mobile: a listagem continua vindo do SQLite. O MCP não grava no aparelho (RN-MCP-009).

### UC-05: Executar auditorias da primeira onda

**Rastreabilidade**: RN-MCP-005, RN-MCP-006, RN-MCP-007, RN-MCP-010, RN-ISO-003, RN-AUD-001, RN-AUD-002, RN-AUD-003, RN-AUD-004, RN-AUD-005, RN-AUD-006, RN-AUD-007, RN-AUD-009, RN-LIM-005, RN-LIM-006, RN-ASS-006
**Plataformas**: Canal MCP

- **Ator**: MASTER, GESTOR ou AUDITOR. Leitura exige `chekai:auditorias:ler`. Iniciar e responder exigem `chekai:auditorias:escrever`. Preparar e finalizar exigem `chekai:auditorias:finalizar`.
- **Pré-condição**: Catálogo autoriza as tools. Unidade, cliente e template existem no domínio do usuário. AUDITOR tem vínculo com o cliente da unidade para iniciar (RN-AUD-002).
- **Fluxo Principal**:
  1. `chekai_listar_auditorias` e `chekai_obter_auditoria` usam o service com o usuário autenticado. AUDITOR vê as próprias; GESTOR e MASTER veem as próprias e as de auditores vinculados (RN-ISO-003).
  2. `chekai_iniciar_auditoria` cria a auditoria no service. Os três perfis podem iniciar (RN-AUD-001). Itens ativos nascem como `nao_avaliado` (RN-AUD-004). Limite de plano e assinatura ativa são os do service (RN-AUD-003, RN-LIM-005, RN-LIM-006, RN-ASS-006); MASTER segue isento como já é no service.
  3. `chekai_responder_item` grava a resposta validada pelo service (RN-AUD-006, RN-AUD-007). Auditoria finalizada não aceita edição (RN-AUD-005).
  4. `chekai_preparar_finalizacao` não finaliza. Devolve o resumo do que falta e um token de confirmação de uso único, validade máxima de 10 minutos, amarrado ao usuário, à auditoria e à ação de finalizar (RN-MCP-007).
  5. `chekai_finalizar_auditoria` só conclui com esse token. O service exige os itens obrigatórios respondidos (RN-AUD-009) e calcula a pontuação como já faz hoje.
- **Fluxos Alternativos**:
  - FA-01: Finalizar sem preparação, com token expirado, reutilizado, de outro usuário, de outra auditoria ou de outra ação → sem finalização (RN-MCP-007).
  - FA-02: AUDITOR inicia em cliente sem vínculo → erro do service, sem auditoria criada (RN-AUD-002).
  - FA-03: Limite de auditorias ou assinatura ausente → erro do service, sem auditoria criada (RN-AUD-003, RN-ASS-006).
  - FA-04: Resposta inválida para o tipo do item, ou item de auditoria finalizada → erro do service, estado anterior preservado (RN-AUD-005, RN-AUD-006, RN-AUD-007).
  - FA-05: Itens obrigatórios ainda `nao_avaliado` na execução → o service recusa a finalização mesmo com token válido (RN-AUD-009). O token é consumido nessa tentativa; a auditoria permanece aberta e uma nova preparação é necessária.
  - FA-06: `chekai_reabrir_auditoria`, remoção, foto, PDF ou resumo por IA → tool inexistente nesta onda (RN-MCP-004, RN-MCP-010).
- **Pós-condição**: Auditoria finalizada só existe depois do par preparar + executar com token válido e das validações do service. Não há fila local.
- **Diferenças por Plataforma**:
  - Web e mobile: finalizam pelos endpoints atuais, sem token MCP.
  - Mobile: pode iniciar offline no SQLite. O MCP não cria registro local nem entra na `sync_queue` (RN-MCP-009).

### UC-06: Executar a agenda da primeira onda

**Rastreabilidade**: RN-MCP-004, RN-MCP-005, RN-MCP-006, RN-MCP-010, RN-AGD-002, RN-AGD-003, RN-AGD-005
**Plataformas**: Canal MCP

- **Ator**: MASTER, GESTOR ou AUDITOR. Listar exige `chekai:agenda:ler`. Concluir exige `chekai:agenda:concluir`.
- **Pré-condição**: Agendamento pertence ao domínio do usuário (RN-AGD-002). Para o AUDITOR, ele é o responsável (RN-AGD-003).
- **Fluxo Principal**:
  1. `chekai_listar_agenda` chama o service de agenda com o usuário autenticado. AUDITOR vê só os agendamentos sob sua responsabilidade. GESTOR e MASTER veem os do próprio `gestorId`.
  2. `chekai_concluir_agendamento` marca o agendamento como realizado pelo service. Se houver recorrência, o próximo nasce pela regra já existente (RN-AGD-005).
- **Fluxos Alternativos**:
  - FA-01: Pedido de criar, editar, cancelar ou remover agendamento → tool ausente da allowlist para todos os perfis; handler não roda (RN-AGD-003, RN-MCP-004, RN-MCP-010).
  - FA-02: AUDITOR conclui agendamento de outro responsável, ou qualquer perfil conclui agendamento de outro gestor → erro seguro do service, sem alteração (RN-AGD-002, RN-AGD-003).
  - FA-03: Input com `gestorId`, `tenantId` ou `consultorId` → rejeição antes do service (RN-MCP-006).
- **Pós-condição**: Somente conclusão (e a ocorrência seguinte, se recorrente) pode mudar a agenda pelo MCP.
- **Diferenças por Plataforma**:
  - Web: criar, editar, cancelar e remover continuam nos contratos atuais, para MASTER e GESTOR.
  - Mobile: sem equivalente obrigatório nesta UC. O MCP não sincroniza agenda offline.

### UC-07: Executar tarefas do plano de ação

**Rastreabilidade**: RN-MCP-005, RN-MCP-006, RN-MCP-010, RN-PAC-002, RN-PAC-003, RN-PAC-004, RN-PAC-005
**Plataformas**: Canal MCP

- **Ator**: MASTER, GESTOR ou AUDITOR. Listar exige `chekai:tarefas:ler`. Criar, atualizar, concluir e reabrir exigem `chekai:tarefas:escrever`.
- **Pré-condição**: Responsável, quando informado, é o gestor do tenant ou auditor vinculado. Auditoria de origem, quando informada, pertence ao tenant (RN-PAC-004).
- **Fluxo Principal**:
  1. `chekai_listar_tarefas` usa o isolamento do `PlanoAcaoService`: GESTOR e MASTER veem as tarefas do próprio tenant; AUDITOR vê as que criou ou das quais é responsável (RN-PAC-002, RN-PAC-003).
  2. `chekai_criar_tarefa` e `chekai_atualizar_tarefa` delegam ao service. O `gestorId` da tarefa é o do usuário autenticado, nunca um id vindo do modelo (RN-MCP-006).
  3. `chekai_concluir_tarefa` grava `concluidaEm`. `chekai_reabrir_tarefa` limpa o campo (RN-PAC-005).
- **Fluxos Alternativos**:
  - FA-01: Responsável de outro gestor, ou auditoria de outro tenant → erro do service, sem gravação (RN-PAC-004).
  - FA-02: AUDITOR lista ou altera tarefa que não criou e da qual não é responsável → erro seguro, sem corpo da tarefa (RN-PAC-003).
  - FA-03: Remoção de tarefa ou geração a partir de não conformidades → tool ausente nesta onda (RN-MCP-010).
  - FA-04: Campos `gestorId`, `tenantId` ou `consultorId` no input → rejeição antes do service (RN-MCP-006).
- **Pós-condição**: Tarefa permanece no tenant do usuário autenticado. Status e `concluidaEm` só mudam pelas tools de concluir e reabrir.
- **Diferenças por Plataforma**:
  - Web: remoção por MASTER/GESTOR continua no contrato HTTP atual e não ganha tool MCP.
  - Mobile: sem fila offline para estas tarefas (RN-MCP-009).

### UC-08: Executar relatórios técnicos da primeira onda

**Rastreabilidade**: RN-MCP-005, RN-MCP-006, RN-MCP-007, RN-MCP-010, RN-ISO-004, RN-REL-001, RN-REL-002, RN-REL-003, RN-REL-004, RN-REL-007
**Plataformas**: Canal MCP

- **Ator**: MASTER, GESTOR ou AUDITOR. Leitura exige `chekai:relatorios:ler`. Iniciar e atualizar exigem `chekai:relatorios:escrever`. Preparar e finalizar exigem `chekai:relatorios:finalizar`.
- **Pré-condição**: Cliente no domínio do usuário. Unidade, se informada, pertence a esse cliente (RN-REL-007). Isolamento igual ao da auditoria, por `consultoraId` (RN-ISO-004, RN-REL-002).
- **Fluxo Principal**:
  1. `chekai_listar_relatorios` e `chekai_obter_relatorio` chamam o service com o usuário autenticado.
  2. `chekai_iniciar_relatorio` abre relatório do cliente (e da unidade, se houver), sem pontuação de auditoria (RN-REL-001). `consultoraId` é o usuário autenticado.
  3. `chekai_atualizar_relatorio` grava os campos permitidos pelo service.
  4. `chekai_preparar_finalizacao_relatorio` não finaliza. Devolve o resumo (campos HTML ainda vazios e ações executadas) e um token de confirmação de uso único, validade máxima de 10 minutos, amarrado ao usuário, ao relatório e à ação (RN-MCP-007).
  5. `chekai_finalizar_relatorio` só conclui com esse token e se o service aceitar: campos HTML obrigatórios preenchidos e ao menos uma ação executada (RN-REL-003, RN-REL-004).
- **Fluxos Alternativos**:
  - FA-01: Finalizar sem token válido para aquele usuário, relatório e ação → sem finalização (RN-MCP-007).
  - FA-02: HTML obrigatório ausente ou nenhuma ação executada → o service recusa, mesmo com token (RN-REL-003, RN-REL-004). O token é consumido nessa tentativa; o relatório permanece aberto e uma nova preparação é necessária.
  - FA-03: Unidade que não pertence ao cliente → erro do service, sem relatório inconsistente (RN-REL-007).
  - FA-04: Foto, PDF ou apoio analítico → tools ausentes nesta onda (RN-MCP-008 para IA genérica; RN-MCP-010 para a onda).
  - FA-05: Identificadores de tenant no input → rejeição antes do service (RN-MCP-006).
- **Pós-condição**: Relatório finalizado só após confirmação em duas etapas e validação do service. Apoio analítico não é preenchido por este canal.
- **Diferenças por Plataforma**:
  - Web: o wizard atual permanece. Esta UC não muda o contrato HTTP.
  - Mobile: módulo sem UI de relatório; o MCP não cria rascunho no SQLite.

### UC-09: Recusar tentativa cross-tenant

**Rastreabilidade**: RN-MCP-004, RN-MCP-005, RN-MCP-006, RN-MCP-008, RN-ISO-001, RN-ISO-002, RN-ISO-003, RN-ISO-004, RN-CLI-006, RN-CHK-003, RN-AGD-002, RN-PAC-002, RN-PAC-003, RN-REL-002
**Plataformas**: Canal MCP

- **Ator**: MASTER, GESTOR ou AUDITOR autenticado no MCP, tentando alcançar recurso de outro domínio
- **Pré-condição**: Existem dois gestores, cada um com o próprio domínio, e ao menos um auditor vinculado a cada gestor. Cada um concluiu UC-01 no próprio usuário.
- **Fluxo Principal**:
  1. O cliente do gestor A envia `gestorId`, `tenantId` ou `consultorId` do gestor B em qualquer tool da primeira onda.
  2. O registry rejeita o input antes de chamar o service (RN-MCP-006). Nenhum registro do gestor B é lido para a resposta.
  3. O cliente repete a chamada só com o id de recurso do gestor B (cliente, unidade, checklist, auditoria, agendamento, tarefa ou relatório), sem campos de tenant.
  4. O service aplica o isolamento do usuário A. A resposta MCP é erro de negócio seguro: sem entidade, sem segredo, sem token e sem URL do recurso de B (RN-MCP-006).
  5. O auditor de A repete o passo 4 contra recurso do gestor B e contra recurso do próprio gestor ao qual não está vinculado. O resultado é o mesmo: sem corpo do recurso.
- **Fluxos Alternativos**:
  - FA-01: Access token do gestor A é reenviado com `sub` ou `perfil` trocados no cliente → a validação usa a assinatura e o usuário relido do banco; o cliente não assume outro `sub` (RN-AUTH-010, RN-MCP-005).
  - FA-02: Tool administrativa ou de outro tenant por nome fora da allowlist → sem handler (RN-MCP-004, RN-MCP-008).
  - FA-03: Listagens (`chekai_listar_*`) do gestor A não incluem linhas do gestor B, mesmo com filtro textual igual ao nome do recurso de B (RN-ISO-001 a RN-ISO-004).
- **Pós-condição**: Dados do gestor B permanecem invisíveis e inalterados para a sessão de A. O mesmo vale no sentido inverso.
- **Diferenças por Plataforma**:
  - Web e mobile: o isolamento HTTP atual não é afrouxado nem duplicado com regra nova no adaptador.
  - MCP: não existe modo offline que guarde uma cópia do outro tenant.

---

## Matriz de Rastreabilidade

| Regra | Caso de Uso | Plataforma | Teste Esperado |
|-------|-------------|------------|----------------|
| RN-AUTH-010 | UC-01 | MCP + Web | describe('UC-01: autorizar cliente MCP com OTP e PKCE') |
| RN-MCP-001 | UC-01 | MCP | it('deve responder 401 com resource_metadata e publicar o metadata OAuth fora de /api') |
| RN-MCP-002 | UC-01, UC-01 FA-01, FA-02, FA-06 | MCP | it('deve recusar redirect, PKCE, resource ou reuso de code') |
| RN-AUTH-001 | UC-01 | MCP + Web | it('deve emitir OTP de 6 dígitos com validade de 10 minutos') |
| RN-AUTH-003 | UC-01 FA-03 | MCP + Web | it('deve recusar OTP de conta nao_confirmado') |
| RN-AUTH-004 | UC-01 FA-03 | MCP + Web | it('deve recusar OTP de conta inativo') |
| RN-AUTH-007 | UC-01 FA-03, UC-02 FA-04 | MCP | it('deve recusar conta que não está ativa') |
| RN-AUTH-009 | UC-01 | Web | it('deve falhar de forma explícita sem FRONTEND_URL') |
| RN-AUTH-002 | UC-01 FA-08 | MCP + Web | it('deve aceitar o OTP mock só fora de produção') |
| RN-MCP-005 | UC-01 FA-05, UC-03, UC-03 FA-01 | MCP + Web | it('deve conceder só scopes operacionais e filtrar tools/list') |
| RN-MCP-011 | UC-01 | API | it('deve recusar subir em produção sem URL, issuer, TTLs e chave OAuth própria') |
| RN-MCP-003 | UC-02, UC-02 FA-01, FA-02, FA-03 | MCP | it('deve rotacionar o refresh e revogar a família no reuso') |
| RN-AUTH-010 | UC-02 FA-05, UC-01 FA-07 | MCP | it('deve reler o perfil e rejeitar o JWT web no MCP') |
| RN-MCP-004 | UC-03 FA-02, UC-05 FA-06, UC-06 FA-01, UC-09 FA-02 | MCP | it('não deve executar tool fora da allowlist') |
| RN-MCP-008 | UC-03 FA-03, UC-08 FA-04, UC-09 FA-02 | MCP | it('não deve listar nem executar capacidade administrativa') |
| RN-MCP-010 | UC-03, UC-04, UC-05, UC-06, UC-07, UC-08 | MCP | it('deve expor somente as tools da primeira onda') |
| RN-AGD-003 | UC-03, UC-06, UC-06 FA-01, FA-02 | MCP | it('não deve oferecer criar, editar, cancelar ou remover agendamento') |
| RN-MCP-006 | UC-04 FA-01, UC-06 FA-03, UC-07 FA-04, UC-08 FA-05, UC-09 | MCP | it('deve rejeitar gestorId, tenantId e consultorId vindos do modelo') |
| RN-ISO-001 | UC-04, UC-09 | MCP | it('deve listar clientes só do domínio do usuário autenticado') |
| RN-CLI-006 | UC-04, UC-04 FA-03, UC-09 | MCP | it('deve limitar o auditor aos clientes vinculados') |
| RN-ISO-002 | UC-04, UC-09 | MCP | it('deve limitar templates do auditor aos ativos do gestor') |
| RN-CHK-003 | UC-04, UC-04 FA-03 | MCP | it('deve omitir checklist inativo ou de outro gestor para o auditor') |
| RN-ISO-003 | UC-05, UC-09 | MCP | it('deve isolar auditorias por consultor e vínculos do gestor') |
| RN-AUD-001 | UC-05 | MCP | it('deve permitir iniciar auditoria para MASTER, GESTOR e AUDITOR') |
| RN-AUD-002 | UC-05 FA-02 | MCP | it('deve rejeitar auditor sem vínculo com o cliente') |
| RN-AUD-003 | UC-05 FA-03 | MCP | it('deve rejeitar início quando o limite do plano estoura') |
| RN-LIM-005 | UC-05 FA-03 | MCP | it('deve propagar o bloqueio de limite do service') |
| RN-LIM-006 | UC-05 FA-03 | MCP | it('deve propagar a exigência de assinatura vigente') |
| RN-ASS-006 | UC-05 FA-03 | MCP | it('deve bloquear criação sem assinatura ativa, como o service já faz') |
| RN-AUD-004 | UC-05 | MCP | it('deve copiar itens ativos como nao_avaliado') |
| RN-AUD-005 | UC-05 FA-04 | MCP | it('deve recusar resposta em auditoria finalizada') |
| RN-AUD-006 | UC-05, UC-05 FA-04 | MCP | it('deve validar a resposta contra as opções do template') |
| RN-AUD-007 | UC-05 FA-04 | MCP | it('deve validar número, data, select e texto') |
| RN-AUD-009 | UC-05, UC-05 FA-05 | MCP | it('deve recusar finalização com obrigatório nao_avaliado') |
| RN-MCP-007 | UC-05, UC-05 FA-01, UC-08, UC-08 FA-01 | MCP | it('deve exigir token de confirmação de uso único para finalizar') |
| RN-MCP-009 | UC-01, UC-04, UC-05 | MCP | it('não deve gravar SQLite nem fila offline') |
| RN-AGD-002 | UC-06, UC-06 FA-02, UC-09 | MCP | it('deve manter agendamento no gestor dono da unidade e do checklist') |
| RN-AGD-005 | UC-06 | MCP | it('deve gerar a próxima ocorrência ao concluir recorrência') |
| RN-PAC-002 | UC-07, UC-09 | MCP | it('deve isolar tarefas pelo gestor do tenant autenticado') |
| RN-PAC-003 | UC-07, UC-07 FA-02 | MCP | it('deve limitar o auditor às tarefas que criou ou das quais é responsável') |
| RN-PAC-004 | UC-07 FA-01 | MCP | it('deve rejeitar responsável ou auditoria de outro tenant') |
| RN-PAC-005 | UC-07 | MCP | it('deve gravar e limpar concluidaEm ao concluir e reabrir') |
| RN-ISO-004 | UC-08, UC-09 | MCP | it('deve isolar relatório técnico como a auditoria') |
| RN-REL-001 | UC-08 | MCP | it('deve abrir relatório por cliente, sem pontuação de auditoria') |
| RN-REL-002 | UC-08, UC-09 | MCP | it('deve gravar consultoraId como o usuário autenticado') |
| RN-REL-003 | UC-08 FA-02 | MCP | it('deve exigir os HTML obrigatórios para finalizar') |
| RN-REL-004 | UC-08 FA-02 | MCP | it('deve exigir ao menos uma ação executada para finalizar') |
| RN-REL-007 | UC-08 FA-03 | MCP | it('deve exigir unidade pertencente ao cliente informado') |

---

## Gaps

- Ondas posteriores (CRUD de clientes, unidades e checklists; fotos e PDF; check-in com coordenada explícita; IA de domínio) não têm RN de capacidade. RN-MCP-010 as deixa fora até regra nova. Check-in, exclusão e IA já herdam a confirmação em duas etapas (RN-MCP-007) quando essa regra existir. Não bloqueia a primeira onda.
- `docs/de-para-web-mobile.md` não muda: o canal não altera endpoints, parâmetros nem relations de web e mobile.
