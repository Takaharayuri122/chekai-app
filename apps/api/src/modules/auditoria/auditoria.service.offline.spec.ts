import { BadRequestException } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { StatusAuditoria } from './entities/auditoria.entity';
import { LegislacaoVinculoService } from '../legislacao/legislacao-vinculo.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

const gestor = { id: 'g-1', perfil: PerfilUsuario.GESTOR };
const LOCAL_ID = '11111111-1111-4111-8111-111111111111';
const base = { unidadeId: 'u-1', templateId: 't-1' };

describe('AuditoriaService - sincronização offline', () => {
  let service: AuditoriaService;
  let auditoriaRepository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let itemRepository: { create: jest.Mock; save: jest.Mock };
  let checklistService: { buscarTemplatePorId: jest.Mock };

  beforeEach(() => {
    auditoriaRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ ...v, id: 'a-1' })),
      findOne: jest.fn(),
    };
    itemRepository = { create: jest.fn((v) => v), save: jest.fn() };
    checklistService = {
      buscarTemplatePorId: jest.fn().mockResolvedValue({
        itens: [
          { id: 'A', ativo: true },
          { id: 'B', ativo: false },
          { id: 'C', ativo: true },
        ],
      }),
    };
    service = new AuditoriaService(
      auditoriaRepository as never,
      itemRepository as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'u-1', ativo: true, cliente: { id: 'c-1', ativo: true, auditores: [] } }) } as never,
      checklistService as never,
      {} as never,
      {} as never,
      new LegislacaoVinculoService(null as never, null as never, null as never),
    );
    jest.spyOn(service, 'buscarAuditoriaPorId').mockImplementation(async (id: string) => ({ id }) as never);
  });

  it('devolve a auditoria existente quando o mesmo localId é reenviado', async () => {
    const existente = { id: 'a-9', localId: LOCAL_ID };
    auditoriaRepository.findOne.mockResolvedValue(existente);
    const r = await service.iniciarAuditoria('g-1', { ...base, localId: LOCAL_ID }, gestor);
    expect(r).toBe(existente);
    expect(auditoriaRepository.findOne).toHaveBeenCalledWith({ where: { consultorId: 'g-1', localId: LOCAL_ID } });
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });

  it('usa dataInicio do celular', async () => {
    const dataInicio = '2026-11-01T13:05:00.000Z';
    await service.iniciarAuditoria('g-1', { ...base, localId: LOCAL_ID, dataInicio }, gestor);
    const arg = auditoriaRepository.create.mock.calls[0][0];
    expect(arg.dataInicio.getTime()).toBe(new Date(dataInicio).getTime());
    expect(arg.localId).toBe(LOCAL_ID);
  });

  it('sem campos novos mantém itens ativos e data atual', async () => {
    await service.iniciarAuditoria('g-1', base, gestor);
    expect(itemRepository.save.mock.calls[0][0].map((i: { templateItemId: string }) => i.templateItemId)).toEqual(['A', 'C']);
  });

  it('cria itens a partir de templateItemIds do celular', async () => {
    await service.iniciarAuditoria('g-1', { ...base, templateItemIds: ['A', 'B'] }, gestor);
    expect(itemRepository.save.mock.calls[0][0].map((i: { templateItemId: string }) => i.templateItemId)).toEqual(['A', 'B']);
  });

  it('ignora templateItemIds de outro template', async () => {
    await expect(
      service.iniciarAuditoria('g-1', { ...base, templateItemIds: ['A', 'X'] }, gestor),
    ).rejects.toThrow(BadRequestException);
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });

  describe('finalizarAuditoria', () => {
    const auditoriaBase = (status: StatusAuditoria) => ({ id: 'a-1', status, itens: [] });

    it('com dataFim usa o horário do celular', async () => {
      const dataFim = '2026-11-01T15:00:00.000Z';
      const aud = auditoriaBase(StatusAuditoria.EM_ANDAMENTO);
      (service.buscarAuditoriaPorId as jest.Mock).mockResolvedValue(aud);
      auditoriaRepository.save.mockImplementation(async (v) => v);
      await service.finalizarAuditoria('a-1', { dataFim }, gestor).catch(() => undefined);
      expect((aud as unknown as { dataFim: Date }).dataFim.getTime()).toBe(new Date(dataFim).getTime());
    });

    it('repetido com dataFim devolve a auditoria sem erro', async () => {
      const aud = auditoriaBase(StatusAuditoria.FINALIZADA);
      (service.buscarAuditoriaPorId as jest.Mock).mockResolvedValue(aud);
      const r = await service.finalizarAuditoria('a-1', { dataFim: '2026-11-01T15:00:00.000Z' }, gestor);
      expect(r).toBe(aud);
      expect(auditoriaRepository.save).not.toHaveBeenCalled();
    });

    it('repetido sem dataFim continua recusando', async () => {
      (service.buscarAuditoriaPorId as jest.Mock).mockResolvedValue(auditoriaBase(StatusAuditoria.FINALIZADA));
      await expect(service.finalizarAuditoria('a-1', {}, gestor)).rejects.toThrow('Auditoria já finalizada');
    });
  });
});
