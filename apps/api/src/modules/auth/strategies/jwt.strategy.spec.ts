import { ConfigService } from '@nestjs/config';
import { PerfilUsuario, StatusUsuario } from '../../usuario/entities/usuario.entity';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  function montar(usuario: Record<string, unknown>) {
    const usuarioService = { buscarPorId: jest.fn().mockResolvedValue(usuario) };
    const config = { get: jest.fn().mockReturnValue('segredo') } as unknown as ConfigService;
    return new JwtStrategy(config, usuarioService as never);
  }
  const payload = { sub: 'u1', email: 'g@x.com', perfil: PerfilUsuario.GESTOR };

  it('devolve a permissão lida do usuário recarregado', async () => {
    const estrategia = montar({
      status: StatusUsuario.ATIVO,
      perfil: PerfilUsuario.GESTOR,
      podeGerenciarLegislacoes: true,
    });
    expect((await estrategia.validate(payload)).podeGerenciarLegislacoes).toBe(true);
  });

  it('flag desligada no banco vira false mesmo com token antigo', async () => {
    const estrategia = montar({
      status: StatusUsuario.ATIVO,
      perfil: PerfilUsuario.GESTOR,
      podeGerenciarLegislacoes: false,
    });
    expect((await estrategia.validate(payload)).podeGerenciarLegislacoes).toBe(false);
  });

  it('MASTER sempre tem a permissão efetiva', async () => {
    const estrategia = montar({
      status: StatusUsuario.ATIVO,
      perfil: PerfilUsuario.MASTER,
      podeGerenciarLegislacoes: false,
    });
    expect(
      (await estrategia.validate({ ...payload, perfil: PerfilUsuario.MASTER })).podeGerenciarLegislacoes,
    ).toBe(true);
  });
});
