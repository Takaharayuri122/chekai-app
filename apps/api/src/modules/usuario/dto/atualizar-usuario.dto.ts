import { PartialType } from '@nestjs/swagger';
import { CriarUsuarioDto } from './criar-usuario.dto';

/**
 * DTO para atualização de um usuário.
 * Todos os campos são opcionais.
 */
export class AtualizarUsuarioDto extends PartialType(CriarUsuarioDto) {}

