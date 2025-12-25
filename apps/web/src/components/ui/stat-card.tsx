import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
}

const colorClasses = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-error/10 text-error',
};

export function StatCard({ title, value, icon: Icon, color = 'primary' }: StatCardProps) {
  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body p-4 items-center text-center">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-2xl font-bold text-base-content">{value}</p>
        <p className="text-xs text-base-content/60">{title}</p>
      </div>
    </div>
  );
}

