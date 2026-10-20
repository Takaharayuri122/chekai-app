import { RelatorioTecnicoRepo } from '../repositories/relatorio-tecnico.repo';
import { getDatabase } from '../client';
import { mesclarComPadrao } from '../../utils/modelo-secoes';

jest.mock('../client');

const mockDb = {
  runSync: jest.fn(),
  getFirstSync: jest.fn(),
  getAllSync: jest.fn(),
};

(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('RelatorioTecnicoRepo — modelo', () => {
  let repo: RelatorioTecnicoRepo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RelatorioTecnicoRepo();
  });

  it('finalizarLocal grava status finalizado com o snapshot do modelo e limpa o aviso', () => {
    const modelo = mesclarComPadrao([{ secao: 'avaliacaoTecnica', ativa: false, titulo: '' }]);
    repo.finalizarLocal('local-1', modelo);
    const [sql, params] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain("status = 'finalizado'");
    expect(sql).toContain('modelo_secoes = ?');
    expect(sql).toContain('aviso_sync = NULL');
    expect(params).toEqual([JSON.stringify(modelo), expect.any(String), 'local-1']);
  });

  it('voltarParaRascunho descarta o snapshot e registra o aviso', () => {
    repo.voltarParaRascunho('local-1', 'Preencha a seção "X"');
    const [sql, params] = mockDb.runSync.mock.calls[0];
    expect(sql).toContain("status = 'rascunho'");
    expect(sql).toContain('modelo_secoes = NULL');
    expect(params).toEqual(['Preencha a seção "X"', expect.any(String), 'local-1']);
  });
});
