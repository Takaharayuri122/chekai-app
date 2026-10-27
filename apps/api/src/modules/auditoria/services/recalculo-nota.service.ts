import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria, StatusAuditoria } from '../entities/auditoria.entity';
import { calcularNotaDaAuditoria, ehRotuloNaoAplicavel } from '../../checklist/regras';

/**
 * Corrige a nota gravada das auditorias finalizadas antes de o "Não aplicável" de opções
 * personalizadas sair da nota (RN-CHK-021). Roda ao subir a API e só grava quando a nota muda,
 * então depois da primeira execução não altera mais nada.
 */
@Injectable()
export class RecalculoNotaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RecalculoNotaService.name);

  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
  ) {}

  onApplicationBootstrap(): void {
    // Em segundo plano: a API não espera o recálculo para atender
    void this.recalcularFinalizadasComNaoAplicavel().catch((erro) =>
      this.logger.error('Falha ao recalcular notas com "Não aplicável" personalizado', erro),
    );
  }

  /** Recalcula e grava a nota das finalizadas que têm "Não aplicável" personalizado. Retorna quantas mudaram. */
  async recalcularFinalizadasComNaoAplicavel(): Promise<number> {
    const candidatas: { id: string }[] = await this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .innerJoin('auditoria.itens', 'item')
      .select('DISTINCT auditoria.id', 'id')
      .where('auditoria.status = :status', { status: StatusAuditoria.FINALIZADA })
      .andWhere("item.resposta NOT IN ('conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado')")
      .andWhere("(item.resposta ILIKE '%aplic%' OR lower(item.resposta) IN ('na', 'n/a', 'n.a.', 'n a'))")
      .getRawMany();

    let alteradas = 0;
    for (const { id } of candidatas) {
      const auditoria = await this.auditoriaRepository.findOne({
        where: { id },
        relations: ['itens', 'itens.templateItem'],
      });
      if (!auditoria || !auditoria.itens.some((i) => i.resposta && ehRotuloNaoAplicavel(i.resposta))) continue;
      const nova = Math.round(calcularNotaDaAuditoria(auditoria.itens).percentual * 100) / 100;
      if (Math.abs(nova - Number(auditoria.pontuacaoTotal ?? 0)) < 0.005) continue;
      // update() também atualiza atualizadoEm, o que faz o PDF guardado ser refeito com a nota nova
      await this.auditoriaRepository.update({ id }, { pontuacaoTotal: nova });
      this.logger.log(`Auditoria ${id}: nota ${auditoria.pontuacaoTotal} → ${nova}`);
      alteradas += 1;
    }
    if (alteradas > 0) this.logger.log(`${alteradas} auditoria(s) com nota recalculada`);
    return alteradas;
  }
}
