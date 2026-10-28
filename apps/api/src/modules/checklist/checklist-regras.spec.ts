import { aplicarRegrasForcadas, aplicarTipoResposta, ItemConfiguravel, normalizarOpcoesConfig } from './checklist-regras';
import { TipoRespostaCustomizada } from './entities/template-item.entity';

const base = (): Partial<ItemConfiguravel> => ({
  usarRespostasPersonalizadas: false,
  peso: 1,
  permiteFoto: true,
  permiteObservacao: true,
});

describe('aplicarRegrasForcadas', () => {
  it('texto: peso 0, sem opções e sem pontuação, mantendo a permissão de foto', () => {
    const item: Partial<ItemConfiguravel> = {
      tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO,
      usarRespostasPersonalizadas: true,
      peso: 5,
      permiteFoto: true,
      permiteObservacao: true,
      opcoesResposta: ['A'],
      opcoesRespostaConfig: [
        { valor: 'conforme', fotoObrigatoria: true, observacaoObrigatoria: true, pontuacao: 10 },
      ],
    };
    aplicarRegrasForcadas(item);
    expect(item.peso).toBe(0);
    expect(item.permiteFoto).toBe(true);
    expect(item.opcoesResposta).toBeNull();
    expect(item.opcoesRespostaConfig!.every((c) => c.pontuacao == null)).toBe(true);
    expect(item.opcoesRespostaConfig!.find((c) => c.valor === 'conforme')!.observacaoObrigatoria).toBe(true);
  });

  it('permiteFoto false zera fotoObrigatoria de todas as opções', () => {
    const item = {
      ...base(),
      permiteFoto: false,
      opcoesRespostaConfig: [
        { valor: 'conforme', fotoObrigatoria: true, observacaoObrigatoria: true },
        { valor: 'nao_conforme', fotoObrigatoria: true, observacaoObrigatoria: false },
      ],
    };
    aplicarRegrasForcadas(item);
    expect(item.opcoesRespostaConfig!.every((c) => c.fotoObrigatoria === false)).toBe(true);
    expect(item.opcoesRespostaConfig!.find((c) => c.valor === 'conforme')!.observacaoObrigatoria).toBe(true);
  });

  it('permiteObservacao false zera observacaoObrigatoria de todas as opções', () => {
    const item = {
      ...base(),
      permiteObservacao: false,
      opcoesRespostaConfig: [
        { valor: 'conforme', fotoObrigatoria: true, observacaoObrigatoria: true },
        { valor: 'nao_conforme', fotoObrigatoria: false, observacaoObrigatoria: true },
      ],
    };
    aplicarRegrasForcadas(item);
    expect(item.opcoesRespostaConfig!.every((c) => c.observacaoObrigatoria === false)).toBe(true);
    expect(item.opcoesRespostaConfig!.find((c) => c.valor === 'conforme')!.fotoObrigatoria).toBe(true);
  });

  it('padrão sem config gera as 4 respostas padrão', () => {
    const item = base();
    aplicarRegrasForcadas(item);
    expect(item.opcoesRespostaConfig!.map((c) => c.valor)).toEqual([
      'conforme',
      'nao_conforme',
      'nao_aplicavel',
      'nao_avaliado',
    ]);
    expect(item.peso).toBe(1);
  });

  it('personalizada mantém config existente por valor e cria as que faltam', () => {
    const item: Partial<ItemConfiguravel> = {
      ...base(),
      usarRespostasPersonalizadas: true,
      opcoesResposta: ['Sim', 'Parcial'],
      opcoesRespostaConfig: [{ valor: 'Sim', fotoObrigatoria: true, observacaoObrigatoria: false, pontuacao: 3 }],
    };
    aplicarRegrasForcadas(item);
    expect(item.opcoesRespostaConfig).toEqual([
      { valor: 'Sim', fotoObrigatoria: true, observacaoObrigatoria: false, pontuacao: 3 },
      { valor: 'Parcial', fotoObrigatoria: false, observacaoObrigatoria: false },
    ]);
  });
});

describe('aplicarTipoResposta', () => {
  const opcoes = [
    { valor: 'conforme', fotoObrigatoria: true, observacaoObrigatoria: false, pontuacao: 2 },
    { valor: 'outro', fotoObrigatoria: false, observacaoObrigatoria: false },
  ];

  it('padrao: limpa personalização e mantém só valores padrão das opções', () => {
    const item: Partial<ItemConfiguravel> = {
      usarRespostasPersonalizadas: true,
      tipoRespostaCustomizada: TipoRespostaCustomizada.NUMERO,
      opcoesResposta: ['A'],
    };
    aplicarTipoResposta(item, 'padrao', opcoes);
    expect(item.usarRespostasPersonalizadas).toBe(false);
    expect(item.tipoRespostaCustomizada).toBeNull();
    expect(item.opcoesResposta).toBeNull();
    expect(item.opcoesRespostaConfig).toEqual([opcoes[0]]);
  });

  it('personalizada: usa os valores e a config das opções', () => {
    const item: Partial<ItemConfiguravel> = { usarRespostasPersonalizadas: false };
    aplicarTipoResposta(item, 'personalizada', opcoes);
    expect(item.usarRespostasPersonalizadas).toBe(true);
    expect(item.tipoRespostaCustomizada).toBeNull();
    expect(item.opcoesResposta).toEqual(['conforme', 'outro']);
    expect(item.opcoesRespostaConfig).toEqual(opcoes);
  });

  it.each([
    ['texto', TipoRespostaCustomizada.TEXTO],
    ['numero', TipoRespostaCustomizada.NUMERO],
    ['data', TipoRespostaCustomizada.DATA],
  ] as const)('%s: define o tipo e limpa as opções', (tipo, esperado) => {
    const item: Partial<ItemConfiguravel> = { opcoesResposta: ['A'] };
    aplicarTipoResposta(item, tipo);
    expect(item.usarRespostasPersonalizadas).toBe(true);
    expect(item.tipoRespostaCustomizada).toBe(esperado);
    expect(item.opcoesResposta).toBeNull();
  });
});

describe('pontuação ausente nas opções', () => {
  it('padrão e personalizada mantêm a pontuação ausente (não viram null)', () => {
    for (const tipo of ['padrao', 'personalizada'] as const) {
      const item = base();
      aplicarTipoResposta(item, tipo, [
        { valor: 'conforme', fotoObrigatoria: false, observacaoObrigatoria: false },
        { valor: 'nao_aplicavel', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false },
      ]);
      aplicarRegrasForcadas(item);
      const porValor = Object.fromEntries((item.opcoesRespostaConfig || []).map((c) => [c.valor, c]));
      expect('pontuacao' in porValor['conforme']).toBe(false);
      expect(porValor['nao_aplicavel'].pontuacao).toBeNull();
    }
  });
});

describe('sentido e ícone das opções', () => {
  it('normalizarOpcoesConfig mantém sentido e icone de uma opção existente', () => {
    const item: Partial<ItemConfiguravel> = {
      usarRespostasPersonalizadas: true,
      opcoesResposta: ['Ruim'],
      opcoesRespostaConfig: [
        { valor: 'Ruim', fotoObrigatoria: false, observacaoObrigatoria: false, sentido: 'negativa', icone: '👎' },
      ],
    };
    normalizarOpcoesConfig(item);
    expect(item.opcoesRespostaConfig![0]).toMatchObject({ valor: 'Ruim', sentido: 'negativa', icone: '👎' });
  });

  it('aplicarTipoResposta em lote grava sentido e icone das opções', () => {
    const item: Partial<ItemConfiguravel> = {};
    aplicarTipoResposta(item, 'personalizada', [
      { valor: 'Bom', fotoObrigatoria: false, observacaoObrigatoria: false, sentido: 'positiva', icone: '👍' },
    ]);
    expect(item.opcoesRespostaConfig![0]).toMatchObject({ sentido: 'positiva', icone: '👍' });
  });
});
