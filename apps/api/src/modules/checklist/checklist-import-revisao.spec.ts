import { interpretarRespostaIa, montarPromptRevisao } from './checklist-import-revisao';
import { RESPOSTAS_PADRAO_VALORES } from './checklist-regras';
import { PerguntaImportada } from './dto/importar-checklist.dto';
import { CategoriaItem, CriticidadeItem, TemplateItem } from './entities/template-item.entity';
import { configuracaoParaItem } from './checklist-import-mapeamento';
import { calcularPontuacaoOpcao } from './regras';

/** Mesma regra de pontuação da auditoria, aplicada ao item como ele volta do banco (JSON). */
function pontuar(item: Partial<TemplateItem>, valor: string): number {
  const salvo = JSON.parse(JSON.stringify(item)) as TemplateItem;
  return calcularPontuacaoOpcao(salvo, valor);
}

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

    it('opção da IA com mais de 100 caracteres é inválida e volta às opções originais', () => {
      const r = interpretarRespostaIa(
        resposta([{ chave: 'l3', tipoResposta: 'personalizada', opcoes: [opc('Azul'), opc('a'.repeat(101))] }]),
        [personalizada],
      );
      expect(r.sugestoes[0].configuracaoSugerida.opcoes.map((o) => o.valor)).toEqual(['Azul', 'Verde']);
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
      expect(opcoes.every((o) => !o.fotoObrigatoria && !o.observacaoObrigatoria)).toBe(true);
      // conforme/nao_conforme sem pontuação explícita (pontuação padrão 1/0); N/A e N/Av não pontuam
      expect(opcoes.map((o) => o.pontuacao)).toEqual([undefined, undefined, null, null]);
      expect(opcoes.filter((o) => 'pontuacao' in o).map((o) => o.valor)).toEqual(['nao_aplicavel', 'nao_avaliado']);
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

  it('opção da IA preserva sentido válido e descarta valor desconhecido', () => {
    const base = { fotoObrigatoria: false, observacaoObrigatoria: false };
    const r = interpretarRespostaIa(
      resposta([
        {
          chave: 'l1',
          tipoResposta: 'personalizada',
          opcoes: [
            { valor: 'Sim', sentido: 'positiva', ...base },
            { valor: 'Talvez', sentido: 'neutra', ...base },
            { valor: 'Não', sentido: 'ruim', ...base },
          ],
        },
      ]),
      originais,
    );
    const opcoes = r.sugestoes[0].configuracaoSugerida.opcoes;
    expect(opcoes.map((o) => o.sentido)).toEqual(['positiva', 'neutra', undefined]);
    expect('sentido' in opcoes[2]).toBe(false);
  });

  it('opção da IA sem pontuação fica sem pontuação explícita (não null)', () => {
    const r = interpretarRespostaIa(
      resposta([
        {
          chave: 'l1',
          tipoResposta: 'personalizada',
          opcoes: [
            { valor: 'Sim', fotoObrigatoria: false, observacaoObrigatoria: false },
            { valor: 'Não', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
          ],
        },
      ]),
      originais,
    );
    const opcoes = r.sugestoes[0].configuracaoSugerida.opcoes;
    expect('pontuacao' in opcoes[0]).toBe(false);
    // null da IA sem null explícito no original também vira pontuação padrão
    expect('pontuacao' in opcoes[1]).toBe(false);
  });

  it('padrão: null da IA em conforme/nao_conforme vira pontuação padrão (1/0); N/A segue null', () => {
    const r = interpretarRespostaIa(
      resposta([
        {
          chave: 'l1',
          tipoResposta: 'padrao',
          opcoes: [
            { valor: 'conforme', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
            { valor: 'nao_conforme', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
            { valor: 'nao_aplicavel', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
          ],
        },
      ]),
      originais,
    );
    const c = r.sugestoes[0].configuracaoSugerida;
    const porValor = Object.fromEntries(c.opcoes.map((o) => [o.valor, o]));
    expect('pontuacao' in porValor['conforme']).toBe(false);
    expect('pontuacao' in porValor['nao_conforme']).toBe(false);
    const item = configuracaoParaItem(c);
    expect(pontuar(item, 'conforme')).toBe(1);
    expect(pontuar(item, 'nao_conforme')).toBe(0);
  });

  it('personalizada: null da IA vira ausente, salvo se a opção original tinha null explícito', () => {
    const original = pergunta('l5', 'Cor?', {
      configuracao: {
        ...originais[0].configuracao,
        tipoResposta: 'personalizada',
        opcoes: [
          { valor: 'Sim', fotoObrigatoria: false, observacaoObrigatoria: false },
          { valor: 'Talvez', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
        ],
      },
    });
    const r = interpretarRespostaIa(
      resposta([
        {
          chave: 'l5',
          tipoResposta: 'personalizada',
          opcoes: [
            { valor: 'Sim', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
            { valor: 'Talvez', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
            { valor: 'Não', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
          ],
        },
      ]),
      [original],
    );
    const opcoes = r.sugestoes[0].configuracaoSugerida.opcoes;
    expect(opcoes[0].pontuacao).toBeUndefined();
    expect(opcoes[1].pontuacao).toBeNull();
    expect(opcoes[2].pontuacao).toBeUndefined();
  });

  it('peso não inteiro ou negativo da IA volta ao original; inteiro é aceito', () => {
    const r = interpretarRespostaIa(resposta([{ chave: 'l1', peso: 1.5 }, { chave: 'l2', peso: -1 }]), originais);
    expect(r.sugestoes[0].configuracaoSugerida.peso).toBe(1);
    const r3 = interpretarRespostaIa(resposta([{ chave: 'l1', peso: 500 }]), originais);
    expect(r3.sugestoes[0].configuracaoSugerida.peso).toBe(1);
    expect(r.sugestoes[1].configuracaoSugerida.peso).toBe(1);
    const r2 = interpretarRespostaIa(resposta([{ chave: 'l1', peso: 3 }]), originais);
    expect(r2.sugestoes[0].configuracaoSugerida.peso).toBe(3);
  });

  it('prompt pede peso inteiro e restringe o nome do grupo a ortografia/acentuação', () => {
    const prompt = montarPromptRevisao('Higiene', originais, []);
    expect(prompt).toContain('peso: número inteiro maior ou igual a 0 (no máximo 100)');
    expect(prompt).toMatch(/grupoNome.*apenas.*ortografia.*acentua/i);
    expect(prompt).not.toContain('sugerir um nome melhor');
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
