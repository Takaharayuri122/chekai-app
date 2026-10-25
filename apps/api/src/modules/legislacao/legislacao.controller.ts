import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  Injectable,
  ExecutionContext,
  CallHandler,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LegislacaoService, LegislacaoListada, LegislacaoOpcao } from './legislacao.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PodeGerenciarLegislacoesGuard } from './guards/pode-gerenciar-legislacoes.guard';
import { Legislacao } from './entities/legislacao.entity';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { CriarLegislacaoDto } from './dto/criar-legislacao.dto';
import { AtualizarLegislacaoDto } from './dto/atualizar-legislacao.dto';
import { AlterarAtivoDto } from './dto/alterar-ativo.dto';
import { ListarLegislacoesQueryDto } from './dto/listar-legislacoes-query.dto';
import { AdicionarChunksDto, BuscaRagDto } from './dto/chunks.dto';
import { LerTextoDto } from './dto/ler-texto.dto';
import { LegislacaoLeituraService, UsuarioAutenticado } from './legislacao-leitura.service';
import { ehPdf } from './lib/extrair-texto';
import { nomeCurtoLegislacao } from './lib/nome-legislacao';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MSG_PDF = 'Envie um arquivo PDF de até 20 MB.';

/**
 * Upload do PDF da legislação (campo `arquivo`); arquivo acima de 20 MB vira 400 com a mensagem da tela.
 */
@Injectable()
class ArquivoPdfInterceptor extends FileInterceptor('arquivo', { limits: { fileSize: MAX_PDF_BYTES } }) {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await super.intercept(context, next);
    } catch (erro) {
      if (erro instanceof PayloadTooLargeException) {
        throw new BadRequestException(MSG_PDF);
      }
      throw erro;
    }
  }
}

/**
 * Controller para gestão de legislações e RAG.
 */
@ApiTags('Legislações')
@Controller('legislacoes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LegislacaoController {
  constructor(
    private readonly legislacaoService: LegislacaoService,
    private readonly leituraService: LegislacaoLeituraService,
  ) {}

  @Get('opcoes')
  @ApiOperation({ summary: 'Opções de legislações ativas para os seletores (qualquer usuário logado)' })
  @ApiResponse({ status: 200, description: 'Lista de opções' })
  async listarOpcoes(): Promise<LegislacaoOpcao[]> {
    return this.legislacaoService.listarOpcoes();
  }

  @Post()
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Cadastra uma legislação pelo link e inicia a leitura' })
  @ApiResponse({ status: 201, description: 'Legislação criada, leitura em andamento' })
  @ApiResponse({ status: 409, description: 'Link já cadastrado (traz o id da existente)' })
  async criarLegislacao(
    @Body() dto: CriarLegislacaoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<Legislacao> {
    return this.legislacaoService.criarLegislacao(dto, usuario);
  }

  @Post(':id/ler-novamente')
  @HttpCode(200)
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Lê de novo a legislação pelo link oficial' })
  @ApiResponse({ status: 200, description: 'Leitura iniciada' })
  async lerNovamente(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<Legislacao> {
    return this.leituraService.iniciar(id, usuario, { tipo: 'link' });
  }

  @Post(':id/arquivo')
  @HttpCode(200)
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @UseInterceptors(ArquivoPdfInterceptor)
  @ApiOperation({ summary: 'Lê a legislação a partir do PDF enviado' })
  @ApiResponse({ status: 200, description: 'Leitura iniciada' })
  async lerArquivo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() arquivo: Express.Multer.File,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<Legislacao> {
    if (!arquivo?.buffer?.length || arquivo.size > MAX_PDF_BYTES || !ehPdf(arquivo.buffer, null)) {
      throw new BadRequestException(MSG_PDF);
    }
    return this.leituraService.iniciar(id, usuario, { tipo: 'pdf', buffer: arquivo.buffer });
  }

  @Post(':id/texto')
  @HttpCode(200)
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Lê a legislação a partir do texto colado' })
  @ApiResponse({ status: 200, description: 'Leitura iniciada' })
  async lerTexto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LerTextoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<Legislacao> {
    return this.leituraService.iniciar(id, usuario, { tipo: 'texto', texto: dto.texto });
  }

  @Get()
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Lista as legislações' })
  @ApiResponse({ status: 200, description: 'Lista de legislações' })
  async listarLegislacoes(
    @Query() filtros: ListarLegislacoesQueryDto,
  ): Promise<LegislacaoListada[]> {
    return this.legislacaoService.listar(filtros);
  }

  @Get(':id')
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Busca uma legislação pelo ID' })
  @ApiResponse({ status: 200, description: 'Legislação encontrada' })
  async buscarLegislacaoPorId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Legislacao> {
    return this.legislacaoService.buscarLegislacaoPorId(id);
  }

  @Patch(':id/ativo')
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Ativa ou desativa uma legislação' })
  @ApiResponse({ status: 200, description: 'Situação alterada' })
  async alterarAtivo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AlterarAtivoDto,
  ): Promise<Legislacao> {
    return this.legislacaoService.alterarAtivo(id, dto.ativo);
  }

  @Put(':id')
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Atualiza uma legislação' })
  @ApiResponse({ status: 200, description: 'Legislação atualizada' })
  async atualizarLegislacao(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarLegislacaoDto,
  ): Promise<Legislacao> {
    return this.legislacaoService.atualizarLegislacao(id, dto);
  }

  @Delete(':id')
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Remove uma legislação' })
  @ApiResponse({ status: 200, description: 'Legislação removida' })
  async removerLegislacao(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.legislacaoService.remover(id);
    return { message: 'Legislação removida com sucesso' };
  }

  @Get(':id/chunks')
  @UseGuards(PodeGerenciarLegislacoesGuard)
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
  @UseGuards(PodeGerenciarLegislacoesGuard)
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
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Remove um chunk' })
  @ApiResponse({ status: 200, description: 'Chunk removido' })
  async removerChunk(
    @Param('chunkId', ParseUUIDPipe) chunkId: string,
  ): Promise<{ message: string }> {
    await this.legislacaoService.removerChunk(chunkId);
    return { message: 'Chunk removido com sucesso' };
  }

  @Post('rag/buscar')
  @UseGuards(PodeGerenciarLegislacoesGuard)
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
        referencia: `${nomeCurtoLegislacao(r.legislacao as Parameters<typeof nomeCurtoLegislacao>[0])}${r.chunk.artigo ? `, ${r.chunk.artigo}` : ''}`,
        similaridade: r.similaridade,
      })),
    };
  }

  @Post('rag/contexto')
  @UseGuards(PodeGerenciarLegislacoesGuard)
  @ApiOperation({ summary: 'Gera contexto RAG para uma query' })
  @ApiResponse({ status: 200, description: 'Contexto gerado' })
  async gerarContextoRag(
    @Body() dto: BuscaRagDto,
  ): Promise<{ contexto: string }> {
    const contexto = await this.legislacaoService.gerarContextoRag(dto.query);
    return { contexto };
  }
}

