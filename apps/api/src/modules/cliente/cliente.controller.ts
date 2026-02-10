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
  BadRequestException,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
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
import { ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
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
import { UploadLogoService } from '../supabase/upload-logo.service';

/**
 * Controller para gestão de clientes e unidades.
 */
@ApiTags('Clientes')
@Controller('clientes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClienteController {
  constructor(
    private readonly clienteService: ClienteService,
    private readonly uploadLogoService: UploadLogoService,
  ) {}

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
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Cliente> {
    return this.clienteService.buscarClientePorId(id, usuario);
  }

  @Put(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload da logo/imagem do cliente (para relatório)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo do cliente atualizada' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogoCliente(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|gif)$/i }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<Cliente> {
    const cliente = await this.clienteService.buscarClientePorId(id, usuario);
    if (usuario.perfil === PerfilUsuario.GESTOR && cliente.gestorId !== usuario.id) {
      throw new ForbiddenException('Acesso negado a este cliente');
    }
    try {
      this.uploadLogoService.validarArquivo(file.buffer, file.mimetype || '');
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Arquivo inválido');
    }
    const url = await this.uploadLogoService.uploadLogo(
      'logos-clientes',
      id,
      file.buffer,
      file.mimetype || 'image/jpeg',
    );
    return this.clienteService.atualizarCliente(id, { logoUrl: url });
  }

  @Delete(':id/logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a logo do cliente' })
  @ApiResponse({ status: 200, description: 'Logo removida' })
  async removerLogoCliente(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Cliente> {
    const cliente = await this.clienteService.buscarClientePorId(id, usuario);
    if (usuario.perfil === PerfilUsuario.GESTOR && cliente.gestorId !== usuario.id) {
      throw new ForbiddenException('Acesso negado a este cliente');
    }
    return this.clienteService.atualizarCliente(id, { logoUrl: null });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza um cliente' })
  @ApiResponse({ status: 200, description: 'Cliente atualizado' })
  async atualizarCliente(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CriarClienteDto>,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Cliente> {
    return this.clienteService.atualizarCliente(id, dto, usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um cliente' })
  @ApiResponse({ status: 200, description: 'Cliente removido' })
  async removerCliente(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<void> {
    return this.clienteService.removerCliente(id, usuario);
  }

  @Post(':id/unidades')
  @ApiOperation({ summary: 'Cria uma nova unidade para o cliente' })
  @ApiResponse({ status: 201, description: 'Unidade criada com sucesso' })
  async criarUnidade(
    @Param('id', ParseUUIDPipe) clienteId: string,
    @Body() dto: CriarUnidadeParaClienteDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade> {
    return this.clienteService.criarUnidade({ ...dto, clienteId }, usuario);
  }

  @Get(':id/unidades')
  @ApiOperation({ summary: 'Lista unidades de um cliente' })
  @ApiResponse({ status: 200, description: 'Lista de unidades' })
  async listarUnidades(
    @Param('id', ParseUUIDPipe) clienteId: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade[]> {
    await this.clienteService.buscarClientePorId(clienteId, usuario);
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
  async criarUnidade(
    @Body() dto: CriarUnidadeDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade> {
    return this.clienteService.criarUnidade(dto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todas as unidades' })
  @ApiResponse({ status: 200, description: 'Lista de unidades' })
  async listarUnidades(
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade[]> {
    return this.clienteService.listarTodasUnidades(usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca uma unidade pelo ID' })
  @ApiResponse({ status: 200, description: 'Unidade encontrada' })
  async buscarUnidadePorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade> {
    return this.clienteService.buscarUnidadePorId(id, usuario);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza uma unidade' })
  @ApiResponse({ status: 200, description: 'Unidade atualizada' })
  async atualizarUnidade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CriarUnidadeDto>,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade> {
    return this.clienteService.atualizarUnidade(id, dto, usuario);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma unidade' })
  @ApiResponse({ status: 200, description: 'Unidade removida' })
  async removerUnidade(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<void> {
    return this.clienteService.removerUnidade(id, usuario);
  }
}

