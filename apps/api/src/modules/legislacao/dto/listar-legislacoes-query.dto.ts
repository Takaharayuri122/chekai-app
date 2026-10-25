import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusLeitura } from '../entities/legislacao.entity';

/**
 * Filtros da listagem de legislações.
 */
export class ListarLegislacoesQueryDto {
  @ApiPropertyOptional({ description: 'Busca por título, número ou ementa' })
  @IsString()
  @IsOptional()
  busca?: string;

  @ApiPropertyOptional({ enum: StatusLeitura })
  @IsEnum(StatusLeitura)
  @IsOptional()
  statusLeitura?: StatusLeitura;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsIn(['true', 'false'])
  @IsOptional()
  ativo?: 'true' | 'false';
}
