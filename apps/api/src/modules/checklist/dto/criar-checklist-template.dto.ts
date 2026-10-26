import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  ValidateIf,
  ArrayMaxSize,
  IsUUID,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TipoAtividade } from '../../cliente/entities/cliente.entity';
import type { SentidoResposta } from '../regras';
import { CategoriaItem, CriticidadeItem, TipoRespostaCustomizada } from '../entities/template-item.entity';

const SENTIDOS_RESPOSTA: SentidoResposta[] = ['positiva', 'negativa', 'neutra'];

/** Faixa de classificação; a coerência entre faixas é validada por `validarFaixas` no service. */
export class FaixaClassificacaoDto {
  @IsString()
  nome: string;

  @IsString()
  cor: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  emoji: string | null;

  @IsNumber()
  de: number;

  @IsNumber()
  ate: number;
}

export class OpcaoRespostaConfigDto {
  @IsString()
  valor: string;

  @IsBoolean()
  fotoObrigatoria: boolean;

  @IsBoolean()
  observacaoObrigatoria: boolean;

  @ApiPropertyOptional({ description: 'Pontuação desta opção (-10 a 10). Null = sem pontuação' })
  @ValidateIf((o) => o.pontuacao != null)
  @IsNumber()
  @Min(-10)
  @Max(10)
  @IsOptional()
  pontuacao?: number | null;

  @ApiPropertyOptional({ enum: SENTIDOS_RESPOSTA, description: 'Sentido da resposta. Null = deduzido pelo valor' })
  @IsOptional()
  @IsIn(SENTIDOS_RESPOSTA)
  sentido?: SentidoResposta | null;

  @ApiPropertyOptional({ description: 'Ícone da resposta (emoji ou código), até 32 caracteres' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  icone?: string | null;
}

/**
 * DTO para criar um item do template.
 */
export class CriarTemplateItemDto {
  @ApiProperty({ description: 'Pergunta do item', example: 'Os manipuladores utilizam EPIs adequados?' })
  @IsString()
  @IsNotEmpty()
  pergunta: string;

  @ApiPropertyOptional({ description: 'Categoria do item', enum: CategoriaItem })
  @IsEnum(CategoriaItem)
  @IsOptional()
  categoria?: CategoriaItem;

  @ApiPropertyOptional({ description: 'Criticidade do item', enum: CriticidadeItem })
  @IsEnum(CriticidadeItem)
  @IsOptional()
  criticidade?: CriticidadeItem;

  @ApiPropertyOptional({ description: 'Peso do item (positivo soma ao conforme, negativo penaliza o não conforme)', example: 1 })
  @IsNumber()
  @Min(-10)
  @Max(10)
  @IsOptional()
  peso?: number;

  @ApiPropertyOptional({ description: 'Ordem de exibição', example: 1 })
  @IsNumber()
  @IsOptional()
  ordem?: number;

  @ApiPropertyOptional({ description: 'Referência da legislação', example: 'RDC 216/2004' })
  @IsString()
  @IsOptional()
  legislacaoReferencia?: string;

  @ApiPropertyOptional({ description: 'IDs das legislações cadastradas ligadas ao item (até 10)', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  legislacaoIds?: string[];

  @ApiPropertyOptional({ description: 'Artigo/inciso específico', example: 'Art. 4.1.3' })
  @IsString()
  @IsOptional()
  artigo?: string;

  @ApiPropertyOptional({ description: 'Texto legal completo' })
  @IsString()
  @IsOptional()
  textoLegal?: string;

  @ApiPropertyOptional({ description: 'Se o item é obrigatório', default: true })
  @IsBoolean()
  @IsOptional()
  obrigatorio?: boolean;

  @ApiPropertyOptional({
    description: 'Opções de resposta personalizadas',
    example: ['Conforme', 'Não Conforme', 'Parcialmente Conforme'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  opcoesResposta?: string[];

  @ApiPropertyOptional({ description: 'Permite anexar foto na pergunta', default: true })
  @IsBoolean()
  @IsOptional()
  permiteFoto?: boolean;

  @ApiPropertyOptional({ description: 'Permite observação na pergunta', default: true })
  @IsBoolean()
  @IsOptional()
  permiteObservacao?: boolean;

  @ApiPropertyOptional({ description: 'Usar respostas personalizadas ao invés das padrão', default: false })
  @IsBoolean()
  @IsOptional()
  usarRespostasPersonalizadas?: boolean;

  @ApiPropertyOptional({ description: 'Tipo de resposta customizada', enum: TipoRespostaCustomizada })
  @IsEnum(TipoRespostaCustomizada)
  @IsOptional()
  tipoRespostaCustomizada?: TipoRespostaCustomizada;

  @ApiPropertyOptional({ description: 'Configurações granulares de foto e observação por opção de resposta' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OpcaoRespostaConfigDto)
  opcoesRespostaConfig?: OpcaoRespostaConfigDto[];

  @ApiPropertyOptional({ description: 'ID do grupo ao qual o item pertence' })
  @IsString()
  @IsOptional()
  grupoId?: string;

  @ApiPropertyOptional({ description: 'Seção dentro do grupo', example: 'ÁREA DE LAVAGEM' })
  @IsString()
  @IsOptional()
  secao?: string;
}

/**
 * DTO para criar um grupo de checklist.
 */
export class CriarChecklistGrupoDto {
  @ApiProperty({ description: 'Nome do grupo', example: 'ESTRUTURA' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiPropertyOptional({ description: 'Descrição do grupo' })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Ordem de exibição', example: 1 })
  @IsNumber()
  @IsOptional()
  ordem?: number;
}

/**
 * DTO para criação de um template de checklist.
 */
export class CriarChecklistTemplateDto {
  @ApiProperty({ description: 'Nome do template', example: 'Checklist RDC 216 - Restaurantes' })
  @IsString()
  @IsNotEmpty()
  nome: string;

  @ApiPropertyOptional({ description: 'Descrição do template' })
  @IsString()
  @IsOptional()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Tipo de atividade', enum: TipoAtividade })
  @IsEnum(TipoAtividade)
  @IsOptional()
  tipoAtividade?: TipoAtividade;

  @ApiPropertyOptional({ description: 'Versão do template', example: '1.0' })
  @IsString()
  @IsOptional()
  versao?: string;

  @ApiPropertyOptional({ description: 'Itens do template', type: [CriarTemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriarTemplateItemDto)
  @IsOptional()
  itens?: CriarTemplateItemDto[];

  @ApiPropertyOptional({ description: 'Faixas de classificação da nota. Null = faixas padrão', type: [FaixaClassificacaoDto], nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.faixasClassificacao != null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaixaClassificacaoDto)
  faixasClassificacao?: FaixaClassificacaoDto[] | null;

  @ApiPropertyOptional({ description: 'Envia o relatório por e-mail ao finalizar a auditoria' })
  @IsBoolean()
  @IsOptional()
  enviarRelatorioAoFinalizar?: boolean;
}

