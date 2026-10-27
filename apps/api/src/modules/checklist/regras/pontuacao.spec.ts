import {
  calcularNotaDaAuditoria,
  calcularPontuacaoOpcao,
  ehImagemDeAssinatura,
  getPontuacaoMaximaItem,
  isOpcaoSemPontuacao,
  tipoSemPontuacao,
} from './pontuacao';
import { TipoRespostaCustomizada } from '../entities/template-item.entity';

const personalizado = (opcoesResposta: string[]) => ({
  tipoRespostaCustomizada: null,
  usarRespostasPersonalizadas: true,
  opcoesResposta,
  opcoesRespostaConfig: [],
}) as never;

describe('isOpcaoSemPontuacao', () => {
  it.each(['nao_aplicavel', 'nao_avaliado', 'Não Aplicável', 'não se aplica', 'N/A', 'NA'])('"%s" fica fora da nota', (valor) => {
    expect(isOpcaoSemPontuacao(valor)).toBe(true);
  });

  it.each(['conforme', 'Não Conforme', 'Sim', 'Não', 'Parcial'])('"%s" pontua', (valor) => {
    expect(isOpcaoSemPontuacao(valor)).toBe(false);
  });
});

describe('opção personalizada "Não Aplicável"', () => {
  const item = personalizado(['Conforme', 'Não Conforme', 'Não Aplicável']);

  it('vale 0 e não entra na pontuação máxima', () => {
    expect(calcularPontuacaoOpcao(item, 'Não Aplicável')).toBe(0);
    expect(getPontuacaoMaximaItem(item)).toBe(1);
  });

  it('no meio da lista não ocupa degrau da sequência', () => {
    const meio = personalizado(['Sim', 'N/A', 'Não']);
    expect(calcularPontuacaoOpcao(meio, 'Sim')).toBe(1);
    expect(calcularPontuacaoOpcao(meio, 'Não')).toBe(0);
  });
});

describe('calcularNotaDaAuditoria', () => {
  const templateItem = personalizado(['Conforme', 'Não Conforme', 'Não Aplicável']);

  it('ignora "Não Aplicável" personalizado e não avaliado', () => {
    const nota = calcularNotaDaAuditoria([
      { resposta: 'Conforme', pontuacao: 1, templateItem },
      { resposta: 'Não Aplicável', pontuacao: -1, templateItem },
      { resposta: 'nao_avaliado', pontuacao: 0, templateItem },
    ]);
    expect(nota).toEqual({ obtida: 1, maxima: 1, percentual: 100 });
  });

  it('sem respostas que pontuam a nota é 0', () => {
    expect(calcularNotaDaAuditoria([{ resposta: 'N/A', pontuacao: 0, templateItem }]).percentual).toBe(0);
  });
});

describe('assinatura', () => {
  const item = { tipoRespostaCustomizada: TipoRespostaCustomizada.ASSINATURA, usarRespostasPersonalizadas: false, opcoesResposta: [], opcoesRespostaConfig: [] } as never;

  it('não pontua, como o texto', () => {
    expect(tipoSemPontuacao(TipoRespostaCustomizada.ASSINATURA)).toBe(true);
    expect(tipoSemPontuacao(TipoRespostaCustomizada.TEXTO)).toBe(true);
    expect(tipoSemPontuacao(TipoRespostaCustomizada.DATA)).toBe(false);
    expect(getPontuacaoMaximaItem(item)).toBe(0);
    expect(calcularPontuacaoOpcao(item, 'data:image/png;base64,AAAA')).toBe(0);
  });

  it('só aceita PNG em base64', () => {
    expect(ehImagemDeAssinatura('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(ehImagemDeAssinatura('data:image/png;base64,<script>')).toBe(false);
    expect(ehImagemDeAssinatura('data:image/svg+xml;base64,AAAA')).toBe(false);
    expect(ehImagemDeAssinatura(null)).toBe(false);
  });
});
