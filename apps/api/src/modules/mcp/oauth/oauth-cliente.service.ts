import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ClienteOauth,
  OauthCimdPorta,
  OauthClienteRepositorio,
  SegredoPorta,
} from './oauth.types';

@Injectable()
export class OauthClienteService {
  constructor(
    private readonly repositorio: OauthClienteRepositorio,
    private readonly cimd: OauthCimdPorta,
    private readonly segredos: SegredoPorta,
  ) {}

  async resolver(clientId: string): Promise<ClienteOauth | null> {
    if (!clientId) return null;
    const existente = await this.repositorio.buscarPorClientId(clientId);
    if (existente) return existente;
    if (!clientId.startsWith('https://')) return null;

    const documento = await this.cimd.obter(clientId);
    if (!documento?.redirect_uris?.length) return null;
    const cliente: ClienteOauth = {
      id: this.segredos.uuid(),
      clientId,
      nome: documento.client_name ?? null,
      redirectUris: [...documento.redirect_uris],
      origem: 'cimd',
      documento,
    };
    await this.repositorio.salvar(cliente);
    return cliente;
  }

  async registrar(input: {
    clientName?: string;
    redirectUris: string[];
  }): Promise<{ client_id: string }> {
    if (!Array.isArray(input.redirectUris) || !input.redirectUris.length) {
      throw new BadRequestException('redirect_uris é obrigatório');
    }
    input.redirectUris.forEach((uri) => this.validarRedirect(uri));
    const clientId = this.segredos.uuid();
    await this.repositorio.salvar({
      id: this.segredos.uuid(),
      clientId,
      nome: input.clientName ?? null,
      redirectUris: [...input.redirectUris],
      origem: 'registro',
      documento: null,
    });
    return { client_id: clientId };
  }

  private validarRedirect(uri: unknown): void {
    if (typeof uri !== 'string') throw new BadRequestException('redirect_uri inválida');
    try {
      const url = new URL(uri);
      if (!['https:', 'http:'].includes(url.protocol) || url.hash) throw new Error();
    } catch {
      throw new BadRequestException('redirect_uri inválida');
    }
  }
}
