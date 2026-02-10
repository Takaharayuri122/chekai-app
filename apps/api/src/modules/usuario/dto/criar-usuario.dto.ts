import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsUUID,
  ValidateIf,
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

  @ApiPropertyOptional({ description: 'Senha do usuário (opcional - não usado com OTP)', example: 'Senha@123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @IsOptional()
  senha?: string;

  @ApiPropertyOptional({
    description: 'Perfil do usuário',
    enum: PerfilUsuario,
    default: PerfilUsuario.GESTOR,
  })
  @IsEnum(PerfilUsuario, { message: 'Perfil inválido' })
  @IsOptional()
  perfil?: PerfilUsuario;

  @ApiPropertyOptional({
    description: 'ID do Gestor ao qual o Auditor está vinculado (apenas para perfil AUDITOR)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'ID do gestor inválido' })
  @IsOptional()
  gestorId?: string;

  @ApiProperty({ description: 'WhatsApp do usuário', example: '11999998888' })
  @IsString()
  @IsNotEmpty({ message: 'O WhatsApp é obrigatório' })
  telefone: string;

  @ApiPropertyOptional({
    description: 'ID do plano a ser atribuído ao usuário (apenas para perfil GESTOR)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'ID do plano inválido' })
  @IsOptional()
  planoId?: string;

  @ApiPropertyOptional({ description: 'URL da logo da consultoria (exibida no relatório). Enviar null para remover.' })
  @ValidateIf((o) => o.logoUrl != null)
  @IsString()
  @IsOptional()
  logoUrl?: string | null;
}

