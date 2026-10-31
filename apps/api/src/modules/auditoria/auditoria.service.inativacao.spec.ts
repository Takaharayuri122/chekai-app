import { BadRequestException } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { LegislacaoVinculoService } from '../legislacao/legislacao-vinculo.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

const gestor = { id: 'g-1', perfil: PerfilUsuario.GESTOR };
const dto = { unidadeId: 'u-1', templateId: 't-1' };

describe('AuditoriaService - cliente/unidade inativos', () => {
  let service: AuditoriaService;
  let unidadeRepository: { findOne: jest.Mock };
  let auditoriaRepository: { create: jest.Mock; save: jest.Mock };

  const unidade = (ativo: boolean, clienteAtivo: boolean) => ({
    id: 'u-1',
    ativo,
    cliente: { id: 'c-1', ativo: clienteAtivo, auditores: [] },
  });

  beforeEach(() => {
    unidadeRepository = { findOne: jest.fn() };
    auditoriaRepository = { create: jest.fn((v) => v), save: jest.fn() };
    service = new AuditoriaService(
      auditoriaRepository as never,
      {} as never,
      {} as never,
      unidadeRepository as never,
      {} as never,
      {} as never,
      {} as never,
      new LegislacaoVinculoService(null as never, null as never, null as never),
    );
  });

  it('recusa auditoria em unidade inativa', async () => {
    unidadeRepository.findOne.mockResolvedValue(unidade(false, true));
    await expect(service.iniciarAuditoria('g-1', dto, gestor)).rejects.toThrow(BadRequestException);
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });

  it('recusa auditoria em unidade de cliente inativo', async () => {
    unidadeRepository.findOne.mockResolvedValue(unidade(true, false));
    await expect(service.iniciarAuditoria('g-1', dto, gestor)).rejects.toThrow(BadRequestException);
    expect(auditoriaRepository.save).not.toHaveBeenCalled();
  });
});
