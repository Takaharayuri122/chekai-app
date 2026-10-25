import type {
  AtualizarLegislacaoRequest,
  Legislacao,
  SituacaoLegislacao,
  TipoLegislacao,
} from '@/lib/api';

export interface FormularioLegislacao {
  tipo: TipoLegislacao;
  numero: string;
  ano: string;
  orgaoEmissor: string;
  dataPublicacao: string;
  situacao: SituacaoLegislacao | '';
  ementa: string;
  titulo: string;
  informacoes: string;
  linkOficial: string;
}

export function paraFormulario(l: Legislacao): FormularioLegislacao {
  return {
    tipo: l.tipo,
    numero: l.numero ?? '',
    ano: l.ano ? String(l.ano) : '',
    orgaoEmissor: l.orgaoEmissor ?? '',
    dataPublicacao: l.dataPublicacao ? l.dataPublicacao.slice(0, 10) : '',
    situacao: l.situacao ?? '',
    ementa: l.ementa ?? '',
    titulo: l.titulo,
    informacoes: l.informacoes ?? '',
    linkOficial: l.linkOficial ?? '',
  };
}

/**
 * Corpo do PUT a partir do formulário. "Não informada"/vazio em situação, data e ano viram null
 * (limpa o valor); o link só vai quando mudou (vazio tira o link).
 */
export function montarAtualizacao(
  form: FormularioLegislacao,
  linkAtual: string | null | undefined,
): AtualizarLegislacaoRequest {
  const ano = parseInt(form.ano, 10);
  const link = form.linkOficial.trim();
  return {
    tipo: form.tipo,
    numero: form.numero.trim(),
    ano: Number.isNaN(ano) ? null : ano,
    orgaoEmissor: form.orgaoEmissor.trim(),
    dataPublicacao: form.dataPublicacao || null,
    situacao: form.situacao || null,
    ementa: form.ementa.trim(),
    titulo: form.titulo.trim(),
    informacoes: form.informacoes.trim(),
    ...(link !== (linkAtual ?? '').trim() ? { linkOficial: link || null } : {}),
  };
}
