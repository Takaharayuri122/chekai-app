import * as http from 'http';
import * as https from 'https';
import { lookup as dnsLookup, LookupAddress } from 'dns';
import { LookupFunction } from 'net';
import { Readable } from 'stream';
import * as zlib from 'zlib';
import { ipPrivado, LinkInvalidoError } from './url-segura';

/**
 * Resposta mínima de uma requisição HTTP (um salto, sem seguir redirects).
 * `headers` tem os nomes em minúsculas; `body` é o corpo já descomprimido.
 */
export interface RespostaHttp {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Buffer | Uint8Array>;
  /** Libera a conexão quando o corpo não vai ser lido (ex.: redirect). */
  descartar?: () => void;
}

/**
 * Função de busca injetável: faz um único GET, sem seguir redirects.
 */
export type BuscarFn = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<RespostaHttp>;

type ResolverTodos = (
  host: string,
  callback: (err: NodeJS.ErrnoException | null, enderecos: LookupAddress[]) => void,
) => void;

const resolverPadrao: ResolverTodos = (host, callback) =>
  dnsLookup(host, { all: true }, callback);

/**
 * `lookup` para http/https que resolve o host, recusa se algum IP não for público e conecta
 * nesse mesmo IP (evita DNS rebinding entre a validação e a conexão).
 */
export function criarLookupSeguro(resolver: ResolverTodos = resolverPadrao): LookupFunction {
  return (hostname, options, callback) => {
    resolver(hostname, (err, enderecos) => {
      if (err) {
        callback(err, '', 4);
        return;
      }
      if (!enderecos.length || enderecos.some((e) => ipPrivado(e.address))) {
        callback(new LinkInvalidoError('Este link não é um endereço público permitido.'), '', 4);
        return;
      }
      const familia = options?.family === 4 || options?.family === 6 ? options.family : null;
      const candidatos = familia ? enderecos.filter((e) => e.family === familia) : enderecos;
      const escolhidos = candidatos.length ? candidatos : enderecos;
      if (options?.all) {
        (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, escolhidos);
        return;
      }
      callback(null, escolhidos[0].address, escolhidos[0].family);
    });
  };
}

function descomprimir(res: http.IncomingMessage): Readable {
  const codificacao = String(res.headers['content-encoding'] ?? '').toLowerCase().trim();
  if (codificacao === 'gzip' || codificacao === 'x-gzip') return res.pipe(zlib.createGunzip());
  if (codificacao === 'deflate') return res.pipe(zlib.createInflate());
  if (codificacao === 'br') return res.pipe(zlib.createBrotliDecompress());
  return res;
}

/**
 * Busca padrão com `http/https.request` e `lookup` seguro (um salto, sem seguir redirects).
 */
export const buscarHttp: BuscarFn = (url, init) =>
  new Promise<RespostaHttp>((resolve, reject) => {
    const alvo = new URL(url);
    const modulo = alvo.protocol === 'https:' ? https : http;
    const req = modulo.request(
      alvo,
      {
        method: 'GET',
        headers: { ...init.headers, 'Accept-Encoding': 'gzip, deflate, br' },
        lookup: criarLookupSeguro(),
        signal: init.signal,
      },
      (res) => {
        const corpo = descomprimir(res);
        corpo.on('error', () => undefined);
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: corpo,
          descartar: () => res.destroy(),
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
