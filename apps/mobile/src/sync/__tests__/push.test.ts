import { pushPending, pushAuditoria, enviarAuditoriaAgora, enqueuePush, enqueueRelatorioPush } from '../push';
import { getDatabase } from '../../db/client';

jest.mock('../../db/client');
jest.mock('../../api/client', () => {
  class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return { ApiError };
});
jest.mock('../../db/repositories/fila.repo');
jest.mock('../../store/auth', () => ({ useAuthStore: { getState: jest.fn() } }));
jest.mock('../../api/auditoria.api');
jest.mock('../../db/repositories/auditoria.repo');
jest.mock('../../db/repositories/auditoria-item.repo');
jest.mock('../../db/repositories/foto.repo');
jest.mock('../../api/ia.api');
jest.mock('../push-checkin', () => ({ pushCheckin: jest.fn() }));

const mockDb = {
  getAllSync: jest.fn(),
  runSync: jest.fn(),
};
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('pushPending', () => {
  const { FilaRepo } = require('../../db/repositories/fila.repo');
  const { AuditoriaRepo } = require('../../db/repositories/auditoria.repo');
  const { useAuthStore } = require('../../store/auth');
  const { ApiError } = require('../../api/client');
  const api = require('../../api/auditoria.api');
  const fila = FilaRepo.prototype;

  const item = (id: string, localId: string, entidade = 'auditoria') =>
    ({ id, entidade, localId, retries: 0 });

  beforeEach(() => {
    jest.resetAllMocks();
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    useAuthStore.getState.mockReturnValue({ user: { id: 'u1' } });
    fila.estado.mockReturnValue({ status: 'pendente', ultimoErro: null });
    // auditoria existe mas a criação no servidor é controlada por teste
    AuditoriaRepo.prototype.findById.mockReturnValue({
      localId: 'x', clienteId: 'c', unidadeId: 'u', templateId: 't', clienteNome: 'X',
      dataInicio: '2026-11-01T10:00:00.000Z',
    });
    const { AuditoriaItemRepo } = require('../../db/repositories/auditoria-item.repo');
    AuditoriaItemRepo.prototype.findByAuditoria.mockReturnValue([]);
  });

  it('não faz nada quando a fila está vazia', async () => {
    fila.listarParaEnvio.mockReturnValue([]);
    await pushPending();
    expect(fila.registrarFalha).not.toHaveBeenCalled();
    expect(fila.remover).not.toHaveBeenCalled();
  });

  it('não faz nada sem usuária logada', async () => {
    useAuthStore.getState.mockReturnValue({ user: null });
    await pushPending();
    expect(fila.listarParaEnvio).not.toHaveBeenCalled();
  });

  it('só lê itens da usuária logada', async () => {
    fila.listarParaEnvio.mockReturnValue([]);
    await pushPending();
    expect(fila.listarParaEnvio).toHaveBeenCalledWith('u1');
  });

  it('registra falha temporária com a mensagem e mantém o item', async () => {
    fila.listarParaEnvio.mockReturnValue([item('q1', 'L1')]);
    api.createAuditoria.mockRejectedValue(new Error('Network request failed'));
    await pushPending();
    expect(fila.registrarFalha).toHaveBeenCalledWith('q1', 'Network request failed', false);
    expect(fila.remover).not.toHaveBeenCalled();
  });

  it('falha definitiva na primeira auditoria não impede a segunda', async () => {
    fila.listarParaEnvio.mockReturnValue([item('q1', 'L1'), item('q2', 'L2')]);
    api.createAuditoria
      .mockRejectedValueOnce(new ApiError('Dados inválidos', 400))
      .mockResolvedValueOnce({ id: 'R2', itens: [] });
    api.finalizarAuditoria.mockResolvedValue({});
    api.getAuditoria.mockResolvedValue({ pontuacaoTotal: null, pdfUrl: null });
    await pushPending();
    expect(fila.registrarFalha).toHaveBeenCalledWith('q1', 'Dados inválidos', true);
    expect(fila.remover).toHaveBeenCalledWith('q2');
  });

  it('401 interrompe sem incrementar tentativas', async () => {
    fila.listarParaEnvio.mockReturnValue([item('q1', 'L1'), item('q2', 'L2')]);
    api.createAuditoria.mockRejectedValue(new ApiError('Sessão expirada', 401));
    await pushPending();
    expect(fila.registrarFalha).not.toHaveBeenCalled();
    expect(api.createAuditoria).toHaveBeenCalledTimes(1);
  });

  describe('envio imediato', () => {
    beforeEach(() => {
      fila.listarParaEnvio.mockReturnValue([item('q1', 'L1')]);
    });

    it('falha no envio imediato mantém a auditoria na fila com o erro', async () => {
      api.createAuditoria.mockRejectedValue(new ApiError('Dados inválidos', 400));
      await expect(enviarAuditoriaAgora('L1')).rejects.toThrow('Dados inválidos');
      expect(fila.registrarFalha).toHaveBeenCalledWith('q1', 'Dados inválidos', true);
      expect(fila.remover).not.toHaveBeenCalled();
    });

    it('sucesso no envio imediato remove da fila', async () => {
      api.createAuditoria.mockResolvedValue({ id: 'R1', itens: [] });
      api.finalizarAuditoria.mockResolvedValue({});
      api.getAuditoria.mockResolvedValue({ pontuacaoTotal: null, pdfUrl: null });
      await enviarAuditoriaAgora('L1');
      expect(fila.remover).toHaveBeenCalledWith('q1');
      expect(fila.registrarFalha).not.toHaveBeenCalled();
    });

    it('401 no envio imediato deixa pendente sem contar tentativa', async () => {
      api.createAuditoria.mockRejectedValue(new ApiError('Sessão expirada', 401));
      await expect(enviarAuditoriaAgora('L1')).rejects.toThrow();
      expect(fila.registrarFalha).not.toHaveBeenCalled();
    });
  });

  it('não processa o mesmo item em paralelo', async () => {
    fila.listarParaEnvio.mockReturnValue([item('q1', 'L1')]);
    let liberar!: () => void;
    api.createAuditoria.mockImplementation(() => new Promise((res) => {
      liberar = () => res({ id: 'R1', itens: [] });
    }));
    api.finalizarAuditoria.mockResolvedValue({});
    api.getAuditoria.mockResolvedValue({ pontuacaoTotal: null, pdfUrl: null });
    const a = pushPending();
    const b = pushPending();
    await Promise.resolve();
    liberar();
    await Promise.all([a, b]);
    expect(api.createAuditoria).toHaveBeenCalledTimes(1);
    expect(fila.remover).toHaveBeenCalledTimes(1);
  });

  it('envio imediato aguarda o envio em andamento', async () => {
    fila.listarParaEnvio.mockReturnValue([item('q1', 'L1')]);
    let rejeitar!: (e: unknown) => void;
    api.createAuditoria.mockImplementation(() => new Promise((_res, rej) => { rejeitar = rej; }));
    const emBackground = pushPending();
    await Promise.resolve();
    const imediato = enviarAuditoriaAgora('L1');
    rejeitar(new ApiError('Dados inválidos', 400));
    await emBackground;
    await expect(imediato).rejects.toThrow('Dados inválidos');
    expect(api.createAuditoria).toHaveBeenCalledTimes(1);
    expect(fila.registrarFalha).toHaveBeenCalledTimes(1);
  });

  it('pula item que outro envio já removeu da fila', async () => {
    fila.listarParaEnvio.mockReturnValue([item('q1', 'L1')]);
    fila.estado.mockReturnValue(null);
    await pushPending();
    expect(api.createAuditoria).not.toHaveBeenCalled();
  });

  describe('ordem dos check-ins', () => {
    const itemEm = (id: string, localId: string, entidade: string, criadoEm: string) =>
      ({ ...item(id, localId, entidade), criadoEm });

    beforeEach(() => {
      api.createAuditoria.mockResolvedValue({ id: 'R1', itens: [] });
      api.finalizarAuditoria.mockResolvedValue({});
      api.getAuditoria.mockResolvedValue({ pontuacaoTotal: null, pdfUrl: null });
      fila.listarParaEnvio.mockReturnValue([
        itemEm('q1', 'C1', 'checkin', '2026-11-01T09:00:00.000Z'),
        itemEm('q2', 'L1', 'auditoria', '2026-11-01T09:30:00.000Z'),
        itemEm('q3', 'C2', 'checkin', '2026-11-01T10:00:00.000Z'),
      ]);
    });

    it('check-in com falha temporária: os check-ins seguintes esperam; outras entidades seguem', async () => {
      const { pushCheckin } = require('../push-checkin');
      pushCheckin.mockRejectedValueOnce(new Error('Network request failed'));
      await pushPending();
      expect(pushCheckin).toHaveBeenCalledTimes(1);
      expect(pushCheckin).toHaveBeenCalledWith('C1');
      expect(fila.remover).toHaveBeenCalledWith('q2');
      expect(fila.registrarFalha).toHaveBeenCalledTimes(1);
    });

    it('check-in recusado: os check-ins seguintes esperam', async () => {
      const { pushCheckin } = require('../push-checkin');
      pushCheckin.mockRejectedValueOnce(new ApiError('Você já possui um checkin em aberto.', 409));
      await pushPending();
      expect(pushCheckin).toHaveBeenCalledTimes(1);
      expect(fila.registrarFalha).toHaveBeenCalledWith('q1', expect.any(String), true);
      expect(fila.remover).toHaveBeenCalledWith('q2');
    });

    it('check-in anterior já com falha definitiva: os posteriores esperam', async () => {
      const { pushCheckin } = require('../push-checkin');
      fila.listarParaEnvio.mockReturnValue([
        itemEm('q2', 'L1', 'auditoria', '2026-11-01T09:30:00.000Z'),
        itemEm('q3', 'C2', 'checkin', '2026-11-01T10:00:00.000Z'),
      ]);
      fila.primeiraFalhaEm.mockReturnValue('2026-11-01T09:00:00.000Z');
      await pushPending();
      expect(fila.primeiraFalhaEm).toHaveBeenCalledWith('u1', 'checkin');
      expect(pushCheckin).not.toHaveBeenCalled();
      expect(fila.remover).toHaveBeenCalledWith('q2');
    });

    it('sem falhas, todos os check-ins são enviados na ordem', async () => {
      const { pushCheckin } = require('../push-checkin');
      await pushPending();
      expect(pushCheckin.mock.calls).toEqual([['C1'], ['C2']]);
    });
  });

  it('despacha itens de check-in para pushCheckin e remove da fila', async () => {
    const { pushCheckin } = require('../push-checkin');
    fila.listarParaEnvio.mockReturnValue([item('q1', 'C1', 'checkin')]);
    await pushPending();
    expect(pushCheckin).toHaveBeenCalledWith('C1');
    expect(fila.remover).toHaveBeenCalledWith('q1');
    expect(fila.registrarFalha).not.toHaveBeenCalled();
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

  it('já finalizada no servidor (resposta da finalização perdida): conclui sem reenviar itens', async () => {
    api.createAuditoria.mockResolvedValue({ id: 'R1', status: 'finalizada', itens: [{ id: 'ri1', templateItemId: 'ti1' }] });
    api.getAuditoria.mockResolvedValue({ pontuacaoTotal: '87.5', pdfUrl: 'https://pdf' });
    await pushAuditoria('L1');
    expect(api.submitItem).not.toHaveBeenCalled();
    expect(api.uploadFoto).not.toHaveBeenCalled();
    expect(api.finalizarAuditoria).not.toHaveBeenCalled();
    expect(AuditoriaRepo.prototype.markSynced).toHaveBeenCalledWith('L1', 'R1');
    expect(AuditoriaRepo.prototype.updatePontuacao).toHaveBeenCalledWith('L1', 87.5);
    expect(AuditoriaRepo.prototype.updatePdfUrl).toHaveBeenCalledWith('L1', 'https://pdf');
  });

  it('nunca chama a IA', async () => {
    FotoRepo.prototype.findByItem.mockReturnValue([foto({ analiseIa: 'texto' })]);
    await pushAuditoria('L1');
    const fns = Object.values(ia).filter(v => jest.isMockFunction(v)) as jest.Mock[];
    expect(fns.length).toBeGreaterThan(0);
    fns.forEach(fn => expect(fn).not.toHaveBeenCalled());
  });
});

describe('enfileirar sem sessão', () => {
  const { FilaRepo } = require('../../db/repositories/fila.repo');
  const { useAuthStore } = require('../../store/auth');

  beforeEach(() => {
    jest.resetAllMocks();
    useAuthStore.getState.mockReturnValue({ user: null });
  });

  it('enqueuePush lança em vez de fingir que enfileirou', () => {
    expect(() => enqueuePush('L1')).toThrow('Sessão não encontrada');
    expect(FilaRepo.prototype.enfileirar).not.toHaveBeenCalled();
  });

  it('enqueueRelatorioPush lança em vez de fingir que enfileirou', () => {
    expect(() => enqueueRelatorioPush('R1')).toThrow('Sessão não encontrada');
    expect(FilaRepo.prototype.enfileirar).not.toHaveBeenCalled();
  });

  it('com sessão enfileira para a usuária logada', () => {
    useAuthStore.getState.mockReturnValue({ user: { id: 'u1' } });
    enqueuePush('L1');
    expect(FilaRepo.prototype.enfileirar).toHaveBeenCalledWith('auditoria', 'L1', 'u1');
  });
});
