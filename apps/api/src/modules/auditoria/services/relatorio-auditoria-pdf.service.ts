import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanoAcaoTarefa } from '../../plano-acao/entities/plano-acao-tarefa.entity';
import { SupabaseService } from '../../supabase/supabase.service';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { AuditoriaService } from '../auditoria.service';
import { Auditoria } from '../entities/auditoria.entity';
import { caminhoNoBucket } from './caminho-no-bucket';
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
    @InjectRepository(PlanoAcaoTarefa)
    private readonly planoTarefaRepository: Repository<PlanoAcaoTarefa>,
  ) {
    this.bucketName = this.configService.get<string>('SUPABASE_STORAGE_BUCKET_RELATORIOS') || 'relatorios';
  }

  /**
   * @param usuario - ausente no envio automático (sem isolamento por usuário)
   */
  async obterPdf(auditoriaId: string, usuario?: UsuarioAutenticado): Promise<{ buffer: Buffer; url: string; auditoria: Auditoria }> {
    const auditoria = await this.auditoriaService.buscarAuditoriaPorId(auditoriaId, usuario);
    if (auditoria.status !== 'finalizada') {
      throw new BadRequestException('Apenas auditorias finalizadas podem gerar PDF');
    }

    if (!(await this.estaDesatualizado(auditoria))) {
      const guardado = await this.baixarPdfGuardado(auditoria);
      if (guardado) return { ...guardado, auditoria };
    }

    const resultado = await this.resultadoAuditoriaService.calcular(auditoria, usuario);
    const buffer = await this.relatorioPdfPuppeteerService.gerarPdf(auditoria, resultado);
    const url = await this.relatorioPdfPuppeteerService.salvarPdfNoStorage(auditoriaId, buffer);
    await this.auditoriaService.atualizarPdfUrl(auditoriaId, url);
    return { buffer, url, auditoria };
  }

  /** Sem PDF, ou auditoria/checklist/perguntas/planos de ação alterados depois da geração. */
  private async estaDesatualizado(auditoria: Auditoria): Promise<boolean> {
    if (!auditoria.pdfGeradoEm) return true;
    const geradoEm = new Date(auditoria.pdfGeradoEm).getTime();
    const datas = [
      auditoria.atualizadoEm,
      auditoria.template?.atualizadoEm,
      ...(auditoria.itens ?? []).map((i) => i.templateItem?.atualizadoEm),
    ];
    if (datas.some((d) => d && new Date(d).getTime() > geradoEm)) return true;

    // atualizadoEm é preenchido também na criação, então cobre tarefas novas e editadas
    const ultimaTarefa = await this.planoTarefaRepository.findOne({
      where: { auditoriaId: auditoria.id },
      order: { atualizadoEm: 'DESC' },
      select: { id: true, atualizadoEm: true },
    });
    return !!ultimaTarefa && new Date(ultimaTarefa.atualizadoEm).getTime() > geradoEm;
  }

  private async baixarPdfGuardado(auditoria: Auditoria): Promise<{ buffer: Buffer; url: string } | null> {
    const noBucket = await this.relatorioPdfPuppeteerService.verificarPdfExistente(auditoria.id);
    const url = noBucket ?? auditoria.pdfUrl;
    if (!url) return null;
    const caminho = caminhoNoBucket(url, this.bucketName);
    if (!caminho) return null;

    const { data, error } = await this.supabaseService.getClient().storage.from(this.bucketName).download(caminho);
    if (error || !data) return null;

    if (noBucket && noBucket !== auditoria.pdfUrl) {
      await this.auditoriaService.atualizarPdfUrl(auditoria.id, noBucket);
    }
    return { buffer: Buffer.from(await data.arrayBuffer()), url };
  }
}
