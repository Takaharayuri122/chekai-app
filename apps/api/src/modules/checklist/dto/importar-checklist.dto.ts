import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { TipoAtividade } from '../../cliente/entities/cliente.entity';
import { CategoriaItem, CriticidadeItem } from '../entities/template-item.entity';
import type { TipoRespostaLote } from '../checklist-regras';

/**
 * DTO para importação de checklist.
 */
export class ImportarChecklistDto {
  @ApiProperty({ description: 'Nome do template a ser criado' })
  @IsString()
  @IsNotEmpty()
  nomeTemplate: string;

  @ApiPropertyOptional({ description: 'Descrição do template' })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Tipo de atividade', enum: TipoAtividade })
  @IsEnum(TipoAtividade)
  @IsOptional()
  tipoAtividade?: TipoAtividade;

  @ApiPropertyOptional({ description: 'Versão do template', default: '1.0' })
  @IsString()
  @IsOptional()
  versao?: string;
}

/**
 * Representa uma linha do CSV importado.
 */
export interface ChecklistCsvRow {
  grupo: string;
  secao: string;
  pergunta: string;
  tipoResposta?: string;
  pontuacaoMaxima?: number;
  processo?: string;
  tags?: string;
  perguntaAtiva?: boolean;
  respostaObrigatoria?: boolean;
  justificativaObrigatoria?: boolean;
  permiteComentario?: boolean;
  permiteFotos?: boolean;
  fotosObrigatorias?: boolean;
  descricaoAjuda?: string;
  opcoesResposta?: ChecklistOpcaoResposta[];
}

/**
 * Representa uma opção de resposta importada.
 */
export interface ChecklistOpcaoResposta {
  texto: string;
  inconformidade?: boolean;
  pontos?: number;
  zeraGrupo?: boolean;
  zeraChecklist?: boolean;
  exigeFoto?: boolean;
  comentarioObrigatorio?: boolean;
}

/**
 * Resultado do preview da importação.
 */
export interface ImportacaoPreview {
  nomeOriginal: string;
  dataExportacao: string;
  grupos: ImportacaoGrupoPreview[];
  totalPerguntas: number;
  totalGrupos: number;
  perguntas: PerguntaImportada[];
}

/**
 * Configuração de uma pergunta importada (colunas da planilha já interpretadas).
 */
export interface ConfiguracaoPerguntaImportada {
  categoria: CategoriaItem;
  criticidade: CriticidadeItem;
  tipoResposta: TipoRespostaLote;
  peso: number;
  obrigatorio: boolean;
  permiteFoto: boolean;
  permiteObservacao: boolean;
  opcoes: {
    valor: string;
    pontuacao: number | null;
    fotoObrigatoria: boolean;
    observacaoObrigatoria: boolean;
  }[];
}

/**
 * Pergunta importada, com chave estável `l${indiceLinha}`.
 */
export interface PerguntaImportada {
  chave: string;
  grupo: string;
  secao?: string;
  pergunta: string;
  configuracao: ConfiguracaoPerguntaImportada;
  motivoConferir?: string;
}

/**
 * Preview de um grupo na importação.
 */
export interface ImportacaoGrupoPreview {
  nome: string;
  secoes: string[];
  perguntas: number;
}

/**
 * Resultado da importação.
 */
export interface ImportacaoResultado {
  templateId: string;
  nomeTemplate: string;
  gruposCriados: number;
  itensCriados: number;
  avisos: string[];
}

