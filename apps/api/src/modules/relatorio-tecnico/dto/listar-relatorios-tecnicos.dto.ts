import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsUUID, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { StatusRelatorioTecnico } from '../entities/relatorio-tecnico.entity';

export class ListarRelatoriosTecnicosDto {
  @ApiPropertyOptional({ description: 'Página da listagem', default: 1 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ description: 'Tamanho da página', default: 10 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  limit = 10;

  @ApiPropertyOptional({ description: 'Filtrar por cliente' })
  @IsUUID()
  @IsOptional()
  clienteId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por status', enum: StatusRelatorioTecnico })
  @IsEnum(StatusRelatorioTecnico)
  @IsOptional()
  status?: StatusRelatorioTecnico;

  @ApiPropertyOptional({ description: 'Data inicial (yyyy-mm-dd)' })
  @IsDateString()
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Data final (yyyy-mm-dd)' })
  @IsDateString()
  @IsOptional()
  dataFim?: string;
}
