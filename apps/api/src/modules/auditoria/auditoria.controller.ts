import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import {
  IniciarAuditoriaDto,
  ResponderItemDto,
  FinalizarAuditoriaDto,
} from './dto/criar-auditoria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Auditoria } from './entities/auditoria.entity';
import { AuditoriaItem } from './entities/auditoria-item.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';

interface AuthenticatedRequest {
  user: { id: string; email: string; perfil: string };
}

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
  @ApiOperation({ summary: 'Inicia uma nova auditoria' })
  @ApiResponse({ status: 201, description: 'Auditoria iniciada' })
  async iniciarAuditoria(
    @Request() req: AuthenticatedRequest,
    @Body() dto: IniciarAuditoriaDto,
  ): Promise<Auditoria> {
    return this.auditoriaService.iniciarAuditoria(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista auditorias do consultor' })
  @ApiResponse({ status: 200, description: 'Lista de auditorias' })
  async listarAuditorias(
    @Request() req: AuthenticatedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedResult<Auditoria>> {
    return this.auditoriaService.listarAuditoriasPorConsultor(req.user.id, {
      page,
      limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma auditoria pelo ID' })
  @ApiResponse({ status: 200, description: 'Auditoria encontrada' })
  async buscarAuditoriaPorId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Auditoria> {
    return this.auditoriaService.buscarAuditoriaPorId(id);
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
  async adicionarFoto(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() fotoData: { url: string; latitude?: number; longitude?: number },
  ): Promise<{ id: string }> {
    const foto = await this.auditoriaService.adicionarFoto(itemId, fotoData);
    return { id: foto.id };
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

