import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistTemplate } from './entities/checklist-template.entity';
import { TemplateItem, TipoRespostaCustomizada } from './entities/template-item.entity';
import { ChecklistGrupo } from './entities/checklist-grupo.entity';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
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
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
  ) {}

  /**
   * Cria um novo template de checklist.
   */
  async criarTemplate(
    dto: CriarChecklistTemplateDto,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<ChecklistTemplate> {
    if (usuarioAutenticado && usuarioAutenticado.perfil !== PerfilUsuario.MASTER && usuarioAutenticado.perfil !== PerfilUsuario.GESTOR) {
      throw new ForbiddenException('Apenas Master e Gestor podem criar templates');
    }
    const template = this.templateRepository.create({
      nome: dto.nome,
      descricao: dto.descricao,
      tipoAtividade: dto.tipoAtividade,
      versao: dto.versao,
      gestorId: usuarioAutenticado?.perfil === PerfilUsuario.GESTOR ? usuarioAutenticado.id : undefined,
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
   * Auditores veem apenas checklists ativos.
   * Gestores e Master veem todos os checklists (ativos e inativos).
   */
  async listarTemplates(
    params: PaginationParams,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<PaginatedResult<ChecklistTemplate>> {
    let where: any = {};
    
    // Auditores só veem checklists ativos
    if (usuarioAutenticado && usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
      where = { ativo: true };
    }
    // Gestores veem todos os seus checklists (ativos e inativos)
    else if (usuarioAutenticado && usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
      where = { gestorId: usuarioAutenticado.id };
    }
    // Master vê todos os checklists (ativos e inativos)
    else {
      // Sem filtro de ativo para Master e quando não há usuário autenticado
      where = {};
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
   * Auditores veem apenas checklists ativos.
   * Gestores e Master veem todos os checklists (ativos e inativos).
   */
  async listarTemplatesPorTipo(
    tipoAtividade: TipoAtividade,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<ChecklistTemplate[]> {
    let where: any = { tipoAtividade };
    
    // Auditores só veem checklists ativos
    if (usuarioAutenticado && usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
      where = { ...where, ativo: true };
    }
    // Gestores e Master veem todos (ativos e inativos)
    
    const templates = await this.templateRepository.find({
      where,
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
    if (usuarioAutenticado && usuarioAutenticado.perfil === PerfilUsuario.GESTOR && template.gestorId !== usuarioAutenticado.id) {
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
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<ChecklistTemplate> {
    const template = await this.buscarTemplatePorId(id, usuarioAutenticado);
    
    // Verificar permissões
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR && template.gestorId !== usuarioAutenticado.id) {
        throw new ForbiddenException('Apenas o gestor responsável pode editar este checklist');
      }
    }
    
    Object.assign(template, {
      nome: dto.nome ?? template.nome,
      descricao: dto.descricao ?? template.descricao,
      tipoAtividade: dto.tipoAtividade ?? template.tipoAtividade,
      versao: dto.versao ?? template.versao,
    });
    return this.templateRepository.save(template);
  }

  /**
   * Verifica se um template está sendo usado em alguma auditoria.
   */
  async templateEmUso(templateId: string): Promise<boolean> {
    const count = await this.auditoriaRepository.count({
      where: { templateId },
    });
    return count > 0;
  }

  /**
   * Remove um template (hard delete) apenas se não estiver vinculado a auditorias.
   */
  async removerTemplate(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<void> {
    const template = await this.buscarTemplatePorId(id, usuarioAutenticado);
    
    // Verificar permissões
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR && template.gestorId !== usuarioAutenticado.id) {
        throw new ForbiddenException('Apenas o gestor responsável pode excluir este checklist');
      }
      if (usuarioAutenticado.perfil !== PerfilUsuario.MASTER && usuarioAutenticado.perfil !== PerfilUsuario.GESTOR) {
        throw new ForbiddenException('Apenas Master e Gestor podem excluir checklists');
      }
    }
    
    // Verificar se está em uso
    const emUso = await this.templateEmUso(id);
    if (emUso) {
      throw new BadRequestException(
        'Não é possível excluir este checklist pois ele está vinculado a uma ou mais auditorias. Use a opção de inativar.'
      );
    }
    
    // Hard delete: remove o template e todos os seus itens e grupos
    await this.itemRepository.delete({ templateId: id });
    await this.grupoRepository.delete({ templateId: id });
    await this.templateRepository.delete(id);
  }

  /**
   * Inativa ou ativa um template.
   */
  async alterarStatusTemplate(
    id: string,
    ativo: boolean,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<ChecklistTemplate> {
    const template = await this.buscarTemplatePorId(id, usuarioAutenticado);
    
    // Verificar permissões
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR && template.gestorId !== usuarioAutenticado.id) {
        throw new ForbiddenException('Apenas o gestor responsável pode alterar o status deste checklist');
      }
      if (usuarioAutenticado.perfil !== PerfilUsuario.MASTER && usuarioAutenticado.perfil !== PerfilUsuario.GESTOR) {
        throw new ForbiddenException('Apenas Master e Gestor podem alterar o status de checklists');
      }
    }
    
    template.ativo = ativo;
    return this.templateRepository.save(template);
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

    // Normalizar configs antes de salvar
    this.normalizarOpcoesConfig(item);

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

    // Normalizar configs antes de salvar
    this.normalizarOpcoesConfig(item);

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

  /**
   * Normaliza opcoesRespostaConfig para garantir sincronia com opcoesResposta.
   * Garante que cada opção tenha uma configuração correspondente.
   */
  private normalizarOpcoesConfig(item: Partial<TemplateItem>): void {
    // Respostas padrão
    const RESPOSTAS_PADRAO = [
      'conforme',
      'nao_conforme',
      'nao_aplicavel',
      'nao_avaliado',
    ];

    const usaRespostasPersonalizadas =
      item.usarRespostasPersonalizadas ||
      item.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT;

    if (usaRespostasPersonalizadas && item.opcoesResposta) {
      // Para respostas personalizadas, sincronizar com opcoesResposta
      const configExistente = item.opcoesRespostaConfig || [];
      item.opcoesRespostaConfig = item.opcoesResposta.map((opcao) => {
        const config = configExistente.find((c) => c.valor === opcao);
        return (
          config || {
            valor: opcao,
            fotoObrigatoria: false,
            observacaoObrigatoria: false,
          }
        );
      });
    } else {
      // Para respostas padrão
      const configExistente = item.opcoesRespostaConfig || [];
      item.opcoesRespostaConfig = RESPOSTAS_PADRAO.map((valor) => {
        const config = configExistente.find((c) => c.valor === valor);
        return (
          config || {
            valor,
            fotoObrigatoria: false,
            observacaoObrigatoria: false,
          }
        );
      });
    }
  }
}

