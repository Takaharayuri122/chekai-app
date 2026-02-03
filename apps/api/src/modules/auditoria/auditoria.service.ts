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
import { Repository } from 'typeorm';
import { Auditoria, StatusAuditoria } from './entities/auditoria.entity';
import { AuditoriaItem, RespostaItem } from './entities/auditoria-item.entity';
import { TemplateItem } from '../checklist/entities/template-item.entity';
import { Foto } from './entities/foto.entity';
import { ChecklistService } from '../checklist/checklist.service';
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
    private readonly checklistService: ChecklistService,
    private readonly iaService: IaService,
    @Inject(forwardRef(() => 'ValidacaoLimitesService'))
    @Optional()
    private readonly validacaoLimites?: any,
  ) {}

  /**
   * Inicia uma nova auditoria.
   */
  async iniciarAuditoria(
    consultorId: string,
    dto: IniciarAuditoriaDto,
    usuario?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Auditoria> {
    // Valida limite de auditorias
    if (usuario && this.validacaoLimites && usuario.perfil !== PerfilUsuario.MASTER) {
      const gestorId = this.validacaoLimites.identificarGestorId(usuario);
      if (gestorId) {
        await this.validacaoLimites.validarLimiteAuditorias(gestorId);
      }
    }
    const template = await this.checklistService.buscarTemplatePorId(dto.templateId, { id: consultorId, perfil: PerfilUsuario.AUDITOR });
    const auditoria = this.auditoriaRepository.create({
      consultorId,
      unidadeId: dto.unidadeId,
      templateId: dto.templateId,
      status: StatusAuditoria.EM_ANDAMENTO,
      dataInicio: new Date(),
      latitudeInicio: dto.latitude,
      longitudeInicio: dto.longitude,
    });
    const savedAuditoria = await this.auditoriaRepository.save(auditoria);
    const itens = template.itens
      .filter((item) => item.ativo)
      .map((templateItem) =>
        this.itemRepository.create({
          auditoriaId: savedAuditoria.id,
          templateItemId: templateItem.id,
          resposta: RespostaItem.NAO_AVALIADO,
        }),
      );
    await this.itemRepository.save(itens);
    return this.buscarAuditoriaPorId(savedAuditoria.id);
  }

  /**
   * Lista auditorias, filtradas por perfil do usuário autenticado.
   * Retorna todas as auditorias (em andamento e finalizadas) do usuário.
   */
  async listarAuditorias(
    params: PaginationParams,
    usuarioAutenticado: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<PaginatedResult<Auditoria>> {
    const queryBuilder = this.auditoriaRepository.createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.unidade', 'unidade')
      .leftJoinAndSelect('unidade.cliente', 'cliente')
      .leftJoinAndSelect('auditoria.template', 'template')
      .leftJoinAndSelect('auditoria.consultor', 'consultor');
    
    if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
      // Auditor vê apenas suas próprias auditorias (todas, independente do status)
      queryBuilder.where('auditoria.consultorId = :consultorId', { consultorId: usuarioAutenticado.id });
    } else if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
      // Gestor vê auditorias criadas por ele OU por seus auditores vinculados
      // Usa subquery para garantir que funcione mesmo se o consultor não estiver carregado
      queryBuilder.where(
        '(auditoria.consultor_id = :gestorId OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auditoria.consultor_id AND u.gestor_id = :gestorId))',
        { gestorId: usuarioAutenticado.id }
      );
    }
    // Master vê todas as auditorias (sem filtro adicional)
    
    const [items, total] = await queryBuilder
      .skip((params.page - 1) * params.limit)
      .take(params.limit)
      .orderBy('auditoria.criadoEm', 'DESC')
      .getManyAndCount();
    return createPaginatedResult(items, total, params.page, params.limit);
  }

  /**
   * Lista auditorias finalizadas de uma unidade para exibir histórico de evolução no relatório.
   * Respeita as mesmas regras de permissão (auditor vê só as suas, gestor as suas e da equipe, master todas).
   */
  async listarHistoricoPorUnidade(
    unidadeId: string,
    usuarioAutenticado: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<Auditoria[]> {
    const queryBuilder = this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.template', 'template')
      .where('auditoria.unidadeId = :unidadeId', { unidadeId })
      .andWhere('auditoria.status = :status', { status: StatusAuditoria.FINALIZADA });
    if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
      queryBuilder.andWhere('auditoria.consultorId = :consultorId', {
        consultorId: usuarioAutenticado.id,
      });
    } else if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
      queryBuilder.andWhere(
        '(auditoria.consultor_id = :gestorId OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auditoria.consultor_id AND u.gestor_id = :gestorId))',
        { gestorId: usuarioAutenticado.id },
      );
    }
    return queryBuilder
      .orderBy('auditoria.dataFim', 'DESC')
      .addOrderBy('auditoria.criadoEm', 'DESC')
      .take(30)
      .getMany();
  }

  /**
   * Busca uma auditoria pelo ID, verificando permissões de acesso.
   */
  async buscarAuditoriaPorId(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<Auditoria> {
    const auditoria = await this.auditoriaRepository.findOne({
      where: { id },
      relations: [
        'consultor',
        'unidade',
        'unidade.cliente',
        'template',
        'itens',
        'itens.templateItem',
        'itens.fotos',
      ],
    });
    if (!auditoria) {
      throw new NotFoundException('Auditoria não encontrada');
    }
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR && auditoria.consultorId !== usuarioAutenticado.id) {
        throw new ForbiddenException('Acesso negado a esta auditoria');
      }
      if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
        // Gestor pode acessar se:
        // 1. Ele mesmo criou a auditoria (consultorId === gestor.id), OU
        // 2. O consultor é um Auditor vinculado a ele (consultor.gestorId === gestor.id)
        const consultor = auditoria.consultor;
        const podeAcessar = 
          auditoria.consultorId === usuarioAutenticado.id || 
          (consultor && consultor.gestorId === usuarioAutenticado.id);
        if (!podeAcessar) {
          throw new ForbiddenException('Acesso negado a esta auditoria');
        }
      }
    }
    return auditoria;
  }

  /**
   * Responde um item da auditoria.
   */
  async responderItem(
    auditoriaId: string,
    itemId: string,
    dto: ResponderItemDto,
  ): Promise<AuditoriaItem> {
    // Verificar se a auditoria está finalizada
    const auditoria = await this.auditoriaRepository.findOne({
      where: { id: auditoriaId },
    });
    if (!auditoria) {
      throw new NotFoundException('Auditoria não encontrada');
    }
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
    item.referenciaLegal = dto.referenciaLegal ?? item.referenciaLegal;
    const configOpcao = templateItem?.opcoesRespostaConfig?.find(
      (c) => c.valor === dto.resposta,
    );
    if (configOpcao?.pontuacao != null) {
      item.pontuacao = configOpcao.pontuacao;
    } else {
      const peso = item.templateItem?.peso ?? 1;
      const isConforme =
        dto.resposta === RespostaItem.CONFORME ||
        (templateItem?.usarRespostasPersonalizadas &&
          templateItem?.opcoesResposta?.length > 0 &&
          dto.resposta === templateItem.opcoesResposta[0]);
      item.pontuacao = isConforme ? (peso > 0 ? peso : 0) : peso < 0 ? peso : 0;
    }
    return this.itemRepository.save(item);
  }

  /**
   * Adiciona uma foto a um item da auditoria.
   */
  async adicionarFoto(
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
  ): Promise<Foto> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId },
      relations: ['auditoria'],
    });
    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }
    // Verificar se a auditoria está finalizada
    if (item.auditoria.status === StatusAuditoria.FINALIZADA) {
      throw new BadRequestException('Não é possível adicionar fotos em uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
    }
    const foto = this.fotoRepository.create({
      ...fotoData,
      auditoriaItemId: itemId,
      dataCaptura: new Date(),
    });
    return this.fotoRepository.save(foto);
  }

  /**
   * Remove uma foto de um item da auditoria.
   */
  async removerFoto(fotoId: string): Promise<void> {
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
    fotoId: string,
    analiseIa: string,
  ): Promise<Foto> {
    const foto = await this.fotoRepository.findOne({ where: { id: fotoId } });
    if (!foto) {
      throw new NotFoundException('Foto não encontrada');
    }
    foto.analiseIa = analiseIa;
    foto.processadoPorIa = true;
    return this.fotoRepository.save(foto);
  }

  /**
   * Retorna a pontuação máxima possível para um item (por opções ou pelo peso).
   */
  private getPontuacaoMaximaItem(templateItem: TemplateItem | null | undefined): number {
    if (!templateItem) return 0;
    const configs = templateItem.opcoesRespostaConfig || [];
    const peso = templateItem.peso ?? 1;
    const todasComPontuacao =
      configs.length > 0 &&
      configs.every((c) => c.pontuacao != null && c.pontuacao !== undefined);
    if (todasComPontuacao) {
      return Math.max(0, ...configs.map((c) => Number(c.pontuacao)));
    }
    return Math.max(0, peso);
  }

  /**
   * Finaliza uma auditoria.
   */
  async finalizarAuditoria(
    id: string,
    dto: FinalizarAuditoriaDto,
  ): Promise<Auditoria> {
    const auditoria = await this.buscarAuditoriaPorId(id);
    if (auditoria.status === StatusAuditoria.FINALIZADA) {
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
    const pontuacaoObtida = auditoria.itens.reduce(
      (acc, item) => acc + item.pontuacao,
      0,
    );
    const pontuacaoMaxima = auditoria.itens.reduce(
      (acc, item) => acc + this.getPontuacaoMaximaItem(item.templateItem),
      0,
    );
    const pontuacaoPercentual =
      pontuacaoMaxima > 0 ? (pontuacaoObtida / pontuacaoMaxima) * 100 : 0;
    auditoria.status = StatusAuditoria.FINALIZADA;
    auditoria.dataFim = new Date();
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
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<Auditoria> {
    const auditoria = await this.buscarAuditoriaPorId(id, usuarioAutenticado);
    
    if (auditoria.status !== StatusAuditoria.FINALIZADA) {
      throw new BadRequestException('Apenas auditorias finalizadas podem ser reabertas');
    }
    
    // Verificar permissões - apenas o auditor que criou ou o gestor responsável podem reabrir
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR && auditoria.consultorId !== usuarioAutenticado.id) {
        throw new ForbiddenException('Apenas o auditor responsável pode reabrir esta auditoria');
      }
      if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
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
  async buscarItensNaoConformes(auditoriaId: string): Promise<AuditoriaItem[]> {
    return this.itemRepository.find({
      where: { auditoriaId, resposta: RespostaItem.NAO_CONFORME },
      relations: ['templateItem', 'fotos'],
    });
  }

  /**
   * Remove uma auditoria (apenas para GESTOR ou superior).
   * Remove também todos os itens e fotos relacionados.
   */
  async removerAuditoria(
    id: string,
    usuarioAutenticado: { id: string; perfil: PerfilUsuario; gestorId?: string },
  ): Promise<void> {
    const auditoria = await this.buscarAuditoriaPorId(id, usuarioAutenticado);
    // Verificar permissões - apenas GESTOR ou superior podem remover
    if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestores podem remover auditorias');
    }
    if (usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
      const consultor = auditoria.consultor;
      const podeRemover =
        auditoria.consultorId === usuarioAutenticado.id ||
        (consultor && consultor.gestorId === usuarioAutenticado.id);
      if (!podeRemover) {
        throw new ForbiddenException('Apenas o gestor responsável pode remover esta auditoria');
      }
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
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string },
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
        const pontuacaoPossivel = itens.reduce(
          (acc, item) => acc + this.getPontuacaoMaximaItem(item.templateItem),
          0,
        );
        const pontuacaoObtida = itens.reduce((acc, item) => acc + item.pontuacao, 0);
        const naoConformidades = itens.filter(
          (item) => item.resposta === RespostaItem.NAO_CONFORME,
        ).length;
        return {
          nome: grupoNome,
          pontuacaoPossivel,
          pontuacaoObtida,
          naoConformidades,
          itens: itens.map((item) => ({
            pergunta: item.templateItem?.pergunta || '',
            resposta: item.resposta,
            observacao: item.observacao,
            descricaoNaoConformidade: item.descricaoNaoConformidade,
            descricaoIa: item.descricaoIa,
            criticidade: item.templateItem?.criticidade || 'media',
          })),
        };
      });
      
      this.logger.log(`[gerarResumoExecutivo] Processados ${grupos.length} grupos`);
      
      const itensNaoConformes = auditoria.itens
        .filter((item) => item.resposta === RespostaItem.NAO_CONFORME)
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
    await this.auditoriaRepository.update(auditoriaId, {
      pdfUrl,
      pdfGeradoEm: new Date(),
    });
  }
}

