import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario, PerfilUsuario } from './entities/usuario.entity';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../shared/types/pagination.interface';

/**
 * Serviço responsável pela gestão de usuários.
 */
@Injectable()
export class UsuarioService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  /**
   * Cria um novo usuário no sistema.
   */
  async criar(dto: CriarUsuarioDto, usuarioCriador?: { id: string; perfil: PerfilUsuario }): Promise<Usuario> {
    const usuarioExistente = await this.usuarioRepository.findOne({
      where: { email: dto.email },
    });
    if (usuarioExistente) {
      throw new ConflictException('E-mail já cadastrado');
    }
    if (usuarioCriador) {
      if (usuarioCriador.perfil === PerfilUsuario.ANALISTA && dto.perfil === PerfilUsuario.AUDITOR) {
        dto.analistaId = usuarioCriador.id;
      } else if (usuarioCriador.perfil !== PerfilUsuario.MASTER) {
        throw new ForbiddenException('Apenas Master pode criar usuários com este perfil');
      }
    }
    if (dto.perfil === PerfilUsuario.ANALISTA) {
      dto.analistaId = undefined;
    }
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const usuario = this.usuarioRepository.create({
      nome: dto.nome,
      email: dto.email,
      senhaHash,
      perfil: dto.perfil || PerfilUsuario.ANALISTA,
      telefone: dto.telefone || null,
      analistaId: dto.analistaId ? dto.analistaId : null,
      tenantId: null,
    });
    const savedUsuario = await this.usuarioRepository.save(usuario);
    if (savedUsuario.perfil === PerfilUsuario.ANALISTA) {
      savedUsuario.tenantId = savedUsuario.id;
      return this.usuarioRepository.save(savedUsuario);
    }
    return savedUsuario;
  }

  /**
   * Lista todos os usuários com paginação, filtrados por perfil do usuário autenticado.
   */
  async listar(
    params: PaginationParams,
    usuarioAutenticado?: { id: string; perfil: PerfilUsuario; analistaId?: string },
  ): Promise<PaginatedResult<Usuario>> {
    let where: any = {};
    if (usuarioAutenticado) {
      if (usuarioAutenticado.perfil === PerfilUsuario.ANALISTA) {
        where = [
          { id: usuarioAutenticado.id },
          { analistaId: usuarioAutenticado.id },
        ];
      } else if (usuarioAutenticado.perfil === PerfilUsuario.AUDITOR) {
        where = { id: usuarioAutenticado.id };
      }
    }
    const [items, total] = await this.usuarioRepository.findAndCount({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      order: { criadoEm: 'DESC' },
      relations: ['analista'],
    });
    return createPaginatedResult(items, total, params.page, params.limit);
  }

  /**
   * Busca um usuário pelo ID.
   */
  async buscarPorId(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return usuario;
  }

  /**
   * Busca um usuário pelo e-mail (inclui senha para autenticação).
   */
  async buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { email },
      select: ['id', 'nome', 'email', 'senhaHash', 'perfil', 'ativo', 'analistaId', 'tenantId'],
    });
  }

  /**
   * Atualiza os dados de um usuário.
   */
  async atualizar(id: string, dto: AtualizarUsuarioDto): Promise<Usuario> {
    const usuario = await this.buscarPorId(id);
    if (dto.email && dto.email !== usuario.email) {
      const emailExistente = await this.usuarioRepository.findOne({
        where: { email: dto.email },
      });
      if (emailExistente) {
        throw new ConflictException('E-mail já cadastrado');
      }
    }
    if (dto.senha) {
      const senhaHash = await bcrypt.hash(dto.senha, 10);
      Object.assign(usuario, { ...dto, senhaHash, senha: undefined });
    } else {
      Object.assign(usuario, dto);
    }
    return this.usuarioRepository.save(usuario);
  }

  /**
   * Remove um usuário (soft delete - desativa).
   */
  async remover(id: string): Promise<void> {
    const usuario = await this.buscarPorId(id);
    usuario.ativo = false;
    await this.usuarioRepository.save(usuario);
  }
}

