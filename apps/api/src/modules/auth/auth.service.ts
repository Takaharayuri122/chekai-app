import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsuarioService } from '../usuario/usuario.service';
import { EmailService } from '../email/email.service';
import { AssinaturaService } from '../plano/assinatura.service';
import { PlanoService } from '../plano/plano.service';
import { PerfilUsuario, StatusUsuario } from '../usuario/entities/usuario.entity';
import { LoginDto, LoginResponse } from './dto/login.dto';
import { SolicitarOtpDto } from './dto/solicitar-otp.dto';
import { ValidarOtpDto } from './dto/validar-otp.dto';

/**
 * Serviço responsável pela autenticação de usuários.
 */
@Injectable()
export class AuthService {
  private readonly OTP_MOCK = '252622';
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly assinaturaService: AssinaturaService,
    private readonly planoService: PlanoService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Verifica se está em ambiente de desenvolvimento.
   */
  private isDevelopment(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    return !nodeEnv || nodeEnv === 'development';
  }

  /**
   * Solicita um código OTP para login.
   */
  async solicitarOtp(dto: SolicitarOtpDto): Promise<{ message: string }> {
    const usuario = await this.usuarioService.buscarPorEmail(dto.email);
    if (!usuario) {
      throw new UnauthorizedException('E-mail não cadastrado');
    }
    if (usuario.status === StatusUsuario.NAO_CONFIRMADO) {
      throw new UnauthorizedException('Convite pendente. Verifique seu e-mail para aceitar o convite.');
    }
    if (usuario.status === StatusUsuario.INATIVO) {
      throw new UnauthorizedException('Usuário inativo');
    }
    const codigoOTP = this.gerarCodigoOTP();
    const dataExpiracao = new Date();
    dataExpiracao.setMinutes(dataExpiracao.getMinutes() + 10);
    await this.usuarioService.atualizarOtp(usuario.id, codigoOTP, dataExpiracao);
    await this.emailService.enviarEmailOTP(usuario.email, usuario.nome, codigoOTP);
    return { message: 'Código OTP enviado por e-mail' };
  }

  /**
   * Valida o código OTP e retorna o token JWT.
   */
  async validarOtp(dto: ValidarOtpDto): Promise<LoginResponse> {
    const usuario = await this.usuarioService.buscarPorEmail(dto.email);
    if (!usuario) {
      throw new UnauthorizedException('E-mail não cadastrado');
    }
    if (usuario.status !== StatusUsuario.ATIVO) {
      throw new UnauthorizedException('Usuário inativo ou não confirmado');
    }
    const isMockOtp = this.isDevelopment() && dto.codigo === this.OTP_MOCK;
    if (!isMockOtp) {
      if (!usuario.otpCode || !usuario.otpExpiresAt) {
        throw new BadRequestException('Código OTP não solicitado ou expirado');
      }
      if (usuario.otpCode !== dto.codigo) {
        throw new UnauthorizedException('Código OTP inválido');
      }
      if (new Date() > usuario.otpExpiresAt) {
        throw new BadRequestException('Código OTP expirado. Solicite um novo código.');
      }
      await this.usuarioService.limparOtp(usuario.id);
    }
    const payload = {
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        gestorId: usuario.gestorId ?? undefined,
        tenantId: usuario.tenantId ?? undefined,
      },
    };
  }

  /**
   * Gera um código OTP de 6 dígitos.
   */
  private gerarCodigoOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Valida o token JWT e retorna o payload.
   */
  async validateToken(token: string): Promise<{ sub: string; email: string; perfil: PerfilUsuario }> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  /**
   * DEPRECATED: Realiza o login do usuário com senha (método legado).
   * Use solicitarOtp e validarOtp ao invés deste método.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const usuario = await this.usuarioService.buscarPorEmail(dto.email);
    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (usuario.status !== StatusUsuario.ATIVO) {
      throw new UnauthorizedException('Usuário inativo ou não confirmado');
    }
    if (!usuario.senhaHash) {
      throw new UnauthorizedException('Usuário não possui senha cadastrada. Use o login via OTP.');
    }
    const bcrypt = await import('bcrypt');
    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const payload = {
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        gestorId: usuario.gestorId ?? undefined,
        tenantId: usuario.tenantId ?? undefined,
      },
    };
  }

  /**
   * Aceita um convite de acesso e ativa a conta do usuário.
   */
  async aceitarConvite(token: string): Promise<{ email: string }> {
    return this.usuarioService.aceitarConvite(token);
  }

  /**
   * Envia e-mail de convite para um usuário recém-criado.
   */
  async enviarConvite(email: string, nome: string, tokenConvite: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const linkConvite = `${frontendUrl}/login?token=${tokenConvite}&email=${encodeURIComponent(email)}`;
    await this.emailService.enviarEmailConvite(email, nome, linkConvite);
  }

  /**
   * Reenvia o convite para um usuário não confirmado.
   */
  async reenviarConvite(usuarioId: string): Promise<{ message: string }> {
    const dados = await this.usuarioService.gerarNovoTokenConvite(usuarioId);
    await this.enviarConvite(dados.email, dados.nome, dados.tokenConvite);
    return { message: 'Convite reenviado com sucesso' };
  }

  /**
   * Cadastra um novo usuário pelo site (público).
   * Usuários cadastrados pelo site são automaticamente criados como GESTOR.
   * Não requer senha, apenas envia e-mail de boas-vindas.
   * Cria assinatura automaticamente com o plano selecionado.
   */
  async cadastroPublico(dto: { nome: string; email: string; telefone: string; planoId: string }): Promise<{ message: string }> {
    const plano = await this.planoService.buscarPorId(dto.planoId);
    if (!plano.ativo) {
      throw new BadRequestException('Plano não está ativo');
    }
    const usuario = await this.usuarioService.criar({
      nome: dto.nome,
      email: dto.email,
      telefone: dto.telefone,
      perfil: PerfilUsuario.GESTOR,
    });
    await this.assinaturaService.criarAssinaturaPublica(usuario.id, dto.planoId);
    await this.emailService.enviarEmailBoasVindas(usuario.email, usuario.nome);
    return { message: 'Usuário cadastrado com sucesso. Verifique seu e-mail para mais informações.' };
  }
}

