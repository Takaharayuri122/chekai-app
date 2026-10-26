import { BadRequestException } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

const usuario = { id: 'gestor-1', perfil: PerfilUsuario.GESTOR };

describe('ChecklistService - faixas de classificação do template', () => {
  let service: ChecklistService;
  let templateRepository: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    templateRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 't-1', nome: 'T', gestorId: 'gestor-1', itens: [], grupos: [] }),
      save: jest.fn(async (v) => ({ id: 't-1', ...v })),
      create: jest.fn((v) => v),
    };
    service = new ChecklistService(
      templateRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  const sobrepostas = [
    { nome: 'A', cor: '#DC2626', emoji: null, de: 0, ate: 60 },
    { nome: 'B', cor: '#16A34A', emoji: null, de: 50, ate: 100 },
  ];
  const validas = [
    { nome: 'A', cor: '#DC2626', emoji: null, de: 0, ate: 59.99 },
    { nome: 'B', cor: '#16A34A', emoji: null, de: 60, ate: 100 },
  ];

  it('atualizar com faixas sobrepostas lança BadRequestException', async () => {
    await expect(
      service.atualizarTemplate('t-1', { faixasClassificacao: sobrepostas }, usuario),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(templateRepository.save).not.toHaveBeenCalled();
  });

  it('criar com faixas inválidas lança BadRequestException', async () => {
    await expect(
      service.criarTemplate({ nome: 'T', faixasClassificacao: sobrepostas }, usuario),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('atualizar aceita faixas válidas e grava', async () => {
    await service.atualizarTemplate('t-1', { faixasClassificacao: validas, enviarRelatorioAoFinalizar: true }, usuario);
    expect(templateRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ faixasClassificacao: validas, enviarRelatorioAoFinalizar: true }),
    );
  });

  it('faixasClassificacao null volta ao padrão', async () => {
    await service.atualizarTemplate('t-1', { faixasClassificacao: null }, usuario);
    expect(templateRepository.save).toHaveBeenCalledWith(expect.objectContaining({ faixasClassificacao: null }));
  });

  it('sem faixasClassificacao no DTO mantém as existentes', async () => {
    templateRepository.findOne.mockResolvedValue({
      id: 't-1', nome: 'T', gestorId: 'gestor-1', itens: [], grupos: [], faixasClassificacao: validas,
    });
    await service.atualizarTemplate('t-1', { nome: 'Novo' }, usuario);
    expect(templateRepository.save).toHaveBeenCalledWith(expect.objectContaining({ faixasClassificacao: validas }));
  });
});
