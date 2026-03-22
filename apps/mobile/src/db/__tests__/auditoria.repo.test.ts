import { AuditoriaRepo } from '../repositories/auditoria.repo';
import { getDatabase } from '../client';

jest.mock('../client');

const mockDb = {
  runSync: jest.fn(),
  getFirstSync: jest.fn(),
  getAllSync: jest.fn(),
};

(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('AuditoriaRepo', () => {
  let repo: AuditoriaRepo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AuditoriaRepo();
  });

  it('create inserts row with status=rascunho and sync_status=pending', () => {
    repo.create({
      id: 'local-1',
      clienteId: 'c1',
      unidadeId: 'u1',
      templateId: 't1',
      dataInicio: '2026-03-22T10:00:00.000Z',
    });

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auditorias'),
      expect.arrayContaining(['local-1', 'local-1', 'c1', 'u1', 't1'])
    );
  });

  it('findAll returns mapped rows', () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'local-1', status: 'rascunho', sync_status: 'pending',
        razao_social: 'Cliente A', nome_unidade: 'Unidade 1',
        data_inicio: '2026-03-22T10:00:00.000Z', pontuacao_total: null },
    ]);

    const result = repo.findAll();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('local-1');
    expect(result[0].status).toBe('rascunho');
  });

  it('markSynced updates remote_id and sync_status', () => {
    repo.markSynced('local-1', 'remote-uuid');

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE auditorias'),
      expect.arrayContaining(['remote-uuid', 'synced', 'local-1'])
    );
  });

  it('setSyncStatus updates sync_status', () => {
    repo.setSyncStatus('local-1', 'error');

    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE auditorias SET sync_status'),
      ['error', 'local-1']
    );
  });
});
