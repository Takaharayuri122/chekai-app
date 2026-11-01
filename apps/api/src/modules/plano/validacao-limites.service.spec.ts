import { BadRequestException } from '@nestjs/common';
import { ValidacaoLimitesService } from './validacao-limites.service';

const momento = new Date('2026-11-01T09:00:00.000Z');

describe('ValidacaoLimitesService - auditorias iniciadas offline', () => {
  let service: ValidacaoLimitesService;
  let queryBuilder: Record<string, jest.Mock>;
  let assinaturaService: { buscarAssinaturaAtivaComValidacao: jest.Mock; buscarAssinaturaVigenteEm: jest.Mock };

  beforeEach(() => {
    queryBuilder = {};
    queryBuilder.where = jest.fn().mockReturnValue(queryBuilder);
    queryBuilder.andWhere = jest.fn().mockReturnValue(queryBuilder);
    queryBuilder.getCount = jest.fn().mockResolvedValue(9);
    assinaturaService = {
      buscarAssinaturaAtivaComValidacao: jest.fn().mockResolvedValue(null),
      buscarAssinaturaVigenteEm: jest.fn().mockResolvedValue({ plano: { limiteAuditorias: 10 } }),
    };
    service = new ValidacaoLimitesService(
      { find: jest.fn().mockResolvedValue([{ id: 'g-1' }]) } as never,
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as never,
      {} as never,
      assinaturaService as never,
    );
  });

  it('aceita auditoria offline iniciada quando o limite ainda não estava atingido', async () => {
    await expect(service.validarLimiteAuditorias('g-1', momento)).resolves.toBeUndefined();
    expect(assinaturaService.buscarAssinaturaVigenteEm).toHaveBeenCalledWith('g-1', momento);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('auditoria.dataInicio < :momento', { momento });
  });

  it('recusa quando já estava atingido no momento', async () => {
    queryBuilder.getCount.mockResolvedValue(10);
    await expect(service.validarLimiteAuditorias('g-1', momento)).rejects.toThrow(BadRequestException);
  });

  it('aceita com assinatura vencida depois do momento', async () => {
    // a assinatura atual já expirou (null), mas estava vigente no momento do início
    expect(await assinaturaService.buscarAssinaturaAtivaComValidacao('g-1')).toBeNull();
    await expect(service.validarLimiteAuditorias('g-1', momento)).resolves.toBeUndefined();
  });

  it('recusa quando não havia assinatura vigente no momento', async () => {
    assinaturaService.buscarAssinaturaVigenteEm.mockResolvedValue(null);
    await expect(service.validarLimiteAuditorias('g-1', momento)).rejects.toThrow('Gestor não possui assinatura ativa');
  });

  it('sem momento mantém o comportamento atual', async () => {
    assinaturaService.buscarAssinaturaAtivaComValidacao.mockResolvedValue({ plano: { limiteAuditorias: 10 } });
    await service.validarLimiteAuditorias('g-1');
    expect(assinaturaService.buscarAssinaturaAtivaComValidacao).toHaveBeenCalledWith('g-1');
    expect(assinaturaService.buscarAssinaturaVigenteEm).not.toHaveBeenCalled();
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();
  });
});
