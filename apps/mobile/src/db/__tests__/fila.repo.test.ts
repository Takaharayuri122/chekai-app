import { FilaRepo } from '../repositories/fila.repo';
import { getDatabase } from '../client';

jest.mock('../client');
jest.mock('../../utils/uuid', () => ({ gerarUUID: () => 'uuid-1' }));

const mockDb = { runSync: jest.fn(), getAllSync: jest.fn(), getFirstSync: jest.fn() };
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('FilaRepo', () => {
  let repo: FilaRepo;
  beforeEach(() => { jest.clearAllMocks(); repo = new FilaRepo(); });

  it('enfileirar insere item pendente com dona e payload com localId', () => {
    mockDb.getFirstSync.mockReturnValue(undefined);
    repo.enfileirar('checkin', 'L1', 'u1');
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_queue'),
      expect.arrayContaining(['uuid-1', 'checkin', JSON.stringify({ localId: 'L1' }), 'u1']),
    );
  });

  it('enfileirar não duplica; volta falhou para pendente', () => {
    mockDb.getFirstSync.mockReturnValue({ id: 'q1' });
    repo.enfileirar('auditoria', 'L1', 'u1');
    expect(mockDb.runSync).toHaveBeenCalledTimes(1);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'pendente'"),
      expect.arrayContaining(['q1']),
    );
    expect(mockDb.runSync).not.toHaveBeenCalledWith(expect.stringContaining('INSERT'), expect.anything());
  });

  it('listarParaEnvio filtra por usuária (ou NULL) e pendente, ordenado por created_at', () => {
    mockDb.getAllSync.mockReturnValue([
      { id: 'q1', entity: 'checkin', payload: '{"localId":"L1"}', retries: 2 },
    ]);
    const itens = repo.listarParaEnvio('u1');
    const [sql, params] = mockDb.getAllSync.mock.calls[0];
    expect(sql).toContain("status = 'pendente'");
    expect(sql).toContain('usuario_id = ? OR usuario_id IS NULL');
    expect(sql).toContain('ORDER BY created_at');
    expect(params).toEqual(['u1']);
    expect(itens).toEqual([{ id: 'q1', entidade: 'checkin', localId: 'L1', retries: 2 }]);
  });

  it('registrarFalha incrementa retries e marca falhou na definitiva ou na 5a falha', () => {
    repo.registrarFalha('q1', 'erro', true);
    const [sql, params] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain('retries = retries + 1');
    expect(sql).toContain('retries + 1 >= 5');
    expect(sql).toContain("'falhou'");
    expect(params).toEqual(['erro', expect.any(String), 1, 'q1']);
    repo.registrarFalha('q2', 'x', false);
    expect(mockDb.runSync.mock.calls[1][1]).toEqual(['x', expect.any(String), 0, 'q2']);
  });

  it('remover apaga pelo id', () => {
    repo.remover('q1');
    expect(mockDb.runSync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sync_queue'), ['q1']);
  });

  it('tentarDeNovo zera retries e volta a pendente', () => {
    repo.tentarDeNovo('relatorio_tecnico', 'L1');
    const [sql, params] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain('retries = 0');
    expect(sql).toContain("status = 'pendente'");
    expect(params).toEqual([expect.any(String), 'relatorio_tecnico', '{"localId":"L1"}']);
  });

  it('estado retorna status/erro ou null', () => {
    mockDb.getFirstSync.mockReturnValueOnce({ status: 'falhou', ultimo_erro: 'boom' });
    expect(repo.estado('checkin', 'L1')).toEqual({ status: 'falhou', ultimoErro: 'boom' });
    mockDb.getFirstSync.mockReturnValueOnce(undefined);
    expect(repo.estado('checkin', 'L2')).toBeNull();
  });

  it('contarPendentes conta por usuária e opcionalmente por entidade', () => {
    mockDb.getFirstSync.mockReturnValue({ total: 3 });
    expect(repo.contarPendentes('u1')).toBe(3);
    expect(mockDb.getFirstSync.mock.calls[0][1]).toEqual(['u1']);
    repo.contarPendentes('u1', 'checkin');
    expect(mockDb.getFirstSync.mock.calls[1][0]).toContain('entity = ?');
    expect(mockDb.getFirstSync.mock.calls[1][1]).toEqual(['u1', 'checkin']);
  });
});
