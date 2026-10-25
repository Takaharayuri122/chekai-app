import { ChecklistIaService } from './checklist-ia.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

describe('ChecklistIaService (legislações cadastradas)', () => {
  let service: ChecklistIaService;
  let legislacaoService: { gerarContextoRag: jest.Mock; listarParaPrompt: jest.Mock };
  let vinculo: { idsPorTexto: jest.Mock };
  let checklistService: { criarTemplate: jest.Mock; adicionarGrupo: jest.Mock; adicionarItem: jest.Mock };
  let create: jest.Mock;
  const master = { id: 'm', perfil: PerfilUsuario.MASTER };

  const checklist = {
    nome: 'C',
    descricao: 'd',
    tipoAtividade: 'restaurante',
    grupos: [
      {
        nome: 'G',
        itens: [
          {
            pergunta: 'P?',
            categoria: 'higiene',
            criticidade: 'alta',
            peso: 1,
            obrigatorio: true,
            legislacoes: ['RDC 216/2004', 'Inexistente 1/2000'],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    legislacaoService = {
      gerarContextoRag: jest.fn().mockResolvedValue(''),
      listarParaPrompt: jest.fn().mockResolvedValue([
        { nome: 'RDC 216/2004', ementa: 'E'.repeat(300) },
        { nome: 'Lei 8078/1990', ementa: null },
      ]),
    };
    vinculo = {
      idsPorTexto: jest.fn().mockImplementation(async (t: string) => (t === 'RDC 216/2004' ? ['id-216'] : [])),
    };
    checklistService = {
      criarTemplate: jest.fn().mockResolvedValue({ id: 't1' }),
      adicionarGrupo: jest.fn().mockResolvedValue({ id: 'g1' }),
      adicionarItem: jest.fn().mockResolvedValue({}),
    };
    service = new ChecklistIaService(
      { get: jest.fn().mockReturnValue('x') } as never,
      legislacaoService as never,
      vinculo as never,
      {} as never,
      checklistService as never,
    );
    create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify(checklist) } }] });
    (service as unknown as { deepseek: unknown }).deepseek = { chat: { completions: { create } } };
  });

  const mensagens = [
    { role: 'user', conteudo: 'quero um checklist' },
    { role: 'assistant', conteudo: 'ok' },
    { role: 'user', conteudo: 'restaurante' },
    { role: 'assistant', conteudo: 'Posso criar o resumo e gerar?' },
    { role: 'user', conteudo: 'sim, gerar' },
  ] as never;

  it('prompt lista as legislações cadastradas (ementa cortada em 160) e não pede artigo/textoLegal', async () => {
    await service.processarMensagem(mensagens, master);
    const prompt = create.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain(`- RDC 216/2004: ${'E'.repeat(160)}\n`);
    expect(prompt).not.toContain('E'.repeat(161));
    expect(prompt).toContain('- Lei 8078/1990\n');
    expect(prompt).not.toContain('textoLegal');
    expect(prompt).not.toContain('"artigo"');
    expect(legislacaoService.listarParaPrompt).toHaveBeenCalledWith(80);
  });

  it('salva legislacaoIds só das legislações que existem e não envia artigo/textoLegal', async () => {
    await service.processarMensagem(mensagens, master);
    expect(checklistService.adicionarItem).toHaveBeenCalledTimes(1);
    const dto = checklistService.adicionarItem.mock.calls[0][1];
    expect(dto.legislacaoIds).toEqual(['id-216']);
    expect(dto).not.toHaveProperty('artigo');
    expect(dto).not.toHaveProperty('textoLegal');
    expect(dto).not.toHaveProperty('legislacaoReferencia');
  });
});
