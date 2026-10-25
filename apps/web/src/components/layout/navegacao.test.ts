import { describe, expect, it } from 'vitest';
import { PerfilUsuario } from '@/lib/store';
import {
  HREF_NOVA_AUDITORIA,
  filtrarItensBusca,
  filtroBusca,
  getHrefAtivo,
  getBarraInferior,
  getGruposNavegacao,
  getItensConta,
  getItensMais,
  isRotaAtiva,
  itensBuscaAuditorias,
  mostrarAtalhoNovaAuditoria,
} from './navegacao';

const labels = (perfil: PerfilUsuario) =>
  getGruposNavegacao(perfil).map((g) => ({ id: g.id, itens: g.itens.map((i) => i.label) }));

describe('getGruposNavegacao', () => {
  it('auditor vê só Início e Operação sem Check-ins', () => {
    expect(labels(PerfilUsuario.AUDITOR)).toEqual([
      { id: 'inicio', itens: ['Início'] },
      { id: 'operacao', itens: ['Auditorias', 'Agenda', 'Planos de ação', 'Relatórios técnicos'] },
    ]);
  });

  it('gestor vê Operação com Check-ins e Gestão sem Legislações', () => {
    expect(labels(PerfilUsuario.GESTOR)).toEqual([
      { id: 'inicio', itens: ['Início'] },
      { id: 'operacao', itens: ['Auditorias', 'Agenda', 'Planos de ação', 'Relatórios técnicos', 'Check-ins'] },
      { id: 'gestao', itens: ['Clientes', 'Checklists', 'Equipe'] },
    ]);
  });

  it('master vê Legislações e Administração', () => {
    const grupos = labels(PerfilUsuario.MASTER);
    expect(grupos.find((g) => g.id === 'gestao')?.itens).toEqual(['Clientes', 'Checklists', 'Equipe', 'Legislações']);
    expect(grupos.find((g) => g.id === 'administracao')?.itens).toEqual([
      'Lista de espera', 'Planos', 'Assinaturas', 'Créditos', 'Consumo de IA',
    ]);
  });
});

describe('getItensConta', () => {
  it('gestor tem Limites e Créditos; auditor e master só Perfil', () => {
    expect(getItensConta(PerfilUsuario.GESTOR).map((i) => i.label)).toEqual(['Meu perfil', 'Meus limites', 'Meus créditos']);
    expect(getItensConta(PerfilUsuario.AUDITOR).map((i) => i.label)).toEqual(['Meu perfil']);
    expect(getItensConta(PerfilUsuario.MASTER).map((i) => i.label)).toEqual(['Meu perfil']);
  });
});

describe('getBarraInferior', () => {
  it('auditor: Início, Auditorias, Agenda', () => {
    expect(getBarraInferior(PerfilUsuario.AUDITOR).map((i) => i.label)).toEqual(['Início', 'Auditorias', 'Agenda']);
  });
  it('gestor e master: Início, Auditorias, Planos de ação', () => {
    expect(getBarraInferior(PerfilUsuario.GESTOR).map((i) => i.label)).toEqual(['Início', 'Auditorias', 'Planos de ação']);
    expect(getBarraInferior(PerfilUsuario.MASTER).map((i) => i.label)).toEqual(['Início', 'Auditorias', 'Planos de ação']);
  });
});

describe('getItensMais', () => {
  it('exclui itens da barra inferior e inclui conta', () => {
    const mais = getItensMais(PerfilUsuario.AUDITOR).map((i) => i.label);
    expect(mais).toEqual(['Planos de ação', 'Relatórios técnicos', 'Meu perfil']);
  });
});

describe('mostrarAtalhoNovaAuditoria', () => {
  it('esconde o atalho onde a tela já tem o botão', () => {
    expect(mostrarAtalhoNovaAuditoria('/admin/auditorias', PerfilUsuario.GESTOR)).toBe(false);
    expect(mostrarAtalhoNovaAuditoria('/admin/auditoria/nova', PerfilUsuario.AUDITOR)).toBe(false);
    expect(mostrarAtalhoNovaAuditoria('/admin/dashboard', PerfilUsuario.AUDITOR)).toBe(false);
  });

  it('mantém o atalho nas demais telas e no início do gestor', () => {
    expect(mostrarAtalhoNovaAuditoria('/admin/clientes', PerfilUsuario.GESTOR)).toBe(true);
    expect(mostrarAtalhoNovaAuditoria('/admin/dashboard', PerfilUsuario.GESTOR)).toBe(true);
    expect(mostrarAtalhoNovaAuditoria('/admin/auditoria/abc', PerfilUsuario.AUDITOR)).toBe(true);
  });
});

describe('isRotaAtiva', () => {
  it('casa rota exata e subrotas', () => {
    expect(isRotaAtiva('/admin/clientes', '/admin/clientes')).toBe(true);
    expect(isRotaAtiva('/admin/clientes/123', '/admin/clientes')).toBe(true);
    expect(isRotaAtiva('/admin/clientes-x', '/admin/clientes')).toBe(false);
  });
  it('execução da auditoria ativa Auditorias, mas nova auditoria não', () => {
    expect(isRotaAtiva('/admin/auditoria/abc', '/admin/auditorias')).toBe(true);
    expect(isRotaAtiva('/admin/auditoria/abc/relatorio', '/admin/auditorias')).toBe(true);
    expect(isRotaAtiva(HREF_NOVA_AUDITORIA, '/admin/auditorias')).toBe(false);
  });
  it('Planos não fica ativo em Planos de ação', () => {
    expect(isRotaAtiva('/admin/planos-acao', '/admin/planos')).toBe(false);
  });
});

describe('filtrarItensBusca', () => {
  const itens = getGruposNavegacao(PerfilUsuario.GESTOR).flatMap((g) => g.itens);
  it('ignora acentos e maiúsculas', () => {
    expect(filtrarItensBusca(itens, 'relatorio').map((i) => i.label)).toEqual(['Relatórios técnicos']);
    expect(filtrarItensBusca(itens, 'AGENDA').map((i) => i.label)).toEqual(['Agenda']);
  });
  it('termo vazio retorna tudo', () => {
    expect(filtrarItensBusca(itens, '   ')).toHaveLength(itens.length);
  });
});

describe('filtroBusca (usado pela busca global)', () => {
  it('casa termos sem acento e em maiúsculas', () => {
    expect(filtroBusca('Relatórios técnicos', 'relatorio')).toBe(1);
    expect(filtroBusca('Legislações', 'legislacoes')).toBe(1);
    expect(filtroBusca('Planos de ação', 'ACAO')).toBe(1);
    expect(filtroBusca('Agenda', 'clientes')).toBe(0);
  });
});

describe('getHrefAtivo', () => {
  it('escolhe o item mais específico quando dois casam', () => {
    const itens = getGruposNavegacao(PerfilUsuario.MASTER).flatMap((g) => g.itens);
    expect(getHrefAtivo('/admin/planos/assinaturas', itens)).toBe('/admin/planos/assinaturas');
    expect(getHrefAtivo('/admin/planos', itens)).toBe('/admin/planos');
    expect(getHrefAtivo('/admin/auditoria/abc', itens)).toBe('/admin/auditorias');
    expect(getHrefAtivo('/admin/inexistente', itens)).toBeNull();
  });
});

describe('itensBuscaAuditorias', () => {
  it('monta título, detalhe, link e termos de busca', () => {
    const [r] = itensBuscaAuditorias([
      {
        id: 'a1',
        status: 'finalizada',
        dataInicio: '2026-10-07T12:00:00Z',
        unidade: { nome: 'Loja Centro', cliente: { nomeFantasia: 'Padaria São João' } },
        template: { nome: 'Boas Práticas' },
      } as never,
    ]);
    expect(r.href).toBe('/admin/auditoria/a1/relatorio');
    expect(r.titulo).toBe('Loja Centro');
    expect(r.detalhe).toContain('Boas Práticas');
    expect(filtroBusca(r.termos, 'sao joao')).toBe(1);
  });
  it('em andamento aponta para a execução', () => {
    const [r] = itensBuscaAuditorias([{ id: 'a2', status: 'em_andamento', dataInicio: '2026-10-07T12:00:00Z', unidade: { nome: 'X' } } as never]);
    expect(r.href).toBe('/admin/auditoria/a2');
  });
});
