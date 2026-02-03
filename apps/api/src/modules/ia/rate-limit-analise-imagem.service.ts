import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const INTERVALO_SEGUNDOS_PADRAO = 10;

/**
 * Serviço de rate limit para análise de imagem com IA.
 * Controla o intervalo mínimo entre requisições por gestor para evitar explosão de custos.
 */
@Injectable()
export class RateLimitAnaliseImagemService {
  private readonly intervaloMs: number;
  private readonly ultimaAnalisePorGestor = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {
    const segundos = this.configService.get<number>('ANALISE_IMAGEM_INTERVALO_SEGUNDOS')
      ?? INTERVALO_SEGUNDOS_PADRAO;
    this.intervaloMs = segundos * 1000;
  }

  /**
   * Verifica se o gestor pode realizar nova análise e registra o uso.
   * @throws BadRequestException se o intervalo mínimo não tiver sido respeitado
   */
  verificarEPregistrar(gestorId: string): void {
    const agora = Date.now();
    const ultima = this.ultimaAnalisePorGestor.get(gestorId);
    if (ultima !== undefined && agora - ultima < this.intervaloMs) {
      const segundosRestantes = Math.ceil((this.intervaloMs - (agora - ultima)) / 1000);
      throw new BadRequestException(
        `Aguarde ${segundosRestantes} segundo(s) entre análises de imagem`,
      );
    }
    this.ultimaAnalisePorGestor.set(gestorId, agora);
  }
}
