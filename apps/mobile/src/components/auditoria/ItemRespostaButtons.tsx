import { View, Text, TouchableOpacity, TextInput } from 'react-native';

interface OpcaoCustomizada {
  label: string;
  pontuacao: number;
  fotoObrigatoria?: boolean;
}

interface Props {
  tipo: 'padrao' | 'customizado' | 'numero' | 'texto';
  opcoes?: OpcaoCustomizada[];
  valorAtual: string | null;
  unidade?: string;           // for tipo='numero'
  onSelect: (valor: string, pontuacao?: number) => void;
  onTextChange?: (text: string) => void;  // for tipo='texto' and 'numero'
}

export function ItemRespostaButtons({ tipo, opcoes, valorAtual, unidade, onSelect, onTextChange }: Props) {
  if (tipo === 'padrao') {
    return (
      <View className="flex-row gap-2">
        {[
          { v: 'conforme',     label: '✓ Conforme',    active: 'bg-green-100 border-green-600',  text: 'text-green-700' },
          { v: 'nao_conforme', label: '✗ N.Conforme',  active: 'bg-red-100 border-red-600',      text: 'text-red-700' },
          { v: 'na',           label: 'N/A',            active: 'bg-gray-200 border-gray-500',    text: 'text-gray-700' },
        ].map(({ v, label, active, text }) => (
          <TouchableOpacity
            key={v}
            onPress={() => onSelect(v)}
            className={`flex-1 py-3 rounded-xl border-2 items-center justify-center
              ${valorAtual === v ? active : 'border-gray-200 bg-white'}`}
          >
            <Text className={`text-sm font-bold ${valorAtual === v ? text : 'text-gray-500'}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (tipo === 'customizado' && opcoes) {
    return (
      <View className="flex-row flex-wrap gap-2">
        {opcoes.map((o) => (
          <TouchableOpacity
            key={o.label}
            onPress={() => onSelect(o.label, o.pontuacao)}
            className={`px-4 py-2 rounded-xl border-2
              ${valorAtual === o.label ? 'border-primary bg-teal-50' : 'border-gray-200 bg-white'}`}
          >
            <Text className={`text-sm font-semibold ${valorAtual === o.label ? 'text-primary' : 'text-gray-600'}`}>
              {o.label} ({o.pontuacao}pts)
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (tipo === 'numero') {
    return (
      <View className="flex-row items-center gap-3">
        <TextInput
          className="border-2 border-primary rounded-xl px-4 text-2xl font-bold text-center w-24"
          style={{ paddingVertical: 10, lineHeight: 32 }}
          keyboardType="numeric"
          value={valorAtual ?? ''}
          onChangeText={(t) => {
            onSelect(t);
            onTextChange?.(t);
          }}
          placeholder="0"
          placeholderTextColor="#9CA3AF"
        />
        {unidade && <Text className="text-gray-500 text-base">{unidade}</Text>}
      </View>
    );
  }

  // tipo === 'texto'
  return (
    <TextInput
      className="border-2 border-primary rounded-xl px-4 py-3 text-base text-neutral min-h-[80px]"
      style={{ lineHeight: 22, textAlignVertical: 'top' }}
      multiline
      value={valorAtual ?? ''}
      onChangeText={(t) => {
        onSelect(t);
        onTextChange?.(t);
      }}
      placeholder="Descreva sua observação..."
      placeholderTextColor="#9CA3AF"
    />
  );
}
