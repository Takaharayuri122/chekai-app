import { describe, it, expect } from 'vitest';
import { TipoRespostaCustomizada, type AuditoriaItem, type TemplateItem } from '@/lib/api';
import { visualDaResposta } from './visual-resposta';

const templatePadrao = { usarRespostasPersonalizadas: false } as TemplateItem;
const item = (resposta: string, templateItem: Partial<TemplateItem> = templatePadrao) =>
  ({ resposta, templateItem: templateItem as TemplateItem }) as Pick<AuditoriaItem, 'templateItem' | 'resposta'>;

const personalizado = (extra: Partial<TemplateItem> = {}): Partial<TemplateItem> => ({
  usarRespostasPersonalizadas: true,
  opcoesResposta: ['Ótimo', 'Regular', 'Ruim'],
  opcoesRespostaConfig: [
    { valor: 'Ótimo', pontuacao: 2, fotoObrigatoria: false, observacaoObrigatoria: false, icone: 'polegar-cima' },
    { valor: 'Regular', pontuacao: 1, fotoObrigatoria: false, observacaoObrigatoria: false },
    { valor: 'Ruim', pontuacao: 0, fotoObrigatoria: false, observacaoObrigatoria: false, icone: '🙁' },
  ],
  ...extra,
});

describe('visualDaResposta', () => {
  it('respostas padrão: conforme em success, não conforme em destructive, N/A em muted', () => {
    expect(visualDaResposta(item('conforme'))).toEqual({ tom: 'success', glifo: '✓' });
    expect(visualDaResposta(item('nao_conforme'))).toEqual({ tom: 'destructive', glifo: '✗' });
    expect(visualDaResposta(item('nao_aplicavel'))).toEqual({ tom: 'muted', glifo: '—' });
  });

  it('sem resposta ou não avaliado mostra "?"', () => {
    expect(visualDaResposta(item('nao_avaliado'))).toEqual({ tom: 'nenhum', glifo: '?' });
    expect(visualDaResposta(item(''))).toEqual({ tom: 'nenhum', glifo: '?' });
  });

  it('usa o sentido deduzido e o ícone configurado (código do catálogo ou caractere)', () => {
    expect(visualDaResposta(item('Ótimo', personalizado()))).toEqual({ tom: 'success', glifo: '👍' });
    expect(visualDaResposta(item('Regular', personalizado()))).toEqual({ tom: 'warning', glifo: '—' });
    expect(visualDaResposta(item('Ruim', personalizado()))).toEqual({ tom: 'destructive', glifo: '🙁' });
  });

  it('o sentido gravado prevalece sobre a pontuação', () => {
    const t = personalizado();
    t.opcoesRespostaConfig![2] = { ...t.opcoesRespostaConfig![2], sentido: 'neutra', icone: undefined };
    expect(visualDaResposta(item('Ruim', t))).toEqual({ tom: 'warning', glifo: '—' });
  });

  it('"Conforme" gravado como negativo fica em destructive', () => {
    const t = { ...templatePadrao, opcoesRespostaConfig: [{ valor: 'conforme', sentido: 'negativa' as const, fotoObrigatoria: false, observacaoObrigatoria: false }] };
    expect(visualDaResposta(item('conforme', t)).tom).toBe('destructive');
  });

  it('pergunta de texto sem resposta fica com "?"', () => {
    expect(visualDaResposta(item('', { tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO }))).toEqual({ tom: 'nenhum', glifo: '?' });
  });
});

describe('visualDaResposta - assinatura e respostas sem sentido', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo=';

  it('assinatura registrada vira imagem com ícone de caneta', async () => {
    const { imagemDaAssinatura, visualDaResposta } = await import('./visual-resposta');
    const item = { resposta: PNG, templateItem: { tipoRespostaCustomizada: 'assinatura' } } as never;
    expect(imagemDaAssinatura(item)).toBe(PNG);
    expect(visualDaResposta(item)).toEqual({ tom: 'muted', glifo: '✎' });
  });

  it('texto respondido fica neutro e não com "?"', async () => {
    const { visualDaResposta } = await import('./visual-resposta');
    const item = { resposta: 'Maria', templateItem: { tipoRespostaCustomizada: 'texto' } } as never;
    expect(visualDaResposta(item)).toEqual({ tom: 'muted', glifo: '—' });
  });
});
