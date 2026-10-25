import { describe, expect, it } from 'vitest';
import { PerfilUsuario } from '@/lib/store';
import { podeGerenciarLegislacoes } from './permissao';

describe('podeGerenciarLegislacoes', () => {
  it('MASTER sem flag pode', () => {
    expect(podeGerenciarLegislacoes({ perfil: PerfilUsuario.MASTER })).toBe(true);
  });
  it('GESTOR com flag pode; sem flag não', () => {
    expect(podeGerenciarLegislacoes({ perfil: PerfilUsuario.GESTOR, podeGerenciarLegislacoes: true })).toBe(true);
    expect(podeGerenciarLegislacoes({ perfil: PerfilUsuario.GESTOR })).toBe(false);
  });
  it('AUDITOR com flag não pode', () => {
    expect(podeGerenciarLegislacoes({ perfil: PerfilUsuario.AUDITOR, podeGerenciarLegislacoes: true })).toBe(false);
  });
  it('sem usuário não pode', () => {
    expect(podeGerenciarLegislacoes(null)).toBe(false);
  });
});
