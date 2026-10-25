import { BadRequestException, ConflictException } from '@nestjs/common';
import { LegislacaoService } from './legislacao.service';
import { TipoLegislacao } from './entities/legislacao.entity';
import { LinkInvalidoError } from './lib/url-segura';

describe('LegislacaoService', () => {
  let service: LegislacaoService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    query: jest.Mock;
    remove: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let leitura: { validarLink: jest.Mock; iniciar: jest.Mock };
  let qbGetOne: jest.Mock;
  let chunkRepo: { delete: jest.Mock; findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    qbGetOne = jest.fn().mockResolvedValue(null);
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
      create: jest.fn().mockImplementation((d) => ({ ...d })),
      createQueryBuilder: jest.fn().mockImplementation(() => {
        const qb = { select: () => qb, where: () => qb, andWhere: () => qb, getOne: qbGetOne };
        return qb;
      }),
    };
    chunkRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn(),
    };
    const config = { get: jest.fn().mockReturnValue('sk-teste') };
    leitura = {
      validarLink: jest.fn().mockResolvedValue(undefined),
      iniciar: jest.fn().mockImplementation((id) => Promise.resolve({ id, statusLeitura: 'lendo' })),
    };
    service = new LegislacaoService(
      repo as never,
      chunkRepo as never,
      {} as never,
      config as never,
      leitura as never,
    );
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

  it('criarLegislacao normaliza o link, valida antes de gravar e dispara a leitura', async () => {
    repo.save.mockImplementation((l) => Promise.resolve({ ...l, id: 'nova' }));
    const usuario = { id: 'u1', perfil: 'gestor' } as never;
    const l = await service.criarLegislacao({ linkOficial: ' https://X.gov.br/a/#topo ', titulo: 'T' }, usuario);
    expect(leitura.validarLink).toHaveBeenCalledWith('https://x.gov.br/a');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ linkOficial: 'https://x.gov.br/a', criadoPorId: 'u1', titulo: 'T' }),
    );
    expect(leitura.iniciar).toHaveBeenCalledWith('nova', usuario, { tipo: 'link' });
    expect(l).toMatchObject({ id: 'nova', statusLeitura: 'lendo' });
  });

  it('criarLegislacao com link já cadastrado dá 409 com o id', async () => {
    qbGetOne.mockResolvedValue({ id: 'existente' });
    const chamada = service.criarLegislacao({ linkOficial: 'https://x.gov.br/a/', titulo: 'T' }, { id: 'u1' } as never);
    await expect(chamada).rejects.toThrow(ConflictException);
    await chamada.catch((e: ConflictException) => {
      expect(e.getResponse()).toEqual({ message: 'Esta legislação já está cadastrada.', id: 'existente' });
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('criarLegislacao com link não público dá 400 sem gravar', async () => {
    leitura.validarLink.mockRejectedValue(new LinkInvalidoError('Este link não é um endereço público permitido.'));
    await expect(
      service.criarLegislacao({ linkOficial: 'http://10.0.0.1/a', titulo: 'T' }, { id: 'u1' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  describe('atualizarLegislacao com link', () => {
    beforeEach(() => repo.findOne.mockResolvedValue({ id: 'l1', linkOficial: 'https://x.gov.br/velho' }));

    it('normaliza e valida o novo link', async () => {
      const l = await service.atualizarLegislacao('l1', { linkOficial: 'https://X.gov.br/novo/' });
      expect(leitura.validarLink).toHaveBeenCalledWith('https://x.gov.br/novo');
      expect(l.linkOficial).toBe('https://x.gov.br/novo');
    });

    it('409 com id se outro registro já usa o link', async () => {
      qbGetOne.mockResolvedValue({ id: 'outra' });
      const chamada = service.atualizarLegislacao('l1', { linkOficial: 'https://x.gov.br/novo' });
      await expect(chamada).rejects.toThrow(ConflictException);
      await chamada.catch((e: ConflictException) => {
        expect(e.getResponse()).toEqual({ message: 'Esta legislação já está cadastrada.', id: 'outra' });
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('ignora a própria legislação na checagem', async () => {
      const andWhere = jest.fn();
      repo.createQueryBuilder.mockImplementation(() => {
        const qb = { select: () => qb, where: () => qb, andWhere: (...a: unknown[]) => (andWhere(...a), qb), getOne: qbGetOne };
        return qb;
      });
      await service.atualizarLegislacao('l1', { linkOficial: 'https://x.gov.br/velho' });
      expect(andWhere).toHaveBeenCalledWith('legislacao.id <> :ignorarId', { ignorarId: 'l1' });
    });

    it('link não público dá 400', async () => {
      leitura.validarLink.mockRejectedValue(new LinkInvalidoError('Este link não é um endereço público permitido.'));
      await expect(service.atualizarLegislacao('l1', { linkOficial: 'http://10.0.0.1/' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sem link no corpo não valida', async () => {
      await service.atualizarLegislacao('l1', { titulo: 'Novo' });
      expect(leitura.validarLink).not.toHaveBeenCalled();
    });
  });

  it('adicionarChunks continua a ordem a partir do maior existente', async () => {
    repo.findOne.mockResolvedValue({ id: 'l1' });
    chunkRepo.findOne.mockResolvedValue({ ordem: 4 });
    jest.spyOn(service, 'gerarEmbedding').mockResolvedValue([0.1]);
    await service.adicionarChunks('l1', [{ conteudo: 'a' }, { conteudo: 'b' }]);
    expect(chunkRepo.create.mock.calls.map((c) => c[0].ordem)).toEqual([5, 6]);
  });
});
