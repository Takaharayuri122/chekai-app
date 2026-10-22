import { BadRequestException } from '@nestjs/common';
import { ChecklistImportIaService } from './checklist-import-ia.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { PerguntaImportada } from './dto/importar-checklist.dto';
import { CategoriaItem, CriticidadeItem } from './entities/template-item.entity';

const perguntas: PerguntaImportada[] = [
  {
    chave: 'l1',
    grupo: 'Higiene',
    pergunta: 'Lavatorio?',
    configuracao: {
      categoria: CategoriaItem.HIGIENE,
      criticidade: CriticidadeItem.MEDIA,
      tipoResposta: 'padrao',
      peso: 1,
      obrigatorio: true,
      permiteFoto: true,
      permiteObservacao: true,
      opcoes: [],
    },
  },
];

describe('ChecklistImportIaService', () => {
  let service: ChecklistImportIaService;
  let create: jest.Mock;
  let creditoService: { identificarGestorId: jest.Mock; validarSaldoDisponivel: jest.Mock; registrarUso: jest.Mock };
  let legislacaoService: { buscarChunksSimilares: jest.Mock };
  const gestor = { id: 'u1', perfil: PerfilUsuario.GESTOR, gestorId: 'g1' };

  beforeEach(() => {
    creditoService = {
      identificarGestorId: jest.fn().mockReturnValue('g1'),
      validarSaldoDisponivel: jest.fn().mockResolvedValue(undefined),
      registrarUso: jest.fn().mockResolvedValue({}),
    };
    legislacaoService = {
      buscarChunksSimilares: jest.fn().mockResolvedValue([{ chunk: { conteudo: 'texto legal' } }]),
    };
    service = new ChecklistImportIaService(
      { get: jest.fn().mockReturnValue('x') } as never,
      legislacaoService as never,
      creditoService as never,
    );
    create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ grupoNome: 'Higiene', perguntas: [{ chave: 'l1', pergunta: 'Lavatório?' }] }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });
    (service as unknown as { deepseek: unknown }).deepseek = { chat: { completions: { create } } };
  });

  it('sem saldo → sem_creditos e IA não chamada', async () => {
    creditoService.validarSaldoDisponivel.mockRejectedValue(new BadRequestException('Limite de créditos excedido'));
    const r = await service.revisarGrupo({ grupo: 'Higiene', perguntas }, gestor);
    expect(r).toEqual({ status: 'sem_creditos', sugestoes: [] });
    expect(create).not.toHaveBeenCalled();
  });

  it('erro inesperado ao validar saldo → falha (não sem_creditos) e registra erro', async () => {
    creditoService.validarSaldoDisponivel.mockRejectedValue(new Error('conexão com o banco caiu'));
    const erro = jest.spyOn(service['logger'], 'error').mockImplementation();
    const r = await service.revisarGrupo({ grupo: 'Higiene', perguntas }, gestor);
    expect(r).toEqual({ status: 'falha', sugestoes: [] });
    expect(create).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalled();
  });

  it('MASTER não valida saldo nem registra uso', async () => {
    const r = await service.revisarGrupo({ grupo: 'Higiene', perguntas }, { id: 'm', perfil: PerfilUsuario.MASTER });
    expect(r.status).toBe('revisado');
    expect(creditoService.validarSaldoDisponivel).not.toHaveBeenCalled();
    expect(creditoService.registrarUso).not.toHaveBeenCalled();
  });

  it('registra uso com metodoChamado checklistImport.revisao e tokens do usage', async () => {
    const r = await service.revisarGrupo({ grupo: 'Higiene', perguntas }, gestor);
    expect(r.status).toBe('revisado');
    expect(r.grupoNomeSugerido).toBe('Higiene');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'deepseek-chat', temperature: 0.2, response_format: { type: 'json_object' } }),
    );
    expect(creditoService.registrarUso).toHaveBeenCalledWith(
      expect.objectContaining({
        gestorId: 'g1',
        usuarioId: 'u1',
        tokensInput: 100,
        tokensOutput: 50,
        metodoChamado: 'checklistImport.revisao',
        contexto: 'Revisão de importação: Higiene',
      }),
    );
  });

  it('erro da IA → falha', async () => {
    create.mockRejectedValue(new Error('boom'));
    jest.spyOn(service['logger'], 'error').mockImplementation();
    const r = await service.revisarGrupo({ grupo: 'Higiene', perguntas }, gestor);
    expect(r).toEqual({ status: 'falha', sugestoes: [] });
  });

  it('falha no RAG não impede a revisão', async () => {
    legislacaoService.buscarChunksSimilares.mockRejectedValue(new Error('rag'));
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    const r = await service.revisarGrupo({ grupo: 'Higiene', perguntas }, gestor);
    expect(r.status).toBe('revisado');
    expect(create).toHaveBeenCalled();
  });
});
