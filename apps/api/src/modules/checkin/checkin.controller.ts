import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { CheckinService } from './checkin.service';
import { Checkin } from './entities/checkin.entity';
import { IniciarCheckinDto } from './dto/iniciar-checkin.dto';
import { FinalizarCheckinDto } from './dto/finalizar-checkin.dto';

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
  constructor(private readonly checkinService: CheckinService) {}

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
}
