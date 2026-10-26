import { PlanoAcaoService } from './plano-acao.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { TipoLegislacao } from '../legislacao/entities/legislacao.entity';

describe('PlanoAcaoService.gerarDaAuditoria', () => {
  it('grava a norma do item em referenciaLegal', async () => {
    const itemRepo = {
      find: jest.fn().mockResolvedValue([
        {
          resposta: 'nao_conforme',
          legislacoes: [{ tipo: TipoLegislacao.RDC, numero: '216', ano: 2004, titulo: 'T' }],
          templateItem: { pergunta: 'Pergunta?', legislacoes: [] },
        },
      ]),
    };
    const repo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x) => x),
      save: jest.fn(),
    };
    const service = new PlanoAcaoService(repo as any, {} as any, itemRepo as any);
    jest.spyOn(service as any, 'validarAuditoria').mockResolvedValue(undefined);

    const r = await service.gerarDaAuditoria('a1', { id: 'u1', perfil: PerfilUsuario.MASTER, gestorId: 'g1' });

    expect(r.criadas).toBe(1);
    expect(itemRepo.find.mock.calls[0][0].relations).toEqual(
      expect.arrayContaining(['legislacoes', 'templateItem.legislacoes']),
    );
    expect(repo.save.mock.calls[0][0][0].referenciaLegal).toBe('RDC 216/2004');
  });

  describe('não conformidade pelo sentido', () => {
    const templateSimNao = { pergunta: 'Higienizou?', opcoesResposta: ['Sim', 'Não'], usarRespostasPersonalizadas: true, legislacoes: [] };

    async function gerar(resposta: string, templateItem: any) {
      const itemRepo = { find: jest.fn().mockResolvedValue([{ resposta, templateItem, legislacoes: [] }]) };
      const repo = { find: jest.fn().mockResolvedValue([]), create: jest.fn((x) => x), save: jest.fn() };
      const service = new PlanoAcaoService(repo as any, {} as any, itemRepo as any);
      jest.spyOn(service as any, 'validarAuditoria').mockResolvedValue(undefined);
      return service.gerarDaAuditoria('a1', { id: 'u1', perfil: PerfilUsuario.MASTER, gestorId: 'g1' });
    }

    it('cria 1 tarefa para "Não" em ["Sim","Não"]', async () => {
      expect((await gerar('Não', templateSimNao)).criadas).toBe(1);
    });

    it('não cria tarefa para "Sim" em ["Sim","Não"]', async () => {
      expect((await gerar('Sim', templateSimNao)).criadas).toBe(0);
    });

    it('continua criando 1 tarefa para nao_conforme', async () => {
      expect((await gerar('nao_conforme', { pergunta: 'P?', legislacoes: [] })).criadas).toBe(1);
    });
  });
});
