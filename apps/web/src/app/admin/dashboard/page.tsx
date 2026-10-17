'use client';

import { AppLayout } from '@/components';
import { InicioAuditor } from '@/components/inicio/inicio-auditor';
import { InicioGestor } from '@/components/inicio/inicio-gestor';
import { PerfilUsuario, useAuthStore } from '@/lib/store';

export default function DashboardPage() {
  const { usuario } = useAuthStore();
  return <AppLayout>{usuario?.perfil === PerfilUsuario.AUDITOR ? <InicioAuditor /> : <InicioGestor />}</AppLayout>;
}
