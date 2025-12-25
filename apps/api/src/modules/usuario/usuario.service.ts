import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuario.entity';
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
  async criar(dto: CriarUsuarioDto): Promise<Usuario> {
    const usuarioExistente = await this.usuarioRepository.findOne({
      where: { email: dto.email },
    });
    if (usuarioExistente) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const usuario = this.usuarioRepository.create({
      ...dto,
      senhaHash,
    });
    return this.usuarioRepository.save(usuario);
  }

  /**
   * Lista todos os usuários com paginação.
   */
  async listar(params: PaginationParams): Promise<PaginatedResult<Usuario>> {
    const [items, total] = await this.usuarioRepository.findAndCount({
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      order: { criadoEm: 'DESC' },
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
      select: ['id', 'nome', 'email', 'senhaHash', 'perfil', 'ativo'],
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

