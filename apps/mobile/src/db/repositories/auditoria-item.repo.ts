import { getDatabase } from '../client';

export interface TemplateItemRow {
  id: string;
  descricao: string;
  ordem: number;
  categoria: string | null;
  tipoResposta: string;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
  pontuacaoMaxima: number;
  opcoesRespostaConfig?: string | null;
  criticidade?: string | null;
}

export interface RespostaInput {
  resposta: string;
  observacao?: string;
  descricaoNaoConformidade?: string;
  planoAcaoFinal?: string;
  pontuacao?: number;
  descricaoIa?: string;
  planoAcaoSugerido?: string;
}

export interface AuditoriaItemCompleto {
  id: string;
  auditoriaId: string;
  templateItemId: string;
  resposta: string;
  observacao: string | null;
  descricaoNaoConformidade: string | null;
  planoAcaoFinal: string | null;
  descricaoIa: string | null;
  planoAcaoSugerido: string | null;
  pontuacao: number;
  syncStatus: string;
  // campos do template_item
  descricao: string;
  ordem: number;
  categoria: string | null;
  tipoResposta: string;
  opcoesRespostaConfig: string | null;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
  criticidade: string | null;
  pontuacaoMaxima: number;
}

export class AuditoriaItemRepo {
  private get db() { return getDatabase(); }

  bulkCreate(auditoriaId: string, templateItens: TemplateItemRow[]): void {
    const now = new Date().toISOString();
    for (const ti of templateItens) {
      const id = crypto.randomUUID();
      this.db.runSync(
        `INSERT INTO auditoria_itens
         (id, auditoria_id, template_item_id, resposta, pontuacao, sync_status, updated_at)
         VALUES (?, ?, ?, 'nao_avaliado', 0, 'pending', ?)`,
        [id, auditoriaId, ti.id, now]
      );
    }
  }

  upsertResposta(itemId: string, r: RespostaInput): void {
    this.db.runSync(
      `UPDATE auditoria_itens SET
         resposta = ?,
         observacao = ?,
         descricao_nao_conformidade = ?,
         plano_acao_final = ?,
         pontuacao = ?,
         descricao_ia = ?,
         plano_acao_sugerido = ?,
         sync_status = 'pending',
         updated_at = ?
       WHERE id = ?`,
      [r.resposta, r.observacao ?? null, r.descricaoNaoConformidade ?? null,
       r.planoAcaoFinal ?? null, r.pontuacao ?? 0,
       r.descricaoIa ?? null, r.planoAcaoSugerido ?? null,
       new Date().toISOString(), itemId]
    );
  }

  findByAuditoria(auditoriaId: string): AuditoriaItemCompleto[] {
    const rows = this.db.getAllSync<{
      id: string; auditoria_id: string; template_item_id: string;
      resposta: string; observacao: string | null;
      descricao_nao_conformidade: string | null; plano_acao_final: string | null;
      descricao_ia: string | null; plano_acao_sugerido: string | null;
      pontuacao: number; sync_status: string;
      descricao: string; ordem: number; categoria: string | null;
      tipo_resposta: string; opcoes_resposta_config: string | null;
      foto_obrigatoria: number; observacao_obrigatoria: number;
      criticidade: string | null; pontuacao_maxima: number;
    }>(
      `SELECT ai.*, ti.descricao, ti.ordem, ti.categoria,
              ti.tipo_resposta, ti.opcoes_resposta_config,
              ti.foto_obrigatoria, ti.observacao_obrigatoria,
              ti.criticidade, ti.pontuacao_maxima
       FROM auditoria_itens ai
       JOIN template_itens ti ON ti.id = ai.template_item_id
       WHERE ai.auditoria_id = ?
       ORDER BY ti.categoria, ti.ordem`,
      [auditoriaId]
    );
    return rows.map(r => ({
      id: r.id, auditoriaId: r.auditoria_id, templateItemId: r.template_item_id,
      resposta: r.resposta, observacao: r.observacao,
      descricaoNaoConformidade: r.descricao_nao_conformidade,
      planoAcaoFinal: r.plano_acao_final,
      descricaoIa: r.descricao_ia, planoAcaoSugerido: r.plano_acao_sugerido,
      pontuacao: r.pontuacao, syncStatus: r.sync_status,
      descricao: r.descricao, ordem: r.ordem, categoria: r.categoria,
      tipoResposta: r.tipo_resposta, opcoesRespostaConfig: r.opcoes_resposta_config,
      fotoObrigatoria: r.foto_obrigatoria === 1,
      observacaoObrigatoria: r.observacao_obrigatoria === 1,
      criticidade: r.criticidade, pontuacaoMaxima: r.pontuacao_maxima,
    }));
  }

  findById(id: string): AuditoriaItemCompleto | null {
    const r = this.db.getFirstSync<{
      id: string; auditoria_id: string; template_item_id: string;
      resposta: string; observacao: string | null;
      descricao_nao_conformidade: string | null; plano_acao_final: string | null;
      descricao_ia: string | null; plano_acao_sugerido: string | null;
      pontuacao: number; sync_status: string;
      descricao: string; ordem: number; categoria: string | null;
      tipo_resposta: string; opcoes_resposta_config: string | null;
      foto_obrigatoria: number; observacao_obrigatoria: number;
      criticidade: string | null; pontuacao_maxima: number;
    }>(
      `SELECT ai.*, ti.descricao, ti.ordem, ti.categoria,
              ti.tipo_resposta, ti.opcoes_resposta_config,
              ti.foto_obrigatoria, ti.observacao_obrigatoria,
              ti.criticidade, ti.pontuacao_maxima
       FROM auditoria_itens ai
       JOIN template_itens ti ON ti.id = ai.template_item_id
       WHERE ai.id = ?`,
      [id]
    );
    if (!r) return null;
    return {
      id: r.id, auditoriaId: r.auditoria_id, templateItemId: r.template_item_id,
      resposta: r.resposta, observacao: r.observacao,
      descricaoNaoConformidade: r.descricao_nao_conformidade,
      planoAcaoFinal: r.plano_acao_final,
      descricaoIa: r.descricao_ia, planoAcaoSugerido: r.plano_acao_sugerido,
      pontuacao: r.pontuacao, syncStatus: r.sync_status,
      descricao: r.descricao, ordem: r.ordem, categoria: r.categoria,
      tipoResposta: r.tipo_resposta, opcoesRespostaConfig: r.opcoes_resposta_config,
      fotoObrigatoria: r.foto_obrigatoria === 1,
      observacaoObrigatoria: r.observacao_obrigatoria === 1,
      criticidade: r.criticidade, pontuacaoMaxima: r.pontuacao_maxima,
    };
  }
}
