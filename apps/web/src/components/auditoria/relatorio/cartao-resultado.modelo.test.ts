import { describe, it, expect } from 'vitest';
import { FAIXAS_PADRAO } from '@/lib/checklist/faixas';
import type { ResultadoAuditoria } from '@/lib/api';
import {
  contadoresDoCartao,
  formatarPercentual,
  interpretarDestinatarios,
  modeloDoCartao,
} from './cartao-resultado.modelo';

const resultado = (extra: Partial<ResultadoAuditoria> = {}): ResultadoAuditoria => ({
  aproveitamento: 90.36,
  classificacao: { nome: 'Com Excelência', cor: '#16A34A', emoji: '⭐' },
  faixas: [...FAIXAS_PADRAO],
  tendencia: null,
  anteriores: [],
  contadores: { pontosPossiveis: 83, pontosRealizados: 75, naoConformidades: 4, fotos: 12, planosAcao: 2 },
  grupos: [],
  ...extra,
});

describe('formatarPercentual', () => {
  it('usa vírgula, duas casas e % colado (como no PDF)', () => {
    expect(formatarPercentual(90.36)).toBe('90,36%');
    expect(formatarPercentual(100)).toBe('100,00%');
    expect(formatarPercentual(0)).toBe('0,00%');
  });
});

describe('modeloDoCartao', () => {
  it('mostra o nome da faixa e o percentual', () => {
    const m = modeloDoCartao(resultado());
    expect(m.nomeClassificacao).toBe('Com Excelência');
    expect(m.percentual).toBe('90,36%');
  });

  it('tendência caiu mostra ▼ em destructive', () => {
    const m = modeloDoCartao(resultado({ tendencia: 'caiu' }));
    expect(m.seta).toEqual({ glifo: '▼', classe: 'text-destructive', dica: 'Comparado com a avaliação anterior' });
  });

  it('tendência subiu mostra ▲ em success', () => {
    const m = modeloDoCartao(resultado({ tendencia: 'subiu' }));
    expect(m.seta?.glifo).toBe('▲');
    expect(m.seta?.classe).toBe('text-success');
  });

  it('sem tendência ou igual não mostra seta', () => {
    expect(modeloDoCartao(resultado({ tendencia: null })).seta).toBeNull();
    expect(modeloDoCartao(resultado({ tendencia: 'igual' })).seta).toBeNull();
  });

  it('sem anteriores não mostra o histórico', () => {
    expect(modeloDoCartao(resultado()).mostrarHistorico).toBe(false);
  });

  it('com anteriores mostra até 3, com percentual formatado', () => {
    const anteriores = [1, 2, 3, 4].map((n) => ({ id: String(n), dataFim: '2026-01-01T00:00:00Z', aproveitamento: 70 + n }));
    const m = modeloDoCartao(resultado({ anteriores }));
    expect(m.mostrarHistorico).toBe(true);
    expect(m.anteriores).toHaveLength(3);
    expect(m.anteriores[0].percentual).toBe('71,00%');
  });

  it('a posição do marcador acompanha o aproveitamento e fica entre 0 e 100', () => {
    expect(modeloDoCartao(resultado()).posicaoMarcador).toBeCloseTo(90.36);
    expect(modeloDoCartao(resultado({ aproveitamento: 130 })).posicaoMarcador).toBe(100);
    expect(modeloDoCartao(resultado({ aproveitamento: -5 })).posicaoMarcador).toBe(0);
  });
});

describe('barra do cartão', () => {
  it('usa a geometria compartilhada com o PDF (deslocamento e vãos)', () => {
    const faixas = [
      { nome: 'A', cor: '#111111', emoji: null, de: 50, ate: 69.99 },
      { nome: 'B', cor: '#222222', emoji: null, de: 80, ate: 100 },
    ];
    const m = modeloDoCartao(resultado({ faixas }));
    expect(m.segmentos).toEqual([
      { nome: 'A', cor: '#111111', inicio: 50, largura: expect.closeTo(19.99) },
      { nome: 'B', cor: '#222222', inicio: 80, largura: 20 },
    ]);
  });
});

describe('contadoresDoCartao', () => {
  it('lista os cinco contadores na ordem do cartão', () => {
    const c = contadoresDoCartao(resultado().contadores);
    expect(c.map((x) => x.chave)).toEqual(['pontosPossiveis', 'pontosRealizados', 'naoConformidades', 'fotos', 'planosAcao']);
    expect(c.map((x) => x.valor)).toEqual([83, 75, 4, 12, 2]);
  });
});

describe('interpretarDestinatarios', () => {
  it('aceita e-mails separados por vírgula', () => {
    expect(interpretarDestinatarios('a@x.com, b@y.com.br')).toEqual({ emails: ['a@x.com', 'b@y.com.br'], erro: null });
  });

  it('ignora vazios e repetidos', () => {
    expect(interpretarDestinatarios('a@x.com,, A@x.com , ').emails).toEqual(['a@x.com']);
  });

  it('exige ao menos um e-mail', () => {
    expect(interpretarDestinatarios('  ').erro).toBe('Informe ao menos um e-mail.');
  });

  it('aceita no máximo cinco', () => {
    const seis = 'a@x.com,b@x.com,c@x.com,d@x.com,e@x.com,f@x.com';
    expect(interpretarDestinatarios(seis).erro).toBe('Informe no máximo 5 e-mails.');
    expect(interpretarDestinatarios(seis.replace(',f@x.com', '')).erro).toBeNull();
  });

  it('aponta o e-mail inválido', () => {
    expect(interpretarDestinatarios('a@x.com, bobo').erro).toBe('E-mail inválido: bobo');
  });
});
