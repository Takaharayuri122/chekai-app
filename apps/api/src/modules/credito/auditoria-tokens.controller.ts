import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditoriaTokensService } from './auditoria-tokens.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { ProvedorIa } from './entities/uso-credito.entity';

/**
 * Controller para auditoria de uso de tokens de IA.
 * Apenas usuários Master podem acessar.
 */
@ApiTags('Auditoria de Tokens')
@Controller('auditoria-tokens')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.MASTER)
@ApiBearerAuth()
export class AuditoriaTokensController {
  constructor(
    private readonly auditoriaTokensService: AuditoriaTokensService,
  ) {}

  @Get('estatisticas')
  @ApiOperation({ summary: 'Obtém estatísticas agregadas de uso de tokens (apenas Master)' })
  @ApiQuery({ name: 'dataInicio', required: false, type: String, description: 'Data de início (ISO 8601)' })
  @ApiQuery({ name: 'dataFim', required: false, type: String, description: 'Data de fim (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Estatísticas de tokens' })
  async obterEstatisticas(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    const inicio = dataInicio ? new Date(dataInicio) : undefined;
    const fim = dataFim ? new Date(dataFim) : undefined;
    return this.auditoriaTokensService.obterEstatisticas(inicio, fim);
  }

  @Get('historico')
  @ApiOperation({ summary: 'Lista histórico detalhado de uso de tokens (apenas Master)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite por página' })
  @ApiQuery({ name: 'gestorId', required: false, type: String, description: 'Filtrar por gestor' })
  @ApiQuery({ name: 'provedor', required: false, enum: ProvedorIa, description: 'Filtrar por provedor' })
  @ApiQuery({ name: 'dataInicio', required: false, type: String, description: 'Data de início (ISO 8601)' })
  @ApiQuery({ name: 'dataFim', required: false, type: String, description: 'Data de fim (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Histórico de tokens' })
  async listarHistorico(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('gestorId') gestorId?: string,
    @Query('provedor') provedor?: ProvedorIa,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    const inicio = dataInicio ? new Date(dataInicio) : undefined;
    const fim = dataFim ? new Date(dataFim) : undefined;
    return this.auditoriaTokensService.listarHistoricoDetalhado(
      page,
      limit,
      gestorId,
      provedor,
      inicio,
      fim,
    );
  }
}

