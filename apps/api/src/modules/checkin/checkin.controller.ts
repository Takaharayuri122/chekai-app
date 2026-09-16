import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { CheckinService, FiltrosCheckins, RelatorioHorasCheckin } from './checkin.service';
import { Checkin } from './entities/checkin.entity';
import { IniciarCheckinDto } from './dto/iniciar-checkin.dto';
import { FinalizarCheckinDto } from './dto/finalizar-checkin.dto';
import { ListarCheckinsDto } from './dto/listar-checkins.dto';
import { EditarCheckinDto } from './dto/editar-checkin.dto';
import { RelatorioHorasCheckinDto } from './dto/relatorio-horas-checkin.dto';
import { PaginatedResult } from '../../shared/types/pagination.interface';
import { CheckinRelatorioPdfService } from './checkin-relatorio-pdf.service';

interface UsuarioAutenticado {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
}

@ApiTags('Checkins')
@Controller('checkins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckinController {
  constructor(
    private readonly checkinService: CheckinService,
    private readonly checkinRelatorioPdfService: CheckinRelatorioPdfService,
  ) {}

  @Post('iniciar')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Inicia um checkin' })
  @ApiResponse({ status: 201, description: 'Checkin iniciado com sucesso' })
  async iniciar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: IniciarCheckinDto,
  ): Promise<Checkin> {
    return this.checkinService.iniciarCheckin(usuario, dto);
  }

  @Post(':id/finalizar')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Finaliza um checkin aberto' })
  @ApiResponse({ status: 200, description: 'Checkin finalizado com sucesso' })
  async finalizar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: FinalizarCheckinDto,
  ): Promise<Checkin> {
    return this.checkinService.finalizarCheckin(id, usuario, dto);
  }

  @Get('me/aberto')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Busca o checkin aberto do usuário atual' })
  @ApiResponse({ status: 200, description: 'Estado do checkin aberto retornado com sucesso' })
  async buscarAberto(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<{ checkin: Checkin | null; isAtrasado3h: boolean }> {
    return this.checkinService.buscarCheckinAbertoDoUsuario(usuario.id);
  }

  @Get('me/alertas')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
  @ApiOperation({ summary: 'Busca alerta de checkin aberto acima de 3 horas' })
  @ApiResponse({ status: 200, description: 'Alerta retornado com sucesso' })
  async buscarAlertas(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<{ possuiAlerta: boolean; mensagem: string | null; checkin: Checkin | null }> {
    return this.checkinService.buscarAlertaCheckinAberto(usuario.id);
  }

  @Get('filtros')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiOperation({ summary: 'Lista opções de filtro de auditores e clientes vinculados à conta' })
  @ApiResponse({ status: 200, description: 'Opções de filtro retornadas com sucesso' })
  async listarFiltros(
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<FiltrosCheckins> {
    return this.checkinService.listarFiltros(usuario);
  }

  @Get('relatorio-horas/pdf')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiOperation({ summary: 'Gera PDF do relatório de horas de check-in' })
  @ApiResponse({ status: 200, description: 'PDF gerado com sucesso' })
  async gerarPdfRelatorioHoras(
    @Query() filtro: RelatorioHorasCheckinDto,
    @CurrentUser() usuario: UsuarioAutenticado,
    @Res() res: Response,
  ): Promise<void> {
    const relatorio = await this.checkinService.relatorioHoras(filtro, usuario);
    const pdfBuffer = await this.checkinRelatorioPdfService.gerarPdf(relatorio);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="relatorio-horas-checkin.pdf"',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  @Get('relatorio-horas')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiOperation({ summary: 'Relatório de total de horas por cliente ou usuário' })
  @ApiResponse({ status: 200, description: 'Relatório retornado com sucesso' })
  async relatorioHoras(
    @Query() filtro: RelatorioHorasCheckinDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<RelatorioHorasCheckin> {
    return this.checkinService.relatorioHoras(filtro, usuario);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiOperation({ summary: 'Lista checkins com filtros por auditor, período e cliente' })
  @ApiResponse({ status: 200, description: 'Lista de checkins retornada com sucesso' })
  async listar(
    @Query() filtro: ListarCheckinsDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedResult<Checkin>> {
    return this.checkinService.listarCheckins(filtro, usuario);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiOperation({ summary: 'Edita datas e comentário de um checkin' })
  @ApiResponse({ status: 200, description: 'Checkin atualizado com sucesso' })
  async editar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
    @Body() dto: EditarCheckinDto,
  ): Promise<Checkin> {
    return this.checkinService.editarCheckin(id, usuario, dto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiOperation({ summary: 'Busca detalhes de um checkin' })
  @ApiResponse({ status: 200, description: 'Detalhes do checkin retornados com sucesso' })
  async buscarPorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<Checkin> {
    return this.checkinService.buscarCheckinPorId(id, usuario);
  }
}
