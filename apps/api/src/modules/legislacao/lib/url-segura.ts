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
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

/** Expande um IPv6 válido para 8 grupos numéricos (aceita "::" e cauda IPv4). */
function expandirIpv6(ip: string): number[] {
  let texto = ip;
  const cauda = texto.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (cauda) {
    const [, a, b, c, d] = cauda.map(Number);
    texto =
      texto.slice(0, texto.length - cauda[0].length) +
      `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [esq, dir] = texto.split('::');
  const g1 = esq ? esq.split(':') : [];
  const g2 = dir === undefined ? [] : dir ? dir.split(':') : [];
  const meio = dir === undefined ? [] : Array(8 - g1.length - g2.length).fill('0');
  return [...g1, ...meio, ...g2].map((g) => parseInt(g, 16));
}

function v4DosGrupos(alto: number, baixo: number): string {
  return `${alto >> 8}.${alto & 255}.${baixo >> 8}.${baixo & 255}`;
}

/**
 * Indica se o IP é privado, loopback, link-local, reservado ou inválido (tratado como inseguro).
 */
export function ipPrivado(ip: string): boolean {
  const endereco = ip.trim().toLowerCase();
  const versao = isIP(endereco);
  if (versao === 4) return ipv4Privado(endereco);
  if (versao !== 6) return true;

  const g = expandirIpv6(endereco);
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return ipv4Privado(v4DosGrupos(g[6], g[7]));
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return ipv4Privado(v4DosGrupos(g[6], g[7]));
  }
  if (g[0] === 0x2002) return ipv4Privado(v4DosGrupos(g[1], g[2]));
  return (
    g[0] >> 8 === 0 || // ::/8 (inclui ::, ::1 e IPv4-compatível)
    (g[0] === 0x2001 && g[1] === 0x0db8) || // documentação
    (g[0] & 0xfe00) === 0xfc00 || // fc00::/7 (ULA)
    (g[0] & 0xffc0) === 0xfe80 || // fe80::/10 (link-local)
    (g[0] & 0xff00) === 0xff00 // ff00::/8 (multicast)
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
