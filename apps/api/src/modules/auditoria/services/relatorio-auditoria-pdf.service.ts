import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { AuditoriaService } from '../auditoria.service';
import { Auditoria } from '../entities/auditoria.entity';
import { RelatorioPdfPuppeteerService } from './relatorio-pdf-puppeteer.service';
import { ResultadoAuditoriaService } from './resultado-auditoria.service';

type UsuarioAutenticado = { id: string; perfil: PerfilUsuario; gestorId?: string | null };

/**
 * Entrega o PDF do relatório de auditoria: reaproveita o arquivo guardado
 * enquanto nada mudou e regenera quando auditoria ou checklist foram alterados.
 */
@Injectable()
export class RelatorioAuditoriaPdfService {
  private readonly bucketName: string;

  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly resultadoAuditoriaService: ResultadoAuditoriaService,
    private readonly relatorioPdfPuppeteerService: RelatorioPdfPuppeteerService,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('SUPABASE_STORAGE_BUCKET_RELATORIOS') || 'relatorios';
  }

  /**
   * @param usuario - ausente no envio automático (sem isolamento por usuário)
   */
  async obterPdf(auditoriaId: string, usuario?: UsuarioAutenticado): Promise<{ buffer: Buffer; url: string }> {
    const auditoria = await this.auditoriaService.buscarAuditoriaPorId(auditoriaId, usuario);
    if (auditoria.status !== 'finalizada') {
      throw new BadRequestException('Apenas auditorias finalizadas podem gerar PDF');
    }

    if (!this.estaDesatualizado(auditoria)) {
      const guardado = await this.baixarPdfGuardado(auditoria);
      if (guardado) return guardado;
    }

    const resultado = await this.resultadoAuditoriaService.calcular(auditoria, usuario);
    const buffer = await this.relatorioPdfPuppeteerService.gerarPdf(auditoria, resultado);
    const url = await this.relatorioPdfPuppeteerService.salvarPdfNoStorage(auditoriaId, buffer);
    await this.auditoriaService.atualizarPdfUrl(auditoriaId, url);
    return { buffer, url };
  }

  /** Sem PDF, ou auditoria/checklist/perguntas alterados depois da geração. */
  private estaDesatualizado(auditoria: Auditoria): boolean {
    if (!auditoria.pdfGeradoEm) return true;
    const geradoEm = new Date(auditoria.pdfGeradoEm).getTime();
    const datas = [
      auditoria.atualizadoEm,
      auditoria.template?.atualizadoEm,
      ...(auditoria.itens ?? []).map((i) => i.templateItem?.atualizadoEm),
    ];
    return datas.some((d) => d && new Date(d).getTime() > geradoEm);
  }

  private async baixarPdfGuardado(auditoria: Auditoria): Promise<{ buffer: Buffer; url: string } | null> {
    const noBucket = await this.relatorioPdfPuppeteerService.verificarPdfExistente(auditoria.id);
    const url = noBucket ?? auditoria.pdfUrl;
    if (!url) return null;
    const partes = url.split(`/storage/v1/object/public/${this.bucketName}/`);
    if (partes.length < 2) return null;

    const { data, error } = await this.supabaseService.getClient().storage.from(this.bucketName).download(partes[1]);
    if (error || !data) return null;

    if (noBucket && noBucket !== auditoria.pdfUrl) {
      await this.auditoriaService.atualizarPdfUrl(auditoria.id, noBucket);
    }
    return { buffer: Buffer.from(await data.arrayBuffer()), url };
  }
}
