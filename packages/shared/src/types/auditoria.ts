import { StatusAuditoria, RespostaItem } from './enums';

export interface ResumoExecutivo {
  resumo: string;
  pontosFortes: string[];
  pontosFracos: string[];
  recomendacoesPrioritarias: string[];
  riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
  tendencias: string[];
}

export interface Foto {
  id: string;
  url?: string;
  filePath?: string;
  tamanhoBytes?: number;
  analiseIa?: string;
  latitude?: number;
  longitude?: number;
}

export interface AuditoriaItem {
  id: string;
  resposta: RespostaItem;
  observacao?: string;
  descricaoNaoConformidade?: string;
  descricaoIa?: string;
  complementoDescricao?: string;
  planoAcaoSugerido?: string;
  planoAcaoFinal?: string;
  referenciaLegal?: string;
  pontuacao: number;
  fotos: Foto[];
  templateItemId: string;
}

export interface Auditoria {
  id: string;
  status: StatusAuditoria;
  dataInicio?: string;
  dataFim?: string;
  latitudeInicio?: number;
  longitudeInicio?: number;
  latitudeFim?: number;
  longitudeFim?: number;
  observacoesGerais?: string;
  pontuacaoTotal?: number;
  resumoExecutivo?: ResumoExecutivo;
  pdfUrl?: string;
  clienteId: string;
  unidadeId: string;
  templateId: string;
  itens: AuditoriaItem[];
}
