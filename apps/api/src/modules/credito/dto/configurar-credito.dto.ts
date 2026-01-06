import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProvedorIa } from '../entities/uso-credito.entity';

/**
 * DTO para configuração de taxa de conversão de créditos.
 */
export class ConfigurarCreditoDto {
  @ApiProperty({
    description: 'Provedor de IA',
    enum: ProvedorIa,
    example: ProvedorIa.OPENAI,
  })
  @IsEnum(ProvedorIa, { message: 'Provedor inválido' })
  @IsNotEmpty({ message: 'O provedor é obrigatório' })
  provedor: ProvedorIa;

  @ApiProperty({
    description: 'Modelo de IA',
    example: 'gpt-4o-mini',
  })
  @IsString()
  @IsNotEmpty({ message: 'O modelo é obrigatório' })
  modelo: string;

  @ApiProperty({
    description: 'Quantidade de tokens por crédito',
    example: 1000,
    minimum: 1,
  })
  @IsInt({ message: 'Tokens por crédito deve ser um número inteiro' })
  @Min(1, { message: 'Tokens por crédito deve ser maior que zero' })
  tokensPorCredito: number;

  @ApiPropertyOptional({
    description: 'Se a configuração está ativa',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}

