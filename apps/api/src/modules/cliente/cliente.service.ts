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
import { DataSource, In, Repository } from 'typeorm';
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
    const auditores = await this.buscarEValidarAuditores(dto.auditorIds, usuarioAutenticado);
    const { unidades: unidadesDto, auditorIds, ...dadosCliente } = dto;
    return this.dataSource.transaction(async (manager) => {
      const cliente = manager.create(Cliente, {
        ...dadosCliente,
        cnpj: cnpjNormalizado,
        gestorId: usuarioAutenticado?.id ?? undefined,
        auditores,
      });
      const clienteSalvo = await manager.save(Cliente, cliente);
      const unidades = await Promise.all(
        unidadesDto.map(async (u) => {
          const { auditorIds: unidadeAuditorIds, ...dadosUnidade } = u;
          const unidadeAuditores = await this.filtrarAuditoresUnidade(unidadeAuditorIds, auditores);
          const unidade = manager.create(Unidade, {
            ...dadosUnidade,
            clienteId: clienteSalvo.id,
            auditores: unidadeAuditores,
          });
          return manager.save(Unidade, unidade);
        }),
      );
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
    const queryBuilder = this.clienteRepository
      .createQueryBuilder('cliente')
      .leftJoinAndSelect('cliente.unidades', 'unidade')
      .leftJoinAndSelect('cliente.auditores', 'auditor')
      .leftJoinAndSelect('unidade.auditores', 'unidadeAuditor');
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
        queryBuilder
          .innerJoin('cliente.auditores', 'filtroAuditor', 'filtroAuditor.id = :auditorId', { auditorId: usuarioAutenticado.id });
      } else {
        queryBuilder.andWhere('cliente.gestorId = :gestorId', { gestorId: usuarioAutenticado.id });
      }
    }
    queryBuilder
      .orderBy('cliente.criadoEm', 'DESC')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);
    const [items, total] = await queryBuilder.getManyAndCount();
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
      relations: ['unidades', 'auditores', 'unidades.auditores'],
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
   * Atualiza um cliente. Retorna warning se houver auditorias abertas ao remover auditores.
   */
  async atualizarCliente(
    id: string,
    dto: Partial<CriarClienteDto> & { confirmado?: boolean },
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{ cliente: Cliente; warning?: { temAuditoriasAbertas: boolean; quantidade: number } }> {
    const cliente = await this.buscarClientePorId(id, usuarioAutenticado);
    if (dto.auditorIds !== undefined) {
      const novosAuditores = await this.buscarEValidarAuditores(dto.auditorIds, usuarioAutenticado);
      const idsAtuais = (cliente.auditores || []).map((a) => a.id);
      const idsNovos = novosAuditores.map((a) => a.id);
      const removidos = idsAtuais.filter((aid) => !idsNovos.includes(aid));
      if (removidos.length > 0 && !dto.confirmado) {
        const verificacao = await this.verificarAuditoriasAbertasDosAuditores(id, removidos);
        if (verificacao.temAuditoriasAbertas) {
          return { cliente, warning: verificacao };
        }
      }
      cliente.auditores = novosAuditores;
    }
    const { confirmado, unidades, auditorIds, ...dadosAtualizar } = dto;
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
    const cliente = await this.buscarClientePorId(dto.clienteId, usuarioAutenticado);
    const { auditorIds, ...dadosUnidade } = dto;
    const auditores = await this.filtrarAuditoresUnidade(auditorIds, cliente.auditores || []);
    const unidade = this.unidadeRepository.create({
      ...dadosUnidade,
      auditores,
    });
    return this.unidadeRepository.save(unidade);
  }

  /**
   * Lista unidades de um cliente.
   */
  async listarUnidadesPorCliente(clienteId: string): Promise<Unidade[]> {
    return this.unidadeRepository.find({
      where: { clienteId, ativo: true },
      relations: ['auditores'],
      order: { nome: 'ASC' },
    });
  }

  /**
   * Lista unidades ativas. Auditor vê apenas unidades de clientes vinculados a ele.
   */
  async listarTodasUnidades(usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null }): Promise<Unidade[]> {
    const queryBuilder = this.unidadeRepository
      .createQueryBuilder('unidade')
      .leftJoinAndSelect('unidade.cliente', 'cliente')
      .leftJoinAndSelect('unidade.auditores', 'unidadeAuditor')
      .where('unidade.ativo = true');
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
        queryBuilder
          .innerJoin('cliente.auditores', 'filtroAuditor', 'filtroAuditor.id = :auditorId', { auditorId: usuarioAutenticado.id });
      } else {
        queryBuilder.andWhere('cliente.gestorId = :gestorId', { gestorId: usuarioAutenticado.id });
      }
    }
    queryBuilder.orderBy('unidade.nome', 'ASC');
    return queryBuilder.getMany();
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
      relations: ['cliente', 'cliente.auditores', 'auditores'],
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
    if (dto.auditorIds !== undefined) {
      const clienteAuditores = unidade.cliente?.auditores || [];
      unidade.auditores = await this.filtrarAuditoresUnidade(dto.auditorIds, clienteAuditores);
    }
    const { auditorIds, ...dadosAtualizar } = dto;
    Object.assign(unidade, dadosAtualizar);
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
   * Verifica se auditores do cliente possuem auditorias em andamento.
   */
  async verificarTrocaAuditor(
    clienteId: string,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{ temAuditoriasAbertas: boolean; quantidade: number }> {
    const cliente = await this.buscarClientePorId(clienteId, usuarioAutenticado);
    const auditorIds = (cliente.auditores || []).map((a) => a.id);
    if (auditorIds.length === 0) {
      return { temAuditoriasAbertas: false, quantidade: 0 };
    }
    return this.verificarAuditoriasAbertasDosAuditores(clienteId, auditorIds);
  }

  private async verificarAuditoriasAbertasDosAuditores(
    clienteId: string,
    auditorIds: string[],
  ): Promise<{ temAuditoriasAbertas: boolean; quantidade: number }> {
    if (auditorIds.length === 0) {
      return { temAuditoriasAbertas: false, quantidade: 0 };
    }
    const quantidade = await this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .innerJoin('auditoria.unidade', 'unidade')
      .where('unidade.clienteId = :clienteId', { clienteId })
      .andWhere('auditoria.consultorId IN (:...auditorIds)', { auditorIds })
      .andWhere('auditoria.status = :status', { status: StatusAuditoria.EM_ANDAMENTO })
      .getCount();
    return { temAuditoriasAbertas: quantidade > 0, quantidade };
  }

  private validarAcessoCliente(
    cliente: Cliente,
    usuario: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): void {
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      const isVinculado = (cliente.auditores || []).some((a) => a.id === usuario.id);
      if (!isVinculado) {
        throw new ForbiddenException('Acesso negado a este cliente');
      }
      return;
    }
    if (cliente.gestorId !== usuario.id) {
      throw new ForbiddenException('Acesso negado a este cliente');
    }
  }

  private async buscarEValidarAuditores(
    auditorIds: string[] | undefined,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<Usuario[]> {
    if (!auditorIds || auditorIds.length === 0) return [];
    const auditores = await this.usuarioRepository.find({
      where: { id: In(auditorIds) },
    });
    for (const auditor of auditores) {
      if (auditor.perfil !== PerfilUsuario.AUDITOR) {
        throw new BadRequestException(`O usuário ${auditor.nome} não é um auditor`);
      }
      if (usuarioAutenticado && usuarioAutenticado.perfil === PerfilUsuario.GESTOR) {
        if (auditor.gestorId !== usuarioAutenticado.id) {
          throw new ForbiddenException(`O auditor ${auditor.nome} não pertence à sua equipe`);
        }
      }
    }
    if (auditores.length !== auditorIds.length) {
      throw new BadRequestException('Um ou mais auditores não foram encontrados');
    }
    return auditores;
  }

  private async filtrarAuditoresUnidade(
    auditorIds: string[] | undefined,
    auditoresCliente: Usuario[],
  ): Promise<Usuario[]> {
    if (!auditorIds || auditorIds.length === 0) return [];
    const idsCliente = auditoresCliente.map((a) => a.id);
    const idsInvalidos = auditorIds.filter((id) => !idsCliente.includes(id));
    if (idsInvalidos.length > 0) {
      throw new BadRequestException('Os auditores da unidade devem estar vinculados ao cliente');
    }
    return auditoresCliente.filter((a) => auditorIds.includes(a.id));
  }
}
