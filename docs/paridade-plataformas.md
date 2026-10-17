# Paridade de Plataformas — ChekAI

> Matriz de features por plataforma. Mantida pelo agente `platform-orchestrator`.
> Status: `ok` = implementado, `parcial` = incompleto, `n/a` = não aplicável, `-` = não implementado.

## Legenda

- **API**: endpoint disponível no backend NestJS
- **Web**: funcionalidade disponível no frontend Next.js
- **Mobile**: funcionalidade disponível no app Expo (offline-first)
- **MCP**: canal online de tools para clientes de IA. Não usa SQLite nem fila offline e não altera os contratos HTTP de web e mobile. Nesta matriz, `-` no MCP significa ainda sem implementação; o contrato da primeira onda está na seção Canal MCP

---

## Autenticação

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| Login via OTP | ok | ok | ok | |
| Login legado (senha) | ok | ok | - | Deprecated; mobile usa apenas OTP |
| Cadastro público (gestor) | ok | ok | n/a | Só gestores se cadastram pelo site |
| Convite de auditor | ok | ok | n/a | Gestor convida pelo web; auditor aceita pelo link |
| Aceite de convite | ok | ok | - | Link direciona para web |
| Logout | n/a | ok | ok | |
| OAuth do canal MCP (OTP + PKCE) | - | - | n/a | Consentimento no web (`/oauth/autorizar`). Mobile não autentica nem opera o canal. Contrato: RN-AUTH-010, RN-MCP-001 a RN-MCP-003 |

## Usuários

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| Listagem de usuários | ok | ok | n/a | Gestão administrativa |
| Criar usuário/auditor | ok | ok | n/a | |
| Editar perfil próprio | ok | ok | parcial | Mobile tem tela de perfil básica |
| Remover usuário | ok | ok | n/a | Apenas MASTER no web |
| Reenviar convite | ok | ok | n/a | |

## Clientes e Unidades

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| CRUD de clientes | ok | ok | - | Mobile faz pull readonly |
| CRUD de unidades | ok | ok | - | Mobile faz pull readonly |
| Vincular auditores a clientes | ok | ok | n/a | |
| Vincular auditores a unidades | ok | ok | n/a | |
| Listagem de clientes | ok | ok | ok | Mobile: via pull do SQLite |
| Listagem de unidades | ok | ok | ok | Mobile: via pull do SQLite |

## Templates e Checklist

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| Criar template | ok | ok | n/a | Gestão administrativa |
| Editar template (itens, grupos) | ok | ok | n/a | |
| Ativar/inativar template | ok | ok | n/a | |
| Duplicar grupo/item | ok | ok | n/a | |
| Importar template | ok | ok | n/a | |
| Geração com IA | ok | ok | n/a | |
| Listagem de templates | ok | ok | ok | Mobile: via pull do SQLite (somente ativos) |

## Auditorias

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| Iniciar auditoria | ok | ok | ok | Mobile: offline-first, cria no SQLite |
| Listagem de auditorias | ok | ok | ok | Mobile: SQLite com join local |
| Responder itens | ok | ok | ok | |
| Upload de fotos | ok | ok | ok | Mobile: câmera nativa + file-system upload |
| Análise de foto por IA | ok | ok | ok | Mobile: em sequência, não paralelo |
| Finalizar auditoria | ok | ok | ok | |
| Reabrir auditoria | ok | ok | - | Não implementado no mobile |
| Remover auditoria | ok | ok | n/a | Apenas MASTER/GESTOR no web |
| Resumo executivo (IA) | ok | ok | parcial | Mobile recebe no push de volta |
| PDF de relatório | ok | ok | - | Mobile não gera/visualiza PDF |
| Histórico por unidade | ok | ok | - | |

## Relatório Técnico

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| Criar relatório | ok | ok | - | Schema existe no mobile mas sem UI |
| Editar relatório | ok | ok | - | |
| Apoio analítico IA | ok | ok | - | |
| Fotos de evidência | ok | ok | - | |
| Finalizar relatório | ok | ok | - | |
| PDF de relatório | ok | ok | - | |

## Check-in

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| Iniciar check-in | ok | ok | ok | FAB global + modal (cliente/unidade + GPS nativo); online-only |
| Finalizar checkout | ok | ok | ok | Confirmação + GPS nativo; online-only |
| Alerta 3h aberto | ok | ok | ok | Web: Notification API + toast fallback; mobile: badge/card |
| Checkout automático 12h | ok | ok | ok | API encerra com coords do check-in e comentário padrão |
| Edição GESTOR/MASTER | ok | ok | n/a | Datas/horas e comentário; web only |
| Mapa no detalhe | n/a | ok | n/a | Leaflet/OSM; web only |
| Relatório de horas | ok | ok | n/a | Por cliente ou usuário; PDF/CSV; web only |
| Listagem administrativa | ok | ok | pendente | GESTOR/MASTER; API pronta em `checkin.api.ts`, falta tela |

## Planos e Assinaturas

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| CRUD de planos | ok | ok | n/a | Apenas MASTER |
| Criar assinatura | ok | ok | n/a | |
| Visualizar limites | ok | ok | - | |
| Listagem pública de planos | ok | ok | n/a | Landing page |

## Créditos de IA

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| Consultar saldo | ok | ok | - | |
| Histórico de uso | ok | ok | - | |
| Config. créditos (MASTER) | ok | ok | n/a | |
| Auditoria de tokens | ok | ok | n/a | |

## Legislação

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| CRUD de legislações | ok | ok | n/a | Apenas MASTER |
| Busca semântica (RAG) | ok | ok | n/a | Usado internamente pela IA |

## Sincronização

| Feature | API | Web | Mobile | Observações |
|---------|-----|-----|--------|-------------|
| Pull (servidor → local) | n/a | n/a | ok | Clientes, templates, auditorias |
| Push (local → servidor) | n/a | n/a | ok | Auditorias com itens e fotos |
| Fila de sync offline | n/a | n/a | ok | SQLite sync_queue |
| Conflict resolution | n/a | n/a | parcial | sync_status != 'pending' protege dados locais |
| Canal MCP | n/a | n/a | n/a | Online apenas. Sem SQLite, pull, push ou `sync_queue` (RN-MCP-009) |

---

## Canal MCP (online)

Canal adicional, não uma terceira cópia offline do produto. Cada chamada roda na hora contra os services já usados por web e mobile, com o usuário do access token OAuth. Sem rede não há uso degradado. As colunas Web e Mobile das seções anteriores permanecem a fonte dos contratos desses clientes.

| Capacidade | MCP | Offline | Observações |
|------------|-----|---------|-------------|
| Discovery, autorização OTP+PKCE, refresh e revogação | - | n/a | RN-AUTH-010, RN-MCP-001 a RN-MCP-003, RN-MCP-011. Tela de consentimento só no web |
| Contexto da sessão (`chekai_me`) | - | n/a | Scope `chekai:contexto` |
| Ler clientes e unidades | - | n/a | AUDITOR só vínculos (RN-CLI-006). Sem criar, editar ou remover nesta onda |
| Ler checklists | - | n/a | AUDITOR só ativos do gestor (RN-CHK-003). Sem editor, ativação, duplicação ou importação nesta onda |
| Auditorias: listar, obter, iniciar, responder, finalizar em duas etapas | - | n/a | RN-AUD-001 a RN-AUD-010 e RN-MCP-007. Sem reabrir, remover, fotos, PDF ou resumo por IA |
| Agenda: listar e concluir | - | n/a | AUDITOR não cria, edita, cancela nem remove (RN-AGD-003); essas ações não são tools |
| Plano de ação: listar, criar, atualizar, concluir, reabrir | - | n/a | Isolamento do service (RN-PAC-002, RN-PAC-003). Sem remover e sem gerar tarefas por IA |
| Relatório técnico: listar, obter, iniciar, atualizar, finalizar em duas etapas | - | n/a | RN-REL-001 a RN-REL-004 e RN-REL-007. Sem fotos, PDF ou apoio analítico |
| Equipe, convites, planos, assinaturas, lista de espera, créditos, auditoria de tokens, legislação/RAG, cadastro público, login legado, IA genérica | excluído | n/a | Fora permanente (RN-MCP-008), não é backlog do canal |
| CRUD de clientes/checklists, fotos, PDF, check-in, IA de domínio | fora desta onda | n/a | Só entram com regra nova. Check-in e IA exigem confirmação em duas etapas (RN-MCP-007) |

---

## Changelog

| Data | Alteração |
|------|-----------|
| 2026-04-11 | Matriz inicial compilada a partir do código web, mobile e API |
| 2026-10-17 | Canal MCP registrado como online, sem offline e sem mudança de contrato web/mobile. Primeira onda e exclusões permanentes apontam para RN-AUTH-010 e RN-MCP-* |
