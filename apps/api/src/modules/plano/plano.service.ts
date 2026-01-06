import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plano } from './entities/plano.entity';
import { CriarPlanoDto } from './dto/criar-plano.dto';
import { AtualizarPlanoDto } from './dto/atualizar-plano.dto';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../shared/types/pagination.interface';

/**
 * Serviço responsável pela gestão de planos.
 */
@Injectable()
export class PlanoService {
  constructor(
    @InjectRepository(Plano)
    private readonly planoRepository: Repository<Plano>,
  ) {}

  /**
   * Cria um novo plano (apenas Master).
   */
  async criar(dto: CriarPlanoDto, usuario: { perfil: PerfilUsuario }): Promise<Plano> {
    if (usuario.perfil !== PerfilUsuario.MASTER) {
      throw new ForbiddenException('Apenas Master pode criar planos');
    }
    const plano = this.planoRepository.create(dto);
    return this.planoRepository.save(plano);
  }

  /**
   * Lista todos os planos.
   */
  async listar(params: PaginationParams): Promise<PaginatedResult<Plano>> {
    const [items, total] = await this.planoRepository.findAndCount({
      where: { ativo: true },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      order: { criadoEm: 'DESC' },
    });
    return createPaginatedResult(items, total, params.page, params.limit);
  }

  /**
   * Busca um plano pelo ID.
   */
  async buscarPorId(id: string): Promise<Plano> {
    const plano = await this.planoRepository.findOne({ where: { id } });
    if (!plano) {
      throw new NotFoundException('Plano não encontrado');
    }
    return plano;
  }

  /**
   * Atualiza um plano (apenas Master).
   */
  async atualizar(
    id: string,
    dto: AtualizarPlanoDto,
    usuario: { perfil: PerfilUsuario },
  ): Promise<Plano> {
    if (usuario.perfil !== PerfilUsuario.MASTER) {
      throw new ForbiddenException('Apenas Master pode atualizar planos');
    }
    const plano = await this.buscarPorId(id);
    Object.assign(plano, dto);
    return this.planoRepository.save(plano);
  }

  /**
   * Remove um plano (soft delete - desativa).
   */
  async remover(id: string, usuario: { perfil: PerfilUsuario }): Promise<void> {
    if (usuario.perfil !== PerfilUsuario.MASTER) {
      throw new ForbiddenException('Apenas Master pode remover planos');
    }
    const plano = await this.buscarPorId(id);
    plano.ativo = false;
    await this.planoRepository.save(plano);
  }
}

