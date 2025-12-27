import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoAtividade } from '../entities/cliente.entity';

/**
 * DTO para criação de um novo cliente.
 */
export class CriarClienteDto {
  @ApiProperty({ description: 'Razão social da empresa', example: 'Restaurante XYZ Ltda' })
  @IsString()
  @IsNotEmpty({ message: 'A razão social é obrigatória' })
  razaoSocial: string;

  @ApiPropertyOptional({ description: 'Nome fantasia', example: 'Restaurante XYZ' })
  @IsString()
  @IsOptional()
  nomeFantasia?: string;

  @ApiProperty({ description: 'CNPJ da empresa (com ou sem máscara)', example: '12.345.678/0001-90' })
  @IsString()
  @Matches(/^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})$/, {
    message: 'CNPJ inválido. Use o formato XX.XXX.XXX/XXXX-XX ou apenas números',
  })
  @IsNotEmpty({ message: 'O CNPJ é obrigatório' })
  cnpj: string;

  @ApiPropertyOptional({ description: 'E-mail de contato', example: 'contato@empresa.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Telefone de contato', example: '11999998888' })
  @IsString()
  @IsNotEmpty({ message: 'O telefone é obrigatório' })
  telefone: string;

  @ApiPropertyOptional({
    description: 'Tipo de atividade',
    enum: TipoAtividade,
    default: TipoAtividade.OUTRO,
  })
  @IsEnum(TipoAtividade, { message: 'Tipo de atividade inválido' })
  @IsOptional()
  tipoAtividade?: TipoAtividade;

  @ApiPropertyOptional({ description: 'Nome do responsável técnico', example: 'Maria Silva' })
  @IsString()
  @IsOptional()
  responsavelTecnico?: string;
}

