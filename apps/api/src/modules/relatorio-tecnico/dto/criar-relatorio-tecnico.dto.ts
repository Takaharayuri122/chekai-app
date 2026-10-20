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

  @ApiPropertyOptional({ description: 'Descrição da ocorrência em HTML (obrigatório ao finalizar se a seção estiver ativa)' })
  @IsString()
  @IsOptional()
  descricaoOcorrenciaHtml?: string;

  @ApiPropertyOptional({ description: 'Avaliação técnica em HTML (obrigatório ao finalizar se a seção estiver ativa)' })
  @IsString()
  @IsOptional()
  avaliacaoTecnicaHtml?: string;

  @ApiPropertyOptional({
    description: 'Lista de ações executadas na visita',
    type: [String],
    example: ['Correção imediata de armazenamento', 'Treinamento da equipe'],
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsOptional()
  acoesExecutadas?: string[];

  @ApiPropertyOptional({ description: 'Recomendações da consultora em HTML (obrigatório ao finalizar se a seção estiver ativa)' })
  @IsString()
  @IsOptional()
  recomendacoesConsultoraHtml?: string;

  @ApiPropertyOptional({ description: 'Plano de ação sugerido em HTML (obrigatório ao finalizar se a seção estiver ativa)' })
  @IsString()
  @IsOptional()
  planoAcaoSugeridoHtml?: string;

  @ApiPropertyOptional({ description: 'Apoio analítico gerado pela IA' })
  @IsString()
  @IsOptional()
  apoioAnaliticoChekAi?: string;

  @ApiPropertyOptional({ description: 'Nome da consultora na área de assinatura' })
  @IsString()
  @IsOptional()
  assinaturaNomeConsultora?: string;

  @ApiPropertyOptional({ description: 'Responsável informado no relatório técnico' })
  @IsString()
  @IsOptional()
  responsavel?: string;

  @ApiPropertyOptional({ enum: StatusRelatorioTecnico, default: StatusRelatorioTecnico.RASCUNHO })
  @IsEnum(StatusRelatorioTecnico)
  @IsOptional()
  status?: StatusRelatorioTecnico;
}
