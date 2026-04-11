# Paridade de Plataformas — ChekAI

> Matriz de features por plataforma. Mantida pelo agente `platform-orchestrator`.
> Status: `ok` = implementado, `parcial` = incompleto, `n/a` = não aplicável, `-` = não implementado.

## Legenda

- **API**: endpoint disponível no backend NestJS
- **Web**: funcionalidade disponível no frontend Next.js
- **Mobile**: funcionalidade disponível no app Expo (offline-first)

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
| Iniciar check-in | ok | ok | - | Schema existe no mobile mas sem UI |
| Finalizar checkout | ok | ok | - | |
| Alerta 3h aberto | ok | ok | - | |
| Listagem administrativa | ok | ok | n/a | |

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

---

## Changelog

| Data | Alteração |
|------|-----------|
| 2026-04-11 | Matriz inicial compilada a partir do código web, mobile e API |
