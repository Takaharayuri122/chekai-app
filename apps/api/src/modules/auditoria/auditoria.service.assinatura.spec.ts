import { BadRequestException } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { LegislacaoVinculoService } from '../legislacao/legislacao-vinculo.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { StatusAuditoria } from './entities/auditoria.entity';
import { TipoRespostaCustomizada } from '../checklist/entities/template-item.entity';

const usuario = { id: 'u-1', perfil: PerfilUsuario.AUDITOR };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('AuditoriaService - resposta de assinatura', () => {
  let service: AuditoriaService;
  let itemRepository: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    itemRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'i-1',
        templateItem: { id: 't-1', tipoRespostaCustomizada: TipoRespostaCustomizada.ASSINATURA },
        fotos: [],
      }),
      save: jest.fn(async (v) => v),
    };
    const auditoriaRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'a-1', consultorId: 'u-1', status: StatusAuditoria.EM_ANDAMENTO, itens: [] }),
    };
    service = new AuditoriaService(
      auditoriaRepository as never,
      itemRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new LegislacaoVinculoService(null as never, null as never, null as never),
    );
  });

  it('grava a imagem PNG da assinatura sem pontuar', async () => {
    const item = await service.responderItem('a-1', 'i-1', { resposta: PNG }, usuario);
    expect(item.resposta).toBe(PNG);
    expect(item.pontuacao).toBe(0);
  });

  it.each([
    ['texto comum', 'Maria'],
    ['outro formato', 'data:image/jpeg;base64,AAAA'],
    ['imagem grande demais', `data:image/png;base64,${'A'.repeat(400_001)}`],
  ])('recusa %s', async (_caso, resposta) => {
    await expect(service.responderItem('a-1', 'i-1', { resposta }, usuario)).rejects.toThrow(BadRequestException);
  });
});
