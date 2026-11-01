import { UsuarioService } from './usuario.service';

describe('UsuarioService - busca por e-mail usada no login', () => {
  it('carrega a flag do login fixo (RN-AUTH-010)', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new UsuarioService(repo as never, {} as never, {} as never);
    await service.buscarPorEmail('revisao@chekai.com.br');
    expect(repo.findOne.mock.calls[0][0].select).toContain('loginFixoHabilitado');
  });
});
