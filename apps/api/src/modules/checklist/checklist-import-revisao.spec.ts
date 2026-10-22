import { interpretarRespostaIa, montarPromptRevisao } from './checklist-import-revisao';
import { RESPOSTAS_PADRAO_VALORES } from './checklist-regras';
import { PerguntaImportada } from './dto/importar-checklist.dto';
import { CategoriaItem, CriticidadeItem } from './entities/template-item.entity';

function pergunta(chave: string, texto: string, parcial: Partial<PerguntaImportada> = {}): PerguntaImportada {
  return {
    chave,
    grupo: 'Higiene',
    pergunta: texto,
    configuracao: {
      categoria: CategoriaItem.HIGIENE,
      criticidade: CriticidadeItem.MEDIA,
      tipoResposta: 'padrao',
      peso: 1,
      obrigatorio: true,
      permiteFoto: true,
      permiteObservacao: true,
      opcoes: [
        { valor: 'conforme', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
        { valor: 'nao_conforme', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
      ],
    },
    ...parcial,
  };
}

function resposta(perguntas: Record<string, unknown>[], grupoNome?: string): string {
  return JSON.stringify({ grupoNome, perguntas });
}

describe('checklist-import-revisao', () => {
  const originais = [pergunta('l1', 'Lavatorio com sabao?'), pergunta('l2', 'Lixeira tampada?')];

  it('JSON malformado lança erro', () => {
    expect(() => interpretarRespostaIa('{nao eh json', originais)).toThrow();
  });

  it('chave desconhecida é descartada e pergunta sem sugestão mantém original', () => {
    const r = interpretarRespostaIa(
      resposta([{ chave: 'l1', pergunta: 'Lavatório com sabão?' }, { chave: 'l99', pergunta: 'Fantasma' }]),
      originais,
    );
    expect(r.sugestoes.map((s) => s.chave)).toEqual(['l1', 'l2']);
    const l2 = r.sugestoes[1];
    expect(l2.perguntaSugerida).toBe('Lixeira tampada?');
    expect(l2.configuracaoSugerida).toEqual(originais[1].configuracao);
    expect(l2.alteracoes).toEqual([]);
    expect(l2.conferir).toBe(false);
  });

  it('criticidade "altissima" volta ao valor original', () => {
    const r = interpretarRespostaIa(resposta([{ chave: 'l1', criticidade: 'altissima' }]), originais);
    expect(r.sugestoes[0].configuracaoSugerida.criticidade).toBe(CriticidadeItem.MEDIA);
    expect(r.sugestoes[0].alteracoes).not.toContain('criticidade');
  });

  it('IA muda tipo para texto → permiteFoto false, peso 0, conferir true com motivo', () => {
    const r = interpretarRespostaIa(
      resposta([{ chave: 'l1', tipoResposta: 'texto', peso: 5, permiteFoto: true }]),
      originais,
    );
    const s = r.sugestoes[0];
    expect(s.configuracaoSugerida.tipoResposta).toBe('texto');
    expect(s.configuracaoSugerida.permiteFoto).toBe(false);
    expect(s.configuracaoSugerida.peso).toBe(0);
    expect(s.configuracaoSugerida.opcoes).toEqual([]);
    expect(s.conferir).toBe(true);
    expect(s.motivoConferir).toBeTruthy();
  });

  it('só correção ortográfica → alteracoes [pergunta] e conferir false', () => {
    const r = interpretarRespostaIa(
      resposta([{ chave: 'l1', pergunta: 'Lavatório com sabão?' }], 'Higiene pessoal'),
      originais,
    );
    expect(r.grupoNomeSugerido).toBe('Higiene pessoal');
    expect(r.sugestoes[0].alteracoes).toEqual(['pergunta']);
    expect(r.sugestoes[0].conferir).toBe(false);
  });

  describe('reconciliação de opcoes com tipoResposta', () => {
    const opc = (valor: string) => ({ valor, pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false });
    const personalizada = pergunta('l3', 'Cor?', {
      configuracao: { ...originais[0].configuracao, tipoResposta: 'personalizada', opcoes: [opc('Azul'), opc('Verde')] },
    });
    const padraoComFoto = pergunta('l4', 'X?');
    padraoComFoto.configuracao.opcoes = [
      { valor: 'conforme', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
      { valor: 'nao_conforme', pontuacao: null, fotoObrigatoria: true, observacaoObrigatoria: false },
    ];

    it('padrao -> personalizada sem opcoes mantém tipo e opcoes originais', () => {
      const r = interpretarRespostaIa(resposta([{ chave: 'l1', tipoResposta: 'personalizada' }]), originais);
      expect(r.sugestoes[0].configuracaoSugerida.tipoResposta).toBe('padrao');
      expect(r.sugestoes[0].alteracoes).not.toContain('tipoResposta');
    });

    it('personalizada com opcoes [] volta ao tipo e opcoes originais', () => {
      const r = interpretarRespostaIa(
        resposta([{ chave: 'l3', tipoResposta: 'personalizada', opcoes: [] }]),
        [personalizada],
      );
      expect(r.sugestoes[0].configuracaoSugerida.opcoes.map((o) => o.valor)).toEqual(['Azul', 'Verde']);
      const r2 = interpretarRespostaIa(
        resposta([{ chave: 'l1', tipoResposta: 'personalizada', opcoes: [] }]),
        originais,
      );
      expect(r2.sugestoes[0].configuracaoSugerida.tipoResposta).toBe('padrao');
    });

    it('padrao com valores inventados mantém só os padrão, e preserva as flags do original', () => {
      const r = interpretarRespostaIa(
        resposta([{ chave: 'l4', tipoResposta: 'padrao', opcoes: [opc('sim'), opc('nao')] }]),
        [padraoComFoto],
      );
      const opcoes = r.sugestoes[0].configuracaoSugerida.opcoes;
      expect(opcoes.map((o) => o.valor)).toEqual(['conforme', 'nao_conforme']);
      expect(opcoes.find((o) => o.valor === 'nao_conforme')?.fotoObrigatoria).toBe(true);
    });

    it('personalizada -> padrao usa opções padrão com defaults', () => {
      const r = interpretarRespostaIa(resposta([{ chave: 'l3', tipoResposta: 'padrao', opcoes: [opc('Azul')] }]), [
        personalizada,
      ]);
      const opcoes = r.sugestoes[0].configuracaoSugerida.opcoes;
      expect(opcoes.map((o) => o.valor)).toEqual([...RESPOSTAS_PADRAO_VALORES]);
      expect(opcoes.every((o) => o.pontuacao === null && !o.fotoObrigatoria && !o.observacaoObrigatoria)).toBe(true);
    });

    it('numero e data limpam opcoes', () => {
      for (const tipo of ['numero', 'data']) {
        const r = interpretarRespostaIa(
          resposta([{ chave: 'l1', tipoResposta: tipo, opcoes: [opc('conforme')] }]),
          originais,
        );
        expect(r.sugestoes[0].configuracaoSugerida.tipoResposta).toBe(tipo);
        expect(r.sugestoes[0].configuracaoSugerida.opcoes).toEqual([]);
      }
    });
  });

  it('motivoConferir original faz conferir true', () => {
    const comMotivo = [pergunta('l1', 'Texto', { motivoConferir: 'Tipo não reconhecido' })];
    const r = interpretarRespostaIa(resposta([]), comMotivo);
    expect(r.sugestoes[0].conferir).toBe(true);
    expect(r.sugestoes[0].motivoConferir).toBe('Tipo não reconhecido');
  });

  it('prompt contém todas as chaves e os enums permitidos', () => {
    const prompt = montarPromptRevisao('Higiene', originais, ['Art. 4 texto legal']);
    expect(prompt).toContain('l1');
    expect(prompt).toContain('l2');
    for (const v of ['estrutura', 'controle_pragas', 'baixa', 'critica', 'padrao', 'personalizada', 'texto', 'numero', 'data']) {
      expect(prompt).toContain(v);
    }
    expect(prompt).toContain('RDC 216/2004');
    expect(prompt).toContain('Art. 4 texto legal');
  });
});
