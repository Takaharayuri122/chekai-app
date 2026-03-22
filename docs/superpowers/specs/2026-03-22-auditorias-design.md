# Fase 2: Auditorias — Design Spec

**Data:** 2026-03-22
**Status:** Aprovado
**Escopo:** Fluxo completo de auditorias no app nativo (criar, responder itens, fotos, finalizar, sync, IA)

---

## 1. Contexto

O app já possui as tabelas `auditorias`, `auditoria_itens` e `fotos` no schema v1, além de `checklist_templates` e `template_itens`. A Fase 2 implementa o fluxo completo de auditorias: desde criar uma nova auditoria até finalizar, sincronizar com o backend e exibir o resumo com IA.

### O que muda em relação ao schema existente

A tabela `template_itens` precisa de colunas adicionais para suportar as variações de resposta. Isso requer uma migration (SCHEMA_VERSION 2). Além disso, `pullTemplates()` em `pull.ts` deve ser atualizado para incluir as novas colunas.

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

`ADD COLUMN` com `DEFAULT` é seguro em SQLite — não recria a tabela nem apaga dados existentes.

### Atualização obrigatória em `pullTemplates()`

O `INSERT OR REPLACE` existente em `pull.ts` usa `DELETE + INSERT` internamente. Após a migration v2, ele **apagaria** os novos campos em cada sync. A função deve ser reescrita para incluir as 6 novas colunas:

```typescript
db.runSync(
  `INSERT OR REPLACE INTO template_itens
   (id, remote_id, template_id, descricao, ordem, referencia_legal, pontuacao_maxima,
    categoria, tipo_resposta, opcoes_resposta_config,
    foto_obrigatoria, observacao_obrigatoria, criticidade,
    sync_status, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
  [item.id, item.id, t.id, item.descricao, item.ordem,
   item.referenciaLegal ?? null, item.pontuacaoMaxima,
   item.categoria ?? null, item.tipoResposta ?? 'padrao',
   item.opcoesRespostaConfig ? JSON.stringify(item.opcoesRespostaConfig) : null,
   item.fotoObrigatoria ? 1 : 0,
   item.observacaoObrigatoria ? 1 : 0,
   item.criticidade ?? null, now]
);
```

O backend (`GET /checklist/templates`) já deve retornar esses campos — confirmar com o time de backend antes de iniciar a implementação.

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
  _layout.tsx                   — Stack navigator para o grupo (substitui auditorias.tsx)
  index.tsx                     — Lista de auditorias
  nova.tsx                      — Wizard step 1: selecionar estabelecimento/unidade
  nova-template.tsx             — Wizard step 2: selecionar template
  [id]/
    _layout.tsx                 — Stack interno para as telas de auditoria em andamento
    checklist.tsx               — Lista de itens agrupados por categoria
    item/
      [itemId].tsx              — Tela de resposta do item
    resumo.tsx                  — Resumo final e envio

apps/mobile/src/components/auditoria/
  AuditoriaStatusBadge.tsx      — Badge de status (Em andamento / Concluída / Pendente sync)
  ItemRespostaButtons.tsx       — Botões C/NC/NA ou opções customizadas
  ItemCamposNc.tsx              — Campos extras (descrição NC + plano de ação)
  FotoGrid.tsx                  — Grid de fotos com botão adicionar
  ChecklistProgress.tsx         — Barra de progresso + contador respondidos/total
```

### Arquivos modificados

```
apps/mobile/app/(app)/_layout.tsx      — Registrar rotas filhas do grupo auditorias com href:null
apps/mobile/src/db/schema.ts           — SCHEMA_VERSION 2 + SCHEMA_V2 (migrations)
apps/mobile/src/db/migrations.ts       — Aplicar migration v2
apps/mobile/src/sync/pull.ts           — Atualizar pullTemplates() + adicionar pullAuditorias()
apps/mobile/src/sync/SyncService.ts    — Adicionar chamada a pushPending() no sync()
```

---

## 4. Navegação (Expo Router v4)

### Conversão de `auditorias.tsx` → pasta `auditorias/`

O arquivo `app/(app)/auditorias.tsx` é substituído pela pasta `app/(app)/auditorias/`. O Expo Router v4 detecta o `_layout.tsx` interno e usa-o como Stack navigator para o grupo.

O `<Tabs.Screen name="auditorias">` em `(app)/_layout.tsx` **continua sem alteração** — o Expo Router resolve o folder automaticamente. As rotas filhas (`nova`, `nova-template`, `[id]/*`) não aparecem na tab bar porque estão aninhadas no Stack interno.

Para garantir que rotas filhas não gerem tabs extras, adicionar em `(app)/_layout.tsx`:

```tsx
<Tabs.Screen name="auditorias/nova" options={{ href: null }} />
<Tabs.Screen name="auditorias/nova-template" options={{ href: null }} />
<Tabs.Screen name="auditorias/[id]" options={{ href: null }} />
```

### `auditorias/_layout.tsx`

```tsx
import { Stack } from 'expo-router';

export default function AuditoriasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nova" options={{ headerShown: true, title: 'Nova Auditoria' }} />
      <Stack.Screen name="nova-template" options={{ headerShown: true, title: 'Selecionar Template' }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
```

### Parâmetros de navegação entre telas do wizard

| Transição | Chamada | Params |
|---|---|---|
| Lista → Nova step 1 | `router.push('/(app)/auditorias/nova')` | nenhum |
| Step 1 → Step 2 | `router.push({ pathname: '/(app)/auditorias/nova-template', params: { unidadeId, clienteId } })` | `unidadeId: string`, `clienteId: string` |
| Step 2 → Checklist | `router.replace({ pathname: '/(app)/auditorias/[id]/checklist', params: { id: novaAuditoriaId } })` | `id: string` (local UUID) |
| Item tap → Item screen | `router.push({ pathname: '/(app)/auditorias/[id]/item/[itemId]', params: { id, itemId } })` | `id: string`, `itemId: string` |
| Finalizar → Resumo | `router.replace({ pathname: '/(app)/auditorias/[id]/resumo', params: { id } })` | `id: string` |

Usar `router.replace` nas transições de step 2 → checklist e checklist → resumo para que o botão Voltar não retorne ao wizard.

---

## 5. Repositories

### `auditoria.repo.ts`

```typescript
interface CreateAuditoriaInput {
  id: string;            // UUID gerado localmente (= local_id)
  clienteId: string;
  unidadeId: string;
  templateId: string;
  dataInicio: string;    // ISO 8601
  latitudeInicio?: number;
  longitudeInicio?: number;
}

// id e local_id recebem o mesmo UUID gerado antes de chamar create().
// remote_id fica null até a sync. sync_status = 'pending'.

interface AuditoriaRepo {
  create(data: CreateAuditoriaInput): void;
  findAll(): AuditoriaListItem[];
  findById(id: string): AuditoriaCompleta | null;
  updateStatus(id: string, status: AuditoriaStatus): void;
  updatePontuacao(id: string, pontuacao: number): void;
  markSynced(id: string, remoteId: string): void;  // seta remote_id + sync_status='synced'
  setSyncStatus(id: string, status: SyncStatus): void;
}
```

### `auditoria-item.repo.ts`

```typescript
interface RespostaInput {
  resposta: string;               // 'conforme' | 'nao_conforme' | 'na' | string (customizado)
  observacao?: string;
  descricaoNaoConformidade?: string;
  planoAcaoFinal?: string;
  pontuacao?: number;
  descricaoIa?: string;
  planoAcaoSugerido?: string;
}

interface AuditoriaItemRepo {
  // Cria todos os itens ao iniciar a auditoria (chamado em nova-template.tsx)
  bulkCreate(auditoriaId: string, templateItens: TemplateItemRow[]): void;
  upsertResposta(itemId: string, resposta: RespostaInput): void;
  findByAuditoria(auditoriaId: string): AuditoriaItemCompleto[];
  findById(id: string): AuditoriaItemCompleto | null;
}
// TemplateItemRow: row lida do SQLite template_itens com os campos da migration v2
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

Todos os métodos de repository usam a SQLite sync API (`db.runSync`, `db.getAllSync`, `db.getFirstSync`) — padrão idêntico ao `pull.ts` existente.

---

## 6. Zustand Store (`store/auditoria.ts`)

Store não-persistido (sessão em memória). Limpo ao sair do checklist. `itensPorCategoria` é derivado no componente via `useMemo` — não fica no store para evitar estado duplicado.

```typescript
interface AuditoriaStore {
  auditoria: AuditoriaCompleta | null;
  itens: AuditoriaItemCompleto[];
  isLoading: boolean;

  // iniciar: carrega do SQLite usando API síncrona (db.getAllSync).
  // Deve ser chamado em useEffect, nunca durante render.
  iniciar(auditoriaId: string): void;

  salvarResposta(itemId: string, resposta: RespostaInput): void;  // SQLite + atualiza itens[]
  finalizar(): void;   // seta status='concluida' no SQLite + no store
  limpar(): void;      // reseta para estado inicial
}
```

**Uso no Checklist:**

```tsx
useEffect(() => {
  store.iniciar(id);
  return () => store.limpar();
}, [id]);

// Enquanto isLoading, renderizar ActivityIndicator (padrão do (app)/_layout.tsx)
```

`itensPorCategoria` no componente:

```tsx
const itensPorCategoria = useMemo(() =>
  itens.reduce<Record<string, AuditoriaItemCompleto[]>>((acc, item) => {
    const cat = item.categoria ?? 'Geral';
    (acc[cat] ??= []).push(item);
    return acc;
  }, {}),
[itens]);
```

---

## 7. API Layer (`api/auditoria.api.ts`)

```typescript
createAuditoria(payload: CreateAuditoriaPayload): Promise<{ id: string }>;

submitItem(auditoriaId: string, item: ItemPayload): Promise<void>;

// Upload de foto (multipart/form-data)
uploadFoto(auditoriaItemId: string, filePath: string): Promise<{ id: string; url: string }>;

// Finaliza auditoria — backend gera PDF e análise IA
finalizarAuditoria(auditoriaId: string, payload: FinalizarPayload): Promise<AuditoriaResumo>;

// Sugestão de IA para NC — best-effort, timeout 10s
getSugestaoIa(itemId: string, contexto: string): Promise<{ descricao: string; planoAcao: string }>;
```

---

## 8. Telas

### 8.1 Lista de Auditorias (`auditorias/index.tsx`)

- Pull-to-refresh chama `SyncService.sync()`
- Cards com: nome do estabelecimento, data, status badge, score quando concluída
- FAB "+" → `router.push('/(app)/auditorias/nova')`
- Filtros por status: Todas / Em andamento / Concluídas

### 8.2 Nova Auditoria — Step 1 (`auditorias/nova.tsx`)

- Busca clientes/unidades do SQLite (já sincronizados)
- SearchBar + FlatList de unidades
- Selecionar unidade → `router.push({ pathname: '/(app)/auditorias/nova-template', params: { unidadeId, clienteId } })`

### 8.3 Nova Auditoria — Step 2 (`auditorias/nova-template.tsx`)

Lê `unidadeId` e `clienteId` dos params. Filtra templates compatíveis com a atividade do cliente:

```sql
SELECT ct.*
FROM checklist_templates ct
JOIN clientes c ON ct.tipo_atividade = c.tipo_atividade
JOIN unidades u ON u.cliente_id = c.id
WHERE u.id = ?
  AND ct.status = 'ativo'
ORDER BY ct.nome
```

Ao confirmar template:
1. Gera UUID local (`localId`)
2. Chama `AuditoriaRepo.create({ id: localId, clienteId, unidadeId, templateId, dataInicio: now })`
3. Cria `auditoria_itens` para cada `template_item` do template (resposta = `nao_avaliado`)
4. `router.replace({ pathname: '/(app)/auditorias/[id]/checklist', params: { id: localId } })`

### 8.4 Checklist (`auditorias/[id]/checklist.tsx`)

- `useEffect` chama `store.iniciar(id)` e seta `isLoading = true` até concluir
- Enquanto `isLoading`: `<ActivityIndicator color="#00B8A9" />`
- `SectionList` com `sections` derivado de `itensPorCategoria` (via `useMemo`)
- Cabeçalho de seção: nome da categoria + progresso (x/y respondidos na seção)
- `ChecklistProgress` no topo com progresso global
- Cada item: dot colorido (verde = conforme, vermelho = NC, cinza = pendente), texto, badge C/NC/—
- Toque → `router.push({ pathname: '/(app)/auditorias/[id]/item/[itemId]', params: { id, itemId: item.id } })`
- Botão "Finalizar" sempre habilitado; se houver pendentes: confirm dialog antes de prosseguir

### 8.5 Item (`auditorias/[id]/item/[itemId].tsx`)

Adapta UI conforme `template_item.tipo_resposta`:

| `tipo_resposta` | UI renderizada |
|---|---|
| `padrao` | Botões C / NC / N/A |
| `customizado` | Botões dinâmicos de `opcoes_resposta_config` com pontuação |
| `numero` | Input numérico com unidade (do `opcoes_resposta_config`) |
| `texto` | TextInput multilinha |

Campos comuns:
- Observação (opcional; obrigatória se `observacao_obrigatoria = true`)
- `FotoGrid` (disponível sempre; obrigatório se `foto_obrigatoria = true`)
- `ItemCamposNc`: aparecem quando `resposta = 'nao_conforme'`
  - Descrição NC (pré-preenchida pela IA se disponível; indicador de loading enquanto aguarda)
  - Plano de ação (idem)
- Botão "Salvar" → `store.salvarResposta(itemId, resposta)` → `router.back()`

**Integração IA:** Ao marcar `nao_conforme`, dispara `getSugestaoIa()` (timeout 10s, sem bloquear UI). Preenche os campos NC quando retornar, se ainda estiverem vazios.

### 8.6 Resumo (`auditorias/[id]/resumo.tsx`)

- Score geral com anel visual (pontuação / pontuação máxima)
- Breakdown por categoria (barra de progresso por seção)
- Lista de NCs com criticidade
- `analiseIa`: retornado por `finalizarAuditoria`; exibido quando pronto (sem polling — a chamada é feita ao entrar no resumo)
- Campo assinatura do responsável (nome textual, gravado em `auditorias.assinatura_nome`)
- Botão "Enviar Relatório": chama `pushAuditoria(id)`; se offline/falha, enfileira no `sync_queue` SQLite e exibe toast

---

## 9. Push Sync (`sync/push.ts`)

```typescript
async function pushAuditoria(localId: string): Promise<void> {
  // 1. Carrega auditoria + itens + fotos do SQLite
  // 2. POST /auditorias → recebe remoteId
  // 3. Para cada item: POST /auditorias/:remoteId/itens
  // 4. Para cada foto: POST /auditorias/:remoteId/itens/:itemId/fotos (multipart)
  // 5. POST /auditorias/:remoteId/finalizar → recebe resumo + pdf_url + analise_ia
  // 6. Marca tudo como sync_status='synced' no SQLite
  // 7. Salva analise_ia e pdf_url em auditorias
}

// Chamado por SyncService.sync() para processar fila pendente
async function pushPending(): Promise<void> {
  // SELECT * FROM sync_queue WHERE entity = 'auditoria'
  // Para cada entrada: tenta pushAuditoria(payload.localId)
  // Se ok: DELETE FROM sync_queue WHERE id = ?
  // Se falha: UPDATE sync_queue SET retries = retries + 1 WHERE id = ?
}
```

**Fila offline:** usa a tabela `sync_queue` **SQLite** existente. O `id` é gerado em TypeScript com `crypto.randomUUID()` (não usar `uuid()` — função inexistente no SQLite). Ao falhar:

```typescript
db.runSync(
  `INSERT INTO sync_queue (id, entity, operation, payload, created_at)
   VALUES (?, 'auditoria', 'push', ?, datetime('now'))`,
  [crypto.randomUUID(), JSON.stringify({ localId })]
);
```

**Nota sobre `SyncQueue.ts` (MMKV):** a classe MMKV `SyncQueue` existente em `src/sync/SyncQueue.ts` **não é usada** para auditorias. Todo enfileiramento offline de auditorias usa a tabela SQLite `sync_queue` diretamente. A relação entre os dois mecanismos é de coexistência temporária — o SQLite `sync_queue` é o padrão going forward.

`SyncService.sync()` chama `pushPending()` a cada ciclo.

---

## 10. Pull Sync (`sync/pull.ts` — `pullAuditorias`)

Busca auditorias criadas em outros dispositivos (ex: GESTOR delegando no web):

```typescript
async function pullAuditorias(): Promise<void> {
  // GET /auditorias?updatedSince=<last_synced>&status=rascunho,em_andamento
  // Para cada auditoria: INSERT OR REPLACE auditorias
  // Para cada item: INSERT OR IGNORE auditoria_itens (não sobrescreve pending)
}
```

Usar `INSERT OR IGNORE` (não `INSERT OR REPLACE`) para `auditoria_itens` com `sync_status='pending'` — protege respostas feitas offline.

Para a row de `auditorias`, proteger rows com dados locais pendentes:

```sql
INSERT INTO auditorias (...) VALUES (...)
ON CONFLICT(id) DO UPDATE SET
  status = excluded.status,
  ...
  WHERE auditorias.sync_status != 'pending'
```

Isso evita sobrescrever uma auditoria em andamento localmente com dados do servidor.

Chamada em `pullAll()` após `pullClientes()` e `pullTemplates()`.

---

## 11. Tratamento de Erros e Estados de Loading

| Cenário | Comportamento |
|---|---|
| `store.iniciar()` executando | `ActivityIndicator` no lugar do `SectionList` |
| `store.iniciar()` falha (DB corrompido) | Toast de erro + `router.back()` |
| Sem conexão ao enviar | Toast "Salvo localmente. Enviado quando houver conexão." + badge "Pendente sync" |
| Falha no upload de foto | Foto marcada `sync_status='error'`; ícone ⚠ na `FotoGrid`; retry automático |
| Falha na sugestão IA | Campos NC ficam editáveis sem sugestão; sem toast (best-effort) |
| Auditoria já enviada (409) | Marca como synced, atualiza `remote_id` |
| Erro genérico na finalização | Toast com mensagem; botão "Tentar novamente" |

---

## 12. Componentes Reutilizáveis

### `AuditoriaStatusBadge`
Props: `status: 'rascunho' | 'em_andamento' | 'concluida' | 'pending_sync'`
Cores: cinza / âmbar / verde / laranja

### `ItemRespostaButtons`
Props: `tipo: TipoResposta`, `opcoes?: OpcaoResposta[]`, `valorAtual: string | null`, `onSelect: (v: string, pts?: number) => void`

### `ItemCamposNc`
Props: `descricaoIa?: string`, `planoAcaoIa?: string`, `loadingIa: boolean`, `onChange: (d: string, p: string) => void`

### `FotoGrid`
Props: `fotos: Foto[]`, `onAdd: () => void`, `onRemove: (id: string) => void`, `obrigatoria: boolean`, `maxFotos?: number`

### `ChecklistProgress`
Props: `respondidos: number`, `total: number`
— Barra teal + texto "X/Y respondidos · Z%"

---

## 13. Decisões de Design

- **Não usar TanStack Query para checklist** — dados vêm do SQLite via Zustand; sem overhead de rede durante auditoria
- **Store não-persistido** — auditoria ativa em memória; retomada relê do SQLite via `iniciar()`
- **`itensPorCategoria` fora do store** — derivado via `useMemo` no componente; evita duplicação de estado
- **SQLite sync API** — repos usam métodos síncronos (`runSync`, `getAllSync`); chamados em `useEffect` ou fora do render
- **Schema migration v2** — `ALTER TABLE ADD COLUMN` seguro; não recria tabela
- **IA best-effort** — timeout 10s; falha silenciosa; nunca bloqueia o fluxo principal
- **Fotos em disco local** — `expo-file-system` salva em diretório permanente antes do upload; `file_path` no SQLite garante reenvio se upload falhar
- **sync_queue SQLite** — fila offline usa a tabela existente; não duplicar com MMKV
