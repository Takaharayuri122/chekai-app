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
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsuarioService } from './usuario.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { AuthenticatedRequest } from '../../core/interfaces/authenticated-request.interface';
import { Usuario, PerfilUsuario } from './entities/usuario.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';

/**
 * Controller para gestão de usuários.
 */
@ApiTags('Usuários')
@Controller('usuarios')
export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.ANALISTA)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cria um novo usuário' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  async criar(
    @Body() dto: CriarUsuarioDto,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Usuario> {
    return this.usuarioService.criar(dto, usuario);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.ANALISTA)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista todos os usuários' })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  async listar(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; analistaId?: string },
  ): Promise<PaginatedResult<Usuario>> {
    return this.usuarioService.listar({ page, limit }, usuario);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Busca um usuário pelo ID' })
  @ApiResponse({ status: 200, description: 'Usuário encontrado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async buscarPorId(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Usuario> {
    const usuarioEncontrado = await this.usuarioService.buscarPorId(id);
    if (usuario.perfil === PerfilUsuario.AUDITOR && usuarioEncontrado.id !== usuario.id) {
      throw new ForbiddenException('Acesso negado');
    }
    if (usuario.perfil === PerfilUsuario.ANALISTA && usuarioEncontrado.analistaId !== usuario.id && usuarioEncontrado.id !== usuario.id) {
      throw new ForbiddenException('Acesso negado');
    }
    return usuarioEncontrado;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza um usuário' })
  @ApiResponse({ status: 200, description: 'Usuário atualizado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarUsuarioDto,
  ): Promise<Usuario> {
    return this.usuarioService.atualizar(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove um usuário' })
  @ApiResponse({ status: 200, description: 'Usuário removido' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usuarioService.remover(id);
  }
}

