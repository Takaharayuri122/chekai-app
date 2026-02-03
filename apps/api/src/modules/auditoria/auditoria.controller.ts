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
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from './auditoria.service';
import { RelatorioPdfPuppeteerService } from './services/relatorio-pdf-puppeteer.service';
import { ComprimirImagemService } from './services/comprimir-imagem.service';
import { ExtrairExifService } from './services/extrair-exif.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  IniciarAuditoriaDto,
  ResponderItemDto,
  FinalizarAuditoriaDto,
} from './dto/criar-auditoria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Auditoria } from './entities/auditoria.entity';
import { AuditoriaItem } from './entities/auditoria-item.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';

/**
 * Controller para gestão de auditorias.
 */
@ApiTags('Auditorias')
@Controller('auditorias')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditoriaController {
  private readonly bucketName: string;

  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly relatorioPdfPuppeteerService: RelatorioPdfPuppeteerService,
    private readonly comprimirImagemService: ComprimirImagemService,
    private readonly extrairExifService: ExtrairExifService,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.bucketName =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET_RELATORIOS') ||
      'relatorios';
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Inicia uma nova auditoria' })
  @ApiResponse({ status: 201, description: 'Auditoria iniciada' })
  async iniciarAuditoria(
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
    @Body() dto: IniciarAuditoriaDto,
  ): Promise<Auditoria> {
    return this.auditoriaService.iniciarAuditoria(usuario.id, dto, usuario);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Lista auditorias' })
  @ApiResponse({ status: 200, description: 'Lista de auditorias' })
  async listarAuditorias(
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedResult<Auditoria>> {
    return this.auditoriaService.listarAuditorias(
      { page, limit },
      usuario,
    );
  }

  @Put(':id/itens/:itemId')
  @ApiOperation({ summary: 'Responde um item da auditoria' })
  @ApiResponse({ status: 200, description: 'Item respondido' })
  async responderItem(
    @Param('id', ParseUUIDPipe) auditoriaId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ResponderItemDto,
  ): Promise<AuditoriaItem> {
    return this.auditoriaService.responderItem(auditoriaId, itemId, dto);
  }

  @Post(':id/itens/:itemId/fotos')
  @ApiOperation({ summary: 'Adiciona uma foto ao item' })
  @ApiResponse({ status: 201, description: 'Foto adicionada' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async adicionarFoto(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { latitude?: string; longitude?: string },
  ): Promise<{ id: string; url: string }> {
    if (!file) {
      throw new BadRequestException('Arquivo de imagem é obrigatório');
    }
    const mimeTypeEntrada = file.mimetype || 'image/jpeg';
    if (!mimeTypeEntrada.startsWith('image/')) {
      throw new BadRequestException('O arquivo deve ser uma imagem (JPEG, PNG, WebP, etc.)');
    }
    const exif = await this.extrairExifService.extrair(file.buffer);
    let resultado;
    try {
      resultado = await this.comprimirImagemService.comprimir(file.buffer, mimeTypeEntrada);
    } catch {
      throw new BadRequestException(
        'Não foi possível processar a imagem. Envie um arquivo de imagem válido (JPEG, PNG ou WebP).',
      );
    }
    const base64 = resultado.buffer.toString('base64');
    const dataUrl = `data:${resultado.mimeType};base64,${base64}`;
    const foto = await this.auditoriaService.adicionarFoto(itemId, {
      url: dataUrl,
      nomeOriginal: file.originalname,
      mimeType: resultado.mimeType,
      tamanhoBytes: resultado.buffer.length,
      exif: exif ?? undefined,
      latitude: body.latitude ? parseFloat(body.latitude) : undefined,
      longitude: body.longitude ? parseFloat(body.longitude) : undefined,
    });
    return { id: foto.id, url: dataUrl };
  }

  @Delete(':id/itens/:itemId/fotos/:fotoId')
  @ApiOperation({ summary: 'Remove uma foto do item' })
  @ApiResponse({ status: 200, description: 'Foto removida' })
  async removerFoto(
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
  ): Promise<{ success: boolean }> {
    await this.auditoriaService.removerFoto(fotoId);
    return { success: true };
  }

  @Put(':id/itens/:itemId/fotos/:fotoId/analise')
  @ApiOperation({ summary: 'Atualiza a análise de IA de uma foto' })
  @ApiResponse({ status: 200, description: 'Análise atualizada' })
  async atualizarAnaliseFoto(
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
    @Body() body: { analiseIa: string },
  ): Promise<{ success: boolean }> {
    await this.auditoriaService.atualizarAnaliseFoto(fotoId, body.analiseIa);
    return { success: true };
  }

  @Put(':id/finalizar')
  @ApiOperation({ summary: 'Finaliza a auditoria' })
  @ApiResponse({ status: 200, description: 'Auditoria finalizada' })
  async finalizarAuditoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizarAuditoriaDto,
  ): Promise<Auditoria> {
    return this.auditoriaService.finalizarAuditoria(id, dto);
  }

  @Put(':id/reabrir')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Reabre uma auditoria finalizada' })
  @ApiResponse({ status: 200, description: 'Auditoria reaberta' })
  @ApiResponse({ status: 400, description: 'Auditoria não está finalizada' })
  async reabrirAuditoria(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<Auditoria> {
    return this.auditoriaService.reabrirAuditoria(id, usuario);
  }

  @Get(':id/nao-conformes')
  @ApiOperation({ summary: 'Lista itens não conformes da auditoria' })
  @ApiResponse({ status: 200, description: 'Itens não conformes' })
  async buscarItensNaoConformes(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuditoriaItem[]> {
    return this.auditoriaService.buscarItensNaoConformes(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiOperation({ summary: 'Remove uma auditoria' })
  @ApiResponse({ status: 200, description: 'Auditoria removida com sucesso' })
  @ApiResponse({ status: 403, description: 'Acesso negado. Apenas gestores podem remover auditorias.' })
  async removerAuditoria(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<{ success: boolean }> {
    await this.auditoriaService.removerAuditoria(id, usuario);
    return { success: true };
  }

  @Get(':id/resumo-executivo')
  @ApiOperation({ summary: 'Gera resumo executivo de uma auditoria finalizada usando IA' })
  @ApiResponse({ status: 200, description: 'Resumo executivo gerado' })
  @ApiResponse({ status: 400, description: 'Auditoria não está finalizada' })
  async gerarResumoExecutivo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<{
    resumo: string;
    pontosFortes: string[];
    pontosFracos: string[];
    recomendacoesPrioritarias: string[];
    riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
    tendencias: string[];
  }> {
    return this.auditoriaService.gerarResumoExecutivo(id, usuario);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Gera ou retorna PDF do relatório de auditoria' })
  @ApiResponse({ status: 200, description: 'PDF gerado/recuperado com sucesso', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 400, description: 'Auditoria não está finalizada' })
  async gerarPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
    @Res() res: Response,
  ): Promise<void> {
    const auditoria = await this.auditoriaService.buscarAuditoriaPorId(id, usuario);

    if (auditoria.status !== 'finalizada') {
      throw new BadRequestException('Apenas auditorias finalizadas podem gerar PDF');
    }

    const pdfGeradoEm = auditoria.pdfGeradoEm ? new Date(auditoria.pdfGeradoEm) : null;
    const atualizadoEm = auditoria.atualizadoEm ? new Date(auditoria.atualizadoEm) : null;
    const auditoriaAlteradaAposPdf =
      !pdfGeradoEm || (atualizadoEm && atualizadoEm.getTime() > pdfGeradoEm.getTime());

    let pdfBuffer: Buffer;
    let pdfUrl = auditoria.pdfUrl;

    if (auditoriaAlteradaAposPdf) {
      pdfBuffer = await this.relatorioPdfPuppeteerService.gerarPdf(auditoria);
      pdfUrl = await this.relatorioPdfPuppeteerService.salvarPdfNoStorage(id, pdfBuffer);
      await this.auditoriaService.atualizarPdfUrl(id, pdfUrl);
    } else {
      const pdfExistenteNoBucket = await this.relatorioPdfPuppeteerService.verificarPdfExistente(id);

      if (pdfExistenteNoBucket) {
        const supabase = this.supabaseService.getClient();
        const urlParts = pdfExistenteNoBucket.split(`/storage/v1/object/public/${this.bucketName}/`);
        const filePath = urlParts.length > 1 ? urlParts[1] : null;

        if (filePath) {
          const { data, error } = await supabase.storage
            .from(this.bucketName)
            .download(filePath);

          if (!error && data) {
            pdfBuffer = Buffer.from(await data.arrayBuffer());
            pdfUrl = pdfExistenteNoBucket;
            if (!auditoria.pdfUrl || auditoria.pdfUrl !== pdfExistenteNoBucket) {
              await this.auditoriaService.atualizarPdfUrl(id, pdfExistenteNoBucket);
            }
          } else {
            pdfBuffer = await this.relatorioPdfPuppeteerService.gerarPdf(auditoria);
            pdfUrl = await this.relatorioPdfPuppeteerService.salvarPdfNoStorage(id, pdfBuffer);
            await this.auditoriaService.atualizarPdfUrl(id, pdfUrl);
          }
        } else {
          pdfBuffer = await this.relatorioPdfPuppeteerService.gerarPdf(auditoria);
          pdfUrl = await this.relatorioPdfPuppeteerService.salvarPdfNoStorage(id, pdfBuffer);
          await this.auditoriaService.atualizarPdfUrl(id, pdfUrl);
        }
      } else if (pdfUrl) {
        const supabase = this.supabaseService.getClient();
        const urlParts = pdfUrl.split(`/storage/v1/object/public/${this.bucketName}/`);
        const filePath = urlParts.length > 1 ? urlParts[1] : null;

        if (filePath) {
          const { data, error } = await supabase.storage
            .from(this.bucketName)
            .download(filePath);

          if (!error && data) {
            pdfBuffer = Buffer.from(await data.arrayBuffer());
          } else {
            pdfBuffer = await this.relatorioPdfPuppeteerService.gerarPdf(auditoria);
            pdfUrl = await this.relatorioPdfPuppeteerService.salvarPdfNoStorage(id, pdfBuffer);
            await this.auditoriaService.atualizarPdfUrl(id, pdfUrl);
          }
        } else {
          pdfBuffer = await this.relatorioPdfPuppeteerService.gerarPdf(auditoria);
          pdfUrl = await this.relatorioPdfPuppeteerService.salvarPdfNoStorage(id, pdfBuffer);
          await this.auditoriaService.atualizarPdfUrl(id, pdfUrl);
        }
      } else {
        pdfBuffer = await this.relatorioPdfPuppeteerService.gerarPdf(auditoria);
        pdfUrl = await this.relatorioPdfPuppeteerService.salvarPdfNoStorage(id, pdfBuffer);
        await this.auditoriaService.atualizarPdfUrl(id, pdfUrl);
      }
    }
    
    const nomeArquivo = `relatorio-auditoria-${auditoria.unidade?.nome || 'unidade'}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Validar buffer antes de enviar
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new BadRequestException('Erro ao gerar PDF: buffer vazio');
    }
    
    // Validar que é um PDF válido (deve começar com %PDF)
    if (pdfBuffer.toString('utf8', 0, 4) !== '%PDF') {
      console.error(`PDF inválido gerado para auditoria ${id}. Primeiros bytes: ${pdfBuffer.toString('hex', 0, 20)}`);
      throw new BadRequestException('Erro ao gerar PDF: arquivo corrompido');
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache');
    
    res.send(pdfBuffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma auditoria pelo ID' })
  @ApiResponse({ status: 200, description: 'Auditoria encontrada' })
  async buscarAuditoriaPorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<Auditoria> {
    return this.auditoriaService.buscarAuditoriaPorId(id, usuario);
  }
}

