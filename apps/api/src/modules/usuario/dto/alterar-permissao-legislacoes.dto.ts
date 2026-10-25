import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para conceder ou retirar a permissão de gerenciar legislações de um gestor.
 */
export class AlterarPermissaoLegislacoesDto {
  @ApiProperty()
  @IsBoolean()
  podeGerenciarLegislacoes: boolean;
}
