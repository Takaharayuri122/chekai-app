import { promises as dns } from 'dns';
import { isIP } from 'net';

/**
 * Link recusado (formato, protocolo ou destino não público).
 */
export class LinkInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkInvalidoError';
  }
}

/**
 * Apara, valida e normaliza o link: host em minúsculas, sem âncora e sem barra final.
 */
export function normalizarLink(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL((url ?? '').trim());
  } catch {
    throw new LinkInvalidoError('O link informado é inválido.');
  }
  parsed.hash = '';
  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  }
  const texto = parsed.toString();
  return parsed.pathname === '/' && !parsed.search ? texto.replace(/\/$/, '') : texto;
}

function ipv4Privado(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/**
 * Indica se o IP é privado, loopback, link-local, reservado ou inválido (tratado como inseguro).
 */
export function ipPrivado(ip: string): boolean {
  const endereco = ip.trim().toLowerCase();
  const versao = isIP(endereco);
  if (versao === 4) return ipv4Privado(endereco);
  if (versao !== 6) return true;

  const mapeadoPontos = endereco.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeadoPontos) return ipv4Privado(mapeadoPontos[1]);
  const mapeadoHex = endereco.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapeadoHex) {
    const alto = parseInt(mapeadoHex[1], 16);
    const baixo = parseInt(mapeadoHex[2], 16);
    return ipv4Privado(`${alto >> 8}.${alto & 255}.${baixo >> 8}.${baixo & 255}`);
  }
  if (endereco === '::' || endereco === '::1') return true;

  const primeiro = parseInt(endereco.split(':')[0] || '0', 16);
  return (
    (primeiro & 0xfe00) === 0xfc00 || // fc00::/7 (ULA)
    (primeiro & 0xffc0) === 0xfe80 || // fe80::/10 (link-local)
    (primeiro & 0xff00) === 0xff00 // ff00::/8 (multicast)
  );
}

async function resolverDns(host: string): Promise<string[]> {
  const enderecos = await dns.lookup(host, { all: true });
  return enderecos.map((e) => e.address);
}

/**
 * Valida que a URL é http/https e que o destino resolve apenas para IPs públicos (anti-SSRF).
 */
export async function validarUrlPublica(
  url: string,
  resolver: (host: string) => Promise<string[]> = resolverDns,
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new LinkInvalidoError('O link informado é inválido.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new LinkInvalidoError('Use um link que comece com http:// ou https://.');
  }
  if (parsed.username || parsed.password) {
    throw new LinkInvalidoError('O link não pode conter usuário ou senha.');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  let enderecos: string[];
  if (isIP(host)) {
    enderecos = [host];
  } else {
    try {
      enderecos = await resolver(host);
    } catch {
      throw new LinkInvalidoError('Não foi possível encontrar o endereço deste link.');
    }
  }
  if (enderecos.length === 0 || enderecos.some(ipPrivado)) {
    throw new LinkInvalidoError('Este link não é um endereço público permitido.');
  }
  return parsed;
}
