import { describe, expect, it } from 'vitest';
import {
  continuarAcompanhando,
  deveAtualizar,
  erroTratadoNasTelasDeLegislacao,
  mensagemDoErro,
  rotuloSituacao,
  rotuloStatusLeitura,
} from './leitura';

describe('rotuloStatusLeitura', () => {
  it('traduz cada estado da leitura', () => {
    expect(rotuloStatusLeitura('pendente')).toBe('Aguardando');
    expect(rotuloStatusLeitura('lendo')).toBe('Lendo…');
    expect(rotuloStatusLeitura('concluida')).toBe('Pronta');
    expect(rotuloStatusLeitura('falhou')).toBe('Falhou');
  });
});

describe('rotuloSituacao', () => {
  it('traduz a situação da legislação', () => {
    expect(rotuloSituacao('vigente')).toBe('Vigente');
    expect(rotuloSituacao('vigente_com_alteracoes')).toBe('Vigente com alterações');
    expect(rotuloSituacao('revogada')).toBe('Revogada');
  });

  it('retorna null quando não há situação', () => {
    expect(rotuloSituacao(null)).toBeNull();
  });
});

describe('deveAtualizar', () => {
  it('só atualiza enquanto a leitura está em andamento (pendente não tem leitura rodando)', () => {
    expect(deveAtualizar('pendente')).toBe(false);
    expect(deveAtualizar('lendo')).toBe(true);
    expect(deveAtualizar('concluida')).toBe(false);
    expect(deveAtualizar('falhou')).toBe(false);
  });
});

describe('mensagemDoErro', () => {
  it('usa a mensagem em texto do corpo', () => {
    expect(mensagemDoErro({ response: { data: { message: 'Há vínculos.' } } })).toBe('Há vínculos.');
  });

  it('junta mensagens em lista', () => {
    expect(mensagemDoErro({ response: { data: { message: ['a', 'b'] } } })).toBe('a, b');
  });

  it('cai na mensagem padrão sem corpo', () => {
    expect(mensagemDoErro(new Error('x'))).toBe('Não foi possível concluir. Tente de novo.');
    expect(mensagemDoErro(undefined)).toBe('Não foi possível concluir. Tente de novo.');
  });
});

describe('continuarAcompanhando', () => {
  it('para depois de 5 falhas seguidas', () => {
    expect(continuarAcompanhando('lendo', 0)).toBe(true);
    expect(continuarAcompanhando('lendo', 4)).toBe(true);
    expect(continuarAcompanhando('lendo', 5)).toBe(false);
    expect(continuarAcompanhando('concluida', 0)).toBe(false);
  });
});

describe('erroTratadoNasTelasDeLegislacao', () => {
  it('cobre as rotas de gestão de legislações', () => {
    expect(erroTratadoNasTelasDeLegislacao('/legislacoes')).toBe(true);
    expect(erroTratadoNasTelasDeLegislacao('/legislacoes?busca=x')).toBe(true);
    expect(erroTratadoNasTelasDeLegislacao('/legislacoes/abc')).toBe(true);
    expect(erroTratadoNasTelasDeLegislacao('/legislacoes/abc/ler-novamente')).toBe(true);
    expect(erroTratadoNasTelasDeLegislacao('/legislacoes/abc/chunks')).toBe(true);
  });

  it('deixa de fora as opções dos seletores e outras rotas', () => {
    expect(erroTratadoNasTelasDeLegislacao('/legislacoes/opcoes')).toBe(false);
    expect(erroTratadoNasTelasDeLegislacao('/checklists/templates')).toBe(false);
    expect(erroTratadoNasTelasDeLegislacao('/auditorias/1/legislacoesx')).toBe(false);
  });
});
