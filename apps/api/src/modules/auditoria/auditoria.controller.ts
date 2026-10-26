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
  Logger,
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
import { AuditoriaService } from './auditoria.service';
import { EnvioRelatorioService } from './services/envio-relatorio.service';
import { EnviarRelatorioDto } from './dto/enviar-relatorio.dto';
import { AuditoriaEnvioRelatorio } from './entities/auditoria-envio-relatorio.entity';
import { RelatorioAuditoriaPdfService } from './services/relatorio-auditoria-pdf.service';
import { ResultadoAuditoriaService, ResultadoAuditoria } from './services/resultado-auditoria.service';
import { ComprimirImagemService } from './services/comprimir-imagem.service';
import { ExtrairExifService } from './services/extrair-exif.service';
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
import { Auditoria, StatusAuditoria } from './entities/auditoria.entity';
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
  private readonly logger = new Logger(AuditoriaController.name);

  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly envioRelatorioService: EnvioRelatorioService,
    private readonly relatorioAuditoriaPdfService: RelatorioAuditoriaPdfService,
    private readonly resultadoAuditoriaService: ResultadoAuditoriaService,
    private readonly comprimirImagemService: ComprimirImagemService,
    private readonly extrairExifService: ExtrairExifService,
  ) {}

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
    @Query('clienteId', new ParseUUIDPipe({ optional: true })) clienteId?: string,
  ): Promise<PaginatedResult<Auditoria>> {
    return this.auditoriaService.listarAuditorias(
      { page, limit },
      usuario,
      clienteId,
    );
  }

  @Get('historico-unidade/:unidadeId')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Lista histórico de auditorias finalizadas da unidade (evolução)' })
  @ApiResponse({ status: 200, description: 'Lista de auditorias finalizadas ordenadas por data' })
  async listarHistoricoUnidade(
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
    @Param('unidadeId', ParseUUIDPipe) unidadeId: string,
    @Query('templateId', new ParseUUIDPipe({ optional: true })) templateId?: string,
  ): Promise<Auditoria[]> {
    return this.auditoriaService.listarHistoricoPorUnidade(unidadeId, usuario, templateId);
  }

  @Put(':id/itens/:itemId')
  @ApiOperation({ summary: 'Responde um item da auditoria' })
  @ApiResponse({ status: 200, description: 'Item respondido' })
  async responderItem(
    @Param('id', ParseUUIDPipe) auditoriaId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ResponderItemDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<AuditoriaItem> {
    return this.auditoriaService.responderItem(auditoriaId, itemId, dto, usuario);
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
    @Param('id', ParseUUIDPipe) auditoriaId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { latitude?: string; longitude?: string },
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
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
    const foto = await this.auditoriaService.adicionarFoto(auditoriaId, itemId, {
      url: dataUrl,
      nomeOriginal: file.originalname,
      mimeType: resultado.mimeType,
      tamanhoBytes: resultado.buffer.length,
      exif: exif ?? undefined,
      latitude: body.latitude ? parseFloat(body.latitude) : undefined,
      longitude: body.longitude ? parseFloat(body.longitude) : undefined,
    }, usuario);
    return { id: foto.id, url: dataUrl };
  }

  @Delete(':id/itens/:itemId/fotos/:fotoId')
  @ApiOperation({ summary: 'Remove uma foto do item' })
  @ApiResponse({ status: 200, description: 'Foto removida' })
  async removerFoto(
    @Param('id', ParseUUIDPipe) auditoriaId: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<{ success: boolean }> {
    await this.auditoriaService.removerFoto(auditoriaId, fotoId, usuario);
    return { success: true };
  }

  @Put(':id/itens/:itemId/fotos/:fotoId/analise')
  @ApiOperation({ summary: 'Atualiza a análise de IA de uma foto' })
  @ApiResponse({ status: 200, description: 'Análise atualizada' })
  async atualizarAnaliseFoto(
    @Param('id', ParseUUIDPipe) auditoriaId: string,
    @Param('fotoId', ParseUUIDPipe) fotoId: string,
    @Body() body: { analiseIa: string },
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<{ success: boolean }> {
    await this.auditoriaService.atualizarAnaliseFoto(auditoriaId, fotoId, body.analiseIa, usuario);
    return { success: true };
  }

  @Put(':id/finalizar')
  @ApiOperation({ summary: 'Finaliza a auditoria' })
  @ApiResponse({ status: 200, description: 'Auditoria finalizada' })
  async finalizarAuditoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizarAuditoriaDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<Auditoria> {
    const auditoria = await this.auditoriaService.finalizarAuditoria(id, dto, usuario);
    // Envio automático em segundo plano: não atrasa nem derruba a resposta da finalização.
    if (auditoria.template?.enviarRelatorioAoFinalizar) {
      void this.envioRelatorioService
        .enviar(auditoria.id, { automatico: true })
        .catch((e) => this.logger.error(`Falha no envio automático do relatório da auditoria ${auditoria.id}`, e instanceof Error ? e.stack : String(e)));
    }
    return auditoria;
  }

  @Post(':id/enviar-relatorio')
  @ApiOperation({ summary: 'Envia o relatório da auditoria finalizada por e-mail' })
  @ApiResponse({ status: 201, description: 'Registro da tentativa de envio' })
  @ApiResponse({ status: 400, description: 'Auditoria não está finalizada ou e-mails inválidos' })
  async enviarRelatorio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarRelatorioDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<AuditoriaEnvioRelatorio> {
    const auditoria = await this.auditoriaService.buscarAuditoriaPorId(id, usuario);
    if (auditoria.status !== StatusAuditoria.FINALIZADA) {
      throw new BadRequestException('Apenas auditorias finalizadas podem ter o relatório enviado');
    }
    return this.envioRelatorioService.enviar(id, { destinatarios: dto.destinatarios, usuario, automatico: false });
  }

  @Get(':id/envios-relatorio')
  @ApiOperation({ summary: 'Lista os envios do relatório da auditoria, do mais recente ao mais antigo' })
  @ApiResponse({ status: 200, description: 'Envios registrados' })
  async listarEnviosRelatorio(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<AuditoriaEnvioRelatorio[]> {
    await this.auditoriaService.buscarAuditoriaPorId(id, usuario);
    return this.envioRelatorioService.listar(id);
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

  @Get(':id/resultado')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Resultado da auditoria: nota, classificação, tendência e métricas por grupo' })
  @ApiResponse({ status: 200, description: 'Cartão de resultado da auditoria' })
  async obterResultado(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<ResultadoAuditoria> {
    const auditoria = await this.auditoriaService.buscarAuditoriaPorId(id, usuario);
    return this.resultadoAuditoriaService.calcular(auditoria, usuario);
  }

  @Get(':id/nao-conformes')
  @ApiOperation({ summary: 'Lista itens não conformes da auditoria' })
  @ApiResponse({ status: 200, description: 'Itens não conformes' })
  async buscarItensNaoConformes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<AuditoriaItem[]> {
    return this.auditoriaService.buscarItensNaoConformes(id, usuario);
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
    const { buffer: pdfBuffer, auditoria } = await this.relatorioAuditoriaPdfService.obterPdf(id, usuario);

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

