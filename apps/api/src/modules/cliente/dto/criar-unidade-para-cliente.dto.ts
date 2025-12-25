import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de uma nova unidade vinculada a um cliente (via rota aninhada).
 */
export class CriarUnidadeParaClienteDto {
  @ApiProperty({ description: 'Nome da unidade', example: 'Filial Centro' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da unidade é obrigatório' })
  nome: string;

  @ApiProperty({ description: 'Endereço completo', example: 'Rua das Flores, 123' })
  @IsString()
  @IsNotEmpty({ message: 'O endereço é obrigatório' })
  endereco: string;

  @ApiPropertyOptional({ description: 'Cidade', example: 'São Paulo' })
  @IsString()
  @IsOptional()
  cidade?: string;

  @ApiPropertyOptional({ description: 'Estado (UF)', example: 'SP' })
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional({ description: 'CEP', example: '01234-567' })
  @IsString()
  @IsOptional()
  cep?: string;

  @ApiPropertyOptional({ description: 'Latitude para geolocalização', example: -23.5505 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude para geolocalização', example: -46.6333 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Raio de geofencing em metros', example: 100 })
  @IsNumber()
  @IsOptional()
  raioGeofencing?: number;

  @ApiPropertyOptional({ description: 'Nome do responsável local', example: 'Carlos Santos' })
  @IsString()
  @IsOptional()
  responsavel?: string;

  @ApiPropertyOptional({ description: 'Telefone da unidade', example: '11999998888' })
  @IsString()
  @IsOptional()
  telefone?: string;
}

