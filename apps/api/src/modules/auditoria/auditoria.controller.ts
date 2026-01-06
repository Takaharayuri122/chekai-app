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
import { AuditoriaService } from './auditoria.service';
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
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Inicia uma nova auditoria' })
  @ApiResponse({ status: 201, description: 'Auditoria iniciada' })
  async iniciarAuditoria(
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
    @Body() dto: IniciarAuditoriaDto,
  ): Promise<Auditoria> {
    return this.auditoriaService.iniciarAuditoria(usuario.id, dto);
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

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma auditoria pelo ID' })
  @ApiResponse({ status: 200, description: 'Auditoria encontrada' })
  async buscarAuditoriaPorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<Auditoria> {
    return this.auditoriaService.buscarAuditoriaPorId(id, usuario);
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
    // Converte para base64 data URL para armazenamento
    const mimeType = file.mimetype || 'image/jpeg';
    const base64 = file.buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const foto = await this.auditoriaService.adicionarFoto(itemId, {
      url: dataUrl,
      nomeOriginal: file.originalname,
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

  @Put(':id/finalizar')
  @ApiOperation({ summary: 'Finaliza a auditoria' })
  @ApiResponse({ status: 200, description: 'Auditoria finalizada' })
  async finalizarAuditoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizarAuditoriaDto,
  ): Promise<Auditoria> {
    return this.auditoriaService.finalizarAuditoria(id, dto);
  }

  @Get(':id/nao-conformes')
  @ApiOperation({ summary: 'Lista itens não conformes da auditoria' })
  @ApiResponse({ status: 200, description: 'Itens não conformes' })
  async buscarItensNaoConformes(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuditoriaItem[]> {
    return this.auditoriaService.buscarItensNaoConformes(id);
  }
}

