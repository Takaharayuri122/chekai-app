import { BadRequestException, ConflictException } from '@nestjs/common';
import { LegislacaoService } from './legislacao.service';
import { TipoLegislacao } from './entities/legislacao.entity';

describe('LegislacaoService', () => {
  let service: LegislacaoService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    query: jest.Mock;
    remove: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let chunkRepo: { delete: jest.Mock; findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
      create: jest.fn().mockImplementation((d) => ({ ...d })),
    };
    chunkRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn(),
    };
    const config = { get: jest.fn().mockReturnValue('sk-teste') };
    service = new LegislacaoService(repo as never, chunkRepo as never, {} as never, config as never);
  });

  it('listarOpcoes devolve só ativas, ordenadas pelo nome curto', async () => {
    repo.find.mockResolvedValue([
      { id: '1', tipo: TipoLegislacao.RDC, numero: '216', ano: 2004, titulo: 'Boas Práticas', situacao: 'vigente' },
      { id: '2', tipo: TipoLegislacao.LEI, numero: '8078', ano: 1990, titulo: 'Código do Consumidor', situacao: null },
      { id: '3', tipo: TipoLegislacao.DECRETO, numero: '10', ano: 2000, titulo: 'Decreto X', situacao: null },
    ]);
    const opcoes = await service.listarOpcoes();
    expect(repo.find).toHaveBeenCalledWith({ where: { ativo: true } });
    expect(opcoes.map((o) => o.nome)).toEqual(['Decreto 10/2000', 'Lei 8078/1990', 'RDC 216/2004']);
    expect(opcoes[0]).toEqual({ id: '3', nome: 'Decreto 10/2000', titulo: 'Decreto X', situacao: null });
  });

  it('remover com vínculo dá 409 com a mensagem da spec', async () => {
    repo.findOne.mockResolvedValue({ id: 'l1' });
    repo.query.mockResolvedValue([{ total: '2' }]);
    const chamada = service.remover('l1');
    await expect(chamada).rejects.toThrow(ConflictException);
    await expect(service.remover('l1')).rejects.toThrow(
      'Esta legislação está ligada a perguntas ou não conformidades. Desative em vez de remover.',
    );
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('remover sem vínculo apaga', async () => {
    repo.findOne.mockResolvedValue({ id: 'l1' });
    repo.query.mockResolvedValue([{ total: '0' }]);
    await service.remover('l1');
    expect(repo.remove).toHaveBeenCalled();
  });

  it('buscarPorIds falha se alguma estiver inativa ou faltar', async () => {
    repo.find.mockResolvedValue([{ id: 'a' }]);
    await expect(service.buscarPorIds(['a', 'b'])).rejects.toThrow(BadRequestException);
    await expect(service.buscarPorIds(['a', 'b'])).rejects.toThrow('Legislação não encontrada.');
  });

  it('buscarPorIds devolve as legislações ativas', async () => {
    repo.find.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    await expect(service.buscarPorIds(['a', 'b', 'a'])).resolves.toHaveLength(2);
  });

  it('criarLegislacao cria pendente', async () => {
    const l = await service.criarLegislacao({ linkOficial: 'https://x.gov.br/a', titulo: 'T' }, 'u1');
    expect(l).toMatchObject({ statusLeitura: 'pendente', criadoPorId: 'u1', titulo: 'T' });
  });

  it('adicionarChunks continua a ordem a partir do maior existente', async () => {
    repo.findOne.mockResolvedValue({ id: 'l1' });
    chunkRepo.findOne.mockResolvedValue({ ordem: 4 });
    jest.spyOn(service, 'gerarEmbedding').mockResolvedValue([0.1]);
    await service.adicionarChunks('l1', [{ conteudo: 'a' }, { conteudo: 'b' }]);
    expect(chunkRepo.create.mock.calls.map((c) => c[0].ordem)).toEqual([5, 6]);
  });
});
