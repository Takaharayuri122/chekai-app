import { describe, it, expect } from 'vitest';
import {
  aceitarTodas,
  contadores,
  desfazerNomeGrupo,
  GRUPO_SEM_NOME,
  nomeGrupoSugerido,
  normalizarGrupos,
  diferencaPalavras,
  dividirEmLotes,
  filtrar,
  montarConfirmacao,
  revisarEmLotes,
  versaoFinal,
  type EstadoRevisao,
} from './revisao-importacao';
import {
  CategoriaItem,
  CriticidadeItem,
  type ConfiguracaoPerguntaImportada,
  type PerguntaImportada,
  type RevisaoGrupoResultado,
  type SugestaoPergunta,
} from '../api';

function config(p: Partial<ConfiguracaoPerguntaImportada> = {}): ConfiguracaoPerguntaImportada {
  return {
    categoria: CategoriaItem.OUTRO,
    criticidade: CriticidadeItem.MEDIA,
    tipoResposta: 'padrao',
    peso: 1,
    obrigatorio: true,
    permiteFoto: true,
    permiteObservacao: true,
    opcoes: [],
    ...p,
  };
}

function pergunta(chave: string, grupo = 'G1', p: Partial<PerguntaImportada> = {}): PerguntaImportada {
  return { chave, grupo, pergunta: `Original ${chave}`, configuracao: config(), ...p };
}

function sugestao(chave: string, p: Partial<SugestaoPergunta> = {}): SugestaoPergunta {
  return {
    chave,
    perguntaSugerida: `Sugerida ${chave}`,
    configuracaoSugerida: config({ criticidade: CriticidadeItem.CRITICA }),
    alteracoes: ['pergunta', 'criticidade'],
    conferir: false,
    ...p,
  };
}

function estado(p: Partial<EstadoRevisao> = {}): EstadoRevisao {
  return {
    perguntas: [],
    sugestoes: {},
    nomesGrupos: {},
    desfeitas: new Set(),
    conferidas: new Set(),
    edicoes: {},
    ...p,
  };
}

describe('revisao-importacao', () => {
  it('dividirEmLotes divide grupo de 90 em 40/40/10 mantendo o nome', () => {
    const perguntas = Array.from({ length: 90 }, (_, i) => pergunta(`k${i}`, 'Cozinha'));
    const lotes = dividirEmLotes(perguntas);
    expect(lotes.map((l) => l.perguntas.length)).toEqual([40, 40, 10]);
    expect(lotes.every((l) => l.grupo === 'Cozinha')).toBe(true);
  });

  it('dividirEmLotes nunca mistura grupos', () => {
    const lotes = dividirEmLotes([pergunta('a', 'A'), pergunta('b', 'B'), pergunta('c', 'A')]);
    expect(lotes.map((l) => [l.grupo, l.perguntas.map((x) => x.chave)])).toEqual([
      ['A', ['a', 'c']],
      ['B', ['b']],
    ]);
  });

  it('versaoFinal prioriza edição, depois desfeita, depois sugestão', () => {
    const p = pergunta('a');
    const s = sugestao('a');
    const base = { perguntas: [p], sugestoes: { a: s } };
    const sug = versaoFinal(estado(base), 'a');
    expect(sug.pergunta).toBe('Sugerida a');
    expect(sug.configuracao.criticidade).toBe(CriticidadeItem.CRITICA);

    const desfeita = versaoFinal(estado({ ...base, desfeitas: new Set(['a']) }), 'a');
    expect(desfeita.pergunta).toBe('Original a');
    expect(desfeita.configuracao.criticidade).toBe(CriticidadeItem.MEDIA);

    const editada = versaoFinal(
      estado({ ...base, desfeitas: new Set(['a']), edicoes: { a: 'Meu texto' } }),
      'a',
    );
    expect(editada.pergunta).toBe('Meu texto');

    const semSugestao = versaoFinal(estado({ perguntas: [p] }), 'a');
    expect(semSugestao.pergunta).toBe('Original a');
  });

  it('contadores ignora conferidas e desfeitas em paraConferir', () => {
    const e = estado({
      perguntas: [pergunta('a'), pergunta('b'), pergunta('c'), pergunta('d')],
      sugestoes: {
        a: sugestao('a', { conferir: true }),
        b: sugestao('b', { conferir: true }),
        c: sugestao('c', { conferir: true }),
        d: sugestao('d', { alteracoes: ['criticidade'] }),
      },
      conferidas: new Set(['b']),
      desfeitas: new Set(['c']),
    });
    expect(contadores(e)).toEqual({ corrigidas: 2, sugeridas: 3, paraConferir: 1 });
  });

  it("filtrar 'correcao' traz só alteracoes com 'pergunta'", () => {
    const e = estado({
      perguntas: [pergunta('a'), pergunta('b'), pergunta('c')],
      sugestoes: {
        a: sugestao('a'),
        b: sugestao('b', { alteracoes: ['criticidade'] }),
      },
    });
    expect(filtrar(e, 'correcao').map((p) => p.chave)).toEqual(['a']);
    expect(filtrar(e, 'todas')).toHaveLength(3);
  });

  it("filtrar 'conferir' traz só as pendentes de conferência", () => {
    const e = estado({
      perguntas: [pergunta('a'), pergunta('b')],
      sugestoes: { a: sugestao('a', { conferir: true }), b: sugestao('b', { conferir: true }) },
      conferidas: new Set(['b']),
    });
    expect(filtrar(e, 'conferir').map((p) => p.chave)).toEqual(['a']);
  });

  it('aceitarTodas limpa desfeitas e marca conferidas', () => {
    const e = estado({
      perguntas: [pergunta('a')],
      sugestoes: { a: sugestao('a', { conferir: true }) },
      desfeitas: new Set(['a']),
    });
    const r = aceitarTodas(e);
    expect(r.desfeitas.size).toBe(0);
    expect(contadores(r).paraConferir).toBe(0);
    expect(e.desfeitas.size).toBe(1);
  });

  it('diferencaPalavras marca só "desuso"', () => {
    const d = diferencaPalavras('objetos em dezuso', 'objetos em desuso');
    expect(d.map((x) => x.texto).join('')).toBe('objetos em desuso');
    expect(d.filter((x) => x.alterado).map((x) => x.texto)).toEqual(['desuso']);
  });

  it('montarConfirmacao usa nome de grupo sugerido e só os campos da API', () => {
    const e = estado({
      perguntas: [
        pergunta('a', 'AREAS', { secao: 'S1', motivoConferir: 'x' }),
        pergunta('b', 'OUTRO'),
        pergunta('c', 'AREAS'),
      ],
      sugestoes: { a: sugestao('a', { motivoConferir: 'y' }) },
      nomesGrupos: { AREAS: 'Áreas externas' },
    });
    const r = montarConfirmacao(e, { nomeTemplate: 'T' });
    expect(r.dados).toEqual({ nomeTemplate: 'T' });
    expect(r.grupos.map((g) => g.nome)).toEqual(['Áreas externas', 'OUTRO']);
    expect(r.grupos[0].perguntas.map((p) => p.pergunta)).toEqual(['Sugerida a', 'Original c']);
    expect(Object.keys(r.grupos[0].perguntas[0]).sort()).toEqual(['configuracao', 'pergunta', 'secao']);
    expect(r.grupos[1].perguntas[0]).not.toHaveProperty('chave');
  });
});

describe('revisarEmLotes', () => {
  const ok = (grupoNomeSugerido?: string): RevisaoGrupoResultado => ({ status: 'revisado', grupoNomeSugerido, sugestoes: [] });

  it('chama em sequência, conta grupos distintos e guarda o primeiro nome sugerido', async () => {
    const perguntas = [
      ...Array.from({ length: 45 }, (_, i) => pergunta(`a${i}`, 'A')),
      pergunta('b0', 'B'),
    ];
    const emAndamento: number[] = [];
    let ativas = 0;
    const progresso: string[] = [];
    const nomes = ['Grupo A', 'Outro', undefined];
    const r = await revisarEmLotes(
      perguntas,
      async () => {
        ativas++;
        emAndamento.push(ativas);
        await Promise.resolve();
        ativas--;
        return ok(nomes.shift());
      },
      (p) => progresso.push(`${p.grupoAtual}/${p.totalGrupos}`),
    );
    expect(Math.max(...emAndamento)).toBe(1);
    expect(progresso).toEqual(['1/2', '1/2', '2/2']);
    expect(r.nomesGrupos).toEqual({ A: 'Grupo A' });
  });

  it('sem_creditos interrompe e falha continua', async () => {
    const perguntas = [pergunta('a', 'A'), pergunta('b', 'B'), pergunta('c', 'C')];
    const respostas: RevisaoGrupoResultado[] = [
      { status: 'falha', sugestoes: [] },
      { status: 'sem_creditos', sugestoes: [] },
    ];
    let chamadas = 0;
    const r = await revisarEmLotes(perguntas, async () => {
      chamadas++;
      return respostas.shift()!;
    });
    expect(chamadas).toBe(2);
    expect(r.semCreditos).toBe(true);
    expect(r.falhas).toBe(1);
  });

  describe('perguntas sem grupo', () => {
    const semGrupo = [pergunta('a', ''), pergunta('b', '  '), pergunta('c', 'G1')];

    it('normalizarGrupos agrupa perguntas sem grupo em "Sem grupo" sem mudar as demais', () => {
      expect(normalizarGrupos(semGrupo).map((p) => p.grupo)).toEqual([GRUPO_SEM_NOME, GRUPO_SEM_NOME, 'G1']);
      expect(GRUPO_SEM_NOME).toBe('Sem grupo');
    });

    it('dividirEmLotes e montarConfirmacao nunca usam nome de grupo vazio', () => {
      expect(dividirEmLotes(semGrupo).map((l) => l.grupo)).toEqual([GRUPO_SEM_NOME, 'G1']);
      const r = montarConfirmacao(estado({ perguntas: semGrupo }), { nomeTemplate: 'T' });
      expect(r.grupos.map((g) => g.nome)).toEqual([GRUPO_SEM_NOME, 'G1']);
      expect(r.grupos[0].perguntas).toHaveLength(2);
    });

    it('revisarEmLotes envia "Sem grupo" para a revisão', async () => {
      const grupos: string[] = [];
      await revisarEmLotes(semGrupo, async (g) => {
        grupos.push(g);
        return { status: 'revisado', sugestoes: [] };
      });
      expect(grupos).toEqual([GRUPO_SEM_NOME, 'G1']);
    });
  });

  describe('nome de grupo sugerido', () => {
    it('nomeGrupoSugerido só devolve quando difere do original', () => {
      const e = estado({ nomesGrupos: { Higiene: 'Higiene', Areas: 'Áreas' } });
      expect(nomeGrupoSugerido(e, 'Higiene')).toBeUndefined();
      expect(nomeGrupoSugerido(e, 'Areas')).toBe('Áreas');
      expect(nomeGrupoSugerido(e, 'Outro')).toBeUndefined();
    });

    it('desfazerNomeGrupo volta ao nome original e a confirmação usa o original', () => {
      const e = estado({ perguntas: [pergunta('a', 'Areas')], nomesGrupos: { Areas: 'Áreas' } });
      const desfeito = desfazerNomeGrupo(e, 'Areas');
      expect(nomeGrupoSugerido(desfeito, 'Areas')).toBeUndefined();
      expect(montarConfirmacao(desfeito, { nomeTemplate: 'T' }).grupos[0].nome).toBe('Areas');
      expect(e.nomesGrupos).toEqual({ Areas: 'Áreas' });
    });
  });
});
