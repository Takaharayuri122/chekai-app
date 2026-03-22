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

  it('remove deletes the foto by id', () => {
    repo.remove('f1');
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM fotos'),
      ['f1']
    );
  });

  it('findByAuditoria returns photos for all items in the audit', () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'f1', auditoria_item_id: 'item-1', file_path: '/path.jpg',
        url: null, remote_id: null, sync_status: 'pending',
        latitude: null, longitude: null },
    ]);

    const fotos = repo.findByAuditoria('audit-1');
    expect(fotos).toHaveLength(1);
    expect(fotos[0].remoteId).toBeNull();
  });
});
