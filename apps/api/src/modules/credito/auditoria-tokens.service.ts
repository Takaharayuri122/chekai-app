import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { UsoCredito, ProvedorIa } from './entities/uso-credito.entity';
import { Usuario } from '../usuario/entities/usuario.entity';

export interface EstatisticasTokens {
  total: {
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  };
  porProvedor: Array<{
    provedor: ProvedorIa;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  }>;
  porModelo: Array<{
    provedor: ProvedorIa;
    modelo: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  }>;
  porGestor: Array<{
    gestorId: string;
    gestorNome: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  }>;
  porPeriodo: Array<{
    data: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    creditosConsumidos: number;
    totalUsos: number;
  }>;
}

@Injectable()
export class AuditoriaTokensService {
  constructor(
    @InjectRepository(UsoCredito)
    private readonly usoCreditoRepository: Repository<UsoCredito>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  /**
   * Obtém estatísticas agregadas de uso de tokens.
   */
  async obterEstatisticas(
    dataInicio?: Date,
    dataFim?: Date,
  ): Promise<EstatisticasTokens> {
    const where: any = {};
    if (dataInicio && dataFim) {
      where.criadoEm = Between(dataInicio, dataFim);
    } else if (dataInicio) {
      where.criadoEm = Between(dataInicio, new Date());
    }

    const todosUsos = await this.usoCreditoRepository.find({
      where,
      relations: ['gestor', 'usuario'],
    });

    // Total geral
    const total = todosUsos.reduce(
      (acc, uso) => ({
        tokensInput: acc.tokensInput + uso.tokensInput,
        tokensOutput: acc.tokensOutput + uso.tokensOutput,
        tokensTotal: acc.tokensTotal + uso.tokensTotal,
        creditosConsumidos: acc.creditosConsumidos + parseFloat(String(uso.creditosConsumidos || 0)),
        totalUsos: acc.totalUsos + 1,
      }),
      {
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        creditosConsumidos: 0,
        totalUsos: 0,
      },
    );

    // Por provedor
    const porProvedorMap = new Map<ProvedorIa, typeof total>();
    todosUsos.forEach((uso) => {
      const atual = porProvedorMap.get(uso.provedor) || {
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        creditosConsumidos: 0,
        totalUsos: 0,
      };
      porProvedorMap.set(uso.provedor, {
        tokensInput: atual.tokensInput + uso.tokensInput,
        tokensOutput: atual.tokensOutput + uso.tokensOutput,
        tokensTotal: atual.tokensTotal + uso.tokensTotal,
        creditosConsumidos: atual.creditosConsumidos + parseFloat(String(uso.creditosConsumidos || 0)),
        totalUsos: atual.totalUsos + 1,
      });
    });
    const porProvedor = Array.from(porProvedorMap.entries()).map(([provedor, stats]) => ({
      provedor,
      ...stats,
    }));

    // Por modelo
    const porModeloMap = new Map<string, typeof total & { provedor: ProvedorIa; modelo: string }>();
    todosUsos.forEach((uso) => {
      const chave = `${uso.provedor}:${uso.modelo}`;
      const atual = porModeloMap.get(chave) || {
        provedor: uso.provedor,
        modelo: uso.modelo,
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        creditosConsumidos: 0,
        totalUsos: 0,
      };
      porModeloMap.set(chave, {
        provedor: atual.provedor,
        modelo: atual.modelo,
        tokensInput: atual.tokensInput + uso.tokensInput,
        tokensOutput: atual.tokensOutput + uso.tokensOutput,
        tokensTotal: atual.tokensTotal + uso.tokensTotal,
        creditosConsumidos: atual.creditosConsumidos + parseFloat(String(uso.creditosConsumidos || 0)),
        totalUsos: atual.totalUsos + 1,
      });
    });
    const porModelo = Array.from(porModeloMap.values()).map((stats) => ({
      provedor: stats.provedor,
      modelo: stats.modelo,
      tokensInput: stats.tokensInput,
      tokensOutput: stats.tokensOutput,
      tokensTotal: stats.tokensTotal,
      creditosConsumidos: stats.creditosConsumidos,
      totalUsos: stats.totalUsos,
    }));

    // Por gestor
    const porGestorMap = new Map<string, typeof total & { gestorNome: string }>();
    todosUsos.forEach((uso) => {
      const gestorId = uso.gestorId;
      const atual = porGestorMap.get(gestorId) || {
        gestorNome: uso.gestor?.nome || 'Desconhecido',
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        creditosConsumidos: 0,
        totalUsos: 0,
      };
      porGestorMap.set(gestorId, {
        ...atual,
        tokensInput: atual.tokensInput + uso.tokensInput,
        tokensOutput: atual.tokensOutput + uso.tokensOutput,
        tokensTotal: atual.tokensTotal + uso.tokensTotal,
        creditosConsumidos: atual.creditosConsumidos + parseFloat(String(uso.creditosConsumidos || 0)),
        totalUsos: atual.totalUsos + 1,
      });
    });
    const porGestor = Array.from(porGestorMap.entries()).map(([gestorId, stats]) => ({
      gestorId,
      gestorNome: stats.gestorNome,
      tokensInput: stats.tokensInput,
      tokensOutput: stats.tokensOutput,
      tokensTotal: stats.tokensTotal,
      creditosConsumidos: stats.creditosConsumidos,
      totalUsos: stats.totalUsos,
    }));

    // Por período (agrupado por dia)
    const porPeriodoMap = new Map<string, typeof total>();
    todosUsos.forEach((uso) => {
      const data = new Date(uso.criadoEm).toISOString().split('T')[0];
      const atual = porPeriodoMap.get(data) || {
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        creditosConsumidos: 0,
        totalUsos: 0,
      };
      porPeriodoMap.set(data, {
        tokensInput: atual.tokensInput + uso.tokensInput,
        tokensOutput: atual.tokensOutput + uso.tokensOutput,
        tokensTotal: atual.tokensTotal + uso.tokensTotal,
        creditosConsumidos: atual.creditosConsumidos + parseFloat(String(uso.creditosConsumidos || 0)),
        totalUsos: atual.totalUsos + 1,
      });
    });
    const porPeriodo = Array.from(porPeriodoMap.entries())
      .map(([data, stats]) => ({
        data,
        ...stats,
      }))
      .sort((a, b) => a.data.localeCompare(b.data));

    return {
      total,
      porProvedor,
      porModelo,
      porGestor,
      porPeriodo,
    };
  }

  /**
   * Lista histórico detalhado de uso de tokens.
   */
  async listarHistoricoDetalhado(
    page = 1,
    limit = 50,
    gestorId?: string,
    provedor?: ProvedorIa,
    dataInicio?: Date,
    dataFim?: Date,
  ): Promise<{ items: UsoCredito[]; total: number }> {
    const where: any = {};
    if (gestorId) {
      where.gestorId = gestorId;
    }
    if (provedor) {
      where.provedor = provedor;
    }
    if (dataInicio && dataFim) {
      where.criadoEm = Between(dataInicio, dataFim);
    } else if (dataInicio) {
      where.criadoEm = Between(dataInicio, new Date());
    }

    const [items, total] = await this.usoCreditoRepository.findAndCount({
      where,
      relations: ['gestor', 'usuario'],
      order: { criadoEm: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }
}

