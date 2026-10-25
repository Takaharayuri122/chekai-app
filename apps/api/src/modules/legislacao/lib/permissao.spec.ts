import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { podeGerenciarLegislacoes } from './permissao';

describe('podeGerenciarLegislacoes', () => {
  it('MASTER sempre pode', () => {
    expect(podeGerenciarLegislacoes({ perfil: PerfilUsuario.MASTER })).toBe(true);
  });
  it('GESTOR depende da flag', () => {
    expect(
      podeGerenciarLegislacoes({ perfil: PerfilUsuario.GESTOR, podeGerenciarLegislacoes: true }),
    ).toBe(true);
    expect(
      podeGerenciarLegislacoes({ perfil: PerfilUsuario.GESTOR, podeGerenciarLegislacoes: false }),
    ).toBe(false);
    expect(podeGerenciarLegislacoes({ perfil: PerfilUsuario.GESTOR })).toBe(false);
  });
  it('AUDITOR nunca pode', () => {
    expect(
      podeGerenciarLegislacoes({ perfil: PerfilUsuario.AUDITOR, podeGerenciarLegislacoes: true }),
    ).toBe(false);
  });
});
