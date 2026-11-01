import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
  let unidadeRepository: { findOne: jest.Mock };
  let desvinculoRepository: { findOne: jest.Mock };
  let validacaoLimites: { identificarGestorId: jest.Mock; validarLimiteAuditorias: jest.Mock };

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
    unidadeRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'u-1', ativo: true, cliente: { id: 'c-1', ativo: true, auditores: [] } }),
    };
    desvinculoRepository = { findOne: jest.fn().mockResolvedValue(null) };
    validacaoLimites = {
      identificarGestorId: jest.fn().mockReturnValue('g-1'),
      validarLimiteAuditorias: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuditoriaService(
      auditoriaRepository as never,
      itemRepository as never,
      {} as never,
      unidadeRepository as never,
      checklistService as never,
      {} as never,
      {} as never,
      new LegislacaoVinculoService(null as never, null as never, null as never),
      validacaoLimites,
      desvinculoRepository as never,
    );
    jest.spyOn(service, 'buscarAuditoriaPorId').mockImplementation(async (id: string) => ({ id }) as never);
  });

  it('devolve a auditoria existente quando o mesmo localId é reenviado', async () => {
    const existente = { id: 'a-9', localId: LOCAL_ID };
    const completa = { id: 'a-9', itens: [{ id: 'i-1', templateItemId: 'A' }] };
    auditoriaRepository.findOne.mockResolvedValue(existente);
    (service.buscarAuditoriaPorId as jest.Mock).mockResolvedValue(completa);
    const r = await service.iniciarAuditoria('g-1', { ...base, localId: LOCAL_ID }, gestor);
    expect(r).toBe(completa);
    expect(r.itens).toHaveLength(1);
    expect(service.buscarAuditoriaPorId).toHaveBeenCalledWith('a-9', gestor);
    expect(auditoriaRepository.create).not.toHaveBeenCalled();
    expect(itemRepository.save).not.toHaveBeenCalled();
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

  describe('bloqueios posteriores ao início offline', () => {
    const inicio = '2026-11-01T09:00:00.000Z';
    const offline = { ...base, localId: LOCAL_ID, dataInicio: inicio };
    const auditor = { id: 'au-1', perfil: PerfilUsuario.AUDITOR, gestorId: 'g-1' };
    const unidadeCom = (cliente: object, unidade: object = {}) =>
      unidadeRepository.findOne.mockResolvedValue({ id: 'u-1', ativo: true, ...unidade, cliente: { id: 'c-1', ativo: true, auditores: [], ...cliente } });

    it('passa dataInicio como momento aos limites só no fluxo offline', async () => {
      await service.iniciarAuditoria('g-1', offline, gestor);
      expect(validacaoLimites.validarLimiteAuditorias).toHaveBeenCalledWith('g-1', new Date(inicio));
      await service.iniciarAuditoria('g-1', base, gestor);
      expect(validacaoLimites.validarLimiteAuditorias).toHaveBeenLastCalledWith('g-1', undefined);
      await service.iniciarAuditoria('g-1', { ...base, dataInicio: inicio }, gestor);
      expect(validacaoLimites.validarLimiteAuditorias).toHaveBeenLastCalledWith('g-1', undefined);
    });

    it('aceita unidade inativada depois do início offline', async () => {
      unidadeCom({}, { ativo: false, inativadoEm: new Date('2026-11-01T10:00:00.000Z') });
      await expect(service.iniciarAuditoria('g-1', offline, gestor)).resolves.toBeDefined();
    });

    it('recusa unidade inativada antes do início', async () => {
      unidadeCom({}, { ativo: false, inativadoEm: new Date('2026-11-01T08:00:00.000Z') });
      await expect(service.iniciarAuditoria('g-1', offline, gestor)).rejects.toThrow(
        'Esta unidade está inativa e não pode receber novas auditorias',
      );
    });

    it('recusa unidade inativa sem data de inativação mesmo no fluxo offline', async () => {
      unidadeCom({}, { ativo: false, inativadoEm: null });
      await expect(service.iniciarAuditoria('g-1', offline, gestor)).rejects.toThrow(BadRequestException);
    });

    it('aceita cliente inativado depois do início offline', async () => {
      unidadeCom({ ativo: false, inativadoEm: new Date('2026-11-01T10:00:00.000Z') });
      await expect(service.iniciarAuditoria('g-1', offline, gestor)).resolves.toBeDefined();
    });

    it('recusa cliente inativado antes do início', async () => {
      unidadeCom({ ativo: false, inativadoEm: new Date('2026-11-01T08:00:00.000Z') });
      await expect(service.iniciarAuditoria('g-1', offline, gestor)).rejects.toThrow(
        'Este cliente está inativo e não pode receber novas auditorias',
      );
    });

    it('sem momento, cliente inativo continua recusado', async () => {
      unidadeCom({ ativo: false, inativadoEm: new Date('2026-11-01T10:00:00.000Z') });
      await expect(service.iniciarAuditoria('g-1', base, gestor)).rejects.toThrow(BadRequestException);
    });

    it('aceita auditor desvinculado depois do início offline', async () => {
      desvinculoRepository.findOne.mockResolvedValue({ desvinculadoEm: new Date('2026-11-01T10:00:00.000Z') });
      await expect(service.iniciarAuditoria('au-1', offline, auditor)).resolves.toBeDefined();
    });

    it('recusa auditor desvinculado antes do início ou sem desvínculo registrado', async () => {
      desvinculoRepository.findOne.mockResolvedValue(null);
      await expect(service.iniciarAuditoria('au-1', offline, auditor)).rejects.toThrow(ForbiddenException);
    });

    it('sem momento, auditor não vinculado continua recusado', async () => {
      desvinculoRepository.findOne.mockResolvedValue({ desvinculadoEm: new Date('2026-11-01T10:00:00.000Z') });
      await expect(service.iniciarAuditoria('au-1', base, auditor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('finalizarAuditoria', () => {
    const auditoriaBase = (status: StatusAuditoria) => ({ id: 'a-1', status, itens: [] });

    it('com dataFim usa o horário do celular', async () => {
      const dataFim = '2026-11-01T15:00:00.000Z';
      const aud = auditoriaBase(StatusAuditoria.EM_ANDAMENTO);
      (service.buscarAuditoriaPorId as jest.Mock).mockResolvedValue(aud);
      auditoriaRepository.save.mockImplementation(async (v) => v);
      await service.finalizarAuditoria('a-1', { dataFim }, gestor);
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
