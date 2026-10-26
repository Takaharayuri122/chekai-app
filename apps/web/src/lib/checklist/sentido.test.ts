import { describe, it, expect } from 'vitest';
import { TipoRespostaCustomizada } from '../api';
import type { ItemComOpcoes } from './pontuacao';
import { classeDoSentido, ehNaoConformidade, ehRotuloNaoAplicavel, sentidoDaOpcao } from './sentido';

function item(extra: Partial<ItemComOpcoes> = {}): ItemComOpcoes {
  return {
    tipoRespostaCustomizada: undefined,
    usarRespostasPersonalizadas: false,
    opcoesResposta: [],
    opcoesRespostaConfig: [],
    ...extra,
  };
}

function personalizado(opcoes: string[], extra: Partial<ItemComOpcoes> = {}): ItemComOpcoes {
  return item({ usarRespostasPersonalizadas: true, opcoesResposta: opcoes, ...extra });
}

describe('sentidoDaOpcao', () => {
  it('deduz Sim positiva e Não negativa', () => {
    const i = personalizado(['Sim', 'Não']);
    expect(sentidoDaOpcao(i, 'Sim')).toBe('positiva');
    expect(sentidoDaOpcao(i, 'Não')).toBe('negativa');
  });

  it('deduz o meio como neutra com três opções', () => {
    const i = personalizado(['Sim', 'Parcial', 'Não']);
    expect(sentidoDaOpcao(i, 'Sim')).toBe('positiva');
    expect(sentidoDaOpcao(i, 'Parcial')).toBe('neutra');
    expect(sentidoDaOpcao(i, 'Não')).toBe('negativa');
  });

  it('trata N/A como neutra e não a considera na comparação', () => {
    const i = personalizado(['Sim', 'Não', 'N/A']);
    expect(sentidoDaOpcao(i, 'N/A')).toBe('neutra');
    expect(sentidoDaOpcao(i, 'Não')).toBe('negativa');
    expect(sentidoDaOpcao(i, 'Sim')).toBe('positiva');
  });

  it('prevalece o sentido gravado', () => {
    const i = personalizado(['Sim', 'Não'], {
      opcoesRespostaConfig: [
        { valor: 'Não', fotoObrigatoria: false, observacaoObrigatoria: false, sentido: 'positiva' },
      ],
    });
    expect(sentidoDaOpcao(i, 'Não')).toBe('positiva');
  });

  it('é neutra quando todas as pontuações são iguais', () => {
    const i = personalizado(['Sim', 'Não'], {
      opcoesRespostaConfig: [
        { valor: 'Sim', fotoObrigatoria: false, observacaoObrigatoria: false, pontuacao: 2 },
        { valor: 'Não', fotoObrigatoria: false, observacaoObrigatoria: false, pontuacao: 2 },
      ],
    });
    expect(sentidoDaOpcao(i, 'Sim')).toBe('neutra');
    expect(sentidoDaOpcao(i, 'Não')).toBe('neutra');
  });

  it('usa as opções de um item SELECT', () => {
    const i = item({ tipoRespostaCustomizada: TipoRespostaCustomizada.SELECT, usarRespostasPersonalizadas: true, opcoesResposta: ['Ótimo', 'Ruim'] });
    expect(sentidoDaOpcao(i, 'Ótimo')).toBe('positiva');
    expect(sentidoDaOpcao(i, 'Ruim')).toBe('negativa');
  });

  it('trata as respostas padrão', () => {
    const i = item();
    expect(sentidoDaOpcao(i, 'conforme')).toBe('positiva');
    expect(sentidoDaOpcao(i, 'nao_conforme')).toBe('negativa');
    expect(sentidoDaOpcao(i, 'nao_aplicavel')).toBe('neutra');
    expect(sentidoDaOpcao(i, 'nao_avaliado')).toBeNull();
  });

  it('retorna null para texto, número, data, vazio e item nulo', () => {
    expect(sentidoDaOpcao(item({ tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO }), 'abc')).toBeNull();
    expect(sentidoDaOpcao(item({ tipoRespostaCustomizada: TipoRespostaCustomizada.NUMERO }), '3')).toBeNull();
    expect(sentidoDaOpcao(item({ tipoRespostaCustomizada: TipoRespostaCustomizada.DATA }), '2026-01-01')).toBeNull();
    expect(sentidoDaOpcao(item(), '')).toBeNull();
    expect(sentidoDaOpcao(null, 'Sim')).toBeNull();
  });
});

describe('ehNaoConformidade', () => {
  it('é verdadeira só para sentido negativo', () => {
    const i = personalizado(['Sim', 'Parcial', 'Não']);
    expect(ehNaoConformidade(i, 'Não')).toBe(true);
    expect(ehNaoConformidade(i, 'Parcial')).toBe(false);
    expect(ehNaoConformidade(i, 'Sim')).toBe(false);
    expect(ehNaoConformidade(i, null)).toBe(false);
  });
});

describe('ehRotuloNaoAplicavel', () => {
  it.each(['nao_aplicavel', 'N/A', 'n.a.', 'NA', 'Não se aplica', 'Não aplicável'])('reconhece %s', (v) => {
    expect(ehRotuloNaoAplicavel(v)).toBe(true);
  });
  it.each(['Sim', 'Natural', 'conforme'])('rejeita %s', (v) => {
    expect(ehRotuloNaoAplicavel(v)).toBe(false);
  });
});

describe('classeDoSentido', () => {
  it('mapeia cada sentido para os tokens da marca', () => {
    expect(classeDoSentido('positiva')).toContain('border-success');
    expect(classeDoSentido('negativa')).toContain('border-destructive');
    expect(classeDoSentido('neutra')).toContain('border-warning');
    expect(classeDoSentido(null)).toContain('border-warning');
  });
});
