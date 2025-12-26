import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { TemplateItem } from './entities/template-item.entity';
import { ChecklistGrupo } from './entities/checklist-grupo.entity';
import {
  CriarChecklistTemplateDto,
  CriarTemplateItemDto,
  CriarChecklistGrupoDto,
} from './dto/criar-checklist-template.dto';
import { TipoAtividade } from '../cliente/entities/cliente.entity';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../shared/types/pagination.interface';

/**
 * Serviço responsável pela gestão de checklists.
 */
@Injectable()
export class ChecklistService {
  constructor(
    @InjectRepository(ChecklistTemplate)
    private readonly templateRepository: Repository<ChecklistTemplate>,
    @InjectRepository(TemplateItem)
    private readonly itemRepository: Repository<TemplateItem>,
    @InjectRepository(ChecklistGrupo)
    private readonly grupoRepository: Repository<ChecklistGrupo>,
  ) {}

  /**
   * Cria um novo template de checklist.
   */
  async criarTemplate(
    dto: CriarChecklistTemplateDto,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<ChecklistTemplate> {
    if (usuarioAutenticado && usuarioAutenticado.perfil !== PerfilUsuario.MASTER && usuarioAutenticado.perfil !== PerfilUsuario.ANALISTA) {
      throw new ForbiddenException('Apenas Master e Analista podem criar templates');
    }
    const template = this.templateRepository.create({
      nome: dto.nome,
      descricao: dto.descricao,
      tipoAtividade: dto.tipoAtividade,
      versao: dto.versao,
      analistaId: usuarioAutenticado?.perfil === PerfilUsuario.ANALISTA ? usuarioAutenticado.id : undefined,
    });
    const savedTemplate = await this.templateRepository.save(template);
    if (dto.itens && dto.itens.length > 0) {
      const itens = dto.itens.map((item, index) =>
        this.itemRepository.create({
          ...item,
          templateId: savedTemplate.id,
          ordem: item.ordem ?? index,
        }),
      );
      await this.itemRepository.save(itens);
    }
    return this.buscarTemplatePorId(savedTemplate.id);
  }

  /**
   * Lista todos os templates de checklist, filtrados por tenant.
   */
  async listarTemplates(
    params: PaginationParams,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<PaginatedResult<ChecklistTemplate>> {
    let where: any = { ativo: true };
    if (usuarioAutenticado && usuarioAutenticado.perfil === PerfilUsuario.ANALISTA) {
      where = { ...where, analistaId: usuarioAutenticado.id };
    }
    const [items, total] = await this.templateRepository.findAndCount({
      where,
      relations: ['itens'],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      order: { criadoEm: 'DESC' },
    });
    items.forEach((template) => {
      if (template.itens) {
        template.itens = template.itens.filter((i) => i.ativo !== false);
      }
    });
    return createPaginatedResult(items, total, params.page, params.limit);
  }

  /**
   * Lista templates por tipo de atividade.
   */
  async listarTemplatesPorTipo(tipoAtividade: TipoAtividade): Promise<ChecklistTemplate[]> {
    const templates = await this.templateRepository.find({
      where: { tipoAtividade, ativo: true },
      relations: ['itens'],
      order: { nome: 'ASC' },
    });
    templates.forEach((template) => {
      if (template.itens) {
        template.itens = template.itens.filter((i) => i.ativo !== false);
      }
    });
    return templates;
  }

  /**
   * Busca um template pelo ID com todos os itens e grupos, verificando permissões.
   */
  async buscarTemplatePorId(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<ChecklistTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['itens', 'itens.grupo', 'grupos'],
    });
    if (!template) {
      throw new NotFoundException('Template não encontrado');
    }
    if (usuarioAutenticado && usuarioAutenticado.perfil === PerfilUsuario.ANALISTA && template.analistaId !== usuarioAutenticado.id) {
      throw new ForbiddenException('Acesso negado a este template');
    }
    if (template.itens) {
      template.itens = template.itens.filter((i) => i.ativo !== false);
      template.itens.sort((a, b) => a.ordem - b.ordem);
    }
    if (template.grupos) {
      template.grupos = template.grupos.filter((g) => g.ativo !== false);
      template.grupos.sort((a, b) => a.ordem - b.ordem);
    }
    return template;
  }

  /**
   * Atualiza um template.
   */
  async atualizarTemplate(
    id: string,
    dto: Partial<CriarChecklistTemplateDto>,
  ): Promise<ChecklistTemplate> {
    const template = await this.buscarTemplatePorId(id);
    Object.assign(template, {
      nome: dto.nome ?? template.nome,
      descricao: dto.descricao ?? template.descricao,
      tipoAtividade: dto.tipoAtividade ?? template.tipoAtividade,
      versao: dto.versao ?? template.versao,
    });
    return this.templateRepository.save(template);
  }

  /**
   * Remove um template (soft delete).
   */
  async removerTemplate(id: string): Promise<void> {
    const template = await this.buscarTemplatePorId(id);
    template.ativo = false;
    await this.templateRepository.save(template);
  }

  /**
   * Adiciona um item a um template.
   */
  async adicionarItem(templateId: string, dto: CriarTemplateItemDto): Promise<TemplateItem> {
    await this.buscarTemplatePorId(templateId);
    const maxOrdem = await this.itemRepository
      .createQueryBuilder('item')
      .where('item.template_id = :templateId', { templateId })
      .select('MAX(item.ordem)', 'max')
      .getRawOne();
    const item = this.itemRepository.create({
      ...dto,
      templateId,
      ordem: dto.ordem ?? (maxOrdem?.max ?? 0) + 1,
    });
    return this.itemRepository.save(item);
  }

  /**
   * Atualiza um item do template.
   */
  async atualizarItem(itemId: string, dto: Partial<CriarTemplateItemDto>): Promise<TemplateItem> {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }
    Object.assign(item, dto);
    return this.itemRepository.save(item);
  }

  /**
   * Remove um item (soft delete).
   */
  async removerItem(itemId: string): Promise<void> {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }
    item.ativo = false;
    await this.itemRepository.save(item);
  }

  /**
   * Lista os grupos de um template.
   */
  async listarGrupos(templateId: string): Promise<ChecklistGrupo[]> {
    await this.buscarTemplatePorId(templateId);
    return this.grupoRepository.find({
      where: { templateId, ativo: true },
      order: { ordem: 'ASC' },
    });
  }

  /**
   * Adiciona um grupo a um template.
   */
  async adicionarGrupo(templateId: string, dto: CriarChecklistGrupoDto): Promise<ChecklistGrupo> {
    await this.buscarTemplatePorId(templateId);
    const maxOrdem = await this.grupoRepository
      .createQueryBuilder('grupo')
      .where('grupo.template_id = :templateId', { templateId })
      .select('MAX(grupo.ordem)', 'max')
      .getRawOne();
    const grupo = this.grupoRepository.create({
      ...dto,
      templateId,
      ordem: dto.ordem ?? (maxOrdem?.max ?? 0) + 1,
    });
    return this.grupoRepository.save(grupo);
  }

  /**
   * Atualiza um grupo do template.
   */
  async atualizarGrupo(grupoId: string, dto: Partial<CriarChecklistGrupoDto>): Promise<ChecklistGrupo> {
    const grupo = await this.grupoRepository.findOne({ where: { id: grupoId } });
    if (!grupo) {
      throw new NotFoundException('Grupo não encontrado');
    }
    Object.assign(grupo, dto);
    return this.grupoRepository.save(grupo);
  }

  /**
   * Remove um grupo (soft delete).
   */
  async removerGrupo(grupoId: string): Promise<void> {
    const grupo = await this.grupoRepository.findOne({ where: { id: grupoId } });
    if (!grupo) {
      throw new NotFoundException('Grupo não encontrado');
    }
    grupo.ativo = false;
    await this.grupoRepository.save(grupo);
  }

  /**
   * Reordena os grupos de um template.
   */
  async reordenarGrupos(templateId: string, grupoIds: string[]): Promise<void> {
    await this.buscarTemplatePorId(templateId);
    for (let i = 0; i < grupoIds.length; i++) {
      await this.grupoRepository.update(grupoIds[i], { ordem: i });
    }
  }
}

