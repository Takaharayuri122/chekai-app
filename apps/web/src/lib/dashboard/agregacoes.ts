import type { Auditoria } from '@/lib/api';

export interface FiltroDashboard {
  inicio: string;
  fim: string;
  templateId: string;
  unidadeId: string;
}

const finalizadas = (lista: Auditoria[]) => lista.filter((a) => a.status === 'finalizada');
const nota = (a: Auditoria) => Number(a.pontuacaoTotal || 0);

export function filtrarDashboard(lista: Auditoria[], f: FiltroDashboard): Auditoria[] {
  const inicio = f.inicio ? new Date(`${f.inicio}T00:00:00`).getTime() : -Infinity;
  const fim = f.fim ? new Date(`${f.fim}T23:59:59`).getTime() : Infinity;
  return lista.filter((a) => {
    const t = new Date(a.dataInicio).getTime();
    if (t < inicio || t > fim) return false;
    if (f.templateId && a.template?.id !== f.templateId) return false;
    if (f.unidadeId && a.unidade?.id !== f.unidadeId) return false;
    return true;
  });
}

export function mediaAproveitamento(lista: Auditoria[]): number | null {
  const fin = finalizadas(lista);
  if (fin.length === 0) return null;
  return fin.reduce((s, a) => s + nota(a), 0) / fin.length;
}

export function avaliacoesPorMes(lista: Auditoria[]): { chave: string; mes: string; total: number }[] {
  const mapa = new Map<string, number>();
  lista.forEach((a) => {
    const d = new Date(a.dataInicio);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  });
  return Array.from(mapa, ([chave, total]) => ({ chave, mes: `${chave.slice(5)}/${chave.slice(2, 4)}`, total })).sort((x, y) =>
    x.chave.localeCompare(y.chave),
  );
}

export function rankingAvaliadores(lista: Auditoria[]): { id: string; nome: string; total: number }[] {
  const mapa = new Map<string, { id: string; nome: string; total: number }>();
  lista.forEach((a) => {
    const id = a.consultor?.id ?? 'sem-avaliador';
    const atual = mapa.get(id) ?? { id, nome: a.consultor?.nome ?? 'Não informado', total: 0 };
    atual.total += 1;
    mapa.set(id, atual);
  });
  return Array.from(mapa.values()).sort((x, y) => y.total - x.total);
}

export function rankingUnidades(lista: Auditoria[]): { id: string; nome: string; ultima: number; media: number; total: number }[] {
  const mapa = new Map<string, { id: string; nome: string; notas: number[] }>();
  [...finalizadas(lista)]
    .sort((x, y) => new Date(x.dataInicio).getTime() - new Date(y.dataInicio).getTime())
    .forEach((a) => {
      const id = a.unidade?.id ?? 'sem-unidade';
      const atual = mapa.get(id) ?? { id, nome: a.unidade?.nome ?? 'Unidade', notas: [] };
      atual.notas.push(nota(a));
      mapa.set(id, atual);
    });
  return Array.from(mapa.values())
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      ultima: u.notas[u.notas.length - 1],
      media: u.notas.reduce((s, n) => s + n, 0) / u.notas.length,
      total: u.notas.length,
    }))
    .sort((x, y) => y.media - x.media);
}

export function resumoPorChecklist(lista: Auditoria[]): { id: string; nome: string; total: number; finalizadas: number; media: number | null }[] {
  const mapa = new Map<string, { id: string; nome: string; total: number; finalizadas: number; soma: number }>();
  lista.forEach((a) => {
    const id = a.template?.id ?? 'sem-checklist';
    const atual = mapa.get(id) ?? { id, nome: a.template?.nome ?? 'Sem checklist', total: 0, finalizadas: 0, soma: 0 };
    atual.total += 1;
    if (a.status === 'finalizada') {
      atual.finalizadas += 1;
      atual.soma += nota(a);
    }
    mapa.set(id, atual);
  });
  return Array.from(mapa.values())
    .map(({ soma, ...c }) => ({ ...c, media: c.finalizadas ? soma / c.finalizadas : null }))
    .sort((x, y) => y.total - x.total);
}
