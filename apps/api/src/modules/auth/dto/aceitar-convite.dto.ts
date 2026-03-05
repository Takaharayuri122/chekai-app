import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para aceitar um convite de acesso.
 */
export class AceitarConviteDto {
  @ApiProperty({ description: 'Token de convite recebido por e-mail' })
  @IsString()
  @IsNotEmpty({ message: 'O token é obrigatório' })
  token: string;
}
