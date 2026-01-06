import { Request } from 'express';
import { PerfilUsuario } from '../../modules/usuario/entities/usuario.entity';

/**
 * Interface para requisições autenticadas com informações do usuário.
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    perfil: PerfilUsuario;
    gestorId?: string;
    tenantId?: string;
  };
}

