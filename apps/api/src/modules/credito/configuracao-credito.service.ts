import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracaoCredito } from './entities/configuracao-credito.entity';
import { ConfigurarCreditoDto } from './dto/configurar-credito.dto';
import { ProvedorIa } from './entities/uso-credito.entity';

/**
 * Serviço responsável pela configuração de taxas de conversão de créditos.
 */
@Injectable()
export class ConfiguracaoCreditoService {
  constructor(
    @InjectRepository(ConfiguracaoCredito)
    private readonly configuracaoRepository: Repository<ConfiguracaoCredito>,
  ) {}

  /**
   * Cria ou atualiza uma configuração de crédito.
   */
  async criarOuAtualizar(dto: ConfigurarCreditoDto): Promise<ConfiguracaoCredito> {
    const existente = await this.configuracaoRepository.findOne({
      where: {
        provedor: dto.provedor,
        modelo: dto.modelo,
      },
    });
    if (existente) {
      existente.tokensPorCredito = dto.tokensPorCredito;
      existente.ativo = dto.ativo !== undefined ? dto.ativo : existente.ativo;
      return this.configuracaoRepository.save(existente);
    }
    const configuracao = this.configuracaoRepository.create(dto);
    return this.configuracaoRepository.save(configuracao);
  }

  /**
   * Busca a configuração ativa para um provedor e modelo.
   */
  async buscarConfiguracao(
    provedor: ProvedorIa,
    modelo: string,
  ): Promise<ConfiguracaoCredito | null> {
    return this.configuracaoRepository.findOne({
      where: {
        provedor,
        modelo,
        ativo: true,
      },
    });
  }

  /**
   * Lista todas as configurações.
   */
  async listar(): Promise<ConfiguracaoCredito[]> {
    return this.configuracaoRepository.find({
      order: { criadoEm: 'DESC' },
    });
  }

  /**
   * Busca uma configuração pelo ID.
   */
  async buscarPorId(id: string): Promise<ConfiguracaoCredito> {
    const configuracao = await this.configuracaoRepository.findOne({
      where: { id },
    });
    if (!configuracao) {
      throw new NotFoundException('Configuração não encontrada');
    }
    return configuracao;
  }
}

