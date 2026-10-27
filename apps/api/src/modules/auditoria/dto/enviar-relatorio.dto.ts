import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsOptional } from 'class-validator';

/**
 * Corpo do envio manual do relatório. Sem destinatários, usa o e-mail da unidade ou do cliente.
 */
export class EnviarRelatorioDto {
  @ApiPropertyOptional({ type: [String], description: 'De 1 a 5 e-mails' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um e-mail' })
  @ArrayMaxSize(5, { message: 'Informe no máximo 5 e-mails' })
  @IsEmail({}, { each: true, message: 'Informe e-mails válidos' })
  destinatarios?: string[];
}
