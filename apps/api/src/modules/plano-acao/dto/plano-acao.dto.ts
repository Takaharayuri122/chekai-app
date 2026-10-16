import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { StatusTarefaPlanoAcao } from '../entities/plano-acao-tarefa.entity';

export class CriarTarefaPlanoAcaoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  titulo: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  responsavelId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  auditoriaId?: string;

  @ApiProperty({ description: 'Prazo (yyyy-mm-dd)' })
  @IsDateString()
  prazo: string;
}

export class AtualizarTarefaPlanoAcaoDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  titulo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  responsavelId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  prazo?: string;

  @ApiPropertyOptional({ enum: StatusTarefaPlanoAcao })
  @IsEnum(StatusTarefaPlanoAcao)
  @IsOptional()
  status?: StatusTarefaPlanoAcao;
}

export class ListarTarefasPlanoAcaoDto {
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

  @ApiPropertyOptional({ enum: StatusTarefaPlanoAcao })
  @IsEnum(StatusTarefaPlanoAcao)
  @IsOptional()
  status?: StatusTarefaPlanoAcao;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  responsavelId?: string;
}
