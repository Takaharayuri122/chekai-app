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
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
  ): Promise<{
    descricaoIa: string;
    tipoNaoConformidade: string;
    gravidade: string;
    sugestoes: string[];
    referenciaLegal: string;
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
    );
  }

  @Post('gerar-texto')
  @ApiOperation({ summary: 'Gera texto técnico e plano de ação via RAG' })
  @ApiResponse({ status: 200, description: 'Texto gerado' })
  async gerarTexto(
    @Body() dto: GerarTextoDto,
  ): Promise<{
    descricaoTecnica: string;
    referenciaLegal: string;
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
    );
  }

  @Post('plano-acao')
  @ApiOperation({ summary: 'Gera plano de ação para não conformidade' })
  @ApiResponse({ status: 200, description: 'Plano de ação gerado' })
  async gerarPlanoAcao(
    @Body() dto: GerarPlanoAcaoDto,
  ): Promise<{
    acoesCorretivas: string[];
    acoesPreventivas: string[];
    prazoSugerido: string;
  }> {
    return this.iaService.gerarPlanoAcao(
      dto.descricaoNaoConformidade,
      dto.referenciaLegal || '',
    );
  }
}
