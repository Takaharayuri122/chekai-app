---
name: evoluir-tools-mcp
description: Evolui o catálogo de tools e scopes do servidor MCP ChekAI sem quebrar allowlist, isolamento, confirmação ou documentação. Use ao adicionar, remover ou alterar uma tool MCP, seu input, scope, perfil ou resposta.
---

# Evoluir Tools do MCP ChekAI

## Contexto

Use este fluxo porque uma tool atravessa registro, schema, autorização, service de domínio, mapper, testes e catálogo público. A fonte das regras é `docs/regras-de-negocio.md` (`RN-MCP-*`); detalhes operacionais ficam em `docs/mcp/`.

## Passo a passo

1. Leia as regras `RN-MCP-*` e confirme que a capacidade pode entrar no canal. Não exponha as capacidades permanentemente excluídas pela `RN-MCP-008`.
2. Especifique o caso de uso e escreva primeiro os testes da mudança.
3. Atualize a allowlist `MCP_TOOLS_PRIMEIRA_ONDA` em `core/mcp.types.ts`. Se houver scope novo, inclua-o em `SCOPES_OPERACIONAIS` em `oauth/oauth.constants.ts`.
4. Em `tools/mcp-tools.service.ts`:
   - declare um schema Zod explícito para o input e descarte campos fora do contrato;
   - associe nome, descrição, scope e perfis;
   - chame o service de domínio existente com o principal autenticado;
   - nunca aceite `gestorId`, `tenantId` ou `consultorId` do modelo.
5. Retorne apenas um DTO resumido por meio de `tools/mcp-tools.mappers.ts`; não devolva entidade TypeORM, segredo, token de sessão ou relação sem recorte.
6. Para ação sensível, implemente preparação + execução com `McpConfirmationService`. Exclusão, checkout e IA exigem esse fluxo.
7. Cubra ao menos:
   - catálogo em `tools/list` e execução autorizada;
   - ausência de scope e perfil incompatível;
   - input inválido e identificador de isolamento aninhado;
   - recorte MASTER/GESTOR/AUDITOR no service de domínio;
   - ausência de campos sensíveis na resposta;
   - confirmação de uso único, quando aplicável.
8. Sincronize somente os documentos afetados:
   - `docs/mcp/catalogo.md` para tool e argumentos;
   - `docs/mcp/oauth.md` para scopes;
   - `docs/mcp/exemplos.md` para um fluxo novo;
   - `docs/mcp/seguranca.md` ou `runbook.md` apenas se a operação mudar.
9. Verifique que allowlist, definições, scopes, testes e documentação têm os mesmos nomes e execute as suítes MCP da API.

## Checklist de implementação

- [ ] Regra de negócio permite a capacidade
- [ ] Testes escritos antes da implementação
- [ ] Allowlist e scope sincronizados
- [ ] Schema não aceita identificadores de isolamento
- [ ] Handler reutiliza service de domínio com o principal
- [ ] Resposta usa mapper seguro
- [ ] Ação sensível tem confirmação em duas etapas
- [ ] Testes de autorização, isolamento e vazamento passam
- [ ] Catálogo e documentação de scopes estão sincronizados

## Exemplo concreto

`chekai_finalizar_relatorio` não finaliza diretamente: `chekai_preparar_finalizacao_relatorio` gera resumo e token; a execução exige `relatorioId` e `confirmationToken`. As duas tools estão na allowlist, usam `chekai:relatorios:finalizar`, reutilizam `RelatorioTecnicoService` e possuem cobertura em `mcp-tools.service.spec.ts` e `mcp-seguranca.spec.ts`.
