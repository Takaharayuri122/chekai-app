import { aplicarRegrasForcadas, ItemConfiguravel } from './checklist-regras';
import { TipoRespostaCustomizada } from './entities/template-item.entity';

const base = (): Partial<ItemConfiguravel> => ({
  usarRespostasPersonalizadas: false,
  peso: 1,
  permiteFoto: true,
  permiteObservacao: true,
});

describe('aplicarRegrasForcadas', () => {
  it('texto: peso 0, sem foto, sem opções e sem pontuação', () => {
    const item: Partial<ItemConfiguravel> = {
      tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO,
      usarRespostasPersonalizadas: true,
      peso: 5,
      permiteFoto: true,
      permiteObservacao: true,
      opcoesResposta: ['A'],
      opcoesRespostaConfig: [
        { valor: 'conforme', fotoObrigatoria: true, observacaoObrigatoria: true, pontuacao: 10 },
      ],
    };
    aplicarRegrasForcadas(item);
    expect(item.peso).toBe(0);
    expect(item.permiteFoto).toBe(false);
    expect(item.opcoesResposta).toBeNull();
    expect(item.opcoesRespostaConfig!.every((c) => !c.fotoObrigatoria && c.pontuacao == null)).toBe(true);
    expect(item.opcoesRespostaConfig!.find((c) => c.valor === 'conforme')!.observacaoObrigatoria).toBe(true);
  });

  it('permiteFoto false zera fotoObrigatoria de todas as opções', () => {
    const item = {
      ...base(),
      permiteFoto: false,
      opcoesRespostaConfig: [
        { valor: 'conforme', fotoObrigatoria: true, observacaoObrigatoria: true },
        { valor: 'nao_conforme', fotoObrigatoria: true, observacaoObrigatoria: false },
      ],
    };
    aplicarRegrasForcadas(item);
    expect(item.opcoesRespostaConfig!.every((c) => c.fotoObrigatoria === false)).toBe(true);
    expect(item.opcoesRespostaConfig!.find((c) => c.valor === 'conforme')!.observacaoObrigatoria).toBe(true);
  });

  it('permiteObservacao false zera observacaoObrigatoria de todas as opções', () => {
    const item = {
      ...base(),
      permiteObservacao: false,
      opcoesRespostaConfig: [
        { valor: 'conforme', fotoObrigatoria: true, observacaoObrigatoria: true },
        { valor: 'nao_conforme', fotoObrigatoria: false, observacaoObrigatoria: true },
      ],
    };
    aplicarRegrasForcadas(item);
    expect(item.opcoesRespostaConfig!.every((c) => c.observacaoObrigatoria === false)).toBe(true);
    expect(item.opcoesRespostaConfig!.find((c) => c.valor === 'conforme')!.fotoObrigatoria).toBe(true);
  });

  it('padrão sem config gera as 4 respostas padrão', () => {
    const item = base();
    aplicarRegrasForcadas(item);
    expect(item.opcoesRespostaConfig!.map((c) => c.valor)).toEqual([
      'conforme',
      'nao_conforme',
      'nao_aplicavel',
      'nao_avaliado',
    ]);
    expect(item.peso).toBe(1);
  });

  it('personalizada mantém config existente por valor e cria as que faltam', () => {
    const item: Partial<ItemConfiguravel> = {
      ...base(),
      usarRespostasPersonalizadas: true,
      opcoesResposta: ['Sim', 'Parcial'],
      opcoesRespostaConfig: [{ valor: 'Sim', fotoObrigatoria: true, observacaoObrigatoria: false, pontuacao: 3 }],
    };
    aplicarRegrasForcadas(item);
    expect(item.opcoesRespostaConfig).toEqual([
      { valor: 'Sim', fotoObrigatoria: true, observacaoObrigatoria: false, pontuacao: 3 },
      { valor: 'Parcial', fotoObrigatoria: false, observacaoObrigatoria: false },
    ]);
  });
});
