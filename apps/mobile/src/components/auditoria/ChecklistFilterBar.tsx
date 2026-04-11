import { View, Text, TouchableOpacity } from 'react-native';

export type FiltroChecklist = 'todos' | 'pendentes' | 'nao_conformes';

interface Props {
  filtroAtual: FiltroChecklist;
  onFiltroChange: (filtro: FiltroChecklist) => void;
  contadores: { todos: number; pendentes: number; naoConformes: number };
}

const FILTROS: { valor: FiltroChecklist; label: string; contadorKey: keyof Props['contadores'] }[] = [
  { valor: 'todos', label: 'Todos', contadorKey: 'todos' },
  { valor: 'pendentes', label: 'Pendentes', contadorKey: 'pendentes' },
  { valor: 'nao_conformes', label: 'NCs', contadorKey: 'naoConformes' },
];

export function ChecklistFilterBar({ filtroAtual, onFiltroChange, contadores }: Props) {
  return (
    <View className="flex-row bg-white px-4 py-1 gap-2 border-b border-gray-100">
      {FILTROS.map(({ valor, label, contadorKey }) => {
        const isActive = filtroAtual === valor;
        const count = contadores[contadorKey];
        return (
          <TouchableOpacity
            key={valor}
            onPress={() => onFiltroChange(valor)}
            className={`px-3 py-1.5 rounded-full flex-row items-center gap-1
              ${isActive ? 'bg-primary' : 'bg-gray-100'}`}
          >
            <Text className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-600'}`}>
              {label}
            </Text>
            <View className={`px-1.5 rounded-full min-w-[18px] items-center
              ${isActive ? 'bg-white/25' : 'bg-gray-200'}`}>
              <Text className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-gray-500'}`}>
                {count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
