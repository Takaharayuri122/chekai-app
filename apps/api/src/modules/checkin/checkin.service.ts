import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cliente } from '../cliente/entities/cliente.entity';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Usuario } from '../usuario/entities/usuario.entity';
import { Unidade } from '../cliente/entities/unidade.entity';
import { Checkin, StatusCheckin } from './entities/checkin.entity';
import { IniciarCheckinDto } from './dto/iniciar-checkin.dto';
import { FinalizarCheckinDto } from './dto/finalizar-checkin.dto';
import { ListarCheckinsDto } from './dto/listar-checkins.dto';
import { EditarCheckinDto } from './dto/editar-checkin.dto';
import {
  AgruparHorasCheckin,
  RelatorioHorasCheckinDto,
} from './dto/relatorio-horas-checkin.dto';
import {
  PaginatedResult,
  createPaginatedResult,
} from '../../shared/types/pagination.interface';

export const LIMITE_ALERTA_CHECKIN_ABERTO_MS = 3 * 60 * 60 * 1000;
export const LIMITE_CHECKOUT_AUTOMATICO_MS = 12 * 60 * 60 * 1000;
export const COMENTARIO_CHECKOUT_AUTOMATICO = 'Encerrado automaticamente após 12 horas.';

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

export interface ItemRelatorioHorasCheckin {
  id: string;
  nome: string;
  quantidade: number;
  minutosFechados: number;
  minutosAbertos: number;
  minutosTotal: number;
}

export interface RelatorioHorasCheckin {
  agruparPor: AgruparHorasCheckin;
  dataInicio: string;
  dataFim: string;
  totalGeralMinutos: number;
  itens: ItemRelatorioHorasCheckin[];
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
    await this.validarUnidadeDoCheckin(dto.unidadeId, dto.clienteId, usuario);
    const novoCheckin = this.checkinRepository.create({
      usuarioId: usuario.id,
      clienteId: dto.clienteId,
      unidadeId: dto.unidadeId,
      status: StatusCheckin.ABERTO,
      dataCheckin: new Date(),
      latitudeCheckin: dto.latitude,
      longitudeCheckin: dto.longitude,
      alerta3hEmitidoEm: null,
      comentario: null,
      encerradoAutomaticamente: false,
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
    if (this.isCheckinExpirado12h(checkin)) {
      await this.aplicarCheckoutAutomatico(checkin);
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

  async encerrarCheckinsExpirados(agora: Date = new Date()): Promise<number> {
    const limite = new Date(agora.getTime() - LIMITE_CHECKOUT_AUTOMATICO_MS);
    const expirados = await this.checkinRepository.find({
      where: {
        status: StatusCheckin.ABERTO,
        dataCheckin: LessThanOrEqual(limite),
      },
    });
    for (const checkin of expirados) {
      await this.aplicarCheckoutAutomatico(checkin);
    }
    return expirados.length;
  }

  async listarCheckins(
    filtro: ListarCheckinsDto,
    usuario: UsuarioAutenticado,
  ): Promise<PaginatedResult<Checkin>> {
    this.garantirAcessoAdministrativo(usuario);
    await this.encerrarCheckinsExpirados();
    const queryBuilder = this.criarQueryCheckins(usuario, filtro);
    const [items, total] = await queryBuilder
      .orderBy('checkin.dataCheckin', 'DESC')
      .skip((filtro.page - 1) * filtro.limit)
      .take(filtro.limit)
      .getManyAndCount();
    return createPaginatedResult(items, total, filtro.page, filtro.limit);
  }

  async buscarCheckinPorId(id: string, usuario: UsuarioAutenticado): Promise<Checkin> {
    this.garantirAcessoAdministrativo(usuario);
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

  async editarCheckin(
    id: string,
    usuario: UsuarioAutenticado,
    dto: EditarCheckinDto,
  ): Promise<Checkin> {
    const checkin = await this.buscarCheckinPorId(id, usuario);
    const novaDataCheckin = dto.dataCheckin
      ? new Date(dto.dataCheckin)
      : checkin.dataCheckin;
    if (dto.dataCheckout === null && checkin.status === StatusCheckin.FECHADO) {
      throw new BadRequestException('Não é permitido reabrir um checkin já finalizado.');
    }
    const novaDataCheckout = dto.dataCheckout === undefined
      ? checkin.dataCheckout
      : dto.dataCheckout === null
        ? null
        : new Date(dto.dataCheckout);
    if (novaDataCheckout && novaDataCheckin.getTime() > novaDataCheckout.getTime()) {
      throw new BadRequestException('A data de checkout não pode ser anterior à data de checkin.');
    }
    checkin.dataCheckin = novaDataCheckin;
    if (dto.dataCheckout !== undefined) {
      checkin.dataCheckout = novaDataCheckout;
    }
    if (dto.comentario !== undefined) {
      checkin.comentario = dto.comentario;
    }
    if (checkin.dataCheckout && checkin.status === StatusCheckin.ABERTO) {
      checkin.status = StatusCheckin.FECHADO;
      if (checkin.latitudeCheckout == null || checkin.longitudeCheckout == null) {
        checkin.latitudeCheckout = checkin.latitudeCheckin;
        checkin.longitudeCheckout = checkin.longitudeCheckin;
      }
    }
    return this.checkinRepository.save(checkin);
  }

  async relatorioHoras(
    filtro: RelatorioHorasCheckinDto,
    usuario: UsuarioAutenticado,
    agora: Date = new Date(),
  ): Promise<RelatorioHorasCheckin> {
    this.garantirAcessoAdministrativo(usuario);
    await this.encerrarCheckinsExpirados(agora);
    const queryBuilder = this.criarQueryCheckins(usuario, filtro);
    const checkins = await queryBuilder.getMany();
    const agrupados = new Map<string, ItemRelatorioHorasCheckin>();
    for (const checkin of checkins) {
      const chave = filtro.agruparPor === AgruparHorasCheckin.USUARIO
        ? checkin.usuarioId
        : checkin.clienteId;
      const nome = filtro.agruparPor === AgruparHorasCheckin.USUARIO
        ? checkin.usuario?.nome || 'Usuário não informado'
        : checkin.cliente?.nomeFantasia || checkin.cliente?.razaoSocial || 'Cliente não informado';
      const item = agrupados.get(chave) ?? {
        id: chave,
        nome,
        quantidade: 0,
        minutosFechados: 0,
        minutosAbertos: 0,
        minutosTotal: 0,
      };
      const fim = checkin.dataCheckout ?? agora;
      const minutos = Math.max(
        Math.round((fim.getTime() - checkin.dataCheckin.getTime()) / 60000),
        0,
      );
      item.quantidade += 1;
      if (checkin.status === StatusCheckin.FECHADO && checkin.dataCheckout) {
        item.minutosFechados += minutos;
      } else {
        item.minutosAbertos += minutos;
      }
      item.minutosTotal = item.minutosFechados + item.minutosAbertos;
      agrupados.set(chave, item);
    }
    const itens = Array.from(agrupados.values()).sort((a, b) => b.minutosTotal - a.minutosTotal);
    return {
      agruparPor: filtro.agruparPor,
      dataInicio: filtro.dataInicio,
      dataFim: filtro.dataFim,
      totalGeralMinutos: itens.reduce((acc, item) => acc + item.minutosTotal, 0),
      itens,
    };
  }

  async listarFiltros(usuario: UsuarioAutenticado): Promise<FiltrosCheckins> {
    this.garantirAcessoAdministrativo(usuario);
    const clientesWhere = { gestorId: usuario.id };
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

  private criarQueryCheckins(
    usuario: UsuarioAutenticado,
    filtro: Pick<ListarCheckinsDto, 'auditorId' | 'clienteId' | 'dataInicio' | 'dataFim'>,
  ) {
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
    return queryBuilder;
  }

  private garantirAcessoAdministrativo(usuario: UsuarioAutenticado): void {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      throw new ForbiddenException('Apenas gestores e administradores podem visualizar checkins.');
    }
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
    if (this.isCheckinExpirado12h(checkin)) {
      await this.aplicarCheckoutAutomatico(checkin);
      return;
    }
    await this.atualizarCheckinAtrasado(checkin);
  }

  private async aplicarCheckoutAutomatico(checkin: Checkin): Promise<Checkin> {
    if (checkin.status !== StatusCheckin.ABERTO) {
      return checkin;
    }
    checkin.status = StatusCheckin.FECHADO;
    checkin.dataCheckout = new Date(checkin.dataCheckin.getTime() + LIMITE_CHECKOUT_AUTOMATICO_MS);
    checkin.latitudeCheckout = checkin.latitudeCheckin;
    checkin.longitudeCheckout = checkin.longitudeCheckin;
    checkin.encerradoAutomaticamente = true;
    checkin.comentario = this.montarComentarioAutomatico(checkin.comentario);
    return this.checkinRepository.save(checkin);
  }

  private montarComentarioAutomatico(atual: string | null): string {
    if (!atual || !atual.trim()) {
      return COMENTARIO_CHECKOUT_AUTOMATICO;
    }
    if (atual.includes(COMENTARIO_CHECKOUT_AUTOMATICO)) {
      return atual;
    }
    return `${atual.trim()}\n${COMENTARIO_CHECKOUT_AUTOMATICO}`;
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

  private isCheckinExpirado12h(checkin: Checkin, agora: Date = new Date()): boolean {
    return agora.getTime() > checkin.dataCheckin.getTime() + LIMITE_CHECKOUT_AUTOMATICO_MS;
  }
}
