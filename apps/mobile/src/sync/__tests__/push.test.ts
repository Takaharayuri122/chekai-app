import { pushPending } from '../push';
import { getDatabase } from '../../db/client';

jest.mock('../../db/client');
jest.mock('../../api/client');
jest.mock('../../api/auditoria.api');
jest.mock('../../db/repositories/auditoria.repo');
jest.mock('../../db/repositories/auditoria-item.repo');
jest.mock('../../db/repositories/foto.repo');

const mockDb = {
  getAllSync: jest.fn(),
  runSync: jest.fn(),
};
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('pushPending', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when sync_queue is empty', async () => {
    mockDb.getAllSync.mockReturnValue([]);
    await pushPending();
    expect(mockDb.runSync).not.toHaveBeenCalled();
  });

  it('increments retries on failure', async () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'q1', entity: 'auditoria', operation: 'push',
        payload: JSON.stringify({ localId: 'local-1' }), retries: 0 },
    ]);

    // AuditoriaRepo.findById returns null → will throw
    const { AuditoriaRepo } = require('../../db/repositories/auditoria.repo');
    AuditoriaRepo.mockImplementation(() => ({
      findById: jest.fn().mockReturnValue(null),
    }));

    await pushPending();

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_queue SET retries'),
      expect.arrayContaining(['q1'])
    );
  });
});
