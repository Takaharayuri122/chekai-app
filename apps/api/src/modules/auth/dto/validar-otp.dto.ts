import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para validação de código OTP.
 */
export class ValidarOtpDto {
  @ApiProperty({ description: 'E-mail do usuário', example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({ description: 'Código OTP de 6 dígitos', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'O código OTP é obrigatório' })
  @Length(6, 6, { message: 'O código OTP deve ter 6 dígitos' })
  codigo: string;
}

