import Dexie, { type Table } from 'dexie';
import type { SyncQueueItemRecord } from './types';

const DB_NAME = 'chekai-offline';
const DB_VERSION = 1;

interface CacheTemplateRow {
  id: string;
  data: unknown;
  cachedAt: number;
}

interface CacheUnidadesRow {
  id: string;
  data: unknown;
  cachedAt: number;
}

interface CacheAuditoriaRow {
  id: string;
  data: unknown;
  cachedAt: number;
}

interface BlobFotoRow {
  id: string;
  data: Blob;
}

export class OfflineDatabase extends Dexie {
  cache_templates!: Table<CacheTemplateRow, string>;
  cache_unidades!: Table<CacheUnidadesRow, string>;
  cache_auditorias!: Table<CacheAuditoriaRow, string>;
  sync_queue!: Table<SyncQueueItemRecord, string>;
  blob_fotos!: Table<BlobFotoRow, string>;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      cache_templates: 'id, cachedAt',
      cache_unidades: 'id, cachedAt',
      cache_auditorias: 'id, cachedAt',
      sync_queue: 'id, status, auditoriaTempId, ordem, criadoEm',
      blob_fotos: 'id',
    });
  }
}

let dbInstance: OfflineDatabase | null = null;

export function getOfflineDb(): OfflineDatabase {
  if (typeof window === 'undefined') {
    throw new Error('OfflineDatabase só pode ser usada no cliente');
  }
  if (!dbInstance) {
    dbInstance = new OfflineDatabase();
  }
  return dbInstance;
}

export function getOfflineDbIfAvailable(): OfflineDatabase | null {
  if (typeof window === 'undefined') return null;
  if (!dbInstance) {
    dbInstance = new OfflineDatabase();
  }
  return dbInstance;
}
