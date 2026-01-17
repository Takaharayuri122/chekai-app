import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuarioService } from '../usuario/usuario.service';
import { EmailService } from '../email/email.service';
import { AssinaturaService } from '../plano/assinatura.service';
import { PlanoService } from '../plano/plano.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { LoginDto, LoginResponse } from './dto/login.dto';
import { SolicitarOtpDto } from './dto/solicitar-otp.dto';
import { ValidarOtpDto } from './dto/validar-otp.dto';

/**
 * Serviço responsável pela autenticação de usuários.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly assinaturaService: AssinaturaService,
    private readonly planoService: PlanoService,
  ) {}

  /**
   * Solicita um código OTP para login.
   */
  async solicitarOtp(dto: SolicitarOtpDto): Promise<{ message: string }> {
    const usuario = await this.usuarioService.buscarPorEmail(dto.email);
    if (!usuario) {
      throw new UnauthorizedException('E-mail não cadastrado');
    }
    if (!usuario.ativo) {
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
    if (!usuario.ativo) {
      throw new UnauthorizedException('Usuário inativo');
    }
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
    if (!usuario.ativo) {
      throw new UnauthorizedException('Usuário inativo');
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

