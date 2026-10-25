import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para ler uma legislação a partir do texto colado.
 */
export class LerTextoDto {
  @ApiProperty({ description: 'Texto completo da legislação (mínimo de 500 caracteres)' })
  @IsString()
  @MinLength(500, { message: 'Cole o texto completo da legislação (mínimo de 500 caracteres).' })
  @MaxLength(2000000, { message: 'O texto colado é grande demais.' })
  texto: string;
}
