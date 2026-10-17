import { cn } from '@/lib/cn';

export type TomStatus = 'sucesso' | 'alerta' | 'perigo' | 'info' | 'neutro';

const TONS: Record<string, TomStatus> = {
  conforme: 'sucesso',
  finalizada: 'sucesso',
  concluida: 'sucesso',
  realizada: 'sucesso',
  ativo: 'sucesso',
  em_andamento: 'alerta',
  pendente: 'alerta',
  rascunho: 'alerta',
  nao_conforme: 'perigo',
  atrasada: 'perigo',
  agendada: 'info',
  nao_aplicavel: 'neutro',
  nao_avaliado: 'neutro',
  cancelada: 'neutro',
  inativo: 'neutro',
};

const ROTULOS: Record<string, string> = {
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  nao_aplicavel: 'N/A',
  nao_avaliado: 'Não avaliado',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  pendente: 'Pendente',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  agendada: 'Agendada',
  realizada: 'Realizada',
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  inativo: 'Inativo',
};

const CLASSES: Record<TomStatus, string> = {
  sucesso: 'bg-success/12 text-[hsl(160_84%_28%)]',
  alerta: 'bg-warning/15 text-[hsl(32_95%_34%)]',
  perigo: 'bg-destructive/12 text-[hsl(0_72%_45%)]',
  info: 'bg-info/12 text-[hsl(217_80%_45%)]',
  neutro: 'bg-muted text-muted-foreground',
};

export function getTomStatus(status: string): TomStatus {
  return TONS[status] ?? 'neutro';
}

export function rotuloStatus(status: string): string {
  if (ROTULOS[status]) return ROTULOS[status];
  const texto = status.replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function StatusChip({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        CLASSES[getTomStatus(status)],
        className,
      )}
    >
      {label ?? rotuloStatus(status)}
    </span>
  );
}
