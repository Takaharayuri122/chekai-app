import { BadRequestException } from '@nestjs/common';
import { ChecklistService } from './checklist.service';
import { LegislacaoVinculoService } from '../legislacao/legislacao-vinculo.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

const rdc = { id: '11111111-1111-4111-8111-111111111111', tipo: 'rdc', numero: '216', ano: 2004, titulo: 'Boas práticas', situacao: 'vigente' };
const portaria = { id: '22222222-2222-4222-8222-222222222222', tipo: 'portaria', numero: '5', ano: 2013, titulo: 'CVS', situacao: 'vigente' };
const usuario = { id: 'gestor-1', perfil: PerfilUsuario.GESTOR };

describe('ChecklistService - legislações dos itens', () => {
  let service: ChecklistService;
  let itemRepository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock; createQueryBuilder: jest.Mock };
  let templateRepository: { findOne: jest.Mock };
  let grupoRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };
  let legislacaoService: { buscarPorIds: jest.Mock };

  beforeEach(() => {
    itemRepository = {
      create: jest.fn((v) => ({ ...v })),
      save: jest.fn(async (v) => v),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 1 }),
      })),
    };
    templateRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 't-1', gestorId: 'gestor-1', itens: [], grupos: [] }),
    };
    grupoRepository = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 'g-novo', ...v })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 1 }),
      })),
    };
    legislacaoService = {
      buscarPorIds: jest.fn(async (ids: string[]) =>
        ids.map((id) => {
          const l = [rdc, portaria].find((x) => x.id === id);
          if (!l) throw new BadRequestException('Legislação não encontrada.');
          return l;
        }),
      ),
    };
    service = new ChecklistService(
      templateRepository as never,
      itemRepository as never,
      grupoRepository as never,
      {} as never,
      legislacaoService as never,
      new LegislacaoVinculoService(null as never, null as never, null as never),
    );
  });

  it('adicionarItem com legislacaoIds grava vínculos e texto derivado', async () => {
    const item = await service.adicionarItem('t-1', { pergunta: 'P', legislacaoIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'] }, usuario);
    expect(item.legislacoes.map((l) => l.id)).toEqual(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']);
    expect(item.legislacaoReferencia).toBe('RDC 216/2004; Portaria 5/2013');
    expect(item.legislacoes[0]).toEqual(rdc);
  });

  it('adicionarItem com lista vazia remove vínculos e zera o texto', async () => {
    const item = await service.adicionarItem('t-1', { pergunta: 'P', legislacaoIds: [] }, usuario);
    expect(item.legislacoes).toEqual([]);
    expect(item.legislacaoReferencia).toBeNull();
  });

  it('adicionarItem com id inexistente falha com 400', async () => {
    await expect(
      service.adicionarItem('t-1', { pergunta: 'P', legislacaoIds: ['99999999-9999-4999-8999-999999999999'] }, usuario),
    ).rejects.toThrow('Legislação não encontrada.');
    expect(itemRepository.save).not.toHaveBeenCalled();
  });

  it('atualizarItem sem legislacaoIds não toca nos vínculos nem no texto', async () => {
    itemRepository.findOne.mockResolvedValue({
      id: 'i-1', templateId: 't-1', legislacaoReferencia: 'RDC 216/2004', legislacoes: [{ ...rdc, informacoes: 'x' }],
    });
    const item = await service.atualizarItem('i-1', { pergunta: 'Nova' }, usuario);
    const salvo = itemRepository.save.mock.calls[0][0];
    expect(salvo.pergunta).toBe('Nova');
    expect(salvo.legislacaoReferencia).toBe('RDC 216/2004');
    expect(legislacaoService.buscarPorIds).not.toHaveBeenCalled();
    // a resposta sempre traz as legislações resumidas
    expect(item.legislacoes).toEqual([rdc]);
  });

  it('atualizarItem com id de legislação inválido (não UUID) falha com 400 sem consultar o banco', async () => {
    itemRepository.findOne.mockResolvedValue({ id: 'i-1', templateId: 't-1' });
    await expect(service.atualizarItem('i-1', { legislacaoIds: ['x'] }, usuario)).rejects.toThrow(
      'Legislação não encontrada.',
    );
    expect(legislacaoService.buscarPorIds).not.toHaveBeenCalled();
    expect(itemRepository.save).not.toHaveBeenCalled();
  });

  it('atualizarItem com legislacaoIds substitui vínculos e texto', async () => {
    itemRepository.findOne.mockResolvedValue({ id: 'i-1', templateId: 't-1', legislacaoReferencia: 'antigo' });
    const item = await service.atualizarItem('i-1', { legislacaoIds: ['22222222-2222-4222-8222-222222222222'] }, usuario);
    expect(item.legislacoes.map((l) => l.id)).toEqual(['22222222-2222-4222-8222-222222222222']);
    expect(item.legislacaoReferencia).toBe('Portaria 5/2013');
  });

  it('duplicarItem copia os vínculos', async () => {
    itemRepository.findOne.mockResolvedValue({
      id: 'i-1', templateId: 't-1', pergunta: 'P', legislacoes: [rdc, portaria], legislacaoReferencia: 'x',
    });
    const copia = await service.duplicarItem('i-1', usuario);
    expect(copia.legislacoes.map((l) => l.id)).toEqual(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']);
  });

  it('duplicarGrupo copia os vínculos dos itens', async () => {
    grupoRepository.findOne.mockResolvedValue({ id: 'g-1', templateId: 't-1', nome: 'G', ordem: 1 });
    itemRepository.find.mockResolvedValue([{ id: 'i-1', pergunta: 'P', legislacoes: [rdc] }]);
    await service.duplicarGrupo('g-1', usuario);
    expect(itemRepository.save.mock.calls[0][0].legislacoes).toEqual([rdc]);
  });

  it('leitura do template devolve só o resumo das legislações', async () => {
    templateRepository.findOne.mockResolvedValue({
      id: 't-1',
      gestorId: 'gestor-1',
      grupos: [],
      itens: [{ id: 'i-1', ordem: 1, ativo: true, legislacoes: [{ ...rdc, informacoes: 'texto', ementa: 'e' }] }],
    });
    const t = await service.buscarTemplatePorId('t-1', usuario);
    expect(t.itens[0].legislacoes[0]).toEqual(rdc);
  });
});
