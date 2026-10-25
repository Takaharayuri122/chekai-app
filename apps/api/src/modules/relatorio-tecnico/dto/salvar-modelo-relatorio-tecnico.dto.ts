import { IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ModeloSecao } from '../modelo-secoes';

export class SalvarModeloRelatorioTecnicoDto {
  @ApiProperty({
    description: 'Seções configuráveis do relatório técnico (ativa e título)',
    example: [{ secao: 'avaliacaoTecnica', ativa: false, titulo: '' }],
  })
  @IsArray()
  secoes: ModeloSecao[];
}
