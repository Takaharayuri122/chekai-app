import { ResultadoAuditoriaService } from './resultado-auditoria.service';
import { StatusAuditoria } from '../entities/auditoria.entity';

function criarServico(anteriores: { id: string; dataFim: Date; pontuacaoTotal: number }[] = [], planos = 0) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['leftJoin', 'where', 'andWhere', 'orderBy', 'take']) qb[m] = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue(anteriores);
  const auditoriaRepository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const planoRepository = { count: jest.fn().mockResolvedValue(planos) };
  const service = new ResultadoAuditoriaService(auditoriaRepository as never, planoRepository as never);
  return { service, qb, planoRepository };
}

const grupo = { nome: 'Cozinha', ordem: 1 };
const itemPadrao = (resposta: string, pontuacao: number, fotos = 0) => ({
  resposta,
  pontuacao,
  fotos: Array.from({ length: fotos }, () => ({})),
  templateItem: { grupoId: 'g1', grupo },
});

function auditoriaBase(extra: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    unidadeId: 'un-1',
    templateId: 't-1',
    status: StatusAuditoria.FINALIZADA,
    dataFim: new Date('2026-10-20T12:00:00Z'),
    pontuacaoTotal: 82.5,
    template: { faixasClassificacao: null },
    itens: [itemPadrao('conforme', 1), itemPadrao('conforme', 1)],
    ...extra,
  } as never;
}

describe('ResultadoAuditoriaService.calcular', () => {
  it('finalizada usa a nota gravada, não a recalculada', async () => {
    const { service } = criarServico();
    const r = await service.calcular(auditoriaBase());
    expect(r.aproveitamento).toBe(82.5);
    expect(r.classificacao.nome).toBe('Bom');
    expect(r.grupos[0].aproveitamento).toBe(100);
  });

  it('não finalizada recalcula pontos realizados / possíveis', async () => {
    const { service } = criarServico();
    const r = await service.calcular(
      auditoriaBase({
        status: StatusAuditoria.EM_ANDAMENTO,
        pontuacaoTotal: null,
        itens: [itemPadrao('conforme', 1), itemPadrao('nao_conforme', 0)],
      }),
    );
    expect(r.aproveitamento).toBe(50);
    expect(r.contadores).toMatchObject({ pontosPossiveis: 2, pontosRealizados: 1, naoConformidades: 1 });
  });

  it('devolve só 3 anteriores e tendência vs. a imediatamente anterior', async () => {
    const ant = [85, 70, 60].map((n, i) => ({ id: `p-${i}`, dataFim: new Date(`2026-10-1${5 - i}T12:00:00Z`), pontuacaoTotal: n }));
    const { service, qb } = criarServico(ant);
    const r = await service.calcular(auditoriaBase());
    expect(r.anteriores.map((a) => a.aproveitamento)).toEqual([85, 70, 60]);
    expect(qb.take).toHaveBeenCalledWith(3);
    expect(r.tendencia).toBe('caiu');
  });

  it('sem anteriores, tendência é null; nota igual é igual', async () => {
    expect((await criarServico().service.calcular(auditoriaBase())).tendencia).toBeNull();
    const ant = [{ id: 'p', dataFim: new Date('2026-10-10T12:00:00Z'), pontuacaoTotal: 82.5 }];
    expect((await criarServico(ant).service.calcular(auditoriaBase())).tendencia).toBe('igual');
  });

  it('sem usuário não aplica isolamento; com usuário aplica', async () => {
    const sem = criarServico();
    await sem.service.calcular(auditoriaBase());
    expect(JSON.stringify(sem.qb.andWhere.mock.calls)).not.toContain('userId');
    const com = criarServico();
    await com.service.calcular(auditoriaBase(), { id: 'u-1', perfil: 'auditor' as never });
    expect(JSON.stringify(com.qb.andWhere.mock.calls)).toContain('userId');
  });

  it('usa as faixas do checklist', async () => {
    const faixas = [{ nome: 'Ótimo', cor: '#00FF00', emoji: null, de: 0, ate: 100 }];
    const r = await criarServico().service.calcular(auditoriaBase({ template: { faixasClassificacao: faixas } }));
    expect(r.classificacao.nome).toBe('Ótimo');
    expect(r.faixas).toEqual(faixas);
  });

  it('conta resposta personalizada "Não" como não conformidade, fotos, N/A, não respondidas e planos', async () => {
    const tpl = { grupoId: 'g1', grupo, usarRespostasPersonalizadas: true, opcoesResposta: ['Sim', 'Não'] };
    const itens = [
      { resposta: 'Não', pontuacao: 0, fotos: [{}, {}], templateItem: tpl },
      { resposta: 'Sim', pontuacao: 1, fotos: [], templateItem: tpl },
      itemPadrao('nao_aplicavel', 0),
      itemPadrao('nao_avaliado', 0),
    ];
    const { service } = criarServico([], 4);
    const r = await service.calcular(auditoriaBase({ itens }));
    expect(r.contadores).toMatchObject({ naoConformidades: 1, fotos: 2, planosAcao: 4 });
    expect(r.grupos[0]).toMatchObject({ naoAplicaveis: 1, naoRespondidas: 1, naoConformidades: 1 });
  });

  it('grupo sem pontos possíveis tem aproveitamento null', async () => {
    const r = await criarServico().service.calcular(auditoriaBase({ itens: [itemPadrao('nao_aplicavel', 0)] }));
    expect(r.grupos[0].aproveitamento).toBeNull();
  });
});
