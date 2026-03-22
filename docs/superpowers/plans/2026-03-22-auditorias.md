# Fase 2: Auditorias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete audit flow — create, answer items, add photos, finalize, sync to backend, and view summary with AI analysis.

**Architecture:** SQLite repositories for persistence, a non-persisted Zustand store for active audit session state, a push/pull sync system using the existing SQLite `sync_queue` table, and 6 Expo Router screens organized as a Stack nested inside the existing Tabs navigator.

**Tech Stack:** Expo SDK 52, Expo Router v4, expo-sqlite (sync API), Zustand, NativeWind v4, expo-image-picker, expo-file-system, @react-native-community/netinfo

**Spec:** `docs/superpowers/specs/2026-03-22-auditorias-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/mobile/src/db/schema.ts` | Modify | Bump SCHEMA_VERSION to 2, add SCHEMA_V2 migration SQL |
| `apps/mobile/src/db/migrations.ts` | Modify | Apply migration v2 in `runMigrations` |
| `apps/mobile/src/db/repositories/auditoria.repo.ts` | Create | CRUD for `auditorias` table |
| `apps/mobile/src/db/repositories/auditoria-item.repo.ts` | Create | CRUD for `auditoria_itens` table |
| `apps/mobile/src/db/repositories/foto.repo.ts` | Create | CRUD for `fotos` table |
| `apps/mobile/src/db/__tests__/auditoria.repo.test.ts` | Create | Tests for auditoria repo |
| `apps/mobile/src/db/__tests__/auditoria-item.repo.test.ts` | Create | Tests for auditoria-item repo |
| `apps/mobile/src/db/__tests__/foto.repo.test.ts` | Create | Tests for foto repo |
| `apps/mobile/src/store/auditoria.ts` | Create | Zustand store for active audit session |
| `apps/mobile/src/api/auditoria.api.ts` | Create | HTTP calls for auditorias |
| `apps/mobile/src/sync/push.ts` | Create | pushAuditoria + pushPending |
| `apps/mobile/src/sync/pull.ts` | Modify | Update pullTemplates (v2 columns) + add pullAuditorias |
| `apps/mobile/src/sync/SyncService.ts` | Modify | Call pushPending in sync() |
| `apps/mobile/src/sync/__tests__/push.test.ts` | Create | Tests for push sync |
| `apps/mobile/app/(app)/_layout.tsx` | Modify | Register child routes with `href: null` |
| `apps/mobile/app/(app)/auditorias/_layout.tsx` | Create | Stack navigator for auditorias group |
| `apps/mobile/app/(app)/auditorias/index.tsx` | Create | List screen (replaces auditorias.tsx stub) |
| `apps/mobile/app/(app)/auditorias/nova.tsx` | Create | Wizard step 1: select unidade |
| `apps/mobile/app/(app)/auditorias/nova-template.tsx` | Create | Wizard step 2: select template |
| `apps/mobile/app/(app)/auditorias/[id]/_layout.tsx` | Create | Stack for active audit screens |
| `apps/mobile/app/(app)/auditorias/[id]/checklist.tsx` | Create | Checklist grouped by category |
| `apps/mobile/app/(app)/auditorias/[id]/item/[itemId].tsx` | Create | Item response screen |
| `apps/mobile/app/(app)/auditorias/[id]/resumo.tsx` | Create | Summary and send |
| `apps/mobile/src/components/auditoria/AuditoriaStatusBadge.tsx` | Create | Status badge |
| `apps/mobile/src/components/auditoria/ChecklistProgress.tsx` | Create | Progress bar |
| `apps/mobile/src/components/auditoria/ItemRespostaButtons.tsx` | Create | Response buttons (all 4 types) |
| `apps/mobile/src/components/auditoria/ItemCamposNc.tsx` | Create | NC fields with AI pre-fill |
| `apps/mobile/src/components/auditoria/FotoGrid.tsx` | Create | Photo grid with add/remove |

---

## Task 1: Schema Migration v2

**Files:**
- Modify: `apps/mobile/src/db/schema.ts`
- Modify: `apps/mobile/src/db/migrations.ts`
- Modify: `apps/mobile/src/db/__tests__/migrations.test.ts`

- [ ] **Step 1: Add SCHEMA_V2 and bump version in `schema.ts`**

Add at the end of `schema.ts` (after `SCHEMA_V1` and the existing exports):

```typescript
export const SCHEMA_VERSION = 2;  // was 1 — update the existing export

export const SCHEMA_V2 = `
  ALTER TABLE template_itens ADD COLUMN categoria TEXT;
  ALTER TABLE template_itens ADD COLUMN tipo_resposta TEXT NOT NULL DEFAULT 'padrao';
  ALTER TABLE template_itens ADD COLUMN opcoes_resposta_config TEXT;
  ALTER TABLE template_itens ADD COLUMN foto_obrigatoria INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE template_itens ADD COLUMN observacao_obrigatoria INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE template_itens ADD COLUMN criticidade TEXT;
`;
```

> Note: Each `ALTER TABLE` must run as a separate `execSync` call — SQLite does not support multiple statements in one `execSync` call.

- [ ] **Step 2: Update `migrations.ts` to apply v2**

Replace the comment placeholder with the actual migration:

```typescript
if (currentVersion < 2) {
  // ALTER TABLE does not support multiple statements — run each separately
  for (const stmt of SCHEMA_V2.trim().split(';').map(s => s.trim()).filter(Boolean)) {
    db.execSync(stmt + ';');
  }
  setSchemaVersion(db, 2);
}
```

Add import: `import { SCHEMA_V1, SCHEMA_V2, SCHEMA_VERSION } from './schema';`

- [ ] **Step 3: Write failing test for v2 migration**

In `apps/mobile/src/db/__tests__/migrations.test.ts`, add after the existing tests:

```typescript
it('executes schema v2 on a v1 database', () => {
  mockDb.getFirstSync.mockReturnValue({ user_version: 1 });

  runMigrations(mockDb as any);

  expect(mockDb.execSync).toHaveBeenCalledWith(
    expect.stringContaining('ALTER TABLE template_itens ADD COLUMN categoria TEXT;')
  );
  expect(mockDb.execSync).toHaveBeenCalledWith(
    expect.stringContaining('PRAGMA user_version = 2')
  );
});

it('skips v2 when database is already at version 2', () => {
  mockDb.getFirstSync.mockReturnValue({ user_version: 2 });

  runMigrations(mockDb as any);

  expect(mockDb.withTransactionSync).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run tests — expect FAIL**

```bash
cd apps/mobile && npx jest src/db/__tests__/migrations.test.ts --no-coverage
```

Expected: FAIL (SCHEMA_V2 not exported yet / migration block not added)

- [ ] **Step 5: Run tests again after edits — expect PASS**

```bash
cd apps/mobile && npx jest src/db/__tests__/migrations.test.ts --no-coverage
```

Expected: 5 passing tests

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/db/schema.ts apps/mobile/src/db/migrations.ts apps/mobile/src/db/__tests__/migrations.test.ts
git commit -m "feat(db): add schema v2 migration for template_itens columns"
```

---

## Task 2: Auditoria Repository

**Files:**
- Create: `apps/mobile/src/db/repositories/auditoria.repo.ts`
- Create: `apps/mobile/src/db/__tests__/auditoria.repo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/db/__tests__/auditoria.repo.test.ts`:

```typescript
import { AuditoriaRepo } from '../repositories/auditoria.repo';
import { getDatabase } from '../client';

jest.mock('../client');

const mockDb = {
  runSync: jest.fn(),
  getFirstSync: jest.fn(),
  getAllSync: jest.fn(),
};

(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('AuditoriaRepo', () => {
  let repo: AuditoriaRepo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AuditoriaRepo();
  });

  it('create inserts row with status=rascunho and sync_status=pending', () => {
    repo.create({
      id: 'local-1',
      clienteId: 'c1',
      unidadeId: 'u1',
      templateId: 't1',
      dataInicio: '2026-03-22T10:00:00.000Z',
    });

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auditorias'),
      expect.arrayContaining(['local-1', 'local-1', 'c1', 'u1', 't1'])
    );
  });

  it('findAll returns mapped rows', () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'local-1', status: 'rascunho', sync_status: 'pending',
        razao_social: 'Cliente A', nome_unidade: 'Unidade 1',
        data_inicio: '2026-03-22T10:00:00.000Z', pontuacao_total: null },
    ]);

    const result = repo.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('local-1');
    expect(result[0].status).toBe('rascunho');
  });

  it('markSynced updates remote_id and sync_status', () => {
    repo.markSynced('local-1', 'remote-uuid');

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE auditorias'),
      expect.arrayContaining(['remote-uuid', 'synced', 'local-1'])
    );
  });

  it('setSyncStatus updates sync_status', () => {
    repo.setSyncStatus('local-1', 'error');

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE auditorias SET sync_status'),
      ['error', 'local-1']
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/mobile && npx jest src/db/__tests__/auditoria.repo.test.ts --no-coverage
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement `auditoria.repo.ts`**

Create `apps/mobile/src/db/repositories/auditoria.repo.ts`:

```typescript
import { getDatabase } from '../client';

export interface CreateAuditoriaInput {
  id: string;            // UUID — same value written to both id and local_id
  clienteId: string;
  unidadeId: string;
  templateId: string;
  dataInicio: string;    // ISO 8601
  latitudeInicio?: number;
  longitudeInicio?: number;
}

export interface AuditoriaListItem {
  id: string;
  status: string;
  syncStatus: string;
  clienteNome: string;
  unidadeNome: string;
  dataInicio: string | null;
  pontuacaoTotal: number | null;
}

export interface AuditoriaCompleta {
  id: string;
  remoteId: string | null;
  localId: string;
  status: string;
  syncStatus: string;
  clienteId: string;
  clienteNome: string;      // joined from clientes.razao_social
  unidadeId: string;
  unidadeNome: string;      // joined from unidades.nome
  templateId: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  pontuacaoTotal: number | null;
  resumoExecutivo: string | null;
  analiseIa: string | null;
  pdfUrl: string | null;
  assinaturaNome: string | null;
}

export type AuditoriaStatus = 'rascunho' | 'em_andamento' | 'concluida';
export type SyncStatus = 'pending' | 'synced' | 'error';

export class AuditoriaRepo {
  private get db() { return getDatabase(); }

  create(data: CreateAuditoriaInput): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO auditorias
       (id, remote_id, local_id, status, data_inicio,
        latitude_inicio, longitude_inicio,
        cliente_id, unidade_id, template_id,
        sync_status, updated_at)
       VALUES (?, NULL, ?, 'rascunho', ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [data.id, data.id, data.dataInicio,
       data.latitudeInicio ?? null, data.longitudeInicio ?? null,
       data.clienteId, data.unidadeId, data.templateId, now]
    );
  }

  findAll(): AuditoriaListItem[] {
    const rows = this.db.getAllSync<{
      id: string; status: string; sync_status: string;
      razao_social: string; nome_unidade: string;
      data_inicio: string | null; pontuacao_total: number | null;
    }>(
      `SELECT a.id, a.status, a.sync_status,
              c.razao_social, u.nome AS nome_unidade,
              a.data_inicio, a.pontuacao_total
       FROM auditorias a
       JOIN clientes c ON c.id = a.cliente_id
       JOIN unidades u ON u.id = a.unidade_id
       WHERE a.deleted_at IS NULL
       ORDER BY a.data_inicio DESC`
    );
    return rows.map(r => ({
      id: r.id,
      status: r.status,
      syncStatus: r.sync_status,
      clienteNome: r.razao_social,
      unidadeNome: r.nome_unidade,
      dataInicio: r.data_inicio,
      pontuacaoTotal: r.pontuacao_total,
    }));
  }

  findById(id: string): AuditoriaCompleta | null {
    const r = this.db.getFirstSync<{
      id: string; remote_id: string | null; local_id: string;
      status: string; sync_status: string;
      cliente_id: string; razao_social: string;
      unidade_id: string; nome_unidade: string; template_id: string | null;
      data_inicio: string | null; data_fim: string | null;
      pontuacao_total: number | null; resumo_executivo: string | null;
      analise_ia: string | null; pdf_url: string | null;
      assinatura_nome: string | null;
    }>(
      `SELECT a.*, c.razao_social, u.nome AS nome_unidade
       FROM auditorias a
       JOIN clientes c ON c.id = a.cliente_id
       JOIN unidades u ON u.id = a.unidade_id
       WHERE a.id = ?`,
      [id]
    );
    if (!r) return null;
    return {
      id: r.id, remoteId: r.remote_id, localId: r.local_id,
      status: r.status, syncStatus: r.sync_status,
      clienteId: r.cliente_id, clienteNome: r.razao_social,
      unidadeId: r.unidade_id, unidadeNome: r.nome_unidade,
      templateId: r.template_id,
      dataInicio: r.data_inicio, dataFim: r.data_fim,
      pontuacaoTotal: r.pontuacao_total, resumoExecutivo: r.resumo_executivo,
      analiseIa: r.analise_ia, pdfUrl: r.pdf_url, assinaturaNome: r.assinatura_nome,
    };
  }

  updateStatus(id: string, status: AuditoriaStatus): void {
    this.db.runSync(
      `UPDATE auditorias SET status = ?, updated_at = ? WHERE id = ?`,
      [status, new Date().toISOString(), id]
    );
  }

  updatePontuacao(id: string, pontuacao: number): void {
    this.db.runSync(
      `UPDATE auditorias SET pontuacao_total = ?, updated_at = ? WHERE id = ?`,
      [pontuacao, new Date().toISOString(), id]
    );
  }

  markSynced(id: string, remoteId: string): void {
    this.db.runSync(
      `UPDATE auditorias SET remote_id = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
      [remoteId, new Date().toISOString(), id]
    );
  }

  setSyncStatus(id: string, status: SyncStatus): void {
    this.db.runSync(
      `UPDATE auditorias SET sync_status = ?, updated_at = ? WHERE id = ?`,
      [status, new Date().toISOString(), id]
    );
  }

  updateAfterFinalize(id: string, data: { analiseIa?: string; pdfUrl?: string; resumoExecutivo?: string }): void {
    this.db.runSync(
      `UPDATE auditorias SET analise_ia = ?, pdf_url = ?, resumo_executivo = ?, updated_at = ? WHERE id = ?`,
      [data.analiseIa ?? null, data.pdfUrl ?? null, data.resumoExecutivo ?? null,
       new Date().toISOString(), id]
    );
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/mobile && npx jest src/db/__tests__/auditoria.repo.test.ts --no-coverage
```

Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/repositories/auditoria.repo.ts apps/mobile/src/db/__tests__/auditoria.repo.test.ts
git commit -m "feat(db): add AuditoriaRepo"
```

---

## Task 3: AuditoriaItem Repository

**Files:**
- Create: `apps/mobile/src/db/repositories/auditoria-item.repo.ts`
- Create: `apps/mobile/src/db/__tests__/auditoria-item.repo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/db/__tests__/auditoria-item.repo.test.ts`:

```typescript
import { AuditoriaItemRepo } from '../repositories/auditoria-item.repo';
import { getDatabase } from '../client';

jest.mock('../client');

const mockDb = { runSync: jest.fn(), getAllSync: jest.fn(), getFirstSync: jest.fn() };
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('AuditoriaItemRepo', () => {
  let repo: AuditoriaItemRepo;
  beforeEach(() => { jest.clearAllMocks(); repo = new AuditoriaItemRepo(); });

  it('bulkCreate inserts one row per template item', () => {
    repo.bulkCreate('audit-1', [
      { id: 'ti-1', descricao: 'Item 1', ordem: 1, categoria: 'Higiene',
        tipoResposta: 'padrao', fotoObrigatoria: false,
        observacaoObrigatoria: false, pontuacaoMaxima: 10 },
      { id: 'ti-2', descricao: 'Item 2', ordem: 2, categoria: 'Higiene',
        tipoResposta: 'padrao', fotoObrigatoria: false,
        observacaoObrigatoria: false, pontuacaoMaxima: 5 },
    ]);

    expect(mockDb.runSync).toHaveBeenCalledTimes(2);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auditoria_itens'),
      expect.arrayContaining(['audit-1', 'ti-1'])
    );
  });

  it('upsertResposta updates the item row', () => {
    repo.upsertResposta('item-1', {
      resposta: 'conforme',
      observacao: 'Ok',
      pontuacao: 10,
    });

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE auditoria_itens'),
      expect.arrayContaining(['conforme', 'Ok', 10, 'item-1'])
    );
  });

  it('findByAuditoria returns all items with template info joined', () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'item-1', auditoria_id: 'audit-1', template_item_id: 'ti-1',
        resposta: 'nao_avaliado', observacao: null,
        descricao_nao_conformidade: null, plano_acao_final: null,
        pontuacao: 0, sync_status: 'pending',
        descricao: 'Item 1', ordem: 1, categoria: 'Higiene',
        tipo_resposta: 'padrao', opcoes_resposta_config: null,
        foto_obrigatoria: 0, observacao_obrigatoria: 0,
        criticidade: null, pontuacao_maxima: 10,
        descricao_ia: null, plano_acao_sugerido: null },
    ]);

    const items = repo.findByAuditoria('audit-1');

    expect(items).toHaveLength(1);
    expect(items[0].descricao).toBe('Item 1');
    expect(items[0].tipoResposta).toBe('padrao');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/mobile && npx jest src/db/__tests__/auditoria-item.repo.test.ts --no-coverage
```

- [ ] **Step 3: Implement `auditoria-item.repo.ts`**

Create `apps/mobile/src/db/repositories/auditoria-item.repo.ts`:

```typescript
import { getDatabase } from '../client';

export interface TemplateItemRow {
  id: string;
  descricao: string;
  ordem: number;
  categoria: string | null;
  tipoResposta: string;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
  pontuacaoMaxima: number;
  opcoesRespostaConfig?: string | null;
  criticidade?: string | null;
}

export interface RespostaInput {
  resposta: string;
  observacao?: string;
  descricaoNaoConformidade?: string;
  planoAcaoFinal?: string;
  pontuacao?: number;
  descricaoIa?: string;
  planoAcaoSugerido?: string;
}

export interface AuditoriaItemCompleto {
  id: string;
  auditoriaId: string;
  templateItemId: string;
  resposta: string;
  observacao: string | null;
  descricaoNaoConformidade: string | null;
  planoAcaoFinal: string | null;
  descricaoIa: string | null;
  planoAcaoSugerido: string | null;
  pontuacao: number;
  syncStatus: string;
  // campos do template_item
  descricao: string;
  ordem: number;
  categoria: string | null;
  tipoResposta: string;
  opcoesRespostaConfig: string | null;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
  criticidade: string | null;
  pontuacaoMaxima: number;
}

export class AuditoriaItemRepo {
  private get db() { return getDatabase(); }

  bulkCreate(auditoriaId: string, templateItens: TemplateItemRow[]): void {
    const now = new Date().toISOString();
    for (const ti of templateItens) {
      const id = crypto.randomUUID();
      this.db.runSync(
        `INSERT INTO auditoria_itens
         (id, auditoria_id, template_item_id, resposta, pontuacao, sync_status, updated_at)
         VALUES (?, ?, ?, 'nao_avaliado', 0, 'pending', ?)`,
        [id, auditoriaId, ti.id, now]
      );
    }
  }

  upsertResposta(itemId: string, r: RespostaInput): void {
    this.db.runSync(
      `UPDATE auditoria_itens SET
         resposta = ?,
         observacao = ?,
         descricao_nao_conformidade = ?,
         plano_acao_final = ?,
         pontuacao = ?,
         descricao_ia = ?,
         plano_acao_sugerido = ?,
         sync_status = 'pending',
         updated_at = ?
       WHERE id = ?`,
      [r.resposta, r.observacao ?? null, r.descricaoNaoConformidade ?? null,
       r.planoAcaoFinal ?? null, r.pontuacao ?? 0,
       r.descricaoIa ?? null, r.planoAcaoSugerido ?? null,
       new Date().toISOString(), itemId]
    );
  }

  findByAuditoria(auditoriaId: string): AuditoriaItemCompleto[] {
    const rows = this.db.getAllSync<{
      id: string; auditoria_id: string; template_item_id: string;
      resposta: string; observacao: string | null;
      descricao_nao_conformidade: string | null; plano_acao_final: string | null;
      descricao_ia: string | null; plano_acao_sugerido: string | null;
      pontuacao: number; sync_status: string;
      descricao: string; ordem: number; categoria: string | null;
      tipo_resposta: string; opcoes_resposta_config: string | null;
      foto_obrigatoria: number; observacao_obrigatoria: number;
      criticidade: string | null; pontuacao_maxima: number;
    }>(
      `SELECT ai.*, ti.descricao, ti.ordem, ti.categoria,
              ti.tipo_resposta, ti.opcoes_resposta_config,
              ti.foto_obrigatoria, ti.observacao_obrigatoria,
              ti.criticidade, ti.pontuacao_maxima
       FROM auditoria_itens ai
       JOIN template_itens ti ON ti.id = ai.template_item_id
       WHERE ai.auditoria_id = ?
       ORDER BY ti.categoria, ti.ordem`,
      [auditoriaId]
    );
    return rows.map(r => ({
      id: r.id, auditoriaId: r.auditoria_id, templateItemId: r.template_item_id,
      resposta: r.resposta, observacao: r.observacao,
      descricaoNaoConformidade: r.descricao_nao_conformidade,
      planoAcaoFinal: r.plano_acao_final,
      descricaoIa: r.descricao_ia, planoAcaoSugerido: r.plano_acao_sugerido,
      pontuacao: r.pontuacao, syncStatus: r.sync_status,
      descricao: r.descricao, ordem: r.ordem, categoria: r.categoria,
      tipoResposta: r.tipo_resposta, opcoesRespostaConfig: r.opcoes_resposta_config,
      fotoObrigatoria: r.foto_obrigatoria === 1,
      observacaoObrigatoria: r.observacao_obrigatoria === 1,
      criticidade: r.criticidade, pontuacaoMaxima: r.pontuacao_maxima,
    }));
  }

  findById(id: string): AuditoriaItemCompleto | null {
    const r = this.db.getFirstSync<{
      id: string; auditoria_id: string; template_item_id: string;
      resposta: string; observacao: string | null;
      descricao_nao_conformidade: string | null; plano_acao_final: string | null;
      descricao_ia: string | null; plano_acao_sugerido: string | null;
      pontuacao: number; sync_status: string;
      descricao: string; ordem: number; categoria: string | null;
      tipo_resposta: string; opcoes_resposta_config: string | null;
      foto_obrigatoria: number; observacao_obrigatoria: number;
      criticidade: string | null; pontuacao_maxima: number;
    }>(
      `SELECT ai.*, ti.descricao, ti.ordem, ti.categoria,
              ti.tipo_resposta, ti.opcoes_resposta_config,
              ti.foto_obrigatoria, ti.observacao_obrigatoria,
              ti.criticidade, ti.pontuacao_maxima
       FROM auditoria_itens ai
       JOIN template_itens ti ON ti.id = ai.template_item_id
       WHERE ai.id = ?`,
      [id]
    );
    if (!r) return null;
    return {
      id: r.id, auditoriaId: r.auditoria_id, templateItemId: r.template_item_id,
      resposta: r.resposta, observacao: r.observacao,
      descricaoNaoConformidade: r.descricao_nao_conformidade,
      planoAcaoFinal: r.plano_acao_final,
      descricaoIa: r.descricao_ia, planoAcaoSugerido: r.plano_acao_sugerido,
      pontuacao: r.pontuacao, syncStatus: r.sync_status,
      descricao: r.descricao, ordem: r.ordem, categoria: r.categoria,
      tipoResposta: r.tipo_resposta, opcoesRespostaConfig: r.opcoes_resposta_config,
      fotoObrigatoria: r.foto_obrigatoria === 1,
      observacaoObrigatoria: r.observacao_obrigatoria === 1,
      criticidade: r.criticidade, pontuacaoMaxima: r.pontuacao_maxima,
    };
  }
}
```

> Note: The `findByAuditoria('')` call in `findById` is a copy-paste error in the plan — the implementation shows the correct direct query using `getFirstSync`. Remove the stray `findByAuditoria` line.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/mobile && npx jest src/db/__tests__/auditoria-item.repo.test.ts --no-coverage
```

Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/repositories/auditoria-item.repo.ts apps/mobile/src/db/__tests__/auditoria-item.repo.test.ts
git commit -m "feat(db): add AuditoriaItemRepo"
```

---

## Task 4: Foto Repository

**Files:**
- Create: `apps/mobile/src/db/repositories/foto.repo.ts`
- Create: `apps/mobile/src/db/__tests__/foto.repo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/db/__tests__/foto.repo.test.ts`:

```typescript
import { FotoRepo } from '../repositories/foto.repo';
import { getDatabase } from '../client';

jest.mock('../client');

const mockDb = { runSync: jest.fn(), getAllSync: jest.fn() };
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('FotoRepo', () => {
  let repo: FotoRepo;
  beforeEach(() => { jest.clearAllMocks(); repo = new FotoRepo(); });

  it('add inserts a foto row and returns the generated id', () => {
    const id = repo.add('item-1', '/path/to/foto.jpg');
    expect(id).toBeTruthy();
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO fotos'),
      expect.arrayContaining(['item-1', '/path/to/foto.jpg'])
    );
  });

  it('findByItem returns photos for the given item', () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'f1', auditoria_item_id: 'item-1', file_path: '/path.jpg',
        url: null, sync_status: 'pending', latitude: null, longitude: null },
    ]);

    const fotos = repo.findByItem('item-1');
    expect(fotos).toHaveLength(1);
    expect(fotos[0].filePath).toBe('/path.jpg');
  });

  it('markSynced updates remote_id, url and sync_status', () => {
    repo.markSynced('f1', 'remote-f1', 'https://cdn.example.com/f1.jpg');
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fotos'),
      expect.arrayContaining(['remote-f1', 'https://cdn.example.com/f1.jpg', 'synced', 'f1'])
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/mobile && npx jest src/db/__tests__/foto.repo.test.ts --no-coverage
```

- [ ] **Step 3: Implement `foto.repo.ts`**

Create `apps/mobile/src/db/repositories/foto.repo.ts`:

```typescript
import { getDatabase } from '../client';

export interface Foto {
  id: string;
  auditoriaItemId: string;
  filePath: string | null;
  url: string | null;
  syncStatus: string;
  latitude: number | null;
  longitude: number | null;
}

export interface LatLng { latitude: number; longitude: number; }

export class FotoRepo {
  private get db() { return getDatabase(); }

  add(itemId: string, filePath: string, coords?: LatLng): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO fotos (id, auditoria_item_id, file_path, latitude, longitude, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, itemId, filePath, coords?.latitude ?? null, coords?.longitude ?? null, now]
    );
    return id;
  }

  findByItem(itemId: string): Foto[] {
    const rows = this.db.getAllSync<{
      id: string; auditoria_item_id: string; file_path: string | null;
      url: string | null; sync_status: string;
      latitude: number | null; longitude: number | null;
    }>('SELECT * FROM fotos WHERE auditoria_item_id = ?', [itemId]);
    return rows.map(r => ({
      id: r.id, auditoriaItemId: r.auditoria_item_id,
      filePath: r.file_path, url: r.url, syncStatus: r.sync_status,
      latitude: r.latitude, longitude: r.longitude,
    }));
  }

  findByAuditoria(auditoriaId: string): Foto[] {
    const rows = this.db.getAllSync<{
      id: string; auditoria_item_id: string; file_path: string | null;
      url: string | null; sync_status: string;
      latitude: number | null; longitude: number | null;
    }>(
      `SELECT f.* FROM fotos f
       JOIN auditoria_itens ai ON ai.id = f.auditoria_item_id
       WHERE ai.auditoria_id = ?`,
      [auditoriaId]
    );
    return rows.map(r => ({
      id: r.id, auditoriaItemId: r.auditoria_item_id,
      filePath: r.file_path, url: r.url, syncStatus: r.sync_status,
      latitude: r.latitude, longitude: r.longitude,
    }));
  }

  remove(id: string): void {
    this.db.runSync('DELETE FROM fotos WHERE id = ?', [id]);
  }

  markSynced(id: string, remoteId: string, url: string): void {
    this.db.runSync(
      `UPDATE fotos SET remote_id = ?, url = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
      [remoteId, url, new Date().toISOString(), id]
    );
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/mobile && npx jest src/db/__tests__/foto.repo.test.ts --no-coverage
```

Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/db/repositories/foto.repo.ts apps/mobile/src/db/__tests__/foto.repo.test.ts
git commit -m "feat(db): add FotoRepo"
```

---

## Task 5: Zustand Store (Auditoria Session)

**Files:**
- Create: `apps/mobile/src/store/auditoria.ts`

No unit test for the store — behavior is validated through integration with screens. The store is thin wiring between repos and components.

- [ ] **Step 1: Create `store/auditoria.ts`**

```typescript
import { create } from 'zustand';
import { AuditoriaRepo, type AuditoriaCompleta } from '../db/repositories/auditoria.repo';
import { AuditoriaItemRepo, type AuditoriaItemCompleto, type RespostaInput } from '../db/repositories/auditoria-item.repo';

interface AuditoriaStore {
  auditoria: AuditoriaCompleta | null;
  itens: AuditoriaItemCompleto[];
  isLoading: boolean;
  error: string | null;

  iniciar(auditoriaId: string): void;
  salvarResposta(itemId: string, resposta: RespostaInput): void;
  finalizar(): void;
  limpar(): void;
}

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();

export const useAuditoriaStore = create<AuditoriaStore>((set, get) => ({
  auditoria: null,
  itens: [],
  isLoading: false,
  error: null,

  iniciar(auditoriaId) {
    set({ isLoading: true, error: null });
    try {
      const auditoria = auditoriaRepo.findById(auditoriaId);
      if (!auditoria) {
        set({ isLoading: false, error: 'Auditoria não encontrada.' });
        return;
      }
      const itens = itemRepo.findByAuditoria(auditoriaId);
      auditoriaRepo.updateStatus(auditoriaId, 'em_andamento');
      set({ auditoria: { ...auditoria, status: 'em_andamento' }, itens, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Erro ao carregar auditoria.' });
    }
  },

  salvarResposta(itemId, resposta) {
    itemRepo.upsertResposta(itemId, resposta);
    set(state => ({
      itens: state.itens.map(i =>
        i.id === itemId
          ? { ...i, resposta: resposta.resposta,
              observacao: resposta.observacao ?? null,
              descricaoNaoConformidade: resposta.descricaoNaoConformidade ?? null,
              planoAcaoFinal: resposta.planoAcaoFinal ?? null,
              pontuacao: resposta.pontuacao ?? 0 }
          : i
      ),
    }));
  },

  finalizar() {
    const { auditoria, itens } = get();
    if (!auditoria) return;
    const pontuacao = itens.reduce((sum, i) => sum + i.pontuacao, 0);
    auditoriaRepo.updateStatus(auditoria.id, 'concluida');
    auditoriaRepo.updatePontuacao(auditoria.id, pontuacao);
    set(state => ({
      auditoria: state.auditoria
        ? { ...state.auditoria, status: 'concluida', pontuacaoTotal: pontuacao }
        : null,
    }));
  },

  limpar() {
    set({ auditoria: null, itens: [], isLoading: false, error: null });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/store/auditoria.ts
git commit -m "feat(store): add useAuditoriaStore for active audit session"
```

---

## Task 6: API Layer

**Files:**
- Create: `apps/mobile/src/api/auditoria.api.ts`

- [ ] **Step 1: Create `api/auditoria.api.ts`**

```typescript
import { apiGet, apiPost } from './client';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export interface CreateAuditoriaPayload {
  localId: string;
  clienteId: string;
  unidadeId: string;
  templateId: string;
  dataInicio: string;
  latitudeInicio?: number;
  longitudeInicio?: number;
}

export interface ItemPayload {
  localId: string;
  templateItemId: string;
  resposta: string;
  observacao?: string;
  descricaoNaoConformidade?: string;
  planoAcaoFinal?: string;
  pontuacao: number;
}

export interface FinalizarPayload {
  dataFim: string;
  latitudeFim?: number;
  longitudeFim?: number;
  assinaturaNome?: string;
}

export interface AuditoriaResumo {
  remoteId: string;
  analiseIa: string | null;
  resumoExecutivo: string | null;
  pdfUrl: string | null;
  pontuacaoTotal: number;
}

export async function createAuditoria(payload: CreateAuditoriaPayload): Promise<{ id: string }> {
  return apiPost<{ id: string }>('/auditorias', payload);
}

export async function submitItem(auditoriaRemoteId: string, item: ItemPayload): Promise<void> {
  return apiPost<void>(`/auditorias/${auditoriaRemoteId}/itens`, item);
}

export async function uploadFoto(
  auditoriaRemoteId: string,
  itemRemoteId: string,
  filePath: string
): Promise<{ id: string; url: string }> {
  const token = await SecureStore.getItemAsync('auth_token');
  const result = await FileSystem.uploadAsync(
    `${API_URL}/auditorias/${auditoriaRemoteId}/itens/${itemRemoteId}/fotos`,
    filePath,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'foto',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (result.status >= 400) {
    throw new Error('Falha no upload da foto.');
  }
  const json = JSON.parse(result.body) as { data: { id: string; url: string } };
  return json.data;
}

export async function finalizarAuditoria(
  auditoriaRemoteId: string,
  payload: FinalizarPayload
): Promise<AuditoriaResumo> {
  return apiPost<AuditoriaResumo>(`/auditorias/${auditoriaRemoteId}/finalizar`, payload);
}

export async function getSugestaoIa(
  itemId: string,
  contexto: string
): Promise<{ descricao: string; planoAcao: string }> {
  // apiPost does not accept AbortSignal — enforce timeout via Promise.race
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 10_000)
  );
  return Promise.race([
    apiPost<{ descricao: string; planoAcao: string }>(
      `/auditorias/ia/sugestao-nc`,
      { itemId, contexto }
    ),
    timeout,
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/api/auditoria.api.ts
git commit -m "feat(api): add auditoria API layer"
```

---

## Task 7: Push Sync

**Files:**
- Create: `apps/mobile/src/sync/push.ts`
- Create: `apps/mobile/src/sync/__tests__/push.test.ts`
- Modify: `apps/mobile/src/sync/SyncService.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/sync/__tests__/push.test.ts`:

```typescript
import { pushPending } from '../push';
import { getDatabase } from '../../db/client';

jest.mock('../../db/client');
jest.mock('../../api/auditoria.api');
jest.mock('../../db/repositories/auditoria.repo');
jest.mock('../../db/repositories/auditoria-item.repo');
jest.mock('../../db/repositories/foto.repo');

const mockDb = {
  getAllSync: jest.fn(),
  runSync: jest.fn(),
};
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('pushPending', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when sync_queue is empty', async () => {
    mockDb.getAllSync.mockReturnValue([]);
    await pushPending();
    expect(mockDb.runSync).not.toHaveBeenCalled();
  });

  it('increments retries on failure', async () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'q1', entity: 'auditoria', operation: 'push',
        payload: JSON.stringify({ localId: 'local-1' }), retries: 0 },
    ]);

    // AuditoriaRepo.findById returns null → will throw
    const { AuditoriaRepo } = require('../../db/repositories/auditoria.repo');
    AuditoriaRepo.mockImplementation(() => ({
      findById: jest.fn().mockReturnValue(null),
    }));

    await pushPending();

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_queue SET retries'),
      expect.arrayContaining(['q1'])
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/mobile && npx jest src/sync/__tests__/push.test.ts --no-coverage
```

- [ ] **Step 3: Implement `push.ts`**

Create `apps/mobile/src/sync/push.ts`:

```typescript
import { getDatabase } from '../db/client';
import { AuditoriaRepo } from '../db/repositories/auditoria.repo';
import { AuditoriaItemRepo } from '../db/repositories/auditoria-item.repo';
import { FotoRepo } from '../db/repositories/foto.repo';
import {
  createAuditoria, submitItem, uploadFoto, finalizarAuditoria,
} from '../api/auditoria.api';

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();
const fotoRepo = new FotoRepo();

export async function pushAuditoria(localId: string): Promise<void> {
  const auditoria = auditoriaRepo.findById(localId);
  if (!auditoria) throw new Error(`Auditoria ${localId} não encontrada.`);

  // 1. Create on backend
  const { id: remoteId } = await createAuditoria({
    localId: auditoria.localId,
    clienteId: auditoria.clienteId,
    unidadeId: auditoria.unidadeId,
    templateId: auditoria.templateId!,
    dataInicio: auditoria.dataInicio!,
  });

  // 2. Submit items
  const itens = itemRepo.findByAuditoria(localId);
  for (const item of itens) {
    await submitItem(remoteId, {
      localId: item.id,
      templateItemId: item.templateItemId,
      resposta: item.resposta,
      observacao: item.observacao ?? undefined,
      descricaoNaoConformidade: item.descricaoNaoConformidade ?? undefined,
      planoAcaoFinal: item.planoAcaoFinal ?? undefined,
      pontuacao: item.pontuacao,
    });

    // 3. Upload fotos for this item
    const fotos = fotoRepo.findByItem(item.id);
    for (const foto of fotos) {
      if (!foto.filePath) continue;
      try {
        const { id: fotoRemoteId, url } = await uploadFoto(remoteId, item.id, foto.filePath);
        fotoRepo.markSynced(foto.id, fotoRemoteId, url);
      } catch {
        fotoRepo.markSynced(foto.id, '', ''); // mark as attempted; URL empty signals error
      }
    }
  }

  // 4. Finalize
  const resumo = await finalizarAuditoria(remoteId, {
    dataFim: new Date().toISOString(),
  });

  // 5. Mark synced
  auditoriaRepo.markSynced(localId, remoteId);
  auditoriaRepo.updateAfterFinalize(localId, {
    analiseIa: resumo.analiseIa ?? undefined,
    pdfUrl: resumo.pdfUrl ?? undefined,
    resumoExecutivo: resumo.resumoExecutivo ?? undefined,
  });
}

export async function pushPending(): Promise<void> {
  const db = getDatabase();
  const items = db.getAllSync<{ id: string; payload: string; retries: number }>(
    `SELECT id, payload, retries FROM sync_queue WHERE entity = 'auditoria' ORDER BY created_at`
  );

  for (const item of items) {
    try {
      const { localId } = JSON.parse(item.payload) as { localId: string };
      await pushAuditoria(localId);
      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
    } catch {
      db.runSync(
        'UPDATE sync_queue SET retries = retries + 1 WHERE id = ?',
        [item.id]
      );
    }
  }
}

export function enqueuePush(localId: string): void {
  const db = getDatabase();
  db.runSync(
    `INSERT INTO sync_queue (id, entity, operation, payload, retries, created_at)
     VALUES (?, 'auditoria', 'push', ?, 0, datetime('now'))`,
    [crypto.randomUUID(), JSON.stringify({ localId })]
  );
}
```

- [ ] **Step 4: Update `SyncService.ts`**

Add `pushPending` import and call it in `sync()`:

```typescript
import { pullAll } from './pull';
import { pushPending } from './push';

// Inside sync():
    try {
      await pushPending();   // push before pull to avoid conflicts
      await pullAll();
    } catch (error) {
```

- [ ] **Step 5: Run push tests — expect PASS**

```bash
cd apps/mobile && npx jest src/sync/__tests__/push.test.ts --no-coverage
```

Expected: 2 passing

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/sync/push.ts apps/mobile/src/sync/__tests__/push.test.ts apps/mobile/src/sync/SyncService.ts
git commit -m "feat(sync): add pushAuditoria, pushPending, enqueuePush"
```

---

## Task 8: Update Pull Sync

**Files:**
- Modify: `apps/mobile/src/sync/pull.ts`

- [ ] **Step 1: Update `pullTemplates` to include v2 columns**

In `pull.ts`, replace the `INSERT OR REPLACE INTO template_itens` statement inside `pullTemplates()`:

```typescript
// Replace the template_itens INSERT with:
db.runSync(
  `INSERT OR REPLACE INTO template_itens
   (id, remote_id, template_id, descricao, ordem, referencia_legal, pontuacao_maxima,
    categoria, tipo_resposta, opcoes_resposta_config,
    foto_obrigatoria, observacao_obrigatoria, criticidade,
    sync_status, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
  [item.id, item.id, t.id, item.descricao, item.ordem,
   item.referenciaLegal ?? null, item.pontuacaoMaxima,
   (item as any).categoria ?? null,
   (item as any).tipoResposta ?? 'padrao',
   (item as any).opcoesRespostaConfig ? JSON.stringify((item as any).opcoesRespostaConfig) : null,
   (item as any).fotoObrigatoria ? 1 : 0,
   (item as any).observacaoObrigatoria ? 1 : 0,
   (item as any).criticidade ?? null,
   now]
);
```

- [ ] **Step 2: Add `pullAuditorias()` function**

Add after `pullTemplates()`:

```typescript
export async function pullAuditorias(): Promise<void> {
  const db = getDatabase();
  const since = getLastSyncedAt(db, 'auditorias');
  const auditorias = await apiGet<Array<{
    id: string; localId?: string; status: string;
    dataInicio?: string; dataFim?: string;
    clienteId: string; unidadeId: string; templateId?: string;
    pontuacaoTotal?: number; itens?: Array<{
      id: string; templateItemId: string; resposta: string;
      observacao?: string; descricaoNaoConformidade?: string;
      planoAcaoFinal?: string; pontuacao: number;
    }>;
  }>>(`/auditorias?updatedSince=${since}&status=rascunho,em_andamento`);

  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    for (const a of auditorias) {
      const localId = a.localId ?? a.id;
      // Only update if not pending local changes
      db.runSync(
        `INSERT INTO auditorias
           (id, remote_id, local_id, status, data_inicio, data_fim,
            cliente_id, unidade_id, template_id, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           data_inicio = excluded.data_inicio,
           data_fim = excluded.data_fim,
           remote_id = excluded.remote_id,
           sync_status = 'synced',
           updated_at = excluded.updated_at
         WHERE auditorias.sync_status != 'pending'`,
        [localId, a.id, localId, a.status, a.dataInicio ?? null, a.dataFim ?? null,
         a.clienteId, a.unidadeId, a.templateId ?? null, now]
      );

      for (const item of a.itens ?? []) {
        // INSERT OR IGNORE: never overwrite local pending answers
        db.runSync(
          `INSERT OR IGNORE INTO auditoria_itens
           (id, auditoria_id, template_item_id, resposta, pontuacao, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, 'synced', ?)`,
          [item.id, localId, item.templateItemId, item.resposta, item.pontuacao, now]
        );
      }
    }
  });

  setLastSyncedAt(db, 'auditorias', now);
}
```

- [ ] **Step 3: Add `pullAuditorias` to `pullAll()`**

```typescript
export async function pullAll(): Promise<void> {
  await pullClientes();
  await pullTemplates();
  await pullAuditorias();
}
```

- [ ] **Step 4: Run full test suite to confirm no regression**

```bash
cd apps/mobile && npx jest --no-coverage
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/sync/pull.ts
git commit -m "feat(sync): update pullTemplates for v2 columns + add pullAuditorias"
```

---

## Task 9: Navigation Shell

**Files:**
- Modify: `apps/mobile/app/(app)/_layout.tsx`
- Delete: `apps/mobile/app/(app)/auditorias.tsx` (replace with folder)
- Create: `apps/mobile/app/(app)/auditorias/_layout.tsx`
- Create: `apps/mobile/app/(app)/auditorias/[id]/_layout.tsx`

- [ ] **Step 1: Add `href: null` entries for child routes in `(app)/_layout.tsx`**

Inside the `<Tabs>` component, add after the existing `<Tabs.Screen name="onboarding">` entry:

```tsx
<Tabs.Screen name="auditorias/nova" options={{ href: null }} />
<Tabs.Screen name="auditorias/nova-template" options={{ href: null }} />
<Tabs.Screen name="auditorias/[id]" options={{ href: null }} />
```

Also update the existing `<Tabs.Screen name="auditorias">` entry to point at the folder index (no change needed — Expo Router resolves it automatically when the folder has `index.tsx`).

- [ ] **Step 2: Delete the stub `auditorias.tsx`**

```bash
rm apps/mobile/app/(app)/auditorias.tsx
```

- [ ] **Step 3: Create `auditorias/_layout.tsx`**

Create `apps/mobile/app/(app)/auditorias/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AuditoriasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="nova"
        options={{ headerShown: true, title: 'Nova Auditoria', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="nova-template"
        options={{ headerShown: true, title: 'Selecionar Template', headerBackTitle: '' }}
      />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
```

- [ ] **Step 4: Create `auditorias/[id]/_layout.tsx`**

Create `apps/mobile/app/(app)/auditorias/[id]/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function AuditoriaDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="checklist" />
      <Stack.Screen name="item/[itemId]" />
      <Stack.Screen name="resumo" />
    </Stack>
  );
}
```

- [ ] **Step 5: Verify build (no TypeScript errors)**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(app)/_layout.tsx apps/mobile/app/(app)/auditorias/
git rm apps/mobile/app/(app)/auditorias.tsx 2>/dev/null || true
git commit -m "feat(nav): set up auditorias Stack nested inside Tabs"
```

---

## Task 10: Reusable Components

**Files:**
- Create: `apps/mobile/src/components/auditoria/AuditoriaStatusBadge.tsx`
- Create: `apps/mobile/src/components/auditoria/ChecklistProgress.tsx`
- Create: `apps/mobile/src/components/auditoria/ItemRespostaButtons.tsx`
- Create: `apps/mobile/src/components/auditoria/ItemCamposNc.tsx`
- Create: `apps/mobile/src/components/auditoria/FotoGrid.tsx`

- [ ] **Step 1: Create `AuditoriaStatusBadge.tsx`**

```tsx
import { View, Text } from 'react-native';

type Status = 'rascunho' | 'em_andamento' | 'concluida' | 'pending_sync';

const CONFIG: Record<Status, { label: string; bg: string; text: string }> = {
  rascunho:     { label: 'Rascunho',      bg: 'bg-gray-100',   text: 'text-gray-600' },
  em_andamento: { label: 'Em andamento',  bg: 'bg-amber-100',  text: 'text-amber-700' },
  concluida:    { label: 'Concluída',     bg: 'bg-green-100',  text: 'text-green-700' },
  pending_sync: { label: 'Pendente sync', bg: 'bg-orange-100', text: 'text-orange-700' },
};

export function AuditoriaStatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status as Status] ?? CONFIG.rascunho;
  return (
    <View className={`px-2 py-0.5 rounded-full ${cfg.bg}`}>
      <Text className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Create `ChecklistProgress.tsx`**

```tsx
import { View, Text } from 'react-native';

interface Props { respondidos: number; total: number; }

export function ChecklistProgress({ respondidos, total }: Props) {
  const pct = total === 0 ? 0 : Math.round((respondidos / total) * 100);
  return (
    <View className="px-4 py-2 bg-white border-b border-gray-100">
      <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
        <View className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </View>
      <Text className="text-xs text-gray-500">
        {respondidos}/{total} respondidos · {pct}%
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Create `ItemRespostaButtons.tsx`**

```tsx
import { View, Text, TouchableOpacity, TextInput } from 'react-native';

interface OpcaoCustomizada {
  label: string;
  pontuacao: number;
  fotoObrigatoria?: boolean;
}

interface Props {
  tipo: 'padrao' | 'customizado' | 'numero' | 'texto';
  opcoes?: OpcaoCustomizada[];
  valorAtual: string | null;
  unidade?: string;           // for tipo='numero'
  onSelect: (valor: string, pontuacao?: number) => void;
  onTextChange?: (text: string) => void;  // for tipo='texto' and 'numero'
}

export function ItemRespostaButtons({ tipo, opcoes, valorAtual, unidade, onSelect, onTextChange }: Props) {
  if (tipo === 'padrao') {
    return (
      <View className="flex-row gap-2">
        {[
          { v: 'conforme',     label: '✓ Conforme',    active: 'bg-green-100 border-green-600',  text: 'text-green-700' },
          { v: 'nao_conforme', label: '✗ N.Conforme',  active: 'bg-red-100 border-red-600',      text: 'text-red-700' },
          { v: 'na',           label: 'N/A',            active: 'bg-gray-200 border-gray-500',    text: 'text-gray-700' },
        ].map(({ v, label, active, text }) => (
          <TouchableOpacity
            key={v}
            onPress={() => onSelect(v)}
            className={`flex-1 py-3 rounded-xl border-2 items-center justify-center
              ${valorAtual === v ? active : 'border-gray-200 bg-white'}`}
          >
            <Text className={`text-sm font-bold ${valorAtual === v ? text : 'text-gray-500'}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (tipo === 'customizado' && opcoes) {
    return (
      <View className="flex-row flex-wrap gap-2">
        {opcoes.map((o) => (
          <TouchableOpacity
            key={o.label}
            onPress={() => onSelect(o.label, o.pontuacao)}
            className={`px-4 py-2 rounded-xl border-2
              ${valorAtual === o.label ? 'border-primary bg-teal-50' : 'border-gray-200 bg-white'}`}
          >
            <Text className={`text-sm font-semibold ${valorAtual === o.label ? 'text-primary' : 'text-gray-600'}`}>
              {o.label} ({o.pontuacao}pts)
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (tipo === 'numero') {
    return (
      <View className="flex-row items-center gap-3">
        <TextInput
          className="border-2 border-primary rounded-xl px-4 text-2xl font-bold text-center w-24"
          style={{ paddingVertical: 10, lineHeight: 32 }}
          keyboardType="numeric"
          value={valorAtual ?? ''}
          onChangeText={(t) => {
            onSelect(t);
            onTextChange?.(t);
          }}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
        />
        {unidade && <Text className="text-gray-500 text-base">{unidade}</Text>}
      </View>
    );
  }

  // tipo === 'texto'
  return (
    <TextInput
      className="border-2 border-primary rounded-xl px-4 py-3 text-base text-neutral min-h-[80px]"
      style={{ lineHeight: 22, textAlignVertical: 'top' }}
      multiline
      value={valorAtual ?? ''}
      onChangeText={(t) => {
        onSelect(t);
        onTextChange?.(t);
      }}
      placeholder="Descreva sua observação..."
      placeholderTextColor="#9CA3AF"
    />
  );
}
```

- [ ] **Step 4: Create `ItemCamposNc.tsx`**

```tsx
import { View, Text, TextInput, ActivityIndicator } from 'react-native';

interface Props {
  descricaoIa?: string;
  planoAcaoIa?: string;
  loadingIa: boolean;
  descricao: string;
  planoAcao: string;
  onChange: (descricao: string, planoAcao: string) => void;
}

export function ItemCamposNc({ descricaoIa, planoAcaoIa, loadingIa, descricao, planoAcao, onChange }: Props) {
  return (
    <View className="bg-orange-50 border border-orange-200 rounded-xl p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <Text className="text-sm font-semibold text-orange-800">⚠ Não Conformidade</Text>
        {loadingIa && <ActivityIndicator size="small" color="#f59e0b" />}
      </View>

      <View>
        <Text className="text-xs text-orange-700 mb-1 font-medium">Descrição da NC</Text>
        <TextInput
          className="bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm text-neutral min-h-[60px]"
          style={{ lineHeight: 20, textAlignVertical: 'top' }}
          multiline
          value={descricao}
          onChangeText={(t) => onChange(t, planoAcao)}
          placeholder={loadingIa ? 'Aguardando sugestão de IA...' : (descricaoIa ?? 'Descreva a não conformidade')}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View>
        <Text className="text-xs text-orange-700 mb-1 font-medium">Plano de Ação</Text>
        <TextInput
          className="bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm text-neutral min-h-[60px]"
          style={{ lineHeight: 20, textAlignVertical: 'top' }}
          multiline
          value={planoAcao}
          onChangeText={(t) => onChange(descricao, t)}
          placeholder={loadingIa ? 'Aguardando sugestão de IA...' : (planoAcaoIa ?? 'Defina o plano de ação')}
          placeholderTextColor="#9CA3AF"
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Create `FotoGrid.tsx`**

```tsx
import { View, Text, Image, TouchableOpacity, FlatList } from 'react-native';
import type { Foto } from '../../db/repositories/foto.repo';

interface Props {
  fotos: Foto[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  obrigatoria?: boolean;
  maxFotos?: number;
}

export function FotoGrid({ fotos, onAdd, onRemove, obrigatoria = false, maxFotos = 10 }: Props) {
  const canAdd = fotos.length < maxFotos;

  return (
    <View>
      {obrigatoria && fotos.length === 0 && (
        <Text className="text-xs text-red-600 mb-2">📷 Foto obrigatória para este item</Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {fotos.map((f) => (
          <View key={f.id} className="relative">
            <Image
              source={{ uri: f.filePath ?? f.url ?? undefined }}
              className="w-20 h-20 rounded-lg bg-gray-200"
            />
            <TouchableOpacity
              onPress={() => onRemove(f.id)}
              className="absolute top-1 right-1 bg-black/50 rounded-full w-5 h-5 items-center justify-center"
            >
              <Text className="text-white text-xs">✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {canAdd && (
          <TouchableOpacity
            onPress={onAdd}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 items-center justify-center bg-gray-50"
          >
            <Text className="text-2xl text-gray-400">+</Text>
            <Text className="text-xs text-gray-400">Foto</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Verify types**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/auditoria/
git commit -m "feat(components): add auditoria UI components"
```

---

## Task 11: Lista de Auditorias Screen

**Files:**
- Create: `apps/mobile/app/(app)/auditorias/index.tsx`

- [ ] **Step 1: Create the list screen**

```tsx
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { AuditoriaRepo, type AuditoriaListItem } from '../../../src/db/repositories/auditoria.repo';
import { AuditoriaStatusBadge } from '../../../src/components/auditoria/AuditoriaStatusBadge';
import { SyncService } from '../../../src/sync/SyncService';

const repo = new AuditoriaRepo();

type Filtro = 'todas' | 'em_andamento' | 'concluida';

export default function AuditoriasListScreen() {
  const [auditorias, setAuditorias] = useState<AuditoriaListItem[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setAuditorias(repo.findAll());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await SyncService.sync(); } finally {
      load();
      setRefreshing(false);
    }
  };

  const filtered = auditorias.filter(a =>
    filtro === 'todas' ? true : a.status === filtro
  );

  const effectiveStatus = (a: AuditoriaListItem): string =>
    a.syncStatus === 'pending' && a.status === 'concluida' ? 'pending_sync' : a.status;

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-neutral" style={{ fontFamily: 'Montserrat_700Bold' }}>
          Auditorias
        </Text>
      </View>

      {/* Filtros */}
      <View className="flex-row bg-white border-b border-gray-100 px-4 gap-4">
        {(['todas', 'em_andamento', 'concluida'] as Filtro[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFiltro(f)}
            className={`py-3 border-b-2 ${filtro === f ? 'border-primary' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-medium ${filtro === f ? 'text-primary' : 'text-gray-500'}`}>
              {f === 'todas' ? 'Todas' : f === 'em_andamento' ? 'Em andamento' : 'Concluídas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={a => a.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00B8A9" />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-gray-400 text-base">Nenhuma auditoria encontrada</Text>
          </View>
        }
        renderItem={({ item: a }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(app)/auditorias/[id]/checklist', params: { id: a.id } })}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <View className="flex-row justify-between items-start mb-1">
              <Text className="text-base font-semibold text-neutral flex-1 mr-2">{a.clienteNome}</Text>
              <AuditoriaStatusBadge status={effectiveStatus(a)} />
            </View>
            <Text className="text-sm text-gray-500 mb-2">{a.unidadeNome}</Text>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-400">
                {a.dataInicio ? new Date(a.dataInicio).toLocaleDateString('pt-BR') : '—'}
              </Text>
              {a.pontuacaoTotal !== null && (
                <Text className="text-sm font-bold text-primary">{a.pontuacaoTotal} pts</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/auditorias/nova')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
      >
        <Plus color="white" size={24} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/auditorias/index.tsx
git commit -m "feat(screen): add lista de auditorias screen"
```

---

## Task 12: Nova Auditoria Wizard

**Files:**
- Create: `apps/mobile/app/(app)/auditorias/nova.tsx`
- Create: `apps/mobile/app/(app)/auditorias/nova-template.tsx`

- [ ] **Step 1: Create `nova.tsx` (select unidade)**

```tsx
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDatabase } from '../../../src/db/client';

interface UnidadeRow {
  id: string;
  nome: string;
  cliente_id: string;
  razao_social: string;
  cidade: string | null;
  estado: string | null;
}

function loadUnidades(): UnidadeRow[] {
  const db = getDatabase();
  return db.getAllSync<UnidadeRow>(
    `SELECT u.id, u.nome, u.cliente_id, c.razao_social, u.cidade, u.estado
     FROM unidades u
     JOIN clientes c ON c.id = u.cliente_id
     ORDER BY c.razao_social, u.nome`
  );
}

export default function NovaAuditoriaScreen() {
  const [busca, setBusca] = useState('');
  const unidades = useMemo(() => loadUnidades(), []);

  const filtradas = useMemo(
    () => unidades.filter(u =>
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.razao_social.toLowerCase().includes(busca.toLowerCase())
    ),
    [unidades, busca]
  );

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['bottom']}>
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <TextInput
          className="bg-gray-100 rounded-xl px-4 py-2.5 text-base text-neutral"
          style={{ lineHeight: 22 }}
          placeholder="Buscar estabelecimento..."
          placeholderTextColor="#9CA3AF"
          value={busca}
          onChangeText={setBusca}
          autoFocus
        />
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: u }) => (
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/(app)/auditorias/nova-template',
              params: { unidadeId: u.id, clienteId: u.cliente_id },
            })}
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <Text className="font-semibold text-neutral">{u.razao_social}</Text>
            <Text className="text-sm text-gray-500">{u.nome}</Text>
            {(u.cidade || u.estado) && (
              <Text className="text-xs text-gray-400 mt-0.5">
                {[u.cidade, u.estado].filter(Boolean).join(', ')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Create `nova-template.tsx` (select template)**

```tsx
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDatabase } from '../../../src/db/client';
import { AuditoriaRepo } from '../../../src/db/repositories/auditoria.repo';
import { AuditoriaItemRepo } from '../../../src/db/repositories/auditoria-item.repo';

interface TemplateRow { id: string; nome: string; descricao: string | null; totalItens: number; }
interface TemplateItemRaw {
  id: string; descricao: string; ordem: number; categoria: string | null;
  tipo_resposta: string; foto_obrigatoria: number; observacao_obrigatoria: number;
  pontuacao_maxima: number; opcoes_resposta_config: string | null; criticidade: string | null;
}

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();

export default function NovaTemplateScreen() {
  const { unidadeId, clienteId } = useLocalSearchParams<{ unidadeId: string; clienteId: string }>();
  const [loading, setLoading] = useState(false);

  const templates = useMemo((): TemplateRow[] => {
    const db = getDatabase();
    return db.getAllSync<TemplateRow>(
      `SELECT ct.id, ct.nome, ct.descricao,
              COUNT(ti.id) AS totalItens
       FROM checklist_templates ct
       JOIN clientes c ON ct.tipo_atividade = c.tipo_atividade
       JOIN unidades u ON u.cliente_id = c.id
       LEFT JOIN template_itens ti ON ti.template_id = ct.id
       WHERE u.id = ? AND ct.status = 'ativo'
       GROUP BY ct.id
       ORDER BY ct.nome`,
      [unidadeId]
    );
  }, [unidadeId]);

  const handleSelect = (template: TemplateRow) => {
    setLoading(true);
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create auditoria
    auditoriaRepo.create({
      id: newId,
      clienteId: clienteId!,
      unidadeId: unidadeId!,
      templateId: template.id,
      dataInicio: now,
    });

    // Bulk-create items
    const db = getDatabase();
    const itens = db.getAllSync<TemplateItemRaw>(
      `SELECT id, descricao, ordem, categoria, tipo_resposta,
              foto_obrigatoria, observacao_obrigatoria, pontuacao_maxima,
              opcoes_resposta_config, criticidade
       FROM template_itens WHERE template_id = ? ORDER BY categoria, ordem`,
      [template.id]
    );

    itemRepo.bulkCreate(newId, itens.map(i => ({
      id: i.id,
      descricao: i.descricao,
      ordem: i.ordem,
      categoria: i.categoria,
      tipoResposta: i.tipo_resposta,
      fotoObrigatoria: i.foto_obrigatoria === 1,
      observacaoObrigatoria: i.observacao_obrigatoria === 1,
      pontuacaoMaxima: i.pontuacao_maxima,
      opcoesRespostaConfig: i.opcoes_resposta_config,
      criticidade: i.criticidade,
    })));

    router.replace({ pathname: '/(app)/auditorias/[id]/checklist', params: { id: newId } });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
        <Text className="text-gray-500 mt-3">Criando auditoria...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['bottom']}>
      <FlatList
        data={templates}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <Text className="text-center text-gray-400 py-8">
            Nenhum template disponível para este estabelecimento
          </Text>
        }
        renderItem={({ item: t }) => (
          <TouchableOpacity
            onPress={() => handleSelect(t)}
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <Text className="font-semibold text-neutral">{t.nome}</Text>
            {t.descricao && <Text className="text-sm text-gray-500 mt-0.5">{t.descricao}</Text>}
            <Text className="text-xs text-gray-400 mt-1">{t.totalItens} itens</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd apps/mobile && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/auditorias/nova.tsx apps/mobile/app/(app)/auditorias/nova-template.tsx
git commit -m "feat(screen): add nova auditoria wizard (step 1 + step 2)"
```

---

## Task 13: Checklist Screen

**Files:**
- Create: `apps/mobile/app/(app)/auditorias/[id]/checklist.tsx`

- [ ] **Step 1: Create the checklist screen**

```tsx
import { View, Text, SectionList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuditoriaStore } from '../../../../src/store/auditoria';
import { ChecklistProgress } from '../../../../src/components/auditoria/ChecklistProgress';
import { AuditoriaStatusBadge } from '../../../../src/components/auditoria/AuditoriaStatusBadge';
import type { AuditoriaItemCompleto } from '../../../../src/db/repositories/auditoria-item.repo';

const RESPOSTA_DOT: Record<string, string> = {
  conforme: '#16a34a',
  nao_conforme: '#dc2626',
  na: '#94a3b8',
  nao_avaliado: '#cbd5e1',
};

const RESPOSTA_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  conforme:     { label: 'C',   bg: '#dcfce7', text: '#16a34a' },
  nao_conforme: { label: 'NC',  bg: '#fee2e2', text: '#dc2626' },
  na:           { label: 'N/A', bg: '#f1f5f9', text: '#94a3b8' },
  nao_avaliado: { label: '—',   bg: '#f1f5f9', text: '#94a3b8' },
};

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auditoria, itens, isLoading, error, iniciar, finalizar, limpar } = useAuditoriaStore();

  useEffect(() => {
    if (id) iniciar(id);
    return () => limpar();
  }, [id]);

  const respondidos = useMemo(() => itens.filter(i => i.resposta !== 'nao_avaliado').length, [itens]);

  const sections = useMemo(() => {
    const byCategoria: Record<string, AuditoriaItemCompleto[]> = {};
    for (const item of itens) {
      const cat = item.categoria ?? 'Geral';
      (byCategoria[cat] ??= []).push(item);
    }
    return Object.entries(byCategoria).map(([title, data]) => ({ title, data }));
  }, [itens]);

  const handleFinalizar = useCallback(() => {
    const pendentes = itens.filter(i => i.resposta === 'nao_avaliado').length;
    const doFinalize = () => {
      finalizar();
      router.replace({ pathname: '/(app)/auditorias/[id]/resumo', params: { id: id! } });
    };
    if (pendentes > 0) {
      Alert.alert(
        'Itens pendentes',
        `${pendentes} item(s) ainda não foram respondidos. Deseja finalizar assim mesmo?`,
        [{ text: 'Continuar', style: 'cancel' }, { text: 'Finalizar', onPress: doFinalize }]
      );
    } else {
      doFinalize();
    }
  }, [itens, finalizar, id]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200 px-8">
        <Text className="text-red-600 text-base text-center mb-4">{error}</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-primary px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="bg-neutral px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            {auditoria?.clienteNome ?? '...'}
          </Text>
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {auditoria?.unidadeNome ?? ''}
          </Text>
        </View>
        <AuditoriaStatusBadge status={auditoria?.status ?? 'rascunho'} />
      </View>

      <ChecklistProgress respondidos={respondidos} total={itens.length} />

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section: { title, data } }) => {
          const secRespondidos = data.filter(i => i.resposta !== 'nao_avaliado').length;
          return (
            <View className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex-row justify-between">
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</Text>
              <Text className="text-xs text-gray-400">{secRespondidos}/{data.length}</Text>
            </View>
          );
        }}
        renderItem={({ item }) => {
          const badge = RESPOSTA_BADGE[item.resposta] ?? RESPOSTA_BADGE.nao_avaliado;
          const dot = RESPOSTA_DOT[item.resposta] ?? RESPOSTA_DOT.nao_avaliado;
          return (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/(app)/auditorias/[id]/item/[itemId]',
                params: { id: id!, itemId: item.id },
              })}
              className="bg-white px-4 py-3 border-b border-gray-50 flex-row items-center gap-3"
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, flexShrink: 0 }} />
              <Text className="flex-1 text-sm text-neutral" numberOfLines={2}>{item.descricao}</Text>
              <View style={{ backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: badge.text, fontSize: 10, fontWeight: '700' }}>{badge.label}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {/* Footer */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
        <TouchableOpacity
          onPress={handleFinalizar}
          className="bg-primary rounded-xl py-4 items-center"
        >
          <Text className="text-white font-bold text-base">Finalizar Auditoria</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/(app)/auditorias/[id]/checklist.tsx
git commit -m "feat(screen): add checklist screen with grouped categories"
```

---

## Task 14: Item Screen

**Files:**
- Create: `apps/mobile/app/(app)/auditorias/[id]/item/[itemId].tsx`

- [ ] **Step 1: Create the item screen**

Create `apps/mobile/app/(app)/auditorias/[id]/item/[itemId].tsx`:

```tsx
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuditoriaStore } from '../../../../../src/store/auditoria';
import { FotoRepo } from '../../../../../src/db/repositories/foto.repo';
import { AuditoriaItemRepo } from '../../../../../src/db/repositories/auditoria-item.repo';
import { ItemRespostaButtons } from '../../../../../src/components/auditoria/ItemRespostaButtons';
import { ItemCamposNc } from '../../../../../src/components/auditoria/ItemCamposNc';
import { FotoGrid } from '../../../../../src/components/auditoria/FotoGrid';
import { getSugestaoIa } from '../../../../../src/api/auditoria.api';

const fotoRepo = new FotoRepo();
const itemRepo = new AuditoriaItemRepo();

export default function ItemScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const { itens, salvarResposta } = useAuditoriaStore();

  const item = itens.find(i => i.id === itemId);

  const [resposta, setResposta] = useState(item?.resposta ?? 'nao_avaliado');
  const [observacao, setObservacao] = useState(item?.observacao ?? '');
  const [descricaoNc, setDescricaoNc] = useState(item?.descricaoNaoConformidade ?? '');
  const [planoAcao, setPlanoAcao] = useState(item?.planoAcaoFinal ?? '');
  const [pontuacao, setPontuacao] = useState(item?.pontuacao ?? 0);
  const [fotos, setFotos] = useState(() => fotoRepo.findByItem(itemId!));
  const [loadingIa, setLoadingIa] = useState(false);
  const [descricaoIa, setDescricaoIa] = useState(item?.descricaoIa ?? undefined);
  const [planoIa, setPlanoIa] = useState(item?.planoAcaoSugerido ?? undefined);

  // Parse opcoes customizadas
  const opcoes = item?.opcoesRespostaConfig
    ? JSON.parse(item.opcoesRespostaConfig)
    : undefined;

  const handleSelectResposta = (v: string, pts?: number) => {
    setResposta(v);
    if (pts !== undefined) setPontuacao(pts);

    // IA: trigger on NC
    if (v === 'nao_conforme' && !descricaoNc && !loadingIa) {
      setLoadingIa(true);
      getSugestaoIa(itemId!, item?.descricao ?? '')
        .then(({ descricao, planoAcao: pa }) => {
          setDescricaoIa(descricao);
          setPlanoIa(pa);
          if (!descricaoNc) setDescricaoNc(descricao);
          if (!planoAcao) setPlanoAcao(pa);
        })
        .catch(() => { /* best-effort */ })
        .finally(() => setLoadingIa(false));
    }
  };

  const handleAddFoto = useCallback(async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const fotoId = fotoRepo.add(itemId!, result.assets[0].uri);
      setFotos(fotoRepo.findByItem(itemId!));
    }
  }, [itemId]);

  const handleRemoveFoto = useCallback((fotoId: string) => {
    fotoRepo.remove(fotoId);
    setFotos(fotoRepo.findByItem(itemId!));
  }, [itemId]);

  const handleSalvar = () => {
    // Validate required fields
    if (item?.fotoObrigatoria && fotos.length === 0) {
      Alert.alert('Foto obrigatória', 'Adicione pelo menos uma foto para este item.');
      return;
    }
    if (item?.observacaoObrigatoria && !observacao.trim()) {
      Alert.alert('Observação obrigatória', 'Preencha a observação para este item.');
      return;
    }

    salvarResposta(itemId!, {
      resposta,
      observacao: observacao || undefined,
      descricaoNaoConformidade: resposta === 'nao_conforme' ? descricaoNc || undefined : undefined,
      planoAcaoFinal: resposta === 'nao_conforme' ? planoAcao || undefined : undefined,
      pontuacao,
      descricaoIa: descricaoIa,
      planoAcaoSugerido: planoIa,
    });
    router.back();
  };

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-400">Item não encontrado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="bg-neutral px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text className="text-white font-semibold text-sm flex-1" numberOfLines={2}>
          {item.descricao}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Response buttons */}
        <ItemRespostaButtons
          tipo={item.tipoResposta as any}
          opcoes={opcoes}
          valorAtual={resposta === 'nao_avaliado' ? null : resposta}
          onSelect={handleSelectResposta}
        />

        {/* Observação */}
        <View>
          <Text className="text-sm font-medium text-gray-600 mb-2">
            Observação{item.observacaoObrigatoria ? ' *' : ''}
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base text-neutral min-h-[72px]"
            style={{ lineHeight: 22, textAlignVertical: 'top' }}
            multiline
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Adicione uma observação..."
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Foto obrigatória warning */}
        {item.fotoObrigatoria && fotos.length === 0 && (
          <View className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex-row items-center gap-2">
            <Text className="text-orange-700 text-sm">📷 Foto obrigatória para este item</Text>
          </View>
        )}

        {/* NC fields */}
        {resposta === 'nao_conforme' && (
          <ItemCamposNc
            descricaoIa={descricaoIa}
            planoAcaoIa={planoIa}
            loadingIa={loadingIa}
            descricao={descricaoNc}
            planoAcao={planoAcao}
            onChange={(d, p) => { setDescricaoNc(d); setPlanoAcao(p); }}
          />
        )}

        {/* Fotos */}
        <View>
          <Text className="text-sm font-medium text-gray-600 mb-2">Fotos</Text>
          <FotoGrid
            fotos={fotos}
            onAdd={handleAddFoto}
            onRemove={handleRemoveFoto}
            obrigatoria={item.fotoObrigatoria}
          />
        </View>

        {/* Salvar button */}
        <TouchableOpacity
          onPress={handleSalvar}
          className="bg-primary rounded-xl py-4 items-center mt-4"
        >
          <Text className="text-white font-bold text-base">Salvar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/mobile/app/(app)/auditorias/[id]/item/[itemId].tsx"
git commit -m "feat(screen): add item response screen with all 4 tipo_resposta variants"
```

---

## Task 15: Resumo Screen

> `SyncService.isOnline()` already exists in the current codebase (`apps/mobile/src/sync/SyncService.ts`). No changes needed there.


**Files:**
- Create: `apps/mobile/app/(app)/auditorias/[id]/resumo.tsx`

- [ ] **Step 1: Create the resumo screen**

```tsx
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuditoriaStore } from '../../../../src/store/auditoria';
import { AuditoriaRepo } from '../../../../src/db/repositories/auditoria.repo';
import { getDatabase } from '../../../../src/db/client';
import { pushAuditoria, enqueuePush } from '../../../../src/sync/push';
import { SyncService } from '../../../../src/sync/SyncService';

const auditoriaRepo = new AuditoriaRepo();

export default function ResumoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auditoria, itens } = useAuditoriaStore();

  const [assinatura, setAssinatura] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const ncs = useMemo(() => itens.filter(i => i.resposta === 'nao_conforme'), [itens]);
  const pontuacaoTotal = useMemo(() => itens.reduce((s, i) => s + i.pontuacao, 0), [itens]);
  const pontuacaoMaxima = useMemo(() => itens.reduce((s, i) => s + i.pontuacaoMaxima, 0), [itens]);
  const pct = pontuacaoMaxima > 0 ? Math.round((pontuacaoTotal / pontuacaoMaxima) * 100) : 0;

  const categorias = useMemo(() => {
    const map: Record<string, { respondidos: number; total: number }> = {};
    for (const i of itens) {
      const cat = i.categoria ?? 'Geral';
      if (!map[cat]) map[cat] = { respondidos: 0, total: 0 };
      map[cat].total++;
      if (i.resposta !== 'nao_avaliado') map[cat].respondidos++;
    }
    return Object.entries(map);
  }, [itens]);

  const handleEnviar = async () => {
    setSending(true);
    setSendError(null);
    try {
      const isOnline = await SyncService.isOnline();
      if (isOnline) {
        await pushAuditoria(id!);
        setSent(true);
      } else {
        enqueuePush(id!);
        setSent(true); // optimistic: will sync when online
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="bg-neutral px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text className="text-white font-semibold">Resumo da Auditoria</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Score */}
        <View className="bg-white rounded-2xl p-6 items-center">
          <Text className="text-5xl font-bold text-primary">{pct}%</Text>
          <Text className="text-gray-500 mt-1">{pontuacaoTotal} / {pontuacaoMaxima} pontos</Text>
        </View>

        {/* Categorias */}
        <View className="bg-white rounded-2xl p-4 gap-3">
          <Text className="font-semibold text-neutral">Por categoria</Text>
          {categorias.map(([cat, { respondidos, total }]) => {
            const catPct = total > 0 ? (respondidos / total) * 100 : 0;
            return (
              <View key={cat}>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm text-gray-600">{cat}</Text>
                  <Text className="text-sm text-gray-400">{respondidos}/{total}</Text>
                </View>
                <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <View className="h-full bg-primary rounded-full" style={{ width: `${catPct}%` }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* NCs */}
        {ncs.length > 0 && (
          <View className="bg-white rounded-2xl p-4 gap-2">
            <Text className="font-semibold text-neutral text-red-600">
              Não Conformidades ({ncs.length})
            </Text>
            {ncs.map(nc => (
              <View key={nc.id} className="border-l-2 border-red-400 pl-3 py-1">
                <Text className="text-sm text-neutral">{nc.descricao}</Text>
                {nc.criticidade && (
                  <Text className="text-xs text-gray-400 mt-0.5 capitalize">{nc.criticidade}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* IA Analysis (loaded from db after finalize) */}
        {auditoria?.analiseIa && (
          <View className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
            <Text className="font-semibold text-teal-800 mb-2">🤖 Análise IA</Text>
            <Text className="text-sm text-teal-700">{auditoria.analiseIa}</Text>
          </View>
        )}

        {/* Assinatura */}
        <View className="bg-white rounded-2xl p-4">
          <Text className="text-sm font-medium text-gray-600 mb-2">Assinatura do responsável</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base text-neutral"
            style={{ lineHeight: 22 }}
            placeholder="Nome do responsável"
            placeholderTextColor="#9CA3AF"
            value={assinatura}
            onChangeText={setAssinatura}
          />
        </View>

        {/* Enviar */}
        {!sent ? (
          <View>
            {sendError && (
              <Text className="text-red-600 text-sm text-center mb-2">{sendError}</Text>
            )}
            <TouchableOpacity
              onPress={handleEnviar}
              disabled={sending}
              className={`rounded-xl py-4 items-center ${sending ? 'bg-gray-400' : 'bg-primary'}`}
            >
              {sending
                ? <ActivityIndicator color="white" />
                : <Text className="text-white font-bold text-base">Enviar Relatório</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 items-center">
            <Text className="text-green-700 font-semibold">✓ Auditoria enviada com sucesso</Text>
            <TouchableOpacity
              onPress={() => router.replace('/(app)/auditorias')}
              className="mt-3"
            >
              <Text className="text-primary font-medium">Voltar para lista</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/mobile/app/(app)/auditorias/[id]/resumo.tsx"
git commit -m "feat(screen): add resumo screen with score, NCs, AI analysis, and send"
```

---

## Task 16: Run All Tests + Manual Smoke Test

- [ ] **Step 1: Run full test suite**

```bash
cd apps/mobile && npx jest --no-coverage
```

Expected: All tests pass (migrations x5, auditoria repo x4, auditoria-item repo x3, foto repo x3, push sync x2, existing auth/sync queue tests)

- [ ] **Step 2: Start iOS simulator**

```bash
cd apps/mobile && npx expo start --clear --ios
```

- [ ] **Step 3: Smoke test — create and complete an audit**

1. Log in → navigate to Auditorias tab → see empty list with FAB
2. Tap "+" → Nova Auditoria screen shows list of unidades from SQLite
3. Select a unidade → template list shows (filtered by tipo_atividade)
4. Select a template → checklist opens with items grouped by category
5. Tap an item → item screen opens with response buttons
6. Mark "Conforme" → tap Salvar → checklist shows green dot
7. Tap an item → mark "Não Conforme" → NC fields appear (with IA loading indicator)
8. Tap Finalizar → confirm dialog if pendentes > 0 → Resumo screen
9. Resumo shows score, category breakdown, NCs → tap "Enviar Relatório"

- [ ] **Step 4: Smoke test — offline behavior**

1. Turn off simulator network (Settings → Airplane Mode)
2. Finish an audit → tap "Enviar Relatório" → see "Salvo localmente" feedback
3. Re-enable network → pull-to-refresh on lista → sync processes queue → badge updates

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(auditorias): Phase 2 complete — full audit flow with sync and AI"
```
