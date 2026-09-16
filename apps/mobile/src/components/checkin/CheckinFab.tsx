import { useCallback, useEffect } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { usePathname } from 'expo-router';
import { LogIn, LogOut, TriangleAlert } from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import { useCheckinStore } from '../../store/checkin';
import { useGeolocalizacao } from '../../hooks/use-geolocalizacao';
import { CheckinModal } from './CheckinModal';

const PERFIS_CHECKIN = ['auditor', 'gestor', 'master'];
const INTERVALO_ATUALIZACAO_MS = 60000;
const ROTAS_SEM_CHECKIN = ['/auditorias', '/relatorios'];

function isRotaSemCheckin(pathname: string): boolean {
  return ROTAS_SEM_CHECKIN.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

/**
 * Botão flutuante global de check-in/checkout. Oculto nas áreas de auditoria e
 * relatórios técnicos (que já possuem seu próprio FAB), evitando controle duplicado.
 * O check-in/checkout é online-only; o alerta de 3h (RN-CKI-005) é indicado por um
 * badge sobre o botão.
 */
export function CheckinFab() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const {
    checkinAberto, isAtrasado3h, isLoading, isModalAberto,
    setModalAberto, carregarEstado, iniciar, finalizar,
  } = useCheckinStore();
  const { capturarLocalizacao } = useGeolocalizacao();

  const podeUsarCheckin = Boolean(user && PERFIS_CHECKIN.includes(user.perfil));
  const oculto = !podeUsarCheckin || isRotaSemCheckin(pathname);

  useEffect(() => {
    if (oculto || !user) return;
    void carregarEstado(user.id);
    const intervalo = setInterval(() => {
      void carregarEstado(user.id);
    }, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
  }, [oculto, user, carregarEstado]);

  const executarCheckout = useCallback(async (): Promise<void> => {
    if (!user) return;
    const coordenadas = await capturarLocalizacao();
    if (!coordenadas) {
      Alert.alert('Localização necessária', 'Não foi possível capturar a geolocalização para o checkout.');
      return;
    }
    try {
      await finalizar(user.id, coordenadas.latitude, coordenadas.longitude);
    } catch (e) {
      Alert.alert('Erro no checkout', e instanceof Error ? e.message : 'Tente novamente.');
    }
  }, [user, capturarLocalizacao, finalizar]);

  const confirmarCheckout = useCallback((): void => {
    Alert.alert(
      'Confirmar checkout',
      'Deseja realmente realizar o checkout deste check-in?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Realizar checkout', style: 'default', onPress: () => { void executarCheckout(); } },
      ],
    );
  }, [executarCheckout]);

  const confirmarCheckin = useCallback(async (payload: {
    clienteId: string; unidadeId: string; latitude: number; longitude: number;
  }): Promise<void> => {
    if (!user) return;
    try {
      await iniciar(user.id, payload);
    } catch (e) {
      Alert.alert('Erro no check-in', e instanceof Error ? e.message : 'Tente novamente.');
    }
  }, [user, iniciar]);

  if (oculto || !user) {
    return null;
  }

  const aberto = Boolean(checkinAberto);

  return (
    <>
      <View className="absolute right-4" style={{ bottom: 88 }} pointerEvents="box-none">
        <View className="items-center gap-2">
          <Pressable
            onPress={() => (aberto ? confirmarCheckout() : setModalAberto(true))}
            disabled={isLoading}
            className={`w-14 h-14 rounded-full items-center justify-center shadow-lg ${aberto ? 'bg-amber-500' : 'bg-primary'}`}
          >
            {isLoading
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : aberto
                ? <LogOut size={22} color="#FFFFFF" />
                : <LogIn size={22} color="#FFFFFF" />}
            {isAtrasado3h && (
              <View className="absolute -right-1 -top-1 rounded-full bg-red-500 p-1">
                <TriangleAlert size={12} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          <View className="rounded-xl bg-white px-3 py-1 shadow-sm border border-gray-100">
            <Text className="text-[11px] font-sans-semibold text-neutral">
              {aberto ? (isAtrasado3h ? 'Checkout +3h' : 'Checkout') : 'Check-in'}
            </Text>
          </View>
        </View>
      </View>
      <CheckinModal
        visivel={isModalAberto}
        carregando={isLoading}
        onFechar={() => setModalAberto(false)}
        onConfirmar={confirmarCheckin}
      />
    </>
  );
}
