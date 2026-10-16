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
import { PlanoAcaoTarefa } from './entities/plano-acao-tarefa.entity';
import { PlanoAcaoService, ResumoPlanoAcao } from './plano-acao.service';
import {
  AtualizarTarefaPlanoAcaoDto,
  CriarTarefaPlanoAcaoDto,
  ListarTarefasPlanoAcaoDto,
} from './dto/plano-acao.dto';

interface UsuarioAutenticado {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
}

@ApiTags('Planos de Ação')
@Controller('planos-acao')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR)
@ApiBearerAuth()
export class PlanoAcaoController {
  constructor(private readonly service: PlanoAcaoService) {}

  @Post()
  @ApiOperation({ summary: 'Cria tarefa de plano de ação' })
  criar(
    @Body() dto: CriarTarefaPlanoAcaoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PlanoAcaoTarefa> {
    return this.service.criar(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Lista tarefas do plano de ação' })
  listar(
    @Query() filtros: ListarTarefasPlanoAcaoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PaginatedResult<PlanoAcaoTarefa>> {
    return this.service.listar(filtros, usuario);
  }

  @Get('resumo')
  @ApiOperation({ summary: 'Resumo de tarefas por término' })
  resumo(@CurrentUser() usuario: UsuarioAutenticado): Promise<ResumoPlanoAcao> {
    return this.service.resumo(usuario);
  }

  @Post('gerar-da-auditoria/:auditoriaId')
  @ApiOperation({ summary: 'Gera tarefas a partir dos itens não conformes da auditoria' })
  gerarDaAuditoria(
    @Param('auditoriaId', ParseUUIDPipe) auditoriaId: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<{ criadas: number }> {
    return this.service.gerarDaAuditoria(auditoriaId, usuario);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza tarefa (dados ou status)' })
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarTarefaPlanoAcaoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<PlanoAcaoTarefa> {
    return this.service.atualizar(id, dto, usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove tarefa' })
  remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.service.remover(id, usuario);
  }
}
