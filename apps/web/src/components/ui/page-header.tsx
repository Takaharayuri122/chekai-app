import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, backHref, action }: PageHeaderProps) {
  return (
    <div className="bg-base-100 border-b border-base-300 px-4 py-4 lg:px-8 sticky top-0 z-20 md:top-16">
      <div className="flex items-center gap-4">
        {backHref && (
          <Link href={backHref} className="btn btn-ghost btn-sm btn-circle">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-base-content truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-base-content/60 truncate">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

