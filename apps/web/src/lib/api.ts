import axios, { AxiosError } from 'axios';
import { toastService } from './toast';

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
  (error: AxiosError<{ message?: string | string[]; statusCode?: number; error?: string }>) => {
    // Extrair mensagem de erro do backend
    let errorMessage: string | null = null;
    
    if (error.response?.data) {
      const data = error.response.data;
      
      // Debug: log temporário para verificar estrutura do erro
      if (process.env.NODE_ENV === 'development') {
        console.log('Erro da API:', {
          status: error.response.status,
          data: data,
          message: data.message,
          error: data.error,
        });
      }
      
      // Tentar extrair mensagem de diferentes formatos
      if (data.message) {
        // Se a mensagem for um array, juntar todas com vírgula ou pegar a primeira
        if (Array.isArray(data.message)) {
          errorMessage = data.message.length > 0 
            ? (data.message.length === 1 ? data.message[0] : data.message.join(', '))
            : null;
        } else if (typeof data.message === 'string') {
          errorMessage = data.message;
        }
      } else if (data.error) {
        // Alguns erros do NestJS retornam 'error' ao invés de 'message'
        if (typeof data.error === 'string') {
          errorMessage = data.error;
        } else {
          const errorArray = data.error as unknown;
          if (Array.isArray(errorArray) && errorArray.length > 0) {
            errorMessage = errorArray.length === 1 ? String(errorArray[0]) : errorArray.join(', ');
          }
        }
      } else if (typeof data === 'string') {
        // Se o data for uma string diretamente
        errorMessage = data;
      }
    } else if (error.message) {
      // Se não houver resposta do servidor, pode ser erro de rede
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = 'Tempo de conexão expirado. Tente novamente.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Erro de conexão. Verifique sua internet.';
      } else {
        errorMessage = error.message;
      }
    }

    // Tratar erros 401 de forma especial
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || '';
      const isAuthRequest = requestUrl.includes('/auth/login') 
        || requestUrl.includes('/auth/cadastro')
        || requestUrl.includes('/auth/solicitar-otp')
        || requestUrl.includes('/auth/validar-otp');
      
      if (isAuthRequest) {
        // Para erros de autenticação, exibir toast e não redirecionar
        if (typeof window !== 'undefined') {
          if (errorMessage) {
            toastService.error(errorMessage);
          } else {
            toastService.error('Erro na autenticação. Verifique suas credenciais.');
          }
        }
        return Promise.reject(error);
      } else {
        // Para outros erros 401, verificar se é realmente um problema de autenticação
        // antes de remover o token e redirecionar
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          const isPublicPage = pathname === '/login' || pathname === '/cadastro' || pathname === '/';
          
          if (!isPublicPage) {
            localStorage.removeItem('token');
            // Importar dinamicamente para evitar dependência circular
            import('./store').then(({ useAuthStore }) => {
              useAuthStore.getState().logout();
            });
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    }

    // Exibir toast de erro para outros status codes
    if (typeof window !== 'undefined') {
      // Se conseguimos extrair uma mensagem, usar ela
      if (errorMessage) {
        toastService.error(errorMessage);
      } else {
        // Se não conseguimos extrair a mensagem, exibir uma genérica baseada no status
        const statusMessages: Record<number, string> = {
          400: 'Dados inválidos. Verifique os campos preenchidos.',
          403: 'Acesso negado.',
          404: 'Recurso não encontrado.',
          500: 'Erro interno do servidor. Tente novamente mais tarde.',
        };
        const statusMessage = statusMessages[error.response?.status || 0] || 'Ocorreu um erro inesperado';
        toastService.error(statusMessage);
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
    perfil: PerfilUsuario;
    gestorId?: string;
    tenantId?: string;
  };
}

export enum PerfilUsuario {
  MASTER = 'master',
  GESTOR = 'gestor',
  AUDITOR = 'auditor',
}

export interface CriarUsuarioRequest {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  perfil?: PerfilUsuario;
  gestorId?: string;
}

export const authService = {
  async solicitarOtp(email: string): Promise<{ message: string }> {
    const response = await api.post<{ data: { message: string } }>('/auth/solicitar-otp', { email });
    return response.data.data;
  },

  async validarOtp(email: string, codigo: string): Promise<LoginResponse> {
    const response = await api.post<{ data: LoginResponse }>('/auth/validar-otp', { email, codigo });
    return response.data.data;
  },

  async login(email: string, senha: string): Promise<LoginResponse> {
    const response = await api.post<{ data: LoginResponse }>('/auth/login', { email, senha });
    return response.data.data;
  },

  async registrar(data: CriarUsuarioRequest): Promise<void> {
    await api.post('/usuarios', data);
  },

  async cadastrar(data: { nome: string; email: string; telefone?: string; planoId: string }): Promise<{ message: string }> {
    // Usa o endpoint público de cadastro que cria automaticamente como GESTOR
    // Não retorna token, apenas mensagem de sucesso
    const response = await api.post<{ data: { message: string } }>('/auth/cadastro', {
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      planoId: data.planoId,
    });
    return response.data.data;
  },

  async me(): Promise<{ id: string; email: string; perfil: string }> {
    const response = await api.get('/auth/me');
    return response.data.data;
  },
};

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  telefone?: string;
  ativo: boolean;
  gestorId?: string;
  tenantId?: string;
  logoUrl?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const usuarioService = {
  async listar(page = 1, limit = 10, perfil?: PerfilUsuario): Promise<PaginatedResult<Usuario>> {
    const params: { page: number; limit: number; perfil?: PerfilUsuario } = { page, limit };
    if (perfil) {
      params.perfil = perfil;
    }
    const response = await api.get('/usuarios', { params });
    return response.data.data;
  },

  async buscarPorId(id: string): Promise<Usuario> {
    const response = await api.get(`/usuarios/${id}`);
    return response.data.data;
  },

  async criar(data: CriarUsuarioRequest): Promise<Usuario> {
    const response = await api.post('/usuarios', data);
    return response.data.data;
  },

  async atualizar(id: string, data: Partial<CriarUsuarioRequest>): Promise<Usuario> {
    const response = await api.put(`/usuarios/${id}`, data);
    return response.data.data;
  },

  async uploadLogo(id: string, file: File): Promise<Usuario> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.put(`/usuarios/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async removerLogo(id: string): Promise<Usuario> {
    const response = await api.delete(`/usuarios/${id}/logo`);
    return response.data.data;
  },

  async remover(id: string): Promise<void> {
    await api.delete(`/usuarios/${id}`);
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
  logoUrl?: string | null;
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

  async uploadLogo(id: string, file: File): Promise<Cliente> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.put(`/clientes/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async removerLogo(id: string): Promise<Cliente> {
    const response = await api.delete(`/clientes/${id}/logo`);
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
  opcoesRespostaConfig?: OpcaoRespostaConfig[];
  usarRespostasPersonalizadas: boolean;
  tipoRespostaCustomizada?: TipoRespostaCustomizada;
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

export enum TipoRespostaCustomizada {
  TEXTO = 'texto',
  NUMERO = 'numero',
  DATA = 'data',
  SELECT = 'select',
}

export const TIPO_RESPOSTA_LABELS: Record<TipoRespostaCustomizada, string> = {
  [TipoRespostaCustomizada.TEXTO]: 'Texto',
  [TipoRespostaCustomizada.NUMERO]: 'Número',
  [TipoRespostaCustomizada.DATA]: 'Data',
  [TipoRespostaCustomizada.SELECT]: 'Seleção',
};

export interface OpcaoRespostaConfig {
  valor: string;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
  pontuacao?: number | null;
}

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
  tipoRespostaCustomizada?: TipoRespostaCustomizada;
  grupoId?: string;
  secao?: string;
  opcoesRespostaConfig?: OpcaoRespostaConfig[];
}

export interface CriarGrupoRequest {
  nome: string;
  descricao?: string;
  ordem?: number;
}

/**
 * Preview de importação de checklist.
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

export interface ImportarChecklistRequest {
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

  async alterarStatusTemplate(id: string, ativo: boolean): Promise<ChecklistTemplate> {
    const response = await api.put(`/checklists/templates/${id}/status`, { ativo });
    return response.data.data;
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

  async previewImportacao(file: File): Promise<ImportacaoPreview> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/checklists/importar/checklist/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async importarChecklist(file: File, data: ImportarChecklistRequest): Promise<ImportacaoResultado> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nomeTemplate', data.nomeTemplate);
    if (data.descricao) formData.append('descricao', data.descricao);
    if (data.tipoAtividade) formData.append('tipoAtividade', data.tipoAtividade);
    if (data.versao) formData.append('versao', data.versao);
    const response = await api.post('/checklists/importar/checklist', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },
};

export interface Auditoria {
  id: string;
  status: string;
  dataInicio: string;
  dataFim?: string;
  unidade: Unidade & { cliente: Cliente };
  template: ChecklistTemplate;
  consultor?: { id: string; nome: string; email: string };
  pontuacaoTotal: number;
  itens: AuditoriaItem[];
  resumoExecutivo?: {
    resumo: string;
    pontosFortes: string[];
    pontosFracos: string[];
    recomendacoesPrioritarias: string[];
    riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
    tendencias: string[];
  } | null;
  resumoExecutivoGeradoEm?: string | null;
  atualizadoEm?: string;
}

export interface AuditoriaHistoricoItem {
  id: string;
  dataFim?: string;
  dataInicio?: string;
  pontuacaoTotal: number | string;
  template?: { nome?: string };
}

export interface AuditoriaItem {
  pontuacao?: number;
  id: string;
  resposta: string;
  observacao: string;
  descricaoNaoConformidade: string;
  descricaoIa: string;
  complementoDescricao: string;
  planoAcaoSugerido: string;
  referenciaLegal: string;
  templateItem: TemplateItem;
  fotos: { id: string; url: string; analiseIa?: string; exif?: Record<string, unknown> | null }[];
}

export interface AnaliseChecklistResponse {
  descricaoIa: string;
  tipoNaoConformidade: string;
  gravidade: string;
  sugestoes: string[];
  referenciaLegal: string;
  imagemRelevante: boolean;
}

export const auditoriaService = {
  async listar(page = 1, limit = 100): Promise<{ items: Auditoria[] }> {
    const response = await api.get('/auditorias', { params: { page, limit } });
    return response.data.data;
  },

  async listarHistoricoUnidade(unidadeId: string): Promise<AuditoriaHistoricoItem[]> {
    const response = await api.get(`/auditorias/historico-unidade/${unidadeId}`);
    const raw = response.data?.data ?? response.data;
    return Array.isArray(raw) ? raw : [];
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

  async reabrir(id: string): Promise<Auditoria> {
    const response = await api.put(`/auditorias/${id}/reabrir`);
    return response.data.data;
  },

  async remover(id: string): Promise<void> {
    await api.delete(`/auditorias/${id}`);
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

  async atualizarAnaliseFoto(
    auditoriaId: string,
    itemId: string,
    fotoId: string,
    analiseIa: string
  ): Promise<void> {
    await api.put(`/auditorias/${auditoriaId}/itens/${itemId}/fotos/${fotoId}/analise`, {
      analiseIa,
    });
  },

  async gerarResumoExecutivo(id: string): Promise<{
    resumo: string;
    pontosFortes: string[];
    pontosFracos: string[];
    recomendacoesPrioritarias: string[];
    riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
    tendencias: string[];
  }> {
    const response = await api.get(`/auditorias/${id}/resumo-executivo`);
    return response.data.data;
  },

  async baixarPdf(id: string): Promise<void> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/auditorias/${id}/pdf`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao baixar PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-auditoria-${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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

/**
 * Tipos e interfaces para planos.
 */
export interface Plano {
  id: string;
  nome: string;
  descricao?: string;
  limiteUsuarios: number;
  limiteAuditorias: number;
  limiteClientes: number;
  limiteCreditos: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarPlanoRequest {
  nome: string;
  descricao?: string;
  limiteUsuarios: number;
  limiteAuditorias: number;
  limiteClientes: number;
  limiteCreditos: number;
  ativo?: boolean;
}

export interface Assinatura {
  id: string;
  gestorId: string;
  planoId: string;
  status: 'ativa' | 'cancelada' | 'expirada';
  dataInicio: string;
  dataFim?: string;
  plano: Plano;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarAssinaturaRequest {
  gestorId: string;
  planoId: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface LimitesGestor {
  plano: {
    nome: string;
    limiteUsuarios: number;
    limiteAuditorias: number;
    limiteClientes: number;
    limiteCreditos: number;
  };
  uso: {
    usuarios: number;
    auditorias: number;
    clientes: number;
    creditos: number;
  };
}

export interface SaldoCreditos {
  limite: number;
  usado: number;
  disponivel: number;
}

export interface UsoCredito {
  id: string;
  gestorId: string;
  usuarioId: string;
  provedor: 'openai' | 'deepseek';
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  creditosConsumidos: number;
  metodoChamado: string;
  contexto?: string;
  criadoEm: string;
  gestor?: {
    id: string;
    nome: string;
    email: string;
  };
  usuario?: {
    id: string;
    nome: string;
    email: string;
  };
}

export const planoService = {
  async listarPublicos(): Promise<Plano[]> {
    const response = await api.get('/planos/publicos');
    return response.data.data;
  },

  async listar(page = 1, limit = 10): Promise<PaginatedResult<Plano>> {
    const response = await api.get('/planos', { params: { page, limit } });
    return response.data.data;
  },

  async buscarPorId(id: string): Promise<Plano> {
    const response = await api.get(`/planos/${id}`);
    return response.data.data;
  },

  async criar(data: CriarPlanoRequest): Promise<Plano> {
    const response = await api.post('/planos', data);
    return response.data.data;
  },

  async atualizar(id: string, data: Partial<CriarPlanoRequest>): Promise<Plano> {
    const response = await api.put(`/planos/${id}`, data);
    return response.data.data;
  },

  async remover(id: string): Promise<void> {
    await api.delete(`/planos/${id}`);
  },

  async criarAssinatura(planoId: string, data: CriarAssinaturaRequest): Promise<Assinatura> {
    const response = await api.post(`/planos/${planoId}/assinaturas`, data);
    return response.data.data;
  },

  async buscarAssinaturaGestor(gestorId: string): Promise<Assinatura | null> {
    const response = await api.get(`/planos/gestores/${gestorId}/assinatura`);
    return response.data.data;
  },
};

export const gestorService = {
  async consultarLimites(): Promise<LimitesGestor> {
    const response = await api.get('/gestores/me/limites');
    return response.data.data;
  },

  async consultarCreditos(page = 1, limit = 20): Promise<{
    saldo: SaldoCreditos;
    historico: {
      items: UsoCredito[];
      total: number;
    };
  }> {
    const response = await api.get('/gestores/me/creditos', { params: { page, limit } });
    return response.data.data;
  },

  async consultarAssinatura(): Promise<Assinatura | null> {
    const response = await api.get('/gestores/me/assinatura');
    return response.data.data;
  },
};

export type ProvedorIa = 'openai' | 'deepseek';

export interface ConfiguracaoCredito {
  id: string;
  provedor: ProvedorIa;
  modelo: string;
  tokensPorCredito: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CriarConfiguracaoCreditoRequest {
  provedor: ProvedorIa;
  modelo: string;
  tokensPorCredito: number;
  ativo?: boolean;
}

export const configuracaoCreditoService = {
  async listar(): Promise<ConfiguracaoCredito[]> {
    const response = await api.get('/configuracoes-credito');
    return response.data.data;
  },

  async buscarPorId(id: string): Promise<ConfiguracaoCredito> {
    const response = await api.get(`/configuracoes-credito/${id}`);
    return response.data.data;
  },

  async criarOuAtualizar(data: CriarConfiguracaoCreditoRequest): Promise<ConfiguracaoCredito> {
    const response = await api.post('/configuracoes-credito', data);
    return response.data.data;
  },

  async atualizar(id: string, data: Partial<CriarConfiguracaoCreditoRequest>): Promise<ConfiguracaoCredito> {
    const response = await api.put(`/configuracoes-credito/${id}`, data);
    return response.data.data;
  },

  async remover(id: string): Promise<void> {
    await api.delete(`/configuracoes-credito/${id}`);
  },
};

export interface EstatisticasTokens {
  total: {
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  };
  porProvedor: Array<{
    provedor: ProvedorIa;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  }>;
  porModelo: Array<{
    provedor: ProvedorIa;
    modelo: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  }>;
  porGestor: Array<{
    gestorId: string;
    gestorNome: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  }>;
  porPeriodo: Array<{
    data: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  }>;
}

export const auditoriaTokensService = {
  async obterEstatisticas(dataInicio?: string, dataFim?: string): Promise<EstatisticasTokens> {
    const params: any = {};
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    const response = await api.get('/auditoria-tokens/estatisticas', { params });
    return response.data.data;
  },

  async listarHistorico(
    page = 1,
    limit = 50,
    gestorId?: string,
    provedor?: ProvedorIa,
    dataInicio?: string,
    dataFim?: string,
  ): Promise<{ items: UsoCredito[]; total: number }> {
    const params: any = { page, limit };
    if (gestorId) params.gestorId = gestorId;
    if (provedor) params.provedor = provedor;
    if (dataInicio) params.dataInicio = dataInicio;
    if (dataFim) params.dataFim = dataFim;
    const response = await api.get('/auditoria-tokens/historico', { params });
    return response.data.data;
  },
};

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

