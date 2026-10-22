import { describe, it, expect } from 'vitest';
import {
  estadoInicialLote,
  montarAlteracoes,
  resumoRespostasGrupo,
  secoesTravadas,
  temAlteracao,
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
      pontuacao: null,
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    });
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
});
