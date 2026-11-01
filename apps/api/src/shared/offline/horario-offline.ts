import { BadRequestException } from '@nestjs/common';

/** Tolerância para o relógio do celular estar adiantado em relação ao servidor. */
export const TOLERANCIA_FUTURO_OFFLINE_MS = 5 * 60 * 1000;

/** Período máximo em que um registro feito sem internet ainda é aceito pelo servidor. */
export const JANELA_MAXIMA_OFFLINE_DIAS = 14;
export const JANELA_MAXIMA_OFFLINE_MS = JANELA_MAXIMA_OFFLINE_DIAS * 24 * 60 * 60 * 1000;

/**
 * Lê um horário informado pelo celular para um registro feito sem internet. Recusa
 * horários mais de 5 min no futuro (relógio errado) ou mais antigos que a janela
 * máxima — sem esse limite, uma data antiga contornaria todos os bloqueios.
 */
export function lerHorarioOffline(valor: string): Date {
  const horario = new Date(valor);
  const agora = Date.now();
  if (horario.getTime() > agora + TOLERANCIA_FUTURO_OFFLINE_MS) {
    throw new BadRequestException(
      'O horário informado está no futuro. Verifique o relógio do celular.',
    );
  }
  if (horario.getTime() < agora - JANELA_MAXIMA_OFFLINE_MS) {
    throw new BadRequestException(
      `O horário informado está fora do período aceito para registros sem internet (até ${JANELA_MAXIMA_OFFLINE_DIAS} dias).`,
    );
  }
  return horario;
}
