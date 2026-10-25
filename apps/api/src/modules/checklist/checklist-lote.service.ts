import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { TemplateItem, TipoRespostaCustomizada } from './entities/template-item.entity';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { aplicarRegrasForcadas, aplicarTipoResposta } from './checklist-regras';
import { ConfigurarLoteDto, OpcaoLoteDto, ResultadoLote } from './dto/configurar-lote.dto';

const CAMPOS_COMPARADOS: Array<keyof TemplateItem> = [
  'tipoRespostaCustomizada',
  'usarRespostasPersonalizadas',
  'peso',
  'permiteFoto',
  'permiteObservacao',
  'obrigatorio',
  'criticidade',
  'opcoesResposta',
  'opcoesRespostaConfig',
];

const assinatura = (item: TemplateItem, campos: Array<keyof TemplateItem>): string =>
  JSON.stringify(campos.map((c) => item[c] ?? null));

const ehPersonalizado = (item: TemplateItem): boolean =>
  (item.usarRespostasPersonalizadas && !item.tipoRespostaCustomizada) ||
  item.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT;

const auditorias = (n: number): string => (n === 1 ? '1 auditoria' : `${n} auditorias`);

/** Mínimo 2 opções, sem texto vazio, sem repetição (ignorando espaços e maiúsculas) — RN-CHK-018. */
function validarOpcoesPersonalizadas(opcoes: OpcaoLoteDto[] | undefined): void {
  if (!opcoes || opcoes.length < 2) {
    throw new BadRequestException('Respostas personalizadas exigem ao menos 2 opções');
  }
  const nomes = opcoes.map((o) => (o.valor ?? '').trim().toLowerCase());
  if (nomes.some((n) => !n)) {
    throw new BadRequestException('Todas as respostas precisam de um texto');
  }
  if (new Set(nomes).size !== nomes.length) {
    throw new BadRequestException('Há respostas repetidas');
  }
  const originais = opcoes.filter((o) => o.valorOriginal !== undefined).map((o) => o.valorOriginal);
  if (new Set(originais).size !== originais.length) {
    throw new BadRequestException('Há respostas com o mesmo valor original');
  }
}

interface LinhaUso {
  templateItemId: string;
  resposta: string;
  auditoriaId: string;
}

/**
 * Configuração em lote de perguntas de um template (RN-CHK-016).
 */
@Injectable()
export class ChecklistLoteService {
  constructor(
    @InjectRepository(ChecklistTemplate)
    private readonly templateRepository: Repository<ChecklistTemplate>,
    @InjectRepository(TemplateItem)
    private readonly itemRepository: Repository<TemplateItem>,
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
  ) {}

  async configurar(
    templateId: string,
    dto: ConfigurarLoteDto,
    usuario: { id: string },
  ): Promise<ResultadoLote> {
    const { alteracoes } = dto;
    const temItemIds = !!dto.itemIds && dto.itemIds.length > 0;
    if (temItemIds && dto.grupoId) {
      throw new BadRequestException('Informe itemIds ou grupoId, não os dois');
    }
    // Lista vazia de itens sem grupo não pode virar "todas as perguntas do checklist"
    if (dto.itemIds && dto.itemIds.length === 0 && !dto.grupoId) {
      throw new BadRequestException('Selecione ao menos uma pergunta');
    }
    if (!alteracoes || Object.values(alteracoes).every((v) => v === undefined)) {
      throw new BadRequestException('Informe ao menos uma alteração');
    }
    if (alteracoes.opcoes && !['padrao', 'personalizada'].includes(alteracoes.tipoResposta ?? '')) {
      throw new BadRequestException(
        'opcoes só pode ser enviado com tipoResposta padrao ou personalizada',
      );
    }
    const personalizada = alteracoes.tipoResposta === 'personalizada';
    if (personalizada) validarOpcoesPersonalizadas(alteracoes.opcoes);
    // valorOriginal só serve para comparar; não é gravado na configuração das opções
    const opcoesNovas = alteracoes.opcoes?.map(({ valorOriginal: _original, ...o }) => ({
      ...o,
      valor: personalizada ? o.valor.trim() : o.valor,
    }));

    const template = await this.templateRepository.findOne({
      where: { id: templateId },
      relations: ['itens', 'grupos'],
    });
    if (!template) throw new NotFoundException('Template não encontrado');
    if (template.gestorId !== usuario.id) {
      throw new ForbiddenException('Apenas o gestor responsável pode editar este checklist');
    }

    const todos = template.itens || [];
    if (temItemIds) {
      const idsDoTemplate = new Set(todos.map((i) => i.id));
      if (dto.itemIds!.some((id) => !idsDoTemplate.has(id))) {
        throw new BadRequestException('Há itens que não pertencem a este template');
      }
    }
    if (dto.grupoId && !(template.grupos || []).some((g) => g.id === dto.grupoId)) {
      throw new BadRequestException('O grupo não pertence a este template');
    }

    const alvo = todos.filter(
      (i) =>
        i.ativo !== false &&
        (temItemIds ? dto.itemIds!.includes(i.id) : dto.grupoId ? i.grupoId === dto.grupoId : true),
    );

    let personalizadosSubstituidos = 0;
    let ignorados = 0;
    const modificados: TemplateItem[] = [];

    for (const original of alvo) {
      const base = { ...original } as TemplateItem;
      aplicarRegrasForcadas(base);
      const antes = assinatura(base, CAMPOS_COMPARADOS);
      const eraPersonalizado = ehPersonalizado(original);

      const item = { ...original } as TemplateItem;
      const eraTexto = original.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO;
      if (alteracoes.tipoResposta) {
        aplicarTipoResposta(item, alteracoes.tipoResposta, opcoesNovas);
        if (eraTexto && alteracoes.tipoResposta !== 'texto') {
          // Texto zera o peso e bloqueia fotos; ao sair de texto, voltam aos valores padrão
          if (alteracoes.permiteFoto === undefined) item.permiteFoto = true;
          if (!item.peso) item.peso = 1;
        }
      }
      if (alteracoes.permiteFoto !== undefined) item.permiteFoto = alteracoes.permiteFoto;
      if (alteracoes.permiteObservacao !== undefined) item.permiteObservacao = alteracoes.permiteObservacao;
      if (alteracoes.obrigatorio !== undefined) item.obrigatorio = alteracoes.obrigatorio;
      if (alteracoes.criticidade !== undefined) item.criticidade = alteracoes.criticidade;
      aplicarRegrasForcadas(item);

      if (assinatura(item, CAMPOS_COMPARADOS) === antes) {
        ignorados++;
        continue;
      }
      if (
        eraPersonalizado &&
        assinatura(item, ['opcoesResposta', 'opcoesRespostaConfig']) !==
          assinatura(base, ['opcoesResposta', 'opcoesRespostaConfig'])
      ) {
        personalizadosSubstituidos++;
      }
      modificados.push(item);
    }

    const auditoriasVinculadas = await this.auditoriaRepository.count({ where: { templateId } });
    const simulado = dto.simular === true;

    // RN-CHK-018: histórico das respostas personalizadas já existentes
    const personalizadosAlvo = alvo.filter((i) => ehPersonalizado(i) && (i.opcoesResposta?.length ?? 0) > 0);
    const uso = await this.consultarUso(personalizadosAlvo);
    const respostasEmUso = [...uso.porValor.entries()]
      .filter(([, ids]) => ids.size > 0)
      .map(([valor, ids]) => ({ valor, auditorias: ids.size }));

    const renomeacoes = new Map<string, { novo: string; itemIds: string[] }>();
    if (personalizada && alteracoes.opcoes) {
      const mantidos = new Set(alteracoes.opcoes.map((o) => o.valorOriginal ?? o.valor));
      const removidasEmUso = new Map<string, Set<string>>();
      for (const item of personalizadosAlvo) {
        const atuais = item.opcoesResposta;
        for (const valor of atuais) {
          if (mantidos.has(valor)) continue;
          const ids = uso.porItem.get(item.id)?.get(valor);
          if (!ids || ids.size === 0) continue;
          const acumulado = removidasEmUso.get(valor) ?? new Set<string>();
          ids.forEach((id) => acumulado.add(id));
          removidasEmUso.set(valor, acumulado);
        }
        for (const o of alteracoes.opcoes) {
          const novo = o.valor.trim();
          if (o.valorOriginal === undefined || o.valorOriginal === novo || !atuais.includes(o.valorOriginal)) continue;
          const r = renomeacoes.get(o.valorOriginal) ?? { novo, itemIds: [] };
          r.itemIds.push(item.id);
          renomeacoes.set(o.valorOriginal, r);
        }
      }
      const [usada] = removidasEmUso.entries();
      if (usada && !simulado) {
        throw new BadRequestException(
          `A resposta "${usada[0]}" já foi usada em ${auditorias(usada[1].size)} e não pode ser removida.`,
        );
      }
    }

    if (!simulado && modificados.length > 0) {
      await this.itemRepository.manager.transaction(async (m) => {
        await m.save(TemplateItem, modificados);
        if (renomeacoes.size > 0) {
          const { sql, params } = montarRenomeacao(renomeacoes);
          await m.query(sql, params);
        }
      });
    }

    return {
      totalAfetados: modificados.length,
      personalizadosSubstituidos,
      ignorados,
      auditoriasVinculadas,
      simulado,
      respostasEmUso,
    };
  }

  /**
   * Auditorias distintas que já usaram cada resposta atual dos itens personalizados (por item e por valor).
   */
  private async consultarUso(itens: TemplateItem[]): Promise<{
    porItem: Map<string, Map<string, Set<string>>>;
    porValor: Map<string, Set<string>>;
  }> {
    const porItem = new Map<string, Map<string, Set<string>>>();
    const porValor = new Map<string, Set<string>>();
    if (itens.length === 0) return { porItem, porValor };
    const valores = [...new Set(itens.flatMap((i) => i.opcoesResposta))];
    valores.forEach((v) => porValor.set(v, new Set()));
    const linhas: LinhaUso[] = await this.itemRepository.manager.query(
      `SELECT DISTINCT template_item_id AS "templateItemId", resposta, auditoria_id AS "auditoriaId"
         FROM auditoria_itens
        WHERE template_item_id = ANY($1) AND resposta = ANY($2)`,
      [itens.map((i) => i.id), valores],
    );
    const atuaisPorItem = new Map(itens.map((i) => [i.id, new Set(i.opcoesResposta)]));
    for (const l of linhas) {
      if (!atuaisPorItem.get(l.templateItemId)?.has(l.resposta)) continue;
      const doItem = porItem.get(l.templateItemId) ?? new Map<string, Set<string>>();
      const ids = doItem.get(l.resposta) ?? new Set<string>();
      ids.add(l.auditoriaId);
      doItem.set(l.resposta, ids);
      porItem.set(l.templateItemId, doItem);
      porValor.get(l.resposta)!.add(l.auditoriaId);
    }
    return { porItem, porValor };
  }
}

/**
 * Um único UPDATE com CASE para todas as renomeações do lote: a troca A↔B não colide
 * porque cada linha é avaliada pelo valor antigo.
 */
function montarRenomeacao(renomeacoes: Map<string, { novo: string; itemIds: string[] }>): {
  sql: string;
  params: unknown[];
} {
  const params: unknown[] = [];
  const casos: string[] = [];
  const todosItens = new Set<string>();
  for (const [antigo, { novo, itemIds }] of renomeacoes) {
    params.push(antigo, itemIds, novo);
    const n = params.length;
    casos.push(`WHEN resposta = $${n - 2} AND template_item_id = ANY($${n - 1}) THEN $${n}`);
    itemIds.forEach((id) => todosItens.add(id));
  }
  params.push([...todosItens], [...renomeacoes.keys()]);
  const n = params.length;
  const sql =
    `UPDATE auditoria_itens SET resposta = CASE ${casos.join(' ')} ELSE resposta END ` +
    `WHERE template_item_id = ANY($${n - 1}) AND resposta = ANY($${n})`;
  return { sql, params };
}
