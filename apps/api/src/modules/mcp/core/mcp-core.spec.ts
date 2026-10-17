import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { McpConfirmationService } from './mcp-confirmation.service';
import { McpRegistryService } from './mcp-registry.service';

const principal = {
  id: 'usuario-1',
  nome: 'Usuária',
  email: 'u@exemplo.com',
  perfil: PerfilUsuario.GESTOR,
  gestorId: 'usuario-1',
  tenantId: 'usuario-1',
  scopes: ['chekai:contexto', 'chekai:clientes:ler'],
};

describe('UC-03: registry MCP deny-by-default', () => {
  it('filtra o catálogo por scope e repete a autorização na chamada', async () => {
    const contexto = jest.fn(async () => ({ id: principal.id }));
    const clientes = jest.fn(async () => []);
    const registry = new McpRegistryService([
      {
        nome: 'chekai_me',
        descricao: 'Contexto',
        scope: 'chekai:contexto',
        perfis: Object.values(PerfilUsuario),
        handler: contexto,
      },
      {
        nome: 'chekai_listar_clientes',
        descricao: 'Clientes',
        scope: 'chekai:clientes:ler',
        perfis: Object.values(PerfilUsuario),
        handler: clientes,
      },
      {
        nome: 'chekai_admin',
        descricao: 'Inválida',
        scope: 'chekai:admin',
        perfis: [PerfilUsuario.MASTER],
        handler: jest.fn(),
      },
    ]);

    expect(registry.listar({ ...principal, scopes: ['chekai:contexto'] }).map((t) => t.nome))
      .toEqual(['chekai_me']);
    await expect(registry.executar('chekai_listar_clientes', {}, {
      ...principal,
      scopes: ['chekai:contexto'],
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(registry.executar('chekai_admin', {}, principal))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(clientes).not.toHaveBeenCalled();
  });

  it('recusa identificadores de isolamento enviados pelo modelo', async () => {
    const handler = jest.fn();
    const registry = new McpRegistryService([{
      nome: 'chekai_me',
      descricao: 'Contexto',
      scope: 'chekai:contexto',
      perfis: Object.values(PerfilUsuario),
      handler,
    }]);

    for (const campo of ['gestorId', 'tenantId', 'consultorId']) {
      await expect(registry.executar('chekai_me', { filtro: { [campo]: 'outro' } }, principal))
        .rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('RN-MCP-007: confirmação em duas etapas', () => {
  it('amarra o token ao usuário, recurso e ação e permite um único uso por até 10 minutos', () => {
    let agora = new Date('2026-01-01T00:00:00Z');
    let sequencia = 0;
    const service = new McpConfirmationService(
      { agora: () => new Date(agora) },
      { opaco: () => `confirmacao-${++sequencia}` },
    );
    const preparada = service.preparar({
      usuarioId: 'u1',
      acao: 'finalizar_auditoria',
      recursoId: 'a1',
      resumo: { pendencias: 0 },
    });

    expect(preparada.resumo).toEqual({ pendencias: 0 });
    expect(() => service.consumir(preparada.token, {
      usuarioId: 'u2', acao: 'finalizar_auditoria', recursoId: 'a1',
    })).toThrow(UnauthorizedException);
    expect(() => service.consumir(preparada.token, {
      usuarioId: 'u1', acao: 'finalizar_auditoria', recursoId: 'a1',
    })).not.toThrow();
    expect(() => service.consumir(preparada.token, {
      usuarioId: 'u1', acao: 'finalizar_auditoria', recursoId: 'a1',
    })).toThrow(UnauthorizedException);

    const expira = service.preparar({
      usuarioId: 'u1', acao: 'finalizar_relatorio', recursoId: 'r1', resumo: {},
    });
    agora = new Date(agora.getTime() + 10 * 60 * 1000 + 1);
    expect(() => service.consumir(expira.token, {
      usuarioId: 'u1', acao: 'finalizar_relatorio', recursoId: 'r1',
    })).toThrow(UnauthorizedException);
  });
});
