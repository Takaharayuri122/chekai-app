import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RespostaItem } from '../entities/auditoria-item.entity';

/**
 * DTO para iniciar uma nova auditoria.
 */
export class IniciarAuditoriaDto {
  @ApiProperty({ description: 'ID da unidade a ser auditada' })
  @IsUUID('4')
  @IsNotEmpty()
  unidadeId: string;

  @ApiProperty({ description: 'ID do template de checklist' })
  @IsUUID('4')
  @IsNotEmpty()
  templateId: string;

  @ApiPropertyOptional({ description: 'Latitude do início da auditoria' })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude do início da auditoria' })
  @IsNumber()
  @IsOptional()
  longitude?: number;
}

/**
 * DTO para responder um item da auditoria.
 */
export class ResponderItemDto {
  @ApiProperty({ description: 'Resposta do item (pode ser enum ou string para opções personalizadas)', enum: RespostaItem })
  @IsString()
  @IsNotEmpty()
  resposta: RespostaItem | string;

  @ApiPropertyOptional({ description: 'Observação do auditor' })
  @IsString()
  @IsOptional()
  observacao?: string;

  @ApiPropertyOptional({ description: 'Descrição da não conformidade' })
  @IsString()
  @IsOptional()
  descricaoNaoConformidade?: string;

  @ApiPropertyOptional({ description: 'Descrição gerada pela IA' })
  @IsString()
  @IsOptional()
  descricaoIa?: string;

  @ApiPropertyOptional({ description: 'Complemento do operador à descrição da IA' })
  @IsString()
  @IsOptional()
  complementoDescricao?: string;

  @ApiPropertyOptional({ description: 'Plano de ação sugerido pela IA' })
  @IsString()
  @IsOptional()
  planoAcaoSugerido?: string;

  @ApiPropertyOptional({ description: 'Referência legal' })
  @IsString()
  @IsOptional()
  referenciaLegal?: string;
}

/**
 * DTO para finalizar a auditoria.
 */
export class FinalizarAuditoriaDto {
  @ApiPropertyOptional({ description: 'Latitude do fim da auditoria' })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude do fim da auditoria' })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Observações gerais da auditoria' })
  @IsString()
  @IsOptional()
  observacoesGerais?: string;
}

