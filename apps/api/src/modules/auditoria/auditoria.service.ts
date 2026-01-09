import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria, StatusAuditoria } from './entities/auditoria.entity';
import { AuditoriaItem, RespostaItem } from './entities/auditoria-item.entity';
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

/**
 * Serviço responsável pela gestão de auditorias.
 */
@Injectable()
export class AuditoriaService {
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    @InjectRepository(AuditoriaItem)
    private readonly itemRepository: Repository<AuditoriaItem>,
    @InjectRepository(Foto)
    private readonly fotoRepository: Repository<Foto>,
    private readonly checklistService: ChecklistService,
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
    if (templateItem?.usarRespostasPersonalizadas && templateItem?.opcoesResposta) {
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
    // Calcular pontuação: apenas "conforme" recebe pontuação
    // Para opções personalizadas, assumimos que apenas a primeira opção é "conforme"
    // (pode ser ajustado no futuro com um campo específico no template)
    if (dto.resposta === RespostaItem.CONFORME) {
      item.pontuacao = item.templateItem?.peso ?? 1;
    } else if (templateItem?.usarRespostasPersonalizadas && templateItem?.opcoesResposta && templateItem.opcoesResposta.length > 0) {
      // Para opções personalizadas, a primeira opção é considerada "conforme"
      if (dto.resposta === templateItem.opcoesResposta[0]) {
        item.pontuacao = item.templateItem?.peso ?? 1;
      } else {
        item.pontuacao = 0;
      }
    } else {
      item.pontuacao = 0;
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
    const itensNaoAvaliados = auditoria.itens.filter(
      (item) => item.resposta === RespostaItem.NAO_AVALIADO,
    );
    if (itensNaoAvaliados.length > 0) {
      throw new BadRequestException(
        `Existem ${itensNaoAvaliados.length} itens não avaliados`,
      );
    }
    const pontuacaoObtida = auditoria.itens.reduce(
      (acc, item) => acc + item.pontuacao,
      0,
    );
    const pontuacaoMaxima = auditoria.itens.reduce(
      (acc, item) => acc + (item.templateItem?.peso ?? 1),
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
    await this.auditoriaRepository.update(id, {
      status: StatusAuditoria.EM_ANDAMENTO,
      dataFim: null as any,
      latitudeFim: null as any,
      longitudeFim: null as any,
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
}

