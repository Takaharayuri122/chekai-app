import { SetMetadata } from '@nestjs/common';
import { PerfilUsuario } from '../../modules/usuario/entities/usuario.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorator para definir quais perfis podem acessar uma rota.
 */
export const Roles = (...roles: PerfilUsuario[]) => SetMetadata(ROLES_KEY, roles);

