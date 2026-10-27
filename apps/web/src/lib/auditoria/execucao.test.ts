import { describe, expect, it } from 'vitest';
import type { AuditoriaItem } from '@/lib/api';
import {
  aceitaFoto,
  aceitaObservacao,
  bloqueiaPorImagemIrrelevante,
  exigenciasDaResposta,
  pendenciaDoRegistro,
  agruparPorSecao,
  customizadoPendente,
  podeFinalizar,
  estaRespondido,
  naoConformidades,
  pendenciasObrigatorias,
  progresso,
  statusItem,
  vizinhos,
} from './execucao';

let seq = 0;
function item(parcial: {
  resposta?: string;
  ordem?: number;
  obrigatorio?: boolean;
  grupo?: { id: string; nome: string; ordem: number } | null;
  secao?: string;
  opcoes?: string[];
  configs?: { valor: string; pontuacao?: number | null; sentido?: 'positiva' | 'negativa' | 'neutra' }[];
  tipoCustom?: string;
}): AuditoriaItem {
  seq += 1;
  return {
    id: `i${seq}`,
    resposta: parcial.resposta ?? '',
    observacao: '',
    descricaoNaoConformidade: '',
    descricaoIa: '',
    complementoDescricao: '',
    planoAcaoSugerido: '',
    referenciaLegal: '',
    fotos: [],
    templateItem: {
      id: `t${seq}`,
      pergunta: `Pergunta ${seq}`,
      ordem: parcial.ordem ?? seq,
      obrigatorio: parcial.obrigatorio ?? false,
      usarRespostasPersonalizadas: Boolean(parcial.opcoes),
      opcoesResposta: parcial.opcoes,
      opcoesRespostaConfig: parcial.configs,
      tipoRespostaCustomizada: parcial.tipoCustom,
      grupo: parcial.grupo ?? undefined,
      grupoId: parcial.grupo?.id,
      secao: parcial.secao,
    },
  } as unknown as AuditoriaItem;
}

describe('estaRespondido / statusItem', () => {
  it('vazio e nao_avaliado são pendentes', () => {
    expect(estaRespondido(item({ resposta: '' }))).toBe(false);
    expect(statusItem(item({ resposta: 'nao_avaliado' }))).toBe('pendente');
  });
  it('respostas padrão', () => {
    expect(statusItem(item({ resposta: 'conforme' }))).toBe('conforme');
    expect(statusItem(item({ resposta: 'nao_conforme' }))).toBe('nao_conforme');
    expect(statusItem(item({ resposta: 'nao_aplicavel' }))).toBe('neutro');
  });
  it('opção personalizada usa a pontuação configurada', () => {
    const configs = [
      { valor: 'Bom', pontuacao: 2 },
      { valor: 'Regular', pontuacao: 0 },
      { valor: 'Ruim', pontuacao: -1 },
    ];
    const opcoes = ['Bom', 'Regular', 'Ruim'];
    expect(statusItem(item({ resposta: 'Bom', opcoes, configs }))).toBe('conforme');
    expect(statusItem(item({ resposta: 'Regular', opcoes, configs }))).toBe('neutro');
    expect(statusItem(item({ resposta: 'Ruim', opcoes, configs }))).toBe('nao_conforme');
  });
  it('opção personalizada "Não" sem pontuação conta como não conformidade pelo sentido deduzido', () => {
    const opcoes = ['Sim', 'Não'];
    expect(statusItem(item({ resposta: 'Sim', opcoes }))).toBe('conforme');
    expect(statusItem(item({ resposta: 'Não', opcoes }))).toBe('nao_conforme');
    expect(naoConformidades([item({ resposta: 'Não', opcoes }), item({ resposta: 'Sim', opcoes })])).toHaveLength(1);
  });
  it('sentido gravado prevalece sobre a pontuação', () => {
    const opcoes = ['Sim', 'Não'];
    const configs = [{ valor: 'Sim', pontuacao: 1, sentido: 'negativa' as const }, { valor: 'Não', pontuacao: 0, sentido: 'positiva' as const }];
    expect(statusItem(item({ resposta: 'Sim', opcoes, configs }))).toBe('nao_conforme');
    expect(statusItem(item({ resposta: 'Não', opcoes, configs }))).toBe('conforme');
  });
  it('campo customizado preenchido é respondido', () => {
    expect(statusItem(item({ resposta: '12', tipoCustom: 'numero' }))).toBe('respondido');
  });
});

describe('agruparPorSecao', () => {
  it('agrupa por grupo na ordem do grupo e dos itens', () => {
    const g1 = { id: 'g1', nome: 'Higiene', ordem: 2 };
    const g2 = { id: 'g2', nome: 'Estrutura', ordem: 1 };
    const itens = [
      item({ grupo: g1, ordem: 2, resposta: 'conforme' }),
      item({ grupo: g2, ordem: 5 }),
      item({ grupo: g1, ordem: 1 }),
    ];
    const secoes = agruparPorSecao(itens);
    expect(secoes.map((s) => s.nome)).toEqual(['Estrutura', 'Higiene']);
    expect(secoes[1].itens.map((i) => i.templateItem.ordem)).toEqual([1, 2]);
    expect(secoes[1].respondidos).toBe(1);
  });
  it('sem grupo usa secao e, sem secao, "Perguntas"', () => {
    const secoes = agruparPorSecao([item({ secao: 'Cozinha', ordem: 1 }), item({ ordem: 2 })]);
    expect(secoes.map((s) => s.nome)).toEqual(['Cozinha', 'Perguntas']);
  });
  it('template sem grupos vira uma seção única na ordem original', () => {
    const secoes = agruparPorSecao([item({ ordem: 3 }), item({ ordem: 1 })]);
    expect(secoes).toHaveLength(1);
    expect(secoes[0].itens.map((i) => i.templateItem.ordem)).toEqual([1, 3]);
  });
});

describe('progresso, pendências e não conformidades', () => {
  const itens = [
    item({ resposta: 'conforme', obrigatorio: true }),
    item({ resposta: '', obrigatorio: true }),
    item({ resposta: 'nao_conforme' }),
    item({ resposta: 'nao_avaliado' }),
  ];
  it('calcula progresso', () => {
    expect(progresso(itens)).toEqual({ respondidos: 2, total: 4, percentual: 50 });
    expect(progresso([])).toEqual({ respondidos: 0, total: 0, percentual: 0 });
  });
  it('lista obrigatórias pendentes', () => {
    expect(pendenciasObrigatorias(itens)).toEqual([itens[1]]);
  });
  it('lista não conformidades', () => {
    expect(naoConformidades(itens)).toEqual([itens[2]]);
  });
});

describe('vizinhos', () => {
  const sequencia = [item({}), item({}), item({})];
  it('meio tem anterior e próximo', () => {
    const v = vizinhos(sequencia, sequencia[1].id);
    expect(v.anterior?.id).toBe(sequencia[0].id);
    expect(v.proximo?.id).toBe(sequencia[2].id);
    expect(v.posicao).toBe(2);
  });
  it('extremidades retornam null', () => {
    expect(vizinhos(sequencia, sequencia[0].id).anterior).toBeNull();
    expect(vizinhos(sequencia, sequencia[2].id).proximo).toBeNull();
  });
  it('id inexistente', () => {
    expect(vizinhos(sequencia, 'x')).toEqual({ anterior: null, proximo: null, posicao: 0 });
  });
});

describe('podeFinalizar', () => {
  it('só auditoria em andamento pode ser finalizada', () => {
    expect(podeFinalizar('em_andamento')).toBe(true);
    expect(podeFinalizar('finalizada')).toBe(false);
    expect(podeFinalizar('cancelada')).toBe(false);
  });
});

describe('customizadoPendente', () => {
  it('texto ou número digitado e ainda não salvo fica pendente', () => {
    const it1 = item({ resposta: '10', tipoCustom: 'numero' });
    expect(customizadoPendente(it1, '12')).toBe(true);
    expect(customizadoPendente(it1, '10')).toBe(false);
    expect(customizadoPendente(it1, undefined)).toBe(false);
  });
  it('data, seleção e respostas padrão nunca ficam pendentes (salvam ao alterar)', () => {
    expect(customizadoPendente(item({ resposta: '', tipoCustom: 'data' }), '2026-10-17')).toBe(false);
    expect(customizadoPendente(item({ resposta: 'conforme' }), 'x')).toBe(false);
  });
});

describe('aceitaFoto / aceitaObservacao', () => {
  function comTemplate(extra: Record<string, unknown>): AuditoriaItem {
    const it = item({});
    Object.assign(it.templateItem, extra);
    return it;
  }

  it('texto não aceita foto mesmo com permiteFoto indefinido', () => {
    expect(aceitaFoto(comTemplate({ tipoRespostaCustomizada: 'texto' }))).toBe(false);
  });

  it('permiteFoto false não aceita foto', () => {
    expect(aceitaFoto(comTemplate({ permiteFoto: false }))).toBe(false);
  });

  it('permiteObservacao false não aceita observação', () => {
    expect(aceitaObservacao(comTemplate({ permiteObservacao: false }))).toBe(false);
  });

  it('campos ausentes (itens antigos) aceitam foto e observação', () => {
    const it = comTemplate({});
    expect(aceitaFoto(it)).toBe(true);
    expect(aceitaObservacao(it)).toBe(true);
  });
});

describe('bloqueiaPorImagemIrrelevante', () => {
  const base = item({});
  const semObs = item({});
  Object.assign(semObs.templateItem, { permiteObservacao: false });

  it('exige observação quando há imagem irrelevante e observação é aceita', () => {
    expect(bloqueiaPorImagemIrrelevante(base, true, '  ')).toBe(true);
    expect(bloqueiaPorImagemIrrelevante(base, true, 'ok')).toBe(false);
  });

  it('não bloqueia quando a pergunta não aceita observação (evita beco sem saída)', () => {
    expect(bloqueiaPorImagemIrrelevante(semObs, true, '')).toBe(false);
  });

  it('não bloqueia sem imagens irrelevantes', () => {
    expect(bloqueiaPorImagemIrrelevante(base, false, '')).toBe(false);
  });
});

describe('exigenciasDaResposta', () => {
  const configs = [
    { valor: 'Bom', pontuacao: 1, fotoObrigatoria: false, observacaoObrigatoria: false },
    { valor: 'Ruim', pontuacao: -1, fotoObrigatoria: true, observacaoObrigatoria: true },
  ];

  it('usa a configuração da resposta escolhida', () => {
    const it = item({ resposta: 'Ruim', opcoes: ['Bom', 'Ruim'], configs });
    expect(exigenciasDaResposta(it)).toEqual({ fotoObrigatoria: true, observacaoObrigatoria: true });
    expect(exigenciasDaResposta(item({ resposta: 'Bom', opcoes: ['Bom', 'Ruim'], configs }))).toEqual({
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    });
  });

  it('sem configuração mantém a regra antiga: observação obrigatória', () => {
    expect(exigenciasDaResposta(item({ resposta: 'conforme' }))).toEqual({ fotoObrigatoria: false, observacaoObrigatoria: true });
  });

  it('sem resposta não exige nada', () => {
    expect(exigenciasDaResposta(item({ resposta: '' }))).toEqual({ fotoObrigatoria: false, observacaoObrigatoria: false });
    expect(exigenciasDaResposta(item({ resposta: 'nao_avaliado' }))).toEqual({ fotoObrigatoria: false, observacaoObrigatoria: false });
  });

  it('não exige o que a pergunta não aceita', () => {
    const it = item({ resposta: 'Ruim', opcoes: ['Bom', 'Ruim'], configs });
    Object.assign(it.templateItem, { permiteFoto: false, permiteObservacao: false });
    expect(exigenciasDaResposta(it)).toEqual({ fotoObrigatoria: false, observacaoObrigatoria: false });
  });
});

describe('pendenciaDoRegistro', () => {
  const configs = [{ valor: 'Ruim', pontuacao: -1, fotoObrigatoria: true, observacaoObrigatoria: true }];
  const exigente = () => item({ resposta: 'Ruim', opcoes: ['Ruim'], configs });
  const vazio = { fotos: 0, observacao: '', temImagemIrrelevante: false };

  it('fotos só cobra a foto, mesmo com observação obrigatória', () => {
    expect(pendenciaDoRegistro(exigente(), 'fotos', vazio)).toEqual({ secao: 'fotos', mensagem: 'Esta resposta requer pelo menos uma foto' });
    expect(pendenciaDoRegistro(exigente(), 'fotos', { ...vazio, fotos: 1 })).toBeNull();
  });

  it('observação só cobra a observação, mesmo com foto obrigatória', () => {
    expect(pendenciaDoRegistro(exigente(), 'observacao', { ...vazio, observacao: '  ' })).toEqual({
      secao: 'observacao',
      mensagem: 'Esta resposta requer uma observação',
    });
    expect(pendenciaDoRegistro(exigente(), 'observacao', { ...vazio, observacao: 'ok' })).toBeNull();
  });

  it('foto irrelevante leva para a observação nas duas janelas', () => {
    const it = item({ resposta: 'nao_conforme', configs: [{ valor: 'nao_conforme', pontuacao: 0 }] });
    const estado = { fotos: 1, observacao: '', temImagemIrrelevante: true };
    expect(pendenciaDoRegistro(it, 'fotos', estado)?.secao).toBe('observacao');
    expect(pendenciaDoRegistro(it, 'observacao', estado)?.secao).toBe('observacao');
  });

  it('sem resposta precisa de algum registro na própria janela', () => {
    const it = item({ resposta: '' });
    expect(pendenciaDoRegistro(it, 'fotos', vazio)?.secao).toBe('fotos');
    expect(pendenciaDoRegistro(it, 'fotos', { ...vazio, fotos: 2 })).toBeNull();
    expect(pendenciaDoRegistro(it, 'observacao', vazio)?.secao).toBe('observacao');
    expect(pendenciaDoRegistro(it, 'observacao', { ...vazio, observacao: 'nota' })).toBeNull();
  });
});
