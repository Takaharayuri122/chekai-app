import { BadRequestException } from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import { PerfilUsuario } from './entities/usuario.entity';

describe('UsuarioService - permissão de legislações', () => {
  let service: UsuarioService;
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  const master = { id: 'm1', perfil: PerfilUsuario.MASTER };
  const gestor = { id: 'g1', perfil: PerfilUsuario.GESTOR };

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((d) => ({ ...d })),
      save: jest.fn().mockImplementation((u) => Promise.resolve({ id: 'novo', ...u })),
    };
    service = new UsuarioService(repo as never, {} as never, {} as never);
  });

  const base = { nome: 'Fulano', email: 'f@x.com', telefone: '1' };

  it('MASTER criando GESTOR com a permissão grava true', async () => {
    await service.criar(
      { ...base, perfil: PerfilUsuario.GESTOR, podeGerenciarLegislacoes: true },
      master,
    );
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ podeGerenciarLegislacoes: true }));
  });

  it('GESTOR criando AUDITOR com o campo grava false', async () => {
    await service.criar(
      { ...base, perfil: PerfilUsuario.AUDITOR, podeGerenciarLegislacoes: true },
      gestor,
    );
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ podeGerenciarLegislacoes: false }));
  });

  it('MASTER criando AUDITOR com o campo grava false', async () => {
    await service.criar(
      { ...base, perfil: PerfilUsuario.AUDITOR, podeGerenciarLegislacoes: true },
      master,
    );
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ podeGerenciarLegislacoes: false }));
  });

  it('PUT genérico não altera a permissão', async () => {
    const alvo = { id: 'g1', email: 'a@x.com', perfil: PerfilUsuario.GESTOR, podeGerenciarLegislacoes: false };
    repo.findOne.mockResolvedValueOnce(alvo);
    await service.atualizar('g1', { nome: 'Novo', podeGerenciarLegislacoes: true }, gestor as never);
    const salvo = repo.save.mock.calls[0][0];
    expect(salvo.nome).toBe('Novo');
    expect(salvo.podeGerenciarLegislacoes).toBe(false);
  });

  it('alterarPermissaoLegislacoes em AUDITOR dá 400', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'a1', perfil: PerfilUsuario.AUDITOR });
    const chamada = service.alterarPermissaoLegislacoes('a1', true);
    await expect(chamada).rejects.toThrow(BadRequestException);
    await expect(
      (repo.findOne.mockResolvedValueOnce({ id: 'a1', perfil: PerfilUsuario.AUDITOR }),
      service.alterarPermissaoLegislacoes('a1', true)),
    ).rejects.toThrow('A permissão de legislações vale só para gestores.');
  });

  it('alterarPermissaoLegislacoes em GESTOR grava', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'g1', perfil: PerfilUsuario.GESTOR, podeGerenciarLegislacoes: false });
    const r = await service.alterarPermissaoLegislacoes('g1', true);
    expect(r.podeGerenciarLegislacoes).toBe(true);
  });
});
