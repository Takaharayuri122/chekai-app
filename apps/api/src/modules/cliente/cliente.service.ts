import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { Unidade } from './entities/unidade.entity';
import { CriarClienteDto } from './dto/criar-cliente.dto';
import { CriarUnidadeDto } from './dto/criar-unidade.dto';
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
  ) {}

  /**
   * Cria um novo cliente.
   */
  async criarCliente(dto: CriarClienteDto): Promise<Cliente> {
    const clienteExistente = await this.clienteRepository.findOne({
      where: { cnpj: dto.cnpj },
    });
    if (clienteExistente) {
      throw new ConflictException('CNPJ já cadastrado');
    }
    const cliente = this.clienteRepository.create(dto);
    return this.clienteRepository.save(cliente);
  }

  /**
   * Lista todos os clientes com paginação.
   */
  async listarClientes(params: PaginationParams): Promise<PaginatedResult<Cliente>> {
    const [items, total] = await this.clienteRepository.findAndCount({
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      order: { criadoEm: 'DESC' },
      relations: ['unidades'],
    });
    return createPaginatedResult(items, total, params.page, params.limit);
  }

  /**
   * Busca um cliente pelo ID.
   */
  async buscarClientePorId(id: string): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id },
      relations: ['unidades'],
    });
    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return cliente;
  }

  /**
   * Atualiza um cliente.
   */
  async atualizarCliente(id: string, dto: Partial<CriarClienteDto>): Promise<Cliente> {
    const cliente = await this.buscarClientePorId(id);
    Object.assign(cliente, dto);
    return this.clienteRepository.save(cliente);
  }

  /**
   * Remove um cliente (soft delete).
   */
  async removerCliente(id: string): Promise<void> {
    const cliente = await this.buscarClientePorId(id);
    cliente.ativo = false;
    await this.clienteRepository.save(cliente);
  }

  /**
   * Cria uma nova unidade para um cliente.
   */
  async criarUnidade(dto: CriarUnidadeDto): Promise<Unidade> {
    await this.buscarClientePorId(dto.clienteId);
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
   * Lista todas as unidades ativas.
   */
  async listarTodasUnidades(): Promise<Unidade[]> {
    return this.unidadeRepository.find({
      where: { ativo: true },
      relations: ['cliente'],
      order: { nome: 'ASC' },
    });
  }

  /**
   * Busca uma unidade pelo ID.
   */
  async buscarUnidadePorId(id: string): Promise<Unidade> {
    const unidade = await this.unidadeRepository.findOne({
      where: { id },
      relations: ['cliente'],
    });
    if (!unidade) {
      throw new NotFoundException('Unidade não encontrada');
    }
    return unidade;
  }

  /**
   * Atualiza uma unidade.
   */
  async atualizarUnidade(id: string, dto: Partial<CriarUnidadeDto>): Promise<Unidade> {
    const unidade = await this.buscarUnidadePorId(id);
    Object.assign(unidade, dto);
    return this.unidadeRepository.save(unidade);
  }

  /**
   * Remove uma unidade (soft delete).
   */
  async removerUnidade(id: string): Promise<void> {
    const unidade = await this.buscarUnidadePorId(id);
    unidade.ativo = false;
    await this.unidadeRepository.save(unidade);
  }
}

