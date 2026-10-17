import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function capturar(url = '/oauth/token', method = 'POST') {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url, method }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filtro = new HttpExceptionFilter();

  it('preserva error e error_description dos erros OAuth', () => {
    const { host, status, json } = capturar();
    const erro = new HttpException(
      { error: 'invalid_grant', error_description: 'Authorization code inválido' },
      HttpStatus.BAD_REQUEST,
    );

    filtro.catch(erro, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'invalid_grant',
      error_description: 'Authorization code inválido',
      message: 'Authorization code inválido',
    }));
  });

  it('mantém a mensagem dos erros que não são do protocolo OAuth', () => {
    const { host, json } = capturar('/api/auditorias', 'POST');

    filtro.catch(new BadRequestException('E-mail é obrigatório'), host);

    const corpo = json.mock.calls[0][0] as { message: string; error_description?: string };
    expect(corpo.message).toBe('E-mail é obrigatório');
    expect(corpo.error_description).toBeUndefined();
  });
});
