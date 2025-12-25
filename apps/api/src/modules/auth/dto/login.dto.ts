import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para requisição de login.
 */
export class LoginDto {
  @ApiProperty({ description: 'E-mail do usuário', example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ description: 'Senha do usuário', example: 'Senha@123' })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  senha: string;
}

/**
 * Interface para resposta de login com token.
 */
export interface LoginResponse {
  accessToken: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    perfil: string;
  };
}

