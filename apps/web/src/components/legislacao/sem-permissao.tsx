import { ShieldOff } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function SemPermissaoLegislacoes() {
  return (
    <div className="px-4 py-8 lg:px-8">
      <EmptyState
        icon={ShieldOff}
        title="Acesso restrito"
        description="Você não tem permissão para gerenciar legislações."
      />
    </div>
  );
}
