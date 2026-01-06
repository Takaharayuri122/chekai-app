import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AssinaturaService } from './assinatura.service';
import { ValidacaoLimitesService } from './validacao-limites.service';
import { CreditoService } from '../credito/credito.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

/**
 * Controller para gestores consultarem seus limites e créditos.
 */
@ApiTags('Gestores')
@Controller('gestores')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GestorLimitesController {
  constructor(
    private readonly assinaturaService: AssinaturaService,
    private readonly validacaoLimites: ValidacaoLimitesService,
    private readonly creditoService: CreditoService,
  ) {}

  @Get('me/limites')
  @ApiOperation({ summary: 'Consulta limites e uso atual do gestor' })
  @ApiResponse({ status: 200, description: 'Limites e uso' })
  async consultarLimites(
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{
    plano: {
      nome: string;
      limiteUsuarios: number;
      limiteAuditorias: number;
      limiteClientes: number;
      limiteCreditos: number;
    };
    uso: {
      usuarios: number;
      auditorias: number;
      clientes: number;
      creditos: number;
    };
  }> {
    const gestorId = this.validacaoLimites.identificarGestorId(usuario);
    const assinatura = await this.assinaturaService.buscarAssinaturaAtivaComValidacao(gestorId);
    if (!assinatura) {
      throw new Error('Gestor não possui assinatura ativa');
    }
    const [usuarios, auditorias, clientes, creditos] = await Promise.all([
      this.validacaoLimites.contarUsuarios(gestorId),
      this.validacaoLimites.contarAuditorias(gestorId),
      this.validacaoLimites.contarClientes(gestorId),
      this.creditoService.calcularCreditosUsados(gestorId),
    ]);
    return {
      plano: {
        nome: assinatura.plano.nome,
        limiteUsuarios: assinatura.plano.limiteUsuarios,
        limiteAuditorias: assinatura.plano.limiteAuditorias,
        limiteClientes: assinatura.plano.limiteClientes,
        limiteCreditos: assinatura.plano.limiteCreditos,
      },
      uso: {
        usuarios,
        auditorias,
        clientes,
        creditos,
      },
    };
  }

  @Get('me/creditos')
  @ApiOperation({ summary: 'Consulta saldo e histórico de créditos do gestor' })
  @ApiResponse({ status: 200, description: 'Saldo e histórico de créditos' })
  async consultarCreditos(
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<{
    saldo: {
      limite: number;
      usado: number;
      disponivel: number;
    };
    historico: {
      items: any[];
      total: number;
    };
  }> {
    const gestorId = this.validacaoLimites.identificarGestorId(usuario);
    const saldo = await this.creditoService.consultarSaldo(gestorId);
    const historico = await this.creditoService.listarHistorico(gestorId, page, limit);
    return {
      saldo,
      historico,
    };
  }

  @Get('me/assinatura')
  @ApiOperation({ summary: 'Consulta assinatura ativa do gestor' })
  @ApiResponse({ status: 200, description: 'Assinatura ativa' })
  async consultarAssinatura(
    @CurrentUser() usuario: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ) {
    const gestorId = this.validacaoLimites.identificarGestorId(usuario);
    return this.assinaturaService.buscarAssinaturaAtivaComValidacao(gestorId);
  }
}

