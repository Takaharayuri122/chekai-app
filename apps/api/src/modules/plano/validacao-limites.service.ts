import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario, PerfilUsuario } from '../usuario/entities/usuario.entity';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { Cliente } from '../cliente/entities/cliente.entity';
import { AssinaturaService } from './assinatura.service';

/**
 * Serviço auxiliar para validação de limites de planos.
 */
@Injectable()
export class ValidacaoLimitesService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Auditoria)
    private readonly auditoriaRepository: Repository<Auditoria>,
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    private readonly assinaturaService: AssinaturaService,
  ) {}

  /**
   * Identifica o gestorId correto baseado no perfil do usuário.
   */
  identificarGestorId(usuario: {
    id: string;
    perfil: PerfilUsuario;
    gestorId?: string | null;
  }): string {
    if (usuario.perfil === PerfilUsuario.MASTER) {
      return '';
    }
    if (usuario.perfil === PerfilUsuario.AUDITOR) {
      if (!usuario.gestorId) {
        throw new BadRequestException('Auditor deve estar vinculado a um gestor');
      }
      return usuario.gestorId;
    }
    return usuario.id;
  }

  /**
   * Conta usuários do gestor (incluindo auditores vinculados).
   */
  async contarUsuarios(gestorId: string): Promise<number> {
    return this.usuarioRepository.count({
      where: [
        { id: gestorId },
        { gestorId },
      ],
    });
  }

  /**
   * Conta auditorias do gestor (incluindo as criadas por auditores vinculados).
   */
  async contarAuditorias(gestorId: string): Promise<number> {
    const usuarios = await this.usuarioRepository.find({
      where: [
        { id: gestorId },
        { gestorId },
      ],
      select: ['id'],
    });
    const usuarioIds = usuarios.map((u) => u.id);
    if (usuarioIds.length === 0) {
      return 0;
    }
    return this.auditoriaRepository
      .createQueryBuilder('auditoria')
      .where('auditoria.consultorId IN (:...ids)', { ids: usuarioIds })
      .getCount();
  }

  /**
   * Conta clientes do gestor.
   */
  async contarClientes(gestorId: string): Promise<number> {
    return this.clienteRepository.count({
      where: { gestorId },
    });
  }

  /**
   * Valida limite de usuários antes de criar.
   */
  async validarLimiteUsuarios(gestorId: string): Promise<void> {
    const assinatura = await this.assinaturaService.buscarAssinaturaAtivaComValidacao(gestorId);
    if (!assinatura) {
      throw new BadRequestException('Gestor não possui assinatura ativa');
    }
    const usado = await this.contarUsuarios(gestorId);
    if (usado >= assinatura.plano.limiteUsuarios) {
      throw new BadRequestException(
        `Limite de usuários excedido. Limite: ${assinatura.plano.limiteUsuarios}, Usado: ${usado}`,
      );
    }
  }

  /**
   * Valida limite de auditorias antes de criar.
   */
  async validarLimiteAuditorias(gestorId: string): Promise<void> {
    const assinatura = await this.assinaturaService.buscarAssinaturaAtivaComValidacao(gestorId);
    if (!assinatura) {
      throw new BadRequestException('Gestor não possui assinatura ativa');
    }
    const usado = await this.contarAuditorias(gestorId);
    if (usado >= assinatura.plano.limiteAuditorias) {
      throw new BadRequestException(
        `Limite de auditorias excedido. Limite: ${assinatura.plano.limiteAuditorias}, Usado: ${usado}`,
      );
    }
  }

  /**
   * Valida limite de clientes antes de criar.
   */
  async validarLimiteClientes(gestorId: string): Promise<void> {
    const assinatura = await this.assinaturaService.buscarAssinaturaAtivaComValidacao(gestorId);
    if (!assinatura) {
      throw new BadRequestException('Gestor não possui assinatura ativa');
    }
    const usado = await this.contarClientes(gestorId);
    if (usado >= assinatura.plano.limiteClientes) {
      throw new BadRequestException(
        `Limite de clientes excedido. Limite: ${assinatura.plano.limiteClientes}, Usado: ${usado}`,
      );
    }
  }
}

