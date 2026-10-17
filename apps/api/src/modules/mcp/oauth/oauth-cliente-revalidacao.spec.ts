import { OauthClienteService } from './oauth-cliente.service';
import { ClienteOauth } from './oauth.types';

describe('OauthClienteService - revalidação CIMD', () => {
  it('revalida documento persistido vencido e remove redirect antigo', async () => {
    const cliente = {
      id: 'cliente-1',
      clientId: 'https://cliente.exemplo/client.json',
      nome: 'Antigo',
      redirectUris: ['https://cliente.exemplo/antigo'],
      origem: 'cimd' as const,
      documento: { redirect_uris: ['https://cliente.exemplo/antigo'] },
      atualizadoEm: new Date(Date.now() - 2 * 60 * 60 * 1000),
    };
    const repositorio = {
      buscarPorClientId: jest.fn(async () => ({ ...cliente })),
      salvar: jest.fn(async (atualizado: ClienteOauth) => { Object.assign(cliente, atualizado); }),
    };
    const cimd = {
      obter: jest.fn(async () => ({
        redirect_uris: ['https://cliente.exemplo/novo'],
        client_name: 'Atualizado',
      })),
    };
    const service = new OauthClienteService(
      repositorio,
      cimd,
      { uuid: () => 'uuid', otp: () => '123456', opaco: () => 'opaco' },
    );

    const resultado = await service.resolver(cliente.clientId);

    expect(cimd.obter).toHaveBeenCalledWith(cliente.clientId);
    expect(resultado?.redirectUris).toEqual(['https://cliente.exemplo/novo']);
    expect(repositorio.salvar).toHaveBeenCalled();
  });

  it('recusa o cliente quando a revalidação vencida falha', async () => {
    const repositorio = {
      buscarPorClientId: jest.fn(async () => ({
        id: 'cliente-1',
        clientId: 'https://cliente.exemplo/client.json',
        nome: null,
        redirectUris: ['https://cliente.exemplo/antigo'],
        origem: 'cimd' as const,
        documento: { redirect_uris: ['https://cliente.exemplo/antigo'] },
        atualizadoEm: new Date(Date.now() - 2 * 60 * 60 * 1000),
      })),
      salvar: jest.fn(),
    };
    const service = new OauthClienteService(
      repositorio,
      { obter: jest.fn(async () => null) },
      { uuid: () => 'uuid', otp: () => '123456', opaco: () => 'opaco' },
    );

    await expect(service.resolver('https://cliente.exemplo/client.json')).resolves.toBeNull();
  });
});
