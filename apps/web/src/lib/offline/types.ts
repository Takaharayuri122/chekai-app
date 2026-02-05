export type SyncQueueItemTipo =
  | 'criar_auditoria'
  | 'responder_item'
  | 'adicionar_foto'
  | 'finalizar_auditoria';

export type SyncQueueItemStatus = 'pendente' | 'em_envio' | 'concluido' | 'erro';

export interface SyncQueueItemPayloadCriarAuditoria {
  unidadeId: string;
  templateId: string;
  latitude?: number;
  longitude?: number;
}

export interface SyncQueueItemPayloadResponderItem {
  templateItemId: string;
  resposta: string;
  observacao?: string;
  descricaoNaoConformidade?: string;
  descricaoIa?: string;
  complementoDescricao?: string;
  planoAcaoSugerido?: string;
  referenciaLegal?: string;
}

export interface SyncQueueItemPayloadAdicionarFoto {
  templateItemId: string;
  blobId: string;
  latitude?: number;
  longitude?: number;
}

export interface SyncQueueItemPayloadFinalizarAuditoria {
  observacoesGerais?: string;
}

export type SyncQueueItemPayload =
  | SyncQueueItemPayloadCriarAuditoria
  | SyncQueueItemPayloadResponderItem
  | SyncQueueItemPayloadAdicionarFoto
  | SyncQueueItemPayloadFinalizarAuditoria;

export interface SyncQueueItemRecord {
  id: string;
  tipo: SyncQueueItemTipo;
  payload: SyncQueueItemPayload;
  auditoriaTempId?: string;
  ordem: number;
  status: SyncQueueItemStatus;
  erro?: string;
  criadoEm: number;
}

export const SYNC_ORDEM: Record<SyncQueueItemTipo, number> = {
  criar_auditoria: 0,
  responder_item: 1,
  adicionar_foto: 1,
  finalizar_auditoria: 2,
};

export const PREFIXO_ID_LOCAL = 'local-';

export function ehIdLocal(id: string): boolean {
  return id.startsWith(PREFIXO_ID_LOCAL);
}

export function gerarIdLocal(): string {
  return `${PREFIXO_ID_LOCAL}${crypto.randomUUID()}`;
}
