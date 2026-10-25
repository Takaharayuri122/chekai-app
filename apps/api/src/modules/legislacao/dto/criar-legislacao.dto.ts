import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para cadastrar uma legislação a partir do link oficial.
 */
export class CriarLegislacaoDto {
  @ApiProperty({ example: 'https://www.planalto.gov.br/ccivil_03/leis/l8078.htm' })
  @IsUrl({ require_protocol: true }, { message: 'Link oficial inválido' })
  @MaxLength(500)
  linkOficial: string;

  @ApiProperty({ example: 'Boas Práticas para Serviços de Alimentação' })
  @IsString()
  @IsNotEmpty({ message: 'O título é obrigatório' })
  @MaxLength(500)
  titulo: string;

  @ApiPropertyOptional({ description: 'Informações adicionais para a leitura' })
  @IsString()
  @IsOptional()
  informacoes?: string;
}
