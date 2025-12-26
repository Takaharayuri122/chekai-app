import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  accessToken: string;
  access_token?: string; // Alias para compatibilidade
  usuario: {
    id: string;
    nome: string;
    email: string;
    perfil: string;
  };
}

export interface CriarUsuarioRequest {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
}

export const authService = {
  async login(email: string, senha: string): Promise<LoginResponse> {
    const response = await api.post<{ data: LoginResponse }>('/auth/login', { email, senha });
    return response.data.data;
  },

  async registrar(data: CriarUsuarioRequest): Promise<void> {
    await api.post('/usuarios', data);
  },

  async cadastrar(data: CriarUsuarioRequest): Promise<LoginResponse> {
    // Cria o usuário
    const criarResponse = await api.post('/usuarios', data);
    
    // Verifica se a criação foi bem-sucedida
    if (criarResponse.status !== 201 && criarResponse.status !== 200) {
      throw new Error('Erro ao criar usuário');
    }
    
    // Aguarda um pouco para garantir que o usuário foi criado no banco
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    // Faz login automaticamente
    return this.login(data.email, data.senha);
  },

  async me(): Promise<{ id: string; email: string; perfil: string }> {
    const response = await api.get('/auth/me');
    return response.data.data;
  },
};

/**
 * Tipos de atividade disponíveis.
 */
export enum TipoAtividade {
  RESTAURANTE = 'restaurante',
  INDUSTRIA = 'industria',
  DISTRIBUIDORA = 'distribuidora',
  HOSPITAL = 'hospital',
  ESCOLA = 'escola',
  HOTEL = 'hotel',
  COZINHA_INDUSTRIAL = 'cozinha_industrial',
  PADARIA = 'padaria',
  OUTRO = 'outro',
}

export const TIPO_ATIVIDADE_LABELS: Record<TipoAtividade, string> = {
  [TipoAtividade.RESTAURANTE]: 'Restaurante',
  [TipoAtividade.INDUSTRIA]: 'Indústria',
  [TipoAtividade.DISTRIBUIDORA]: 'Distribuidora',
  [TipoAtividade.HOSPITAL]: 'Hospital',
  [TipoAtividade.ESCOLA]: 'Escola',
  [TipoAtividade.HOTEL]: 'Hotel',
  [TipoAtividade.COZINHA_INDUSTRIAL]: 'Cozinha Industrial',
  [TipoAtividade.PADARIA]: 'Padaria',
  [TipoAtividade.OUTRO]: 'Outro',
};

export interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  tipoAtividade: TipoAtividade;
  responsavelTecnico?: string;
  ativo: boolean;
  unidades: Unidade[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarClienteRequest {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  tipoAtividade?: TipoAtividade;
  responsavelTecnico?: string;
}

export interface Unidade {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep?: string;
  telefone?: string;
  responsavel?: string;
  ativo: boolean;
}

export interface CriarUnidadeRequest {
  nome: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  responsavel?: string;
  clienteId: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const clienteService = {
  async listar(page = 1, limit = 10): Promise<PaginatedResult<Cliente>> {
    const response = await api.get('/clientes', { params: { page, limit } });
    return response.data.data;
  },

  async buscarPorId(id: string): Promise<Cliente> {
    const response = await api.get(`/clientes/${id}`);
    return response.data.data;
  },

  async criar(data: CriarClienteRequest): Promise<Cliente> {
    const response = await api.post('/clientes', data);
    return response.data.data;
  },

  async atualizar(id: string, data: Partial<CriarClienteRequest>): Promise<Cliente> {
    const response = await api.put(`/clientes/${id}`, data);
    return response.data.data;
  },

  async remover(id: string): Promise<void> {
    await api.delete(`/clientes/${id}`);
  },

  async listarUnidades(clienteId: string): Promise<Unidade[]> {
    const response = await api.get(`/clientes/${clienteId}/unidades`);
    return response.data.data;
  },

  async criarUnidade(clienteId: string, data: Omit<CriarUnidadeRequest, 'clienteId'>): Promise<Unidade> {
    const response = await api.post(`/clientes/${clienteId}/unidades`, data);
    return response.data.data;
  },
};

export const unidadeService = {
  async listar(): Promise<Unidade[]> {
    const response = await api.get('/unidades');
    return response.data.data;
  },

  async buscarPorId(id: string): Promise<Unidade> {
    const response = await api.get(`/unidades/${id}`);
    return response.data.data;
  },

  async atualizar(id: string, data: Partial<CriarUnidadeRequest>): Promise<Unidade> {
    const response = await api.put(`/unidades/${id}`, data);
    return response.data.data;
  },

  async remover(id: string): Promise<void> {
    await api.delete(`/unidades/${id}`);
  },
};

/**
 * Categorias de itens do checklist.
 */
export enum CategoriaItem {
  ESTRUTURA = 'estrutura',
  HIGIENE = 'higiene',
  MANIPULADORES = 'manipuladores',
  DOCUMENTACAO = 'documentacao',
  ARMAZENAMENTO = 'armazenamento',
  PREPARACAO = 'preparacao',
  CONTROLE_PRAGAS = 'controle_pragas',
  EQUIPAMENTOS = 'equipamentos',
  OUTRO = 'outro',
}

export const CATEGORIA_ITEM_LABELS: Record<CategoriaItem, string> = {
  [CategoriaItem.ESTRUTURA]: 'Estrutura Física',
  [CategoriaItem.HIGIENE]: 'Higiene',
  [CategoriaItem.MANIPULADORES]: 'Manipuladores',
  [CategoriaItem.DOCUMENTACAO]: 'Documentação',
  [CategoriaItem.ARMAZENAMENTO]: 'Armazenamento',
  [CategoriaItem.PREPARACAO]: 'Preparação',
  [CategoriaItem.CONTROLE_PRAGAS]: 'Controle de Pragas',
  [CategoriaItem.EQUIPAMENTOS]: 'Equipamentos',
  [CategoriaItem.OUTRO]: 'Outro',
};

/**
 * Níveis de criticidade.
 */
export enum CriticidadeItem {
  BAIXA = 'baixa',
  MEDIA = 'media',
  ALTA = 'alta',
  CRITICA = 'critica',
}

export const CRITICIDADE_LABELS: Record<CriticidadeItem, string> = {
  [CriticidadeItem.BAIXA]: 'Baixa',
  [CriticidadeItem.MEDIA]: 'Média',
  [CriticidadeItem.ALTA]: 'Alta',
  [CriticidadeItem.CRITICA]: 'Crítica',
};

export const CRITICIDADE_COLORS: Record<CriticidadeItem, string> = {
  [CriticidadeItem.BAIXA]: 'bg-blue-100 text-blue-800',
  [CriticidadeItem.MEDIA]: 'bg-yellow-100 text-yellow-800',
  [CriticidadeItem.ALTA]: 'bg-orange-100 text-orange-800',
  [CriticidadeItem.CRITICA]: 'bg-red-100 text-red-800',
};

/**
 * Grupo de perguntas dentro de um checklist.
 */
export interface ChecklistGrupo {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
  ativo: boolean;
  templateId: string;
  itens?: TemplateItem[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface ChecklistTemplate {
  id: string;
  nome: string;
  descricao: string;
  tipoAtividade: TipoAtividade;
  versao: string;
  ativo: boolean;
  itens: TemplateItem[];
  grupos: ChecklistGrupo[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface TemplateItem {
  id: string;
  pergunta: string;
  categoria: CategoriaItem;
  criticidade: CriticidadeItem;
  peso: number;
  ordem: number;
  legislacaoReferencia?: string;
  artigo?: string;
  textoLegal?: string;
  obrigatorio: boolean;
  opcoesResposta?: string[];
  usarRespostasPersonalizadas: boolean;
  grupoId?: string;
  grupo?: ChecklistGrupo;
  secao?: string;
  ativo: boolean;
}

/**
 * Respostas padrão disponíveis para itens de auditoria.
 */
export const RESPOSTAS_PADRAO = [
  { valor: 'conforme', label: 'Conforme' },
  { valor: 'nao_conforme', label: 'Não Conforme' },
  { valor: 'nao_aplicavel', label: 'Não Aplicável' },
  { valor: 'nao_avaliado', label: 'Não Avaliado' },
];

export interface CriarTemplateItemRequest {
  pergunta: string;
  categoria?: CategoriaItem;
  criticidade?: CriticidadeItem;
  peso?: number;
  ordem?: number;
  legislacaoReferencia?: string;
  artigo?: string;
  textoLegal?: string;
  obrigatorio?: boolean;
  opcoesResposta?: string[];
  usarRespostasPersonalizadas?: boolean;
  grupoId?: string;
  secao?: string;
}

export interface CriarGrupoRequest {
  nome: string;
  descricao?: string;
  ordem?: number;
}

/**
 * Preview de importação do Moki.
 */
export interface ImportacaoPreview {
  nomeOriginal: string;
  dataExportacao: string;
  grupos: ImportacaoGrupoPreview[];
  totalPerguntas: number;
  totalGrupos: number;
}

export interface ImportacaoGrupoPreview {
  nome: string;
  secoes: string[];
  perguntas: number;
}

export interface ImportacaoResultado {
  templateId: string;
  nomeTemplate: string;
  gruposCriados: number;
  itensCriados: number;
  avisos: string[];
}

export interface ImportarMokiRequest {
  nomeTemplate: string;
  descricao?: string;
  tipoAtividade?: TipoAtividade;
  versao?: string;
}

export interface CriarTemplateRequest {
  nome: string;
  descricao?: string;
  tipoAtividade?: TipoAtividade;
  versao?: string;
  itens?: CriarTemplateItemRequest[];
}

export const checklistService = {
  async listarTemplates(page = 1, limit = 10): Promise<PaginatedResult<ChecklistTemplate>> {
    const response = await api.get('/checklists/templates', { params: { page, limit } });
    return response.data.data;
  },

  async listarTemplatesPorTipo(tipo: TipoAtividade): Promise<ChecklistTemplate[]> {
    const response = await api.get(`/checklists/templates/tipo/${tipo}`);
    return response.data.data;
  },

  async buscarTemplatePorId(id: string): Promise<ChecklistTemplate> {
    const response = await api.get(`/checklists/templates/${id}`);
    return response.data.data;
  },

  async criarTemplate(data: CriarTemplateRequest): Promise<ChecklistTemplate> {
    const response = await api.post('/checklists/templates', data);
    return response.data.data;
  },

  async atualizarTemplate(id: string, data: Partial<CriarTemplateRequest>): Promise<ChecklistTemplate> {
    const response = await api.put(`/checklists/templates/${id}`, data);
    return response.data.data;
  },

  async removerTemplate(id: string): Promise<void> {
    await api.delete(`/checklists/templates/${id}`);
  },

  async adicionarItem(templateId: string, data: CriarTemplateItemRequest): Promise<TemplateItem> {
    const response = await api.post(`/checklists/templates/${templateId}/itens`, data);
    return response.data.data;
  },

  async atualizarItem(itemId: string, data: Partial<CriarTemplateItemRequest>): Promise<TemplateItem> {
    const response = await api.put(`/checklists/itens/${itemId}`, data);
    return response.data.data;
  },

  async removerItem(itemId: string): Promise<void> {
    await api.delete(`/checklists/itens/${itemId}`);
  },

  async listarGrupos(templateId: string): Promise<ChecklistGrupo[]> {
    const response = await api.get(`/checklists/templates/${templateId}/grupos`);
    return response.data.data;
  },

  async adicionarGrupo(templateId: string, data: CriarGrupoRequest): Promise<ChecklistGrupo> {
    const response = await api.post(`/checklists/templates/${templateId}/grupos`, data);
    return response.data.data;
  },

  async atualizarGrupo(grupoId: string, data: Partial<CriarGrupoRequest>): Promise<ChecklistGrupo> {
    const response = await api.put(`/checklists/grupos/${grupoId}`, data);
    return response.data.data;
  },

  async removerGrupo(grupoId: string): Promise<void> {
    await api.delete(`/checklists/grupos/${grupoId}`);
  },

  async reordenarGrupos(templateId: string, grupoIds: string[]): Promise<void> {
    await api.put(`/checklists/templates/${templateId}/grupos/reordenar`, grupoIds);
  },

  async previewImportacaoMoki(file: File): Promise<ImportacaoPreview> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/checklists/importar/moki/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async importarMoki(file: File, data: ImportarMokiRequest): Promise<ImportacaoResultado> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nomeTemplate', data.nomeTemplate);
    if (data.descricao) formData.append('descricao', data.descricao);
    if (data.tipoAtividade) formData.append('tipoAtividade', data.tipoAtividade);
    if (data.versao) formData.append('versao', data.versao);
    const response = await api.post('/checklists/importar/moki', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },
};

export interface Auditoria {
  id: string;
  status: string;
  dataInicio: string;
  unidade: Unidade & { cliente: Cliente };
  template: ChecklistTemplate;
  pontuacaoTotal: number;
  itens: AuditoriaItem[];
}

export interface AuditoriaItem {
  id: string;
  resposta: string;
  observacao: string;
  descricaoNaoConformidade: string;
  descricaoIa: string;
  complementoDescricao: string;
  planoAcaoSugerido: string;
  referenciaLegal: string;
  templateItem: TemplateItem;
  fotos: { id: string; url: string }[];
}

export interface AnaliseChecklistResponse {
  descricaoIa: string;
  tipoNaoConformidade: string;
  gravidade: string;
  sugestoes: string[];
  referenciaLegal: string;
}

export const auditoriaService = {
  async listar(): Promise<{ items: Auditoria[] }> {
    const response = await api.get('/auditorias');
    return response.data.data;
  },

  async iniciar(unidadeId: string, templateId: string, latitude?: number, longitude?: number): Promise<Auditoria> {
    const response = await api.post('/auditorias', {
      unidadeId,
      templateId,
      latitude,
      longitude,
    });
    return response.data.data;
  },

  async buscarPorId(id: string): Promise<Auditoria> {
    const response = await api.get(`/auditorias/${id}`);
    return response.data.data;
  },

  async responderItem(
    auditoriaId: string,
    itemId: string,
    resposta: string,
    dados?: {
      observacao?: string;
      descricaoNaoConformidade?: string;
      descricaoIa?: string;
      complementoDescricao?: string;
      planoAcaoSugerido?: string;
      referenciaLegal?: string;
    }
  ): Promise<AuditoriaItem> {
    const response = await api.put(`/auditorias/${auditoriaId}/itens/${itemId}`, {
      resposta,
      ...dados,
    });
    return response.data.data;
  },

  async finalizar(id: string, observacoesGerais?: string): Promise<Auditoria> {
    const response = await api.put(`/auditorias/${id}/finalizar`, {
      observacoesGerais,
    });
    return response.data.data;
  },

  async adicionarFoto(
    auditoriaId: string,
    itemId: string,
    file: File,
    dados?: { latitude?: number; longitude?: number }
  ): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (dados?.latitude) formData.append('latitude', dados.latitude.toString());
    if (dados?.longitude) formData.append('longitude', dados.longitude.toString());
    const response = await api.post(`/auditorias/${auditoriaId}/itens/${itemId}/fotos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async removerFoto(
    auditoriaId: string,
    itemId: string,
    fotoId: string
  ): Promise<void> {
    await api.delete(`/auditorias/${auditoriaId}/itens/${itemId}/fotos/${fotoId}`);
  },
};

/**
 * Tipos de legislação disponíveis.
 */
export enum TipoLegislacao {
  RDC = 'rdc',
  PORTARIA = 'portaria',
  INSTRUCAO_NORMATIVA = 'instrucao_normativa',
  LEI = 'lei',
  DECRETO = 'decreto',
  OUTRO = 'outro',
}

export const TIPO_LEGISLACAO_LABELS: Record<TipoLegislacao, string> = {
  [TipoLegislacao.RDC]: 'RDC',
  [TipoLegislacao.PORTARIA]: 'Portaria',
  [TipoLegislacao.INSTRUCAO_NORMATIVA]: 'Instrução Normativa',
  [TipoLegislacao.LEI]: 'Lei',
  [TipoLegislacao.DECRETO]: 'Decreto',
  [TipoLegislacao.OUTRO]: 'Outro',
};

export interface LegislacaoChunk {
  id: string;
  conteudo: string;
  artigo?: string;
  inciso?: string;
  paragrafo?: string;
  ordem: number;
}

export interface Legislacao {
  id: string;
  tipo: TipoLegislacao;
  numero: string;
  ano: number;
  titulo: string;
  ementa?: string;
  orgaoEmissor?: string;
  linkOficial?: string;
  ativo: boolean;
  chunks?: LegislacaoChunk[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarLegislacaoRequest {
  tipo: TipoLegislacao;
  numero: string;
  ano: number;
  titulo: string;
  ementa?: string;
  orgaoEmissor?: string;
  linkOficial?: string;
}

export interface CriarChunkRequest {
  conteudo: string;
  artigo?: string;
  inciso?: string;
  paragrafo?: string;
}

export const legislacaoService = {
  async listar(): Promise<Legislacao[]> {
    const response = await api.get('/legislacoes');
    return response.data.data;
  },

  async buscarPorId(id: string): Promise<Legislacao> {
    const response = await api.get(`/legislacoes/${id}`);
    return response.data.data;
  },

  async criar(data: CriarLegislacaoRequest): Promise<Legislacao> {
    const response = await api.post('/legislacoes', data);
    return response.data.data;
  },

  async atualizar(id: string, data: Partial<CriarLegislacaoRequest>): Promise<Legislacao> {
    const response = await api.put(`/legislacoes/${id}`, data);
    return response.data.data;
  },

  async remover(id: string): Promise<void> {
    await api.delete(`/legislacoes/${id}`);
  },

  async listarChunks(legislacaoId: string): Promise<LegislacaoChunk[]> {
    const response = await api.get(`/legislacoes/${legislacaoId}/chunks`);
    return response.data.data;
  },

  async adicionarChunks(legislacaoId: string, chunks: CriarChunkRequest[]): Promise<void> {
    await api.post(`/legislacoes/${legislacaoId}/chunks`, { chunks });
  },

  async removerChunk(chunkId: string): Promise<void> {
    await api.delete(`/legislacoes/chunks/${chunkId}`);
  },

  async buscarRag(query: string, limite = 5): Promise<{ chunks: Array<{ conteudo: string; referencia: string; similaridade: number }> }> {
    const response = await api.post('/legislacoes/rag/buscar', { query }, { params: { limite } });
    return response.data.data;
  },
};

export interface AnaliseImagemResponse {
  tipoNaoConformidade: string;
  descricao: string;
  gravidade: string;
  sugestoes: string[];
}

export interface GeracaoTextoResponse {
  descricaoTecnica: string;
  referenciaLegal: string;
  riscoEnvolvido: string;
  planoAcao: {
    acoesCorretivas: string[];
    acoesPreventivas: string[];
    prazoSugerido: string;
    responsavelSugerido: string;
  };
}

export const iaService = {
  /**
   * Analisa uma imagem via upload de arquivo.
   * @param file Arquivo de imagem (File object)
   * @param contexto Contexto da área fotografada
   */
  async analisarImagem(file: File, contexto?: string): Promise<AnaliseImagemResponse> {
    const formData = new FormData();
    formData.append('imagem', file);
    if (contexto) {
      formData.append('contexto', contexto);
    }
    const response = await api.post('/ia/analisar-imagem', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  /**
   * Analisa uma imagem no contexto de um item de checklist.
   * @param file Arquivo de imagem
   * @param perguntaChecklist Pergunta do item do checklist
   * @param categoria Categoria do item
   * @param tipoEstabelecimento Tipo do estabelecimento
   */
  async analisarImagemChecklist(
    file: File,
    perguntaChecklist: string,
    categoria?: string,
    tipoEstabelecimento?: string,
  ): Promise<AnaliseChecklistResponse> {
    const formData = new FormData();
    formData.append('imagem', file);
    formData.append('perguntaChecklist', perguntaChecklist);
    if (categoria) {
      formData.append('categoria', categoria);
    }
    if (tipoEstabelecimento) {
      formData.append('tipoEstabelecimento', tipoEstabelecimento);
    }
    const response = await api.post('/ia/analisar-checklist', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async gerarTexto(descricao: string, tipoEstabelecimento?: string): Promise<GeracaoTextoResponse> {
    const response = await api.post('/ia/gerar-texto', {
      descricao,
      tipoEstabelecimento,
    });
    return response.data.data;
  },
};

