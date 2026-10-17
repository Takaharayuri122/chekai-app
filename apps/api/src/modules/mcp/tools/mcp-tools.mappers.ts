const CAMPOS_HTML_RELATORIO = [
  'identificacao',
  'descricaoOcorrenciaHtml',
  'avaliacaoTecnicaHtml',
  'recomendacoesConsultoraHtml',
  'planoAcaoSugeridoHtml',
] as const;

export function instante(valor: Date | string | null | undefined): string | null {
  if (valor == null || valor === '') return null;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const data = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

function numeroOuNulo(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function mapearUsuario(usuario: {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
  };
}

export function mapearCliente(cliente: {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  email?: string | null;
  telefone?: string | null;
  tipoAtividade: string;
  ativo: boolean;
}) {
  return {
    id: cliente.id,
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia ?? null,
    cnpj: cliente.cnpj,
    email: cliente.email ?? null,
    telefone: cliente.telefone ?? null,
    tipoAtividade: cliente.tipoAtividade,
    ativo: cliente.ativo,
  };
}

export function mapearUnidade(unidade: {
  id: string;
  nome: string;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  clienteId: string;
  ativo: boolean;
}) {
  return {
    id: unidade.id,
    nome: unidade.nome,
    endereco: unidade.endereco ?? null,
    cidade: unidade.cidade ?? null,
    estado: unidade.estado ?? null,
    clienteId: unidade.clienteId,
    ativo: unidade.ativo,
  };
}

export function mapearChecklist(
  template: {
    id: string;
    nome: string;
    descricao?: string | null;
    tipoAtividade: string;
    versao: string;
    status: string;
    grupos?: Array<{ id: string; nome: string; ordem: number }>;
    itens?: Array<{
      id: string;
      pergunta: string;
      ordem: number;
      obrigatorio: boolean;
      grupoId?: string | null;
      opcoesResposta?: string[] | null;
    }>;
  },
  detalhe: boolean,
) {
  const resumo = {
    id: template.id,
    nome: template.nome,
    descricao: template.descricao ?? null,
    tipoAtividade: template.tipoAtividade,
    versao: template.versao,
    status: template.status,
  };
  if (!detalhe) return resumo;
  return {
    ...resumo,
    grupos: (template.grupos ?? []).map((grupo) => ({
      id: grupo.id,
      nome: grupo.nome,
      ordem: grupo.ordem,
    })),
    itens: (template.itens ?? []).map((item) => ({
      id: item.id,
      pergunta: item.pergunta,
      ordem: item.ordem,
      obrigatorio: item.obrigatorio,
      grupoId: item.grupoId ?? null,
      opcoesResposta: item.opcoesResposta ?? [],
    })),
  };
}

function mapearItemAuditoria(item: {
  id: string;
  templateItemId?: string | null;
  resposta?: string | null;
  observacao?: string | null;
  pontuacao?: number | string | null;
}) {
  return {
    id: item.id,
    templateItemId: item.templateItemId ?? null,
    resposta: item.resposta ?? null,
    observacao: item.observacao ?? null,
    pontuacao: numeroOuNulo(item.pontuacao),
  };
}

export function mapearAuditoria(
  auditoria: {
    id: string;
    status: string;
    unidadeId: string;
    templateId: string;
    consultorId: string;
    dataInicio?: Date | string | null;
    dataFim?: Date | string | null;
    pontuacaoTotal?: number | string | null;
    observacoesGerais?: string | null;
    itens?: Array<{
      id: string;
      templateItemId?: string | null;
      resposta?: string | null;
      observacao?: string | null;
      pontuacao?: number | string | null;
    }>;
  },
  detalhe: boolean,
) {
  const resumo = {
    id: auditoria.id,
    status: auditoria.status,
    unidadeId: auditoria.unidadeId,
    templateId: auditoria.templateId,
    consultorId: auditoria.consultorId,
    dataInicio: instante(auditoria.dataInicio),
    dataFim: instante(auditoria.dataFim),
    pontuacaoTotal: numeroOuNulo(auditoria.pontuacaoTotal),
  };
  if (!detalhe) return resumo;
  return {
    ...resumo,
    observacoesGerais: auditoria.observacoesGerais ?? null,
    itens: (auditoria.itens ?? []).map(mapearItemAuditoria),
  };
}

export function mapearItemRespondido(item: {
  id: string;
  templateItemId?: string | null;
  resposta?: string | null;
  observacao?: string | null;
  pontuacao?: number | string | null;
}) {
  return mapearItemAuditoria(item);
}

export function resumirFinalizacaoAuditoria(auditoria: {
  id: string;
  status: string;
  itens?: Array<{
    id: string;
    resposta?: string | null;
    templateItem?: { obrigatorio?: boolean } | null;
  }>;
}) {
  const itensPendentes = (auditoria.itens ?? [])
    .filter((item) => {
      const obrigatorio = item.templateItem?.obrigatorio === true;
      if (!obrigatorio) return false;
      return !item.resposta || item.resposta === 'nao_avaliado';
    })
    .map((item) => item.id);
  return {
    auditoriaId: auditoria.id,
    status: auditoria.status,
    obrigatoriosPendentes: itensPendentes.length,
    itensPendentes,
    prontaParaFinalizar: itensPendentes.length === 0,
  };
}

export function mapearAgenda(agenda: {
  id: string;
  unidadeId: string;
  templateId: string;
  responsavelId?: string | null;
  dataPrevista: string;
  recorrencia: string;
  status: string;
  observacao?: string | null;
  realizadaEm?: Date | string | null;
}) {
  return {
    id: agenda.id,
    unidadeId: agenda.unidadeId,
    templateId: agenda.templateId,
    responsavelId: agenda.responsavelId ?? null,
    dataPrevista: instante(agenda.dataPrevista),
    recorrencia: agenda.recorrencia,
    status: agenda.status,
    observacao: agenda.observacao ?? null,
    realizadaEm: instante(agenda.realizadaEm),
  };
}

export function mapearTarefa(tarefa: {
  id: string;
  titulo: string;
  descricao?: string | null;
  responsavelId?: string | null;
  auditoriaId?: string | null;
  prazo: string;
  status: string;
  concluidaEm?: Date | string | null;
}) {
  return {
    id: tarefa.id,
    titulo: tarefa.titulo,
    descricao: tarefa.descricao ?? null,
    responsavelId: tarefa.responsavelId ?? null,
    auditoriaId: tarefa.auditoriaId ?? null,
    prazo: instante(tarefa.prazo) ?? tarefa.prazo,
    status: tarefa.status,
    concluidaEm: instante(tarefa.concluidaEm),
  };
}

function textoVazio(valor: unknown): boolean {
  return typeof valor !== 'string' || valor.trim() === '';
}

export function mapearRelatorio(
  relatorio: {
    id: string;
    clienteId: string;
    unidadeId?: string | null;
    consultoraId: string;
    status: string;
    identificacao?: string | null;
    descricaoOcorrenciaHtml?: string | null;
    avaliacaoTecnicaHtml?: string | null;
    acoesExecutadas?: string[] | null;
    recomendacoesConsultoraHtml?: string | null;
    planoAcaoSugeridoHtml?: string | null;
    assinaturaNomeConsultora?: string | null;
    responsavel?: string | null;
  },
  detalhe: boolean,
) {
  const resumo = {
    id: relatorio.id,
    clienteId: relatorio.clienteId,
    unidadeId: relatorio.unidadeId ?? null,
    consultoraId: relatorio.consultoraId,
    status: relatorio.status,
    identificacao: relatorio.identificacao ?? null,
  };
  if (!detalhe) return resumo;
  return {
    ...resumo,
    descricaoOcorrenciaHtml: relatorio.descricaoOcorrenciaHtml ?? null,
    avaliacaoTecnicaHtml: relatorio.avaliacaoTecnicaHtml ?? null,
    acoesExecutadas: relatorio.acoesExecutadas ?? [],
    recomendacoesConsultoraHtml: relatorio.recomendacoesConsultoraHtml ?? null,
    planoAcaoSugeridoHtml: relatorio.planoAcaoSugeridoHtml ?? null,
    assinaturaNomeConsultora: relatorio.assinaturaNomeConsultora ?? null,
    responsavel: relatorio.responsavel ?? null,
  };
}

export function resumirFinalizacaoRelatorio(relatorio: {
  id: string;
  status: string;
  identificacao?: string | null;
  descricaoOcorrenciaHtml?: string | null;
  avaliacaoTecnicaHtml?: string | null;
  recomendacoesConsultoraHtml?: string | null;
  planoAcaoSugeridoHtml?: string | null;
  acoesExecutadas?: string[] | null;
}) {
  const camposHtmlVazios = CAMPOS_HTML_RELATORIO.filter((campo) => textoVazio(relatorio[campo]));
  const possuiAcaoExecutada = Array.isArray(relatorio.acoesExecutadas)
    && relatorio.acoesExecutadas.length > 0;
  return {
    relatorioId: relatorio.id,
    status: relatorio.status,
    camposHtmlVazios,
    possuiAcaoExecutada,
    prontaParaFinalizar: camposHtmlVazios.length === 0 && possuiAcaoExecutada,
  };
}

export function paginar<T>(items: T[], page: number, limit: number) {
  const inicio = (page - 1) * limit;
  const totalPages = limit > 0 ? Math.ceil(items.length / limit) : 0;
  return {
    items: items.slice(inicio, inicio + limit),
    total: items.length,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function mapearPagina<T, R>(
  pagina: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  },
  mapear: (item: T) => R,
) {
  return {
    items: pagina.items.map(mapear),
    total: pagina.total,
    page: pagina.page,
    limit: pagina.limit,
    totalPages: pagina.totalPages,
    hasNext: pagina.hasNext,
    hasPrevious: pagina.hasPrevious,
  };
}
