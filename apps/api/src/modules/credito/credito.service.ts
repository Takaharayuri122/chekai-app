import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UsoCredito, ProvedorIa } from './entities/uso-credito.entity';
import { ConfiguracaoCreditoService } from './configuracao-credito.service';
import { AssinaturaService } from '../plano/assinatura.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';

interface RegistrarUsoCreditoParams {
  gestorId: string;
  usuarioId: string;
  provedor: ProvedorIa;
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  metodoChamado: string;
  contexto?: string;
}

/**
 * Serviço responsável pelo controle de créditos de IA.
 */
@Injectable()
export class CreditoService {
  constructor(
    @InjectRepository(UsoCredito)
    private readonly usoCreditoRepository: Repository<UsoCredito>,
    private readonly configuracaoCreditoService: ConfiguracaoCreditoService,
    private readonly assinaturaService: AssinaturaService,
    private readonly dataSource: DataSource,
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
      throw new ForbiddenException('Master não precisa de validação de créditos');
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
   * Valida se o gestor tem créditos disponíveis.
   */
  async validarSaldoDisponivel(gestorId: string): Promise<void> {
    const assinatura = await this.assinaturaService.buscarAssinaturaAtivaComValidacao(gestorId);
    if (!assinatura) {
      throw new BadRequestException('Gestor não possui assinatura ativa');
    }
    const creditosUsados = await this.calcularCreditosUsados(gestorId);
    const limiteCreditos = assinatura.plano.limiteCreditos;
    if (creditosUsados >= limiteCreditos) {
      throw new BadRequestException('Limite de créditos excedido');
    }
  }

  /**
   * Calcula o total de créditos já utilizados pelo gestor.
   */
  async calcularCreditosUsados(gestorId: string): Promise<number> {
    const resultado = await this.usoCreditoRepository
      .createQueryBuilder('uso')
      .select('SUM(uso.creditosConsumidos)', 'total')
      .where('uso.gestorId = :gestorId', { gestorId })
      .getRawOne();
    return parseFloat(resultado?.total || '0');
  }

  /**
   * Converte tokens para créditos baseado na configuração.
   */
  async converterTokensParaCreditos(
    provedor: ProvedorIa,
    modelo: string,
    tokensTotal: number,
  ): Promise<number> {
    const configuracao = await this.configuracaoCreditoService.buscarConfiguracao(
      provedor,
      modelo,
    );
    if (!configuracao) {
      throw new BadRequestException(
        `Configuração não encontrada para ${provedor}/${modelo}`,
      );
    }
    const creditos = tokensTotal / configuracao.tokensPorCredito;
    return Math.ceil(creditos * 100) / 100;
  }

  /**
   * Registra o uso de créditos.
   */
  async registrarUso(params: RegistrarUsoCreditoParams): Promise<UsoCredito> {
    const tokensTotal = params.tokensInput + params.tokensOutput;
    const creditosConsumidos = await this.converterTokensParaCreditos(
      params.provedor,
      params.modelo,
      tokensTotal,
    );
    return this.dataSource.transaction(async (manager) => {
      const usoCredito = manager.create(UsoCredito, {
        gestorId: params.gestorId,
        usuarioId: params.usuarioId,
        provedor: params.provedor,
        modelo: params.modelo,
        tokensInput: params.tokensInput,
        tokensOutput: params.tokensOutput,
        tokensTotal,
        creditosConsumidos,
        metodoChamado: params.metodoChamado,
        contexto: params.contexto,
      });
      return manager.save(usoCredito);
    });
  }

  /**
   * Consulta o saldo de créditos disponível.
   */
  async consultarSaldo(gestorId: string): Promise<{
    limite: number;
    usado: number;
    disponivel: number;
  }> {
    const assinatura = await this.assinaturaService.buscarAssinaturaAtivaComValidacao(gestorId);
    if (!assinatura) {
      throw new BadRequestException('Gestor não possui assinatura ativa');
    }
    const usado = await this.calcularCreditosUsados(gestorId);
    const limite = assinatura.plano.limiteCreditos;
    return {
      limite,
      usado,
      disponivel: Math.max(0, limite - usado),
    };
  }

  /**
   * Lista o histórico de uso de créditos.
   */
  async listarHistorico(
    gestorId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: UsoCredito[]; total: number }> {
    const [items, total] = await this.usoCreditoRepository.findAndCount({
      where: { gestorId },
      order: { criadoEm: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['usuario'],
    });
    return { items, total };
  }
}

