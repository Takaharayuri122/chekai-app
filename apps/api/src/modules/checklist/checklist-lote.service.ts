import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { TemplateItem, TipoRespostaCustomizada } from './entities/template-item.entity';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { aplicarRegrasForcadas, aplicarTipoResposta } from './checklist-regras';
import { ConfigurarLoteDto, ResultadoLote } from './dto/configurar-lote.dto';

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
    if (
      alteracoes.tipoResposta === 'personalizada' &&
      (!alteracoes.opcoes || alteracoes.opcoes.length === 0)
    ) {
      throw new BadRequestException('Resposta personalizada exige ao menos uma opção');
    }

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
      const eraPersonalizado =
        (original.usarRespostasPersonalizadas && !original.tipoRespostaCustomizada) ||
        original.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT;

      const item = { ...original } as TemplateItem;
      const eraTexto = original.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO;
      if (alteracoes.tipoResposta) {
        aplicarTipoResposta(item, alteracoes.tipoResposta, alteracoes.opcoes);
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

    if (!simulado && modificados.length > 0) {
      await this.itemRepository.manager.transaction((m) => m.save(TemplateItem, modificados));
    }

    return {
      totalAfetados: modificados.length,
      personalizadosSubstituidos,
      ignorados,
      auditoriasVinculadas,
      simulado,
    };
  }
}
