import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'sync-queue' });
const QUEUE_KEY = 'queue_items';

export interface SyncQueueItem {
  id: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  filePath?: string;
  retries: number;
  createdAt: string;
}

export type EnqueueInput = Omit<SyncQueueItem, 'id' | 'retries' | 'createdAt'>;

export class SyncQueue {
  private getItems(): SyncQueueItem[] {
    const raw = storage.getString(QUEUE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as SyncQueueItem[];
    } catch {
      return [];
    }
  }

  private saveItems(items: SyncQueueItem[]): void {
    storage.set(QUEUE_KEY, JSON.stringify(items));
  }

  enqueue(input: EnqueueInput): SyncQueueItem {
    const item: SyncQueueItem = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      retries: 0,
      createdAt: new Date().toISOString(),
    };
    const items = this.getItems();
    items.push(item);
    this.saveItems(items);
    return item;
  }

  getAll(): SyncQueueItem[] {
    return this.getItems();
  }

  remove(id: string): void {
    const items = this.getItems().filter((i) => i.id !== id);
    this.saveItems(items);
  }

  incrementRetries(id: string): void {
    const items = this.getItems().map((i) =>
      i.id === id ? { ...i, retries: i.retries + 1 } : i
    );
    this.saveItems(items);
  }

  getConflicts(maxRetries: number): SyncQueueItem[] {
    return this.getItems().filter((i) => i.retries >= maxRetries);
  }

  size(): number {
    return this.getItems().length;
  }

  clear(): void {
    storage.delete(QUEUE_KEY);
  }
}

// Singleton exportado
export const syncQueue = new SyncQueue();
