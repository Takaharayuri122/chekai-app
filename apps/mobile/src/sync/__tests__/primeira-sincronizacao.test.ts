import { jaSincronizouAlgumaVez } from '../pull';
import { getDatabase } from '../../db/client';

jest.mock('../../db/client');
jest.mock('../../api/client');
jest.mock('../../api/auditoria.api');
jest.mock('../../api/checkin.api');
jest.mock('../../api/relatorio-tecnico.api');
jest.mock('../../db/repositories/foto.repo');
jest.mock('../../db/repositories/relatorio-tecnico.repo');
jest.mock('../../db/repositories/relatorio-foto.repo');
jest.mock('../../db/repositories/checkin.repo');
jest.mock('../../store/auth');
jest.mock('../../store/modelo-relatorio');

const mockDb = { getFirstSync: jest.fn() };
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('jaSincronizouAlgumaVez', () => {
  beforeEach(() => jest.clearAllMocks());

  it('falso sem registro em sync_meta', () => {
    mockDb.getFirstSync.mockReturnValue(null);
    expect(jaSincronizouAlgumaVez()).toBe(false);
  });

  it('verdadeiro com registro', () => {
    mockDb.getFirstSync.mockReturnValue({ last_synced_at: '2026-11-01T10:00:00.000Z' });
    expect(jaSincronizouAlgumaVez()).toBe(true);
  });
});
