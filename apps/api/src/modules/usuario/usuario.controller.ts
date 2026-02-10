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
  ForbiddenException,
  BadRequestException,
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
import { UsuarioService } from './usuario.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Usuario, PerfilUsuario } from './entities/usuario.entity';
import { PaginatedResult } from '../../shared/types/pagination.interface';
import { UploadLogoService } from '../supabase/upload-logo.service';

/**
 * Controller para gestão de usuários.
 */
@ApiTags('Usuários')
@Controller('usuarios')
export class UsuarioController {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly uploadLogoService: UploadLogoService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
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
  @Roles(PerfilUsuario.MASTER, PerfilUsuario.GESTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista todos os usuários' })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  async listar(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string },
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
    if (usuario.perfil === PerfilUsuario.GESTOR && usuarioEncontrado.gestorId !== usuario.id && usuarioEncontrado.id !== usuario.id) {
      throw new ForbiddenException('Acesso negado');
    }
    return usuarioEncontrado;
  }

  @Put(':id/logo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload da logo da consultoria (gestor)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo atualizada' })
  @ApiResponse({ status: 403, description: 'Apenas o próprio gestor ou Master pode alterar a logo' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
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
  ): Promise<Usuario> {
    const alvo = await this.usuarioService.buscarPorId(id);
    if (alvo.perfil !== PerfilUsuario.GESTOR) {
      throw new BadRequestException('Apenas usuários com perfil Gestor podem ter logo da consultoria');
    }
    if (usuario.perfil !== PerfilUsuario.MASTER && usuario.id !== id) {
      throw new ForbiddenException('Apenas o próprio gestor ou Master pode alterar a logo');
    }
    try {
      this.uploadLogoService.validarArquivo(file.buffer, file.mimetype || '');
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Arquivo inválido');
    }
    const url = await this.uploadLogoService.uploadLogo(
      'logos-consultoria',
      id,
      file.buffer,
      file.mimetype || 'image/jpeg',
    );
    return this.usuarioService.atualizar(id, { logoUrl: url });
  }

  @Delete(':id/logo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a logo da consultoria' })
  @ApiResponse({ status: 200, description: 'Logo removida' })
  @ApiResponse({ status: 403, description: 'Apenas o próprio gestor ou Master pode remover a logo' })
  async removerLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario },
  ): Promise<Usuario> {
    const alvo = await this.usuarioService.buscarPorId(id);
    if (alvo.perfil !== PerfilUsuario.GESTOR) {
      throw new BadRequestException('Apenas usuários com perfil Gestor possuem logo da consultoria');
    }
    if (usuario.perfil !== PerfilUsuario.MASTER && usuario.id !== id) {
      throw new ForbiddenException('Apenas o próprio gestor ou Master pode remover a logo');
    }
    return this.usuarioService.atualizar(id, { logoUrl: null });
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PerfilUsuario.MASTER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove um usuário (apenas Master)' })
  @ApiResponse({ status: 200, description: 'Usuário removido' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @ApiResponse({ status: 403, description: 'Acesso negado. Apenas Master pode remover usuários.' })
  async remover(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usuarioService.remover(id);
  }
}

