import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * Valida `legislacaoIds` recebido (array, até 10, UUID v4) antes de consultar o banco.
 * Usa a mesma mensagem de `LegislacaoService.buscarPorIds` para ids inválidos.
 */
export function validarLegislacaoIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length > 10 || ids.some((id) => typeof id !== 'string' || !isUUID(id, '4'))) {
    throw new BadRequestException('Legislação não encontrada.');
  }
  return ids as string[];
}
