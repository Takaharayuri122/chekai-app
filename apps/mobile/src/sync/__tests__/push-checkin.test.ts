import { pushCheckin } from '../push-checkin';
import { iniciarCheckin, finalizarCheckin } from '../../api/checkin.api';
import { ApiError } from '../../api/client';

jest.mock('../../db/client', () => ({ getDatabase: jest.fn() }));
jest.mock('../../api/client', () => {
  class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return { ApiError };
});
jest.mock('../../api/checkin.api', () => ({ iniciarCheckin: jest.fn(), finalizarCheckin: jest.fn() }));
const mockRepo = {
  findPorId: jest.fn(),
  marcarEnviado: jest.fn(),
  marcarRecusado: jest.fn(),
};
jest.mock('../../db/repositories/checkin.repo', () => ({
  CheckinRepo: jest.fn(
    () => new Proxy({}, { get: (_alvo, chave: string) => mockRepo[chave as keyof typeof mockRepo] }),
  ),
}));

const base = {
  id: 'L1', remoteId: null, usuarioId: 'u1', clienteId: 'c1', unidadeId: 'un1',
  status: 'aberto', dataCheckin: '2026-11-01T12:00:00.000Z', dataCheckout: null,
  latitudeCheckin: -22.9, longitudeCheckin: -43.2, latitudeCheckout: null, longitudeCheckout: null,
  checkinOffline: true, checkoutOffline: false, checkoutSincronizadoEm: null, envioStatus: 'pendente',
};

describe('pushCheckin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (iniciarCheckin as jest.Mock).mockResolvedValue({ id: 'R1' });
    (finalizarCheckin as jest.Mock).mockResolvedValue({ id: 'R1' });
  });

  it('envia check-in e checkout offline na ordem', async () => {
    mockRepo.findPorId.mockReturnValue({
      ...base, status: 'fechado', dataCheckout: '2026-11-01T15:00:00.000Z', checkoutOffline: true,
      latitudeCheckout: -22.8, longitudeCheckout: -43.1,
    });
    await pushCheckin('L1');
    expect(iniciarCheckin).toHaveBeenCalledWith({
      clienteId: 'c1', unidadeId: 'un1', latitude: -22.9, longitude: -43.2,
      localId: 'L1', dataCheckin: '2026-11-01T12:00:00.000Z', offline: true,
    });
    expect(finalizarCheckin).toHaveBeenCalledWith('R1', {
      dataCheckout: '2026-11-01T15:00:00.000Z', offline: true, latitude: -22.8, longitude: -43.1,
    });
    expect((iniciarCheckin as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((finalizarCheckin as jest.Mock).mock.invocationCallOrder[0]);
    expect(mockRepo.marcarEnviado).toHaveBeenNthCalledWith(1, 'L1', 'checkin', 'R1', expect.any(String));
    expect(mockRepo.marcarEnviado).toHaveBeenNthCalledWith(2, 'L1', 'checkout', 'R1', expect.any(String));
  });

  it('não reenvia check-in já enviado; só o checkout', async () => {
    mockRepo.findPorId.mockReturnValue({
      ...base, remoteId: 'R1', status: 'fechado', dataCheckout: '2026-11-01T15:00:00.000Z',
      checkoutOffline: true,
    });
    await pushCheckin('L1');
    expect(iniciarCheckin).not.toHaveBeenCalled();
    expect(finalizarCheckin).toHaveBeenCalledWith('R1', expect.objectContaining({ offline: true }));
    expect(mockRepo.marcarEnviado).toHaveBeenCalledTimes(1);
    expect(mockRepo.marcarEnviado).toHaveBeenCalledWith('L1', 'checkout', 'R1', expect.any(String));
  });

  it('409 marca recusado com a mensagem do servidor e relança', async () => {
    mockRepo.findPorId.mockReturnValue(base);
    const erro = new ApiError('Você já possui um check-in aberto.', 409);
    (iniciarCheckin as jest.Mock).mockRejectedValue(erro);
    await expect(pushCheckin('L1')).rejects.toBe(erro);
    expect(mockRepo.marcarRecusado).toHaveBeenCalledWith('L1', 'Você já possui um check-in aberto.');
    expect(mockRepo.marcarEnviado).not.toHaveBeenCalled();
  });

  it('erro de rede não marca recusado (continua na fila)', async () => {
    mockRepo.findPorId.mockReturnValue(base);
    (iniciarCheckin as jest.Mock).mockRejectedValue(new Error('Network request failed'));
    await expect(pushCheckin('L1')).rejects.toThrow('Network request failed');
    expect(mockRepo.marcarRecusado).not.toHaveBeenCalled();
  });

  it('envia sem localização quando não há coordenadas', async () => {
    mockRepo.findPorId.mockReturnValue({ ...base, latitudeCheckin: null, longitudeCheckin: null });
    await pushCheckin('L1');
    const payload = (iniciarCheckin as jest.Mock).mock.calls[0][0];
    expect(payload.latitude).toBeUndefined();
    expect(payload.longitude).toBeUndefined();
    expect(payload).toMatchObject({ localId: 'L1', offline: true });
  });

  it('envia checkout registrado durante o envio do check-in', async () => {
    mockRepo.findPorId
      .mockReturnValueOnce(base)
      .mockReturnValueOnce({
        ...base, remoteId: 'R1', status: 'fechado', dataCheckout: '2026-11-01T15:00:00.000Z',
        checkoutOffline: true,
      });
    await pushCheckin('L1');
    expect(iniciarCheckin).toHaveBeenCalledTimes(1);
    expect(finalizarCheckin).toHaveBeenCalledWith('R1', expect.objectContaining({
      dataCheckout: '2026-11-01T15:00:00.000Z', offline: true,
    }));
    expect(mockRepo.marcarEnviado).toHaveBeenLastCalledWith('L1', 'checkout', 'R1', expect.any(String));
  });

  it('marcação descartada (inexistente) não envia nada', async () => {
    mockRepo.findPorId.mockReturnValue(null);
    await pushCheckin('L1');
    expect(iniciarCheckin).not.toHaveBeenCalled();
  });
});
