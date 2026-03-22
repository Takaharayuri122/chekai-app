import { Logger } from '@nestjs/common';

/**
 * Registra duração e RSS quando PDF_GERACAO_METRICAS está habilitado.
 */
export function registrarMetricaGeracaoPdf(
  logger: Logger,
  habilitado: boolean,
  inicioHr: bigint,
  rotulo: string,
  tamanhoBytes?: number,
): void {
  if (!habilitado) {
    return;
  }
  const ms = Number(process.hrtime.bigint() - inicioHr) / 1e6;
  const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const extra = tamanhoBytes !== undefined ? ` · ${tamanhoBytes} bytes` : '';
  logger.log(`[PDF métricas] ${rotulo}: ${ms.toFixed(0)} ms · RSS ${rss} MB${extra}`);
}
