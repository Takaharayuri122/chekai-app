import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum AgruparHorasCheckin {
  CLIENTE = 'cliente',
  USUARIO = 'usuario',
}

export class RelatorioHorasCheckinDto {
  @ApiProperty({ enum: AgruparHorasCheckin, description: 'Agrupar totais por cliente ou usuário' })
  @IsEnum(AgruparHorasCheckin)
  agruparPor: AgruparHorasCheckin;

  @ApiProperty({ description: 'Data inicial (yyyy-mm-dd)' })
  @IsDateString()
  dataInicio: string;

  @ApiProperty({ description: 'Data final (yyyy-mm-dd)' })
  @IsDateString()
  dataFim: string;

  @ApiPropertyOptional({ description: 'Filtrar por auditor' })
  @IsUUID()
  @IsOptional()
  auditorId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por cliente' })
  @IsUUID()
  @IsOptional()
  clienteId?: string;
}
