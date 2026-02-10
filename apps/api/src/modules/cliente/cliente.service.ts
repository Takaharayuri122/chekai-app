import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { Unidade } from './entities/unidade.entity';
import { CriarClienteDto } from './dto/criar-cliente.dto';
import { CriarUnidadeDto } from './dto/criar-unidade.dto';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
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
    @Inject(forwardRef(() => 'ValidacaoLimitesService'))
    @Optional()
    private readonly validacaoLimites?: any,
  ) {}

  /**
   * Cria um novo cliente.
   */
  async criarCliente(
    dto: CriarClienteDto,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Cliente> {
    if (usuarioAutenticado && usuarioAutenticado.perfil !== PerfilUsuario.MASTER && usuarioAutenticado.perfil !== PerfilUsuario.GESTOR) {
      throw new ForbiddenException('Apenas Master e Gestor podem criar clientes');
    }
    // Valida limite de clientes
    if (usuarioAutenticado && this.validacaoLimites && usuarioAutenticado.perfil !== PerfilUsuario.MASTER) {
      const gestorId = this.validacaoLimites.identificarGestorId(usuarioAutenticado);
      if (gestorId) {
        await this.validacaoLimites.validarLimiteClientes(gestorId);
      }
    }
    // Normalizar CNPJ (remover máscara)
    const cnpjNormalizado = dto.cnpj.replace(/\D/g, '');
    
    const clienteExistente = await this.clienteRepository.findOne({
      where: { cnpj: cnpjNormalizado },
    });
    if (clienteExistente) {
      throw new ConflictException('CNPJ já cadastrado');
    }
    const cliente = this.clienteRepository.create({
      ...dto,
      cnpj: cnpjNormalizado,
      gestorId: usuarioAutenticado?.id ?? undefined,
    });
    return this.clienteRepository.save(cliente);
  }

  /**
   * Lista clientes com paginação. Cada usuário vê apenas clientes em que é o gestor.
   */
  async listarClientes(
    params: PaginationParams,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<PaginatedResult<Cliente>> {
    const where: { gestorId?: string } = usuarioAutenticado
      ? { gestorId: usuarioAutenticado.id }
      : {};
    const [items, total] = await this.clienteRepository.findAndCount({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      order: { criadoEm: 'DESC' },
      relations: ['unidades'],
    });
    return createPaginatedResult(items, total, params.page, params.limit);
  }

  /**
   * Busca um cliente pelo ID. Acesso apenas se o usuário for o gestor do cliente.
   */
  async buscarClientePorId(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id },
      relations: ['unidades'],
    });
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (usuarioAutenticado && cliente.gestorId !== usuarioAutenticado.id) {
      throw new ForbiddenException('Acesso negado a este cliente');
    }
    return cliente;
  }

  /**
   * Atualiza um cliente.
   */
  async atualizarCliente(
    id: string,
    dto: Partial<CriarClienteDto>,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<Cliente> {
    const cliente = await this.buscarClientePorId(id, usuarioAutenticado);
    Object.assign(cliente, dto);
    return this.clienteRepository.save(cliente);
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
   * Lista unidades ativas. Com usuário, apenas unidades de clientes em que ele é gestor.
   */
  async listarTodasUnidades(usuarioAutenticado?: { id: string; perfil: PerfilUsuario }): Promise<Unidade[]> {
    if (usuarioAutenticado) {
      return this.unidadeRepository.find({
        where: { ativo: true, cliente: { gestorId: usuarioAutenticado.id } },
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
   * Busca uma unidade pelo ID. Com usuário, apenas se for gestor do cliente da unidade.
   */
  async buscarUnidadePorId(
    id: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario },
  ): Promise<Unidade> {
    const unidade = await this.unidadeRepository.findOne({
      where: { id },
      relations: ['cliente'],
    });
    if (!unidade) {
      throw new NotFoundException('Unidade não encontrada');
    }
    if (usuarioAutenticado && unidade.cliente?.gestorId !== usuarioAutenticado.id) {
      throw new ForbiddenException('Acesso negado a esta unidade');
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
}

