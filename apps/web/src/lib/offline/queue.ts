import { getOfflineDbIfAvailable } from './db';
import type {
  SyncQueueItemRecord,
  SyncQueueItemTipo,
  SyncQueueItemPayload,
} from './types';
import { SYNC_ORDEM } from './types';
import { useOfflineStore } from '../store-offline';

const CONTADOR_DEBOUNCE_MS = 200;
let contadorDebounce: ReturnType<typeof setTimeout> | null = null;

export async function atualizarContadorPendentes(): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  const count = await db.sync_queue.where('status').equals('pendente').count();
  useOfflineStore.getState().setPendingSyncCount(count);
}

export function agendarAtualizacaoContador(): void {
  if (contadorDebounce) clearTimeout(contadorDebounce);
  contadorDebounce = setTimeout(() => {
    contadorDebounce = null;
    atualizarContadorPendentes();
  }, CONTADOR_DEBOUNCE_MS);
}

export async function enfileirar(
  tipo: SyncQueueItemTipo,
  payload: SyncQueueItemPayload,
  auditoriaTempId?: string
): Promise<string> {
  const db = getOfflineDbIfAvailable();
  if (!db) throw new Error('IndexedDB indisponível');
  const id = crypto.randomUUID();
  const ordem = SYNC_ORDEM[tipo];
  const record: SyncQueueItemRecord = {
    id,
    tipo,
    payload,
    auditoriaTempId,
    ordem,
    status: 'pendente',
    criadoEm: Date.now(),
  };
  await db.sync_queue.add(record);
  agendarAtualizacaoContador();
  return id;
}

export async function redefinirItensEmEnvioParaPendente(): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  const emEnvio = await db.sync_queue.where('status').equals('em_envio').toArray();
  for (const item of emEnvio) {
    await db.sync_queue.update(item.id, { status: 'pendente' });
  }
  if (emEnvio.length > 0) agendarAtualizacaoContador();
}

export async function listarPendentesOrdenados(): Promise<SyncQueueItemRecord[]> {
  const db = getOfflineDbIfAvailable();
  if (!db) return [];
  const items = await db.sync_queue
    .where('status')
    .equals('pendente')
    .sortBy('criadoEm');
  return items.sort((a, b) => {
    if (a.auditoriaTempId !== b.auditoriaTempId) {
      const idA = a.auditoriaTempId ?? '';
      const idB = b.auditoriaTempId ?? '';
      return idA.localeCompare(idB);
    }
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return a.criadoEm - b.criadoEm;
  });
}

export async function marcarEmEnvio(id: string): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.sync_queue.update(id, { status: 'em_envio' });
  agendarAtualizacaoContador();
}

export async function marcarConcluido(id: string): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.sync_queue.update(id, { status: 'concluido' });
  agendarAtualizacaoContador();
}

export async function marcarErro(id: string, erro: string): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.sync_queue.update(id, { status: 'erro', erro });
  agendarAtualizacaoContador();
}

export async function contarPendentes(): Promise<number> {
  const db = getOfflineDbIfAvailable();
  if (!db) return 0;
  return db.sync_queue.where('status').equals('pendente').count();
}

export async function obterBlobFoto(blobId: string): Promise<Blob | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.blob_fotos.get(blobId);
  return row?.data ?? null;
}

export async function salvarBlobFoto(blobId: string, blob: Blob): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) throw new Error('IndexedDB indisponível');
  await db.blob_fotos.put({ id: blobId, data: blob });
}

export async function removerBlobFoto(blobId: string): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.blob_fotos.delete(blobId);
}
