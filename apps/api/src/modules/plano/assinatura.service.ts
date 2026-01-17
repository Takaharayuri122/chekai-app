import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Assinatura, StatusAssinatura } from './entities/assinatura.entity';
import { CriarAssinaturaDto } from './dto/criar-assinatura.dto';
import { PlanoService } from './plano.service';
import { UsuarioService } from '../usuario/usuario.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

/**
 * Serviço responsável pela gestão de assinaturas.
 */
@Injectable()
export class AssinaturaService {
  constructor(
    @InjectRepository(Assinatura)
    private readonly assinaturaRepository: Repository<Assinatura>,
    private readonly planoService: PlanoService,
    private readonly usuarioService: UsuarioService,
  ) {}

  /**
   * Cria uma nova assinatura (apenas Master).
   */
  async criar(
    dto: CriarAssinaturaDto,
    usuario: { perfil: PerfilUsuario },
  ): Promise<Assinatura> {
    if (usuario.perfil !== PerfilUsuario.MASTER) {
      throw new ForbiddenException('Apenas Master pode criar assinaturas');
    }
    const gestor = await this.usuarioService.buscarPorId(dto.gestorId);
    if (gestor.perfil !== PerfilUsuario.GESTOR) {
      throw new BadRequestException('Apenas gestores podem ter assinaturas');
    }
    await this.planoService.buscarPorId(dto.planoId);
    const assinaturaExistente = await this.buscarAssinaturaAtiva(dto.gestorId);
    if (assinaturaExistente) {
      assinaturaExistente.status = StatusAssinatura.CANCELADA;
      await this.assinaturaRepository.save(assinaturaExistente);
    }
    const dataInicio = dto.dataInicio ? new Date(dto.dataInicio) : new Date();
    const dataFim = dto.dataFim ? new Date(dto.dataFim) : null;
    const assinatura = this.assinaturaRepository.create({
      gestorId: dto.gestorId,
      planoId: dto.planoId,
      dataInicio,
      dataFim,
      status: StatusAssinatura.ATIVA,
    });
    return this.assinaturaRepository.save(assinatura);
  }

  /**
   * Cria uma assinatura pública durante o cadastro (sem autenticação Master).
   * Usado apenas durante o processo de cadastro público de novos gestores.
   */
  async criarAssinaturaPublica(gestorId: string, planoId: string): Promise<Assinatura> {
    const gestor = await this.usuarioService.buscarPorId(gestorId);
    if (gestor.perfil !== PerfilUsuario.GESTOR) {
      throw new BadRequestException('Apenas gestores podem ter assinaturas');
    }
    const plano = await this.planoService.buscarPorId(planoId);
    if (!plano.ativo) {
      throw new BadRequestException('Plano não está ativo');
    }
    const assinaturaExistente = await this.buscarAssinaturaAtiva(gestorId);
    if (assinaturaExistente) {
      assinaturaExistente.status = StatusAssinatura.CANCELADA;
      await this.assinaturaRepository.save(assinaturaExistente);
    }
    const assinatura = this.assinaturaRepository.create({
      gestorId,
      planoId,
      dataInicio: new Date(),
      dataFim: null,
      status: StatusAssinatura.ATIVA,
    });
    return this.assinaturaRepository.save(assinatura);
  }

  /**
   * Busca a assinatura ativa de um gestor.
   */
  async buscarAssinaturaAtiva(gestorId: string): Promise<Assinatura | null> {
    return this.assinaturaRepository.findOne({
      where: {
        gestorId,
        status: StatusAssinatura.ATIVA,
      },
      relations: ['plano'],
      order: { criadoEm: 'DESC' },
    });
  }

  /**
   * Busca a assinatura ativa de um gestor (incluindo verificações de data).
   */
  async buscarAssinaturaAtivaComValidacao(gestorId: string): Promise<Assinatura | null> {
    const agora = new Date();
    const assinatura = await this.assinaturaRepository.findOne({
      where: {
        gestorId,
        status: StatusAssinatura.ATIVA,
        dataInicio: LessThanOrEqual(agora),
      },
      relations: ['plano'],
      order: { criadoEm: 'DESC' },
    });
    if (!assinatura) {
      return null;
    }
    if (assinatura.dataFim && assinatura.dataFim < agora) {
      assinatura.status = StatusAssinatura.EXPIRADA;
      await this.assinaturaRepository.save(assinatura);
      return null;
    }
    return assinatura;
  }

  /**
   * Lista o histórico de assinaturas de um gestor.
   */
  async listarHistorico(gestorId: string): Promise<Assinatura[]> {
    return this.assinaturaRepository.find({
      where: { gestorId },
      relations: ['plano'],
      order: { criadoEm: 'DESC' },
    });
  }

  /**
   * Cancela uma assinatura ativa.
   */
  async cancelar(assinaturaId: string, usuario: { perfil: PerfilUsuario }): Promise<Assinatura> {
    if (usuario.perfil !== PerfilUsuario.MASTER) {
      throw new ForbiddenException('Apenas Master pode cancelar assinaturas');
    }
    const assinatura = await this.assinaturaRepository.findOne({
      where: { id: assinaturaId },
    });
    if (!assinatura) {
      throw new NotFoundException('Assinatura não encontrada');
    }
    assinatura.status = StatusAssinatura.CANCELADA;
    return this.assinaturaRepository.save(assinatura);
  }
}

