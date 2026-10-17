import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
}

const CORES: Record<NonNullable<StatCardProps['color']>, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-info/10 text-info',
  accent: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
};

export function StatCard({ title, value, icon: Icon, color = 'primary' }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', CORES[color])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{title}</p>
        <p className="font-display text-2xl font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}
