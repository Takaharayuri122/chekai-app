import { describe, expect, it } from 'vitest';
import { TipoRespostaCustomizada, type TemplateItem } from '@/lib/api';
import {
  camposDaConfig,
  emojiDoIcone,
  escolherIcone,
  escolherSentido,
  sentidoDeduzidoDaOpcao,
  sentidoDeduzidoNoLote,
  sentidoMarcado,
} from './seletor-sentido-icone.logic';

const base = (p: Partial<TemplateItem>) => p as TemplateItem;

describe('seletor-sentido-icone.logic', () => {
  it('marca o sentido deduzido quando nada foi gravado', () => {
    const item = base({
      usarRespostasPersonalizadas: true,
      tipoRespostaCustomizada: TipoRespostaCustomizada.SELECT,
      opcoesResposta: ['Sim', 'Não'],
      opcoesRespostaConfig: [
        { valor: 'Sim', pontuacao: 1, fotoObrigatoria: false, observacaoObrigatoria: false },
        { valor: 'Não', pontuacao: 0, fotoObrigatoria: false, observacaoObrigatoria: false },
      ],
    });
    expect(sentidoMarcado(null, sentidoDeduzidoDaOpcao(item, 'Não'))).toBe('negativa');
    expect(sentidoMarcado(null, sentidoDeduzidoDaOpcao(item, 'Sim'))).toBe('positiva');
  });

  it('a dedução ignora o sentido gravado e o gravado prevalece na marcação', () => {
    const item = base({
      usarRespostasPersonalizadas: true,
      opcoesResposta: ['Sim', 'Não'],
      opcoesRespostaConfig: [
        { valor: 'Sim', pontuacao: 1, sentido: 'negativa', fotoObrigatoria: false, observacaoObrigatoria: false },
        { valor: 'Não', pontuacao: 0, fotoObrigatoria: false, observacaoObrigatoria: false },
      ],
    });
    const deduzido = sentidoDeduzidoDaOpcao(item, 'Sim');
    expect(deduzido).toBe('positiva');
    expect(sentidoMarcado('negativa', deduzido)).toBe('negativa');
  });

  it('escolher Negativa e 👎 emite sentido e ícone', () => {
    const vazio = { sentido: null, icone: null };
    const comSentido = escolherSentido(vazio, 'negativa');
    expect(escolherIcone(comSentido, '👎')).toEqual({ sentido: 'negativa', icone: '👎' });
  });

  it('escolher só o ícone não grava o sentido', () => {
    const r = escolherIcone({ sentido: null, icone: null }, '👍');
    expect(r.sentido).toBeNull();
    expect(camposDaConfig(r)).toEqual({ sentido: undefined, icone: '👍' });
  });

  it('sem ícone limpa o ícone mantendo o sentido', () => {
    expect(escolherIcone({ sentido: 'positiva', icone: '👍' }, null)).toEqual({ sentido: 'positiva', icone: null });
  });

  it('emojiDoIcone aceita código do catálogo ou caractere', () => {
    expect(emojiDoIcone('polegar-baixo')).toBe('👎');
    expect(emojiDoIcone('👎')).toBe('👎');
    expect(emojiDoIcone(null)).toBeNull();
  });

  it('no lote, a dedução acompanha a pontuação editada', () => {
    const o = (valor: string, pontuacao: number) => ({ valor, pontuacao, fotoObrigatoria: false, observacaoObrigatoria: false });
    expect(sentidoDeduzidoNoLote([o('Ótimo', 2), o('Bom', 1), o('Ruim', 0)], 'personalizada', 'Ruim')).toBe('negativa');
    expect(sentidoDeduzidoNoLote([o('Ótimo', 0), o('Bom', 1), o('Ruim', 2)], 'personalizada', 'Ruim')).toBe('positiva');
    expect(sentidoDeduzidoNoLote([o('conforme', 1), o('nao_conforme', 0)], 'padrao', 'nao_conforme')).toBe('negativa');
  });
});
