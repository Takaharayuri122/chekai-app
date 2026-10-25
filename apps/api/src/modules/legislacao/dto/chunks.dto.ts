import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para adicionar um trecho manualmente.
 */
export class AdicionarChunkDto {
  @ApiProperty({ example: 'O armazenamento de alimentos deve ser...' })
  @IsString()
  @IsNotEmpty()
  conteudo: string;

  @ApiPropertyOptional({ example: 'Art. 5º' })
  @IsString()
  @IsOptional()
  artigo?: string;

  @ApiPropertyOptional({ example: 'I' })
  @IsString()
  @IsOptional()
  inciso?: string;

  @ApiPropertyOptional({ example: '§1º' })
  @IsString()
  @IsOptional()
  paragrafo?: string;
}

/**
 * DTO para adicionar múltiplos trechos.
 */
export class AdicionarChunksDto {
  @ApiProperty({ type: [AdicionarChunkDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdicionarChunkDto)
  chunks: AdicionarChunkDto[];
}

/**
 * DTO para busca por similaridade.
 */
export class BuscaRagDto {
  @ApiProperty({ example: 'armazenamento de alimentos na câmara fria' })
  @IsString()
  @IsNotEmpty()
  query: string;
}
