import { StatusRelatorioTecnico } from './enums';

export interface RelatorioTecnicoFoto {
  id: string;
  url?: string;
  filePath?: string;
  descricao?: string;
}

export interface RelatorioTecnico {
  id: string;
  clienteId: string;
  unidadeId?: string;
  consultoraId: string;
  identificacao: string;
  descricaoOcorrenciaHtml: string;
  avaliacaoTecnicaHtml: string;
  acoesExecutadas: string[];
  recomendacoesConsultoraHtml: string;
  planoAcaoSugeridoHtml: string;
  apoioAnaliticoChekAi?: string;
  status: StatusRelatorioTecnico;
  assinaturaNomeConsultora: string;
  responsavel?: string;
  fotos: RelatorioTecnicoFoto[];
}
