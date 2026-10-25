import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { IaService } from './ia.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para geração de texto.
 */
class GerarTextoDto {
  @ApiProperty({
    description: 'Descrição simples da não conformidade',
    example: 'Alimentos armazenados diretamente no piso da câmara fria',
  })
  @IsString()
  @IsNotEmpty()
  descricao: string;

  @ApiPropertyOptional({
    description: 'Tipo de estabelecimento',
    example: 'restaurante',
  })
  @IsString()
  @IsOptional()
  tipoEstabelecimento?: string;

  @ApiPropertyOptional({
    description: 'Legislações da pergunta, priorizadas no apoio da IA',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  legislacaoIds?: string[];
}

/**
 * DTO para geração de plano de ação.
 */
class GerarPlanoAcaoDto {
  @ApiProperty({ description: 'Descrição da não conformidade' })
  @IsString()
  @IsNotEmpty()
  descricaoNaoConformidade: string;

  @ApiPropertyOptional({
    description: 'Referência legal',
    example: 'RDC 216/2004, Art. 4.1.3',
  })
  @IsString()
  @IsOptional()
  referenciaLegal?: string;
}

/**
 * DTO para análise de imagem com contexto de checklist.
 */
class AnalisarImagemChecklistDto {
  @ApiProperty({ description: 'Pergunta do item do checklist' })
  @IsString()
  @IsNotEmpty()
  perguntaChecklist: string;

  @ApiPropertyOptional({ description: 'Categoria do item', example: 'armazenamento' })
  @IsString()
  @IsOptional()
  categoria?: string;

  @ApiPropertyOptional({ description: 'Tipo de estabelecimento', example: 'restaurante' })
  @IsString()
  @IsOptional()
  tipoEstabelecimento?: string;

  @ApiPropertyOptional({
    description: 'Legislações da pergunta, priorizadas no apoio da IA',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  legislacaoIds?: string[];
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Lê `legislacaoIds` de um corpo multipart: campo repetido, lista JSON ou separado por vírgula.
 * Valida UUIDs e o máximo de 10 (400 se inválido).
 */
export function lerLegislacaoIdsMultipart(valor: unknown): string[] | undefined {
  if (valor === undefined || valor === null || valor === '') return undefined;
  let lista: unknown[];
  if (Array.isArray(valor)) {
    lista = valor;
  } else if (typeof valor === 'string') {
    const texto = valor.trim();
    if (texto.startsWith('[')) {
      try {
        const json = JSON.parse(texto);
        lista = Array.isArray(json) ? json : [];
      } catch {
        throw new BadRequestException('legislacaoIds inválido');
      }
    } else {
      lista = texto.split(',').map((v) => v.trim()).filter(Boolean);
    }
  } else {
    throw new BadRequestException('legislacaoIds inválido');
  }
  if (lista.length > 10 || !lista.every((v) => typeof v === 'string' && UUID_V4.test(v))) {
    throw new BadRequestException('legislacaoIds inválido');
  }
  return lista as string[];
}

/**
 * Controller para integração com IA.
 */
@ApiTags('IA')
@Controller('ia')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IaController {
  constructor(private readonly iaService: IaService) {}

  @Post('analisar-imagem')
  @UseInterceptors(FileInterceptor('imagem'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Analisa uma imagem para detectar não conformidades' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagem: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem (JPEG, PNG, WebP)',
        },
        contexto: {
          type: 'string',
          description: 'Contexto da área fotografada',
          example: 'câmara fria',
        },
      },
      required: ['imagem'],
    },
  })
  @ApiResponse({ status: 200, description: 'Análise realizada' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido' })
  async analisarImagem(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('contexto') contexto?: string,
    @CurrentUser() usuario?: { id: string; perfil: any; gestorId?: string | null },
  ): Promise<{
    tipoNaoConformidade: string;
    descricao: string;
    gravidade: string;
    sugestoes: string[];
  }> {
    if (!file) {
      throw new BadRequestException('Arquivo de imagem é obrigatório');
    }
    const base64 = file.buffer.toString('base64');
    return this.iaService.analisarImagem(
      base64,
      contexto || 'área de produção',
      usuario,
    );
  }

  @Post('analisar-checklist')
  @UseInterceptors(FileInterceptor('imagem'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Analisa imagem no contexto de um item de checklist' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        imagem: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem (JPEG, PNG, WebP)',
        },
        perguntaChecklist: {
          type: 'string',
          description: 'Pergunta do item do checklist',
        },
        categoria: {
          type: 'string',
          description: 'Categoria do item',
        },
        tipoEstabelecimento: {
          type: 'string',
          description: 'Tipo de estabelecimento',
        },
        legislacaoIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Legislações da pergunta (opcional, até 10)',
        },
      },
      required: ['imagem', 'perguntaChecklist'],
    },
  })
  @ApiResponse({ status: 200, description: 'Análise realizada com contexto do checklist' })
  async analisarImagemChecklist(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('perguntaChecklist') perguntaChecklist: string,
    @Body('categoria') categoria?: string,
    @Body('tipoEstabelecimento') tipoEstabelecimento?: string,
    @CurrentUser() usuario?: { id: string; perfil: any; gestorId?: string | null },
    @Body('legislacaoIds') legislacaoIds?: unknown,
  ): Promise<{
    descricaoIa: string;
    tipoNaoConformidade: string;
    gravidade: string;
    sugestoes: string[];
    referenciaLegal: string;
    legislacaoIds: string[];
    imagemRelevante: boolean;
  }> {
    if (!file) {
      throw new BadRequestException('Arquivo de imagem é obrigatório');
    }
    if (!perguntaChecklist) {
      throw new BadRequestException('Pergunta do checklist é obrigatória');
    }
    const base64 = file.buffer.toString('base64');
    return this.iaService.analisarImagemChecklist(
      base64,
      perguntaChecklist,
      categoria || 'geral',
      tipoEstabelecimento || 'serviço de alimentação',
      usuario,
      { legislacaoIds: lerLegislacaoIdsMultipart(legislacaoIds) },
    );
  }

  @Post('gerar-texto')
  @ApiOperation({ summary: 'Gera texto técnico e plano de ação via RAG' })
  @ApiResponse({ status: 200, description: 'Texto gerado' })
  async gerarTexto(
    @Body() dto: GerarTextoDto,
    @CurrentUser() usuario?: { id: string; perfil: any; gestorId?: string | null },
  ): Promise<{
    descricaoTecnica: string;
    referenciaLegal: string;
    legislacaoIds: string[];
    riscoEnvolvido: string;
    planoAcao: {
      acoesCorretivas: string[];
      acoesPreventivas: string[];
      prazoSugerido: string;
      responsavelSugerido: string;
    };
  }> {
    return this.iaService.gerarTextoNaoConformidade(
      dto.descricao,
      dto.tipoEstabelecimento || 'serviço de alimentação',
      usuario,
      { legislacaoIds: dto.legislacaoIds },
    );
  }

  @Post('plano-acao')
  @ApiOperation({ summary: 'Gera plano de ação para não conformidade' })
  @ApiResponse({ status: 200, description: 'Plano de ação gerado' })
  async gerarPlanoAcao(
    @Body() dto: GerarPlanoAcaoDto,
    @CurrentUser() usuario?: { id: string; perfil: any; gestorId?: string | null },
  ): Promise<{
    acoesCorretivas: string[];
    acoesPreventivas: string[];
    prazoSugerido: string;
  }> {
    return this.iaService.gerarPlanoAcao(
      dto.descricaoNaoConformidade,
      dto.referenciaLegal || '',
      usuario,
    );
  }
}
