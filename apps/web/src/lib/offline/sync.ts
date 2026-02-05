import { auditoriaService } from '../api';
import type { Auditoria } from '../api';
import { useOfflineStore } from '../store-offline';
import { toastService } from '../toast';
import {
  listarPendentesOrdenados,
  marcarEmEnvio,
  marcarConcluido,
  marcarErro,
  obterBlobFoto,
  removerBlobFoto,
  redefinirItensEmEnvioParaPendente,
  atualizarContadorPendentes,
  contarPendentes,
} from './queue';
import { salvarAuditoria, removerAuditoriaCache } from './cache';
import type {
  SyncQueueItemRecord,
  SyncQueueItemPayloadCriarAuditoria,
  SyncQueueItemPayloadResponderItem,
  SyncQueueItemPayloadAdicionarFoto,
  SyncQueueItemPayloadFinalizarAuditoria,
} from './types';
import { ehIdLocal } from './types';

type IdMap = Map<string, string>;
type ItemIdMap = Map<string, string>;

function extrairMensagemErro(err: unknown): string {
  if (err instanceof Error) {
    const ax = err as { response?: { status?: number; data?: { message?: string | string[] } } };
    if (ax.response?.data?.message) {
      const msg = ax.response.data.message;
      return Array.isArray(msg) ? msg.join(', ') : msg;
    }
    return err.message;
  }
  return String(err);
}

function logFalhaSync(
  item: SyncQueueItemRecord,
  err: unknown,
  contexto: string
): void {
  const mensagem = extrairMensagemErro(err);
  const ax = err as { response?: { status?: number; data?: unknown } } | undefined;
  const status = ax?.response?.status;
  console.error('[Sync] Falha ao processar item:', {
    contexto,
    itemId: item.id,
    tipo: item.tipo,
    auditoriaTempId: item.auditoriaTempId,
    mensagem,
    statusHttp: status,
    payload: item.payload,
    erroCompleto: err,
  });
}

function obterTemplateItemId(item: Auditoria['itens'][0] & Record<string, unknown>): string | undefined {
  const rel = item.templateItem ?? item.template_item;
  const idFromRel = rel && typeof rel === 'object' && 'id' in rel ? (rel as { id: string }).id : undefined;
  const idFromCol = item.templateItemId ?? item.template_item_id;
  return (typeof idFromRel === 'string' ? idFromRel : undefined)
    ?? (typeof idFromCol === 'string' ? idFromCol : undefined);
}

function normalizarId(id: string): string {
  return id.trim().toLowerCase();
}

function extrairMapeamentoItens(auditoria: Auditoria): ItemIdMap {
  const map: ItemIdMap = new Map();
  auditoria.itens?.forEach((item) => {
    const templateItemId = obterTemplateItemId(item as Auditoria['itens'][0] & Record<string, unknown>);
    if (templateItemId) map.set(normalizarId(templateItemId), item.id);
  });
  return map;
}

function resolverServerItemId(itemIdMap: ItemIdMap, payloadItemId: string): string | undefined {
  const n = normalizarId(payloadItemId);
  const porChave = itemIdMap.get(n);
  if (porChave) return porChave;
  for (const [, auditoriaItemId] of itemIdMap) {
    if (normalizarId(auditoriaItemId) === n) return auditoriaItemId;
  }
  return undefined;
}

async function processarCriarAuditoria(
  item: SyncQueueItemRecord,
  payload: SyncQueueItemPayloadCriarAuditoria
): Promise<{ serverAuditoriaId: string; itemIdMap: ItemIdMap; auditoria: Auditoria }> {
  const auditoria = await auditoriaService.iniciar(
    payload.unidadeId,
    payload.templateId,
    payload.latitude,
    payload.longitude
  );
  const itemIdMap = extrairMapeamentoItens(auditoria);
  return { serverAuditoriaId: auditoria.id, itemIdMap, auditoria };
}

async function processarResponderItem(
  serverAuditoriaId: string,
  itemIdMap: ItemIdMap,
  payload: SyncQueueItemPayloadResponderItem
): Promise<void> {
  const serverItemId = resolverServerItemId(itemIdMap, payload.templateItemId);
  if (!serverItemId) throw new Error(`Item não encontrado: ${payload.templateItemId}`);
  await auditoriaService.responderItem(
    serverAuditoriaId,
    serverItemId,
    payload.resposta,
    {
      observacao: payload.observacao,
      descricaoNaoConformidade: payload.descricaoNaoConformidade,
      descricaoIa: payload.descricaoIa,
      complementoDescricao: payload.complementoDescricao,
      planoAcaoSugerido: payload.planoAcaoSugerido,
      referenciaLegal: payload.referenciaLegal,
    }
  );
}

async function processarAdicionarFoto(
  serverAuditoriaId: string,
  itemIdMap: ItemIdMap,
  payload: SyncQueueItemPayloadAdicionarFoto
): Promise<void> {
  const serverItemId = resolverServerItemId(itemIdMap, payload.templateItemId);
  if (!serverItemId) throw new Error(`Item não encontrado: ${payload.templateItemId}`);
  const blob = await obterBlobFoto(payload.blobId);
  if (!blob) throw new Error(`Blob não encontrado: ${payload.blobId}`);
  const file = new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' });
  await auditoriaService.adicionarFoto(
    serverAuditoriaId,
    serverItemId,
    file,
    { latitude: payload.latitude, longitude: payload.longitude }
  );
  await removerBlobFoto(payload.blobId);
}

async function processarFinalizarAuditoria(
  serverAuditoriaId: string,
  payload: SyncQueueItemPayloadFinalizarAuditoria
): Promise<void> {
  await auditoriaService.finalizar(serverAuditoriaId, payload.observacoesGerais);
}

export async function executarSincronizacao(): Promise<void> {
  const setSyncing = useOfflineStore.getState().setSyncing;
  if (useOfflineStore.getState().isSyncing) return;
  setSyncing(true);
  try {
    await redefinirItensEmEnvioParaPendente();
    const pendentes = await listarPendentesOrdenados();
    if (pendentes.length === 0) return;
    console.info('[Sync] Iniciando sincronização:', {
      totalItens: pendentes.length,
      tipos: pendentes.map((p) => p.tipo),
      auditoriasTempIds: [...new Set(pendentes.map((p) => p.auditoriaTempId).filter(Boolean))],
    });
    const auditoriaMap: Map<string, { serverId: string; itemIdMap: ItemIdMap }> = new Map();
    let concluidos = 0;
    let erros = 0;
    for (const item of pendentes) {
      try {
        await marcarEmEnvio(item.id);
        const tempId = item.auditoriaTempId;
        if (item.tipo === 'criar_auditoria') {
          const payload = item.payload as SyncQueueItemPayloadCriarAuditoria;
          console.info('[Sync] Processando criar_auditoria:', { unidadeId: payload.unidadeId, templateId: payload.templateId });
          const { serverAuditoriaId, itemIdMap, auditoria } = await processarCriarAuditoria(item, payload);
          console.info('[Sync] criar_auditoria OK:', { serverAuditoriaId, itensMapeados: itemIdMap.size });
          if (tempId) {
            auditoriaMap.set(tempId, { serverId: serverAuditoriaId, itemIdMap });
            await salvarAuditoria(serverAuditoriaId, auditoria);
            await removerAuditoriaCache(tempId);
          }
          await marcarConcluido(item.id);
          concluidos++;
          continue;
        }
        if (!tempId) {
          const msg = 'auditoriaTempId ausente';
          logFalhaSync(item, new Error(msg), 'item sem auditoriaTempId');
          await marcarErro(item.id, msg);
          erros++;
          continue;
        }
        let mapped = auditoriaMap.get(tempId);
        if (!mapped && !ehIdLocal(tempId)) {
          const auditoria = await auditoriaService.buscarPorId(tempId);
          const itemIdMap = extrairMapeamentoItens(auditoria);
          mapped = { serverId: tempId, itemIdMap };
          auditoriaMap.set(tempId, mapped);
        }
        if (!mapped) {
          const msg = 'auditoria ainda não criada na fila (criar_auditoria falhou ou ordem incorreta)';
          logFalhaSync(item, new Error(msg), 'auditoria não mapeada');
          await marcarErro(item.id, msg);
          erros++;
          continue;
        }
        const { serverId, itemIdMap } = mapped;
        if (item.tipo === 'responder_item') {
          await processarResponderItem(serverId, itemIdMap, item.payload as SyncQueueItemPayloadResponderItem);
          await marcarConcluido(item.id);
          concluidos++;
        } else if (item.tipo === 'adicionar_foto') {
          await processarAdicionarFoto(serverId, itemIdMap, item.payload as SyncQueueItemPayloadAdicionarFoto);
          await marcarConcluido(item.id);
          concluidos++;
        } else if (item.tipo === 'finalizar_auditoria') {
          await processarFinalizarAuditoria(serverId, item.payload as SyncQueueItemPayloadFinalizarAuditoria);
          await marcarConcluido(item.id);
          concluidos++;
          auditoriaMap.delete(tempId);
        }
      } catch (err) {
        erros++;
        const message = extrairMensagemErro(err);
        logFalhaSync(item, err, 'exceção ao processar');
        await marcarErro(item.id, message);
        const is401 = typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status === 401
          : false;
        if (is401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          break;
        }
      }
    }
    if (typeof window !== 'undefined') {
      if (erros === 0 && concluidos > 0) {
        toastService.success('Dados sincronizados com sucesso.');
      } else if (erros > 0) {
        toastService.error(
          `${concluidos} item(ns) sincronizado(s). ${erros} falha(s). Verifique a conexão e tente novamente.`
        );
      }
    }
  } finally {
    setSyncing(false);
    await atualizarContadorPendentes();
  }
}

const ATRASO_APOS_ONLINE_MS = 1500;

export function registrarListenerOnline(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    setTimeout(() => {
      executarSincronizacao();
    }, ATRASO_APOS_ONLINE_MS);
  });
}

/**
 * Deve ser chamado ao montar o app: se estiver online e houver pendências, inicia a sync.
 */
export async function tentarSincronizarAoCarregar(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;
  const pendentes = await contarPendentes();
  if (pendentes === 0) return;
  setTimeout(() => {
    executarSincronizacao();
  }, 800);
}
