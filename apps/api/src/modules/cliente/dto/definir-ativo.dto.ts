import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para inativar ou reativar um cliente ou unidade.
 */
export class DefinirAtivoDto {
  @ApiProperty({ description: 'false inativa, true reativa', example: false })
  @IsBoolean({ message: 'O campo ativo deve ser verdadeiro ou falso' })
  ativo: boolean;
}
