import { useCheckinStore } from '../../store/checkin';

const mockRepo = {
  salvarAberto: jest.fn(),
  findAberto: jest.fn(),
  salvarOffline: jest.fn(),
  registrarCheckoutOffline: jest.fn(),
  limparAberto: jest.fn(),
  temEnvioPendente: jest.fn(),
};
jest.mock('../../db/repositories/checkin.repo', () => ({
  // Proxy: o repo é instanciado no import do store, antes desta constante existir
  CheckinRepo: jest.fn(() => new Proxy({}, { get: (_a, k: string) => mockRepo[k as keyof typeof mockRepo] })),
}));
const mockFila = { enfileirar: jest.fn() };
jest.mock('../../db/repositories/fila.repo', () => ({
  FilaRepo: jest.fn(() => new Proxy({}, { get: (_a, k: string) => mockFila[k as keyof typeof mockFila] })),
}));
jest.mock('../../api/checkin.api', () => ({
  buscarCheckinAberto: jest.fn(),
  buscarAlertaCheckin: jest.fn(),
  iniciarCheckin: jest.fn(),
  finalizarCheckin: jest.fn(),
}));
jest.mock('../../api/client', () => ({ ApiError: class ApiError extends Error {} }));
jest.mock('../SyncService', () => ({ SyncService: { isOnline: jest.fn() } }));
jest.mock('../../utils/conexao', () => ({ temInternet: jest.fn() }));
jest.mock('../../utils/uuid', () => ({ gerarUUID: () => 'local-1' }));

const api = require('../../api/checkin.api');
const { temInternet } = require('../../utils/conexao');

const T0 = new Date('2026-11-01T10:00:00.000Z');

describe('store de check-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: T0 });
    temInternet.mockResolvedValue(true);
    mockRepo.findAberto.mockReturnValue(null);
    useCheckinStore.setState({ checkinAberto: null, isLoading: false });
  });

  afterEach(() => jest.useRealTimers());

  const demoraEFalhaRede = () => async () => {
    jest.setSystemTime(new Date(T0.getTime() + 45_000)); // a tentativa online demorou 45 s
    throw new Error('Network request failed');
  };

  it('check-in: guarda a hora do toque, não a do fim da tentativa online', async () => {
    api.iniciarCheckin.mockImplementation(demoraEFalhaRede());
    await useCheckinStore.getState().iniciar('u1', { clienteId: 'c1', unidadeId: 'un1' });
    expect(mockRepo.salvarOffline).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'local-1', dataCheckin: T0.toISOString() }),
    );
  });

  it('checkout: guarda a hora do toque, não a do fim da tentativa online', async () => {
    useCheckinStore.setState({ checkinAberto: { id: 'ck1', remoteId: 'r1' } as never });
    api.finalizarCheckin.mockImplementation(demoraEFalhaRede());
    await useCheckinStore.getState().finalizar('u1', null);
    expect(mockRepo.registrarCheckoutOffline).toHaveBeenCalledWith('ck1', T0.toISOString(), null);
  });

  it('check-in do servidor sem localização fica sem localização (não 0,0)', async () => {
    api.iniciarCheckin.mockResolvedValue({
      id: 'r1', usuarioId: 'u1', clienteId: 'c1', unidadeId: 'un1', status: 'aberto',
      dataCheckin: T0.toISOString(), latitudeCheckin: null, longitudeCheckin: null,
    });
    await useCheckinStore.getState().iniciar('u1', { clienteId: 'c1', unidadeId: 'un1' });
    expect(mockRepo.salvarAberto).toHaveBeenCalledWith(
      expect.objectContaining({ latitudeCheckin: null, longitudeCheckin: null }),
    );
  });

  it('coordenadas do servidor em texto viram número', async () => {
    api.iniciarCheckin.mockResolvedValue({
      id: 'r1', usuarioId: 'u1', clienteId: 'c1', unidadeId: 'un1', status: 'aberto',
      dataCheckin: T0.toISOString(), latitudeCheckin: '-23.5', longitudeCheckin: '-46.6',
    });
    await useCheckinStore.getState().iniciar('u1', { clienteId: 'c1', unidadeId: 'un1' });
    expect(mockRepo.salvarAberto).toHaveBeenCalledWith(
      expect.objectContaining({ latitudeCheckin: -23.5, longitudeCheckin: -46.6 }),
    );
  });
});
