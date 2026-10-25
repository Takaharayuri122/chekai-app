import { IaService } from './ia.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

describe('IaService (legislações escolhidas)', () => {
  let service: IaService;
  let legislacaoService: { gerarContextoRag: jest.Mock };
  let vinculo: { idsPorTexto: jest.Mock };
  let deepseek: jest.Mock;
  let vision: jest.Mock;
  const master = { id: 'm', perfil: PerfilUsuario.MASTER };

  beforeEach(() => {
    legislacaoService = { gerarContextoRag: jest.fn().mockResolvedValue('[RDC 216/2004, Art. 4]: texto') };
    vinculo = {
      idsPorTexto: jest.fn().mockImplementation(async (t: string) => (t.includes('216/2004') ? ['id-216'] : [])),
    };
    service = new IaService(
      { get: jest.fn().mockReturnValue('x') } as never,
      legislacaoService as never,
      vinculo as never,
      {} as never,
      {} as never,
    );
    deepseek = jest.fn();
    vision = jest.fn();
    (service as unknown as { deepseekText: unknown }).deepseekText = { chat: { completions: { create: deepseek } } };
    (service as unknown as { openaiVision: unknown }).openaiVision = { chat: { completions: { create: vision } } };
  });

  const resposta = (obj: unknown) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });

  it('gerarTextoNaoConformidade passa legislacaoIds ao contexto e devolve legislacaoIds da referência', async () => {
    deepseek.mockResolvedValue(
      resposta({ descricaoTecnica: 'd', referenciaLegal: 'RDC 216/2004, Art. 4.1.3', riscoEnvolvido: 'r', planoAcao: {} }),
    );
    const r = await service.gerarTextoNaoConformidade('x', 'restaurante', master, { legislacaoIds: ['a'] });
    expect(legislacaoService.gerarContextoRag).toHaveBeenCalledWith(expect.any(String), { legislacaoIds: ['a'] });
    expect(r.referenciaLegal).toBe('RDC 216/2004, Art. 4.1.3');
    expect(r.legislacaoIds).toEqual(['id-216']);
    expect(deepseek.mock.calls[0][0].messages[0].content).toContain('sem artigo');
  });

  it('referência sem casamento → legislacaoIds vazio', async () => {
    deepseek.mockResolvedValue(resposta({ descricaoTecnica: 'd', referenciaLegal: 'Norma X 1/1999', riscoEnvolvido: 'r', planoAcao: {} }));
    const r = await service.gerarTextoNaoConformidade('x', 'restaurante', master);
    expect(r.legislacaoIds).toEqual([]);
  });

  it('JSON inválido → fallback com legislacaoIds vazio', async () => {
    deepseek.mockResolvedValue({ choices: [{ message: { content: 'texto solto' } }] });
    const r = await service.gerarTextoNaoConformidade('x', 'restaurante', master);
    expect(r.legislacaoIds).toEqual([]);
    expect(r.referenciaLegal).toBe('Verificar legislação aplicável');
  });

  it('analisarImagemChecklist usa os ids no contexto e devolve referenciaLegal + legislacaoIds', async () => {
    vision.mockResolvedValue(
      resposta({ descricaoIa: 'ok', referenciaLegal: 'RDC 216/2004, Art. 4.1.3', imagemRelevante: true }),
    );
    const r = await service.analisarImagemChecklist('b64', 'pergunta', 'higiene', 'restaurante', master, {
      legislacaoIds: ['a', 'b'],
    });
    expect(legislacaoService.gerarContextoRag).toHaveBeenCalledWith(expect.any(String), { legislacaoIds: ['a', 'b'] });
    expect(r.referenciaLegal).toBe('RDC 216/2004, Art. 4.1.3');
    expect(r.legislacaoIds).toEqual(['id-216']);
  });

  it('gerarTextoNaoConformidade: falha ao casar a referência devolve o texto com legislacaoIds vazio', async () => {
    vinculo.idsPorTexto.mockRejectedValue(new Error('banco fora'));
    deepseek.mockResolvedValue(
      resposta({ descricaoTecnica: 'd', referenciaLegal: 'RDC 216/2004', riscoEnvolvido: 'r', planoAcao: {} }),
    );
    const r = await service.gerarTextoNaoConformidade('x', 'restaurante', master);
    expect(r.descricaoTecnica).toBe('d');
    expect(r.referenciaLegal).toBe('RDC 216/2004');
    expect(r.legislacaoIds).toEqual([]);
  });

  it('analisarImagemChecklist: falha ao casar a referência devolve a análise com legislacaoIds vazio', async () => {
    vinculo.idsPorTexto.mockRejectedValue(new Error('banco fora'));
    vision.mockResolvedValue(resposta({ descricaoIa: 'ok', referenciaLegal: 'RDC 216/2004', gravidade: 'alta' }));
    const r = await service.analisarImagemChecklist('b64', 'pergunta', 'higiene', 'restaurante', master);
    expect(r.descricaoIa).toBe('ok');
    expect(r.gravidade).toBe('alta');
    expect(r.tipoNaoConformidade).not.toBe('Erro na análise');
    expect(r.legislacaoIds).toEqual([]);
  });
});
