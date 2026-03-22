# chekAI Mobile App — Design Spec

**Data:** 2026-03-21
**Status:** Aprovado
**Escopo:** App nativo iOS + Android para auditorias e relatórios técnicos offline-first

---

## 1. Contexto e Objetivo

O chekAI possui um app web para auditoria alimentar. O objetivo é criar um app nativo (iOS + Android) que permita realizar todo o fluxo de auditorias e relatórios técnicos com suporte offline-first, dado que auditores frequentemente trabalham em locais sem conexão à internet.

### Funcionalidades no escopo

- Login via OTP (apenas login, sem cadastro)
- Auditorias: fluxo completo (criar, responder itens, fotos, finalizar, resumo executivo)
- Relatórios Técnicos: fluxo completo (criar, editar rich text, fotos, apoio analítico, finalizar)
- Check-in com geofencing automático

### Roles contemplados

- `AUDITOR` — realiza auditorias em campo
- `GESTOR` — acompanha e cria auditorias; o `MASTER` permanece no web

---

## 2. Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Expo SDK 52 (managed workflow) |
| Linguagem | TypeScript |
| Estilo | NativeWind v4 (Tailwind CSS para React Native) |
| Navegação | Expo Router v4 (file-based routing) |
| Banco local | expo-sqlite com migrations versionadas |
| Data fetching | TanStack Query v5 (`networkMode: 'offlineFirst'`) |
| Sync queue | MMKV (fila de uploads e mutações pendentes) |
| Estado global | Zustand + persist com MMKV |
| Auth token | expo-secure-store (keychain nativo) |
| Câmera/fotos | expo-image-picker + expo-file-system |
| Geolocalização | expo-location + react-native-geofencing |
| Rich text | react-native-pell-rich-editor |
| Notificações | expo-notifications (local + push remoto via Expo Push Service) |
| Background sync | expo-background-fetch |
| Network detection | @react-native-community/netinfo |
| Build/deploy | EAS Build (iOS + Android) |

### Design System

Os tokens do `tailwind.config.ts` do web são replicados diretamente no mobile:

- **Primary:** `#00B8A9` (Teal Innovation)
- **Secondary:** `#0891b2` (Cyan)
- **Accent:** `#f59e0b` (Amber)
- **Neutral:** `#1B2A4A` (Navy)
- **Base:** `#FFFFFF`
- **Base-200:** `#F4F7FA`
- **Tipografia:** Inter (body) + Montserrat (display) via expo-google-fonts

---

## 3. Estrutura no Monorepo

```
meta-app/
├── apps/
│   ├── api/              (NestJS backend — sem alterações)
│   ├── web/              (Next.js — sem alterações)
│   └── mobile/           (novo — Expo)
├── packages/
│   └── shared/           (novo — tipos TypeScript compartilhados)
│       ├── types/
│       │   ├── usuario.ts
│       │   ├── auditoria.ts
│       │   ├── relatorio-tecnico.ts
│       │   ├── cliente.ts
│       │   └── enums.ts
│       └── package.json
```

O pacote `packages/shared` elimina duplicação de tipos entre web, api e mobile, garantindo que mudanças no backend se propagam automaticamente.

---

## 4. Banco de Dados Local (SQLite)

### Schema principal

```sql
-- Controle de usuário logado
usuarios (id, nome, email, perfil, status, tenant_id, logo_url, updated_at)

-- Dados de referência (sincronizados do backend)
clientes (id, remote_id, razao_social, nome_fantasia, cnpj, tipo_atividade, logo_url, sync_status, updated_at)
unidades (id, remote_id, nome, endereco, cidade, estado, latitude, longitude, raio_geofencing, cliente_id, sync_status, updated_at)
checklist_templates (id, remote_id, nome, descricao, tipo_atividade, versao, status, sync_status, updated_at)
template_itens (id, remote_id, template_id, descricao, ordem, referencia_legal, pontuacao_maxima, sync_status, updated_at)

-- Dados operacionais
auditorias (id, remote_id, status, data_inicio, data_fim, latitude_inicio, longitude_inicio, latitude_fim, longitude_fim, observacoes_gerais, pontuacao_total, resumo_executivo, pdf_url, cliente_id, unidade_id, template_id, sync_status, local_id, updated_at, deleted_at)
auditoria_itens (id, remote_id, auditoria_id, template_item_id, resposta, observacao, descricao_nao_conformidade, descricao_ia, complemento_descricao, plano_acao_sugerido, plano_acao_final, referencia_legal, pontuacao, sync_status, updated_at)
fotos (id, remote_id, auditoria_item_id, file_path, url, tamanho_bytes, analise_ia, latitude, longitude, sync_status, updated_at)

relatorios_tecnicos (id, remote_id, cliente_id, unidade_id, identificacao, descricao_ocorrencia_html, avaliacao_tecnica_html, acoes_executadas, recomendacoes_html, plano_acao_html, apoio_analitico, status, assinatura_nome, responsavel, sync_status, local_id, updated_at, deleted_at)
relatorio_fotos (id, remote_id, relatorio_id, file_path, url, descricao, sync_status, updated_at)

checkins (id, remote_id, usuario_id, cliente_id, unidade_id, status, data_checkin, data_checkout, latitude_checkin, longitude_checkin, latitude_checkout, longitude_checkout, sync_status, local_id, updated_at)

-- Controle de sync
sync_queue (id, entity, operation, payload, file_path, retries, created_at)
sync_meta (entity, last_synced_at)
```

### Campos de controle de sync (presentes em todas as tabelas operacionais)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `sync_status` | TEXT | `synced`, `pending`, `conflict` |
| `local_id` | TEXT | UUID gerado localmente antes de existir no servidor |
| `remote_id` | TEXT | ID do servidor após sync (NULL enquanto não sincronizado) |
| `updated_at` | TEXT | Timestamp para delta sync |
| `deleted_at` | TEXT | Soft delete (nunca apaga antes de sincronizar) |

---

## 5. Arquitetura de Sync

### PULL (backend → mobile)

Disparado automaticamente ao abrir o app ou recuperar conexão. Usa **delta sync** — busca apenas registros com `updated_at > sync_meta.last_synced_at`.

**Sequência de pull:**
1. `clientes` + `unidades` do auditor/gestor
2. `checklist_templates` + `template_itens` disponíveis
3. `auditorias` atribuídas (últimos 90 dias)
4. `auditoria_itens` das auditorias acima
5. `relatorios_tecnicos` do usuário
6. `checkins` abertos

Pull também ocorre em background via `expo-background-fetch` quando o app está fechado.

### PUSH (mobile → backend)

Toda mutação offline gera uma entrada na `sync_queue`. O `SyncService` processa a fila em ordem de prioridade quando detecta conexão via `@react-native-community/netinfo`.

**Prioridade da fila:**
1. `checkins` (time-sensitive)
2. `auditoria_itens` (respostas em texto)
3. finalização de `auditorias`
4. finalização de `relatorios_tecnicos` (transição de status `rascunho → finalizado` é enfileirada offline normalmente)
5. upload de `fotos` e `relatorio_fotos` (binário, mais pesado)
6. conteúdo de `relatorios_tecnicos` (rich text e metadados)

**Retry de fotos:** backoff exponencial (1s → 2s → 4s → 8s), máximo 5 tentativas. Após 5 falhas: `sync_status: 'conflict'` + notificação ao usuário.

### Resolução de conflitos

- **Dados de referência** (clientes, templates): server wins
- **Respostas de auditoria**: client wins — o auditor é a fonte de verdade do campo

**Recuperação manual de conflitos:** Registros com `sync_status: 'conflict'` aparecem em um painel de "Pendências" acessível no Dashboard (badge de alerta) e no Perfil. Para cada conflito, o usuário pode:
- **Tentar novamente** — re-enfileira na `sync_queue` com `retries: 0`
- **Descartar** — marca como `deleted_at` local (dado perdido, com confirmação explícita)

O app nunca descarta silenciosamente dados com conflito.

### IDs offline

Auditorias criadas offline recebem `local_id` (UUID v4). Após push:
1. Backend retorna `remote_id`
2. Em uma **única transação SQLite**, o app atualiza:
   - `auditoria.remote_id`
   - todos os `auditoria_itens` filhos (`auditoria_id` → `remote_id`)
   - todas as `fotos` filhas (`auditoria_item_id` → `remote_id` do item pai)
3. Se a transação falhar em qualquer ponto, ela é revertida completamente — o registro permanece com `remote_id: null` e `sync_status: 'pending'` para retry.

---

## 6. Navegação (Expo Router)

```
app/
├── (auth)/
│   └── login.tsx              — OTP: email → código 6 dígitos → JWT
│
├── (app)/                     — protegido, requer auth
│   ├── _layout.tsx            — tab bar principal
│   ├── index.tsx              — Dashboard
│   │
│   ├── auditorias/
│   │   ├── index.tsx          — Lista de auditorias
│   │   ├── nova.tsx           — Criar auditoria (cliente → unidade → template)
│   │   └── [id]/
│   │       ├── index.tsx      — Auditoria ativa (checklist por grupo)
│   │       ├── item/[itemId].tsx — Responder item (resposta + observação + foto)
│   │       └── resumo.tsx     — Resumo executivo + finalizar
│   │
│   ├── relatorios/
│   │   ├── index.tsx          — Lista de relatórios técnicos
│   │   ├── novo.tsx           — Criar relatório
│   │   └── [id].tsx           — Editar relatório (rich text + fotos)
│   │
│   └── perfil.tsx             — Dados do usuário + logout
│
└── +not-found.tsx
```

**Tab bar:**

| Tab | Ícone | Roles |
|-----|-------|-------|
| Dashboard | home | AUDITOR + GESTOR |
| Auditorias | clipboard | AUDITOR + GESTOR |
| Relatórios | file-text | AUDITOR + GESTOR |
| Perfil | user | AUDITOR + GESTOR |

---

## 7. Autenticação

- Fluxo idêntico ao web: tela de email → código OTP de 6 dígitos
- Token JWT salvo no `expo-secure-store` (keychain nativo do iOS/Android)
- Ao abrir o app com token válido: redireciona para Dashboard e inicia pull de sync em background
- Sem opção de cadastro no mobile — apenas login

---

## 8. Onboarding de Permissões

Exibido uma única vez após o primeiro login. Cada tela solicita uma permissão com explicação orientada ao benefício do usuário:

**Tela 1 — Localização em background**
> "Para detectar automaticamente quando você chega em uma unidade cliente e registrar o check-in sem precisar abrir o app."
- Se negado: geofencing desabilitado, check-in vira manual (app não quebra)

**Tela 2 — Câmera e Galeria**
> "Para registrar evidências fotográficas durante as auditorias."
- Se negado: câmera desabilitada, upload de fotos indisponível

**Tela 3 — Notificações**
> "Para avisar sobre check-ins detectados, sync concluído e análises de IA disponíveis."
- Se negado: notificações locais desabilitadas

**Tela 4 — Pronto**
- Resumo das permissões concedidas
- Aviso de que podem ser ajustadas nas configurações do celular
- Botão "Ajustar permissões" → abre as configurações do sistema operacional (deep link nativo)
- Botão "Começar" → Dashboard

**Estado degradado (todas as permissões negadas):** o app funciona, mas exibe um aviso persistente no Dashboard listando as funcionalidades indisponíveis. O botão "Ajustar permissões" fica sempre visível no Perfil. O app nunca bloqueia o uso — apenas informa o que está limitado.

---

## 9. Check-in e Geofencing

- `expo-location` com permissão `Always` (background)
- Geofences registradas para todas as unidades dos clientes do auditor após pull inicial
- Raio configurável por unidade (`raioGeofencing`, padrão 100m)

**Fluxo automático:**
```
Entrada no raio:
→ Notificação: "Você está em [Unidade X]. Fazer check-in?"
→ Confirmação → check-in registrado (local primeiro, push na fila)

Saída do raio:
→ Notificação: "Você saiu de [Unidade X]. Encerrar check-in?"
→ Confirmação → check-out registrado
→ Sem resposta em 30min → alerta de 3h (comportamento já existente no backend)
```

**Offline:** geofences funcionam nativamente sem internet. Timestamp local preservado como `data_checkin` real.

---

## 10. Features de IA — Online vs Offline

### Disponível offline

| Feature | Comportamento |
|---------|--------------|
| Responder itens do checklist | 100% offline |
| Tirar e salvar fotos | Salva localmente, upload enfileirado |
| Preencher relatório técnico | 100% offline |
| Ver auditorias/relatórios carregados | 100% offline |
| Check-in/out por geofencing | 100% offline |

### Requer conexão

| Feature | Comportamento offline |
|---------|----------------------|
| Análise de IA de fotos (DeepSeek-VL2) | Foto na fila → análise roda após upload |
| Resumo executivo da auditoria | Botão desabilitado + tooltip "Requer conexão" |
| Apoio analítico do relatório | Botão desabilitado + tooltip "Requer conexão" |
| Geração de PDF | Botão desabilitado + tooltip "Requer conexão" |

**UX:** features indisponíveis nunca são escondidas — sempre exibidas com estado desabilitado, ícone de nuvem e tooltip explicativo. Ao completar sync e processar IA, o app envia notificação local.

---

## 11. Indicador de Status Offline (Global)

Banner sutil no topo em todas as telas quando sem internet, exibindo o número de ações na fila para sincronizar. Desaparece automaticamente após sync completo.

---

## 12. Use Cases Offline-First por Funcionalidade

### Login
- **Online:** OTP por email, JWT retornado e salvo no keychain
- **Offline:** não é possível fazer login pela primeira vez sem internet (OTP requer backend). Se já logado, o token válido permite uso completo offline.
- **Token expiry offline:** o app tenta silent refresh (usando refresh token armazenado no `expo-secure-store`) toda vez que volta ao foreground enquanto online. Se o usuário ficar offline por período superior ao TTL do token, ao reconectar o app tenta o refresh automaticamente; se falhar, exibe tela "Sessão expirada — reconecte para continuar" sem apagar dados locais. Dados offline criados durante a sessão expirada são preservados e sincronizados após novo login.

### Auditorias — Criar nova offline (Opção B)
- Auditor seleciona cliente/unidade/template do banco local (pre-sincronizados)
- `local_id` gerado localmente, `remote_id: null`
- Auditoria criada com `sync_status: 'pending'`
- Ao reconectar: push cria no backend, retorna `remote_id`, app atualiza em cascata

### Auditorias — Responder itens
- Respostas salvas localmente imediatamente
- Enfileiradas para push quando online
- Sem bloqueio de UI — o auditor continua normalmente

### Fotos
- Capturadas e salvas no sistema de arquivos local (`expo-file-system`)
- Metadados salvos na tabela `fotos` com `file_path` local e `sync_status: 'pending'`
- Upload real acontece quando online, `url` remota preenchida após upload

### Relatórios Técnicos
- Criados e editados 100% offline
- Rich text salvo localmente em HTML
- Push sincroniza quando online
- **Finalização offline:** o usuário pode finalizar o relatório (status `rascunho → finalizado`) sem internet. A transição de status é enfileirada na `sync_queue` como operação `update`. O relatório aparece como "Finalizado (pendente sync)" localmente até confirmação do backend.

### Check-in
- Geofencing funciona offline (nativo iOS/Android)
- Check-in salvo localmente com timestamp real
- Push sincroniza quando online

---

## 13. Decisões de Arquitetura Registradas

| Decisão | Alternativas consideradas | Motivo da escolha |
|---------|--------------------------|------------------|
| React Native + Expo | Flutter, RN bare | Reuso de TypeScript com backend, equipe React, NativeWind |
| expo-sqlite + TanStack Query | WatermelonDB, Zustand-only | Padrões familiares, controle de sync, suporte oficial Expo |
| MMKV para sync queue | AsyncStorage | 30x mais rápido, síncrono, ideal para fila de operações |
| Server wins para referência | Client wins | Dados de clientes/templates são autoritativos no backend |
| Client wins para respostas | Server wins | Auditor é fonte de verdade do campo |
| Onboarding de permissões | Solicitar no momento de uso | Melhor taxa de aprovação com explicação de contexto upfront |
| Always location permission | When in use | Geofencing com app fechado requer background location |
| react-native-pell-rich-editor para rich text | 10tap-editor, react-native-cn-quill | Maturidade de API, suporte a HTML nativo compatível com conteúdo já existente no web; risco de manutenção documentado — avaliar 10tap-editor se surgirem problemas |
| SQLite sem encriptação por padrão | SQLCipher (encriptação em repouso) | Risco aceito: iOS File Data Protection e Android Keystore fornecem encriptação em nível de OS; dados de auditoria alimentar não contêm PII sensível além de localização e texto. Reavaliar se requisito de compliance exigir encriptação explícita. |
| Refresh token em expo-secure-store | Renovação manual pelo usuário | Evita logout forçado durante uso offline prolongado preservando dados criados |
