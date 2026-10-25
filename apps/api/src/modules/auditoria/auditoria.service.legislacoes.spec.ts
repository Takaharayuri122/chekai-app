import { BadRequestException } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { LegislacaoVinculoService } from '../legislacao/legislacao-vinculo.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { StatusAuditoria } from './entities/auditoria.entity';

const rdc = { id: 'l-1', tipo: 'rdc', numero: '216', ano: 2004, titulo: 'Boas práticas', situacao: 'vigente' };
const portaria = { id: 'l-2', tipo: 'portaria', numero: '5', ano: 2013, titulo: 'CVS', situacao: 'vigente' };
const usuario = { id: 'u-1', perfil: PerfilUsuario.AUDITOR };

describe('AuditoriaService - legislações dos itens', () => {
  let service: AuditoriaService;
  let auditoriaRepository: { findOne: jest.Mock };
  let itemRepository: { findOne: jest.Mock; save: jest.Mock };
  let legislacaoService: { buscarPorIds: jest.Mock };

  beforeEach(() => {
    auditoriaRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'a-1', consultorId: 'u-1', status: StatusAuditoria.EM_ANDAMENTO, itens: [] }),
    };
    itemRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'i-1',
        templateItem: { id: 't-1' },
        fotos: [],
        referenciaLegal: 'antigo',
        legislacoes: undefined,
      }),
      save: jest.fn(async (v) => v),
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
    service = new AuditoriaService(
      auditoriaRepository as never,
      itemRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      legislacaoService as never,
      new LegislacaoVinculoService(null as never, null as never, null as never),
    );
  });

  it('responder com legislacaoIds grava vínculos e referenciaLegal derivado (prevalece sobre o texto)', async () => {
    const item = await service.responderItem(
      'a-1', 'i-1', { resposta: 'conforme', legislacaoIds: ['l-1', 'l-2'], referenciaLegal: 'ignorado' }, usuario,
    );
    expect(item.legislacoes.map((l) => l.id)).toEqual(['l-1', 'l-2']);
    expect(item.referenciaLegal).toBe('RDC 216/2004; Portaria 5/2013');
  });

  it('legislacaoIds vazio remove vínculos e usa o texto enviado, ou null', async () => {
    const a = await service.responderItem('a-1', 'i-1', { resposta: 'conforme', legislacaoIds: [], referenciaLegal: 'texto' }, usuario);
    expect(a.legislacoes).toEqual([]);
    expect(a.referenciaLegal).toBe('texto');
    const b = await service.responderItem('a-1', 'i-1', { resposta: 'conforme', legislacaoIds: [] }, usuario);
    expect(b.referenciaLegal).toBeNull();
  });

  it('sem legislacaoIds, só referenciaLegal (mobile) grava o texto e não toca nos vínculos', async () => {
    await service.responderItem('a-1', 'i-1', { resposta: 'conforme', referenciaLegal: 'texto' }, usuario);
    const salvo = itemRepository.save.mock.calls[0][0];
    expect(salvo.referenciaLegal).toBe('texto');
    expect(salvo.legislacoes).toBeUndefined();
    expect(legislacaoService.buscarPorIds).not.toHaveBeenCalled();
  });

  it('id inexistente falha com 400 e não salva', async () => {
    await expect(
      service.responderItem('a-1', 'i-1', { resposta: 'conforme', legislacaoIds: ['x'] }, usuario),
    ).rejects.toThrow('Legislação não encontrada.');
    expect(itemRepository.save).not.toHaveBeenCalled();
  });

  it('detalhe da auditoria carrega as relações de legislação e devolve só o resumo', async () => {
    auditoriaRepository.findOne.mockResolvedValue({
      id: 'a-1',
      consultorId: 'u-1',
      itens: [{
        id: 'i-1',
        legislacoes: [{ ...rdc, informacoes: 'x' }],
        templateItem: { id: 't-1', legislacoes: [{ ...portaria, ementa: 'y' }] },
      }],
    });
    const a = await service.buscarAuditoriaPorId('a-1', usuario);
    const relations = auditoriaRepository.findOne.mock.calls[0][0].relations;
    expect(relations).toEqual(expect.arrayContaining(['itens.legislacoes', 'itens.templateItem.legislacoes']));
    expect(a.itens[0].legislacoes[0]).toEqual(rdc);
    expect(a.itens[0].templateItem.legislacoes[0]).toEqual(portaria);
  });
});
