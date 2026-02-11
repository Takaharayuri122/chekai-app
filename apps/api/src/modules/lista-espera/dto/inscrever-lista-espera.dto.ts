import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para inscrição na lista de espera (endpoint público).
 */
export class InscreverListaEsperaDto {
  @ApiProperty({ description: 'E-mail do interessado', example: 'interessado@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiPropertyOptional({ description: 'Telefone para contato', example: '11999998888' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;
}
