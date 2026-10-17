# Casos de Uso — Consentimento OAuth do canal MCP

A especificação do domínio está em `apps/api/src/modules/mcp/use-cases/servidor-mcp.use-cases.md`.

Este caminho cobre só a tela web `/oauth/autorizar` do UC-01: e-mail, OTP e consentimento dos scopes operacionais, preservando `state`, PKCE e `redirect_uri`.

- **UC-01** (RN-AUTH-001, RN-AUTH-003, RN-AUTH-004, RN-AUTH-007, RN-AUTH-009, RN-AUTH-010, RN-MCP-001, RN-MCP-002, RN-MCP-005): fluxo principal e FA-01 a FA-08 que passam pela tela.
- Mobile não possui esta tela e não autentica o canal MCP (RN-MCP-009).
