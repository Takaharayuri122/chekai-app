import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para atualizar a análise de IA de uma foto.
 */
export class AtualizarAnaliseFotoDto {
  @ApiPropertyOptional({ description: 'Análise de IA da foto (JSON stringificado)' })
  @IsString()
  @IsOptional()
  analiseIa?: string;
}

