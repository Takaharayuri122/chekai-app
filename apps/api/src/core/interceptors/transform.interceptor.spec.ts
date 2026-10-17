import { ExecutionContext, StreamableFile } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

function contexto(caminho: string): ExecutionContext {
  const pedido = { path: caminho, url: caminho, originalUrl: caminho };
  const resposta = { headersSent: false };
  return {
    switchToHttp: () => ({
      getRequest: () => pedido,
      getResponse: () => resposta,
    }),
  } as unknown as ExecutionContext;
}

async function transformar(caminho: string, dados: unknown): Promise<unknown> {
  const interceptor = new TransformInterceptor();
  const saida = interceptor.intercept(contexto(caminho), { handle: () => of(dados) });
  return firstValueFrom(saida);
}

describe('TransformInterceptor', () => {
  it('devolve token, registro e metadata OAuth na raiz, sem envelope', async () => {
    const token = { access_token: 'opaco', token_type: 'Bearer', expires_in: 3600 };
    const registro = { client_id: 'https://cliente.exemplo/oauth/client.json', redirect_uris: ['https://cliente.exemplo/callback'] };
    const metadata = { issuer: 'https://api.exemplo', token_endpoint: 'https://api.exemplo/oauth/token' };
    const recurso = { resource: 'https://api.exemplo/mcp', authorization_servers: ['https://api.exemplo'] };

    await expect(transformar('/oauth/token', token)).resolves.toEqual(token);
    await expect(transformar('/oauth/register', registro)).resolves.toEqual(registro);
    await expect(transformar('/oauth/authorize', { redirectPara: 'https://cliente.exemplo/callback?code=1' })).resolves.toEqual({
      redirectPara: 'https://cliente.exemplo/callback?code=1',
    });
    await expect(transformar('/oauth/otp/validar', { sessaoConsentimento: 'sessao' })).resolves.toEqual({
      sessaoConsentimento: 'sessao',
    });
    await expect(transformar('/.well-known/oauth-authorization-server', metadata)).resolves.toEqual(metadata);
    await expect(transformar('/.well-known/oauth-protected-resource?x=1', recurso)).resolves.toEqual(recurso);
  });

  it('continua envolvendo a resposta das rotas da API', async () => {
    const saida = await transformar('/api/auditorias', { id: 'aud-1' });

    expect(saida).toMatchObject({
      success: true,
      data: { id: 'aud-1' },
    });
  });

  it('não envolve arquivo binário', async () => {
    const arquivo = new StreamableFile(Buffer.from('pdf'));

    await expect(transformar('/api/auditorias/1/pdf', arquivo)).resolves.toBe(arquivo);
  });
});
