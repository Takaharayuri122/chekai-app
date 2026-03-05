import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class ListarCheckinsDto {
  @ApiPropertyOptional({ description: 'Página da listagem', default: 1 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ description: 'Quantidade por página', default: 20 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  limit = 20;

  @ApiPropertyOptional({ description: 'Filtrar por auditor' })
  @IsUUID()
  @IsOptional()
  auditorId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por cliente' })
  @IsUUID()
  @IsOptional()
  clienteId?: string;

  @ApiPropertyOptional({ description: 'Data inicial do checkin (yyyy-mm-dd)' })
  @IsDateString()
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Data final do checkin (yyyy-mm-dd)' })
  @IsDateString()
  @IsOptional()
  dataFim?: string;
}
