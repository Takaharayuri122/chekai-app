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
 * `ano`, `situacao`, `dataPublicacao` e `linkOficial` aceitam null para limpar o valor.
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

  @ApiPropertyOptional({ example: 2004, nullable: true })
  @IsInt()
  @IsOptional()
  ano?: number | null;

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

  @ApiPropertyOptional({ nullable: true })
  @IsUrl({ require_protocol: true }, { message: 'Link oficial inválido' })
  @MaxLength(500)
  @IsOptional()
  linkOficial?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  informacoes?: string;

  @ApiPropertyOptional({ enum: SituacaoLegislacao, nullable: true })
  @IsEnum(SituacaoLegislacao)
  @IsOptional()
  situacao?: SituacaoLegislacao | null;

  @ApiPropertyOptional({ example: '2004-09-15', nullable: true })
  @IsDateString()
  @IsOptional()
  dataPublicacao?: string | null;
}
