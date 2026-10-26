import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CriticidadeItem } from '../entities/template-item.entity';
import type { TipoRespostaLote } from '../checklist-regras';

export type { TipoRespostaLote };

export const TIPOS_RESPOSTA_LOTE: TipoRespostaLote[] = [
  'padrao',
  'personalizada',
  'texto',
  'numero',
  'data',
];

/** Mesmo limite de `auditoria_itens.resposta` (varchar 100), onde a resposta escolhida é gravada. */
export const TAMANHO_MAXIMO_OPCAO = 100;

export class OpcaoLoteDto {
  @IsString()
  @MaxLength(TAMANHO_MAXIMO_OPCAO, { message: 'Cada resposta pode ter até 100 caracteres' })
  valor: string;

  @ApiPropertyOptional({
    description:
      'Valor que a opção tinha antes da edição (ausente = opção nova). Usado para renomear respostas já dadas (RN-CHK-018)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(TAMANHO_MAXIMO_OPCAO)
  valorOriginal?: string;

  @ApiPropertyOptional({ description: 'Pontuação da opção (-10 a 10). Null = sem pontuação' })
  @ValidateIf((o) => o.pontuacao != null)
  @IsNumber()
  @Min(-10)
  @Max(10)
  @IsOptional()
  pontuacao?: number | null;

  @ApiPropertyOptional({ enum: ['positiva', 'negativa', 'neutra'] })
  @IsOptional()
  @IsIn(['positiva', 'negativa', 'neutra'])
  sentido?: 'positiva' | 'negativa' | 'neutra' | null;

  @ApiPropertyOptional({ description: 'Ícone da resposta (emoji ou código), até 32 caracteres' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  icone?: string | null;

  @IsBoolean()
  fotoObrigatoria: boolean;

  @IsBoolean()
  observacaoObrigatoria: boolean;
}

export class AlteracoesLoteDto {
  @ApiPropertyOptional({ enum: TIPOS_RESPOSTA_LOTE })
  @IsOptional()
  @IsIn(TIPOS_RESPOSTA_LOTE)
  tipoResposta?: TipoRespostaLote;

  @ApiPropertyOptional({ type: [OpcaoLoteDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpcaoLoteDto)
  opcoes?: OpcaoLoteDto[];

  @IsOptional()
  @IsBoolean()
  permiteFoto?: boolean;

  @IsOptional()
  @IsBoolean()
  permiteObservacao?: boolean;

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @ApiPropertyOptional({ enum: CriticidadeItem })
  @IsOptional()
  @IsEnum(CriticidadeItem)
  criticidade?: CriticidadeItem;
}

export class ConfigurarLoteDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  itemIds?: string[];

  @IsOptional()
  @IsUUID()
  grupoId?: string;

  @ApiProperty({ type: AlteracoesLoteDto })
  @ValidateNested()
  @Type(() => AlteracoesLoteDto)
  alteracoes: AlteracoesLoteDto;

  @ApiPropertyOptional({ description: 'Se true, apenas calcula o impacto sem salvar' })
  @IsOptional()
  @IsBoolean()
  simular?: boolean;
}

export interface ResultadoLote {
  totalAfetados: number;
  personalizadosSubstituidos: number;
  ignorados: number;
  auditoriasVinculadas: number;
  simulado: boolean;
  /** Respostas personalizadas atuais já usadas em auditorias (auditorias distintas por valor). */
  respostasEmUso: { valor: string; auditorias: number }[];
}
