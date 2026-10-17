import { dataLocalISO } from '@/lib/datas';

export interface DiaCalendario<T> {
  iso: string;
  dia: number;
  doMes: boolean;
  hoje: boolean;
  itens: T[];
}

/** Segunda-feira = 0 … domingo = 6 */
function indiceSemana(data: Date): number {
  return (data.getDay() + 6) % 7;
}

/** Primeiro e último dia visíveis na grade do mês (semanas completas de segunda a domingo). `mes` é 0–11. */
export function intervaloGrade(ano: number, mes: number): { de: string; ate: string } {
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  const inicio = new Date(ano, mes, 1 - indiceSemana(primeiro));
  const fim = new Date(ano, mes + 1, 0 + (6 - indiceSemana(ultimo)));
  return { de: dataLocalISO(inicio), ate: dataLocalISO(fim) };
}

export function montarGradeMes<T extends { dataPrevista: string }>(
  ano: number,
  mes: number,
  itens: T[],
  hoje: string = dataLocalISO(),
): DiaCalendario<T>[][] {
  const porDia = new Map<string, T[]>();
  itens.forEach((item) => {
    const chave = item.dataPrevista.slice(0, 10);
    porDia.set(chave, [...(porDia.get(chave) ?? []), item]);
  });

  const { de, ate } = intervaloGrade(ano, mes);
  const [a, m, d] = de.split('-').map(Number);
  const cursor = new Date(a, m - 1, d);
  const semanas: DiaCalendario<T>[][] = [];
  let semana: DiaCalendario<T>[] = [];

  while (dataLocalISO(cursor) <= ate) {
    const iso = dataLocalISO(cursor);
    semana.push({ iso, dia: cursor.getDate(), doMes: cursor.getMonth() === mes, hoje: iso === hoje, itens: porDia.get(iso) ?? [] });
    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return semanas;
}
