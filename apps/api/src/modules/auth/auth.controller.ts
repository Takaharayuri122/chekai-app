import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponse } from './dto/login.dto';
import { SolicitarOtpDto } from './dto/solicitar-otp.dto';
import { ValidarOtpDto } from './dto/validar-otp.dto';
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

  @Post('solicitar-otp')
  @ApiOperation({ summary: 'Solicita código OTP por e-mail para login' })
  @ApiResponse({ status: 200, description: 'Código OTP enviado por e-mail' })
  @ApiResponse({ status: 401, description: 'E-mail não cadastrado ou usuário inativo' })
  async solicitarOtp(@Body() dto: SolicitarOtpDto): Promise<{ message: string }> {
    return this.authService.solicitarOtp(dto);
  }

  @Post('validar-otp')
  @ApiOperation({ summary: 'Valida código OTP e retorna token JWT' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Código OTP inválido' })
  @ApiResponse({ status: 400, description: 'Código OTP expirado ou não solicitado' })
  async validarOtp(@Body() dto: ValidarOtpDto): Promise<LoginResponse> {
    return this.authService.validarOtp(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'DEPRECATED: Use solicitar-otp e validar-otp. Realiza login com senha (legado)' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Post('cadastro')
  @ApiOperation({ 
    summary: 'Cadastro público de usuário (pelo site)',
    description: 'Cria um novo usuário com perfil GESTOR automaticamente. Não requer autenticação nem senha. Envia e-mail de boas-vindas. Para fazer login, use solicitar-otp e validar-otp.'
  })
  @ApiResponse({ status: 201, description: 'Usuário cadastrado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  async cadastroPublico(@Body() dto: CadastroPublicoDto): Promise<{ message: string }> {
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

