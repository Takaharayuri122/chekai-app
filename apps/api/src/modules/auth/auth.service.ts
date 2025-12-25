import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuarioService } from '../usuario/usuario.service';
import { LoginDto, LoginResponse } from './dto/login.dto';

/**
 * Serviço responsável pela autenticação de usuários.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Realiza o login do usuário e retorna o token JWT.
   */
  async login(dto: LoginDto): Promise<LoginResponse> {
    const usuario = await this.usuarioService.buscarPorEmail(dto.email);
    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!usuario.ativo) {
      throw new UnauthorizedException('Usuário inativo');
    }
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
      },
    };
  }

  /**
   * Valida o token JWT e retorna o payload.
   */
  async validateToken(token: string): Promise<{ sub: string; email: string; perfil: string }> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}

