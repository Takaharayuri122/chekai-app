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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlanoService } from './plano.service';
import { AssinaturaService } from './assinatura.service';
import { CriarPlanoDto } from './dto/criar-plano.dto';
import { AtualizarPlanoDto } from './dto/atualizar-plano.dto';
import { CriarAssinaturaDto } from './dto/criar-assinatura.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Plano } from './entities/plano.entity';
import { Assinatura } from './entities/assinatura.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';

/**
 * Controller para gestão de planos e assinaturas.
 */
@ApiTags('Planos')
@Controller('planos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlanoController {
  constructor(
    private readonly planoService: PlanoService,
    private readonly assinaturaService: AssinaturaService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER)
  @ApiOperation({ summary: 'Cria um novo plano (apenas Master)' })
  @ApiResponse({ status: 201, description: 'Plano criado com sucesso' })
  async criar(
    @Body() dto: CriarPlanoDto,
    @CurrentUser() usuario: { perfil: PerfilUsuario },
  ): Promise<Plano> {
    return this.planoService.criar(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os planos ativos' })
  @ApiResponse({ status: 200, description: 'Lista de planos' })
  async listar(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedResult<Plano>> {
    return this.planoService.listar({ page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um plano pelo ID' })
  @ApiResponse({ status: 200, description: 'Plano encontrado' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  async buscarPorId(@Param('id', ParseUUIDPipe) id: string): Promise<Plano> {
    return this.planoService.buscarPorId(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER)
  @ApiOperation({ summary: 'Atualiza um plano (apenas Master)' })
  @ApiResponse({ status: 200, description: 'Plano atualizado' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPlanoDto,
    @CurrentUser() usuario: { perfil: PerfilUsuario },
  ): Promise<Plano> {
    return this.planoService.atualizar(id, dto, usuario);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER)
  @ApiOperation({ summary: 'Remove um plano (apenas Master)' })
  @ApiResponse({ status: 200, description: 'Plano removido' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { perfil: PerfilUsuario },
  ): Promise<void> {
    return this.planoService.remover(id, usuario);
  }

  @Post(':id/assinaturas')
  @UseGuards(RolesGuard)
  @Roles(PerfilUsuario.MASTER)
  @ApiOperation({ summary: 'Cria uma assinatura para um gestor (apenas Master)' })
  @ApiResponse({ status: 201, description: 'Assinatura criada com sucesso' })
  async criarAssinatura(
    @Param('id', ParseUUIDPipe) planoId: string,
    @Body() dto: CriarAssinaturaDto,
    @CurrentUser() usuario: { perfil: PerfilUsuario },
  ): Promise<Assinatura> {
    return this.assinaturaService.criar({ ...dto, planoId }, usuario);
  }

  @Get('gestores/:gestorId/assinatura')
  @ApiOperation({ summary: 'Busca a assinatura ativa de um gestor' })
  @ApiResponse({ status: 200, description: 'Assinatura encontrada' })
  @ApiResponse({ status: 404, description: 'Assinatura não encontrada' })
  async buscarAssinaturaAtiva(
    @Param('gestorId', ParseUUIDPipe) gestorId: string,
  ): Promise<Assinatura | null> {
    return this.assinaturaService.buscarAssinaturaAtivaComValidacao(gestorId);
  }
}

