import { RecalculoNotaService } from './recalculo-nota.service';

const templateItem = {
  usarRespostasPersonalizadas: true,
  opcoesResposta: ['Conforme', 'Não Conforme', 'Não Aplicável'],
  opcoesRespostaConfig: [],
};

function criar(auditorias: Record<string, { pontuacaoTotal: number; itens: { resposta: string; pontuacao: number }[] }>) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['innerJoin', 'select', 'where', 'andWhere']) qb[m] = jest.fn().mockReturnValue(qb);
  qb.getRawMany = jest.fn().mockResolvedValue(Object.keys(auditorias).map((id) => ({ id })));
  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne: jest.fn(({ where: { id } }) =>
      Promise.resolve({
        id,
        pontuacaoTotal: auditorias[id].pontuacaoTotal,
        itens: auditorias[id].itens.map((i) => ({ ...i, templateItem })),
      }),
    ),
    update: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new RecalculoNotaService(repo as never), repo };
}

describe('RecalculoNotaService', () => {
  it('grava a nota sem o "Não Aplicável" personalizado', async () => {
    const { service, repo } = criar({
      a1: {
        pontuacaoTotal: 33.33,
        itens: [
          { resposta: 'Conforme', pontuacao: 1 },
          { resposta: 'Não Aplicável', pontuacao: 0 },
          { resposta: 'Não Aplicável', pontuacao: 0 },
        ],
      },
    });
    expect(await service.recalcularFinalizadasComNaoAplicavel()).toBe(1);
    expect(repo.update).toHaveBeenCalledWith({ id: 'a1' }, { pontuacaoTotal: 100 });
  });

  it('não grava quando a nota já está certa', async () => {
    const { service, repo } = criar({
      a1: { pontuacaoTotal: 100, itens: [{ resposta: 'Conforme', pontuacao: 1 }, { resposta: 'Não Aplicável', pontuacao: 0 }] },
    });
    expect(await service.recalcularFinalizadasComNaoAplicavel()).toBe(0);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('ignora candidata cujo texto só parece não aplicável', async () => {
    const { service, repo } = criar({
      a1: { pontuacaoTotal: 50, itens: [{ resposta: 'Aplicação correta', pontuacao: 1 }, { resposta: 'Não Conforme', pontuacao: 0 }] },
    });
    expect(await service.recalcularFinalizadasComNaoAplicavel()).toBe(0);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
