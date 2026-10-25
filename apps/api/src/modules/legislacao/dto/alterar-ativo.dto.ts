import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para ativar ou desativar uma legislação.
 */
export class AlterarAtivoDto {
  @ApiProperty()
  @IsBoolean()
  ativo: boolean;
}
