import { BadRequestException, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditoriaController } from './auditoria.controller';
import { EnviarRelatorioDto } from './dto/enviar-relatorio.dto';

const usuario = { id: 'u-1', perfil: 'gestor' } as never;

function criar(auditoria: Record<string, unknown>) {
  const auditoriaService = {
    finalizarAuditoria: jest.fn().mockResolvedValue(auditoria),
    buscarAuditoriaPorId: jest.fn().mockResolvedValue(auditoria),
  };
  const envio = { enviar: jest.fn().mockResolvedValue({ id: 'e-1' }), listar: jest.fn().mockResolvedValue([]) };
  const controller = new AuditoriaController(
    auditoriaService as never,
    envio as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { controller, auditoriaService, envio };
}

describe('AuditoriaController envio do relatório', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('finalizar com a opção ligada dispara o envio automático', async () => {
    const { controller, envio } = criar({ id: 'a-1', template: { enviarRelatorioAoFinalizar: true } });
    await controller.finalizarAuditoria('a-1', {} as never, usuario);
    expect(envio.enviar).toHaveBeenCalledWith('a-1', { automatico: true });
  });

  it('finalizar com a opção desligada não envia', async () => {
    const { controller, envio } = criar({ id: 'a-1', template: { enviarRelatorioAoFinalizar: false } });
    await controller.finalizarAuditoria('a-1', {} as never, usuario);
    expect(envio.enviar).not.toHaveBeenCalled();
  });

  it('falha no envio automático não derruba a finalização', async () => {
    const { controller, envio } = criar({ id: 'a-1', template: { enviarRelatorioAoFinalizar: true } });
    envio.enviar.mockRejectedValue(new Error('boom'));
    await expect(controller.finalizarAuditoria('a-1', {} as never, usuario)).resolves.toMatchObject({ id: 'a-1' });
  });

  it('envio manual recusa auditoria não finalizada', async () => {
    const { controller, envio } = criar({ id: 'a-1', status: 'em_andamento' });
    await expect(controller.enviarRelatorio('a-1', {}, usuario)).rejects.toBeInstanceOf(BadRequestException);
    expect(envio.enviar).not.toHaveBeenCalled();
  });

  it('envio manual usa o usuário e não é automático', async () => {
    const { controller, envio } = criar({ id: 'a-1', status: 'finalizada' });
    await controller.enviarRelatorio('a-1', { destinatarios: ['a@x.com'] }, usuario);
    expect(envio.enviar).toHaveBeenCalledWith('a-1', { destinatarios: ['a@x.com'], usuario, automatico: false });
  });
});

describe('EnviarRelatorioDto', () => {
  const erros = (corpo: object) => validate(plainToInstance(EnviarRelatorioDto, corpo));

  it('aceita corpo vazio e e-mails válidos', async () => {
    expect(await erros({})).toHaveLength(0);
    expect(await erros({ destinatarios: ['a@x.com'] })).toHaveLength(0);
  });
  it('recusa e-mail inválido, lista vazia e mais de 5', async () => {
    expect(await erros({ destinatarios: ['nao-e-email'] })).not.toHaveLength(0);
    expect(await erros({ destinatarios: [] })).not.toHaveLength(0);
    expect(await erros({ destinatarios: Array(6).fill('a@x.com') })).not.toHaveLength(0);
  });
});
