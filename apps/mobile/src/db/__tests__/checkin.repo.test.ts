import { CheckinRepo } from '../repositories/checkin.repo';
import { getDatabase } from '../client';

jest.mock('../client');

const mockDb = {
  runSync: jest.fn(),
  getAllSync: jest.fn(),
  getFirstSync: jest.fn(),
  withTransactionSync: jest.fn((fn: () => void) => fn()),
};
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('CheckinRepo (offline)', () => {
  let repo: CheckinRepo;
  beforeEach(() => { jest.clearAllMocks(); repo = new CheckinRepo(); });

  it('salvarOffline grava pendente, com id = local_id e coordenadas opcionais', () => {
    repo.salvarOffline({
      id: 'L1', usuarioId: 'u1', clienteId: 'c1', clienteNome: 'Cliente', unidadeId: 'un1',
      unidadeNome: 'Unidade', dataCheckin: '2026-11-01T12:00:00.000Z',
    });
    const [sql, params] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain('INSERT INTO checkins');
    expect(sql).toContain("'pendente'");
    expect(params.slice(0, 2)).toEqual(['L1', 'L1']);
    expect(params).toContain('2026-11-01T12:00:00.000Z');
    expect(params.filter((p: unknown) => p === null)).toHaveLength(2); // lat/lng nulos
  });

  it('listarRecentesOffline filtra por usuária, marcações locais e janela de dias', () => {
    mockDb.getAllSync.mockReturnValue([{
      id: 'L1', remote_id: null, usuario_id: 'u1', cliente_id: 'c1', cliente_nome: 'Cliente',
      unidade_id: 'un1', unidade_nome: 'Unidade', status: 'aberto',
      data_checkin: '2026-11-01T12:00:00.000Z', data_checkout: null,
      latitude_checkin: null, longitude_checkin: null, latitude_checkout: null, longitude_checkout: null,
      is_atrasado_3h: 0, checkin_offline: 1, checkin_sincronizado_em: null, checkout_offline: 0,
      checkout_sincronizado_em: null, envio_status: 'pendente', envio_erro: null,
    }]);
    const lista = repo.listarRecentesOffline('u1', 7);
    const [sql, params] = mockDb.getAllSync.mock.calls[0];
    expect(sql).toContain('envio_status IS NOT NULL');
    expect(params[0]).toBe('u1');
    const dias = (Date.now() - new Date(params[1]).getTime()) / 86400000;
    expect(Math.round(dias)).toBe(7);
    expect(lista[0]).toMatchObject({
      id: 'L1', envioStatus: 'pendente', checkinOffline: true, latitudeCheckin: null,
    });
  });

  it('descartar remove o registro e o item da fila', () => {
    repo.descartar('L1');
    expect(mockDb.runSync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM checkins'), ['L1']);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM sync_queue'),
      [JSON.stringify({ localId: 'L1' })],
    );
  });

  it('marcarRecusado guarda o motivo', () => {
    repo.marcarRecusado('L1', 'Já existe check-in aberto.');
    const [sql, params] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain("envio_status = 'recusado'");
    expect(params[0]).toBe('Já existe check-in aberto.');
    expect(params[2]).toBe('L1');
  });

  it('marcarEnviado do check-in guarda remote_id e mantém pendente se há checkout local', () => {
    repo.marcarEnviado('L1', 'checkin', 'R1', '2026-11-01T13:00:00.000Z');
    const [sql, params] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain('checkin_sincronizado_em');
    expect(sql).toContain("THEN 'pendente'");
    expect(params[0]).toBe('R1');
    expect(params[params.length - 1]).toBe('L1');
  });

  it('registrarCheckoutOffline fecha localmente e volta a pendente', () => {
    repo.registrarCheckoutOffline('L1', '2026-11-01T15:00:00.000Z', { latitude: 1, longitude: 2 });
    const [sql, params] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain("status = 'fechado'");
    expect(sql).toContain("envio_status = 'pendente'");
    expect(params.slice(0, 3)).toEqual(['2026-11-01T15:00:00.000Z', 1, 2]);
  });

  it('salvarAberto preserva marcações locais e não duplica o check-in já enviado', () => {
    mockDb.getFirstSync.mockReturnValue({ id: 'L1' });
    repo.salvarAberto({
      id: 'R1', remoteId: 'R1', usuarioId: 'u1', clienteId: 'c1', clienteNome: null, unidadeId: 'un1',
      unidadeNome: null, dataCheckin: 'x', latitudeCheckin: 1, longitudeCheckin: 2, isAtrasado3h: false,
    });
    expect(mockDb.runSync.mock.calls[0][0]).toContain('envio_status IS NULL');
    expect(mockDb.runSync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO checkins'))).toBe(false);
  });
});
