import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { TipoAtividade } from '../../cliente/entities/cliente.entity';

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

