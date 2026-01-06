import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponse } from './dto/login.dto';
import { CadastroPublicoDto } from './dto/cadastro-publico.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

/**
 * Controller para autenticação de usuários.
 */
@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Realiza login e retorna token JWT' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Post('cadastro')
  @ApiOperation({ 
    summary: 'Cadastro público de usuário (pelo site)',
    description: 'Cria um novo usuário com perfil GESTOR automaticamente. Não requer autenticação. Após o cadastro, retorna o token JWT para login automático.'
  })
  @ApiResponse({ status: 201, description: 'Usuário cadastrado com sucesso e autenticado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  async cadastroPublico(@Body() dto: CadastroPublicoDto): Promise<LoginResponse> {
    return this.authService.cadastroPublico(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna dados do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Dados do usuário' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async me(
    @CurrentUser() usuario: { id: string; email: string; perfil: PerfilUsuario; gestorId?: string; tenantId?: string },
  ): Promise<{ id: string; email: string; perfil: PerfilUsuario; gestorId?: string; tenantId?: string }> {
    return usuario;
  }

  @Get('test')
  @ApiOperation({ summary: 'Rota de teste (smoke test)' })
  @ApiResponse({ status: 200, description: 'API funcionando' })
  async test(): Promise<{ message: string; timestamp: string }> {
    return {
      message: 'API Meta App funcionando!',
      timestamp: new Date().toISOString(),
    };
  }
}

