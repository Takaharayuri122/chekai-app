import { EventEmitter } from 'node:events';
import { request as httpsRequest } from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { CimdHttp } from './cimd-http';

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

jest.mock('node:https', () => ({
  request: jest.fn(),
}));

const lookupMock = lookup as unknown as jest.Mock;
const requestMock = httpsRequest as unknown as jest.Mock;
const DOCUMENTO = {
  client_id: 'https://cliente.exemplo/oauth/client.json',
  redirect_uris: ['https://cliente.exemplo/callback'],
  client_name: 'Cliente',
};

function respostaHttps(corpo: string) {
  const resposta = new EventEmitter() as EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
    destroy: (erro: Error) => void;
  };
  resposta.statusCode = 200;
  resposta.headers = { 'content-length': String(Buffer.byteLength(corpo)) };
  resposta.destroy = (erro) => resposta.emit('error', erro);
  return resposta;
}

describe('CimdHttp', () => {
  let fetchSpy: jest.SpyInstance;
  let corpoHttps = '{}';

  beforeEach(() => {
    corpoHttps = '{}';
    lookupMock.mockReset();
    requestMock.mockReset();
    lookupMock.mockImplementation(async (host: string) => {
      const familia = isIP(host);
      if (familia) return [{ address: host, family: familia }];
      throw new Error(`ENOTFOUND ${host}`);
    });
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: { get: () => String(Buffer.byteLength(JSON.stringify(DOCUMENTO))) },
      text: async () => JSON.stringify(DOCUMENTO),
    } as unknown as Response);
    requestMock.mockImplementation(((_opcoes: unknown, callback: (res: EventEmitter) => void) => {
      const pedido = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
      pedido.end = () => undefined;
      pedido.destroy = () => undefined;
      const resposta = respostaHttps(corpoHttps);
      process.nextTick(() => {
        callback(resposta);
        resposta.emit('data', Buffer.from(corpoHttps));
        resposta.emit('end');
      });
      return pedido;
    }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  async function obter(url: string) {
    return new CimdHttp().obter(url);
  }

  it.each([
    'https://127.0.0.1/client.json',
    'https://10.1.2.3/client.json',
    'https://192.168.0.5/client.json',
    'https://172.16.0.1/client.json',
    'https://169.254.169.254/client.json',
    'https://0.0.0.0/client.json',
    'https://100.64.0.1/client.json',
    'https://192.0.2.1/client.json',
    'https://198.51.100.1/client.json',
    'https://203.0.113.1/client.json',
    'https://224.0.0.1/client.json',
    'https://240.0.0.1/client.json',
    'https://255.255.255.255/client.json',
    'https://[::1]/client.json',
    'https://[fd00::1]/client.json',
    'https://[fe80::1]/client.json',
    'https://[::ffff:10.1.2.3]/client.json',
    'https://localhost/client.json',
    'https://app.localhost/client.json',
    'https://printer.local/client.json',
    'https://meta.internal/client.json',
  ])('não busca Client ID Metadata em %s', async (url) => {
    lookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);

    await expect(obter(url)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('rejeita o host quando algum endereço resolvido é privado', async () => {
    lookupMock.mockResolvedValue([
      { address: '1.1.1.1', family: 4 },
      { address: '10.0.0.8', family: 4 },
    ]);

    await expect(obter('https://cliente.exemplo/oauth/client.json')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('rejeita o host quando a resolução DNS falha ou não devolve endereço', async () => {
    lookupMock.mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(obter('https://ausente.exemplo/oauth/client.json')).resolves.toBeNull();

    lookupMock.mockResolvedValueOnce([]);
    await expect(obter('https://vazio.exemplo/oauth/client.json')).resolves.toBeNull();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('busca o documento no IP público resolvido, com o nome original no TLS', async () => {
    lookupMock.mockResolvedValue([{ address: '1.1.1.1', family: 4 }]);
    corpoHttps = JSON.stringify(DOCUMENTO);

    await expect(obter('https://cliente.exemplo/oauth/client.json')).resolves.toEqual({
      redirect_uris: ['https://cliente.exemplo/callback'],
      client_name: 'Cliente',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '1.1.1.1',
        servername: 'cliente.exemplo',
      }),
      expect.any(Function),
    );
  });

  it('ainda busca endereço público fora das faixas privadas', async () => {
    await obter('https://8.8.8.8/client.json');
    await obter('https://172.32.0.1/client.json');
    await obter('https://[::ffff:8.8.8.8]/client.json');

    const destinos = requestMock.mock.calls.map((chamada) => (chamada[0] as { hostname?: string }).hostname);
    expect(destinos).toEqual(expect.arrayContaining(['8.8.8.8', '172.32.0.1', '::ffff:808:808']));
  });

  it('interrompe o stream antes de acumular documento maior que 64 KB', async () => {
    lookupMock.mockResolvedValue([{ address: '1.1.1.1', family: 4 }]);
    corpoHttps = 'x'.repeat(64 * 1024 + 1);

    await expect(obter('https://cliente.exemplo/oauth/client.json')).resolves.toBeNull();
  });
});
