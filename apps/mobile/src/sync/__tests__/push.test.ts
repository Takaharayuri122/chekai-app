import { pushPending, pushAuditoria } from '../push';
import { getDatabase } from '../../db/client';

jest.mock('../../db/client');
jest.mock('../../api/client');
jest.mock('../../api/auditoria.api');
jest.mock('../../db/repositories/auditoria.repo');
jest.mock('../../db/repositories/auditoria-item.repo');
jest.mock('../../db/repositories/foto.repo');
jest.mock('../../api/ia.api');

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

describe('pushAuditoria retomável', () => {
  const { AuditoriaRepo } = require('../../db/repositories/auditoria.repo');
  const { AuditoriaItemRepo } = require('../../db/repositories/auditoria-item.repo');
  const { FotoRepo } = require('../../db/repositories/foto.repo');
  const api = require('../../api/auditoria.api');
  const ia = require('../../api/ia.api');
  const calls: string[] = [];

  const foto = (over: object = {}) => ({
    id: 'f1', filePath: 'file:///f1.jpg', remoteId: null, syncStatus: 'pending', analiseIa: null, ...over,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    calls.length = 0;
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    AuditoriaRepo.prototype.findById.mockReturnValue({
      localId: 'L1', clienteId: 'c', unidadeId: 'u', templateId: 't', clienteNome: 'X',
      dataInicio: '2026-11-01T10:00:00.000Z', dataFim: '2026-11-01T11:00:00.000Z',
      latitudeInicio: null, longitudeInicio: null, latitudeFim: null, longitudeFim: null,
      observacoesGerais: null,
    });
    AuditoriaItemRepo.prototype.findByAuditoria.mockReturnValue([
      { id: 'i1', templateItemId: 'ti1', resposta: 'sim', pontuacao: 1 },
    ]);
    FotoRepo.prototype.findByItem.mockReturnValue([foto()]);
    AuditoriaRepo.prototype.setRemoteId.mockImplementation(() => calls.push('setRemoteId'));
    api.createAuditoria.mockImplementation(async () => {
      calls.push('create');
      return { id: 'R1', itens: [{ id: 'ri1', templateItemId: 'ti1' }] };
    });
    api.submitItem.mockImplementation(async () => { calls.push('submitItem'); });
    api.uploadFoto.mockResolvedValue({ id: 'rf1', url: 'u' });
    api.finalizarAuditoria.mockResolvedValue({});
    api.getAuditoria.mockResolvedValue({ pontuacaoTotal: null, pdfUrl: null });
  });

  it('envia localId, dataInicio e os templateItemIds dos itens locais', async () => {
    await pushAuditoria('L1');
    expect(api.createAuditoria).toHaveBeenCalledWith(expect.objectContaining({
      localId: 'L1', dataInicio: '2026-11-01T10:00:00.000Z', templateItemIds: ['ti1'],
    }));
  });

  it('grava o remoteId logo após criar, antes de enviar itens', async () => {
    await pushAuditoria('L1');
    expect(AuditoriaRepo.prototype.setRemoteId).toHaveBeenCalledWith('L1', 'R1');
    expect(calls.slice(0, 3)).toEqual(['create', 'setRemoteId', 'submitItem']);
  });

  it('pula fotos já enviadas', async () => {
    FotoRepo.prototype.findByItem.mockReturnValue([foto({ syncStatus: 'synced', remoteId: 'rf0' })]);
    await pushAuditoria('L1');
    expect(api.uploadFoto).not.toHaveBeenCalled();
    expect(api.finalizarAuditoria).toHaveBeenCalled();
  });

  it('não finaliza quando uma foto falha', async () => {
    api.uploadFoto.mockRejectedValue(new Error('rede'));
    await expect(pushAuditoria('L1')).rejects.toThrow();
    expect(api.finalizarAuditoria).not.toHaveBeenCalled();
    expect(AuditoriaRepo.prototype.markSynced).not.toHaveBeenCalled();
  });

  it('finaliza com dataFim local', async () => {
    await pushAuditoria('L1');
    expect(api.finalizarAuditoria).toHaveBeenCalledWith('R1', expect.objectContaining({
      dataFim: '2026-11-01T11:00:00.000Z',
    }));
    expect(AuditoriaRepo.prototype.markSynced).toHaveBeenCalledWith('L1', 'R1');
  });

  it('nunca chama a IA', async () => {
    FotoRepo.prototype.findByItem.mockReturnValue([foto({ analiseIa: 'texto' })]);
    await pushAuditoria('L1');
    const fns = Object.values(ia).filter(v => jest.isMockFunction(v)) as jest.Mock[];
    expect(fns.length).toBeGreaterThan(0);
    fns.forEach(fn => expect(fn).not.toHaveBeenCalled());
  });
});
