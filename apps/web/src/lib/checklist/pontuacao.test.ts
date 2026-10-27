import { describe, expect, it } from 'vitest';
import { calcularPontuacaoOpcao, getPontuacaoMaximaItem, isOpcaoSemPontuacao } from './pontuacao';
import { calcularPontuacoesEmSequencia } from '../utils';

const personalizado = (opcoesResposta: string[]) =>
  ({ tipoRespostaCustomizada: undefined, usarRespostasPersonalizadas: true, opcoesResposta, opcoesRespostaConfig: [] }) as never;

describe('isOpcaoSemPontuacao', () => {
  it.each(['nao_aplicavel', 'nao_avaliado', 'Não Aplicável', 'não se aplica', 'N/A'])('"%s" fica fora da nota', (valor) => {
    expect(isOpcaoSemPontuacao(valor)).toBe(true);
  });

  it.each(['conforme', 'Não Conforme', 'Sim', 'Não'])('"%s" pontua', (valor) => {
    expect(isOpcaoSemPontuacao(valor)).toBe(false);
  });
});

describe('opção personalizada "Não Aplicável"', () => {
  it('vale 0 e não entra na pontuação máxima', () => {
    const item = personalizado(['Conforme', 'Não Conforme', 'Não Aplicável']);
    expect(calcularPontuacaoOpcao(item, 'Não Aplicável')).toBe(0);
    expect(getPontuacaoMaximaItem(item)).toBe(1);
  });

  it('o editor também deixa a opção sem pontuação', () => {
    expect(calcularPontuacoesEmSequencia(1, ['Conforme', 'N/A', 'Não Conforme'])).toEqual([1, null, 0]);
  });
});

describe('assinatura', () => {
  it('não pontua e só aceita PNG em base64', async () => {
    const { tipoSemPontuacao, ehImagemDeAssinatura } = await import('./pontuacao');
    const { TipoRespostaCustomizada } = await import('../api');
    expect(tipoSemPontuacao(TipoRespostaCustomizada.ASSINATURA)).toBe(true);
    expect(tipoSemPontuacao(TipoRespostaCustomizada.NUMERO)).toBe(false);
    expect(ehImagemDeAssinatura('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(ehImagemDeAssinatura('data:image/png;base64,"><script>')).toBe(false);
    expect(ehImagemDeAssinatura('Maria')).toBe(false);
  });
});
