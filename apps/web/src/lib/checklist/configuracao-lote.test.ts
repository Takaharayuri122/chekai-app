import { describe, it, expect } from 'vitest';
import {
  estadoInicialLote,
  formGrupoAlterado,
  lerPontos,
  pesoAoTrocarTipo,
  montarAlteracoes,
  motivoRequisicaoInvalida,
  selecionadosAtivos,
  trocarTipoLote,
  montarRequisicaoLote,
  opcoesParaTipo,
  opcoesValidas,
  resumoRespostasGrupo,
  secoesTravadas,
  temAlteracao,
  opcoesComuns,
  moverOpcao,
  removerOpcao,
  adicionarOpcao,
  renomearOpcao,
  problemasOpcoes,
  respostasRemovidasEmUso,
  renomeiaRespostaUsada,
} from './configuracao-lote';
import { CriticidadeItem, TipoRespostaCustomizada, type TemplateItem } from '../api';

function item(p: Partial<TemplateItem>): TemplateItem {
  return { id: 'i', usarRespostasPersonalizadas: false, ativo: true, ...p } as TemplateItem;
}

describe('configuracao-lote', () => {
  it('estado inicial não tem alteração', () => {
    const e = estadoInicialLote();
    expect(temAlteracao(e)).toBe(false);
    expect(e.criticidade).toBe(CriticidadeItem.MEDIA);
    expect(e.opcoes).toHaveLength(4);
    expect(e.opcoes[0]).toEqual({
      valor: 'conforme',
      pontuacao: 1,
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    });
    expect(e.opcoes.map((o) => o.pontuacao)).toEqual([1, 0, null, null]);
  });

  it('temAlteracao true após ligar uma seção', () => {
    const e = estadoInicialLote();
    e.ligadas.obrigatorio = true;
    expect(temAlteracao(e)).toBe(true);
  });

  it('montarAlteracoes só leva seções ligadas', () => {
    const e = estadoInicialLote();
    expect(montarAlteracoes(e)).toEqual({});
    e.ligadas.obrigatorio = true;
    e.ligadas.criticidade = true;
    e.criticidade = CriticidadeItem.ALTA;
    expect(montarAlteracoes(e)).toEqual({ obrigatorio: true, criticidade: 'alta' });
  });

  it('texto trava opcoes e permiteFoto e não os envia', () => {
    const e = estadoInicialLote();
    e.ligadas.tipoResposta = true;
    e.tipoResposta = 'texto';
    e.ligadas.opcoes = true;
    e.ligadas.permiteFoto = true;
    e.ligadas.permiteObservacao = true;
    const t = secoesTravadas(e);
    expect(t.opcoes).toBe('Não se aplica a respostas em texto');
    expect(t.permiteFoto).toBe('Desativado: respostas em texto não recebem fotos');
    expect(montarAlteracoes(e)).toEqual({ tipoResposta: 'texto', permiteObservacao: true });
  });

  it('numero e data travam opcoes', () => {
    const e = estadoInicialLote();
    e.ligadas.tipoResposta = true;
    e.tipoResposta = 'numero';
    expect(secoesTravadas(e).opcoes).toBe('Não se aplica a respostas em número ou data');
  });

  it('opcoes travada com tipo desligado', () => {
    const e = estadoInicialLote();
    e.ligadas.opcoes = true;
    expect(secoesTravadas(e).opcoes).toBe('Ligue "Tipo de resposta" para definir as opções');
    expect(montarAlteracoes(e).opcoes).toBeUndefined();
  });

  it('opcoes é enviada com tipo personalizada', () => {
    const e = estadoInicialLote();
    e.ligadas.tipoResposta = true;
    e.tipoResposta = 'personalizada';
    e.ligadas.opcoes = true;
    expect(secoesTravadas(e).opcoes).toBeUndefined();
    expect(montarAlteracoes(e).opcoes).toHaveLength(4);
  });

  it('resumoRespostasGrupo conta padrão/personalizadas/texto, ignorando inativos', () => {
    const r = resumoRespostasGrupo([
      item({}),
      item({}),
      item({ usarRespostasPersonalizadas: true }),
      item({ usarRespostasPersonalizadas: true, tipoRespostaCustomizada: TipoRespostaCustomizada.SELECT }),
      item({ usarRespostasPersonalizadas: true, tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO }),
      item({ usarRespostasPersonalizadas: true, tipoRespostaCustomizada: TipoRespostaCustomizada.NUMERO }),
      item({ usarRespostasPersonalizadas: true, tipoRespostaCustomizada: TipoRespostaCustomizada.DATA }),
      item({ ativo: false }),
    ]);
    expect(r).toEqual({ padrao: 2, personalizadas: 2, texto: 1, outros: 2 });
  });

  it('montarRequisicaoLote respeita o escopo', () => {
    const e = estadoInicialLote();
    e.ligadas.obrigatorio = true;
    e.obrigatorio = false;
    expect(montarRequisicaoLote({ tipo: 'selecao', itemIds: ['a', 'b'] }, e, true)).toEqual({
      itemIds: ['a', 'b'],
      alteracoes: { obrigatorio: false },
      simular: true,
    });
    expect(montarRequisicaoLote({ tipo: 'grupo', grupoId: 'g', nome: 'G', total: 3 }, e, false)).toEqual({
      grupoId: 'g',
      alteracoes: { obrigatorio: false },
      simular: false,
    });
    const todo = montarRequisicaoLote({ tipo: 'checklist', total: 9 }, e, false);
    expect(todo.itemIds).toBeUndefined();
    expect(todo.grupoId).toBeUndefined();
  });

  it('opcoesParaTipo e opcoesValidas', () => {
    expect(opcoesParaTipo('padrao')[1].valor).toBe('nao_conforme');
    expect(opcoesParaTipo('personalizada')[1].valor).toBe('Não Conforme');
    expect(opcoesValidas(opcoesParaTipo('padrao'))).toBe(true);
    expect(opcoesValidas([])).toBe(false);
    const o = opcoesParaTipo('personalizada');
    o[0].valor = ' ';
    expect(opcoesValidas(o)).toBe(false);
    o[0].valor = 'não conforme';
    expect(opcoesValidas(o)).toBe(false);
  });

  it('opcoesParaTipo já vem com 1/0 em conforme e não conforme', () => {
    expect(opcoesParaTipo('padrao').map((o) => o.pontuacao)).toEqual([1, 0, null, null]);
    expect(opcoesParaTipo('personalizada').map((o) => o.pontuacao)).toEqual([1, 0, null, null]);
  });

  it('lerPontos: vazio fica sem pontuação explícita, exceto N/A e N/Av do padrão', () => {
    expect(lerPontos('', 'conforme', 'padrao')).toBeUndefined();
    expect(lerPontos('', 'Sim', 'personalizada')).toBeUndefined();
    expect(lerPontos('', 'nao_aplicavel', 'padrao')).toBeNull();
    expect(lerPontos('3', 'Sim', 'personalizada')).toBe(3);
    expect(lerPontos('-2', 'nao_conforme', 'padrao')).toBe(-2);
  });

  it('pontos em branco não são enviados como null', () => {
    const e = trocarTipoLote({ ...estadoInicialLote(), ligadas: { ...estadoInicialLote().ligadas, tipoResposta: true } }, 'padrao');
    e.ligadas.opcoes = true;
    e.opcoes[0] = { ...e.opcoes[0], pontuacao: lerPontos('', 'conforme', 'padrao') };
    const corpo = JSON.parse(JSON.stringify(montarAlteracoes(e)));
    expect('pontuacao' in corpo.opcoes[0]).toBe(false);
  });

  it('escolher personalizada liga as opções com ao menos uma opção', () => {
    const inicial = estadoInicialLote();
    inicial.ligadas.tipoResposta = true;
    const e = trocarTipoLote(inicial, 'personalizada');
    expect(e.tipoResposta).toBe('personalizada');
    expect(e.ligadas.opcoes).toBe(true);
    expect(e.opcoes.length).toBeGreaterThan(0);
    expect(motivoRequisicaoInvalida(e)).toBeNull();
    expect(montarAlteracoes(e).opcoes?.length).toBeGreaterThan(0);
  });

  it('personalizada sem a seção de opções ligada é inválida localmente', () => {
    const e = trocarTipoLote({ ...estadoInicialLote(), ligadas: { ...estadoInicialLote().ligadas, tipoResposta: true } }, 'personalizada');
    e.ligadas.opcoes = false;
    expect(motivoRequisicaoInvalida(e)).toBeTruthy();
    e.ligadas.opcoes = true;
    e.opcoes = [];
    expect(motivoRequisicaoInvalida(e)).toBeTruthy();
  });

  it('pontos fora de -10 a 10 são inválidos localmente', () => {
    const e = trocarTipoLote({ ...estadoInicialLote(), ligadas: { ...estadoInicialLote().ligadas, tipoResposta: true } }, 'padrao');
    e.ligadas.opcoes = true;
    e.opcoes[0] = { ...e.opcoes[0], pontuacao: 11 };
    expect(motivoRequisicaoInvalida(e)).toBeTruthy();
    e.opcoes[0] = { ...e.opcoes[0], pontuacao: 10 };
    expect(motivoRequisicaoInvalida(e)).toBeNull();
  });

  it('selecionadosAtivos ignora ids removidos ou inativos', () => {
    const itens = [item({ id: 'a' }), item({ id: 'b', ativo: false }), item({ id: 'c' })];
    expect(selecionadosAtivos(itens, new Set(['a', 'b', 'x']))).toEqual(['a']);
  });

  it('pesoAoTrocarTipo: texto zera; sair de texto com peso 0 volta a 1', () => {
    expect(pesoAoTrocarTipo(undefined, TipoRespostaCustomizada.TEXTO, 3)).toBe(0);
    expect(pesoAoTrocarTipo(TipoRespostaCustomizada.TEXTO, undefined, 0)).toBe(1);
    expect(pesoAoTrocarTipo(TipoRespostaCustomizada.TEXTO, TipoRespostaCustomizada.NUMERO, 0)).toBe(1);
    expect(pesoAoTrocarTipo(TipoRespostaCustomizada.TEXTO, TipoRespostaCustomizada.NUMERO, 2)).toBe(2);
    expect(pesoAoTrocarTipo(undefined, TipoRespostaCustomizada.DATA, 0)).toBe(0);
  });

  it('formGrupoAlterado compara com o grupo em edição', () => {
    const grupo = { nome: 'Higiene', descricao: undefined };
    expect(formGrupoAlterado({ nome: 'Higiene', descricao: '' }, grupo)).toBe(false);
    expect(formGrupoAlterado({ nome: 'Higiene 2', descricao: '' }, grupo)).toBe(true);
    expect(formGrupoAlterado({ nome: 'Higiene', descricao: 'x' }, grupo)).toBe(true);
    expect(formGrupoAlterado({ nome: '', descricao: '' }, null)).toBe(false);
    expect(formGrupoAlterado({ nome: 'Novo', descricao: '' }, null)).toBe(true);
  });

  describe('respostas personalizadas', () => {
    const pers = (id: string, valores: string[], extra: Partial<TemplateItem> = {}) =>
      item({
        id,
        usarRespostasPersonalizadas: true,
        opcoesResposta: valores,
        opcoesRespostaConfig: valores.map((valor, i) => ({
          valor,
          pontuacao: i === 0 ? 10 : 0,
          fotoObrigatoria: i === 1,
          observacaoObrigatoria: false,
        })),
        ...extra,
      });

    it('opcoesComuns devolve as opções com valorOriginal quando todas as perguntas têm as mesmas', () => {
      expect(opcoesComuns([pers('a', ['Sim', 'Não']), pers('b', ['Sim', 'Não'])])).toEqual([
        { valor: 'Sim', valorOriginal: 'Sim', pontuacao: 10, fotoObrigatoria: false, observacaoObrigatoria: false },
        { valor: 'Não', valorOriginal: 'Não', pontuacao: 0, fotoObrigatoria: true, observacaoObrigatoria: false },
      ]);
    });

    it('opcoesComuns leva o sentido e o ícone gravados para não perdê-los ao salvar', () => {
      const a = pers('a', ['Sim', 'Não']);
      a.opcoesRespostaConfig![1] = { ...a.opcoesRespostaConfig![1], sentido: 'negativa', icone: '👎' };
      const [sim, nao] = opcoesComuns([a])!;
      expect('sentido' in sim || 'icone' in sim).toBe(false);
      expect(nao).toMatchObject({ sentido: 'negativa', icone: '👎' });
    });

    it('opcoesComuns é null com ordem diferente, pergunta padrão, tipo texto ou lista vazia', () => {
      expect(opcoesComuns([pers('a', ['Sim', 'Não']), pers('b', ['Não', 'Sim'])])).toBeNull();
      expect(opcoesComuns([pers('a', ['Sim', 'Não']), item({ id: 'b' })])).toBeNull();
      expect(
        opcoesComuns([pers('a', ['Sim', 'Não'], { tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO })]),
      ).toBeNull();
      expect(opcoesComuns([])).toBeNull();
    });

    it('opcoesComuns aceita o tipo select e ignora perguntas inativas', () => {
      expect(
        opcoesComuns([
          pers('a', ['Sim', 'Não'], { tipoRespostaCustomizada: TipoRespostaCustomizada.SELECT }),
          item({ id: 'b', ativo: false }),
        ])?.map((o) => o.valor),
      ).toEqual(['Sim', 'Não']);
    });

    it('escolher personalizada semeia com as opções comuns quando existirem', () => {
      const inicial = estadoInicialLote();
      inicial.ligadas.tipoResposta = true;
      const comuns = opcoesComuns([pers('a', ['Sim', 'Não'])]);
      const e = trocarTipoLote(inicial, 'personalizada', comuns);
      expect(e.opcoes.map((o) => o.valorOriginal)).toEqual(['Sim', 'Não']);
      const semComuns = trocarTipoLote(inicial, 'personalizada', null);
      expect(semComuns.opcoes.every((o) => o.valorOriginal === undefined)).toBe(true);
      expect(trocarTipoLote(inicial, 'padrao', comuns).opcoes[0].valor).toBe('conforme');
    });

    it('moverOpcao, removerOpcao, adicionarOpcao e renomearOpcao não alteram a lista original', () => {
      const lista = opcoesComuns([pers('a', ['A', 'B', 'C'])])!;
      expect(moverOpcao(lista, 2, 0).map((o) => o.valor)).toEqual(['C', 'A', 'B']);
      expect(moverOpcao(lista, 0, 5).map((o) => o.valor)).toEqual(['A', 'B', 'C']);
      expect(removerOpcao(lista, 1).map((o) => o.valor)).toEqual(['A', 'C']);
      const mais = adicionarOpcao(lista);
      expect(mais).toHaveLength(4);
      expect(mais[3]).toEqual({ valor: '', fotoObrigatoria: false, observacaoObrigatoria: false });
      const renomeada = renomearOpcao(lista, 0, 'Sim');
      expect(renomeada[0]).toMatchObject({ valor: 'Sim', valorOriginal: 'A' });
      expect(lista.map((o) => o.valor)).toEqual(['A', 'B', 'C']);
    });

    it('problemasOpcoes: mínimo 2, texto vazio e repetição', () => {
      const o = (valor: string) => ({ valor, fotoObrigatoria: false, observacaoObrigatoria: false });
      expect(problemasOpcoes([o('Sim')])).toBe('Use ao menos 2 respostas.');
      expect(problemasOpcoes([o('Sim'), o('  ')])).toBe('Dê um texto a cada resposta.');
      expect(problemasOpcoes([o('Sim'), o(' SIM ')])).toBe('Dê um texto diferente a cada resposta.');
      expect(problemasOpcoes([o('Sim'), o('Não')])).toBeNull();
      expect(problemasOpcoes([o('Sim'), o('a'.repeat(101))])).toBe('Use até 100 caracteres em cada resposta.');
      expect(problemasOpcoes([o('Sim'), o('a'.repeat(100))])).toBeNull();
    });

    it('motivoRequisicaoInvalida usa problemasOpcoes em personalizada', () => {
      const inicial = estadoInicialLote();
      inicial.ligadas.tipoResposta = true;
      const e = trocarTipoLote(inicial, 'personalizada');
      e.opcoes = e.opcoes.slice(0, 1);
      expect(motivoRequisicaoInvalida(e)).toBe('Use ao menos 2 respostas.');
    });

    it('motivoRequisicaoInvalida recusa remover resposta já usada', () => {
      const inicial = estadoInicialLote();
      inicial.ligadas.tipoResposta = true;
      const e = trocarTipoLote(inicial, 'personalizada', opcoesComuns([pers('a', ['Sim', 'Não', 'Talvez'])]));
      const emUso = [{ valor: 'Talvez', auditorias: 3 }];
      expect(motivoRequisicaoInvalida(e, emUso)).toBeNull();
      e.opcoes = removerOpcao(e.opcoes, 2);
      expect(respostasRemovidasEmUso(e.opcoes, emUso)).toEqual(emUso);
      expect(motivoRequisicaoInvalida(e, emUso)).toBe(
        'A resposta “Talvez” já foi usada em 3 auditorias e não pode ser removida.',
      );
    });

    it('renomeiaRespostaUsada só quando o texto de uma resposta usada muda', () => {
      const lista = opcoesComuns([pers('a', ['Sim', 'Não'])])!;
      const emUso = [{ valor: 'Sim', auditorias: 1 }];
      expect(renomeiaRespostaUsada(lista, emUso)).toBe(false);
      expect(renomeiaRespostaUsada(renomearOpcao(lista, 1, 'Nunca'), emUso)).toBe(false);
      expect(renomeiaRespostaUsada(renomearOpcao(lista, 0, 'Sempre'), emUso)).toBe(true);
      expect(renomeiaRespostaUsada(renomearOpcao(lista, 0, ' Sim '), emUso)).toBe(false);
    });

    it('montarAlteracoes envia valorOriginal quando houver', () => {
      const inicial = estadoInicialLote();
      inicial.ligadas.tipoResposta = true;
      const e = trocarTipoLote(inicial, 'personalizada', opcoesComuns([pers('a', ['Sim', 'Não'])]));
      e.opcoes = adicionarOpcao(renomearOpcao(e.opcoes, 0, 'Sempre'));
      e.opcoes = renomearOpcao(e.opcoes, 2, 'Talvez');
      const corpo = JSON.parse(JSON.stringify(montarAlteracoes(e)));
      expect(corpo.opcoes.map((o: { valorOriginal?: string }) => o.valorOriginal)).toEqual(['Sim', 'Não', undefined]);
    });
  });
});
