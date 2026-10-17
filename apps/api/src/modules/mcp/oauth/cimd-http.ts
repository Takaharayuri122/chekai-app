import { lookup } from 'node:dns/promises';
import { request as requisicaoHttps, RequestOptions } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { Injectable, Logger } from '@nestjs/common';
import { DocumentoCimd, OauthCimdPorta } from './oauth.types';

const TIMEOUT_MS = 5000;
const TAMANHO_MAXIMO_BYTES = 64 * 1024;

const BLOQUEIO = new BlockList();

function faixa4(rede: string, prefixo: number): void {
  BLOQUEIO.addSubnet(rede, prefixo, 'ipv4');
}

function faixa6(rede: string, prefixo: number): void {
  BLOQUEIO.addSubnet(rede, prefixo, 'ipv6');
}

faixa4('0.0.0.0', 8);
faixa4('10.0.0.0', 8);
faixa4('100.64.0.0', 10);
faixa4('127.0.0.0', 8);
faixa4('169.254.0.0', 16);
faixa4('172.16.0.0', 12);
faixa4('192.0.0.0', 24);
faixa4('192.0.2.0', 24);
faixa4('192.168.0.0', 16);
faixa4('192.88.99.0', 24);
faixa4('198.18.0.0', 15);
faixa4('198.51.100.0', 24);
faixa4('203.0.113.0', 24);
faixa4('224.0.0.0', 4);
faixa4('240.0.0.0', 4);
faixa6('64:ff9b:1::', 48);
faixa6('100::', 64);
faixa6('2001:2::', 48);
faixa6('2001:db8::', 32);
faixa6('fc00::', 7);
faixa6('fe80::', 10);
faixa6('fec0::', 10);
faixa6('ff00::', 8);
BLOQUEIO.addAddress('::', 'ipv6');
BLOQUEIO.addAddress('::1', 'ipv6');

function hostnameLimpo(hostname: string): string {
  const semColchetes = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  return semColchetes.toLowerCase().replace(/\.$/, '');
}

function hostNomeBloqueado(hostname: string): boolean {
  const nome = hostname.toLowerCase().replace(/\.$/, '');
  return !nome
    || nome === 'localhost'
    || nome.endsWith('.localhost')
    || nome.endsWith('.local')
    || nome.endsWith('.internal');
}

function palavrasIpv6(ip: string): number[] | null {
  if (isIP(ip) !== 6) return null;
  const divisor = ip.indexOf('::');
  const ler = (trecho: string): number[] | null => {
    if (!trecho) return [];
    const saida: number[] = [];
    for (const bloco of trecho.split(':')) {
      if (bloco.includes('.')) {
        const octetos = bloco.split('.').map((parte) => Number(parte));
        if (octetos.length !== 4 || octetos.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
        saida.push(octetos[0] * 256 + octetos[1], octetos[2] * 256 + octetos[3]);
      } else if (!/^[0-9a-f]{1,4}$/i.test(bloco)) {
        return null;
      } else {
        saida.push(parseInt(bloco, 16));
      }
    }
    return saida;
  };
  if (divisor === -1) {
    const palavras = ler(ip);
    return palavras && palavras.length === 8 ? palavras : null;
  }
  const esquerda = ler(ip.slice(0, divisor));
  const direita = ler(ip.slice(divisor + 2));
  if (!esquerda || !direita) return null;
  const faltam = 8 - esquerda.length - direita.length;
  if (faltam < 0) return null;
  return [...esquerda, ...new Array<number>(faltam).fill(0), ...direita];
}

function ipv4DePalavras(alto: number, baixo: number): string {
  return [
    Math.floor(alto / 256),
    alto % 256,
    Math.floor(baixo / 256),
    baixo % 256,
  ].join('.');
}

function enderecoBloqueado(ip: string): boolean {
  const versao = isIP(ip);
  if (versao === 4) return BLOQUEIO.check(ip, 'ipv4');
  if (versao !== 6) return true;
  const palavras = palavrasIpv6(ip);
  if (!palavras) return true;
  const mapeado = palavras.slice(0, 5).every((parte) => parte === 0) && palavras[5] === 0xffff;
  const nat64 = palavras[0] === 0x64 && palavras[1] === 0xff9b
    && palavras.slice(2, 6).every((parte) => parte === 0);
  if (mapeado || nat64) return enderecoBloqueado(ipv4DePalavras(palavras[6], palavras[7]));
  return BLOQUEIO.check(ip, 'ipv6');
}

interface CorpoHttp {
  status: number;
  header(nome: string): string | null;
  texto: string;
}

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
    const nome = hostnameLimpo(url.hostname);
    if (hostNomeBloqueado(nome) || (isIP(nome) !== 0 && enderecoBloqueado(nome))) {
      return null;
    }

    let enderecos: string[];
    try {
      const registros = await lookup(nome, { all: true, verbatim: true });
      enderecos = registros.map((item) => item.address);
    } catch {
      return null;
    }
    if (!enderecos.length || enderecos.some((ip) => enderecoBloqueado(ip))) return null;

    try {
      const resposta = await this.baixar(url, enderecos[0]);
      if (resposta.status < 200 || resposta.status >= 300) return null;
      const tamanho = Number(resposta.header('content-length') ?? 0);
      if (tamanho > TAMANHO_MAXIMO_BYTES) return null;
      if (Buffer.byteLength(resposta.texto, 'utf8') > TAMANHO_MAXIMO_BYTES) return null;
      return this.validar(JSON.parse(resposta.texto) as unknown, clientId);
    } catch (erro) {
      this.logger.warn(`Falha ao obter Client ID Metadata Document de ${clientId}: ${String(erro)}`);
      return null;
    }
  }

  private baixar(url: URL, ip: string): Promise<CorpoHttp> {
    const familia = isIP(ip);
    const opcoes: RequestOptions = {
      protocol: 'https:',
      hostname: ip,
      servername: hostnameLimpo(url.hostname),
      port: url.port ? Number(url.port) : 443,
      method: 'GET',
      path: `${url.pathname}${url.search}`,
      headers: {
        Accept: 'application/json',
        Host: url.host,
      },
      family: familia === 6 ? 6 : 4,
      rejectUnauthorized: true,
      timeout: TIMEOUT_MS,
    };
    return new Promise((resolve, reject) => {
      let encerrado = false;
      const limiteAbsoluto = setTimeout(() => pedido.destroy(new Error('timeout')), TIMEOUT_MS);
      const falhar = (erro: Error) => {
        if (encerrado) return;
        encerrado = true;
        clearTimeout(limiteAbsoluto);
        reject(erro);
      };
      const pedido = requisicaoHttps(opcoes, (res) => {
        const pedacos: Buffer[] = [];
        let tamanho = 0;
        res.on('data', (pedaco: Buffer) => {
          tamanho += pedaco.length;
          if (tamanho > TAMANHO_MAXIMO_BYTES) {
            res.destroy(new Error('documento CIMD excede 64 KB'));
            return;
          }
          pedacos.push(pedaco);
        });
        res.on('end', () => {
          if (encerrado) return;
          encerrado = true;
          clearTimeout(limiteAbsoluto);
          const bruto = res.headers['content-length'];
          const contentLength = Array.isArray(bruto) ? bruto[0] ?? null : bruto ?? null;
          resolve({
            status: res.statusCode ?? 0,
            header: (nome: string) => (nome.toLowerCase() === 'content-length' ? contentLength : null),
            texto: Buffer.concat(pedacos).toString('utf8'),
          });
        });
        res.on('error', (erro) => falhar(erro));
      });
      pedido.on('error', (erro) => falhar(erro));
      pedido.on('timeout', () => {
        pedido.destroy(new Error('timeout'));
      });
      pedido.end();
    });
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
