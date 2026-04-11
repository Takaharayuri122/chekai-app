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
| RN-ISO-005 | Check-ins: GESTOR vê apenas check-ins de clientes onde é `gestorId`; AUDITOR não acessa listagem administrativa |
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

### Fotos

| ID | Regra |
|----|-------|
| RN-FOT-001 | Fotos só podem ser adicionadas em auditorias não finalizadas |
| RN-FOT-002 | Upload: imagem obrigatória, validação de MIME type (`image/*`), compressão via sharp, extração de EXIF |
| RN-FOT-003 | Análise por IA: campo `analiseIa` e flag `processadoPorIa` por foto |
| RN-FOT-004 | No mobile: múltiplas seleções, upload e processamento IA em sequência (não paralelo), grid 2 colunas |

---

## 7. Relatório Técnico

| ID | Regra |
|----|-------|
| RN-REL-001 | Relatório técnico é por cliente (opcionalmente por unidade), sem pontuação de auditoria |
| RN-REL-002 | `consultoraId` = usuário que cria; mesma regra de isolamento da auditoria para acesso |
| RN-REL-003 | Campos HTML obrigatórios para finalizar: `identificacao`, `descricaoOcorrenciaHtml`, `avaliacaoTecnicaHtml`, `recomendacoesConsultoraHtml`, `planoAcaoSugeridoHtml` |
| RN-REL-004 | Pelo menos uma `acaoExecutada` obrigatória antes de finalizar ou gerar apoio analítico |
| RN-REL-005 | Apoio analítico gerado por IA: somente leitura pelo usuário (preenchido pela IA) |
| RN-REL-006 | Fotos de evidência sem processamento por IA (diferente das fotos de auditoria) |
| RN-REL-007 | Vínculo cliente/unidade validado: unidade deve pertencer ao cliente informado |
| RN-REL-008 | PDF: mesma lógica de geração e armazenamento das auditorias |

---

## 8. Check-in

| ID | Regra |
|----|-------|
| RN-CKI-001 | Apenas 1 check-in aberto por usuário; tentativa de abrir segundo retorna erro |
| RN-CKI-002 | Check-in exige unidade ativa pertencente ao cliente informado |
| RN-CKI-003 | Validação de acesso: MASTER livre; GESTOR se for gestor do cliente; AUDITOR se seu `gestorId` for o gestor do cliente |
| RN-CKI-004 | Checkout: apenas o próprio usuário pode finalizar seu check-in |
| RN-CKI-005 | Alerta após 3 horas de check-in aberto; flag `alerta3hEmitidoEm` para não repetir |
| RN-CKI-006 | Listagem administrativa (tela de check-ins): AUDITOR não tem acesso; GESTOR vê apenas check-ins de seus clientes |
| RN-CKI-007 | Check-in registra geolocalização de entrada e saída (latitude/longitude) |
| RN-CKI-008 | Filtros na listagem: por auditor, cliente, período (dataInicio/dataFim) |

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
| RN-LEG-001 | Legislações são cadastradas com tipo, número, ano, título, texto integral |
| RN-LEG-002 | Texto é quebrado em chunks com embedding vetorial (pgvector) para busca semântica |
| RN-LEG-003 | Cada chunk possui referência ao artigo/inciso de origem |
| RN-LEG-004 | RAG alimenta a geração de templates e análise de auditorias via `IaService` |

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

## Changelog

| Data | Alteração | Autor |
|------|-----------|-------|
| 2026-04-11 | Documento inicial compilado a partir do código-fonte da API, mobile e web | platform-orchestrator |
