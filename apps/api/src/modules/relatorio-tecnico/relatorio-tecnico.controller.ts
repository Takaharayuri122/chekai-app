import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';
import { CriarRelatorioTecnicoDto } from './dto/criar-relatorio-tecnico.dto';
import { IniciarRelatorioTecnicoDto } from './dto/iniciar-relatorio-tecnico.dto';
import { ListarRelatoriosTecnicosDto } from './dto/listar-relatorios-tecnicos.dto';
import { GerarApoioAnaliticoDto } from './dto/gerar-apoio-analitico.dto';
import { RelatorioTecnico } from './entities/relatorio-tecnico.entity';
import { RelatorioTecnicoService } from './relatorio-tecnico.service';
import { ComprimirImagemService } from '../auditoria/services/comprimir-imagem.service';
import { ExtrairExifService } from '../auditoria/services/extrair-exif.service';
import { RelatorioTecnicoPdfPuppeteerService } from './services/relatorio-tecnico-pdf-puppeteer.service';

@ApiTags('Relatórios Técnicos')
@Controller('relatorios-tecnicos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RelatorioTecnicoController {
  constructor(
    private readonly relatorioTecnicoService: RelatorioTecnicoService,
    private readonly comprimirImagemService: ComprimirImagemService,
    private readonly extrairExifService: ExtrairExifService,
    private readonly relatorioTecnicoPdfPuppeteerService: RelatorioTecnicoPdfPuppeteerService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo relatório técnico' })
  @ApiResponse({ status: 201, description: 'Relatório técnico criado com sucesso' })
  async criar(
    @Body() dto: CriarRelatorioTecnicoDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnico> {
    return this.relatorioTecnicoService.criar(dto, usuario);
  }

  @Post('iniciar')
  @ApiOperation({ summary: 'Pré-cria um relatório técnico com cliente e unidade' })
  @ApiResponse({ status: 201, description: 'Relatório técnico pré-criado com sucesso' })
  async iniciar(
    @Body() dto: IniciarRelatorioTecnicoDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; nome?: string },
  ): Promise<RelatorioTecnico> {
    return this.relatorioTecnicoService.iniciar(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Lista relatórios técnicos com paginação e filtros' })
  @ApiResponse({ status: 200, description: 'Relatórios técnicos listados com sucesso' })
  async listar(
    @Query() filtro: ListarRelatoriosTecnicosDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<PaginatedResult<RelatorioTecnico>> {
    return this.relatorioTecnicoService.listar(filtro, usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca relatório técnico por ID' })
  @ApiResponse({ status: 200, description: 'Relatório técnico encontrado' })
  async buscarPorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnico> {
    return this.relatorioTecnicoService.buscarPorId(id, usuario);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza um relatório técnico' })
  @ApiResponse({ status: 200, description: 'Relatório técnico atualizado com sucesso' })
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CriarRelatorioTecnicoDto>,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnico> {
    return this.relatorioTecnicoService.atualizar(id, dto, usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um relatório técnico' })
  @ApiResponse({ status: 200, description: 'Relatório técnico removido com sucesso' })
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<{ success: boolean }> {
    await this.relatorioTecnicoService.remover(id, usuario);
    return { success: true };
  }

  @Post(':id/fotos')
  @ApiOperation({ summary: 'Adiciona evidência fotográfica ao relatório técnico' })
  @ApiResponse({ status: 201, description: 'Foto adicionada com sucesso' })
  @UseInterceptors(FileInterceptor('file'))
  async adicionarFoto(
    @Param('id', ParseUUIDPipe) relatorioId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<{ id: string; url: string }> {
    if (!file) {
      throw new BadRequestException('Arquivo de imagem é obrigatório');
    }
    const mimeTypeEntrada = file.mimetype || 'image/jpeg';
    if (!mimeTypeEntrada.startsWith('image/')) {
      throw new BadRequestException('O arquivo deve ser uma imagem (JPEG, PNG, WebP, etc.)');
    }
    const exif = await this.extrairExifService.extrair(file.buffer);
    let resultado: {
      buffer: Buffer;
      mimeType: string;
    };
    try {
      resultado = await this.comprimirImagemService.comprimir(file.buffer, mimeTypeEntrada);
    } catch {
      throw new BadRequestException(
        'Não foi possível processar a imagem. Envie um arquivo de imagem válido (JPEG, PNG ou WebP).',
      );
    }
    const base64 = resultado.buffer.toString('base64');
    const dataUrl = `data:${resultado.mimeType};base64,${base64}`;
    const foto = await this.relatorioTecnicoService.adicionarFoto(
      relatorioId,
      {
        url: dataUrl,
        nomeOriginal: file.originalname,
        mimeType: resultado.mimeType,
        tamanhoBytes: resultado.buffer.length,
        exif: exif ?? undefined,
      },
      usuario,
    );
    return { id: foto.id, url: dataUrl };
  }

  @Delete(':id/fotos/:fotoId')
  @ApiOperation({ summary: 'Remove evidência fotográfica do relatório técnico' })
  @ApiResponse({ status: 200, description: 'Foto removida com sucesso' })
  async removerFoto(
    @Param('id', ParseUUIDPipe) relatorioId: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<{ success: boolean }> {
    await this.relatorioTecnicoService.removerFoto(relatorioId, fotoId, usuario);
    return { success: true };
  }

  @Post(':id/gerar-apoio-analitico')
  @ApiOperation({ summary: 'Atualiza apoio analítico do relatório técnico' })
  @ApiResponse({ status: 200, description: 'Apoio analítico atualizado com sucesso' })
  async gerarApoioAnalitico(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GerarApoioAnaliticoDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<RelatorioTecnico> {
    return this.relatorioTecnicoService.atualizarApoioAnalitico(id, dto.prompt, usuario);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Gera e retorna PDF do relatório técnico' })
  @ApiResponse({ status: 200, description: 'PDF gerado com sucesso' })
  async gerarPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
    @Res() res: Response,
  ): Promise<void> {
    const relatorio = await this.relatorioTecnicoService.buscarPorId(id, usuario);
    const pdfBuffer = await this.relatorioTecnicoPdfPuppeteerService.gerarPdf(relatorio);
    const pdfUrl = await this.relatorioTecnicoPdfPuppeteerService.salvarPdfNoStorage(
      relatorio.id,
      pdfBuffer,
    );
    await this.relatorioTecnicoService.atualizarPdfUrl(relatorio.id, pdfUrl, usuario);
    const nomeArquivo = `relatorio-tecnico-${relatorio.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.send(pdfBuffer);
  }
}
