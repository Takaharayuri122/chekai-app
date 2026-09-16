// apps/mobile/src/sync/pull.ts
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../db/client';
import { apiGet } from '../api/client';
import { getAuditoriaDetalhe } from '../api/auditoria.api';
import { FotoRepo } from '../db/repositories/foto.repo';
import { RelatorioTecnicoRepo, type RelatorioTecnicoStatus } from '../db/repositories/relatorio-tecnico.repo';
import { RelatorioFotoRepo } from '../db/repositories/relatorio-foto.repo';
import { CheckinRepo } from '../db/repositories/checkin.repo';
import { buscarCheckinAberto } from '../api/checkin.api';
import { useAuthStore } from '../store/auth';
import type { Cliente } from '@meta-app/shared';

const PAGE_LIMIT = 100;

interface PaginaApi<T> {
  items?: T[];
  hasNext?: boolean;
  totalPages?: number;
  page?: number;
}

/**
 * Percorre todas as páginas de um endpoint paginado (`page`/`limit`) até esgotar,
 * concatenando os itens. Encerra quando a API indica `hasNext = false`, quando a
 * página atual atinge `totalPages` ou quando retorna menos itens que o limite.
 */
async function buscarTodasPaginas<T>(basePath: string, limit: number = PAGE_LIMIT): Promise<T[]> {
  const todos: T[] = [];
  const separador = basePath.includes('?') ? '&' : '?';
  let page = 1;
  for (;;) {
    const pagina = await apiGet<PaginaApi<T>>(`${basePath}${separador}page=${page}&limit=${limit}`);
    const items = pagina.items ?? [];
    todos.push(...items);
    if (items.length === 0) break;
    if (pagina.hasNext === false) break;
    if (pagina.totalPages != null && page >= pagina.totalPages) break;
    if (items.length < limit) break;
    page += 1;
  }
  return todos;
}

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
  const clientes = await buscarTodasPaginas<Cliente>('/clientes');
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

interface TemplateItemEmbed {
  id: string;
  pergunta: string;
  ordem: number;
  peso?: number;
  legislacaoReferencia?: string | null;
  categoria?: string | null;
  criticidade?: string | null;
  opcoesRespostaConfig?: Array<{ valor: string; fotoObrigatoria: boolean; observacaoObrigatoria: boolean; pontuacao?: number | null }>;
  usarRespostasPersonalizadas?: boolean;
  tipoRespostaCustomizada?: string | null;
}

/**
 * Insere/atualiza um `template_itens` local a partir do item de template vindo da API
 * (listagem de templates ou detalhe da auditoria). Mapeia os campos derivados
 * (`tipo_resposta`, flags de obrigatoriedade) de forma idempotente.
 */
function upsertTemplateItem(
  db: SQLite.SQLiteDatabase,
  templateId: string,
  item: TemplateItemEmbed,
  timestamp: string,
): void {
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
    [item.id, item.id, templateId, item.pergunta, item.ordem,
     item.legislacaoReferencia ?? null, item.peso ?? 0,
     item.categoria ?? null,
     tipoResposta,
     item.opcoesRespostaConfig ? JSON.stringify(item.opcoesRespostaConfig) : null,
     temFotoObrigatoria,
     temObsObrigatoria,
     item.criticidade ?? null,
     timestamp]
  );
}

export async function pullTemplates(): Promise<void> {
  const db = getDatabase();
  const templates = await buscarTodasPaginas<TemplateApi>('/checklists/templates');
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
        upsertTemplateItem(db, t.id, item, now);
      }
    }
  });

  setLastSyncedAt(db, 'templates', now);
}

function carregarIdsLocais(db: SQLite.SQLiteDatabase, tabela: string): Set<string> {
  const rows = db.getAllSync<{ id: string }>(`SELECT id FROM ${tabela}`);
  return new Set(rows.map(r => r.id));
}

interface AuditoriaApiItem {
  id: string; templateItemId: string; resposta: string;
  observacao?: string; descricaoNaoConformidade?: string;
  planoAcaoFinal?: string; pontuacao: number;
}

interface AuditoriaApiTemplateEmbed {
  id: string;
  nome?: string;
  descricao?: string | null;
  tipoAtividade?: string | null;
  versao?: string | null;
  status?: string | null;
}

interface AuditoriaApiListagem {
  id: string; localId?: string; status: string;
  dataInicio?: string; dataFim?: string;
  unidadeId: string; templateId?: string;
  pontuacaoTotal?: number;
  unidade?: { id: string; clienteId?: string; cliente?: { id: string } };
  template?: AuditoriaApiTemplateEmbed;
  itens?: AuditoriaApiItem[];
}

/**
 * Garante a existência local de um `checklist_templates` stub a partir do template
 * embutido na listagem de auditorias. Necessário porque a listagem de templates da API
 * só retorna os ativos (`status = ATIVO`), enquanto a auditoria pode referenciar um
 * template inativo/rascunho — sem o stub, a FK derrubaria a auditoria do pull.
 */
function hidratarTemplateStub(
  db: SQLite.SQLiteDatabase,
  templateId: string,
  embed: AuditoriaApiTemplateEmbed | undefined,
  timestamp: string,
): void {
  db.runSync(
    `INSERT OR IGNORE INTO checklist_templates
       (id, remote_id, nome, descricao, tipo_atividade, versao, status, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
    [
      templateId,
      templateId,
      embed?.nome ?? 'Checklist',
      embed?.descricao ?? null,
      embed?.tipoAtividade ?? null,
      embed?.versao ?? '1.0',
      embed?.status ?? 'inativo',
      timestamp,
    ],
  );
}

export async function pullAuditorias(): Promise<void> {
  const db = getDatabase();
  const auditorias = await buscarTodasPaginas<AuditoriaApiListagem>('/auditorias');
  console.log(`[pullAuditorias] Recebidas ${auditorias.length} auditorias da API`);
  if (auditorias.length > 0) {
    const sample = auditorias[0];
    console.log(`[pullAuditorias] Exemplo — id=${sample.id}, status=${sample.status}, unidadeId=${sample.unidadeId}, clienteId via unidade=${sample.unidade?.clienteId ?? sample.unidade?.cliente?.id ?? 'N/A'}`);
  }

  const clientesLocais = carregarIdsLocais(db, 'clientes');
  const unidadesLocais = carregarIdsLocais(db, 'unidades');
  const templatesLocais = carregarIdsLocais(db, 'checklist_templates');
  const templatesAtivosIniciais = new Set(templatesLocais);
  const templateItensLocais = carregarIdsLocais(db, 'template_itens');
  console.log(`[pullAuditorias] FKs locais — clientes: ${clientesLocais.size}, unidades: ${unidadesLocais.size}, templates: ${templatesLocais.size}`);

  const now = new Date().toISOString();
  let inseridas = 0;
  let ignoradas = 0;
  const candidatosFotos: Array<{ localId: string; remoteId: string }> = [];
  const candidatosDetalhe: Array<{ localId: string; remoteId: string }> = [];

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
      const templateNaoAtivo = !!a.templateId && !templatesAtivosIniciais.has(a.templateId);
      if (a.templateId && !templatesLocais.has(a.templateId)) {
        hidratarTemplateStub(db, a.templateId, a.template, now);
        templatesLocais.add(a.templateId);
        console.log(`[pullAuditorias] Template ${a.templateId} (inativo/ausente) hidratado como stub para ${a.id}`);
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
      candidatosFotos.push({ localId, remoteId: a.id });
      if (templateNaoAtivo) {
        candidatosDetalhe.push({ localId, remoteId: a.id });
      }

      for (const item of a.itens ?? []) {
        if (!templateItensLocais.has(item.templateItemId)) {
          continue;
        }
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

  const detalheHidratados = new Set<string>();
  for (const candidato of candidatosDetalhe) {
    if (isAuditoriaPendente(db, candidato.localId)) continue;
    try {
      await pullAuditoriaDetalhe(candidato);
      detalheHidratados.add(candidato.localId);
    } catch (e) {
      console.warn(`[pullAuditorias] Falha ao hidratar detalhe de ${candidato.remoteId}:`, e);
    }
  }

  for (const candidato of candidatosFotos) {
    if (detalheHidratados.has(candidato.localId)) continue;
    if (isAuditoriaPendente(db, candidato.localId)) continue;
    if (auditoriaTemFotosLocais(db, candidato.localId)) continue;
    try {
      await pullAuditoriaFotos(candidato.remoteId);
    } catch (e) {
      console.warn(`[pullAuditorias] Falha ao hidratar fotos de ${candidato.remoteId}:`, e);
    }
  }
}

/**
 * Hidrata localmente o DETALHE completo de uma auditoria a partir de
 * `GET /auditorias/:id` (relations `template`, `itens.templateItem`, `itens.fotos`).
 *
 * Resolve o cenário em que o template da auditoria está inativo/rascunho — a listagem
 * de templates (`GET /checklists/templates`) só traz os ativos, então os `template_itens`
 * não existem localmente e os `auditoria_itens` acabam pulados na inserção (proteção de
 * FK), deixando o checklist vazio. Aqui populamos o stub do template, os `template_itens`
 * faltantes, os `auditoria_itens` (agora com a FK satisfeita) e as fotos remotas.
 *
 * Idempotente e seguro para offline-first: preserva respostas/fotos locais com
 * `sync_status = 'pending'` (não sobrescreve edições ainda não sincronizadas).
 */
export async function pullAuditoriaDetalhe(params: { localId: string; remoteId: string }): Promise<void> {
  const db = getDatabase();
  const detalhe = await getAuditoriaDetalhe(params.remoteId);
  const now = new Date().toISOString();
  const templateId = detalhe.templateId ?? detalhe.template?.id ?? null;
  let itensHidratados = 0;

  db.withTransactionSync(() => {
    if (templateId) {
      hidratarTemplateStub(db, templateId, detalhe.template, now);
    }
    for (const item of detalhe.itens ?? []) {
      const templateItemId = item.templateItem?.id ?? item.templateItemId;
      if (item.templateItem && templateId) {
        upsertTemplateItem(db, templateId, item.templateItem, now);
      }
      const templateItemExiste = db.getFirstSync<{ id: string }>(
        `SELECT id FROM template_itens WHERE id = ?`,
        [templateItemId]
      );
      if (!templateItemExiste) continue;
      db.runSync(
        `INSERT INTO auditoria_itens
           (id, remote_id, auditoria_id, template_item_id, resposta, observacao,
            descricao_nao_conformidade, descricao_ia, complemento_descricao,
            plano_acao_sugerido, plano_acao_final, referencia_legal, pontuacao,
            sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
         ON CONFLICT(id) DO UPDATE SET
           resposta = excluded.resposta,
           observacao = excluded.observacao,
           descricao_nao_conformidade = excluded.descricao_nao_conformidade,
           descricao_ia = excluded.descricao_ia,
           complemento_descricao = excluded.complemento_descricao,
           plano_acao_sugerido = excluded.plano_acao_sugerido,
           plano_acao_final = excluded.plano_acao_final,
           referencia_legal = excluded.referencia_legal,
           pontuacao = excluded.pontuacao,
           remote_id = excluded.remote_id,
           sync_status = 'synced',
           updated_at = excluded.updated_at
         WHERE auditoria_itens.sync_status != 'pending'`,
        [item.id, item.id, params.localId, templateItemId, item.resposta ?? 'nao_avaliado',
         item.observacao ?? null, item.descricaoNaoConformidade ?? null,
         item.descricaoIa ?? null, item.complementoDescricao ?? null,
         item.planoAcaoSugerido ?? null, item.planoAcaoFinal ?? null,
         item.referenciaLegal ?? null, item.pontuacao ?? 0, now]
      );
      itensHidratados++;
    }
  });

  const fotoRepo = new FotoRepo();
  let fotosHidratadas = 0;
  for (const item of detalhe.itens ?? []) {
    for (const foto of item.fotos ?? []) {
      if (!foto.url) continue;
      fotoRepo.upsertRemota({
        id: foto.id,
        auditoriaItemId: item.id,
        url: foto.url,
        analiseIa: foto.analiseIa ?? null,
        tamanhoBytes: foto.tamanhoBytes ?? null,
        latitude: foto.latitude ?? null,
        longitude: foto.longitude ?? null,
      });
      fotosHidratadas++;
    }
  }
  console.log(`[pullAuditoriaDetalhe] ${params.remoteId}: ${itensHidratados} item(ns), ${fotosHidratadas} foto(s) hidratado(s)`);
}

function isAuditoriaPendente(db: SQLite.SQLiteDatabase, localId: string): boolean {
  const row = db.getFirstSync<{ sync_status: string }>(
    `SELECT sync_status FROM auditorias WHERE id = ?`,
    [localId]
  );
  return row?.sync_status === 'pending';
}

function auditoriaTemFotosLocais(db: SQLite.SQLiteDatabase, localId: string): boolean {
  const row = db.getFirstSync<{ total: number }>(
    `SELECT COUNT(f.id) AS total
     FROM fotos f
     JOIN auditoria_itens ai ON ai.id = f.auditoria_item_id
     WHERE ai.auditoria_id = ?`,
    [localId]
  );
  return (row?.total ?? 0) > 0;
}

/**
 * Hidrata as fotos remotas de uma auditoria existente buscando o detalhe
 * (`GET /auditorias/:id`, que inclui `itens.fotos`) e populando o SQLite. Só
 * insere fotos de itens já presentes localmente e não sobrescreve fotos `pending`.
 */
export async function pullAuditoriaFotos(remoteId: string): Promise<void> {
  const db = getDatabase();
  const itensLocais = carregarIdsLocais(db, 'auditoria_itens');
  const detalhe = await getAuditoriaDetalhe(remoteId);
  const fotoRepo = new FotoRepo();
  let inseridas = 0;
  for (const item of detalhe.itens ?? []) {
    if (!itensLocais.has(item.id)) continue;
    for (const foto of item.fotos ?? []) {
      if (!foto.url) continue;
      fotoRepo.upsertRemota({
        id: foto.id,
        auditoriaItemId: item.id,
        url: foto.url,
        analiseIa: foto.analiseIa ?? null,
        tamanhoBytes: foto.tamanhoBytes ?? null,
        latitude: foto.latitude ?? null,
        longitude: foto.longitude ?? null,
      });
      inseridas++;
    }
  }
  console.log(`[pullAuditoriaFotos] ${remoteId}: ${inseridas} foto(s) remota(s) hidratada(s)`);
}

interface RelatorioTecnicoApiPull {
  id: string;
  clienteId?: string;
  unidadeId?: string | null;
  identificacao?: string;
  descricaoOcorrenciaHtml?: string;
  avaliacaoTecnicaHtml?: string;
  acoesExecutadas?: string[];
  recomendacoesConsultoraHtml?: string;
  planoAcaoSugeridoHtml?: string;
  apoioAnaliticoChekAi?: string | null;
  status?: string;
  assinaturaNomeConsultora?: string;
  responsavel?: string;
  pdfUrl?: string | null;
  cliente?: { id: string };
  unidade?: { id: string } | null;
  fotos?: Array<{ id: string; url: string }>;
}

/**
 * Sincroniza (pull) os relatórios técnicos do servidor para o SQLite local,
 * respeitando o vínculo de FK (cliente deve existir localmente) e preservando
 * rascunhos com edição pendente (`sync_status = 'pending'`).
 */
export async function pullRelatoriosTecnicos(): Promise<void> {
  const db = getDatabase();
  const relatorios = await buscarTodasPaginas<RelatorioTecnicoApiPull>('/relatorios-tecnicos');
  console.log(`[pullRelatoriosTecnicos] Recebidos ${relatorios.length} relatórios técnicos`);
  const clientesLocais = carregarIdsLocais(db, 'clientes');
  const unidadesLocais = carregarIdsLocais(db, 'unidades');
  const repo = new RelatorioTecnicoRepo();
  const fotoRepo = new RelatorioFotoRepo();
  let inseridos = 0;
  let ignorados = 0;
  for (const r of relatorios) {
    const clienteId = r.clienteId ?? r.cliente?.id ?? null;
    if (!clienteId || !clientesLocais.has(clienteId)) {
      ignorados++;
      continue;
    }
    const unidadeId = r.unidadeId ?? r.unidade?.id ?? null;
    const unidadeValida = unidadeId && unidadesLocais.has(unidadeId) ? unidadeId : null;
    const localId = repo.findLocalIdByRemote(r.id) ?? r.id;
    repo.upsertRemoto({
      localId,
      remoteId: r.id,
      clienteId,
      unidadeId: unidadeValida,
      identificacao: r.identificacao ?? '',
      descricaoOcorrenciaHtml: r.descricaoOcorrenciaHtml ?? '',
      avaliacaoTecnicaHtml: r.avaliacaoTecnicaHtml ?? '',
      acoesExecutadas: r.acoesExecutadas ?? [],
      recomendacoesConsultoraHtml: r.recomendacoesConsultoraHtml ?? '',
      planoAcaoSugeridoHtml: r.planoAcaoSugeridoHtml ?? '',
      apoioAnalitico: r.apoioAnaliticoChekAi ?? null,
      status: mapearStatusRelatorio(r.status),
      assinaturaNomeConsultora: r.assinaturaNomeConsultora ?? '',
      responsavel: r.responsavel ?? '',
      pdfUrl: r.pdfUrl ?? null,
    });
    inseridos++;
    if (!repo.isPending(localId) && fotoRepo.countByRelatorio(localId) === 0) {
      for (const foto of r.fotos ?? []) {
        if (!foto.url) continue;
        fotoRepo.upsertRemota({ id: foto.id, relatorioId: localId, url: foto.url });
      }
    }
  }
  console.log(`[pullRelatoriosTecnicos] Inseridos/atualizados: ${inseridos}, ignorados (FK ausente): ${ignorados}`);
  setLastSyncedAt(db, 'relatorios_tecnicos', new Date().toISOString());
}

function mapearStatusRelatorio(status: string | undefined): RelatorioTecnicoStatus {
  return status === 'finalizado' ? 'finalizado' : 'rascunho';
}

/**
 * Atualiza o cache local (somente leitura) do check-in aberto do usuário a partir
 * de `GET /checkins/me/aberto`. O fluxo de check-in/checkout permanece online-only
 * (RN-CKI-001/002/003); este pull apenas mantém o estado exibível offline.
 */
export async function pullCheckinAberto(): Promise<void> {
  const usuarioId = useAuthStore.getState().user?.id;
  if (!usuarioId) {
    return;
  }
  const repo = new CheckinRepo();
  const estado = await buscarCheckinAberto();
  const checkin = estado.checkin;
  if (!checkin) {
    repo.limparAberto(usuarioId);
    return;
  }
  repo.salvarAberto({
    id: checkin.id,
    remoteId: checkin.id,
    usuarioId: checkin.usuarioId || usuarioId,
    clienteId: checkin.clienteId,
    clienteNome: checkin.cliente?.nomeFantasia || checkin.cliente?.razaoSocial || null,
    unidadeId: checkin.unidadeId,
    unidadeNome: checkin.unidade?.nome ?? null,
    dataCheckin: checkin.dataCheckin,
    latitudeCheckin: Number(checkin.latitudeCheckin),
    longitudeCheckin: Number(checkin.longitudeCheckin),
    isAtrasado3h: estado.isAtrasado3h,
  });
}

export async function pullAll(): Promise<void> {
  console.log('[pullAll] Iniciando pull de dados...');
  await pullClientes();
  await pullTemplates();
  await pullAuditorias();
  await pullRelatoriosTecnicos();
  try {
    await pullCheckinAberto();
  } catch (e) {
    console.warn('[pullAll] Falha ao atualizar check-in aberto:', e);
  }
  console.log('[pullAll] Pull completo');
}
