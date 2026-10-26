import { AuditoriaService } from './auditoria.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { StatusAuditoria } from './entities/auditoria.entity';

const usuario = { id: 'u-1', perfil: PerfilUsuario.AUDITOR };
const templateSimNao = { pergunta: 'Higienizou?', opcoesResposta: ['Sim', 'Não'], usarRespostasPersonalizadas: true };

describe('AuditoriaService.buscarItensNaoConformes', () => {
  it('devolve o item "Não" de um template ["Sim","Não"] e ignora os demais', async () => {
    const itens = [
      { id: 'i-1', resposta: 'Não', templateItem: templateSimNao, fotos: [] },
      { id: 'i-2', resposta: 'Sim', templateItem: templateSimNao, fotos: [] },
      { id: 'i-3', resposta: 'nao_conforme', templateItem: { pergunta: 'P?' }, fotos: [] },
      { id: 'i-4', resposta: 'conforme', templateItem: { pergunta: 'Q?' }, fotos: [] },
    ];
    const auditoriaRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'a-1', consultorId: 'u-1', status: StatusAuditoria.EM_ANDAMENTO, itens: [] }),
    };
    const itemRepository = { find: jest.fn().mockResolvedValue(itens) };
    const service = new AuditoriaService(
      auditoriaRepository as never,
      itemRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const r = await service.buscarItensNaoConformes('a-1', usuario);

    expect(r.map((i) => i.id)).toEqual(['i-1', 'i-3']);
    expect(itemRepository.find.mock.calls[0][0].relations).toEqual(expect.arrayContaining(['templateItem', 'fotos']));
  });
});
