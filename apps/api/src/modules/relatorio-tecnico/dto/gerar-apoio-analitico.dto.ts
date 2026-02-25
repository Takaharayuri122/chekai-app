import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GerarApoioAnaliticoDto {
  @ApiPropertyOptional({ description: 'Contexto complementar opcional para a IA' })
  @IsString()
  @IsOptional()
  prompt?: string;
}
