import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de uma assinatura.
 */
export class CriarAssinaturaDto {
  @ApiProperty({
    description: 'ID do gestor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'ID do gestor inválido' })
  @IsNotEmpty({ message: 'O ID do gestor é obrigatório' })
  gestorId: string;

  @ApiProperty({
    description: 'ID do plano',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'ID do plano inválido' })
  @IsNotEmpty({ message: 'O ID do plano é obrigatório' })
  planoId: string;

  @ApiPropertyOptional({
    description: 'Data de início da assinatura (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDateString({}, { message: 'Data de início inválida' })
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({
    description: 'Data de fim da assinatura (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDateString({}, { message: 'Data de fim inválida' })
  @IsOptional()
  dataFim?: string;
}

