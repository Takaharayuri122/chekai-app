// apps/mobile/src/sync/pull.ts
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../db/client';
import { apiGet } from '../api/client';
import type { Cliente } from '@meta-app/shared';

const STATUS_API_PARA_LOCAL: Record<string, string> = {
  finalizada: 'concluida',
  rascunho: 'rascunho',
  em_andamento: 'em_andamento',
  cancelada: 'cancelada',
};

function mapearStatusApiParaLocal(statusApi: string): string {
  return STATUS_API_PARA_LOCAL[statusApi] ?? statusApi;
}

function setLastSyncedAt(db: SQLite.SQLiteDatabase, entity: string, timestamp: string): void {
  db.runSync(
    `INSERT OR REPLACE INTO sync_meta (entity, last_synced_at) VALUES (?, ?)`,
    [entity, timestamp]
  );
}

export async function pullClientes(): Promise<void> {
  const db = getDatabase();
  const result = await apiGet<{ items: Cliente[] }>(`/clientes?limit=1000`);
  const clientes = result.items ?? [];
  console.log(`[pullClientes] Recebidos ${clientes.length} clientes`);
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

interface TemplateItemApi {
  id: string;
  pergunta: string;
  ordem: number;
  peso: number;
  legislacaoReferencia?: string;
  categoria?: string;
  criticidade?: string;
  opcoesRespostaConfig?: Array<{ valor: string; fotoObrigatoria: boolean; observacaoObrigatoria: boolean; pontuacao?: number | null }>;
  usarRespostasPersonalizadas?: boolean;
  tipoRespostaCustomizada?: string;
}

interface TemplateApi {
  id: string;
  nome: string;
  descricao?: string;
  tipoAtividade: string;
  versao: string;
  status: string;
  itens: TemplateItemApi[];
}

export async function pullTemplates(): Promise<void> {
  const db = getDatabase();
  const result = await apiGet<{ items: TemplateApi[] }>(`/checklists/templates?limit=1000`);
  const templates = result.items ?? [];
  console.log(`[pullTemplates] Recebidos ${templates.length} templates`);
  if (templates.length > 0 && templates[0].itens?.length > 0) {
    const sampleItem = templates[0].itens[0];
    console.log(`[pullTemplates] Exemplo item — id=${sampleItem.id}, pergunta="${sampleItem.pergunta?.substring(0, 50)}", peso=${sampleItem.peso}`);
  }
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
        const tipoResposta = item.usarRespostasPersonalizadas && item.tipoRespostaCustomizada
          ? item.tipoRespostaCustomizada
          : 'padrao';
        const temFotoObrigatoria = item.opcoesRespostaConfig?.some(o => o.fotoObrigatoria) ? 1 : 0;
        const temObsObrigatoria = item.opcoesRespostaConfig?.some(o => o.observacaoObrigatoria) ? 1 : 0;
        db.runSync(
          `INSERT OR REPLACE INTO template_itens
           (id, remote_id, template_id, descricao, ordem, referencia_legal, pontuacao_maxima,
            categoria, tipo_resposta, opcoes_resposta_config,
            foto_obrigatoria, observacao_obrigatoria, criticidade,
            sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [item.id, item.id, t.id, item.pergunta, item.ordem,
           item.legislacaoReferencia ?? null, item.peso ?? 0,
           item.categoria ?? null,
           tipoResposta,
           item.opcoesRespostaConfig ? JSON.stringify(item.opcoesRespostaConfig) : null,
           temFotoObrigatoria,
           temObsObrigatoria,
           item.criticidade ?? null,
           now]
        );
      }
    }
  });

  setLastSyncedAt(db, 'templates', now);
}

function carregarIdsLocais(db: SQLite.SQLiteDatabase, tabela: string): Set<string> {
  const rows = db.getAllSync<{ id: string }>(`SELECT id FROM ${tabela}`);
  return new Set(rows.map(r => r.id));
}

export async function pullAuditorias(): Promise<void> {
  const db = getDatabase();
  const result = await apiGet<{ items: Array<{
    id: string; localId?: string; status: string;
    dataInicio?: string; dataFim?: string;
    unidadeId: string; templateId?: string;
    pontuacaoTotal?: number;
    unidade?: { id: string; clienteId?: string; cliente?: { id: string } };
    itens?: Array<{
      id: string; templateItemId: string; resposta: string;
      observacao?: string; descricaoNaoConformidade?: string;
      planoAcaoFinal?: string; pontuacao: number;
    }>;
  }> }>(`/auditorias?limit=1000`);
  const auditorias = result.items ?? [];
  console.log(`[pullAuditorias] Recebidas ${auditorias.length} auditorias da API`);
  if (auditorias.length > 0) {
    const sample = auditorias[0];
    console.log(`[pullAuditorias] Exemplo — id=${sample.id}, status=${sample.status}, unidadeId=${sample.unidadeId}, clienteId via unidade=${sample.unidade?.clienteId ?? sample.unidade?.cliente?.id ?? 'N/A'}`);
  }

  const clientesLocais = carregarIdsLocais(db, 'clientes');
  const unidadesLocais = carregarIdsLocais(db, 'unidades');
  const templatesLocais = carregarIdsLocais(db, 'checklist_templates');
  console.log(`[pullAuditorias] FKs locais — clientes: ${clientesLocais.size}, unidades: ${unidadesLocais.size}, templates: ${templatesLocais.size}`);

  const now = new Date().toISOString();
  let inseridas = 0;
  let ignoradas = 0;

  db.withTransactionSync(() => {
    for (const a of auditorias) {
      const localId = a.localId ?? a.id;
      const clienteId = a.unidade?.clienteId ?? a.unidade?.cliente?.id ?? null;

      if (!clienteId || !clientesLocais.has(clienteId)) {
        ignoradas++;
        console.warn(`[pullAuditorias] Ignorada ${a.id}: cliente ${clienteId ?? 'null'} não encontrado localmente`);
        continue;
      }
      if (!unidadesLocais.has(a.unidadeId)) {
        ignoradas++;
        console.warn(`[pullAuditorias] Ignorada ${a.id}: unidade ${a.unidadeId} não encontrada localmente`);
        continue;
      }
      if (a.templateId && !templatesLocais.has(a.templateId)) {
        ignoradas++;
        console.warn(`[pullAuditorias] Ignorada ${a.id}: template ${a.templateId} não encontrado localmente`);
        continue;
      }

      const status = mapearStatusApiParaLocal(a.status);
      db.runSync(
        `INSERT INTO auditorias
           (id, remote_id, local_id, status, data_inicio, data_fim,
            cliente_id, unidade_id, template_id, pontuacao_total,
            sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           data_inicio = excluded.data_inicio,
           data_fim = excluded.data_fim,
           pontuacao_total = excluded.pontuacao_total,
           remote_id = excluded.remote_id,
           sync_status = 'synced',
           updated_at = excluded.updated_at
         WHERE auditorias.sync_status != 'pending'`,
        [localId, a.id, localId, status, a.dataInicio ?? null, a.dataFim ?? null,
         clienteId, a.unidadeId, a.templateId ?? null, a.pontuacaoTotal ?? null, now]
      );
      inseridas++;

      for (const item of a.itens ?? []) {
        db.runSync(
          `INSERT OR IGNORE INTO auditoria_itens
           (id, auditoria_id, template_item_id, resposta, observacao,
            descricao_nao_conformidade, plano_acao_final, pontuacao, sync_status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
          [item.id, localId, item.templateItemId, item.resposta,
           item.observacao ?? null, item.descricaoNaoConformidade ?? null,
           item.planoAcaoFinal ?? null, item.pontuacao, now]
        );
      }
    }
  });

  console.log(`[pullAuditorias] Inseridas/atualizadas: ${inseridas}, ignoradas (FK ausente): ${ignoradas}`);
  setLastSyncedAt(db, 'auditorias', now);
}

export async function pullAll(): Promise<void> {
  console.log('[pullAll] Iniciando pull de dados...');
  await pullClientes();
  await pullTemplates();
  await pullAuditorias();
  console.log('[pullAll] Pull completo');
}
