import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Legislacao } from './entities/legislacao.entity';
import { TemplateItem } from '../checklist/entities/template-item.entity';
import { AuditoriaItem } from '../auditoria/entities/auditoria-item.entity';
import { nomeCurtoLegislacao } from './lib/nome-legislacao';
import { chaveDaLegislacao, chavesNoTexto } from './lib/chave-legislacao';

interface ItemCandidato {
  id: string;
  texto: string | null;
  vinculado: boolean;
}

/**
 * Liga textos livres de referência legal às legislações cadastradas.
 */
@Injectable()
export class LegislacaoVinculoService {
  constructor(
    @InjectRepository(Legislacao)
    private readonly legislacaoRepository: Repository<Legislacao>,
    @InjectRepository(TemplateItem)
    private readonly templateItemRepository: Repository<TemplateItem>,
    @InjectRepository(AuditoriaItem)
    private readonly auditoriaItemRepository: Repository<AuditoriaItem>,
  ) {}

  /**
   * Texto de compatibilidade gravado nos campos livres: nomes curtos separados por "; ".
   */
  textoDerivado(legislacoes: Legislacao[]): string | null {
    const nomes = [...new Set((legislacoes ?? []).map((l) => nomeCurtoLegislacao(l)).filter(Boolean))];
    return nomes.length ? nomes.join('; ') : null;
  }

  /**
   * IDs das legislações ativas citadas no texto livre (na ordem em que aparecem).
   */
  async idsPorTexto(texto: string | null): Promise<string[]> {
    const chaves = chavesNoTexto(texto);
    if (chaves.length === 0) {
      return [];
    }
    const ativas = await this.legislacaoRepository.find({ where: { ativo: true } });
    const porChave = new Map<string, string>();
    for (const l of ativas) {
      const chave = chaveDaLegislacao(l);
      if (chave && !porChave.has(chave)) porChave.set(chave, l.id);
    }
    return [...new Set(chaves.map((c) => porChave.get(c)).filter((id): id is string => !!id))];
  }

  /**
   * Itens de template e de auditoria sem vínculo cujo texto cita esta legislação ganham o vínculo.
   * O texto livre não é alterado.
   */
  async ligarReferenciasAntigas(
    legislacao: Legislacao,
  ): Promise<{ templateItens: number; auditoriaItens: number }> {
    const chave = chaveDaLegislacao(legislacao);
    if (!chave) {
      return { templateItens: 0, auditoriaItens: 0 };
    }
    // O ano aparece com 4 dígitos nos dois formatos aceitos ("216/2004" e "de ... de 2004").
    const filtroAno = `%${legislacao.ano}%`;

    const templates: ItemCandidato[] = await this.templateItemRepository.query(
      `SELECT ti.id, ti."legislacaoReferencia" AS texto,
              EXISTS (SELECT 1 FROM template_item_legislacoes v WHERE v.template_item_id = ti.id) AS vinculado
         FROM template_itens ti
        WHERE ti."legislacaoReferencia" ILIKE $1`,
      [filtroAno],
    );
    const auditorias: ItemCandidato[] = await this.auditoriaItemRepository.query(
      `SELECT ai.id, ai."referenciaLegal" AS texto,
              EXISTS (SELECT 1 FROM auditoria_item_legislacoes v WHERE v.auditoria_item_id = ai.id) AS vinculado
         FROM auditoria_itens ai
        WHERE ai."referenciaLegal" ILIKE $1`,
      [filtroAno],
    );

    const selecionar = (itens: ItemCandidato[]): string[] =>
      itens.filter((i) => !i.vinculado && chavesNoTexto(i.texto).includes(chave)).map((i) => i.id);
    const templateIds = selecionar(templates);
    const auditoriaIds = selecionar(auditorias);

    if (templateIds.length) {
      await this.templateItemRepository.query(
        `INSERT INTO template_item_legislacoes (template_item_id, legislacao_id)
         SELECT unnest($1::uuid[]), $2::uuid ON CONFLICT DO NOTHING`,
        [templateIds, legislacao.id],
      );
    }
    if (auditoriaIds.length) {
      await this.auditoriaItemRepository.query(
        `INSERT INTO auditoria_item_legislacoes (auditoria_item_id, legislacao_id)
         SELECT unnest($1::uuid[]), $2::uuid ON CONFLICT DO NOTHING`,
        [auditoriaIds, legislacao.id],
      );
    }
    return { templateItens: templateIds.length, auditoriaItens: auditoriaIds.length };
  }
}
