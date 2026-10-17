import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { AuditoriaService } from './auditoria.service';

const UNIDADE = '55555555-5555-4555-8555-555555555555';
const TEMPLATE = '66666666-6666-4666-8666-666666666666';
const GESTOR = '11111111-1111-4111-8111-111111111111';
const OUTRO = '22222222-2222-4222-8222-222222222222';
const AUDITOR = '33333333-3333-4333-8333-333333333333';
const MASTER = '44444444-4444-4444-8444-444444444444';

type UnidadeCarga = {
  id: string;
  cliente: { gestorId: string | null; auditores: Array<{ id: string }> } | null;
} | null;

function montar(unidade: UnidadeCarga) {
  const eventos: string[] = [];
  let salva: { id: string; consultorId: string } | null = null;
  const auditoriaRepository = {
    create: jest.fn((valor: object) => valor),
    save: jest.fn(async (valor: { consultorId: string }) => {
      eventos.push('salvar');
      salva = { ...valor, id: 'aud-1' };
      return salva;
    }),
    findOne: jest.fn(async () => salva),
  };
  const unidadeRepository = {
    findOne: jest.fn(async () => {
      eventos.push('unidade');
      return unidade;
    }),
  };
  const checklist = {
    buscarTemplatePorId: jest.fn(async () => ({
      itens: [{ id: 'item-1', ativo: true }],
    })),
  };
  const itens = {
    create: jest.fn((valor: object) => valor),
    save: jest.fn(async (valor: unknown) => valor),
  };
  const service = new AuditoriaService(
    auditoriaRepository as never,
    itens as never,
    {} as never,
    unidadeRepository as never,
    checklist as never,
    {} as never,
  );
  return { service, eventos, auditoriaRepository };
}

const dto = { unidadeId: UNIDADE, templateId: TEMPLATE };

function conta(id: string, perfil: PerfilUsuario, gestorId?: string | null) {
  return { id, perfil, gestorId: gestorId ?? null };
}

describe('AuditoriaService.iniciarAuditoria', () => {
  it('recusa gestor que inicia auditoria em unidade de outro tenant antes de salvar', async () => {
    const { service, auditoriaRepository } = montar({
      id: UNIDADE,
      cliente: { gestorId: OUTRO, auditores: [] },
    });

    await expect(
      service.iniciarAuditoria(GESTOR, dto, conta(GESTOR, PerfilUsuario.GESTOR)),
    ).rejects.toThrow(new ForbiddenException('Acesso negado a este cliente'));
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });

  it('recusa master que inicia auditoria em unidade de outro tenant antes de salvar', async () => {
    const { service, auditoriaRepository } = montar({
      id: UNIDADE,
      cliente: { gestorId: OUTRO, auditores: [] },
    });

    await expect(
      service.iniciarAuditoria(MASTER, dto, conta(MASTER, PerfilUsuario.MASTER)),
    ).rejects.toThrow(new ForbiddenException('Acesso negado a este cliente'));
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });

  it('recusa auditor vinculado a cliente de outro tenant antes de salvar', async () => {
    const { service, auditoriaRepository } = montar({
      id: UNIDADE,
      cliente: { gestorId: OUTRO, auditores: [{ id: AUDITOR }] },
    });

    await expect(
      service.iniciarAuditoria(AUDITOR, dto, conta(AUDITOR, PerfilUsuario.AUDITOR, GESTOR)),
    ).rejects.toThrow(new ForbiddenException('Acesso negado a este cliente'));
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });

  it('recusa auditor sem vínculo com o cliente antes de salvar', async () => {
    const { service, auditoriaRepository } = montar({
      id: UNIDADE,
      cliente: { gestorId: GESTOR, auditores: [] },
    });

    await expect(
      service.iniciarAuditoria(AUDITOR, dto, conta(AUDITOR, PerfilUsuario.AUDITOR, GESTOR)),
    ).rejects.toThrow(new ForbiddenException('Você não está vinculado a este cliente'));
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });

  it('recusa unidade inexistente antes de salvar', async () => {
    const { service, auditoriaRepository } = montar(null);

    await expect(
      service.iniciarAuditoria(GESTOR, dto, conta(GESTOR, PerfilUsuario.GESTOR)),
    ).rejects.toThrow(new NotFoundException('Unidade não encontrada'));
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });

  it('valida a unidade do gestor antes de salvar a auditoria', async () => {
    const { service, eventos } = montar({
      id: UNIDADE,
      cliente: { gestorId: GESTOR, auditores: [{ id: AUDITOR }] },
    });

    const auditoria = await service.iniciarAuditoria(GESTOR, dto, conta(GESTOR, PerfilUsuario.GESTOR));

    expect(auditoria.id).toBe('aud-1');
    expect(eventos).toEqual(['unidade', 'salvar']);
  });

  it('valida a unidade do auditor vinculado antes de salvar', async () => {
    const { service, eventos } = montar({
      id: UNIDADE,
      cliente: { gestorId: GESTOR, auditores: [{ id: AUDITOR }] },
    });

    await service.iniciarAuditoria(AUDITOR, dto, conta(AUDITOR, PerfilUsuario.AUDITOR, GESTOR));

    expect(eventos).toEqual(['unidade', 'salvar']);
  });

  it('valida a unidade do master dono do cliente antes de salvar', async () => {
    const { service, eventos } = montar({
      id: UNIDADE,
      cliente: { gestorId: MASTER, auditores: [] },
    });

    await service.iniciarAuditoria(MASTER, dto, conta(MASTER, PerfilUsuario.MASTER));

    expect(eventos).toEqual(['unidade', 'salvar']);
  });
});
