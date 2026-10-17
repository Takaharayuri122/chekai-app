import { Injectable, NotFoundException } from '@nestjs/common';
import { Usuario } from '../../usuario/entities/usuario.entity';
import { UsuarioService } from '../../usuario/usuario.service';
import { UsuarioOtp, UsuarioOtpPorta } from './oauth.types';

@Injectable()
export class UsuarioOtpAdaptador extends UsuarioOtpPorta {
  constructor(private readonly usuarioService: UsuarioService) {
    super();
  }

  async buscarPorEmail(email: string): Promise<UsuarioOtp | null> {
    if (!email) return null;
    const usuario = await this.usuarioService.buscarPorEmail(email);
    return usuario ? this.paraOtp(usuario) : null;
  }

  async buscarPorId(id: string): Promise<UsuarioOtp | null> {
    try {
      return this.paraOtp(await this.usuarioService.buscarPorId(id));
    } catch (erro) {
      if (erro instanceof NotFoundException) return null;
      throw erro;
    }
  }

  async atualizarOtp(id: string, codigo: string, expiraEm: Date): Promise<void> {
    await this.usuarioService.atualizarOtp(id, codigo, expiraEm);
  }

  async limparOtp(id: string): Promise<void> {
    await this.usuarioService.limparOtp(id);
  }

  private paraOtp(usuario: Usuario): UsuarioOtp {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      status: usuario.status,
      gestorId: usuario.gestorId ?? null,
      tenantId: usuario.tenantId ?? null,
      otpCode: usuario.otpCode ?? null,
      otpExpiresAt: usuario.otpExpiresAt ?? null,
    };
  }
}
