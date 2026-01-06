import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de um novo plano.
 */
export class CriarPlanoDto {
  @ApiProperty({ description: 'Nome do plano', example: 'Plano Básico' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  nome: string;

  @ApiPropertyOptional({ description: 'Descrição do plano' })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiProperty({ description: 'Limite de usuários', example: 10, minimum: 0 })
  @IsInt({ message: 'O limite de usuários deve ser um número inteiro' })
  @Min(0, { message: 'O limite de usuários deve ser maior ou igual a zero' })
  limiteUsuarios: number;

  @ApiProperty({ description: 'Limite de auditorias', example: 50, minimum: 0 })
  @IsInt({ message: 'O limite de auditorias deve ser um número inteiro' })
  @Min(0, { message: 'O limite de auditorias deve ser maior ou igual a zero' })
  limiteAuditorias: number;

  @ApiProperty({ description: 'Limite de clientes', example: 20, minimum: 0 })
  @IsInt({ message: 'O limite de clientes deve ser um número inteiro' })
  @Min(0, { message: 'O limite de clientes deve ser maior ou igual a zero' })
  limiteClientes: number;

  @ApiProperty({ description: 'Limite de créditos de IA', example: 10000, minimum: 0 })
  @IsInt({ message: 'O limite de créditos deve ser um número inteiro' })
  @Min(0, { message: 'O limite de créditos deve ser maior ou igual a zero' })
  limiteCreditos: number;

  @ApiPropertyOptional({ description: 'Se o plano está ativo', default: true })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

