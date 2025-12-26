import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
  ) {}

  /**
   * Inicia uma nova auditoria.
   */
  async iniciarAuditoria(
    consultorId: string,
    dto: IniciarAuditoriaDto,
  ): Promise<Auditoria> {
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
   */
  async listarAuditorias(
    params: PaginationParams,
    usuarioAutenticado: { id: string; perfil: PerfilUsuario; analistaId?: string },
  ): Promise<PaginatedResult<Auditoria>> {
    let where: any = {};
    if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
      where = { consultorId: usuarioAutenticado.id };
    } else if (usuarioAutenticado.perfil === PerfilUsuario.ANALISTA) {
      where = { consultor: { analistaId: usuarioAutenticado.id } };
    }
    const queryBuilder = this.auditoriaRepository.createQueryBuilder('auditoria')
      .leftJoinAndSelect('auditoria.unidade', 'unidade')
      .leftJoinAndSelect('unidade.cliente', 'cliente')
      .leftJoinAndSelect('auditoria.template', 'template')
      .leftJoinAndSelect('auditoria.consultor', 'consultor');
    if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
      queryBuilder.where('auditoria.consultorId = :consultorId', { consultorId: usuarioAutenticado.id });
    } else if (usuarioAutenticado.perfil === PerfilUsuario.ANALISTA) {
      queryBuilder.where('consultor.analistaId = :analistaId', { analistaId: usuarioAutenticado.id });
    }
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
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; analistaId?: string },
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
      if (usuarioAutenticado.perfil === PerfilUsuario.ANALISTA && auditoria.consultor.analistaId !== usuarioAutenticado.id) {
        throw new ForbiddenException('Acesso negado a esta auditoria');
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
    const item = await this.itemRepository.findOne({
      where: { id: itemId, auditoriaId },
      relations: ['templateItem', 'fotos'],
    });
    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }
    item.resposta = dto.resposta;
    item.observacao = dto.observacao ?? item.observacao;
    item.descricaoNaoConformidade = dto.descricaoNaoConformidade ?? item.descricaoNaoConformidade;
    item.descricaoIa = dto.descricaoIa ?? item.descricaoIa;
    item.complementoDescricao = dto.complementoDescricao ?? item.complementoDescricao;
    item.planoAcaoSugerido = dto.planoAcaoSugerido ?? item.planoAcaoSugerido;
    item.referenciaLegal = dto.referenciaLegal ?? item.referenciaLegal;
    if (dto.resposta === RespostaItem.CONFORME) {
      item.pontuacao = item.templateItem?.peso ?? 1;
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
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Item não encontrado');
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
   * Busca itens não conformes de uma auditoria.
   */
  async buscarItensNaoConformes(auditoriaId: string): Promise<AuditoriaItem[]> {
    return this.itemRepository.find({
      where: { auditoriaId, resposta: RespostaItem.NAO_CONFORME },
      relations: ['templateItem', 'fotos'],
    });
  }
}

