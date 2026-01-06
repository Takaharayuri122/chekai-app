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
import { ClienteService } from './cliente.service';
import { CriarClienteDto } from './dto/criar-cliente.dto';
import { CriarUnidadeDto } from './dto/criar-unidade.dto';
import { CriarUnidadeParaClienteDto } from './dto/criar-unidade-para-cliente.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Cliente } from './entities/cliente.entity';
import { Unidade } from './entities/unidade.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';

/**
 * Controller para gestão de clientes e unidades.
 */
@ApiTags('Clientes')
@Controller('clientes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClienteController {
  constructor(private readonly clienteService: ClienteService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cria um novo cliente' })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso' })
  async criarCliente(
    @Body() dto: CriarClienteDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Cliente> {
    return this.clienteService.criarCliente(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os clientes' })
  @ApiResponse({ status: 200, description: 'Lista de clientes' })
  async listarClientes(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<PaginatedResult<Cliente>> {
    return this.clienteService.listarClientes({ page, limit }, usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um cliente pelo ID' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado' })
  async buscarClientePorId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Cliente> {
    return this.clienteService.buscarClientePorId(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza um cliente' })
  @ApiResponse({ status: 200, description: 'Cliente atualizado' })
  async atualizarCliente(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CriarClienteDto>,
  ): Promise<Cliente> {
    return this.clienteService.atualizarCliente(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um cliente' })
  @ApiResponse({ status: 200, description: 'Cliente removido' })
  async removerCliente(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.clienteService.removerCliente(id);
  }

  @Post(':id/unidades')
  @ApiOperation({ summary: 'Cria uma nova unidade para o cliente' })
  @ApiResponse({ status: 201, description: 'Unidade criada com sucesso' })
  async criarUnidade(
    @Param('id', ParseUUIDPipe) clienteId: string,
    @Body() dto: CriarUnidadeParaClienteDto,
  ): Promise<Unidade> {
    return this.clienteService.criarUnidade({ ...dto, clienteId });
  }

  @Get(':id/unidades')
  @ApiOperation({ summary: 'Lista unidades de um cliente' })
  @ApiResponse({ status: 200, description: 'Lista de unidades' })
  async listarUnidades(
    @Param('id', ParseUUIDPipe) clienteId: string,
  ): Promise<Unidade[]> {
    return this.clienteService.listarUnidadesPorCliente(clienteId);
  }
}

/**
 * Controller específico para operações em unidades.
 */
@ApiTags('Unidades')
@Controller('unidades')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UnidadeController {
  constructor(private readonly clienteService: ClienteService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma nova unidade' })
  @ApiResponse({ status: 201, description: 'Unidade criada com sucesso' })
  async criarUnidade(@Body() dto: CriarUnidadeDto): Promise<Unidade> {
    return this.clienteService.criarUnidade(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todas as unidades' })
  @ApiResponse({ status: 200, description: 'Lista de unidades' })
  async listarUnidades(): Promise<Unidade[]> {
    return this.clienteService.listarTodasUnidades();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma unidade pelo ID' })
  @ApiResponse({ status: 200, description: 'Unidade encontrada' })
  async buscarUnidadePorId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Unidade> {
    return this.clienteService.buscarUnidadePorId(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza uma unidade' })
  @ApiResponse({ status: 200, description: 'Unidade atualizada' })
  async atualizarUnidade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CriarUnidadeDto>,
  ): Promise<Unidade> {
    return this.clienteService.atualizarUnidade(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma unidade' })
  @ApiResponse({ status: 200, description: 'Unidade removida' })
  async removerUnidade(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.clienteService.removerUnidade(id);
  }
}

