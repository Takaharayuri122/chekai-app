import { pushPending } from '../push';
import { getDatabase } from '../../db/client';
import { ApiError } from '../../api/client';
import { atualizarRelatorioTecnico, uploadRelatorioFoto } from '../../api/relatorio-tecnico.api';
import { pullModeloRelatorioTecnico } from '../pull';

jest.mock('../../db/client', () => ({ getDatabase: jest.fn() }));
const mockFila = { estado: jest.fn(() => ({ status: 'pendente', ultimoErro: null })), listarParaEnvio: jest.fn(), registrarFalha: jest.fn(), remover: jest.fn(), primeiraFalhaEm: jest.fn(() => null) };
jest.mock('../../db/repositories/fila.repo', () => ({
  FilaRepo: jest.fn(
    () => new Proxy({}, { get: (_alvo, chave: string) => mockFila[chave as keyof typeof mockFila] }),
  ),
}));
jest.mock('../../store/auth', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'u1' } }) },
}));
jest.mock('../../api/client', () => {
  class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return { ApiError };
});
jest.mock('../../api/auditoria.api', () => ({}));
jest.mock('../../api/relatorio-tecnico.api', () => ({
  iniciarRelatorioTecnico: jest.fn(),
  atualizarRelatorioTecnico: jest.fn(),
  uploadRelatorioFoto: jest.fn(),
}));
jest.mock('../pull', () => ({ pullModeloRelatorioTecnico: jest.fn() }));
jest.mock('../../utils/uuid', () => ({ gerarUUID: () => 'uuid-1' }));
jest.mock('../../db/repositories/auditoria.repo', () => ({ AuditoriaRepo: jest.fn() }));
jest.mock('../../db/repositories/auditoria-item.repo', () => ({ AuditoriaItemRepo: jest.fn() }));
jest.mock('../../db/repositories/foto.repo', () => ({ FotoRepo: jest.fn() }));
const mockRelatorioFotoRepo = { findPendentes: jest.fn(() => [] as unknown[]), markSynced: jest.fn() };
jest.mock('../../db/repositories/relatorio-foto.repo', () => ({
  RelatorioFotoRepo: jest.fn(
    () => new Proxy({}, { get: (_alvo, chave: string) => mockRelatorioFotoRepo[chave as keyof typeof mockRelatorioFotoRepo] }),
  ),
}));
const mockRelatorioRepo = {
  findById: jest.fn(),
  voltarParaRascunho: jest.fn(),
  markSynced: jest.fn(),
  setRemoteId: jest.fn(),
};
jest.mock('../../db/repositories/relatorio-tecnico.repo', () => ({
  // Proxy: o repo é instanciado no import de push.ts, antes desta constante existir
  RelatorioTecnicoRepo: jest.fn(
    () => new Proxy({}, { get: (_alvo, chave: string) => mockRelatorioRepo[chave as keyof typeof mockRelatorioRepo] }),
  ),
}));

const mockDb = { getAllSync: jest.fn(), runSync: jest.fn() };
(getDatabase as jest.Mock).mockReturnValue(mockDb);

const relatorioFinalizado = {
  id: 'local-1',
  remoteId: 'remote-1',
  clienteId: 'c1',
  unidadeId: 'u1',
  clienteNome: 'Cliente',
  identificacao: 'Cozinha',
  descricaoOcorrenciaHtml: '<p>a</p>',
  avaliacaoTecnicaHtml: '',
  acoesExecutadas: ['x'],
  recomendacoesConsultoraHtml: '<p>c</p>',
  planoAcaoSugeridoHtml: '<p>d</p>',
  assinaturaNomeConsultora: 'Ana',
  responsavel: '',
  status: 'finalizado',
};

describe('pushRelatorioTecnico com modelo desatualizado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (atualizarRelatorioTecnico as jest.Mock).mockReset();
    mockFila.listarParaEnvio.mockReturnValue([
      { id: 'q1', entidade: 'relatorio_tecnico', localId: 'local-1', retries: 0 },
    ]);
    mockRelatorioRepo.findById.mockReturnValue(relatorioFinalizado);
  });

  it('volta para rascunho com aviso quando a API recusa a finalização (409)', async () => {
    const mensagem = 'Preencha a seção "Avaliação Técnica" antes de finalizar o relatório';
    (atualizarRelatorioTecnico as jest.Mock)
      .mockRejectedValueOnce(new ApiError(mensagem, 409))
      .mockResolvedValueOnce({});

    await pushPending();

    expect(mockRelatorioRepo.voltarParaRascunho).toHaveBeenCalledWith('local-1', mensagem);
    expect(pullModeloRelatorioTecnico).toHaveBeenCalled();
    const segundaChamada = (atualizarRelatorioTecnico as jest.Mock).mock.calls[1][1];
    expect(segundaChamada.status).toBeUndefined();
    expect(mockRelatorioRepo.markSynced).toHaveBeenCalledWith('local-1', 'remote-1');
    expect(mockFila.remover).toHaveBeenCalledWith('q1');
  });

  it('outros erros mantêm o item na fila', async () => {
    (atualizarRelatorioTecnico as jest.Mock).mockRejectedValueOnce(new ApiError('Erro interno', 500));

    await pushPending();

    expect(mockRelatorioRepo.voltarParaRascunho).not.toHaveBeenCalled();
    expect(mockFila.registrarFalha).toHaveBeenCalledWith('q1', 'Erro interno', false);
    expect(mockFila.remover).not.toHaveBeenCalled();
  });
});

describe('pushRelatorioTecnico com foto que falha', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (atualizarRelatorioTecnico as jest.Mock).mockReset();
    mockFila.listarParaEnvio.mockReturnValue([
      { id: 'q1', entidade: 'relatorio_tecnico', localId: 'local-1', retries: 0 },
    ]);
    mockRelatorioRepo.findById.mockReturnValue(relatorioFinalizado);
    mockRelatorioFotoRepo.findPendentes.mockReturnValue([
      { id: 'f1', filePath: 'file:///f1.jpg' },
      { id: 'f2', filePath: 'file:///f2.jpg' },
    ]);
  });

  afterEach(() => mockRelatorioFotoRepo.findPendentes.mockReturnValue([]));

  it('não finaliza o relatório e mantém o item na fila', async () => {
    (uploadRelatorioFoto as jest.Mock)
      .mockResolvedValueOnce({ id: 'rf1', url: 'u1' })
      .mockRejectedValueOnce(new Error('Network request failed'));

    await pushPending();

    expect(mockRelatorioFotoRepo.markSynced).toHaveBeenCalledWith('f1', 'rf1', 'u1');
    expect(atualizarRelatorioTecnico).not.toHaveBeenCalled();
    expect(mockRelatorioRepo.markSynced).not.toHaveBeenCalled();
    expect(mockFila.remover).not.toHaveBeenCalled();
    expect(mockFila.registrarFalha).toHaveBeenCalledWith('q1', expect.stringContaining('foto'), false);
  });
});
