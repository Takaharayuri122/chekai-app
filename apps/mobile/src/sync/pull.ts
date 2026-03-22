// apps/mobile/src/sync/pull.ts
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../db/client';
import { apiGet } from '../api/client';
import type { Cliente } from '@meta-app/shared';

// Singleton contrato: getDatabase() sempre retorna a mesma instância.
// Passamos `db` explicitamente para evitar divergência entre chamadas.
function getLastSyncedAt(db: SQLite.SQLiteDatabase, entity: string): string {
  const row = db.getFirstSync<{ last_synced_at: string }>(
    'SELECT last_synced_at FROM sync_meta WHERE entity = ?',
    [entity]
  );
  // Padrão: 90 dias atrás para primeira sync
  return row?.last_synced_at ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
}

function setLastSyncedAt(db: SQLite.SQLiteDatabase, entity: string, timestamp: string): void {
  db.runSync(
    `INSERT OR REPLACE INTO sync_meta (entity, last_synced_at) VALUES (?, ?)`,
    [entity, timestamp]
  );
}

export async function pullClientes(): Promise<void> {
  const db = getDatabase();
  const since = getLastSyncedAt(db, 'clientes');
  const clientes = await apiGet<Cliente[]>(`/clientes?updatedSince=${since}`);
  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    for (const c of clientes) {
      db.runSync(
        `INSERT OR REPLACE INTO clientes
         (id, remote_id, razao_social, nome_fantasia, cnpj, tipo_atividade, logo_url, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [c.id, c.id, c.razaoSocial, c.nomeFantasia ?? null, c.cnpj, c.tipoAtividade, c.logoUrl ?? null, now]
      );

      for (const u of c.unidades ?? []) {
        db.runSync(
          `INSERT OR REPLACE INTO unidades
           (id, remote_id, nome, endereco, cidade, estado, latitude, longitude, raio_geofencing, cliente_id, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [u.id, u.id, u.nome, u.endereco, u.cidade ?? null, u.estado ?? null,
           u.latitude ?? null, u.longitude ?? null, u.raioGeofencing, c.id, now]
        );
      }
    }
  });

  setLastSyncedAt(db, 'clientes', now);
}

export async function pullTemplates(): Promise<void> {
  const db = getDatabase();
  const since = getLastSyncedAt(db, 'templates');
  const templates = await apiGet<Array<{
    id: string; nome: string; descricao?: string; tipoAtividade: string;
    versao: string; status: string; itens: Array<{
      id: string; descricao: string; ordem: number;
      referenciaLegal?: string; pontuacaoMaxima: number;
    }>;
  }>>(`/checklist/templates?updatedSince=${since}`);

  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    for (const t of templates) {
      db.runSync(
        `INSERT OR REPLACE INTO checklist_templates
         (id, remote_id, nome, descricao, tipo_atividade, versao, status, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [t.id, t.id, t.nome, t.descricao ?? null, t.tipoAtividade, t.versao, t.status, now]
      );

      for (const item of t.itens ?? []) {
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
      }
    }
  });

  setLastSyncedAt(db, 'templates', now);
}

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

export async function pullAll(): Promise<void> {
  await pullClientes();
  await pullTemplates();
  await pullAuditorias();
}
