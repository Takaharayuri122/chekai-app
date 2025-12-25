import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PerfilUsuario } from '../entities/usuario.entity';

/**
 * DTO para criação de um novo usuário.
 */
export class CriarUsuarioDto {
  @ApiProperty({ description: 'Nome completo do usuário', example: 'João Silva' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  nome: string;

  @ApiProperty({ description: 'E-mail do usuário', example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ description: 'Senha do usuário', example: 'Senha@123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  senha: string;

  @ApiPropertyOptional({
    description: 'Perfil do usuário',
    enum: PerfilUsuario,
    default: PerfilUsuario.CONSULTOR,
  })
  @IsEnum(PerfilUsuario, { message: 'Perfil inválido' })
  @IsOptional()
  perfil?: PerfilUsuario;

  @ApiPropertyOptional({ description: 'Telefone do usuário', example: '11999998888' })
  @IsString()
  @IsOptional()
  telefone?: string;
}

