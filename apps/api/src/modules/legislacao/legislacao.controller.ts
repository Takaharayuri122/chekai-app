import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LegislacaoService } from './legislacao.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Legislacao, TipoLegislacao } from './entities/legislacao.entity';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criar legislação.
 */
class CriarLegislacaoDto {
  @ApiProperty({ enum: TipoLegislacao })
  @IsEnum(TipoLegislacao)
  tipo: TipoLegislacao;

  @ApiProperty({ example: '216' })
  @IsString()
  @IsNotEmpty()
  numero: string;

  @ApiProperty({ example: 2004 })
  @IsNumber()
  ano: number;

  @ApiProperty({ example: 'Boas Práticas para Serviços de Alimentação' })
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ementa?: string;

  @ApiPropertyOptional({ example: 'ANVISA' })
  @IsString()
  @IsOptional()
  orgaoEmissor?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  linkOficial?: string;
}

/**
 * DTO para atualizar legislação.
 */
class AtualizarLegislacaoDto {
  @ApiPropertyOptional({ enum: TipoLegislacao })
  @IsEnum(TipoLegislacao)
  @IsOptional()
  tipo?: TipoLegislacao;

  @ApiPropertyOptional({ example: '216' })
  @IsString()
  @IsOptional()
  numero?: string;

  @ApiPropertyOptional({ example: 2004 })
  @IsNumber()
  @IsOptional()
  ano?: number;

  @ApiPropertyOptional({ example: 'Boas Práticas para Serviços de Alimentação' })
  @IsString()
  @IsOptional()
  titulo?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ementa?: string;

  @ApiPropertyOptional({ example: 'ANVISA' })
  @IsString()
  @IsOptional()
  orgaoEmissor?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  linkOficial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  ativo?: boolean;
}

/**
 * DTO para adicionar chunk.
 */
class AdicionarChunkDto {
  @ApiProperty({ example: 'O armazenamento de alimentos deve ser...' })
  @IsString()
  @IsNotEmpty()
  conteudo: string;

  @ApiPropertyOptional({ example: 'Art. 5º' })
  @IsString()
  @IsOptional()
  artigo?: string;

  @ApiPropertyOptional({ example: 'I' })
  @IsString()
  @IsOptional()
  inciso?: string;

  @ApiPropertyOptional({ example: '§1º' })
  @IsString()
  @IsOptional()
  paragrafo?: string;
}

/**
 * DTO para adicionar múltiplos chunks.
 */
class AdicionarChunksDto {
  @ApiProperty({ type: [AdicionarChunkDto] })
  chunks: AdicionarChunkDto[];
}

/**
 * DTO para busca RAG.
 */
class BuscaRagDto {
  @ApiProperty({ example: 'armazenamento de alimentos na câmara fria' })
  @IsString()
  @IsNotEmpty()
  query: string;
}

/**
 * Controller para gestão de legislações e RAG.
 */
@ApiTags('Legislações')
@Controller('legislacoes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LegislacaoController {
  constructor(private readonly legislacaoService: LegislacaoService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma nova legislação' })
  @ApiResponse({ status: 201, description: 'Legislação criada' })
  async criarLegislacao(@Body() dto: CriarLegislacaoDto): Promise<Legislacao> {
    return this.legislacaoService.criarLegislacao(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todas as legislações' })
  @ApiResponse({ status: 200, description: 'Lista de legislações' })
  async listarLegislacoes(): Promise<Legislacao[]> {
    return this.legislacaoService.listarLegislacoes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma legislação pelo ID' })
  @ApiResponse({ status: 200, description: 'Legislação encontrada' })
  async buscarLegislacaoPorId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Legislacao> {
    return this.legislacaoService.buscarLegislacaoPorId(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza uma legislação' })
  @ApiResponse({ status: 200, description: 'Legislação atualizada' })
  async atualizarLegislacao(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarLegislacaoDto,
  ): Promise<Legislacao> {
    return this.legislacaoService.atualizarLegislacao(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma legislação' })
  @ApiResponse({ status: 200, description: 'Legislação removida' })
  async removerLegislacao(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.legislacaoService.removerLegislacao(id);
    return { message: 'Legislação removida com sucesso' };
  }

  @Get(':id/chunks')
  @ApiOperation({ summary: 'Lista chunks de uma legislação' })
  @ApiResponse({ status: 200, description: 'Lista de chunks' })
  async listarChunks(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string; conteudo: string; artigo?: string; ordem: number }[]> {
    const chunks = await this.legislacaoService.listarChunks(id);
    return chunks.map((c) => ({
      id: c.id,
      conteudo: c.conteudo,
      artigo: c.artigo,
      inciso: c.inciso,
      paragrafo: c.paragrafo,
      ordem: c.ordem,
    }));
  }

  @Post(':id/chunks')
  @ApiOperation({ summary: 'Adiciona chunks a uma legislação' })
  @ApiResponse({ status: 201, description: 'Chunks adicionados' })
  async adicionarChunks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdicionarChunksDto,
  ): Promise<{ message: string }> {
    await this.legislacaoService.adicionarChunks(id, dto.chunks);
    return { message: 'Chunks adicionados com sucesso' };
  }

  @Delete('chunks/:chunkId')
  @ApiOperation({ summary: 'Remove um chunk' })
  @ApiResponse({ status: 200, description: 'Chunk removido' })
  async removerChunk(
    @Param('chunkId', ParseUUIDPipe) chunkId: string,
  ): Promise<{ message: string }> {
    await this.legislacaoService.removerChunk(chunkId);
    return { message: 'Chunk removido com sucesso' };
  }

  @Post('rag/buscar')
  @ApiOperation({ summary: 'Busca legislações similares via RAG' })
  @ApiResponse({ status: 200, description: 'Chunks similares encontrados' })
  async buscarSimilares(
    @Body() dto: BuscaRagDto,
    @Query('limite') limite = 5,
  ): Promise<{
    chunks: Array<{
      conteudo: string;
      referencia: string;
      similaridade: number;
    }>;
  }> {
    const resultados = await this.legislacaoService.buscarChunksSimilares(
      dto.query,
      limite,
    );
    return {
      chunks: resultados.map((r) => ({
        conteudo: r.chunk.conteudo,
        referencia: `${r.legislacao.tipo.toUpperCase()} ${r.legislacao.numero}/${r.legislacao.ano}${r.chunk.artigo ? `, ${r.chunk.artigo}` : ''}`,
        similaridade: r.similaridade,
      })),
    };
  }

  @Post('rag/contexto')
  @ApiOperation({ summary: 'Gera contexto RAG para uma query' })
  @ApiResponse({ status: 200, description: 'Contexto gerado' })
  async gerarContextoRag(
    @Body() dto: BuscaRagDto,
  ): Promise<{ contexto: string }> {
    const contexto = await this.legislacaoService.gerarContextoRag(dto.query);
    return { contexto };
  }
}

