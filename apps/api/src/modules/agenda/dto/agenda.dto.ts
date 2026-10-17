import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { RecorrenciaAgenda, StatusAgenda } from '../entities/agenda-auditoria.entity';

export class CriarAgendaDto {
  @ApiProperty()
  @IsUUID()
  unidadeId: string;

  @ApiProperty()
  @IsUUID()
  templateId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  responsavelId?: string;

  @ApiProperty({ description: 'yyyy-mm-dd' })
  @IsDateString()
  dataPrevista: string;

  @ApiPropertyOptional({ enum: RecorrenciaAgenda })
  @IsEnum(RecorrenciaAgenda)
  @IsOptional()
  recorrencia?: RecorrenciaAgenda;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacao?: string;
}

export class AtualizarAgendaDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  responsavelId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dataPrevista?: string;

  @ApiPropertyOptional({ enum: RecorrenciaAgenda })
  @IsEnum(RecorrenciaAgenda)
  @IsOptional()
  recorrencia?: RecorrenciaAgenda;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observacao?: string;

  @ApiPropertyOptional({ enum: StatusAgenda })
  @IsEnum(StatusAgenda)
  @IsOptional()
  status?: StatusAgenda;
}

export class ListarAgendaDto {
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @IsOptional()
  limit = 20;

  @ApiPropertyOptional({ enum: StatusAgenda })
  @IsEnum(StatusAgenda)
  @IsOptional()
  status?: StatusAgenda;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  responsavelId?: string;

  @ApiPropertyOptional({ description: 'Data prevista inicial (yyyy-mm-dd)' })
  @IsDateString()
  @IsOptional()
  de?: string;

  @ApiPropertyOptional({ description: 'Data prevista final (yyyy-mm-dd)' })
  @IsDateString()
  @IsOptional()
  ate?: string;
}
