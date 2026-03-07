import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  forwardRef,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { Unidade } from './entities/unidade.entity';
import { CriarClienteDto } from './dto/criar-cliente.dto';
import { CriarUnidadeDto } from './dto/criar-unidade.dto';
import { Usuario, PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Auditoria, StatusAuditoria } from '../auditoria/entities/auditoria.entity';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../shared/types/pagination.interface';

/**
 * Serviço responsável pela gestão de clientes e unidades.
 */
@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Unidade)
    private readonly unidadeRepository: Repository<Unidade>,
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => 'ValidacaoLimitesService'))
    @Optional()
    private readonly validacaoLimites?: any,
  ) {}

  /**
   * Cria um novo cliente com suas unidades em uma transação atômica.
   */
  async criarCliente(
    dto: CriarClienteDto,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Cliente> {
    if (usuarioAutenticado && usuarioAutenticado.perfil !== PerfilUsuario.MASTER && usuarioAutenticado.perfil !== PerfilUsuario.GESTOR) {
      throw new ForbiddenException('Apenas Master e Gestor podem criar clientes');
    }
    if (usuarioAutenticado && this.validacaoLimites && usuarioAutenticado.perfil !== PerfilUsuario.MASTER) {
      const gestorId = this.validacaoLimites.identificarGestorId(usuarioAutenticado);
      if (gestorId) {
        await this.validacaoLimites.validarLimiteClientes(gestorId);
      }
    }
    const cnpjNormalizado = dto.cnpj.replace(/\D/g, '');
    const clienteExistente = await this.clienteRepository.findOne({
      where: { cnpj: cnpjNormalizado },
    });
    if (clienteExistente) {
      throw new ConflictException('CNPJ já cadastrado');
    }
    if (dto.auditorId) {
      await this.validarAuditorDoGestor(dto.auditorId, usuarioAutenticado);
    }
    const { unidades: unidadesDto, ...dadosCliente } = dto;
    return this.dataSource.transaction(async (manager) => {
      const cliente = manager.create(Cliente, {
        ...dadosCliente,
        cnpj: cnpjNormalizado,
        gestorId: usuarioAutenticado?.id ?? undefined,
        auditorId: dadosCliente.auditorId ?? null,
      });
      const clienteSalvo = await manager.save(Cliente, cliente);
      const unidades = unidadesDto.map((u) =>
        manager.create(Unidade, { ...u, clienteId: clienteSalvo.id }),
      );
      await manager.save(Unidade, unidades);
      clienteSalvo.unidades = unidades;
      return clienteSalvo;
    });
  }

  /**
   * Lista clientes com paginação. Auditor vê apenas clientes vinculados a ele.
   */
  async listarClientes(
    params: PaginationParams,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<PaginatedResult<Cliente>> {
    let where: Record<string, unknown> = {};
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
        where = { auditorId: usuarioAutenticado.id };
      } else {
        where = { gestorId: usuarioAutenticado.id };
      }
    }
    const [items, total] = await this.clienteRepository.findAndCount({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      order: { criadoEm: 'DESC' },
      relations: ['unidades', 'auditor'],
    });
    return createPaginatedResult(items, total, params.page, params.limit);
  }

  /**
   * Busca um cliente pelo ID. Auditor só acessa clientes vinculados a ele.
   */
  async buscarClientePorId(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id },
      relations: ['unidades', 'auditor'],
    });
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (usuarioAutenticado) {
      this.validarAcessoCliente(cliente, usuarioAutenticado);
    }
    return cliente;
  }

  /**
   * Atualiza um cliente. Retorna warning se houver auditorias abertas ao trocar auditor.
   */
  async atualizarCliente(
    id: string,
    dto: Partial<CriarClienteDto> & { confirmado?: boolean },
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{ cliente: Cliente; warning?: { temAuditoriasAbertas: boolean; quantidade: number } }> {
    const cliente = await this.buscarClientePorId(id, usuarioAutenticado);
    const isTrocandoAuditor = dto.auditorId !== undefined && dto.auditorId !== cliente.auditorId;
    if (isTrocandoAuditor && dto.auditorId) {
      await this.validarAuditorDoGestor(dto.auditorId, usuarioAutenticado);
    }
    if (isTrocandoAuditor && cliente.auditorId && !dto.confirmado) {
      const verificacao = await this.verificarAuditoriasAbertasDoAuditor(id, cliente.auditorId);
      if (verificacao.temAuditoriasAbertas) {
        return { cliente, warning: verificacao };
      }
    }
    const { confirmado, unidades, ...dadosAtualizar } = dto;
    Object.assign(cliente, dadosAtualizar);
    const clienteSalvo = await this.clienteRepository.save(cliente);
    return { cliente: clienteSalvo };
  }

  /**
   * Remove um cliente (soft delete).
   */
  async removerCliente(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<void> {
    const cliente = await this.buscarClientePorId(id, usuarioAutenticado);
    cliente.ativo = false;
    await this.clienteRepository.save(cliente);
  }

  /**
   * Cria uma nova unidade para um cliente.
   */
  async criarUnidade(
    dto: CriarUnidadeDto,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade> {
    await this.buscarClientePorId(dto.clienteId, usuarioAutenticado);
    const unidade = this.unidadeRepository.create(dto);
    return this.unidadeRepository.save(unidade);
  }

  /**
   * Lista unidades de um cliente.
   */
  async listarUnidadesPorCliente(clienteId: string): Promise<Unidade[]> {
    return this.unidadeRepository.find({
      where: { clienteId, ativo: true },
      order: { nome: 'ASC' },
    });
  }

  /**
   * Lista unidades ativas. Auditor vê apenas unidades de clientes vinculados a ele.
   */
  async listarTodasUnidades(usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null }): Promise<Unidade[]> {
    if (usuarioAutenticado) {
      const clienteWhere = usuarioAutenticado.perfil === PerfilUsuario.AUDITOR
        ? { auditorId: usuarioAutenticado.id }
        : { gestorId: usuarioAutenticado.id };
      return this.unidadeRepository.find({
        where: { ativo: true, cliente: clienteWhere },
        relations: ['cliente'],
        order: { nome: 'ASC' },
      });
    }
    return this.unidadeRepository.find({
      where: { ativo: true },
      relations: ['cliente'],
      order: { nome: 'ASC' },
    });
  }

  /**
   * Busca uma unidade pelo ID. Auditor só acessa unidades de clientes vinculados.
   */
  async buscarUnidadePorId(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Unidade> {
    const unidade = await this.unidadeRepository.findOne({
      where: { id },
      relations: ['cliente'],
    });
    if (!unidade) {
      throw new NotFoundException('Unidade não encontrada');
    }
    if (usuarioAutenticado && unidade.cliente) {
      this.validarAcessoCliente(unidade.cliente, usuarioAutenticado);
    }
    return unidade;
  }

  /**
   * Atualiza uma unidade.
   */
  async atualizarUnidade(
    id: string,
    dto: Partial<CriarUnidadeDto>,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade> {
    const unidade = await this.buscarUnidadePorId(id, usuarioAutenticado);
    Object.assign(unidade, dto);
    return this.unidadeRepository.save(unidade);
  }

  /**
   * Remove uma unidade (soft delete).
   */
  async removerUnidade(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<void> {
    const unidade = await this.buscarUnidadePorId(id, usuarioAutenticado);
    unidade.ativo = false;
    await this.unidadeRepository.save(unidade);
  }

  /**
   * Verifica se o auditor atual do cliente possui auditorias em andamento.
   */
  async verificarTrocaAuditor(
    clienteId: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{ temAuditoriasAbertas: boolean; quantidade: number }> {
    const cliente = await this.buscarClientePorId(clienteId, usuarioAutenticado);
    if (!cliente.auditorId) {
      return { temAuditoriasAbertas: false, quantidade: 0 };
    }
    return this.verificarAuditoriasAbertasDoAuditor(clienteId, cliente.auditorId);
  }

  private async verificarAuditoriasAbertasDoAuditor(
    clienteId: string,
    auditorId: string,
  ): Promise<{ temAuditoriasAbertas: boolean; quantidade: number }> {
    const quantidade = await this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .innerJoin('auditoria.unidade', 'unidade')
      .where('unidade.clienteId = :clienteId', { clienteId })
      .andWhere('auditoria.consultorId = :auditorId', { auditorId })
      .andWhere('auditoria.status = :status', { status: StatusAuditoria.EM_ANDAMENTO })
      .getCount();
    return { temAuditoriasAbertas: quantidade > 0, quantidade };
  }

  private validarAcessoCliente(
    cliente: Cliente,
    usuario: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): void {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      if (cliente.auditorId !== usuario.id) {
        throw new ForbiddenException('Acesso negado a este cliente');
      }
      return;
    }
    if (cliente.gestorId !== usuario.id) {
      throw new ForbiddenException('Acesso negado a este cliente');
    }
  }

  private async validarAuditorDoGestor(
    auditorId: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<void> {
    const auditor = await this.usuarioRepository.findOne({ where: { id: auditorId } });
    if (!auditor) {
      throw new BadRequestException('Auditor não encontrado');
    }
    if (auditor.perfil !== PerfilUsuario.AUDITOR) {
      throw new BadRequestException('O usuário selecionado não é um auditor');
    }
    if (usuarioAutenticado && usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
      if (auditor.gestorId !== usuarioAutenticado.id) {
        throw new ForbiddenException('Este auditor não pertence à sua equipe');
      }
    }
  }
}

