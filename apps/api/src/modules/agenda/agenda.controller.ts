import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';
import { AgendaAuditoria } from './entities/agenda-auditoria.entity';
import { AgendaService } from './agenda.service';
import { AtualizarAgendaDto, CriarAgendaDto, ListarAgendaDto } from './dto/agenda.dto';

interface UsuarioAutenticado {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
}

@ApiTags('Agenda')
@Controller('agenda')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
@ApiBearerAuth()
export class AgendaController {
  constructor(private readonly service: AgendaService) {}

  @Post()
  @ApiOperation({ summary: 'Agenda uma auditoria' })
  criar(@Body() dto: CriarAgendaDto, @CurrentUser() usuario: UsuarioAutenticado): Promise<AgendaAuditoria> {
    return this.service.criar(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Lista agendamentos' })
  listar(
    @Query() filtros: ListarAgendaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedResult<AgendaAuditoria>> {
    return this.service.listar(filtros, usuario);
  }

  @Post(':id/concluir')
  @ApiOperation({ summary: 'Marca como realizada e gera a próxima ocorrência se recorrente' })
  concluir(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<AgendaAuditoria> {
    return this.service.concluir(id, usuario);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza agendamento' })
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarAgendaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<AgendaAuditoria> {
    return this.service.atualizar(id, dto, usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove agendamento' })
  remover(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() usuario: UsuarioAutenticado): Promise<void> {
    return this.service.remover(id, usuario);
  }
}
