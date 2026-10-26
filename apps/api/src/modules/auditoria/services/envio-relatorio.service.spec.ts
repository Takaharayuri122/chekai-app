import { Logger } from '@nestjs/common';
import { EnvioRelatorioService } from './envio-relatorio.service';

const MB = 1024 * 1024;

function auditoriaBase(extra: Record<string, unknown> = {}) {
  return {
    id: 'abcdef12-0000-0000-0000-000000000000',
    dataFim: new Date('2026-10-20T15:00:00Z'),
    unidade: { nome: 'Loja Centro', email: 'unidade@x.com', cliente: { email: 'cliente@x.com' } },
    template: { nome: 'Boas práticas' },
    consultor: { nome: 'Maria' },
    ...extra,
  };
}

function criar(auditoria: Record<string, unknown>, tamanhoPdf = 1 * MB) {
  const repo = {
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 'e-1', ...v })),
    find: jest.fn(),
  };
  const auditoriaService = { buscarAuditoriaPorId: jest.fn().mockResolvedValue(auditoria) };
  const pdfService = {
    obterPdf: jest.fn().mockResolvedValue({
      buffer: Buffer.alloc(tamanhoPdf),
      url: 'https://x.supabase.co/storage/v1/object/public/relatorios/auditorias/a-1/r.pdf',
      auditoria,
    }),
  };
  const resultadoService = {
    calcular: jest.fn().mockResolvedValue({ aproveitamento: 82.5, classificacao: { nome: 'Bom' } }),
  };
  const emailService = { enviarEmailRelatorioAuditoria: jest.fn().mockResolvedValue(undefined) };
  const createSignedUrl = jest.fn().mockResolvedValue({ data: { signedUrl: 'https://assinado' }, error: null });
  const supabase = { getClient: () => ({ storage: { from: () => ({ createSignedUrl }) } }) };
  const service = new EnvioRelatorioService(
    repo as never,
    auditoriaService as never,
    pdfService as never,
    resultadoService as never,
    emailService as never,
    supabase as never,
    { get: () => undefined } as never,
  );
  return { service, repo, emailService, createSignedUrl, pdfService };
}

describe('EnvioRelatorioService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  describe('destinatariosPadrao', () => {
    const { service } = criar(auditoriaBase());
    it('usa o e-mail da unidade', () => {
      expect(service.destinatariosPadrao(auditoriaBase() as never)).toEqual(['unidade@x.com']);
    });
    it('cai para o e-mail do cliente', () => {
      const a = auditoriaBase({ unidade: { email: null, cliente: { email: 'cliente@x.com' } } });
      expect(service.destinatariosPadrao(a as never)).toEqual(['cliente@x.com']);
    });
    it('devolve vazio sem e-mail', () => {
      const a = auditoriaBase({ unidade: { email: '', cliente: { email: null } } });
      expect(service.destinatariosPadrao(a as never)).toEqual([]);
    });
  });

  describe('enviar', () => {
    it('anexa o PDF quando tem até 8 MB', async () => {
      const { service, emailService, createSignedUrl } = criar(auditoriaBase());
      const registro = await service.enviar('a-1', { automatico: true });
      const dados = emailService.enviarEmailRelatorioAuditoria.mock.calls[0];
      expect(dados[0]).toEqual(['unidade@x.com']);
      expect(dados[1].link).toBeUndefined();
      expect(dados[1].codigo).toBe('ABCDEF12');
      expect(dados[1].resultado).toBe('82,5% — Bom');
      expect(dados[1].data).toBe('20/10/2026');
      expect(createSignedUrl).not.toHaveBeenCalled();
      expect(registro).toMatchObject({ sucesso: true, automatico: true, destinatarios: ['unidade@x.com'], enviadoPorId: null });
    });

    it('manda link assinado de 30 dias quando o PDF tem 9 MB', async () => {
      const { service, emailService, createSignedUrl } = criar(auditoriaBase(), 9 * MB);
      await service.enviar('a-1', { automatico: false, usuario: { id: 'u-1' } as never });
      expect(createSignedUrl).toHaveBeenCalledWith('auditorias/a-1/r.pdf', 2592000);
      expect(emailService.enviarEmailRelatorioAuditoria.mock.calls[0][1].link.url).toBe('https://assinado');
    });

    it('grava falha e resolve quando o e-mail falha', async () => {
      const { service, emailService } = criar(auditoriaBase());
      emailService.enviarEmailRelatorioAuditoria.mockRejectedValue(new Error('smtp fora'));
      const registro = await service.enviar('a-1', { automatico: true });
      expect(registro).toMatchObject({ sucesso: false, erro: 'smtp fora' });
    });

    it('grava falha sem destinatário e não gera PDF', async () => {
      const a = auditoriaBase({ unidade: { nome: 'L', email: null, cliente: { email: null } } });
      const { service, pdfService } = criar(a);
      const registro = await service.enviar('a-1', { automatico: true });
      expect(registro).toMatchObject({ sucesso: false, erro: 'Unidade e cliente sem e-mail cadastrado', destinatarios: [] });
      expect(pdfService.obterPdf).not.toHaveBeenCalled();
    });

    it('usa os destinatários informados e registra quem enviou', async () => {
      const { service, emailService } = criar(auditoriaBase());
      const registro = await service.enviar('a-1', { destinatarios: ['a@x.com', 'b@x.com'], automatico: false, usuario: { id: 'u-1' } as never });
      expect(emailService.enviarEmailRelatorioAuditoria.mock.calls[0][0]).toEqual(['a@x.com', 'b@x.com']);
      expect(registro.enviadoPorId).toBe('u-1');
    });
  });
});
