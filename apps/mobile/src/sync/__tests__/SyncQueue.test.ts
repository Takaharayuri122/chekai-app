import { SyncQueue } from '../SyncQueue';

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => {
    const store: Record<string, string> = {};
    return {
      getString: (key: string) => store[key],
      set: (key: string, value: string) => { store[key] = value; },
      delete: (key: string) => { delete store[key]; },
      getAllKeys: () => Object.keys(store),
    };
  }),
}));

describe('SyncQueue', () => {
  let queue: SyncQueue;

  beforeEach(() => {
    queue = new SyncQueue();
    queue.clear();
  });

  it('deve enfileirar uma operação', () => {
    queue.enqueue({ entity: 'auditoria', operation: 'create', payload: { id: '1' } });
    expect(queue.size()).toBe(1);
  });

  it('deve retornar operações em ordem FIFO', () => {
    queue.enqueue({ entity: 'auditoria', operation: 'create', payload: { id: '1' } });
    queue.enqueue({ entity: 'auditoria_item', operation: 'update', payload: { id: '2' } });

    const items = queue.getAll();
    expect(items[0].entity).toBe('auditoria');
    expect(items[1].entity).toBe('auditoria_item');
  });

  it('deve remover operação da fila', () => {
    queue.enqueue({ entity: 'auditoria', operation: 'create', payload: { id: '1' } });
    const items = queue.getAll();
    queue.remove(items[0].id);
    expect(queue.size()).toBe(0);
  });

  it('deve incrementar retries', () => {
    queue.enqueue({ entity: 'foto', operation: 'create', payload: { id: '1' }, filePath: '/local/foto.jpg' });
    const [item] = queue.getAll();
    queue.incrementRetries(item.id);
    const [updated] = queue.getAll();
    expect(updated.retries).toBe(1);
  });

  it('deve retornar itens com mais de N retries', () => {
    queue.enqueue({ entity: 'foto', operation: 'create', payload: { id: '1' } });
    const [item] = queue.getAll();
    queue.incrementRetries(item.id);
    queue.incrementRetries(item.id);
    queue.incrementRetries(item.id);
    queue.incrementRetries(item.id);
    queue.incrementRetries(item.id);

    const conflicts = queue.getConflicts(5);
    expect(conflicts).toHaveLength(1);
  });
});
