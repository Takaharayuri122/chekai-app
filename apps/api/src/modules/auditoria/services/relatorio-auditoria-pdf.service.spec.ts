import { BadRequestException } from '@nestjs/common';
import { RelatorioAuditoriaPdfService } from './relatorio-auditoria-pdf.service';

const PDF_NOVO = Buffer.from('%PDF-novo');
const PDF_GUARDADO = Buffer.from('%PDF-guardado');
const URL_BUCKET = 'https://x.supabase.co/storage/v1/object/public/relatorios/auditorias/a-1/r.pdf';
const resultado = { aproveitamento: 80 };

function criar(auditoria: Record<string, unknown>, downloadOk = true, ultimaTarefa: unknown = null) {
  const auditoriaService = {
    buscarAuditoriaPorId: jest.fn().mockResolvedValue(auditoria),
    atualizarPdfUrl: jest.fn().mockResolvedValue(undefined),
  };
  const resultadoService = { calcular: jest.fn().mockResolvedValue(resultado) };
  const puppeteer = {
    gerarPdf: jest.fn().mockResolvedValue(PDF_NOVO),
    salvarPdfNoStorage: jest.fn().mockResolvedValue('https://novo/url.pdf'),
    verificarPdfExistente: jest.fn().mockResolvedValue(URL_BUCKET),
  };
  const download = jest.fn().mockResolvedValue(
    downloadOk
      ? { data: { arrayBuffer: async () => PDF_GUARDADO }, error: null }
      : { data: null, error: new Error('falhou') },
  );
  const supabase = { getClient: () => ({ storage: { from: () => ({ download }) } }) };
  const config = { get: () => undefined };
  const planoTarefaRepository = { findOne: jest.fn().mockResolvedValue(ultimaTarefa) };
  const service = new RelatorioAuditoriaPdfService(
    auditoriaService as never,
    resultadoService as never,
    puppeteer as never,
    supabase as never,
    config as never,
    planoTarefaRepository as never,
  );
  return { service, auditoriaService, resultadoService, puppeteer, download, planoTarefaRepository };
}

const base = {
  id: 'a-1',
  status: 'finalizada',
  atualizadoEm: new Date('2026-10-20T10:00:00Z'),
  pdfGeradoEm: new Date('2026-10-20T12:00:00Z'),
  pdfUrl: URL_BUCKET,
  template: { atualizadoEm: new Date('2026-10-19T10:00:00Z') },
  itens: [],
};

describe('RelatorioAuditoriaPdfService.obterPdf', () => {
  it('recusa auditoria não finalizada', async () => {
    const { service } = criar({ ...base, status: 'em_andamento' });
    await expect(service.obterPdf('a-1', undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reaproveita o PDF do bucket quando nada mudou', async () => {
    const { service, puppeteer } = criar(base);
    const r = await service.obterPdf('a-1', undefined);
    expect(r.buffer.equals(PDF_GUARDADO)).toBe(true);
    expect(puppeteer.gerarPdf).not.toHaveBeenCalled();
  });

  it('gera quando nunca houve PDF', async () => {
    const { service, puppeteer, auditoriaService } = criar({ ...base, pdfGeradoEm: null, pdfUrl: null });
    const r = await service.obterPdf('a-1', undefined);
    expect(r.buffer).toBe(PDF_NOVO);
    expect(r.url).toBe('https://novo/url.pdf');
    expect(puppeteer.gerarPdf).toHaveBeenCalledWith(expect.anything(), resultado);
    expect(auditoriaService.atualizarPdfUrl).toHaveBeenCalledWith('a-1', 'https://novo/url.pdf');
  });

  it('regenera quando a auditoria foi alterada depois do PDF', async () => {
    const { service, puppeteer } = criar({ ...base, atualizadoEm: new Date('2026-10-21T00:00:00Z') });
    await service.obterPdf('a-1', undefined);
    expect(puppeteer.gerarPdf).toHaveBeenCalled();
  });

  it('regenera quando o checklist foi alterado depois do PDF', async () => {
    const { service, puppeteer } = criar({
      ...base,
      template: { atualizadoEm: new Date('2026-10-22T00:00:00Z') },
    });
    await service.obterPdf('a-1', undefined);
    expect(puppeteer.gerarPdf).toHaveBeenCalled();
  });

  it('regenera quando uma pergunta do checklist foi alterada depois do PDF', async () => {
    const { service, puppeteer } = criar({
      ...base,
      itens: [{ templateItem: { atualizadoEm: new Date('2026-10-23T00:00:00Z') } }],
    });
    await service.obterPdf('a-1', undefined);
    expect(puppeteer.gerarPdf).toHaveBeenCalled();
  });

  it('regenera quando um plano de ação foi criado ou alterado depois do PDF', async () => {
    const { service, puppeteer, planoTarefaRepository } = criar(base, true, {
      id: 't-1',
      atualizadoEm: new Date('2026-10-24T00:00:00Z'),
    });
    await service.obterPdf('a-1', undefined);
    expect(planoTarefaRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { auditoriaId: 'a-1' }, order: { atualizadoEm: 'DESC' } }),
    );
    expect(puppeteer.gerarPdf).toHaveBeenCalled();
  });

  it('reaproveita o PDF quando os planos de ação são anteriores à geração', async () => {
    const { service, puppeteer } = criar(base, true, { id: 't-1', atualizadoEm: new Date('2026-10-20T11:00:00Z') });
    const r = await service.obterPdf('a-1', undefined);
    expect(r.buffer.equals(PDF_GUARDADO)).toBe(true);
    expect(puppeteer.gerarPdf).not.toHaveBeenCalled();
  });

  it('baixa o PDF guardado pelo caminho decodificado', async () => {
    const { service, puppeteer, download } = criar(base);
    puppeteer.verificarPdfExistente.mockResolvedValue(
      'https://x.supabase.co/storage/v1/object/public/relatorios/auditorias/a-1/relat%C3%B3rio.pdf',
    );
    await service.obterPdf('a-1', undefined);
    expect(download).toHaveBeenCalledWith('auditorias/a-1/relatório.pdf');
  });

  it('regenera quando o PDF guardado não pode ser baixado', async () => {
    const { service, puppeteer } = criar(base, false);
    const r = await service.obterPdf('a-1', undefined);
    expect(r.buffer).toBe(PDF_NOVO);
    expect(puppeteer.gerarPdf).toHaveBeenCalled();
  });

  it('repassa o usuário ao cálculo do resultado', async () => {
    const usuario = { id: 'u1', perfil: 'auditor' } as never;
    const { service, resultadoService } = criar({ ...base, pdfGeradoEm: null });
    await service.obterPdf('a-1', usuario);
    expect(resultadoService.calcular).toHaveBeenCalledWith(expect.anything(), usuario);
  });

  it('reaproveita o PDF quando os carimbos de tempo são iguais (como após atualizarPdfUrl)', async () => {
    const t = new Date('2026-10-20T12:00:00Z');
    const { service, puppeteer } = criar({
      ...base,
      atualizadoEm: t,
      pdfGeradoEm: t,
      template: { atualizadoEm: t },
      itens: [{ templateItem: { atualizadoEm: t } }],
    });
    const r = await service.obterPdf('a-1', undefined);
    expect(r.buffer.equals(PDF_GUARDADO)).toBe(true);
    expect(puppeteer.gerarPdf).not.toHaveBeenCalled();
  });

  it('devolve a auditoria carregada', async () => {
    const { service } = criar(base);
    expect((await service.obterPdf('a-1', undefined)).auditoria).toBe(base);
  });
});
