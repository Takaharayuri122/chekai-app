import { View, Text, TextInput, ActivityIndicator } from 'react-native';

interface Props {
  descricaoIa?: string;
  planoAcaoIa?: string;
  loadingIa: boolean;
  descricao: string;
  planoAcao: string;
  onChange: (descricao: string, planoAcao: string) => void;
  readonly?: boolean;
}

export function ItemCamposNc({ descricaoIa, planoAcaoIa, loadingIa, descricao, planoAcao, onChange, readonly }: Props) {
  return (
    <View className="bg-orange-50 border border-orange-200 rounded-xl p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <Text className="text-sm font-semibold text-orange-800">⚠ Não Conformidade</Text>
        {loadingIa && <ActivityIndicator size="small" color="#f59e0b" />}
      </View>

      <View>
        <Text className="text-xs text-orange-700 mb-1 font-medium">Descrição da NC</Text>
        <TextInput
          className="bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm text-neutral min-h-[60px]"
          style={{ lineHeight: 20, textAlignVertical: 'top' }}
          multiline
          value={descricao}
          onChangeText={(t) => onChange(t, planoAcao)}
          placeholder={loadingIa ? 'Aguardando sugestão de IA...' : (descricaoIa ?? 'Descreva a não conformidade')}
          placeholderTextColor="#9CA3AF"
          editable={!readonly}
        />
      </View>

      <View>
        <Text className="text-xs text-orange-700 mb-1 font-medium">Plano de Ação</Text>
        <TextInput
          className="bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm text-neutral min-h-[60px]"
          style={{ lineHeight: 20, textAlignVertical: 'top' }}
          multiline
          value={planoAcao}
          onChangeText={(t) => onChange(descricao, t)}
          placeholder={loadingIa ? 'Aguardando sugestão de IA...' : (planoAcaoIa ?? 'Defina o plano de ação')}
          placeholderTextColor="#9CA3AF"
          editable={!readonly}
        />
      </View>
    </View>
  );
}
