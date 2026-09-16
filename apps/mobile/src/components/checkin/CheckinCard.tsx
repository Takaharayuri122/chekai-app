import { MapPin, Clock, TriangleAlert } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { useCheckinStore } from '../../store/checkin';

function formatarDesde(dataIso: string): string {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) {
    return '';
  }
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dia = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${dia} às ${hora}`;
}

/**
 * Cartão informativo do check-in aberto do usuário, exibido no Dashboard. Mostra o
 * cliente/unidade, o horário de entrada e destaca o alerta quando o check-in está
 * aberto há mais de 3 horas (RN-CKI-005). Não renderiza nada quando não há check-in aberto.
 */
export function CheckinCard() {
  const checkinAberto = useCheckinStore((s) => s.checkinAberto);
  const isAtrasado3h = useCheckinStore((s) => s.isAtrasado3h);

  if (!checkinAberto) {
    return null;
  }

  return (
    <View className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-center gap-2 mb-2">
        <View className="rounded-full bg-primary/10 p-1.5">
          <MapPin size={16} color="#00B8A9" />
        </View>
        <Text className="text-sm font-sans-semibold text-primary">Check-in em andamento</Text>
      </View>
      <Text className="text-base font-sans-semibold text-neutral">
        {checkinAberto.clienteNome ?? 'Cliente'}
      </Text>
      {checkinAberto.unidadeNome ? (
        <Text className="text-sm text-gray-500">{checkinAberto.unidadeNome}</Text>
      ) : null}
      <View className="flex-row items-center gap-1.5 mt-2">
        <Clock size={14} color="#9CA3AF" />
        <Text className="text-xs text-gray-400">Desde {formatarDesde(checkinAberto.dataCheckin)}</Text>
      </View>
      {isAtrasado3h && (
        <View className="flex-row items-center gap-2 mt-3 rounded-xl bg-amber-50 p-3">
          <TriangleAlert size={16} color="#B45309" />
          <Text className="text-amber-700 text-xs flex-1">
            Check-in aberto há mais de 3 horas. Finalize o checkout pelo botão flutuante.
          </Text>
        </View>
      )}
    </View>
  );
}
