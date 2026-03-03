import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IniciarRelatorioTecnicoDto {
  @ApiProperty({ description: 'ID do cliente vinculado ao relatório' })
  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

  @ApiProperty({ description: 'ID da unidade vinculada ao relatório' })
  @IsUUID()
  @IsNotEmpty()
  unidadeId: string;
}
