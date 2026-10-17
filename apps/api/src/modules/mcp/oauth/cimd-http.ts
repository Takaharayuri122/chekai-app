import { Injectable, Logger } from '@nestjs/common';
import { DocumentoCimd, OauthCimdPorta } from './oauth.types';

const TIMEOUT_MS = 5000;
const TAMANHO_MAXIMO_BYTES = 64 * 1024;

@Injectable()
export class CimdHttp extends OauthCimdPorta {
  private readonly logger = new Logger(CimdHttp.name);

  async obter(clientId: string): Promise<DocumentoCimd | null> {
    let url: URL;
    try {
      url = new URL(clientId);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password) return null;

    try {
      const resposta = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) return null;
      const tamanho = Number(resposta.headers.get('content-length') ?? 0);
      if (tamanho > TAMANHO_MAXIMO_BYTES) return null;
      const texto = await resposta.text();
      if (Buffer.byteLength(texto, 'utf8') > TAMANHO_MAXIMO_BYTES) return null;
      return this.validar(JSON.parse(texto) as unknown, clientId);
    } catch (erro) {
      this.logger.warn(`Falha ao obter Client ID Metadata Document de ${clientId}: ${String(erro)}`);
      return null;
    }
  }

  private validar(corpo: unknown, clientId: string): DocumentoCimd | null {
    if (!corpo || typeof corpo !== 'object') return null;
    const documento = corpo as Record<string, unknown>;
    if (documento.client_id !== undefined && documento.client_id !== clientId) return null;
    const redirects = documento.redirect_uris;
    if (!Array.isArray(redirects) || !redirects.length) return null;
    if (!redirects.every((uri): uri is string => typeof uri === 'string' && uri.length > 0)) return null;
    const resultado: DocumentoCimd = { redirect_uris: redirects };
    if (typeof documento.client_name === 'string') resultado.client_name = documento.client_name;
    return resultado;
  }
}
