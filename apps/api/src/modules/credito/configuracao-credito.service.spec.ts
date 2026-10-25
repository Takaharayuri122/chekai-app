import { ConfiguracaoCreditoService } from './configuracao-credito.service';
import { ProvedorIa } from './entities/uso-credito.entity';

describe('ConfiguracaoCreditoService', () => {
  let service: ConfiguracaoCreditoService;
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (e) => e),
    };
    service = new ConfiguracaoCreditoService(repo as any, {} as any);
  });

  it('inicializarConfiguracoesPadrao cria o padrão de embeddings quando ausente', async () => {
    await service.inicializarConfiguracoesPadrao();
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        provedor: ProvedorIa.OPENAI,
        modelo: 'text-embedding-3-small',
        tokensPorCredito: 100000,
      }),
    );
  });

  it('buscarConfiguracao cria o padrão de embeddings quando não há registro', async () => {
    const config = await service.buscarConfiguracao(ProvedorIa.OPENAI, 'text-embedding-3-small');
    expect(config).toEqual(
      expect.objectContaining({ modelo: 'text-embedding-3-small', tokensPorCredito: 100000 }),
    );
  });
});
