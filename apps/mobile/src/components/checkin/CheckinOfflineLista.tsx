import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useAuthStore } from '../../store/auth';
import { useCheckinStore } from '../../store/checkin';
import { FilaRepo } from '../../db/repositories/fila.repo';
import { tentarEnviarDeNovo } from '../../sync/SyncService';
import { CheckinRepo, type CheckinRegistro } from '../../db/repositories/checkin.repo';
import { formatarHora, textoEnvio } from './formatar-hora';

const repo = new CheckinRepo();
const filaRepo = new FilaRepo();
const INTERVALO_ATUALIZACAO_MS = 5000;

function textoStatus(m: CheckinRegistro): string | null {
  const sincronizadoEm = m.checkoutSincronizadoEm ?? m.checkinSincronizadoEm;
  return textoEnvio(m.envioStatus, sincronizadoEm);
}

/**
 * Marcações de check-in/checkout feitas no aparelho nos últimos 7 dias, com o horário
 * do telefone e o estado de envio. Marcações recusadas pelo servidor mostram o motivo
 * e só saem da lista quando o usuário as descarta (com confirmação).
 */
export function CheckinOfflineLista() {
  const usuarioId = useAuthStore((s) => s.user?.id);
  const checkinAberto = useCheckinStore((s) => s.checkinAberto);
  const hidratarDoCache = useCheckinStore((s) => s.hidratarDoCache);
  const [marcacoes, setMarcacoes] = useState<CheckinRegistro[]>([]);

  const recarregar = useCallback((): void => {
    setMarcacoes(usuarioId ? repo.listarRecentesOffline(usuarioId, 7) : []);
  }, [usuarioId]);

  useEffect(() => {
    recarregar();
    const intervalo = setInterval(recarregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
  }, [recarregar, checkinAberto]);

  const confirmarDescarte = (m: CheckinRegistro): void => {
    Alert.alert(
      'Descartar marcação',
      'Esta marcação não foi aceita pelo servidor e será removida deste aparelho. Deseja descartá-la?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            repo.descartar(m.id);
            if (usuarioId) hidratarDoCache(usuarioId);
            recarregar();
          },
        },
      ],
    );
  };

  if (marcacoes.length === 0) return null;

  return (
    <View className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm gap-3">
      <Text className="text-sm font-sans-semibold text-primary">Marcações recentes</Text>
      {marcacoes.map((m) => (
        <View key={m.id} className="border-t border-gray-100 pt-3">
          <Text className="text-sm font-sans-semibold text-neutral">{m.clienteNome ?? 'Cliente'}</Text>
          {m.unidadeNome ? <Text className="text-xs text-gray-500">{m.unidadeNome}</Text> : null}
          <Text className="text-xs text-gray-500 mt-1">
            Check-in feito às {formatarHora(m.dataCheckin)}
            {m.dataCheckout ? ` · Checkout feito às ${formatarHora(m.dataCheckout)}` : ''}
          </Text>
          {m.envioStatus === 'recusado' ? (
            <View className="mt-2 rounded-xl bg-red-50 p-3">
              <Text className="text-xs text-red-700">
                {m.envioErro || 'O servidor não aceitou esta marcação.'}
              </Text>
              <Pressable onPress={() => confirmarDescarte(m)} hitSlop={8} className="mt-2 self-start">
                <Text className="text-xs font-sans-semibold text-red-700">Descartar</Text>
              </Pressable>
            </View>
          ) : m.envioStatus === 'pendente' && filaRepo.estado('checkin', m.id)?.status === 'falhou' ? (
            <View className="mt-2 rounded-xl bg-amber-50 p-3">
              <Text className="text-xs font-sans-semibold text-amber-700">Falha no envio</Text>
              {filaRepo.estado('checkin', m.id)?.ultimoErro ? (
                <Text className="text-xs text-amber-700">{filaRepo.estado('checkin', m.id)?.ultimoErro}</Text>
              ) : null}
              <Pressable
                onPress={() => { void tentarEnviarDeNovo('checkin', m.id).finally(recarregar); }}
                hitSlop={8}
                className="mt-2 self-start"
              >
                <Text className="text-xs font-sans-semibold text-amber-700">Tentar de novo</Text>
              </Pressable>
            </View>
          ) : (
            <Text className="text-xs text-gray-400 mt-1">{textoStatus(m)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
