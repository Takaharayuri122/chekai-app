'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Loader2, LogIn, LogOut, TriangleAlert } from 'lucide-react';
import { ConfirmDialog } from '@/components';
import { PerfilUsuario, useAuthStore } from '@/lib/store';
import { checkinService } from '@/lib/services/checkin.service';
import { useCheckinStore } from '@/lib/store-checkin';
import { toastService } from '@/lib/toast';
import { useGeolocalizacao } from '@/hooks/use-geolocalizacao';
import { CheckinModal } from './checkin-modal';

const ROTAS_SEM_CHECKIN: string[] = [
  '/admin/lista-espera',
  '/admin/planos',
  '/admin/configuracoes-credito',
  '/admin/auditoria-tokens',
  '/admin/templates',
  '/admin/auditoria',
  '/admin/auditorias',
  '/admin/relatorios-tecnicos',
  '/auditoria',
];

function isRotaSemCheckin(pathname: string): boolean {
  return ROTAS_SEM_CHECKIN.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

export function CheckinFab() {
  const pathname = usePathname();
  const { usuario, isAuthenticated } = useAuthStore();
  const {
    checkinAberto,
    isAtrasado3h,
    isLoading,
    isModalAberto,
    setEstadoCheckin,
    setLoading,
    setModalAberto,
  } = useCheckinStore();
  const { capturarLocalizacao } = useGeolocalizacao();
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState<boolean>(false);
  const ultimoToastAlertaRef = useRef<string | null>(null);
  const podeUsarCheckin = Boolean(
    usuario
      && [
        PerfilUsuario.AUDITOR,
        PerfilUsuario.GESTOR,
        PerfilUsuario.MASTER,
      ].includes(usuario.perfil),
  );

  const carregarEstado = useCallback(async (): Promise<void> => {
    if (!usuario) {
      return;
    }
    const [estado, alerta] = await Promise.all([
      checkinService.buscarAberto(),
      checkinService.buscarAlerta(),
    ]);
    setEstadoCheckin({
      checkinAberto: estado.checkin,
      isAtrasado3h: estado.isAtrasado3h,
      mensagemAlerta: alerta.mensagem,
    });
    if (alerta.possuiAlerta && alerta.checkin && ultimoToastAlertaRef.current !== alerta.checkin.id) {
      ultimoToastAlertaRef.current = alerta.checkin.id;
      toastService.warning(alerta.mensagem || 'Você possui um checkin aberto há mais de 3 horas.');
    }
  }, [setEstadoCheckin, usuario]);

  useEffect(() => {
    if (!usuario || !isAuthenticated || !podeUsarCheckin) {
      return;
    }
    if (isRotaSemCheckin(pathname)) {
      return;
    }
    let ativo = true;
    const executarCarga = async (): Promise<void> => {
      setLoading(true);
      try {
        if (ativo) {
          await carregarEstado();
        }
      } finally {
        if (ativo) {
          setLoading(false);
        }
      }
    };
    executarCarga();
    const intervalo = window.setInterval(() => {
      carregarEstado().catch(() => undefined);
    }, 60000);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [carregarEstado, isAuthenticated, pathname, podeUsarCheckin, setLoading, usuario]);

  if (!usuario || !isAuthenticated || !podeUsarCheckin || isRotaSemCheckin(pathname)) {
    return null;
  }

  const iniciarCheckin = async (payload: {
    clienteId: string;
    unidadeId: string;
    latitude: number;
    longitude: number;
  }): Promise<void> => {
    setLoading(true);
    try {
      const checkin = await checkinService.iniciar(payload);
      setEstadoCheckin({ checkinAberto: checkin, isAtrasado3h: false, mensagemAlerta: null });
      toastService.success('CheckIN realizado com sucesso.');
    } finally {
      setLoading(false);
    }
  };

  const finalizarCheckin = async (): Promise<void> => {
    if (!checkinAberto) {
      return;
    }
    const coordenadas = await capturarLocalizacao();
    if (!coordenadas) {
      toastService.warning('Não foi possível capturar a geolocalização para o checkout.');
      return;
    }
    setLoading(true);
    try {
      await checkinService.finalizar(checkinAberto.id, {
        latitude: coordenadas.latitude,
        longitude: coordenadas.longitude,
      });
      setEstadoCheckin({ checkinAberto: null, isAtrasado3h: false, mensagemAlerta: null });
      ultimoToastAlertaRef.current = null;
      toastService.success('Checkout realizado com sucesso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-24 right-4 z-50 md:bottom-8 md:right-8">
        <div className="flex flex-col items-center gap-2">
          <button
            className={`btn btn-circle btn-lg shadow-md ${checkinAberto ? 'btn-warning' : 'btn-primary'} relative`}
            onClick={() => {
              if (checkinAberto) {
                setIsCheckoutDialogOpen(true);
                return;
              }
              setModalAberto(true);
            }}
            disabled={isLoading}
            aria-label={checkinAberto ? 'Finalizar checkout' : 'Iniciar checkin'}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : checkinAberto ? (
              <LogOut className="h-5 w-5" />
            ) : (
              <LogIn className="h-5 w-5" />
            )}
            {isAtrasado3h && (
              <span className="absolute -right-1 -top-1 rounded-full bg-error p-1 text-white">
                <TriangleAlert className="h-3 w-3" />
              </span>
            )}
          </button>
          <div className="min-w-[124px] rounded-xl bg-base-100 px-3 py-1.5 text-center text-xs font-semibold leading-tight text-base-content shadow-md ring-1 ring-base-300">
            {checkinAberto ? (
              <span className="inline-flex items-center justify-center gap-1">
                <LogOut className="h-3.5 w-3.5" />
                {isAtrasado3h ? 'Checkout pendente +3h' : 'Checkout'}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                CheckIN
              </span>
            )}
          </div>
        </div>
      </div>
      <CheckinModal
        open={isModalAberto}
        loading={isLoading}
        onClose={() => setModalAberto(false)}
        onConfirm={iniciarCheckin}
      />
      <ConfirmDialog
        open={isCheckoutDialogOpen}
        onClose={() => setIsCheckoutDialogOpen(false)}
        onConfirm={async () => {
          setIsCheckoutDialogOpen(false);
          await finalizarCheckin();
        }}
        title="Confirmar checkout"
        message="Você realmente deseja realizar o checkout?"
        confirmLabel="Sim, realizar checkout"
        cancelLabel="Cancelar"
        variant="warning"
        loading={isLoading}
      />
    </>
  );
}
