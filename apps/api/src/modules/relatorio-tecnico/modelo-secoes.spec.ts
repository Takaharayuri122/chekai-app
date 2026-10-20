import {
  ModeloSecao,
  mesclarComPadrao,
  modeloPadrao,
  secaoAtiva,
  tituloSecao,
  validarModelo,
} from './modelo-secoes';

describe('modelo-secoes', () => {
  it('modeloPadrao devolve as 7 seções na ordem fixa, ativas e com títulos padrão', () => {
    expect(modeloPadrao()).toEqual([
      { secao: 'descricaoOcorrencia', ativa: true, titulo: 'Descrição da Ocorrência' },
      { secao: 'evidenciasFotograficas', ativa: true, titulo: 'Evidências Fotográficas' },
      { secao: 'avaliacaoTecnica', ativa: true, titulo: 'Avaliação Técnica' },
      { secao: 'acoesExecutadas', ativa: true, titulo: 'Ações Executadas na Visita' },
      { secao: 'recomendacoesConsultora', ativa: true, titulo: 'Recomendações da Consultora' },
      { secao: 'planoAcaoSugerido', ativa: true, titulo: 'Plano de Ação Sugerido' },
      { secao: 'apoioAnalitico', ativa: true, titulo: 'Apoio Analítico ChekAi' },
    ]);
  });

  it('mesclarComPadrao sem salvas é igual ao padrão', () => {
    expect(mesclarComPadrao(null)).toEqual(modeloPadrao());
    expect(mesclarComPadrao(undefined)).toEqual(modeloPadrao());
  });

  it('mesclarComPadrao aplica o salvo, preenche título vazio com o padrão e ignora chaves desconhecidas', () => {
    const mesclado = mesclarComPadrao([
      { secao: 'avaliacaoTecnica', ativa: false, titulo: '' },
      { secao: 'xpto', ativa: false, titulo: 'X' } as unknown as ModeloSecao,
      { secao: 'recomendacoesConsultora', ativa: true, titulo: '  Retorno do Cliente  ' },
    ]);
    expect(mesclado).toHaveLength(7);
    expect(mesclado[2]).toEqual({ secao: 'avaliacaoTecnica', ativa: false, titulo: 'Avaliação Técnica' });
    expect(mesclado[4]).toEqual({ secao: 'recomendacoesConsultora', ativa: true, titulo: 'Retorno do Cliente' });
    expect(mesclado.map((s) => s.secao)).not.toContain('xpto');
  });

  it('validarModelo aceita o padrão', () => {
    expect(validarModelo(modeloPadrao())).toBeNull();
  });

  it('validarModelo exige ao menos uma seção de conteúdo ativa', () => {
    const modelo = modeloPadrao().map((s) =>
      s.secao === 'evidenciasFotograficas' || s.secao === 'apoioAnalitico' ? s : { ...s, ativa: false },
    );
    expect(validarModelo(modelo)).toMatch(/ao menos uma seção/i);
  });

  it('validarModelo rejeita título com mais de 60 caracteres', () => {
    const modelo = modeloPadrao();
    modelo[0] = { ...modelo[0], titulo: 'a'.repeat(61) };
    expect(validarModelo(modelo)).toMatch(/60 caracteres/);
  });

  it('validarModelo rejeita título com HTML', () => {
    const modelo = modeloPadrao();
    modelo[0] = { ...modelo[0], titulo: '<b>Oi</b>' };
    expect(validarModelo(modelo)).not.toBeNull();
  });

  it('validarModelo rejeita seção duplicada', () => {
    const modelo = [...modeloPadrao(), { secao: 'avaliacaoTecnica', ativa: true, titulo: 'X' }];
    expect(validarModelo(modelo)).toMatch(/duplicada/i);
  });

  it('validarModelo rejeita seção desconhecida', () => {
    expect(validarModelo([...modeloPadrao(), { secao: 'xpto', ativa: true, titulo: 'X' }])).toMatch(
      /desconhecida/i,
    );
  });

  it('validarModelo rejeita entrada que não é array', () => {
    expect(validarModelo({})).not.toBeNull();
    expect(validarModelo(null)).not.toBeNull();
  });

  it('secaoAtiva e tituloSecao leem o modelo com trim', () => {
    const modelo = mesclarComPadrao([
      { secao: 'recomendacoesConsultora', ativa: true, titulo: '  Retorno do Cliente  ' },
      { secao: 'avaliacaoTecnica', ativa: false, titulo: '' },
    ]);
    expect(tituloSecao(modelo, 'recomendacoesConsultora')).toBe('Retorno do Cliente');
    expect(secaoAtiva(modelo, 'avaliacaoTecnica')).toBe(false);
    expect(secaoAtiva(modelo, 'descricaoOcorrencia')).toBe(true);
  });
});
