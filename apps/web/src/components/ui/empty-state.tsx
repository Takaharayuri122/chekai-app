import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  actionHref,
  actionOnClick
}: EmptyStateProps) {
  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body items-center text-center py-12">
        <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-base-content/40" />
        </div>
        <h3 className="text-lg font-semibold text-base-content font-display">{title}</h3>
        <p className="text-sm text-base-content/60 max-w-xs">{description}</p>
        {actionLabel && actionHref && (
          <Link href={actionHref} className="btn btn-primary btn-sm mt-4">
            {actionLabel}
          </Link>
        )}
        {actionLabel && actionOnClick && (
          <button onClick={actionOnClick} className="btn btn-primary btn-sm mt-4">
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

