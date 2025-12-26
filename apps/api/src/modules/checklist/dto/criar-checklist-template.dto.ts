import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TipoAtividade } from '../../cliente/entities/cliente.entity';
import { CategoriaItem, CriticidadeItem } from '../entities/template-item.entity';

/**
 * DTO para criar um item do template.
 */
export class CriarTemplateItemDto {
  @ApiProperty({ description: 'Pergunta do item', example: 'Os manipuladores utilizam EPIs adequados?' })
  @IsString()
  @IsNotEmpty()
  pergunta: string;

  @ApiPropertyOptional({ description: 'Categoria do item', enum: CategoriaItem })
  @IsEnum(CategoriaItem)
  @IsOptional()
  categoria?: CategoriaItem;

  @ApiPropertyOptional({ description: 'Criticidade do item', enum: CriticidadeItem })
  @IsEnum(CriticidadeItem)
  @IsOptional()
  criticidade?: CriticidadeItem;

  @ApiPropertyOptional({ description: 'Peso do item para pontuação', example: 1 })
  @IsNumber()
  @IsOptional()
  peso?: number;

  @ApiPropertyOptional({ description: 'Ordem de exibição', example: 1 })
  @IsNumber()
  @IsOptional()
  ordem?: number;

  @ApiPropertyOptional({ description: 'Referência da legislação', example: 'RDC 216/2004' })
  @IsString()
  @IsOptional()
  legislacaoReferencia?: string;

  @ApiPropertyOptional({ description: 'Artigo/inciso específico', example: 'Art. 4.1.3' })
  @IsString()
  @IsOptional()
  artigo?: string;

  @ApiPropertyOptional({ description: 'Texto legal completo' })
  @IsString()
  @IsOptional()
  textoLegal?: string;

  @ApiPropertyOptional({ description: 'Se o item é obrigatório', default: true })
  @IsBoolean()
  @IsOptional()
  obrigatorio?: boolean;

  @ApiPropertyOptional({
    description: 'Opções de resposta personalizadas',
    example: ['Conforme', 'Não Conforme', 'Parcialmente Conforme'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  opcoesResposta?: string[];

  @ApiPropertyOptional({ description: 'Usar respostas personalizadas ao invés das padrão', default: false })
  @IsBoolean()
  @IsOptional()
  usarRespostasPersonalizadas?: boolean;

  @ApiPropertyOptional({ description: 'ID do grupo ao qual o item pertence' })
  @IsString()
  @IsOptional()
  grupoId?: string;

  @ApiPropertyOptional({ description: 'Seção dentro do grupo', example: 'ÁREA DE LAVAGEM' })
  @IsString()
  @IsOptional()
  secao?: string;
}

/**
 * DTO para criar um grupo de checklist.
 */
export class CriarChecklistGrupoDto {
  @ApiProperty({ description: 'Nome do grupo', example: 'ESTRUTURA' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiPropertyOptional({ description: 'Descrição do grupo' })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Ordem de exibição', example: 1 })
  @IsNumber()
  @IsOptional()
  ordem?: number;
}

/**
 * DTO para criação de um template de checklist.
 */
export class CriarChecklistTemplateDto {
  @ApiProperty({ description: 'Nome do template', example: 'Checklist RDC 216 - Restaurantes' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiPropertyOptional({ description: 'Descrição do template' })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Tipo de atividade', enum: TipoAtividade })
  @IsEnum(TipoAtividade)
  @IsOptional()
  tipoAtividade?: TipoAtividade;

  @ApiPropertyOptional({ description: 'Versão do template', example: '1.0' })
  @IsString()
  @IsOptional()
  versao?: string;

  @ApiPropertyOptional({ description: 'Itens do template', type: [CriarTemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriarTemplateItemDto)
  @IsOptional()
  itens?: CriarTemplateItemDto[];
}

