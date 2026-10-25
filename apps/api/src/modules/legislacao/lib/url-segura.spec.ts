import { ipPrivado, LinkInvalidoError, normalizarLink, validarUrlPublica } from './url-segura';

describe('ipPrivado', () => {
  it.each([
    '10.0.0.1',
    '172.16.5.4',
    '192.168.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('%s é privado', (ip) => {
    expect(ipPrivado(ip)).toBe(true);
  });

  it('IP público não é privado', () => {
    expect(ipPrivado('200.152.32.1')).toBe(false);
    expect(ipPrivado('2804:14d::1')).toBe(false);
  });
});

describe('validarUrlPublica', () => {
  it('rejeita protocolo diferente de http/https', async () => {
    await expect(validarUrlPublica('ftp://x')).rejects.toBeInstanceOf(LinkInvalidoError);
  });

  it('rejeita host que resolve para IP privado', async () => {
    await expect(validarUrlPublica('https://a.gov.br', async () => ['10.1.1.1'])).rejects.toThrow(
      LinkInvalidoError,
    );
  });

  it('rejeita IP literal privado sem consultar DNS', async () => {
    const resolver = jest.fn();
    await expect(validarUrlPublica('http://127.0.0.1/x', resolver)).rejects.toThrow(
      LinkInvalidoError,
    );
    expect(resolver).not.toHaveBeenCalled();
  });

  it('aceita host público', async () => {
    const url = await validarUrlPublica('https://a.gov.br/x', async () => ['200.152.32.1']);
    expect(url.hostname).toBe('a.gov.br');
  });
});

describe('normalizarLink', () => {
  it('apara, normaliza host, remove âncora e barra final', () => {
    expect(normalizarLink(' https://A.gov.br/x/#top ')).toBe('https://a.gov.br/x');
  });

  it('mantém a query', () => {
    expect(normalizarLink('https://a.gov.br/x?id=1')).toBe('https://a.gov.br/x?id=1');
  });

  it('lança erro para link inválido', () => {
    expect(() => normalizarLink('não é link')).toThrow(LinkInvalidoError);
  });
});
