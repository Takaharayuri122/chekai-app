# Fase 2: Auditorias — Design Spec

**Data:** 2026-03-22
**Status:** Aprovado
**Escopo:** Fluxo completo de auditorias no app nativo (criar, responder itens, fotos, finalizar, sync, IA)

---

## 1. Contexto

O app já possui as tabelas `auditorias`, `auditoria_itens` e `fotos` no schema v1, além de `checklist_templates` e `template_itens`. A Fase 2 implementa o fluxo completo de auditorias: desde criar uma nova auditoria até finalizar, sincronizar com o backend e exibir o resumo com IA.

### O que muda em relação ao schema existente

A tabela `template_itens` precisa de colunas adicionais para suportar as variações de resposta. Isso requer uma migration (SCHEMA_VERSION 2).

---

## 2. Mudanças no Schema (Migration v2)

Adicionar à tabela `template_itens`:

```sql
ALTER TABLE template_itens ADD COLUMN categoria TEXT;
ALTER TABLE template_itens ADD COLUMN tipo_resposta TEXT NOT NULL DEFAULT 'padrao';
-- 'padrao' | 'customizado' | 'numero' | 'texto'
ALTER TABLE template_itens ADD COLUMN opcoes_resposta_config TEXT;
-- JSON: para tipo 'customizado' e config de foto/observação obrigatória
-- ex: [{"label":"Ótimo","pontuacao":10,"fotoObrigatoria":false},...]
ALTER TABLE template_itens ADD COLUMN foto_obrigatoria INTEGER NOT NULL DEFAULT 0;
ALTER TABLE template_itens ADD COLUMN observacao_obrigatoria INTEGER NOT NULL DEFAULT 0;
ALTER TABLE template_itens ADD COLUMN criticidade TEXT;
-- 'critico' | 'alto' | 'medio' | 'baixo'
```

---

## 3. Arquitetura e Estrutura de Arquivos

### Novos arquivos

```
apps/mobile/src/
  db/
    repositories/
      auditoria.repo.ts         — CRUD de auditorias no SQLite
      auditoria-item.repo.ts    — CRUD de auditoria_itens
      foto.repo.ts              — CRUD de fotos
  store/
    auditoria.ts                — Zustand: sessão ativa da auditoria em memória
  api/
    auditoria.api.ts            — POST/PATCH auditoria, POST item, POST foto, GET IA
  sync/
    push.ts                     — pushAuditoria(id): envia auditoria+itens+fotos para API

apps/mobile/app/(app)/auditorias/
  _layout.tsx                   — Stack navigator para o grupo de auditorias
  index.tsx                     — Lista de auditorias
  nova.tsx                      — Wizard step 1: selecionar estabelecimento/unidade
  nova-template.tsx             — Wizard step 2: selecionar template
  [id]/
    checklist.tsx               — Lista de itens agrupados por categoria
    item/[itemId].tsx           — Tela de resposta do item
    resumo.tsx                  — Resumo final e envio

apps/mobile/src/components/auditoria/
  AuditoriaStatusBadge.tsx      — Badge de status (Em andamento / Concluída / Pendente sync)
  ItemRespostaButtons.tsx       — Botões C/NC/NA ou opções customizadas
  ItemCamposNc.tsx              — Campos extras (descrição NC + plano de ação) para tipo NC
  FotoGrid.tsx                  — Grid de fotos com botão adicionar
  ChecklistProgress.tsx         — Barra de progresso + contador respondidos/total
```

### Arquivos modificados

```
apps/mobile/src/db/schema.ts       — SCHEMA_VERSION 2 + SCHEMA_V2 (migrations)
apps/mobile/src/db/migrations.ts   — Aplicar migration v2
apps/mobile/src/sync/pull.ts       — Adicionar pullAuditorias()
apps/mobile/src/sync/SyncService.ts — Adicionar chamada a pushAll() no sync()
```

---

## 4. Repositories

### `auditoria.repo.ts`

```typescript
interface AuditoriaRepo {
  create(data: CreateAuditoriaInput): string;           // retorna local id
  findAll(): AuditoriaListItem[];
  findById(id: string): AuditoriaCompleta | null;
  updateStatus(id: string, status: AuditoriaStatus): void;
  updatePontuacao(id: string, pontuacao: number): void;
  markSynced(id: string, remoteId: string): void;
  setSyncStatus(id: string, status: SyncStatus): void;
}
```

### `auditoria-item.repo.ts`

```typescript
interface AuditoriaItemRepo {
  upsertResposta(itemId: string, resposta: RespostaInput): void;
  findByAuditoria(auditoriaId: string): AuditoriaItemCompleto[];
  findById(id: string): AuditoriaItemCompleto | null;
}

interface RespostaInput {
  resposta: string;               // 'conforme' | 'nao_conforme' | 'na' | string (customizado)
  observacao?: string;
  descricaoNaoConformidade?: string;
  planoAcaoFinal?: string;
  pontuacao?: number;
  descricaoIa?: string;
  planoAcaoSugerido?: string;
}
```

### `foto.repo.ts`

```typescript
interface FotoRepo {
  add(itemId: string, filePath: string, coords?: LatLng): string; // retorna id
  findByItem(itemId: string): Foto[];
  remove(id: string): void;
  markSynced(id: string, remoteId: string, url: string): void;
}
```

---

## 5. Zustand Store (`store/auditoria.ts`)

Store não-persistido (sessão em memória). Alimentado do SQLite ao entrar no checklist. Limpo ao sair.

```typescript
interface AuditoriaStore {
  // Estado
  auditoria: AuditoriaCompleta | null;
  itens: AuditoriaItemCompleto[];
  itensPorCategoria: Record<string, AuditoriaItemCompleto[]>;
  progresso: { respondidos: number; total: number; percentual: number };

  // Ações
  iniciar(auditoriaId: string): void;           // carrega do SQLite
  salvarResposta(itemId: string, resposta: RespostaInput): void;  // SQLite + memória
  finalizar(): void;                             // status → 'concluida'
  limpar(): void;                                // limpa memória ao sair
}
```

---

## 6. API Layer (`api/auditoria.api.ts`)

```typescript
// Cria auditoria no backend
createAuditoria(payload: CreateAuditoriaPayload): Promise<{ id: string }>;

// Envia item respondido
submitItem(auditoriaId: string, item: ItemPayload): Promise<void>;

// Upload de foto (multipart)
uploadFoto(auditoriaItemId: string, filePath: string): Promise<{ id: string; url: string }>;

// Finaliza auditoria (gera PDF e análise IA no backend)
finalizarAuditoria(auditoriaId: string, payload: FinalizarPayload): Promise<AuditoriaResumo>;

// Busca sugestão de IA para descrição NC (opcional, best-effort)
getSugestaoIa(itemId: string, contexto: string): Promise<{ descricao: string; planoAcao: string }>;
```

---

## 7. Fluxo de Navegação

```
Tab Auditorias
  └─ Lista (index.tsx)
       └─ [+] → Nova (nova.tsx: selecionar estabelecimento)
                    └─ → Nova Template (nova-template.tsx: selecionar template)
                              └─ → Checklist ([id]/checklist.tsx)
                                        └─ item toque → Item ([id]/item/[itemId].tsx)
                                                            ← voltar → Checklist
                                        └─ Finalizar → Resumo ([id]/resumo.tsx)
```

---

## 8. Telas

### 8.1 Lista de Auditorias (`auditorias/index.tsx`)

- Pull-to-refresh chama `SyncService.sync()`
- Cards com: nome do estabelecimento, data, status badge, score quando concluída
- FAB "+" abre o wizard
- Filtros por status: Todas / Em andamento / Concluídas

### 8.2 Nova Auditoria — Step 1 (`auditorias/nova.tsx`)

- Buscas de clientes/unidades do SQLite (já sincronizadas)
- SearchBar + FlatList
- Selecionar unidade avança para step 2

### 8.3 Nova Auditoria — Step 2 (`auditorias/nova-template.tsx`)

- Lista de templates disponíveis para a unidade (filtra por `tipo_atividade`)
- Confirmar cria a auditoria no SQLite com status `rascunho` e navega para o checklist

### 8.4 Checklist (`auditorias/[id]/checklist.tsx`)

- Lê `useAuditoriaStore` (já carregado ao entrar)
- SectionList agrupado por `categoria`
- Cabeçalho de seção: nome da categoria + progresso da seção (x/y)
- Barra de progresso global no topo (via `ChecklistProgress`)
- Cada item: dot colorido (verde/vermelho/cinza), texto, badge C/NC/—
- Toque no item → navega para `item/[itemId]`
- Botão "Finalizar" no rodapé: habilitado sempre; se houver pendentes, mostra confirm dialog

### 8.5 Item (`auditorias/[id]/item/[itemId].tsx`)

Adapta UI conforme `template_item.tipo_resposta`:

| `tipo_resposta` | UI renderizada |
|---|---|
| `padrao` | Botões C / NC / N/A |
| `customizado` | Botões dinâmicos de `opcoes_resposta_config` com pontuação |
| `numero` | Input numérico com unidade (do `opcoes_resposta_config`) |
| `texto` | TextInput multilinha |

Campos comuns a todos os tipos:
- Observação (sempre opcional, exceto se `observacao_obrigatoria = true`)
- FotoGrid (sempre disponível; obrigatório se `foto_obrigatoria = true` ou se opção selecionada exige)
- Campos NC (`ItemCamposNc`): aparecem quando resposta = `nao_conforme`
  - Descrição da não conformidade (pré-preenchida pela IA se disponível)
  - Plano de ação (pré-preenchido pela IA se disponível)
- Botão "Salvar" — persiste no SQLite via store e volta para checklist

**Integração IA:**
Ao marcar `nao_conforme`, chama `getSugestaoIa()` em background (sem bloquear UI). Quando retornar, preenche os campos NC se ainda estiverem vazios. Indicador de loading nos campos enquanto aguarda.

### 8.6 Resumo (`auditorias/[id]/resumo.tsx`)

- Score geral com anel visual (pontuação / pontuação máxima)
- Breakdown por categoria (progresso bar por seção)
- Lista de NCs com criticidade
- `analiseIa`: texto gerado pelo backend ao finalizar; exibido quando pronto (polling ou retorno da API `finalizarAuditoria`)
- Botão "Enviar Relatório": chama `pushAuditoria()` → se ok, PDF URL disponível; se offline, enfileira e mostra feedback
- Campo assinatura do responsável (nome textual)

---

## 9. Push Sync (`sync/push.ts`)

```typescript
async function pushAuditoria(localId: string): Promise<void> {
  // 1. Carrega auditoria + itens + fotos do SQLite
  // 2. POST /auditorias → recebe remoteId
  // 3. Para cada item: POST /auditorias/:remoteId/itens
  // 4. Para cada foto: POST /auditorias/:remoteId/itens/:itemId/fotos (multipart)
  // 5. POST /auditorias/:remoteId/finalizar → recebe resumo + pdf_url
  // 6. Marca tudo como sync_status='synced' no SQLite
  // 7. Salva analise_ia e pdf_url na tabela auditorias
}
```

**Estratégia:** tentar imediatamente ao finalizar. Se offline ou falha, adiciona à `sync_queue` no MMKV. `SyncService.sync()` processa a fila a cada sync periódico.

---

## 10. Pull Sync (`sync/pull.ts` — `pullAuditorias`)

Busca auditorias criadas em outros dispositivos (ex: GESTOR delegando no web):

```typescript
async function pullAuditorias(): Promise<void> {
  // GET /auditorias?updatedSince=<last_synced>
  // Para cada auditoria retornada: INSERT OR REPLACE auditorias + auditoria_itens
  // Não sobrescreve itens com sync_status='pending' (proteção offline)
}
```

Chamada em `pullAll()` junto com `pullClientes()` e `pullTemplates()`.

---

## 11. Tratamento de Erros

| Cenário | Comportamento |
|---|---|
| Sem conexão ao finalizar | Toast "Salvo localmente. Será enviado quando houver conexão." Badge "Pendente sync" na lista |
| Falha no upload de foto | Foto marcada `sync_status='error'`; ícone de aviso na FotoGrid; retry na próxima sync |
| Falha na sugestão IA | Campos NC ficam editáveis sem sugestão; sem toast (operação best-effort) |
| Auditoria já enviada (409) | Marca como synced, atualiza remoteId |
| Erro genérico na finalização | Toast com mensagem de erro; botão "Tentar novamente" |

---

## 12. Componentes Reutilizáveis

### `AuditoriaStatusBadge`
Props: `status: 'rascunho' | 'em_andamento' | 'concluida' | 'pending_sync'`
Cores: cinza / âmbar / verde / laranja

### `ItemRespostaButtons`
Props: `tipo`, `opcoes?`, `valorAtual`, `onSelect`
Renderiza botões apropriados para o `tipo_resposta`

### `ItemCamposNc`
Props: `descricaoIa?`, `planoAcaoIa?`, `loadingIa`, `onChange`
Campos de texto com pré-preenchimento de IA e estado de loading

### `FotoGrid`
Props: `fotos`, `onAdd`, `onRemove`, `obrigatoria`, `maxFotos?`
Grid 3 colunas com botão "+" e indicador de obrigatoriedade

### `ChecklistProgress`
Props: `respondidos`, `total`
Barra de progresso teal + texto "X/Y respondidos"

---

## 13. Decisões de Design

- **Não usar TanStack Query para o checklist** — dados vêm do SQLite em memória via Zustand; sem overhead de rede durante a auditoria
- **Store não-persistido** — auditoria ativa vive só em memória; retomada de auditoria relê do SQLite
- **Schema migration v2** — `ALTER TABLE` seguro (apenas ADD COLUMN com DEFAULT); não quebra dados existentes
- **IA best-effort** — chamada de IA nunca bloqueia o fluxo; timeout de 10s; falha silenciosa
- **Fotos** salvas com `expo-file-system` em diretório permanente do app antes de upload; `file_path` no SQLite garante reenvio se upload falhar
