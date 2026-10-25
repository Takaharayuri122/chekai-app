import { describe, expect, it } from 'vitest';
import { montarAtualizacao, paraFormulario, type FormularioLegislacao } from './formulario';
import type { Legislacao } from '@/lib/api';

const base: FormularioLegislacao = {
  tipo: 'rdc' as FormularioLegislacao['tipo'],
  numero: ' 216 ',
  ano: '2004',
  orgaoEmissor: 'ANVISA',
  dataPublicacao: '2004-09-16',
  situacao: 'vigente',
  ementa: 'E',
  titulo: ' Boas práticas ',
  informacoes: '',
  linkOficial: 'https://x.gov.br/a',
};

describe('montarAtualizacao', () => {
  it('envia os campos aparados e não envia o link sem mudança', () => {
    const corpo = montarAtualizacao(base, 'https://x.gov.br/a');
    expect(corpo).toEqual({
      tipo: 'rdc',
      numero: '216',
      ano: 2004,
      orgaoEmissor: 'ANVISA',
      dataPublicacao: '2004-09-16',
      situacao: 'vigente',
      ementa: 'E',
      titulo: 'Boas práticas',
      informacoes: '',
    });
    expect(corpo).not.toHaveProperty('linkOficial');
  });

  it('"Não informada" e vazios em situação, data e ano viram null', () => {
    const corpo = montarAtualizacao({ ...base, situacao: '', dataPublicacao: '', ano: '' }, base.linkOficial);
    expect(corpo.situacao).toBeNull();
    expect(corpo.dataPublicacao).toBeNull();
    expect(corpo.ano).toBeNull();
  });

  it('envia o link quando mudou', () => {
    expect(montarAtualizacao({ ...base, linkOficial: ' https://x.gov.br/b ' }, base.linkOficial).linkOficial).toBe(
      'https://x.gov.br/b',
    );
  });

  it('legislação sem link salva sem enviar link; apagar o link envia null', () => {
    expect(montarAtualizacao({ ...base, linkOficial: '' }, null)).not.toHaveProperty('linkOficial');
    expect(montarAtualizacao({ ...base, linkOficial: '  ' }, base.linkOficial).linkOficial).toBeNull();
  });
});

describe('paraFormulario', () => {
  it('usa vazio para valores ausentes', () => {
    const form = paraFormulario({
      tipo: 'outro',
      numero: null,
      ano: null,
      titulo: 'T',
      situacao: null,
      dataPublicacao: null,
    } as unknown as Legislacao);
    expect(form).toMatchObject({ numero: '', ano: '', situacao: '', dataPublicacao: '', linkOficial: '' });
  });
});
