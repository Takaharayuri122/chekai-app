import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para cadastro público de usuário (pelo site).
 * Usuários cadastrados pelo site são automaticamente criados como GESTOR.
 */
export class CadastroPublicoDto {
  @ApiProperty({ description: 'Nome completo do usuário', example: 'João Silva' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  nome: string;

  @ApiProperty({ description: 'E-mail do usuário', example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ description: 'WhatsApp do usuário', example: '11999998888' })
  @IsString()
  @IsNotEmpty({ message: 'O WhatsApp é obrigatório' })
  telefone: string;

  @ApiProperty({ description: 'ID do plano selecionado', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID('4', { message: 'ID do plano deve ser um UUID válido' })
  @IsNotEmpty({ message: 'O plano é obrigatório' })
  planoId: string;
}

