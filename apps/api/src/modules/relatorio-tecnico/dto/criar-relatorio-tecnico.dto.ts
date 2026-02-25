import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusRelatorioTecnico } from '../entities/relatorio-tecnico.entity';

export class CriarRelatorioTecnicoDto {
  @ApiProperty({ description: 'ID do cliente vinculado ao relatório' })
  @IsUUID()
  @IsNotEmpty()
  clienteId: string;

  @ApiPropertyOptional({ description: 'ID da unidade vinculada ao relatório' })
  @IsUUID()
  @IsOptional()
  unidadeId?: string;

  @ApiProperty({ description: 'Identificação setorial/estrutural do relatório' })
  @IsString()
  @IsNotEmpty()
  identificacao: string;

  @ApiProperty({ description: 'Descrição da ocorrência em HTML' })
  @IsString()
  @IsNotEmpty()
  descricaoOcorrenciaHtml: string;

  @ApiProperty({ description: 'Avaliação técnica em HTML' })
  @IsString()
  @IsNotEmpty()
  avaliacaoTecnicaHtml: string;

  @ApiProperty({
    description: 'Lista de ações executadas na visita',
    type: [String],
    example: ['Correção imediata de armazenamento', 'Treinamento da equipe'],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  acoesExecutadas: string[];

  @ApiProperty({ description: 'Recomendações da consultora em HTML' })
  @IsString()
  @IsNotEmpty()
  recomendacoesConsultoraHtml: string;

  @ApiProperty({ description: 'Plano de ação sugerido em HTML' })
  @IsString()
  @IsNotEmpty()
  planoAcaoSugeridoHtml: string;

  @ApiPropertyOptional({ description: 'Apoio analítico gerado pela IA' })
  @IsString()
  @IsOptional()
  apoioAnaliticoChekAi?: string;

  @ApiPropertyOptional({ description: 'Nome da consultora na área de assinatura' })
  @IsString()
  @IsOptional()
  assinaturaNomeConsultora?: string;

  @ApiPropertyOptional({ enum: StatusRelatorioTecnico, default: StatusRelatorioTecnico.RASCUNHO })
  @IsEnum(StatusRelatorioTecnico)
  @IsOptional()
  status?: StatusRelatorioTecnico;
}
