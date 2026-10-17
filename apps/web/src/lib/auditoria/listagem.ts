import type { Auditoria } from '@/lib/api';
import { normalizar } from '@/components/layout/navegacao';

export interface FiltrosAuditoria {
  status: 'todos' | 'em_andamento' | 'finalizada';
  busca: string;
  de: string;
  ate: string;
  templateId: string;
  unidadeId: string;
  avaliadorId: string;
}

export const FILTROS_AUDITORIA_VAZIOS: FiltrosAuditoria = {
  status: 'todos',
  busca: '',
  de: '',
  ate: '',
  templateId: '',
  unidadeId: '',
  avaliadorId: '',
};

export function contemTexto(alvo: string | undefined | null, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  return normalizar(alvo ?? '').includes(t);
}

export function contarFiltrosAtivos(f: FiltrosAuditoria): number {
  return [f.status !== 'todos', f.de, f.ate, f.templateId, f.unidadeId, f.avaliadorId].filter(Boolean).length;
}

export function filtrarAuditorias(lista: Auditoria[], f: FiltrosAuditoria): Auditoria[] {
  const inicio = f.de ? new Date(`${f.de}T00:00:00`).getTime() : null;
  const fim = f.ate ? new Date(`${f.ate}T23:59:59`).getTime() : null;
  return lista.filter((a) => {
    const t = new Date(a.dataInicio).getTime();
    if (inicio !== null && t < inicio) return false;
    if (fim !== null && t > fim) return false;
    if (f.status !== 'todos' && a.status !== f.status) return false;
    if (f.templateId && a.template?.id !== f.templateId) return false;
    if (f.unidadeId && a.unidade?.id !== f.unidadeId) return false;
    if (f.avaliadorId && a.consultor?.id !== f.avaliadorId) return false;
    const cliente = a.unidade?.cliente?.nomeFantasia || a.unidade?.cliente?.razaoSocial;
    return contemTexto(a.unidade?.nome, f.busca) || contemTexto(cliente, f.busca) || contemTexto(a.template?.nome, f.busca);
  });
}
