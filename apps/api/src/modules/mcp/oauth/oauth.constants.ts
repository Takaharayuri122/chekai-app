import { RequestMethod } from '@nestjs/common';

export const SCOPES_OPERACIONAIS = [
  'chekai:contexto',
  'chekai:clientes:ler',
  'chekai:checklists:ler',
  'chekai:auditorias:ler',
  'chekai:auditorias:escrever',
  'chekai:auditorias:finalizar',
  'chekai:agenda:ler',
  'chekai:agenda:concluir',
  'chekai:tarefas:ler',
  'chekai:tarefas:escrever',
  'chekai:relatorios:ler',
  'chekai:relatorios:escrever',
  'chekai:relatorios:finalizar',
] as const;

export type ScopeOperacional = (typeof SCOPES_OPERACIONAIS)[number];

export const ROTAS_OAUTH_SEM_PREFIXO_API: Array<{
  path: string;
  method: RequestMethod;
}> = [
  { path: '.well-known/oauth-authorization-server', method: RequestMethod.GET },
  { path: '.well-known/oauth-protected-resource', method: RequestMethod.GET },
  { path: 'oauth/authorize', method: RequestMethod.GET },
  { path: 'oauth/authorize', method: RequestMethod.POST },
  { path: 'oauth/otp/solicitar', method: RequestMethod.POST },
  { path: 'oauth/otp/validar', method: RequestMethod.POST },
  { path: 'oauth/token', method: RequestMethod.POST },
  { path: 'oauth/revoke', method: RequestMethod.POST },
  { path: 'oauth/register', method: RequestMethod.POST },
  { path: 'mcp', method: RequestMethod.GET },
  { path: 'mcp', method: RequestMethod.POST },
];
