import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PerfilUsuario, StatusUsuario } from '../usuario/entities/usuario.entity';

const EMAIL = 'revisao@chekai.com.br';

function criarUsuario(loginFixoHabilitado: boolean) {
  return {
    id: 'u-1',
    nome: 'Revisão',
    email: EMAIL,
    perfil: PerfilUsuario.AUDITOR,
    status: StatusUsuario.ATIVO,
    gestorId: 'g-1',
    tenantId: null,
    otpCode: null,
    otpExpiresAt: null,
    loginFixoHabilitado,
  };
}

function criarServico(usuario: ReturnType<typeof criarUsuario>, codigoFixo: string | undefined) {
  const usuarioService = {
    buscarPorEmail: jest.fn().mockResolvedValue(usuario),
    atualizarOtp: jest.fn(),
    limparOtp: jest.fn(),
  };
  const emailService = { enviarEmailOTP: jest.fn() };
  const configService = {
    get: jest.fn((chave: string) => ({ NODE_ENV: 'production', LOGIN_FIXO_CODIGO: codigoFixo })[chave]),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('token') };
  const service = new AuthService(
    usuarioService as never,
    jwtService as never,
    emailService as never,
    {} as never,
    {} as never,
    configService as never,
  );
  return { service, usuarioService, emailService };
}

describe('AuthService - login fixo do usuário de revisão', () => {
  it('entra com o código fixo quando a flag do usuário está ligada', async () => {
    const { service } = criarServico(criarUsuario(true), '482916');
    const resposta = await service.validarOtp({ email: EMAIL, codigo: '482916' });
    expect(resposta.accessToken).toBe('token');
  });

  it('não envia e-mail ao pedir o código quando a flag está ligada', async () => {
    const { service, emailService, usuarioService } = criarServico(criarUsuario(true), '482916');
    await service.solicitarOtp({ email: EMAIL });
    expect(emailService.enviarEmailOTP).not.toHaveBeenCalled();
    expect(usuarioService.atualizarOtp).not.toHaveBeenCalled();
  });

  it('recusa código fixo errado', async () => {
    const { service } = criarServico(criarUsuario(true), '482916');
    await expect(service.validarOtp({ email: EMAIL, codigo: '000000' })).rejects.toThrow(UnauthorizedException);
  });

  it('usuário sem a flag não entra com o código fixo', async () => {
    const { service } = criarServico(criarUsuario(false), '482916');
    await expect(service.validarOtp({ email: EMAIL, codigo: '482916' })).rejects.toThrow(BadRequestException);
  });

  it('usuário sem a flag continua recebendo o código por e-mail', async () => {
    const { service, emailService } = criarServico(criarUsuario(false), '482916');
    await service.solicitarOtp({ email: EMAIL });
    expect(emailService.enviarEmailOTP).toHaveBeenCalled();
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['com letras', '48a916'],
    ['curto', '4829'],
  ])('com a variável %s o login fixo fica desligado', async (_caso, codigoFixo) => {
    const { service, emailService } = criarServico(criarUsuario(true), codigoFixo);
    await expect(service.validarOtp({ email: EMAIL, codigo: '482916' })).rejects.toThrow(BadRequestException);
    await service.solicitarOtp({ email: EMAIL });
    expect(emailService.enviarEmailOTP).toHaveBeenCalled();
  });
});
