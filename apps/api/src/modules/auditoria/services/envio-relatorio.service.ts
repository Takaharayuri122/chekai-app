import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../../email/email.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { AuditoriaService } from '../auditoria.service';
import { Auditoria } from '../entities/auditoria.entity';
import { AuditoriaEnvioRelatorio } from '../entities/auditoria-envio-relatorio.entity';
import { caminhoNoBucket } from './caminho-no-bucket';
import { RelatorioAuditoriaPdfService } from './relatorio-auditoria-pdf.service';
import { ResultadoAuditoriaService } from './resultado-auditoria.service';

type UsuarioAutenticado = { id: string; perfil: PerfilUsuario; gestorId?: string | null };

const LIMITE_ANEXO_BYTES = 8 * 1024 * 1024;
const VALIDADE_LINK_SEGUNDOS = 30 * 24 * 60 * 60;
const FUSO = 'America/Sao_Paulo';

const formatarData = (data: Date): string => data.toLocaleDateString('pt-BR', { timeZone: FUSO });

/**
 * Envia o relatório da auditoria por e-mail e registra cada tentativa.
 */
@Injectable()
export class EnvioRelatorioService {
  private readonly logger = new Logger(EnvioRelatorioService.name);
  private readonly bucketName: string;

  constructor(
    @InjectRepository(AuditoriaEnvioRelatorio)
    private readonly envioRepository: Repository<AuditoriaEnvioRelatorio>,
    private readonly auditoriaService: AuditoriaService,
    private readonly relatorioPdfService: RelatorioAuditoriaPdfService,
    private readonly resultadoService: ResultadoAuditoriaService,
    private readonly emailService: EmailService,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('SUPABASE_STORAGE_BUCKET_RELATORIOS') || 'relatorios';
  }

  /** E-mail da unidade; na falta dele, o do cliente. */
  destinatariosPadrao(auditoria: Auditoria): string[] {
    const email = auditoria.unidade?.email?.trim() || auditoria.unidade?.cliente?.email?.trim();
    return email ? [email] : [];
  }

  /**
   * Nunca lança por falha de PDF ou e-mail: grava a tentativa com `sucesso: false` e devolve o registro.
   * @param opcoes.usuario - ausente no envio automático
   */
  async enviar(
    auditoriaId: string,
    opcoes: { destinatarios?: string[]; usuario?: UsuarioAutenticado; automatico: boolean },
  ): Promise<AuditoriaEnvioRelatorio> {
    const auditoria = await this.auditoriaService.buscarAuditoriaPorId(auditoriaId, opcoes.usuario);
    const destinatarios = opcoes.destinatarios?.length ? opcoes.destinatarios : this.destinatariosPadrao(auditoria);
    let erro: string | null = null;

    if (destinatarios.length === 0) {
      erro = 'Unidade e cliente sem e-mail cadastrado';
    } else {
      try {
        await this.enviarEmail(auditoria, destinatarios, opcoes.usuario);
      } catch (e) {
        erro = e instanceof Error ? e.message : 'Erro desconhecido ao enviar o relatório';
        this.logger.warn(`Falha ao enviar o relatório da auditoria ${auditoriaId}: ${erro}`);
      }
    }

    return this.envioRepository.save(
      this.envioRepository.create({
        auditoriaId,
        destinatarios,
        automatico: opcoes.automatico,
        enviadoPorId: opcoes.usuario?.id ?? null,
        sucesso: erro === null,
        erro,
      }),
    );
  }

  /** Tentativas de envio da auditoria, da mais recente para a mais antiga. */
  listar(auditoriaId: string): Promise<AuditoriaEnvioRelatorio[]> {
    return this.envioRepository.find({ where: { auditoriaId }, order: { criadoEm: 'DESC' } });
  }

  private async enviarEmail(auditoria: Auditoria, destinatarios: string[], usuario?: UsuarioAutenticado): Promise<void> {
    const { buffer, url } = await this.relatorioPdfService.obterPdf(auditoria.id, usuario);
    const resultado = await this.resultadoService.calcular(auditoria, usuario);
    const aproveitamento = resultado.aproveitamento.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    const faixa = resultado.classificacao?.nome;

    const link = buffer.length > LIMITE_ANEXO_BYTES ? await this.gerarLinkAssinado(url) : undefined;

    await this.emailService.enviarEmailRelatorioAuditoria(destinatarios, {
      unidade: auditoria.unidade?.nome ?? 'Unidade',
      checklist: auditoria.template?.nome ?? 'Checklist',
      data: formatarData(auditoria.dataFim ?? new Date()),
      resultado: faixa ? `${aproveitamento}% — ${faixa}` : `${aproveitamento}%`,
      auditor: auditoria.consultor?.nome ?? 'Não informado',
      codigo: auditoria.id.slice(0, 8).toUpperCase(),
      pdf: buffer,
      link,
    });
  }

  private async gerarLinkAssinado(urlPublica: string): Promise<{ url: string; validoAte: string }> {
    const caminho = caminhoNoBucket(urlPublica, this.bucketName);
    if (!caminho) throw new Error('Não foi possível gerar o link do relatório');
    const { data, error } = await this.supabaseService
      .getClient()
      .storage.from(this.bucketName)
      .createSignedUrl(caminho, VALIDADE_LINK_SEGUNDOS);
    if (error || !data?.signedUrl) throw new Error('Não foi possível gerar o link do relatório');
    return { url: data.signedUrl, validoAte: formatarData(new Date(Date.now() + VALIDADE_LINK_SEGUNDOS * 1000)) };
  }
}
