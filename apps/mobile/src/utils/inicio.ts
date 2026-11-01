/**
 * Regras do Início (mesmas do web — apps/web/src/components/inicio/inicio-auditor.tsx).
 */

/** Data local no formato AAAA-MM-DD (evita o deslocamento de fuso do toISOString). */
export function dataLocalISO(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function filtrarEmAndamento<T extends { status: string }>(auditorias: T[]): T[] {
  return auditorias.filter((a) => a.status === 'em_andamento').slice(0, 3);
}

/** Visitas agendadas para hoje ou atrasadas. */
export function filtrarAgendaDoDia<T extends { dataPrevista: string }>(itens: T[], hoje: string): T[] {
  return itens.filter((g) => g.dataPrevista.slice(0, 10) <= hoje).slice(0, 5);
}

/** Tarefas de plano de ação abertas com prazo vencido. */
export function filtrarTarefasAtrasadas<T extends { status: string; prazo: string }>(itens: T[], hoje: string): T[] {
  return itens
    .filter((t) => (t.status === 'pendente' || t.status === 'em_andamento') && t.prazo.slice(0, 10) < hoje)
    .slice(0, 5);
}
