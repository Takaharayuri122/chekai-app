import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Auditoria, StatusAuditoria } from './entities/auditoria.entity';
import { AuditoriaItem, RespostaItem } from './entities/auditoria-item.entity';
import { TemplateItem, TipoRespostaCustomizada } from '../checklist/entities/template-item.entity';
import { Legislacao } from '../legislacao/entities/legislacao.entity';
import { Foto } from './entities/foto.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import { ClienteAuditorDesvinculo } from '../cliente/entities/cliente-auditor-desvinculo.entity';
import { LegislacaoService } from '../legislacao/legislacao.service';
import { LegislacaoVinculoService } from '../legislacao/legislacao-vinculo.service';
import { validarLegislacaoIds } from '../legislacao/lib/validar-legislacao-ids';
import { resumirLegislacoes } from '../legislacao/lib/resumo-legislacao';
import { ChecklistService } from '../checklist/checklist.service';
import {
  calcularNotaDaAuditoria,
  calcularPontuacaoOpcao,
  ehImagemDeAssinatura,
  ehNaoConformidade,
  getPontuacaoMaximaItem,
  isOpcaoSemPontuacao,
} from '../checklist/regras';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import {
  IniciarAuditoriaDto,
  ResponderItemDto,
  FinalizarAuditoriaDto,
} from './dto/criar-auditoria.dto';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../shared/types/pagination.interface';
import { IaService } from '../ia/ia.service';
import { lerHorarioOffline } from '../../shared/offline/horario-offline';

/**
 * Serviço responsável pela gestão de auditorias.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    @InjectRepository(AuditoriaItem)
    private readonly itemRepository: Repository<AuditoriaItem>,
    @InjectRepository(Foto)
    private readonly fotoRepository: Repository<Foto>,
    @InjectRepository(Unidade)
    private readonly unidadeRepository: Repository<Unidade>,
    private readonly checklistService: ChecklistService,
    private readonly iaService: IaService,
    private readonly legislacaoService: LegislacaoService,
    private readonly legislacaoVinculoService: LegislacaoVinculoService,
    @Inject(forwardRef(() => 'ValidacaoLimitesService'))
    @Optional()
    private readonly validacaoLimites?: any,
    @InjectRepository(ClienteAuditorDesvinculo)
    @Optional()
    private readonly desvinculoRepository?: Repository<ClienteAuditorDesvinculo>,
  ) {}

  /**
   * Inicia uma nova auditoria.
   */
  async iniciarAuditoria(
    consultorId: string,
    dto: IniciarAuditoriaDto,
    usuario?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Auditoria> {
    if (dto.localId) {
      const existente = await this.auditoriaRepository.findOne({
        where: { consultorId, localId: dto.localId },
      });
      if (existente) return this.buscarAuditoriaPorId(existente.id, usuario);
    }
    // Horário do celular: limitado à janela de registros sem internet (senão contornaria os bloqueios)
    const dataInicio = dto.dataInicio ? lerHorarioOffline(dto.dataInicio) : undefined;
    // Fluxo offline: bloqueios criados depois do início no celular não valem para este trabalho
    const momento = dto.localId ? dataInicio : undefined;
    // Valida limite de auditorias
    if (usuario && this.validacaoLimites && usuario.perfil !== PerfilUsuario.MASTER) {
      const gestorId = this.validacaoLimites.identificarGestorId(usuario);
      if (gestorId) {
        await this.validacaoLimites.validarLimiteAuditorias(gestorId, momento);
      }
    }
    await this.validarUnidadeParaNovaAuditoria(dto.unidadeId, usuario, momento);
    const template = await this.checklistService.buscarTemplatePorId(dto.templateId, usuario);
    let itensDoTemplate = template.itens.filter((item) => item.ativo);
    if (dto.templateItemIds) {
      const porId = new Map(template.itens.map((item) => [item.id, item]));
      // um item por pergunta: ids repetidos no envio não duplicam itens
      const templateItemIds = [...new Set(dto.templateItemIds)];
      const desconhecidos = templateItemIds.filter((id) => !porId.has(id));
      if (desconhecidos.length > 0) {
        throw new BadRequestException('Itens não pertencem ao template informado');
      }
      itensDoTemplate = templateItemIds.map((id) => porId.get(id)!);
    }
    const auditoria = this.auditoriaRepository.create({
      consultorId,
      unidadeId: dto.unidadeId,
      templateId: dto.templateId,
      localId: dto.localId ?? null,
      status: StatusAuditoria.EM_ANDAMENTO,
      dataInicio: dataInicio ?? new Date(),
      latitudeInicio: dto.latitude,
      longitudeInicio: dto.longitude,
    });
    const savedAuditoria = await this.auditoriaRepository.save(auditoria);
    const itens = itensDoTemplate.map((templateItem) =>
      this.itemRepository.create({
        auditoriaId: savedAuditoria.id,
        templateItemId: templateItem.id,
        resposta: RespostaItem.NAO_AVALIADO,
      }),
    );
    await this.itemRepository.save(itens);
    return this.buscarAuditoriaPorId(savedAuditoria.id, usuario);
  }

  /**
   * Lista auditorias do usuário. Cada usuário vê apenas auditorias em que é o consultor.
   */
  async listarAuditorias(
    params: PaginationParams,
    usuarioAutenticado: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
    clienteId?: string,
  ): Promise<PaginatedResult<Auditoria>> {
    const queryBuilder = this.auditoriaRepository.createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.unidade', 'unidade')
      .leftJoinAndSelect('unidade.cliente', 'cliente')
      .leftJoinAndSelect('auditoria.template', 'template')
      .leftJoinAndSelect('auditoria.consultor', 'consultor')
      .leftJoinAndSelect('auditoria.itens', 'itens');
    if (usuarioAutenticado.perfil === PerfilUsuario.MASTER || usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
      queryBuilder.where(
        '(auditoria.consultorId = :userId OR consultor.gestorId = :userId)',
        { userId: usuarioAutenticado.id },
      );
    } else {
      queryBuilder.where('auditoria.consultorId = :consultorId', {
        consultorId: usuarioAutenticado.id,
      });
    }
    // Filtro opcional aplicado depois do isolamento: nunca amplia o que o usuário pode ver
    if (clienteId) queryBuilder.andWhere('cliente.id = :clienteId', { clienteId });
    const [items, total] = await queryBuilder
      .skip((params.page - 1) * params.limit)
      .take(params.limit)
      .orderBy('auditoria.criadoEm', 'DESC')
      .getManyAndCount();
    const ids = items.map((a) => a.id);
    const contagens: Array<{ auditoria_id: string; total: string }> = ids.length
      ? await this.auditoriaRepository.query(
          `SELECT ai.auditoria_id, COUNT(f.id) AS total
           FROM fotos f JOIN auditoria_itens ai ON ai.id = f.auditoria_item_id
           WHERE ai.auditoria_id = ANY($1::uuid[])
           GROUP BY ai.auditoria_id`,
          [ids],
        )
      : [];
    const porAuditoria = new Map(contagens.map((c) => [c.auditoria_id, Number(c.total)]));
    const comFotos = items.map((a) =>
      Object.assign(a, { totalFotos: porAuditoria.get(a.id) ?? 0 }),
    );
    return createPaginatedResult(comFotos, total, params.page, params.limit);
  }

  /**
   * Lista auditorias finalizadas de uma unidade (histórico). Apenas do consultor autenticado.
   */
  async listarHistoricoPorUnidade(
    unidadeId: string,
    usuarioAutenticado: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
    templateId?: string,
  ): Promise<Auditoria[]> {
    const queryBuilder = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.template', 'template')
      .leftJoinAndSelect('auditoria.consultor', 'consultor')
      .where('auditoria.unidadeId = :unidadeId', { unidadeId })
      .andWhere('auditoria.status = :status', { status: StatusAuditoria.FINALIZADA });
    if (templateId) {
      queryBuilder.andWhere('auditoria.templateId = :templateId', { templateId });
    }
    if (usuarioAutenticado.perfil === PerfilUsuario.MASTER || usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
      queryBuilder.andWhere(
        '(auditoria.consultorId = :userId OR consultor.gestorId = :userId)',
        { userId: usuarioAutenticado.id },
      );
    } else {
      queryBuilder.andWhere('auditoria.consultorId = :consultorId', {
        consultorId: usuarioAutenticado.id,
      });
    }
    return queryBuilder
      .orderBy('auditoria.dataFim', 'DESC')
      .addOrderBy('auditoria.criadoEm', 'DESC')
      .take(30)
      .getMany();
  }

  /**
   * Busca uma auditoria pelo ID. Acesso apenas se o usuário for o consultor da auditoria.
   */
  async buscarAuditoriaPorId(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Auditoria> {
    const auditoria = await this.auditoriaRepository.findOne({
      where: { id },
      relations: [
        'consultor',
        'unidade',
        'unidade.cliente',
        'unidade.cliente.gestor',
        'template',
        'itens',
        'itens.templateItem',
        'itens.templateItem.grupo',
        'itens.templateItem.legislacoes',
        'itens.legislacoes',
        'itens.fotos',
      ],
    });
    if (!auditoria) {
      throw new NotFoundException('Auditoria não encontrada');
    }
    for (const item of auditoria.itens ?? []) {
      resumirLegislacoes([item]);
      if (item.templateItem) resumirLegislacoes([item.templateItem]);
    }
    if (usuarioAutenticado) {
      this.validarAcessoAuditoria(auditoria, usuarioAutenticado);
    }
    return auditoria;
  }

  private validarAcessoAuditoria(
    auditoria: Auditoria,
    usuario: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): void {
    if (auditoria.consultorId === usuario.id) {
      return;
    }
    if (usuario.perfil === PerfilUsuario.MASTER || usuario.perfil === PerfilUsuario.GESTOR) {
      const consultor = auditoria.consultor;
      if (consultor && consultor.gestorId === usuario.id) {
        return;
      }
    }
    throw new ForbiddenException('Acesso negado a esta auditoria');
  }

  /**
   * Responde um item da auditoria.
   */
  async responderItem(
    auditoriaId: string,
    itemId: string,
    dto: ResponderItemDto,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<AuditoriaItem> {
    const auditoria = await this.buscarAuditoriaPorId(auditoriaId, usuarioAutenticado);
    if (auditoria.status === StatusAuditoria.FINALIZADA) {
      throw new BadRequestException('Não é possível editar uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
    }
    const item = await this.itemRepository.findOne({
      where: { id: itemId, auditoriaId },
      relations: ['templateItem', 'fotos'],
    });
    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }
    // Só carrega as legislações quando o DTO as traz (evita salvar relação parcial)
    let legislacoesDoDto: Legislacao[] | undefined;
    if (dto.legislacaoIds !== undefined) {
      legislacoesDoDto = await this.legislacaoService.buscarPorIds(validarLegislacaoIds(dto.legislacaoIds));
    }
    // Validar resposta: deve ser um valor do enum ou uma opção personalizada do template
    const templateItem = item.templateItem;
    
    // Se tem tipoRespostaCustomizada (texto, numero, data, select), valida conforme o tipo
    if (templateItem?.tipoRespostaCustomizada) {
      if (!dto.resposta || dto.resposta.trim() === '') {
        throw new BadRequestException('Resposta é obrigatória para este tipo de item');
      }
      // Validação específica por tipo
      if (templateItem.tipoRespostaCustomizada === 'numero') {
        const num = Number(dto.resposta);
        if (isNaN(num)) {
          throw new BadRequestException('Resposta deve ser um número válido');
        }
      } else if (templateItem.tipoRespostaCustomizada === 'data') {
        const data = new Date(dto.resposta);
        if (isNaN(data.getTime())) {
          throw new BadRequestException('Resposta deve ser uma data válida');
        }
      } else if (templateItem.tipoRespostaCustomizada === TipoRespostaCustomizada.ASSINATURA) {
        if (!ehImagemDeAssinatura(dto.resposta)) {
          throw new BadRequestException('A assinatura deve ser uma imagem PNG de até 400 KB');
        }
      } else if (templateItem.tipoRespostaCustomizada === 'select') {
        // Para 'select', validar que a resposta está nas opções disponíveis
        if (!templateItem.opcoesResposta || templateItem.opcoesResposta.length === 0) {
          throw new BadRequestException('Item do tipo SELECT deve ter opções de resposta definidas');
        }
        if (!templateItem.opcoesResposta.includes(dto.resposta)) {
          throw new BadRequestException(
            `Resposta inválida. Opções válidas: ${templateItem.opcoesResposta.join(', ')}`
          );
        }
      }
      // Para 'texto', aceita qualquer string não vazia (já validado acima)
    } else if (templateItem?.usarRespostasPersonalizadas && templateItem?.opcoesResposta) {
      // Se o template usa opções personalizadas, validar se a resposta está nas opções
      if (!templateItem.opcoesResposta.includes(dto.resposta)) {
        throw new BadRequestException(
          `Resposta inválida. Opções válidas: ${templateItem.opcoesResposta.join(', ')}`
        );
      }
    } else {
      // Se não usa opções personalizadas, validar se é um valor do enum
      if (!Object.values(RespostaItem).includes(dto.resposta as RespostaItem)) {
        throw new BadRequestException(
          `Resposta inválida. Valores válidos: ${Object.values(RespostaItem).join(', ')}`
        );
      }
    }
    item.resposta = dto.resposta;
    item.observacao = dto.observacao ?? item.observacao;
    item.descricaoNaoConformidade = dto.descricaoNaoConformidade ?? item.descricaoNaoConformidade;
    item.descricaoIa = dto.descricaoIa ?? item.descricaoIa;
    item.complementoDescricao = dto.complementoDescricao ?? item.complementoDescricao;
    item.planoAcaoSugerido = dto.planoAcaoSugerido ?? item.planoAcaoSugerido;
    if (legislacoesDoDto !== undefined) {
      item.legislacoes = legislacoesDoDto;
      // Com legislacaoIds presente, o texto é sempre o derivado (lista vazia → null)
      item.referenciaLegal = this.legislacaoVinculoService.textoDerivado(legislacoesDoDto) as string;
    } else {
      item.referenciaLegal = dto.referenciaLegal ?? item.referenciaLegal;
    }
    item.pontuacao = calcularPontuacaoOpcao(templateItem, dto.resposta);
    const salvo = await this.itemRepository.save(item);
    resumirLegislacoes([salvo]);
    return salvo;
  }

  /**
   * Adiciona uma foto a um item da auditoria.
   */
  async adicionarFoto(
    auditoriaId: string,
    itemId: string,
    fotoData: {
      url: string;
      nomeOriginal?: string;
      mimeType?: string;
      tamanhoBytes?: number;
      exif?: Record<string, unknown> | null;
      latitude?: number;
      longitude?: number;
    },
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Foto> {
    const auditoria = await this.buscarAuditoriaPorId(auditoriaId, usuarioAutenticado);
    if (auditoria.status === StatusAuditoria.FINALIZADA) {
      throw new BadRequestException('Não é possível adicionar fotos em uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
    }
    const item = await this.itemRepository.findOne({
      where: { id: itemId, auditoriaId },
      relations: ['templateItem'],
    });
    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }
    // RN-FOT-005: aceita a foto (apps antigos), mas registra aviso.
    if (item.templateItem?.permiteFoto === false) {
      this.logger.warn(
        `Foto recebida em item sem permissão de foto (auditoria ${auditoriaId}, item ${itemId})`,
      );
    }
    const nomeOriginalSanitizado = fotoData.nomeOriginal
      ?.replace(/\0/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    const foto = this.fotoRepository.create({
      ...fotoData,
      nomeOriginal: nomeOriginalSanitizado,
      auditoriaItemId: itemId,
      dataCaptura: new Date(),
    });
    return this.fotoRepository.save(foto);
  }

  /**
   * Remove uma foto de um item da auditoria.
   */
  async removerFoto(
    auditoriaId: string,
    fotoId: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<void> {
    await this.buscarAuditoriaPorId(auditoriaId, usuarioAutenticado);
    const foto = await this.fotoRepository.findOne({ where: { id: fotoId } });
    if (!foto) {
      throw new NotFoundException('Foto não encontrada');
    }
    await this.fotoRepository.remove(foto);
  }

  /**
   * Atualiza a análise de IA de uma foto.
   */
  async atualizarAnaliseFoto(
    auditoriaId: string,
    fotoId: string,
    analiseIa: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Foto> {
    await this.buscarAuditoriaPorId(auditoriaId, usuarioAutenticado);
    const foto = await this.fotoRepository.findOne({ where: { id: fotoId } });
    if (!foto) {
      throw new NotFoundException('Foto não encontrada');
    }
    foto.analiseIa = analiseIa;
    foto.processadoPorIa = true;
    return this.fotoRepository.save(foto);
  }

  /**
   * Finaliza uma auditoria.
   */
  async finalizarAuditoria(
    id: string,
    dto: FinalizarAuditoriaDto,
    usuarioAutenticado: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Auditoria> {
    const auditoria = await this.buscarAuditoriaPorId(id, usuarioAutenticado);
    if (auditoria.status === StatusAuditoria.FINALIZADA) {
      // Reenvio da fila offline (dataFim presente): operação idempotente.
      if (dto.dataFim) return auditoria;
      throw new BadRequestException('Auditoria já finalizada');
    }
    // Validar apenas itens obrigatórios não avaliados
    const itensObrigatoriosNaoAvaliados = auditoria.itens.filter(
      (item) => 
        item.templateItem?.obrigatorio === true &&
        (item.resposta === RespostaItem.NAO_AVALIADO || !item.resposta),
    );
    if (itensObrigatoriosNaoAvaliados.length > 0) {
      throw new BadRequestException(
        `Existem ${itensObrigatoriosNaoAvaliados.length} itens obrigatórios não avaliados`,
      );
    }
    const { percentual: pontuacaoPercentual } = calcularNotaDaAuditoria(auditoria.itens);
    auditoria.status = StatusAuditoria.FINALIZADA;
    auditoria.dataFim = dto.dataFim ? new Date(dto.dataFim) : new Date();
    if (dto.latitude !== undefined) {
      auditoria.latitudeFim = dto.latitude;
    }
    if (dto.longitude !== undefined) {
      auditoria.longitudeFim = dto.longitude;
    }
    if (dto.observacoesGerais !== undefined) {
      auditoria.observacoesGerais = dto.observacoesGerais;
    }
    auditoria.pontuacaoTotal = pontuacaoPercentual;
    return this.auditoriaRepository.save(auditoria);
  }

  /**
   * Reabre uma auditoria finalizada.
   */
  async reabrirAuditoria(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Auditoria> {
    const auditoria = await this.buscarAuditoriaPorId(id, usuarioAutenticado);
    
    if (auditoria.status !== StatusAuditoria.FINALIZADA) {
      throw new BadRequestException('Apenas auditorias finalizadas podem ser reabertas');
    }
    
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR && auditoria.consultorId !== usuarioAutenticado.id) {
        throw new ForbiddenException('Apenas o auditor responsável pode reabrir esta auditoria');
      }
      if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR || usuarioAutenticado.perfil === PerfilUsuario.MASTER) {
        const consultor = auditoria.consultor;
        const podeReabrir =
          auditoria.consultorId === usuarioAutenticado.id ||
          (consultor && consultor.gestorId === usuarioAutenticado.id);
        if (!podeReabrir) {
          throw new ForbiddenException('Apenas o gestor responsável pode reabrir esta auditoria');
        }
      }
    }
    
    auditoria.status = StatusAuditoria.EM_ANDAMENTO;
    
    // Limpar dados de finalização usando update para permitir null
    // Também limpa o resumo executivo, pois pode mudar se a auditoria for alterada
    await this.auditoriaRepository.update(id, {
      status: StatusAuditoria.EM_ANDAMENTO,
      dataFim: null as any,
      latitudeFim: null as any,
      longitudeFim: null as any,
      resumoExecutivo: null as any,
    });
    
    return this.buscarAuditoriaPorId(id, usuarioAutenticado);
  }

  /**
   * Busca itens não conformes de uma auditoria.
   */
  async buscarItensNaoConformes(
    auditoriaId: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<AuditoriaItem[]> {
    await this.buscarAuditoriaPorId(auditoriaId, usuarioAutenticado);
    const itens = await this.itemRepository.find({
      where: { auditoriaId },
      relations: ['templateItem', 'fotos'],
    });
    return itens.filter((item) => ehNaoConformidade(item.templateItem, item.resposta));
  }

  /**
   * Remove uma auditoria (apenas para GESTOR ou superior).
   * Remove também todos os itens e fotos relacionados.
   */
  async removerAuditoria(
    id: string,
    usuarioAutenticado: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<void> {
    const auditoria = await this.buscarAuditoriaPorId(id, usuarioAutenticado);
    if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestores podem remover auditorias');
    }
    const consultor = auditoria.consultor;
    const podeRemover =
      auditoria.consultorId === usuarioAutenticado.id ||
      (consultor && consultor.gestorId === usuarioAutenticado.id);
    if (!podeRemover) {
      throw new ForbiddenException('Apenas o gestor responsável pode remover esta auditoria');
    }
    // Buscar todos os itens da auditoria
    const itens = await this.itemRepository.find({
      where: { auditoriaId: id },
      relations: ['fotos'],
    });
    // Remover todas as fotos
    for (const item of itens) {
      if (item.fotos && item.fotos.length > 0) {
        await this.fotoRepository.remove(item.fotos);
      }
    }
    // Remover todos os itens
    if (itens.length > 0) {
      await this.itemRepository.remove(itens);
    }
    // Remover a auditoria
    await this.auditoriaRepository.remove(auditoria);
  }

  /**
   * Gera resumo executivo de uma auditoria finalizada usando IA.
   * Se o resumo já foi gerado anteriormente, retorna o resumo salvo.
   * Caso contrário, gera um novo resumo e salva na auditoria.
   */
  async gerarResumoExecutivo(
    auditoriaId: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{
    resumo: string;
    pontosFortes: string[];
    pontosFracos: string[];
    recomendacoesPrioritarias: string[];
    riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
    tendencias: string[];
  }> {
    this.logger.log(`[gerarResumoExecutivo] Iniciando geração de resumo para auditoria ${auditoriaId}`);
    try {
      this.logger.log(`[gerarResumoExecutivo] Buscando auditoria ${auditoriaId}`);
      const auditoria = await this.buscarAuditoriaPorId(auditoriaId, usuarioAutenticado);
      this.logger.log(`[gerarResumoExecutivo] Auditoria encontrada. Status: ${auditoria.status}`);
      
      if (auditoria.status !== StatusAuditoria.FINALIZADA) {
        this.logger.warn(`[gerarResumoExecutivo] Auditoria não está finalizada. Status: ${auditoria.status}`);
        throw new BadRequestException('Apenas auditorias finalizadas podem gerar resumo executivo');
      }

      this.logger.log(`[gerarResumoExecutivo] Processando ${auditoria.itens?.length || 0} itens da auditoria`);
      const itensPorGrupo = new Map<string, AuditoriaItem[]>();
      auditoria.itens.forEach((item) => {
        const grupoId = item.templateItem?.grupoId || 'sem-grupo';
        const grupoNome = item.templateItem?.grupo?.nome || 'Sem Grupo';
        if (!itensPorGrupo.has(grupoId)) {
          itensPorGrupo.set(grupoId, []);
        }
        itensPorGrupo.get(grupoId)!.push(item);
      });
      
      this.logger.log(`[gerarResumoExecutivo] Agrupados ${itensPorGrupo.size} grupos`);
      const grupos = Array.from(itensPorGrupo.entries()).map(([grupoId, itens]) => {
        const primeiroItem = itens[0];
        const grupoNome = primeiroItem.templateItem?.grupo?.nome || 'Sem Grupo';
        const itensPontuaveisGrupo = itens.filter(
          (item) => !isOpcaoSemPontuacao(item.resposta || ''),
        );
        const pontuacaoPossivel = itensPontuaveisGrupo.reduce(
          (acc, item) => acc + getPontuacaoMaximaItem(item.templateItem),
          0,
        );
        const pontuacaoObtida = itensPontuaveisGrupo.reduce((acc, item) => acc + item.pontuacao, 0);
        const naoConformidades = itens.filter((item) =>
          ehNaoConformidade(item.templateItem, item.resposta),
        ).length;
        return {
          nome: grupoNome,
          pontuacaoPossivel,
          pontuacaoObtida,
          naoConformidades,
          itens: itens.map((item) => ({
            pergunta: item.templateItem?.pergunta || '',
            resposta: item.resposta,
            naoConforme: ehNaoConformidade(item.templateItem, item.resposta),
            observacao: item.observacao,
            descricaoNaoConformidade: item.descricaoNaoConformidade,
            descricaoIa: item.descricaoIa,
            criticidade: item.templateItem?.criticidade || 'media',
          })),
        };
      });
      
      this.logger.log(`[gerarResumoExecutivo] Processados ${grupos.length} grupos`);
      
      const itensNaoConformes = auditoria.itens
        .filter((item) => ehNaoConformidade(item.templateItem, item.resposta))
        .map((item) => ({
          pergunta: item.templateItem?.pergunta || '',
          observacao: item.observacao,
          descricaoNaoConformidade: item.descricaoNaoConformidade,
          descricaoIa: item.descricaoIa,
          criticidade: item.templateItem?.criticidade || 'media',
        }));
      
      this.logger.log(`[gerarResumoExecutivo] Encontradas ${itensNaoConformes.length} não conformidades`);
      
      const dadosAuditoria = {
        unidade: auditoria.unidade?.nome || 'Unidade',
        cliente: auditoria.unidade?.cliente?.nomeFantasia || auditoria.unidade?.cliente?.razaoSocial || 'Cliente',
        tipoAtividade: auditoria.template?.tipoAtividade || 'serviço de alimentação',
        pontuacaoTotal: auditoria.pontuacaoTotal || 0,
        grupos,
        itensNaoConformes,
        observacoesGerais: auditoria.observacoesGerais,
      };
      
      this.logger.log(`[gerarResumoExecutivo] Chamando IA para gerar resumo. Unidade: ${dadosAuditoria.unidade}, Cliente: ${dadosAuditoria.cliente}`);
      
      const resumo = await this.iaService.gerarResumoExecutivo(dadosAuditoria, usuarioAutenticado);
      
      this.logger.log(`[gerarResumoExecutivo] Resumo gerado com sucesso. Salvando na auditoria...`);
      
      auditoria.resumoExecutivo = resumo;
      auditoria.resumoExecutivoGeradoEm = new Date();
      await this.auditoriaRepository.save(auditoria);
      
      this.logger.log(`[gerarResumoExecutivo] Resumo salvo com sucesso na auditoria ${auditoriaId}`);
      
      return resumo;
    } catch (error) {
      this.logger.error(`[gerarResumoExecutivo] Erro ao gerar resumo executivo para auditoria ${auditoriaId}:`, error);
      this.logger.error(`[gerarResumoExecutivo] Stack trace:`, error?.stack);
      throw error;
    }
  }

  /**
   * Atualiza a URL do PDF gerado na auditoria.
   */
  async atualizarPdfUrl(auditoriaId: string, pdfUrl: string): Promise<void> {
    // Mesmo relógio do banco para pdf_gerado_em e atualizado_em: o PDF recém-gerado não nasce "desatualizado"
    await this.auditoriaRepository
      .createQueryBuilder()
      .update(Auditoria)
      .set({ pdfUrl, pdfGeradoEm: () => 'CURRENT_TIMESTAMP' })
      .where('id = :id', { id: auditoriaId })
      .execute();
  }

  /**
   * Garante que a unidade e o cliente estão ativos e, para auditor, que ele está vinculado ao cliente.
   */
  private async validarUnidadeParaNovaAuditoria(
    unidadeId: string,
    usuario?: { id: string; perfil: PerfilUsuario },
    momento?: Date,
  ): Promise<void> {
    const unidade = await this.unidadeRepository.findOne({
      where: { id: unidadeId },
      relations: ['cliente', 'cliente.auditores'],
    });
    if (!unidade || !unidade.cliente) {
      throw new NotFoundException('Unidade não encontrada');
    }
    if (!unidade.cliente.ativo && !this.inativadoDepoisDe(unidade.cliente.inativadoEm, momento)) {
      throw new BadRequestException('Este cliente está inativo e não pode receber novas auditorias');
    }
    if (!unidade.ativo && !this.inativadoDepoisDe(unidade.inativadoEm, momento)) {
      throw new BadRequestException('Esta unidade está inativa e não pode receber novas auditorias');
    }
    if (usuario?.perfil === PerfilUsuario.AUDITOR) {
      const isVinculado = (unidade.cliente.auditores || []).some((a) => a.id === usuario.id);
      if (!isVinculado && !(await this.desvinculadoDepoisDe(unidade.cliente.id, usuario.id, momento))) {
        throw new ForbiddenException('Você não está vinculado a este cliente');
      }
    }
  }

  private inativadoDepoisDe(inativadoEm: Date | null | undefined, momento?: Date): boolean {
    return !!momento && !!inativadoEm && new Date(inativadoEm).getTime() > momento.getTime();
  }

  private async desvinculadoDepoisDe(clienteId: string, auditorId: string, momento?: Date): Promise<boolean> {
    if (!momento || !this.desvinculoRepository) return false;
    const desvinculo = await this.desvinculoRepository.findOne({
      where: { clienteId, auditorId, desvinculadoEm: MoreThan(momento) },
    });
    return !!desvinculo;
  }
}

