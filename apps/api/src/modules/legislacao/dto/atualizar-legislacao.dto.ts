import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SituacaoLegislacao, TipoLegislacao } from '../entities/legislacao.entity';

/**
 * DTO para editar os dados de uma legislação (trocar o link não relê sozinho).
 */
export class AtualizarLegislacaoDto {
  @ApiPropertyOptional({ enum: TipoLegislacao })
  @IsEnum(TipoLegislacao)
  @IsOptional()
  tipo?: TipoLegislacao;

  @ApiPropertyOptional({ example: '216' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  numero?: string;

  @ApiPropertyOptional({ example: 2004 })
  @IsInt()
  @IsOptional()
  ano?: number;

  @ApiPropertyOptional({ example: 'Boas Práticas para Serviços de Alimentação' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  titulo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ementa?: string;

  @ApiPropertyOptional({ example: 'ANVISA' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  orgaoEmissor?: string;

  @ApiPropertyOptional()
  @IsUrl({ require_protocol: true }, { message: 'Link oficial inválido' })
  @MaxLength(500)
  @IsOptional()
  linkOficial?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  informacoes?: string;

  @ApiPropertyOptional({ enum: SituacaoLegislacao })
  @IsEnum(SituacaoLegislacao)
  @IsOptional()
  situacao?: SituacaoLegislacao;

  @ApiPropertyOptional({ example: '2004-09-15' })
  @IsDateString()
  @IsOptional()
  dataPublicacao?: string;
}
