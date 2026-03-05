import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from '../cliente/entities/cliente.entity';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Usuario } from '../usuario/entities/usuario.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import { Checkin, StatusCheckin } from './entities/checkin.entity';
import { IniciarCheckinDto } from './dto/iniciar-checkin.dto';
import { FinalizarCheckinDto } from './dto/finalizar-checkin.dto';
import { ListarCheckinsDto } from './dto/listar-checkins.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../../shared/types/pagination.interface';

const LIMITE_ALERTA_CHECKIN_ABERTO_MS = 3 * 60 * 60 * 1000;

interface UsuarioAutenticado {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
}

export interface CheckinComAlerta {
  checkin: Checkin | null;
  isAtrasado3h: boolean;
}

export interface AlertaCheckinAberto {
  possuiAlerta: boolean;
  mensagem: string | null;
  checkin: Checkin | null;
}

interface OpcaoFiltro {
  id: string;
  nome: string;
}

export interface FiltrosCheckins {
  auditores: OpcaoFiltro[];
  clientes: OpcaoFiltro[];
}

@Injectable()
export class CheckinService {
  constructor(
    @InjectRepository(Checkin)
    private readonly checkinRepository: Repository<Checkin>,
    @InjectRepository(Unidade)
    private readonly unidadeRepository: Repository<Unidade>,
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async iniciarCheckin(
    usuario: UsuarioAutenticado,
    dto: IniciarCheckinDto,
  ): Promise<Checkin> {
    await this.marcarAlertaSeNecessario(usuario.id);
    const checkinAberto = await this.checkinRepository.findOne({
      where: { usuarioId: usuario.id, status: StatusCheckin.ABERTO },
    });
    if (checkinAberto) {
      throw new BadRequestException('Você já possui um checkin em aberto. Finalize-o antes de iniciar outro.');
    }
    const unidade = await this.validarUnidadeDoCheckin(dto.unidadeId, dto.clienteId, usuario);
    const novoCheckin = this.checkinRepository.create({
      usuarioId: usuario.id,
      clienteId: dto.clienteId,
      unidadeId: dto.unidadeId,
      status: StatusCheckin.ABERTO,
      dataCheckin: new Date(),
      latitudeCheckin: dto.latitude,
      longitudeCheckin: dto.longitude,
      alerta3hEmitidoEm: null,
    });
    await this.checkinRepository.save(novoCheckin);
    return this.checkinRepository.findOneOrFail({
      where: { id: novoCheckin.id },
      relations: ['cliente', 'unidade'],
    });
  }

  async finalizarCheckin(
    id: string,
    usuario: UsuarioAutenticado,
    dto: FinalizarCheckinDto,
  ): Promise<Checkin> {
    const checkin = await this.checkinRepository.findOne({
      where: { id },
      relations: ['cliente', 'unidade'],
    });
    if (!checkin) {
      throw new NotFoundException('Checkin não encontrado');
    }
    if (checkin.usuarioId !== usuario.id) {
      throw new ForbiddenException('Você não pode finalizar um checkin de outro usuário');
    }
    if (checkin.status !== StatusCheckin.ABERTO) {
      throw new BadRequestException('Este checkin já foi finalizado');
    }
    checkin.status = StatusCheckin.FECHADO;
    checkin.dataCheckout = new Date();
    checkin.latitudeCheckout = dto.latitude;
    checkin.longitudeCheckout = dto.longitude;
    return this.checkinRepository.save(checkin);
  }

  async buscarCheckinAbertoDoUsuario(usuarioId: string): Promise<CheckinComAlerta> {
    const checkin = await this.checkinRepository.findOne({
      where: { usuarioId, status: StatusCheckin.ABERTO },
      relations: ['cliente', 'unidade'],
    });
    if (!checkin) {
      return { checkin: null, isAtrasado3h: false };
    }
    const checkinAtualizado = await this.atualizarCheckinAtrasado(checkin);
    return {
      checkin: checkinAtualizado,
      isAtrasado3h: this.isCheckinAtrasado(checkinAtualizado),
    };
  }

  async buscarAlertaCheckinAberto(usuarioId: string): Promise<AlertaCheckinAberto> {
    const resultado = await this.buscarCheckinAbertoDoUsuario(usuarioId);
    if (!resultado.checkin || !resultado.isAtrasado3h) {
      return {
        possuiAlerta: false,
        mensagem: null,
        checkin: resultado.checkin,
      };
    }
    return {
      possuiAlerta: true,
      mensagem: 'Você está com um checkin aberto há mais de 3 horas. Finalize o checkout.',
      checkin: resultado.checkin,
    };
  }

  async listarCheckins(
    filtro: ListarCheckinsDto,
    usuario: UsuarioAutenticado,
  ): Promise<PaginatedResult<Checkin>> {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestores e administradores podem visualizar checkins.');
    }
    const queryBuilder = this.checkinRepository.createQueryBuilder('checkin')
      .leftJoinAndSelect('checkin.usuario', 'usuario')
      .leftJoinAndSelect('checkin.cliente', 'cliente')
      .leftJoinAndSelect('checkin.unidade', 'unidade');
    if (usuario.perfil === PerfilUsuario.GESTOR) {
      queryBuilder.andWhere('cliente.gestorId = :gestorId', { gestorId: usuario.id });
    }
    if (filtro.auditorId) {
      queryBuilder.andWhere('checkin.usuarioId = :auditorId', { auditorId: filtro.auditorId });
    }
    if (filtro.clienteId) {
      queryBuilder.andWhere('checkin.clienteId = :clienteId', { clienteId: filtro.clienteId });
    }
    if (filtro.dataInicio) {
      queryBuilder.andWhere('checkin.dataCheckin >= :dataInicio', {
        dataInicio: `${filtro.dataInicio} 00:00:00`,
      });
    }
    if (filtro.dataFim) {
      queryBuilder.andWhere('checkin.dataCheckin <= :dataFim', {
        dataFim: `${filtro.dataFim} 23:59:59`,
      });
    }
    const [items, total] = await queryBuilder
      .orderBy('checkin.dataCheckin', 'DESC')
      .skip((filtro.page - 1) * filtro.limit)
      .take(filtro.limit)
      .getManyAndCount();
    return createPaginatedResult(items, total, filtro.page, filtro.limit);
  }

  async buscarCheckinPorId(id: string, usuario: UsuarioAutenticado): Promise<Checkin> {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestores e administradores podem visualizar checkins.');
    }
    const checkin = await this.checkinRepository.findOne({
      where: { id },
      relations: ['usuario', 'cliente', 'unidade'],
    });
    if (!checkin) {
      throw new NotFoundException('Checkin não encontrado');
    }
    if (usuario.perfil === PerfilUsuario.GESTOR) {
      const unidade = await this.unidadeRepository.findOne({
        where: { id: checkin.unidadeId },
        relations: ['cliente'],
      });
      if (!unidade || unidade.cliente?.gestorId !== usuario.id) {
        throw new ForbiddenException('Você não tem acesso a este checkin');
      }
    }
    return checkin;
  }

  async listarFiltros(usuario: UsuarioAutenticado): Promise<FiltrosCheckins> {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestores e administradores podem visualizar checkins.');
    }
    const clientesWhere = usuario.perfil === PerfilUsuario.MASTER
      ? { gestorId: usuario.id }
      : { gestorId: usuario.id };
    const clientes = await this.clienteRepository.find({
      where: clientesWhere,
      order: { nomeFantasia: 'ASC', razaoSocial: 'ASC' },
      select: ['id', 'nomeFantasia', 'razaoSocial'],
    });
    const auditores = await this.usuarioRepository.find({
      where: {
        perfil: PerfilUsuario.AUDITOR,
        gestorId: usuario.id,
      },
      order: { nome: 'ASC' },
      select: ['id', 'nome'],
    });
    return {
      auditores: auditores.map((auditor) => ({
        id: auditor.id,
        nome: auditor.nome,
      })),
      clientes: clientes.map((cliente) => ({
        id: cliente.id,
        nome: cliente.nomeFantasia || cliente.razaoSocial,
      })),
    };
  }

  private async validarUnidadeDoCheckin(
    unidadeId: string,
    clienteId: string,
    usuario: UsuarioAutenticado,
  ): Promise<Unidade> {
    const unidade = await this.unidadeRepository.findOne({
      where: { id: unidadeId },
      relations: ['cliente'],
    });
    if (!unidade || !unidade.ativo) {
      throw new NotFoundException('Unidade não encontrada');
    }
    if (unidade.clienteId !== clienteId) {
      throw new BadRequestException('A unidade selecionada não pertence ao cliente informado');
    }
    if (usuario.perfil === PerfilUsuario.MASTER) {
      return unidade;
    }
    const gestorResponsavelId = unidade.cliente?.gestorId;
    const usuarioEhGestor = usuario.id === gestorResponsavelId;
    const usuarioEhAuditorDoGestor = usuario.gestorId === gestorResponsavelId;
    if (!usuarioEhGestor && !usuarioEhAuditorDoGestor) {
      throw new ForbiddenException('Você não tem acesso a esta unidade');
    }
    return unidade;
  }

  private async marcarAlertaSeNecessario(usuarioId: string): Promise<void> {
    const checkin = await this.checkinRepository.findOne({
      where: { usuarioId, status: StatusCheckin.ABERTO },
    });
    if (!checkin) {
      return;
    }
    await this.atualizarCheckinAtrasado(checkin);
  }

  private async atualizarCheckinAtrasado(checkin: Checkin): Promise<Checkin> {
    if (!this.isCheckinAtrasado(checkin) || checkin.alerta3hEmitidoEm) {
      return checkin;
    }
    checkin.alerta3hEmitidoEm = new Date();
    return this.checkinRepository.save(checkin);
  }

  private isCheckinAtrasado(checkin: Checkin): boolean {
    const dataLimite = checkin.dataCheckin.getTime() + LIMITE_ALERTA_CHECKIN_ABERTO_MS;
    return Date.now() > dataLimite;
  }
}
