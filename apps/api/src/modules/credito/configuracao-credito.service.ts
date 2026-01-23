import { Injectable, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracaoCredito } from './entities/configuracao-credito.entity';
import { ConfigurarCreditoDto } from './dto/configurar-credito.dto';
import { ProvedorIa } from './entities/uso-credito.entity';

/**
 * Serviço responsável pela configuração de taxas de conversão de créditos.
 */
@Injectable()
export class ConfiguracaoCreditoService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(ConfiguracaoCredito)
    private readonly configuracaoRepository: Repository<ConfiguracaoCredito>,
  ) {}

  /**
   * Inicializa as configurações padrão quando a aplicação é inicializada.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.inicializarConfiguracoesPadrao();
  }

  /**
   * Cria as configurações padrão se não existirem.
   */
  async inicializarConfiguracoesPadrao(): Promise<void> {
    const configuracoesPadrao = [
      {
        provedor: ProvedorIa.OPENAI,
        modelo: 'gpt-4o-mini',
        tokensPorCredito: 1000,
      },
      {
        provedor: ProvedorIa.DEEPSEEK,
        modelo: 'deepseek-chat',
        tokensPorCredito: 10000,
      },
    ];

    for (const config of configuracoesPadrao) {
      const existente = await this.configuracaoRepository.findOne({
        where: {
          provedor: config.provedor,
          modelo: config.modelo,
          ativo: true,
        },
      });
      if (!existente) {
        await this.criarOuAtualizar({
          provedor: config.provedor,
          modelo: config.modelo,
          tokensPorCredito: config.tokensPorCredito,
          ativo: true,
        });
      }
    }
  }

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
   * Se não encontrar, tenta criar a configuração padrão automaticamente.
   */
  async buscarConfiguracao(
    provedor: ProvedorIa,
    modelo: string,
  ): Promise<ConfiguracaoCredito | null> {
    let configuracao = await this.configuracaoRepository.findOne({
      where: {
        provedor,
        modelo,
        ativo: true,
      },
    });

    // Se não encontrar, tenta criar configuração padrão
    if (!configuracao) {
      // Primeiro verifica se existe uma configuração padrão para este provedor/modelo
      const configuracoesPadrao: Record<string, { provedor: ProvedorIa; modelo: string; tokensPorCredito: number }> = {
        'openai/gpt-4o-mini': {
          provedor: ProvedorIa.OPENAI,
          modelo: 'gpt-4o-mini',
          tokensPorCredito: 1000,
        },
        'deepseek/deepseek-chat': {
          provedor: ProvedorIa.DEEPSEEK,
          modelo: 'deepseek-chat',
          tokensPorCredito: 10000,
        },
      };

      const chave = `${provedor}/${modelo}`;
      const configPadrao = configuracoesPadrao[chave];

      if (configPadrao) {
        // Cria a configuração padrão
        configuracao = await this.criarOuAtualizar({
          provedor: configPadrao.provedor,
          modelo: configPadrao.modelo,
          tokensPorCredito: configPadrao.tokensPorCredito,
          ativo: true,
        });
      } else {
        // Se não tem configuração padrão, inicializa todas as padrões e tenta buscar novamente
        await this.inicializarConfiguracoesPadrao();
        configuracao = await this.configuracaoRepository.findOne({
          where: {
            provedor,
            modelo,
            ativo: true,
          },
        });
      }
    }

    return configuracao;
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

