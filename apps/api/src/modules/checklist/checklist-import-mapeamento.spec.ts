import { ChecklistImportService } from './checklist-import.service';
import {
  configuracaoParaItem,
  mapearLinhaImportada,
  mapearTipoResposta,
  normalizarConfiguracao,
} from './checklist-import-mapeamento';
import { ChecklistCsvRow, ConfiguracaoPerguntaImportada } from './dto/importar-checklist.dto';
import { CategoriaItem, CriticidadeItem, TemplateItem } from './entities/template-item.entity';
import { calcularPontuacaoOpcao } from './regras';

/** Mesma regra de pontuação da auditoria, aplicada ao item como ele volta do banco (JSON). */
function pontuar(item: Partial<TemplateItem>, valor: string): number {
  const salvo = JSON.parse(JSON.stringify(item)) as TemplateItem;
  return calcularPontuacaoOpcao(salvo, valor);
}

const linha = (extra: Partial<ChecklistCsvRow> = {}): ChecklistCsvRow => ({
  grupo: 'Higiene',
  secao: 'A',
  pergunta: 'Pergunta?',
  ...extra,
});

describe('mapearLinhaImportada', () => {
  it('célula vazia de permite fotos → permiteFoto true', () => {
    const p = mapearLinhaImportada(linha({ permiteFotos: undefined }), 0);
    expect(p.configuracao.permiteFoto).toBe(true);
    expect(p.configuracao.permiteObservacao).toBe(true);
  });

  it('"Não" em permite fotos → permiteFoto false e nenhuma opção com fotoObrigatoria', () => {
    const p = mapearLinhaImportada(
      linha({
        permiteFotos: false,
        fotosObrigatorias: true,
        opcoesResposta: [
          { texto: 'Sim', inconformidade: false },
          { texto: 'Não', inconformidade: true },
        ],
      }),
      0,
    );
    expect(p.configuracao.permiteFoto).toBe(false);
    expect(p.configuracao.opcoes.some((o) => o.fotoObrigatoria)).toBe(false);
  });

  it('fotos obrigatórias só nas opções de inconformidade', () => {
    const p = mapearLinhaImportada(
      linha({
        fotosObrigatorias: true,
        opcoesResposta: [
          { texto: 'Sim', inconformidade: false },
          { texto: 'Não', inconformidade: true },
        ],
      }),
      0,
    );
    const porValor = Object.fromEntries(p.configuracao.opcoes.map((o) => [o.valor, o]));
    expect(porValor['Sim'].fotoObrigatoria).toBe(false);
    expect(porValor['Não'].fotoObrigatoria).toBe(true);
  });

  it('sem opção marcada como inconformidade, todas recebem a exigência', () => {
    const p = mapearLinhaImportada(
      linha({
        justificativaObrigatoria: true,
        opcoesResposta: [{ texto: 'A' }, { texto: 'B' }],
      }),
      0,
    );
    expect(p.configuracao.opcoes.every((o) => o.observacaoObrigatoria)).toBe(true);
  });

  it('sem opções, exigências caem só em nao_conforme', () => {
    const p = mapearLinhaImportada(
      linha({ fotosObrigatorias: true, justificativaObrigatoria: true }),
      0,
    );
    expect(p.configuracao.tipoResposta).toBe('padrao');
    const porValor = Object.fromEntries(p.configuracao.opcoes.map((o) => [o.valor, o]));
    expect(porValor['nao_conforme'].fotoObrigatoria).toBe(true);
    expect(porValor['nao_conforme'].observacaoObrigatoria).toBe(true);
    expect(porValor['conforme'].fotoObrigatoria).toBe(false);
    expect(porValor['nao_aplicavel'].pontuacao).toBeNull();
    expect(porValor['nao_avaliado'].pontuacao).toBeNull();
  });

  it('pontos por opção viram pontuacao', () => {
    const p = mapearLinhaImportada(
      linha({
        opcoesResposta: [
          { texto: 'Sim', pontos: 5 },
          { texto: 'Não' },
        ],
      }),
      0,
    );
    expect(p.configuracao.tipoResposta).toBe('personalizada');
    expect(p.configuracao.opcoes.map((o) => o.pontuacao)).toEqual([5, undefined]);
  });

  it('tipo "Texto livre" → texto, peso 0, permiteFoto false', () => {
    const p = mapearLinhaImportada(linha({ tipoResposta: 'Texto livre', pontuacaoMaxima: 3 }), 0);
    expect(p.configuracao.tipoResposta).toBe('texto');
    expect(p.configuracao.peso).toBe(0);
    expect(p.configuracao.permiteFoto).toBe(false);
    expect(p.configuracao.opcoes).toEqual([]);
  });

  it('tipo "Escala XYZ" desconhecido → motivoConferir preenchido', () => {
    const p = mapearLinhaImportada(linha({ tipoResposta: 'Escala XYZ' }), 2);
    expect(p.motivoConferir).toBe('Tipo de resposta da planilha não reconhecido: "Escala XYZ"');
    expect(p.chave).toBe('l2');
  });

  it('defaults: peso 1, obrigatório, criticidade média, categoria inferida', () => {
    const p = mapearLinhaImportada(linha(), 0);
    expect(p.configuracao).toMatchObject({
      peso: 1,
      obrigatorio: true,
      criticidade: CriticidadeItem.MEDIA,
      categoria: CategoriaItem.HIGIENE,
    });
  });
});

describe('mapearLinhaImportada — pontuação e peso', () => {
  it('linha padrão sem pontos pontua 1/0 na auditoria', () => {
    const c = mapearLinhaImportada(linha(), 0).configuracao;
    const porValor = Object.fromEntries(c.opcoes.map((o) => [o.valor, o]));
    expect(porValor['conforme'].pontuacao).toBeUndefined();
    expect(porValor['nao_conforme'].pontuacao).toBeUndefined();
    const item = configuracaoParaItem(c);
    expect(pontuar(item, 'conforme')).toBe(1);
    expect(pontuar(item, 'nao_conforme')).toBe(0);
  });

  it('opções personalizadas sem pontos seguem a sequência padrão', () => {
    const c = mapearLinhaImportada(linha({ opcoesResposta: [{ texto: 'Sim' }, { texto: 'Não' }] }), 0).configuracao;
    const item = configuracaoParaItem(c);
    expect(pontuar(item, 'Sim')).toBe(1);
    expect(pontuar(item, 'Não')).toBe(0);
  });

  it('peso não numérico vira 1 e peso fracionado é arredondado', () => {
    expect(mapearLinhaImportada(linha({ pontuacaoMaxima: NaN }), 0).configuracao.peso).toBe(1);
    expect(mapearLinhaImportada(linha({ pontuacaoMaxima: 2.6 }), 0).configuracao.peso).toBe(3);
    expect(mapearLinhaImportada(linha({ pontuacaoMaxima: -2 }), 0).configuracao.peso).toBe(1);
    expect(mapearLinhaImportada(linha({ pontuacaoMaxima: 500 }), 0).configuracao.peso).toBe(100);
  });

  it('pontos não numéricos são descartados', () => {
    const p = mapearLinhaImportada(linha({ opcoesResposta: [{ texto: 'Sim', pontos: NaN }, { texto: 'Não' }] }), 0);
    expect(p.configuracao.opcoes[0].pontuacao).toBeUndefined();
    expect(p.motivoConferir).toBeUndefined();
  });

  it('pontos fora de -10 a 10 são ajustados e marcados para conferir', () => {
    const p = mapearLinhaImportada(
      linha({ opcoesResposta: [{ texto: 'Sim', pontos: 15 }, { texto: 'Não', pontos: -20 }] }),
      0,
    );
    expect(p.configuracao.opcoes.map((o) => o.pontuacao)).toEqual([10, -10]);
    expect(p.motivoConferir).toBe('Pontuação da planilha fora do intervalo de -10 a 10 foi ajustada.');
  });

  it('opções com mais de 100 caracteres são encurtadas e marcadas para conferir', () => {
    const longa = '  ' + 'a'.repeat(120) + '  ';
    const p = mapearLinhaImportada(linha({ opcoesResposta: [{ texto: longa }, { texto: ' Não ' }] }), 0);
    expect(p.configuracao.opcoes.map((o) => o.valor)).toEqual(['a'.repeat(100), 'Não']);
    expect(p.motivoConferir).toBe('Uma resposta da planilha passou de 100 caracteres e foi encurtada.');
  });

  it('o aviso de resposta encurtada se soma a um motivo já existente', () => {
    const p = mapearLinhaImportada(
      linha({ opcoesResposta: [{ texto: 'a'.repeat(101), pontos: 15 }, { texto: 'Não' }] }),
      0,
    );
    expect(p.motivoConferir).toBe(
      'Pontuação da planilha fora do intervalo de -10 a 10 foi ajustada. Uma resposta da planilha passou de 100 caracteres e foi encurtada.',
    );
  });

  it('opção com exatamente 100 caracteres não é marcada', () => {
    const p = mapearLinhaImportada(linha({ opcoesResposta: [{ texto: 'a'.repeat(100) }, { texto: 'Não' }] }), 0);
    expect(p.configuracao.opcoes[0].valor).toHaveLength(100);
    expect(p.motivoConferir).toBeUndefined();
  });
});

describe('mapearTipoResposta', () => {
  it('reconhece texto, número e data', () => {
    expect(mapearTipoResposta('Texto', false)).toEqual({ tipo: 'texto', reconhecido: true });
    expect(mapearTipoResposta('Número', false)).toEqual({ tipo: 'numero', reconhecido: true });
    expect(mapearTipoResposta('Data', false)).toEqual({ tipo: 'data', reconhecido: true });
  });
  it('vazio → personalizada com opções, padrao sem', () => {
    expect(mapearTipoResposta(undefined, true)).toEqual({ tipo: 'personalizada', reconhecido: true });
    expect(mapearTipoResposta('', false)).toEqual({ tipo: 'padrao', reconhecido: true });
  });
});

describe('normalizarConfiguracao', () => {
  const base = (): ConfiguracaoPerguntaImportada => ({
    categoria: CategoriaItem.OUTRO,
    criticidade: CriticidadeItem.MEDIA,
    tipoResposta: 'personalizada',
    peso: 2,
    obrigatorio: true,
    permiteFoto: true,
    permiteObservacao: true,
    opcoes: [{ valor: 'A', pontuacao: 1, fotoObrigatoria: true, observacaoObrigatoria: true }],
  });

  it('texto zera peso, foto e opções sem mutar a entrada', () => {
    const entrada = { ...base(), tipoResposta: 'texto' as const };
    const r = normalizarConfiguracao(entrada);
    expect(r).toMatchObject({ peso: 0, permiteFoto: false, opcoes: [] });
    expect(entrada.peso).toBe(2);
    expect(entrada.opcoes).toHaveLength(1);
  });
  it('permiteFoto false limpa fotoObrigatoria', () => {
    const r = normalizarConfiguracao({ ...base(), permiteFoto: false });
    expect(r.opcoes[0]).toMatchObject({ fotoObrigatoria: false, observacaoObrigatoria: true });
  });
  it('permiteObservacao false limpa observacaoObrigatoria', () => {
    const r = normalizarConfiguracao({ ...base(), permiteObservacao: false });
    expect(r.opcoes[0]).toMatchObject({ fotoObrigatoria: true, observacaoObrigatoria: false });
  });
});

describe('configuracaoParaItem', () => {
  it('converte configuração personalizada em campos do item', () => {
    const c = mapearLinhaImportada(
      linha({ opcoesResposta: [{ texto: 'Sim', pontos: 2 }, { texto: 'Não' }] }),
      0,
    ).configuracao;
    const item = configuracaoParaItem(c);
    expect(item.usarRespostasPersonalizadas).toBe(true);
    expect(item.opcoesResposta).toEqual(['Sim', 'Não']);
    expect(item.opcoesRespostaConfig?.map((o) => o.valor)).toEqual(['Sim', 'Não']);
    expect(item.permiteFoto).toBe(true);
  });
  it('texto força peso 0 e sem foto', () => {
    const c = mapearLinhaImportada(linha({ tipoResposta: 'texto' }), 0).configuracao;
    const item = configuracaoParaItem(c);
    expect(item.peso).toBe(0);
    expect(item.permiteFoto).toBe(false);
  });
});

describe('ChecklistImportService.preview', () => {
  it('devolve perguntas com chave estável l0, l1…', async () => {
    const service = new ChecklistImportService(null as any, null as any, null as any);
    const cab = ['x', 'Nome', '', '', ''].join(',');
    const linhas = ['', cab, 'Arquivo,Arquivo exportado em 01/01', '', ''];
    const dados = ['G1,S1,P1', 'G1,S1,P2', 'G2,S2,P3'].map((l) => l + ',,,,,,,,,,,,,,,,,,,');
    const csv = [...linhas, ...dados].join('\n');
    const prev = await service.preview(csv);
    expect(prev.perguntas.map((p) => p.chave)).toEqual(['l0', 'l1', 'l2']);
    expect(prev.perguntas[2]).toMatchObject({ grupo: 'G2', secao: 'S2', pergunta: 'P3' });
    expect(prev.totalPerguntas).toBe(3);
  });
});
